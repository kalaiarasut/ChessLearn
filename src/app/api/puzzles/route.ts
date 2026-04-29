import { NextRequest, NextResponse } from "next/server";
import { getPuzzles } from "@/lib/puzzle-service";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  try {
    const puzzles = await getPuzzles({
      id: searchParams.get("id"),
      excludeId: searchParams.get("excludeId"),
      theme: searchParams.get("theme"),
      minRating: parseInt(searchParams.get("minRating") || "0", 10),
      maxRating: parseInt(searchParams.get("maxRating") || "9999", 10),
      count: parseInt(searchParams.get("count") || "10", 10),
      mode: searchParams.get("mode"),
      random: searchParams.get("random") === "true",
    });

    return NextResponse.json({ puzzles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Cloudflare D1 fetch error:", error);
    return NextResponse.json({ error: "Internal server error", details: message }, { status: 500 });
  }
}
