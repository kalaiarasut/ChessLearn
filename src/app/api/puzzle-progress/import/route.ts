import { NextResponse } from "next/server";
import { importLocalPuzzleProgressForCurrentUser } from "@/lib/puzzle-progress-server";
import type { PuzzleProgressImportInput } from "@/lib/puzzle-progress";

function isValidImportPayload(payload: unknown): payload is PuzzleProgressImportInput {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<PuzzleProgressImportInput>;
  return (
    typeof candidate.summary?.currentRating === "number" &&
    typeof candidate.summary?.puzzlesSolved === "number" &&
    typeof candidate.summary?.puzzlesFailed === "number" &&
    typeof candidate.summary?.currentStreak === "number" &&
    typeof candidate.summary?.bestStormScore === "number" &&
    typeof candidate.summary?.bestStreakScore === "number" &&
    typeof candidate.dailyStatus?.date === "string" &&
    typeof candidate.dailyStatus?.completed === "boolean" &&
    Array.isArray(candidate.recentActivity) &&
    candidate.themeStats !== null &&
    typeof candidate.themeStats === "object"
  );
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isValidImportPayload(payload)) {
    return NextResponse.json({ error: "Invalid puzzle progress import payload." }, { status: 400 });
  }

  try {
    const result = await importLocalPuzzleProgressForCurrentUser(payload);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import local puzzle progress.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
