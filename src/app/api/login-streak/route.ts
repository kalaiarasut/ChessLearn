import { NextResponse } from "next/server";
import {
  getLoginStreakForCurrentUser,
  recordLoginStreakForCurrentUser,
} from "@/lib/login-streak-server";

export async function GET() {
  try {
    const snapshot = await getLoginStreakForCurrentUser();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load login streak.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST() {
  try {
    const snapshot = await recordLoginStreakForCurrentUser();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update login streak.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
