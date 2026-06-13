import { useEffect, useState, useCallback, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type MatchStatus = "waiting" | "invite_only" | "in_progress" | "finished" | "abandoned";

export interface RealtimeMatchState {
  pgn: string;
  status: MatchStatus;
  opponentOnline: boolean;
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  winnerId: string | null;
}

export function useRealtimeMatch(matchId: string | null, currentUserId?: string | null) {
  const [gameState, setGameState] = useState<RealtimeMatchState>({
    pgn: "",
    status: "waiting",
    opponentOnline: false,
    whitePlayerId: null,
    blackPlayerId: null,
    winnerId: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createSupabaseBrowserClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch initial match state
  useEffect(() => {
    if (!matchId) return;

    const fetchMatch = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (error || !data) {
        setError("Match not found or accessible.");
      } else {
        setGameState(prev => ({
          ...prev,
          pgn: data.pgn || "",
          status: data.status,
          whitePlayerId: data.white_player_id,
          blackPlayerId: data.black_player_id,
          winnerId: data.winner_id ?? null,
        }));
      }
      setIsLoading(false);
    };

    fetchMatch();
  }, [matchId, supabase]);

  // Set up Realtime subscriptions
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase.channel(`match:${matchId}`, {
      config: {
        presence: { key: "player" },
        broadcast: { self: false } // We don't need to hear our own broadcast
      }
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        // Check if there's someone else in the presence list besides us
        // Simplified: if there are 2 people, opponent is online.
        const activeUsers = Object.keys(state).length;
        setGameState(prev => ({
          ...prev,
          opponentOnline: activeUsers > 1
        }));
      })
      .on("broadcast", { event: "move" }, ({ payload }) => {
        if (payload.pgn) {
          setGameState(prev => ({ ...prev, pgn: payload.pgn }));
        }
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          setGameState(prev => ({
            ...prev,
            status: payload.new.status,
            pgn: payload.new.pgn ?? prev.pgn,
            whitePlayerId: payload.new.white_player_id,
            blackPlayerId: payload.new.black_player_id,
            winnerId: payload.new.winner_id ?? null,
          }));
        }
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track presence
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await channel.track({ user_id: user.id });
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, supabase]);

  const sendMove = useCallback((newPgn: string) => {
    if (!channelRef.current) return;
    
    // Update local state instantly
    setGameState(prev => ({ ...prev, pgn: newPgn }));

    // Broadcast to opponent instantly
    channelRef.current.send({
      type: "broadcast",
      event: "move",
      payload: { pgn: newPgn },
    });
  }, []);

  return { gameState, isLoading, error, sendMove };
}
