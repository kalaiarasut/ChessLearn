import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

// Initialize SQLite connection
const DB_PATH = path.join(process.cwd(), "puzzles.sqlite3");
let db: Database.Database | null = null;

try {
  db = new Database(DB_PATH, { readonly: true });
} catch (error) {
  console.warn("⚠️ Could not connect to local SQLite database. Ensure puzzles.sqlite3 exists.");
}

export async function GET(request: NextRequest) {
  if (!db) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
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
      query += " AND themes LIKE ?";
      params.push(`% ${theme} %`);
    }

    if (mode === "daily") {
      // Pick a daily puzzle based on date
      const today = new Date();
      const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      query += " ORDER BY (ABS(CAST(id AS INTEGER)) + ?) % 100000 LIMIT 1";
      params.push(seed);
    } else if (random) {
      // ORDER BY RANDOM() is fast enough for filtered datasets in SQLite, but we can optimize it
      query += " ORDER BY RANDOM() LIMIT ?";
      params.push(count);
    } else {
      query += " ORDER BY popularity DESC LIMIT ?";
      params.push(count);
    }

    const stmt = db.prepare(query);
    const results = stmt.all(...params);

    // Parse moves string into array
    const formattedPuzzles = results.map((row: any) => ({
      ...row,
      moves: row.moves.split(" "),
      themes: row.themes.trim().split(" ")
    }));

    return NextResponse.json({ puzzles: formattedPuzzles });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
