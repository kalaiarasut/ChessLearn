import { NextRequest, NextResponse } from "next/server";
import { getPuzzles, type PuzzleEntry } from "@/lib/puzzle-service";
import {
  getAuthenticatedPuzzleUserId,
  getNextReviewPuzzleForCurrentUser,
  getRecentPuzzleIdsForUser,
} from "@/lib/puzzle-progress-server";
import fallbackPuzzles from "@/data/puzzles.json";

export const runtime = "nodejs";

function parseInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseExcludeIds(searchParams: URLSearchParams) {
  const ids = new Set<string>();
  const excludeId = searchParams.get("excludeId");
  if (excludeId) {
    ids.add(excludeId);
  }

  const excludeIds = searchParams.get("excludeIds");
  if (excludeIds) {
    for (const id of excludeIds.split(",")) {
      const trimmed = id.trim();
      if (trimmed) {
        ids.add(trimmed);
      }
    }
  }

  return Array.from(ids);
}

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function selectFallbackPuzzles(options: {
  id?: string | null;
  count: number;
  theme?: string | null;
  minRating: number;
  maxRating: number;
  mode?: string | null;
  excludeIds?: string[];
}) {
  const localPuzzles = fallbackPuzzles as PuzzleEntry[];
  const excluded = new Set(options.excludeIds ?? []);

  if (options.id) {
    return localPuzzles.filter((puzzle) => puzzle.id === options.id).slice(0, 1);
  }

  const filterPool = (ignoreTheme: boolean, ignoreExclusions: boolean) =>
    localPuzzles.filter((puzzle) => {
      if (!ignoreExclusions && excluded.has(puzzle.id)) return false;
      if (puzzle.rating < options.minRating || puzzle.rating > options.maxRating) return false;
      if (!ignoreTheme && options.theme && options.theme !== "mix" && !puzzle.themes.includes(options.theme)) return false;
      return true;
    });

  let pool = filterPool(false, false);
  if (pool.length === 0) pool = filterPool(true, false);
  if (pool.length === 0) pool = filterPool(true, true);

  if (pool.length === 0) {
    return [];
  }

  const seed =
    options.mode === "daily"
      ? hashSeed(new Date().toISOString().slice(0, 10))
      : Math.floor(Math.random() * pool.length);
  const start = seed % pool.length;
  return [...pool.slice(start), ...pool.slice(0, start)].slice(0, options.count);
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(message)), milliseconds);
    }),
  ]);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  try {
    const mode = searchParams.get("mode");
    const theme = searchParams.get("theme");
    const exactPuzzleId = searchParams.get("puzzleId") ?? searchParams.get("id");
    const excludeIds = parseExcludeIds(searchParams);

    if (mode === "review") {
      const reviewResult = await getNextReviewPuzzleForCurrentUser(theme);
      return NextResponse.json({
        puzzles: reviewResult.puzzle ? [reviewResult.puzzle] : [],
        reviewItem: reviewResult.item,
      });
    }

    if (!exactPuzzleId && searchParams.get("excludeRecent") === "true") {
      const userId = await getAuthenticatedPuzzleUserId();
      if (userId) {
        for (const recentId of await getRecentPuzzleIdsForUser(userId, 12)) {
          excludeIds.push(recentId);
        }
      }
    }

    const puzzleQuery = {
      id: exactPuzzleId,
      excludeId: searchParams.get("excludeId"),
      excludeIds,
      theme,
      minRating: parseInteger(searchParams.get("minRating"), 0),
      maxRating: parseInteger(searchParams.get("maxRating"), 9999),
      count: parseInteger(searchParams.get("count"), 10),
      mode: mode === "standard" ? "random" : mode,
      random:
        searchParams.get("random") === "true" ||
        mode === "standard" ||
        mode === "storm" ||
        mode === "streak" ||
        mode === "random",
    };

    let puzzles;
    try {
      puzzles = await withTimeout(getPuzzles(puzzleQuery), 6_000, "Puzzle D1 request timed out");
    } catch (error) {
      console.warn("Puzzle D1 fetch failed or timed out; using bundled fallback puzzles.", error);
      puzzles = selectFallbackPuzzles({
        id: exactPuzzleId,
        count: parseInteger(searchParams.get("count"), 10),
        theme,
        minRating: parseInteger(searchParams.get("minRating"), 0),
        maxRating: parseInteger(searchParams.get("maxRating"), 9999),
        mode,
        excludeIds,
      });
    }

    return NextResponse.json({ puzzles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Cloudflare D1 fetch error:", error);
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Internal server error", details: message }, { status });
  }
}
