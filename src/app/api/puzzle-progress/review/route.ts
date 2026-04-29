import { NextRequest, NextResponse } from "next/server";
import { getNextReviewPuzzleForCurrentUser } from "@/lib/puzzle-progress-server";

export async function GET(request: NextRequest) {
  try {
    const theme = request.nextUrl.searchParams.get("theme");
    const result = await getNextReviewPuzzleForCurrentUser(theme);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load review puzzle.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
