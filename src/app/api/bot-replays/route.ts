import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const REPLAY_ARCHIVE_MAX_ITEMS = 60;

type ReplayOutcome = "win" | "loss" | "draw";

type ReplayArchiveEntry = {
  id: string;
  createdAt: string;
  finalFen: string;
  fenHistory: string[];
  sanMoves: string[];
  moveCount: number;
  timeControlMinutes: number;
  playerSide: "w" | "b" | "bot-vs-bot";
  opponentLabel: string;
  outcome: ReplayOutcome;
  outcomeLabel: string;
  title: string;
  reason: string;
  resultTag: "1-0" | "0-1" | "1/2-1/2";
  whiteLabel: string;
  blackLabel: string;
};

function normalizeReplayEntry(value: unknown): ReplayArchiveEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Partial<ReplayArchiveEntry>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.createdAt !== "string" ||
    typeof entry.finalFen !== "string" ||
    !Array.isArray(entry.fenHistory) ||
    !Array.isArray(entry.sanMoves)
  ) {
    return null;
  }

  try {
    new Chess(entry.finalFen);
  } catch {
    return null;
  }

  return {
    id: entry.id.slice(0, 120),
    createdAt: entry.createdAt,
    finalFen: entry.finalFen,
    fenHistory: entry.fenHistory.filter((fenValue): fenValue is string => typeof fenValue === "string").slice(0, 600),
    sanMoves: entry.sanMoves.filter((move): move is string => typeof move === "string").slice(0, 600),
    moveCount: typeof entry.moveCount === "number" ? entry.moveCount : 0,
    timeControlMinutes: typeof entry.timeControlMinutes === "number" ? entry.timeControlMinutes : 10,
    playerSide:
      entry.playerSide === "w" || entry.playerSide === "b" || entry.playerSide === "bot-vs-bot"
        ? entry.playerSide
        : "w",
    opponentLabel: typeof entry.opponentLabel === "string" ? entry.opponentLabel : "Stockfish",
    outcome: entry.outcome === "win" || entry.outcome === "loss" || entry.outcome === "draw" ? entry.outcome : "draw",
    outcomeLabel: typeof entry.outcomeLabel === "string" ? entry.outcomeLabel : "Draw",
    title: typeof entry.title === "string" ? entry.title : "Game",
    reason: typeof entry.reason === "string" ? entry.reason : "Game ended",
    resultTag: entry.resultTag === "1-0" || entry.resultTag === "0-1" || entry.resultTag === "1/2-1/2" ? entry.resultTag : "1/2-1/2",
    whiteLabel: typeof entry.whiteLabel === "string" ? entry.whiteLabel : "White",
    blackLabel: typeof entry.blackLabel === "string" ? entry.blackLabel : "Black",
  };
}

function normalizeReplayArchive(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeReplayEntry)
    .filter((entry): entry is ReplayArchiveEntry => entry !== null)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, REPLAY_ARCHIVE_MAX_ITEMS);
}

async function getAuthenticatedContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    const { data, error } = await supabase
      .from("user_bot_replays")
      .select("payload")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(REPLAY_ARCHIVE_MAX_ITEMS);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      entries: normalizeReplayArchive((data ?? []).map((row) => row.payload)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load bot replays.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const entries = normalizeReplayArchive((payload as { entries?: unknown })?.entries);

  try {
    const { supabase, user } = await getAuthenticatedContext();
    const { error: deleteError } = await supabase.from("user_bot_replays").delete().eq("user_id", user.id);
    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (entries.length > 0) {
      const rows = entries.map((entry) => ({
        user_id: user.id,
        replay_id: entry.id,
        created_at: entry.createdAt,
        payload: entry,
      }));
      const { error: insertError } = await supabase.from("user_bot_replays").insert(rows);
      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    return NextResponse.json({ ok: true, entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save bot replays.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
