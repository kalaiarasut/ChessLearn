"use client";

import { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Users, Send, MessageSquare } from "lucide-react";
import Link from "next/link";

interface SpectatorRoomProps {
  match: any;
}

export function SpectatorRoom({ match }: SpectatorRoomProps) {
  const [game, setGame] = useState(new Chess());
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("profiles").select("username").eq("id", user.id).single().then(({ data }) => {
          setCurrentUser({ ...user, username: data?.username || "Anonymous" });
        });
      }
    });
  }, [supabase]);

  // Load initial PGN
  useEffect(() => {
    if (match.pgn) {
      try {
        const newGame = new Chess();
        newGame.loadPgn(match.pgn);
        setGame(newGame);
      } catch (e) {
        console.error("Failed to load PGN", e);
      }
    }
  }, [match.pgn]);

  // Realtime updates for Match PGN
  useEffect(() => {
    const channel = supabase.channel(`match_${match.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` }, (payload) => {
        if (payload.new.pgn) {
          const newGame = new Chess();
          try {
            newGame.loadPgn(payload.new.pgn);
            setGame(newGame);
          } catch (e) {}
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [match.id, supabase]);

  // Load initial chat & subscribe
  useEffect(() => {
    const loadChat = async () => {
      const { data } = await supabase
        .from('spectator_chat')
        .select('*, profiles(username)')
        .eq('match_id', match.id)
        .order('created_at', { ascending: true })
        .limit(100);
      if (data) setChatMessages(data);
    };
    loadChat();

    const chatChannel = supabase.channel(`chat_${match.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'spectator_chat', filter: `match_id=eq.${match.id}` }, async (payload) => {
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', payload.new.user_id).single();
        setChatMessages(prev => [...prev, { ...payload.new, profiles: profile }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(chatChannel); };
  }, [match.id, supabase]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    const content = newMessage.trim();
    setNewMessage("");

    await supabase.from("spectator_chat").insert({
      match_id: match.id,
      user_id: currentUser.id,
      content
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 md:px-8 h-[calc(100vh-120px)]">
      
      {/* Left: Board */}
      <div className="lg:col-span-2 flex flex-col justify-center items-center h-full">
        <div className="w-full max-w-[600px] flex flex-col gap-4">
          
          {/* Black Player */}
          <div className="flex justify-between items-center bg-[var(--surface-alt)] p-4 rounded-xl border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <img src={match.black_player?.avatar_url || `https://ui-avatars.com/api/?name=${match.black_player?.username || 'B'}`} className="w-10 h-10 rounded-full" alt="Black" />
              <div className="flex flex-col">
                <Link href={`/user/${match.black_player?.username}`} className="font-bold text-[var(--text-primary)] hover:underline">
                  {match.black_player?.username || 'Black'}
                </Link>
                <span className="text-sm text-[var(--text-muted)] font-mono">{Math.round(match.black_player?.rating || 1200)}</span>
              </div>
            </div>
            <div className="w-4 h-4 rounded-full bg-black border border-[var(--border)]"></div>
          </div>

          <div className="w-full aspect-square relative shadow-2xl rounded-sm overflow-hidden border-4 border-[#4a3b32]">
            <Chessboard 
              position={game.fen()} 
              arePiecesDraggable={false}
              customDarkSquareStyle={{ backgroundColor: "#779556" }}
              customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
            />
          </div>

          {/* White Player */}
          <div className="flex justify-between items-center bg-[var(--surface-alt)] p-4 rounded-xl border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <img src={match.white_player?.avatar_url || `https://ui-avatars.com/api/?name=${match.white_player?.username || 'W'}`} className="w-10 h-10 rounded-full" alt="White" />
              <div className="flex flex-col">
                <Link href={`/user/${match.white_player?.username}`} className="font-bold text-[var(--text-primary)] hover:underline">
                  {match.white_player?.username || 'White'}
                </Link>
                <span className="text-sm text-[var(--text-muted)] font-mono">{Math.round(match.white_player?.rating || 1200)}</span>
              </div>
            </div>
            <div className="w-4 h-4 rounded-full bg-white border border-[#ccc]"></div>
          </div>

        </div>
      </div>

      {/* Right: Spectator Chat */}
      <div className="flex flex-col bg-[var(--surface-alt)] border border-[var(--border)] rounded-2xl overflow-hidden h-full">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-2 font-bold text-[var(--text-primary)]">
          <MessageSquare className="w-5 h-5 text-[var(--brand)]" />
          Spectator Chat
          <span className="ml-auto text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> LIVE
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {chatMessages.length === 0 ? (
            <div className="text-center text-[var(--text-muted)] my-auto flex flex-col items-center gap-2">
              <Users className="w-8 h-8 opacity-50" />
              Be the first to chat!
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm text-[var(--text-primary)]">{msg.profiles?.username || "Unknown"}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span className="text-[var(--text-secondary)] text-[15px]">{msg.content}</span>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)]">
          {currentUser ? (
            <form onSubmit={handleSendMessage} className="flex relative">
              <input 
                type="text" 
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Send a message..." 
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-full py-2.5 pl-4 pr-12 text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] transition-colors"
              />
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-[var(--brand)] text-white hover:opacity-90 disabled:opacity-50 disabled:bg-[var(--surface-alt)] disabled:text-[var(--text-muted)] transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="text-center text-sm text-[var(--text-muted)] p-2">
              Please sign in to chat
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
