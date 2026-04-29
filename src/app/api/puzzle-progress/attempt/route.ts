import { NextResponse } from "next/server";
import { recordPuzzleAttemptForCurrentUser } from "@/lib/puzzle-progress-server";
import type { PuzzleAttemptInput } from "@/lib/puzzle-progress";

export async function POST(request: Request) {
  let payload: PuzzleAttemptInput;

  try {
    payload = (await request.json()) as PuzzleAttemptInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    !payload ||
    typeof payload.puzzleId !== "string" ||
    typeof payload.puzzleRating !== "number" ||
    !Array.isArray(payload.themes) ||
    (payload.outcome !== "solved" && payload.outcome !== "failed") ||
    typeof payload.mode !== "string"
  ) {
    return NextResponse.json({ error: "Invalid puzzle attempt payload." }, { status: 400 });
  }

  try {
    const snapshot = await recordPuzzleAttemptForCurrentUser(payload);
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record puzzle attempt.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
