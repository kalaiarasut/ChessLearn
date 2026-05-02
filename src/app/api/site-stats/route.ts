import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SiteStatsRpcRow = {
  puzzles_today: number | null;
  active_players: number | null;
};

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_public_site_stats");

    if (error) {
      throw new Error(error.message);
    }

    const stats = (Array.isArray(data) ? data[0] : data) as SiteStatsRpcRow | null;

    return NextResponse.json({
      puzzlesToday: Math.max(0, Math.round(stats?.puzzles_today ?? 0)),
      activePlayers: Math.max(0, Math.round(stats?.active_players ?? 0)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load site stats.";
    return NextResponse.json({ error: message, puzzlesToday: 0, activePlayers: 0 }, { status: 500 });
  }
}
