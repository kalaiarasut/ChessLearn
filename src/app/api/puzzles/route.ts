import { NextRequest, NextResponse } from "next/server";
import { getPuzzles } from "@/lib/puzzle-service";
import {
  getAuthenticatedPuzzleUserId,
  getNextReviewPuzzleForCurrentUser,
  getRecentPuzzleIdsForUser,
} from "@/lib/puzzle-progress-server";

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
      console.warn("Puzzle D1 fetch failed or timed out.", error);

      const canRetryWithoutRecentFilters = !exactPuzzleId && excludeIds.length > 0;
      if (!canRetryWithoutRecentFilters) {
        const details = error instanceof Error ? error.message : "Puzzle D1 request failed.";
        return NextResponse.json(
          { error: "Puzzle service unavailable", details },
          { status: 503 },
        );
      }

      try {
        puzzles = await withTimeout(
          getPuzzles({ ...puzzleQuery, excludeId: null, excludeIds: [] }),
          6_000,
          "Puzzle D1 retry timed out",
        );
      } catch (retryError) {
        const details = retryError instanceof Error ? retryError.message : "Puzzle D1 retry failed.";
        return NextResponse.json(
          { error: "Puzzle service unavailable", details },
          { status: 503 },
        );
      }
    }

    return NextResponse.json({ puzzles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Cloudflare D1 fetch error:", error);
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Internal server error", details: message }, { status });
  }
}
