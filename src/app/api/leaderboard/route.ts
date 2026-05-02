import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LeaderboardCategory = "puzzle" | "opening" | "activity";

type LeaderboardRpcRow = {
  user_id: string;
  username: string | null;
  score: number | null;
  stat_text: string | null;
  last_activity_at: string | null;
};

const CATEGORIES = new Set<LeaderboardCategory>(["puzzle", "opening", "activity"]);

function toCategory(value: string | null): LeaderboardCategory {
  return CATEGORIES.has(value as LeaderboardCategory) ? (value as LeaderboardCategory) : "puzzle";
}

function toLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  return Math.min(50, Math.max(3, parsed));
}

function displayName(row: LeaderboardRpcRow) {
  const username = row.username?.trim();
  if (username && !/[@＠]/.test(username)) {
    return username.slice(0, 32);
  }
  return `Player ${row.user_id.slice(0, 6)}`;
}

function avatarFor(name: string, userId: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || userId)}`;
}

export async function GET(request: NextRequest) {
  const category = toCategory(request.nextUrl.searchParams.get("category"));
  const limit = toLimit(request.nextUrl.searchParams.get("limit"));

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_public_leaderboard", {
      board_type: category,
      result_limit: limit,
    });

    if (error) {
      throw new Error(error.message);
    }

    const entries = ((data ?? []) as LeaderboardRpcRow[]).map((row, index) => {
      const name = displayName(row);
      const score = Math.max(0, Math.round(row.score ?? 0));

      return {
        rank: index + 1,
        userId: row.user_id,
        name,
        rating: score,
        score,
        stat: row.stat_text ?? String(score),
        avatar: avatarFor(name, row.user_id),
        lastActivityAt: row.last_activity_at,
      };
    });

    return NextResponse.json({ category, entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load leaderboard.";
    return NextResponse.json({ error: message, category, entries: [] }, { status: 500 });
  }
}
