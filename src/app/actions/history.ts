"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function fetchUserGames(userId: string) {
  const supabase = await createSupabaseServerClient();

  // Fetch matches
  const { data: matches, error } = await supabase
    .from("matches")
    .select(`
      id,
      status,
      pgn,
      white_player_id,
      black_player_id,
      winner_id,
      time_control,
      variant,
      created_at
    `)
    .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
    .in("status", ["finished", "abandoned"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch games:", error);
    return [];
  }

  const profileIds = new Set<string>();
  for (const match of matches || []) {
    if (match.white_player_id) profileIds.add(match.white_player_id);
    if (match.black_player_id) profileIds.add(match.black_player_id);
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, rating, avatar_url")
    .in("id", Array.from(profileIds));

  const profileMap = new Map();
  if (profiles) {
    for (const profile of profiles) {
      profileMap.set(profile.id, profile);
    }
  }

  return (matches || []).map(match => ({
    ...match,
    white_player: profileMap.get(match.white_player_id),
    black_player: profileMap.get(match.black_player_id),
  }));
}
