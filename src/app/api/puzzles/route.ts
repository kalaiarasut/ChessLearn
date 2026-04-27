import { NextRequest, NextResponse } from "next/server";
import puzzlesData from "@/data/puzzles.json";

type Puzzle = {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
  popularity: number;
};

const ALL_PUZZLES: Puzzle[] = puzzlesData as Puzzle[];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const theme = searchParams.get("theme");
  const minRating = parseInt(searchParams.get("minRating") || "0", 10);
  const maxRating = parseInt(searchParams.get("maxRating") || "9999", 10);
  const count = Math.min(50, Math.max(1, parseInt(searchParams.get("count") || "10", 10)));
  const random = searchParams.get("random") === "true";
  const mode = searchParams.get("mode");

  let filtered = ALL_PUZZLES;

  if (theme) {
    const t = theme.toLowerCase();
    filtered = filtered.filter((p) => p.themes.some((pt) => pt.toLowerCase() === t));
  }

  filtered = filtered.filter((p) => p.rating >= minRating && p.rating <= maxRating);

  if (mode === "daily") {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const rand = seededRandom(seed);
    const idx = Math.floor(rand() * ALL_PUZZLES.length);
    return NextResponse.json({ puzzles: [ALL_PUZZLES[idx]] });
  }

  if (random) {
    const seed = Date.now();
    filtered = shuffleArray(filtered, seededRandom(seed));
  }

  return NextResponse.json({ puzzles: filtered.slice(0, count) });
}
