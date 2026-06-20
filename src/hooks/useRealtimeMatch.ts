import { useEffect, useState, useCallback, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type MatchStatus = "waiting" | "invite_only" | "in_progress" | "finished" | "abandoned";

export interface RealtimeMatchState {
  pgn: string;
  latestMove?: string;
  status: MatchStatus;
  opponentOnline: boolean;
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  winnerId: string | null;
  chatStatus: "disabled" | "pending_white" | "pending_black" | "enabled";
  timeControl: string | null;
  variant: string | null;
  initialFen: string | null;
  updatedAt: string | null;
}

export function useRealtimeMatch(matchId: string | null, currentUserId?: string | null) {
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [rematchOfferReceived, setRematchOfferReceived] = useState<string | null>(null);
  const [gameState, setGameState] = useState<RealtimeMatchState>({
    pgn: "",
    status: "waiting",
    opponentOnline: false,
    whitePlayerId: null,
    blackPlayerId: null,
    winnerId: null,
    chatStatus: "disabled",
    timeControl: null,
    variant: null,
    initialFen: null,
    updatedAt: null,
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
          chatStatus: data.chat_status || "disabled",
          timeControl: data.time_control,
          variant: data.variant,
          initialFen: data.initial_fen,
          updatedAt: data.updated_at,
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
      .on(
        "broadcast",
        { event: "move" },
        ({ payload }: any) => {
          setGameState(prev => ({ 
            ...prev, 
            pgn: payload.pgn,
            latestMove: payload.latestMove // Keep track of latest move to avoid loadPgn
          }));
        }
      )
      .on(
        "broadcast",
        { event: "draw_offer" },
        () => setDrawOfferReceived(true)
      )
      .on(
        "broadcast",
        { event: "rematch_offer" },
        ({ payload }: any) => {
          if (payload && payload.newMatchId) {
            setRematchOfferReceived(payload.newMatchId);
          }
        }
      )
      .on(
        "broadcast",
        { event: "draw_decline" },
        () => setDrawOfferReceived(false) // Optionally we could notify the sender, but we can just clear it
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload: any) => {
          setGameState(prev => ({
            ...prev,
            status: payload.new.status,
            pgn: payload.new.pgn ?? prev.pgn,
            whitePlayerId: payload.new.white_player_id,
            blackPlayerId: payload.new.black_player_id,
            winnerId: payload.new.winner_id ?? null,
            chatStatus: payload.new.chat_status ?? prev.chatStatus,
            updatedAt: payload.new.updated_at ?? prev.updatedAt,
          }));
        }
      )
      .subscribe(async (status: any) => {
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

  const sendMove = useCallback((newPgn: string, latestMove?: string) => {
    if (!channelRef.current) return;
    
    // Update local state instantly
    setGameState(prev => ({ ...prev, pgn: newPgn, latestMove }));

    // Broadcast to opponent instantly
    channelRef.current.send({
      type: "broadcast",
      event: "move",
      payload: { pgn: newPgn, latestMove },
    });
  }, []);

  const sendDrawOffer = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.send({ type: "broadcast", event: "draw_offer" });
  }, []);

  const declineDrawOffer = useCallback(() => {
    if (!channelRef.current) return;
    setDrawOfferReceived(false);
    channelRef.current.send({ type: "broadcast", event: "draw_decline" });
  }, []);

  const sendRematchOffer = useCallback(async (newMatchId: string) => {
    if (!channelRef.current) return;
    await channelRef.current.send({ type: "broadcast", event: "rematch_offer", payload: { newMatchId } });
  }, []);

  const [chatMessages, setChatMessages] = useState<{senderId: string, text: string, timestamp: number}[]>([]);

  useEffect(() => {
    if (!channelRef.current) return;
    const channel = channelRef.current;
    
    // We add the chat_message handler dynamically so we can access setChatMessages
    channel.on("broadcast", { event: "chat_message" }, ({ payload }: any) => {
      if (payload.text && payload.senderId) {
        setChatMessages(prev => [...prev, {
          senderId: payload.senderId,
          text: payload.text,
          timestamp: payload.timestamp || Date.now()
        }]);
      }
    });
    
  }, [matchId]);

  const sendChatMessage = useCallback((text: string, senderId: string) => {
    if (!channelRef.current) return;
    
    const msg = { senderId, text, timestamp: Date.now() };
    
    setChatMessages(prev => [...prev, msg]);
    
    channelRef.current.send({
      type: "broadcast",
      event: "chat_message",
      payload: msg,
    });
  }, []);

  return { 
    gameState, 
    isLoading, 
    error, 
    sendMove, 
    chatMessages, 
    sendChatMessage,
    drawOfferReceived,
    setDrawOfferReceived,
    sendDrawOffer,
    declineDrawOffer,
    rematchOfferReceived,
    setRematchOfferReceived,
    sendRematchOffer
  };
}
