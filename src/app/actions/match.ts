"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { calculateNewRating } from "@/lib/glicko";

/**
 * Uses the join_matchmaking Postgres function to atomically find or create a match.
 */
export async function findOrCreateMatch() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be logged in to play online.");
  }

  // Check if profile exists
  const { data: profile } = await supabase.from("profiles").select("rating").eq("id", user.id).single();
  if (!profile) {
    // Need to onboard
    return { error: "needs_onboarding" };
  }

  // Call the Postgres function
  const { data: matchId, error } = await supabase.rpc("join_matchmaking", { rating_tolerance: 150.0 });
  
  if (error) {
    console.error("Matchmaking error:", error);
    throw new Error("Failed to join matchmaking queue.");
  }

  return { matchId };
}

/**
 * Creates an invite-only match to play with a friend.
 */
export async function createFriendMatch(initialPgn: string = "") {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Must be logged in.");

  const { data: match, error } = await supabase.from("matches").insert({
    white_player_id: user.id,
    status: "invite_only",
    pgn: initialPgn
  }).select("id").single();

  if (error) throw new Error("Failed to create friend match.");

  return { matchId: match.id };
}

/**
 * Joins an invite-only match as the black player.
 * Uses a SECURITY DEFINER Postgres function to bypass RLS.
 */
export async function joinFriendMatch(matchId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Must be logged in.");

  const { error } = await supabase.rpc("join_invite_match", { match_id: matchId });

  if (error) {
    console.error("joinFriendMatch RPC error:", error);
    throw new Error("Failed to join match.");
  }

  return { success: true };
}

/**
 * Updates the game PGN (called from the client periodically or at the end of the game).
 * For instant UI updates, we use Supabase Realtime Broadcast.
 */
export async function syncGameState(matchId: string, pgn: string, status: string, winnerId?: string | null) {
  const supabase = await createSupabaseServerClient();
  
  // First update match state
  const { error } = await supabase.from("matches").update({
    pgn,
    status,
    winner_id: winnerId,
    updated_at: new Date().toISOString()
  }).eq("id", matchId);

  if (error) {
    console.error("Failed to sync game state:", error);
    return;
  }

  // If match finished, compute new ratings
  if (status === 'finished') {
    // 1. Fetch match to get players
    const { data: match } = await supabase.from("matches").select("white_player_id, black_player_id").eq("id", matchId).single();
    if (!match || !match.white_player_id || !match.black_player_id) return;

    // 2. Fetch profiles
    const { data: wProfile } = await supabase.from("profiles").select("rating, rd, volatility").eq("id", match.white_player_id).single();
    const { data: bProfile } = await supabase.from("profiles").select("rating, rd, volatility").eq("id", match.black_player_id).single();
    
    if (wProfile && bProfile) {
      // 3. Determine scores (1 for win, 0 for loss, 0.5 for draw)
      let wScore = 0.5;
      let bScore = 0.5;
      if (winnerId === match.white_player_id) { wScore = 1; bScore = 0; }
      else if (winnerId === match.black_player_id) { wScore = 0; bScore = 1; }

      // 4. Calculate new ratings
      const wParams = { rating: wProfile.rating, rd: wProfile.rd, vol: wProfile.volatility };
      const bParams = { rating: bProfile.rating, rd: bProfile.rd, vol: bProfile.volatility };

      const newW = calculateNewRating(wParams, bParams, wScore);
      const newB = calculateNewRating(bParams, wParams, bScore);

      // 5. Update profiles
      await supabase.from("profiles").update({ rating: newW.rating, rd: newW.rd, volatility: newW.vol }).eq("id", match.white_player_id);
      await supabase.from("profiles").update({ rating: newB.rating, rd: newB.rd, volatility: newB.vol }).eq("id", match.black_player_id);
    }
  }
}
