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

    const puzzles = await getPuzzles({
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
    });

    return NextResponse.json({ puzzles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Cloudflare D1 fetch error:", error);
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Internal server error", details: message }, { status });
  }
}
