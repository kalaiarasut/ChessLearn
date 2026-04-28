import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const dbId = process.env.CLOUDFLARE_DATABASE_ID || "e6b0defb-7070-4138-9448-a2e82ee477a5";
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !token) {
    return NextResponse.json(
      { error: "Cloudflare D1 credentials missing. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN." },
      { status: 500 }
    );
  }

  const { searchParams } = request.nextUrl;
  const theme = searchParams.get("theme");
  const minRating = parseInt(searchParams.get("minRating") || "0", 10);
  const maxRating = parseInt(searchParams.get("maxRating") || "9999", 10);
  const count = Math.min(50, Math.max(1, parseInt(searchParams.get("count") || "10", 10)));
  const mode = searchParams.get("mode");
  const random = searchParams.get("random") === "true";

  try {
    let query = "SELECT * FROM puzzles WHERE rating >= ? AND rating <= ?";
    const params: any[] = [minRating, maxRating];

    if (theme && theme !== "mix") {
      query += " AND (' ' || themes || ' ') LIKE ?";
      params.push(`% ${theme} %`);
    }

    if (mode === "daily") {
      const today = new Date();
      const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      query += " ORDER BY (ABS(CAST(id AS INTEGER)) + ?) % 100000 LIMIT 1";
      params.push(seed);
    } else if (random) {
      query += " ORDER BY RANDOM() LIMIT ?";
      params.push(count);
    } else {
      query += " ORDER BY popularity DESC LIMIT ?";
      params.push(count);
    }

    // Query D1 via HTTP REST API for perfect Vercel compatibility
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql: query,
          params: params,
        }),
      }
    );

    const data = await response.json();

    if (!data.success || !data.result?.[0]?.results) {
      console.error("D1 API Error:", data.errors);
      return NextResponse.json({ puzzles: [] });
    }

    const results = data.result[0].results;

    const formattedPuzzles = results.map((row: any) => ({
      ...row,
      moves: row.moves.split(" "),
      themes: row.themes.trim().split(" ")
    }));

    return NextResponse.json({ puzzles: formattedPuzzles });
  } catch (error: any) {
    console.error("Cloudflare D1 fetch error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
