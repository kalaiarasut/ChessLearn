import { NextResponse } from "next/server";
import { getPuzzleProgressSnapshotForCurrentUser } from "@/lib/puzzle-progress-server";

export async function GET() {
  try {
    const snapshot = await getPuzzleProgressSnapshotForCurrentUser();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load puzzle progress.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
