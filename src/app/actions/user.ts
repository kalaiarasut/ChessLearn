"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getUserProfile(username: string) {
  const supabase = await createSupabaseServerClient();
  
  // Fetch user profile by username
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, rating, verified, created_at")
    .eq("username", username)
    .single();

  if (error || !profile) {
    return null;
  }

  // Fetch matches to calculate stats
  const { data: matches } = await supabase
    .from("matches")
    .select("status, white_player_id, black_player_id, winner_id")
    .or(`white_player_id.eq.${profile.id},black_player_id.eq.${profile.id}`)
    .in("status", ["finished", "abandoned"]);

  let wins = 0;
  let losses = 0;
  let draws = 0;

  if (matches) {
    for (const match of matches) {
      if (match.winner_id === profile.id) {
        wins++;
      } else if (match.winner_id) {
        losses++;
      } else if (!match.winner_id && match.status === "finished") {
        draws++;
      }
    }
  }

  const totalGames = wins + losses + draws;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  return {
    ...profile,
    stats: {
      wins,
      losses,
      draws,
      totalGames,
      winRate
    }
  };
}
