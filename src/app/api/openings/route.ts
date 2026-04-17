import { NextResponse } from "next/server";
import { getOpeningCards } from "@/lib/openings-catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? 80);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 80;

  try {
    const openings = await getOpeningCards(limit);
    return NextResponse.json({ openings, count: openings.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load openings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
