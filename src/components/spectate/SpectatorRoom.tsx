"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Users, Send, MessageSquare, Smile, Eye, FlipVertical, Maximize2, Minimize2, PieChart, ArrowLeft, ChevronUp, ChevronDown, History } from "lucide-react";
import Link from "next/link";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import themeManifest from "@/data/themeManifest.json";

import { PlayerCard } from "@/components/play/PlayerCard";
import { GameControls } from "@/components/play/GameControls";
import { MoveHistoryPanel } from "@/components/play/MoveHistoryPanel";
import { useStockfishAnalysis } from "@/app/learn/[opening]/use-stockfish-analysis";
import { SettingsModalLayout, BoardPiecesSettingsTab } from "@/components/settings-layout";
import { Settings } from "lucide-react";

interface SpectatorRoomProps {
  match: any;
}

const parseTimeControl = (tc: string | null): number => {
  if (!tc) return 10 * 60 * 1000;
  const minMatch = tc.match(/^(\d+)min$/);    if (minMatch) return parseInt(minMatch[1]) * 60 * 1000;
  const incMatch = tc.match(/^(\d+)\|(\d+)$/); if (incMatch) return parseInt(incMatch[1]) * 60 * 1000;
  const secMatch = tc.match(/^(\d+)s$/);       if (secMatch) return parseInt(secMatch[1]) * 1000;
  const dayMatch = tc.match(/^(\d+)d$/);       if (dayMatch) return parseInt(dayMatch[1]) * 86400 * 1000;
  return 10 * 60 * 1000;
};

function BoardPreview({
  boardTheme,
  pieceTheme,
  boardAssets,
  pieceAssets,
}: {
  boardTheme: string;
  pieceTheme: string;
  boardAssets: Record<string, string>;
  pieceAssets: Record<string, string>;
}) {
  const previewPieces = ["bb", "bq", "bp", null, null, null, "wn", "wk", "wr"];
  const piecePath = pieceAssets[pieceTheme] ?? `/pieces/${pieceTheme}/150`;

  return (
    <div className="w-full aspect-square relative shadow-xl rounded-sm overflow-hidden border border-[var(--border)]">
      <img
        src={boardAssets[boardTheme] ?? `/boards/green.png`}
        alt="Board preview"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
        {previewPieces.map((piece, index) => {
          const row = Math.floor(index / 3);
          const col = index % 3;
          const isLightSquare = (row + col) % 2 === 0;

          return (
            <div key={`${row}-${col}`} className="flex items-center justify-center relative p-1 md:p-2">
              {col === 0 && (
                <span
                  className={`absolute top-1 left-1.5 text-[14px] font-bold ${
                    isLightSquare ? "text-[#b07b46]" : "text-[#e6ca9a]"
                  } select-none`}
                >
                  {8 - row}
                </span>
              )}
              {piece && (
                <img
                  src={`${piecePath}/${piece}.png`}
                  alt={piece}
                  className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const getIncrementMs = (tc: string | null): number => {
  if (!tc) return 0;
  const incMatch = tc.match(/^(\d+)\|(\d+)$/); if (incMatch) return parseInt(incMatch[2]) * 1000;
  return 0;
};

export function SpectatorRoom({ match }: SpectatorRoomProps) {
  // Game & Navigation State
  const [liveGame, setLiveGame] = useState(new Chess());
  const [viewingIndex, setViewingIndex] = useState(-1); // -1 means viewing live
  const [viewingFen, setViewingFen] = useState(liveGame.fen());
  
  // Realtime
  const supabase = createSupabaseBrowserClient();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Clocks
  const [whiteClock, setWhiteClock] = useState(() => parseTimeControl(match.time_control));
  const [blackClock, setBlackClock] = useState(() => parseTimeControl(match.time_control));
  
  // Chat
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Spectator specific
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [floatingEmotes, setFloatingEmotes] = useState<{id: number, emoji: string, left: number}[]>([]);
  const emoteIdCounter = useRef(0);
  const spectatorsChannelRef = useRef<any>(null);

  // Phase 2 State
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [votes, setVotes] = useState({ white: 0, draw: 0, black: 0 });
  const [hasVoted, setHasVoted] = useState(false);

  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsModalTab, setActiveSettingsModalTab] = useState("board");
  const [boardTheme, setBoardTheme] = useState("green");
  const [pieceTheme, setPieceTheme] = useState("neo");

  const customPieces = useMemo(() => {
    const pieces: Record<string, any> = {};
    const pieceTypes = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'];
    const pieceAssets = themeManifest.pieceAssets as Record<string, string>;
    
    pieceTypes.forEach((p) => {
      pieces[p] = ({ squareWidth }: { squareWidth: number }) => (
        <div style={{
          width: squareWidth,
          height: squareWidth,
          backgroundImage: `url(${pieceAssets[pieceTheme] ?? `/pieces/${pieceTheme}/150`}/${p.toLowerCase()}.png)`,
          backgroundSize: '100%'
        }} />
      );
    });
    return pieces;
  }, [pieceTheme]);
  const [isPredictionsCollapsed, setIsPredictionsCollapsed] = useState(false);

  // Stockfish Eval
  const analysis = useStockfishAnalysis(viewingFen, true, 13, 1, 1, 'stockfish-18-lite');

  // Initialization: Current User
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("profiles").select("username").eq("id", user.id).single().then(({ data }) => {
          setCurrentUser({ ...user, username: data?.username || "Anonymous" });
        });
      }
    });
  }, [supabase]);

  // Initialization: Game & Presence Channels
  useEffect(() => {
    let initialGame = new Chess();
    if (match.pgn) {
      try {
        initialGame.loadPgn(match.pgn);
        setLiveGame(initialGame);
        setViewingFen(initialGame.fen());
      } catch (e) {
        console.error("Failed to load PGN", e);
      }
    }

    // Match Updates Channel
    const matchChannel = supabase.channel(`match_${match.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` }, (payload) => {
        if (payload.new.pgn) {
          const newGame = new Chess();
          try {
            newGame.loadPgn(payload.new.pgn);
            setLiveGame(newGame);
            
            // Add time increment if someone moved
            if (newGame.history().length > initialGame.history().length) {
               if (initialGame.turn() === 'w') setWhiteClock(c => c + getIncrementMs(match.time_control));
               else setBlackClock(c => c + getIncrementMs(match.time_control));
            }
            initialGame = newGame;

            // If we were viewing live, update viewing fen
            setViewingIndex((prevIdx) => {
              if (prevIdx === -1) setViewingFen(newGame.fen());
              return prevIdx;
            });

          } catch (e) {}
        }
      })
      .subscribe();

    // Spectator Room Channel (Presence & Emotes & Votes)
    const specChannel = supabase.channel(`match_${match.id}_spectators`, {
      config: { presence: { key: "spectator" } }
    });
    spectatorsChannelRef.current = specChannel;

    specChannel
      .on("presence", { event: "sync" }, () => {
        const presenceState = specChannel.presenceState();
        let count = 0;
        for (const id in presenceState) { count += presenceState[id].length; }
        setSpectatorCount(count);
      })
      .on("broadcast", { event: "emote" }, ({ payload }) => {
        triggerLocalEmote(payload.emoji);
      })
      .on("broadcast", { event: "vote" }, ({ payload }) => {
        setVotes(prev => ({ ...prev, [payload.vote]: prev[payload.vote as keyof typeof prev] + 1 }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const { data } = await supabase.auth.getUser();
          await specChannel.track({ user_id: data?.user?.id || 'anonymous' });
        }
      });

    return () => { 
      supabase.removeChannel(matchChannel); 
      supabase.removeChannel(specChannel);
    };
  }, [match.id, match.pgn, match.time_control, supabase]);

  // Clock Countdown (Only when match is in progress)
  useEffect(() => {
    if (match.status !== 'in_progress') return;
    let lastTime = performance.now();
    
    const interval = setInterval(() => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;
      
      if (liveGame.turn() === 'w') setWhiteClock(prev => Math.max(0, prev - delta));
      else setBlackClock(prev => Math.max(0, prev - delta));
    }, 100);
    return () => clearInterval(interval);
  }, [match.status, liveGame]);

  // Chat Initialization
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
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [chatMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;
    const content = newMessage.trim();
    setNewMessage("");
    setShowEmojiPicker(false);
    await supabase.from("spectator_chat").insert({ match_id: match.id, user_id: currentUser.id, content });
  };

  const onEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  // Emote logic
  const triggerLocalEmote = (emoji: string) => {
    const id = emoteIdCounter.current++;
    const left = 10 + Math.random() * 80; // random horizontal position 10% to 90%
    setFloatingEmotes(prev => [...prev, { id, emoji, left }]);
    setTimeout(() => {
      setFloatingEmotes(prev => prev.filter(e => e.id !== id));
    }, 3000); // remove after animation
  };

  const sendEmote = (emoji: string) => {
    if (spectatorsChannelRef.current) {
      spectatorsChannelRef.current.send({ type: "broadcast", event: "emote", payload: { emoji } });
      triggerLocalEmote(emoji); // show for self immediately
    }
  };

  const castVote = (vote: "white" | "draw" | "black") => {
    if (hasVoted || !spectatorsChannelRef.current) return;
    setHasVoted(true);
    setVotes(prev => ({ ...prev, [vote]: prev[vote] + 1 }));
    spectatorsChannelRef.current.send({ type: "broadcast", event: "vote", payload: { vote } });
  };

  // Move Navigation logic
  const historyMoves = liveGame.history({ verbose: true });
  
  const updateViewingFromIndex = (idx: number) => {
    if (idx === -1 || idx >= historyMoves.length - 1) {
      setViewingIndex(-1);
      setViewingFen(liveGame.fen());
    } else {
      setViewingIndex(idx);
      const tempGame = new Chess();
      for (let i = 0; i <= idx; i++) {
        tempGame.move(historyMoves[i]);
      }
      setViewingFen(tempGame.fen());
    }
  };

  const handleFirstMove = () => updateViewingFromIndex(0);
  const handlePrevMove = () => {
    if (viewingIndex === -1 && historyMoves.length > 0) updateViewingFromIndex(historyMoves.length - 2);
    else if (viewingIndex > 0) updateViewingFromIndex(viewingIndex - 1);
  };
  const handleNextMove = () => {
    if (viewingIndex !== -1) updateViewingFromIndex(viewingIndex + 1);
  };
  const handleLastMove = () => updateViewingFromIndex(-1);

  // Material & Captured pieces calculation
  const calculateMaterial = (fen: string) => {
    const pieces = fen.split(" ")[0].replace(/\d|\//g, "");
    let whiteScore = 0; let blackScore = 0;
    const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, P: 1, N: 3, B: 3, R: 5, Q: 9 };
    for (const p of pieces) {
      if (values[p]) {
        if (p === p.toUpperCase()) whiteScore += values[p];
        else blackScore += values[p];
      }
    }
    return { w: whiteScore, b: blackScore };
  };
  const material = calculateMaterial(viewingFen);
  const whiteAdvantage = Math.max(0, material.w - material.b);
  const blackAdvantage = Math.max(0, material.b - material.w);

  const isLive = viewingIndex === -1;
  const currentViewMoveIndex = isLive ? historyMoves.length - 1 : viewingIndex;

  const topPlayer = boardOrientation === 'white' ? match.black_player : match.white_player;
  const topClock = boardOrientation === 'white' ? blackClock : whiteClock;
  const topAdvantage = boardOrientation === 'white' ? blackAdvantage : whiteAdvantage;
  const isTopWhite = boardOrientation === 'black';

  const bottomPlayer = boardOrientation === 'white' ? match.white_player : match.black_player;
  const bottomClock = boardOrientation === 'white' ? whiteClock : blackClock;
  const bottomAdvantage = boardOrientation === 'white' ? whiteAdvantage : blackAdvantage;
  const isBottomWhite = boardOrientation === 'white';

  const totalVotes = votes.white + votes.draw + votes.black;
  const whitePct = totalVotes > 0 ? (votes.white / totalVotes) * 100 : 33.33;
  const drawPct = totalVotes > 0 ? (votes.draw / totalVotes) * 100 : 33.33;
  const blackPct = totalVotes > 0 ? (votes.black / totalVotes) * 100 : 33.33;

  return (
    <>
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          80% { transform: translateY(-60vh) scale(1.5); opacity: 1; }
          100% { transform: translateY(-80vh) scale(2); opacity: 0; }
        }
        .animate-floatUp {
          animation: floatUp 3s ease-out forwards;
        }
        @media (min-width: 1024px) {
          .spectator-column-height {
            height: calc(min(720px, 100vh - 140px) + 140px) !important;
          }
        }
        @media (max-width: 1023px) {
          .spectator-column-height {
            height: auto !important;
          }
        }
      `}</style>

      {/* Main Wrapper matching online page */}
      <div className={`flex-1 w-full max-w-[1536px] mx-auto flex flex-col lg:flex-row items-start justify-start px-4 sm:px-6 gap-4 xl:gap-8 transition-all duration-700 h-[calc(100vh-80px)] overflow-hidden pt-0 pb-2`}>
        
        {/* Left Side: The Board */}
        <div className={`w-full ${isTheaterMode ? 'lg:w-[100%] max-w-[850px]' : 'lg:w-auto lg:ml-4 xl:ml-8'} flex flex-col items-center relative transition-all duration-700 justify-start shrink-0`}>

          {/* Board Height Constraint Wrapper */}
          <div className={`flex flex-col items-center justify-start w-full relative shrink-0 transition-all duration-700 max-w-[100%] sm:max-w-[90%] lg:max-w-[min(720px,calc(100vh-140px))] lg:mt-0 gap-0`}>

            <div className="flex w-full relative items-stretch mt-4">
              
              {/* Eval Bar */}
              <div className="w-[16px] md:w-[30px] mr-1 md:mr-3 shrink-0 bg-[#333333] rounded overflow-hidden flex flex-col relative shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                <div
                  className={`w-full transition-[height] duration-300 relative ${boardOrientation === "black" ? "bg-white" : "bg-[#202020]"}`}
                  style={{ height: boardOrientation === 'black' ? `${analysis.whiteWinChance}%` : `${100 - analysis.whiteWinChance}%` }}
                ></div>
                <div
                  className={`w-full relative border-t border-[#666] transition-[height] duration-300 ${boardOrientation === "white" ? "bg-white shadow-[0_-2px_10px_rgba(255,255,255,0.6)]" : "bg-[#202020]"}`}
                  style={{ height: boardOrientation === 'white' ? `${analysis.whiteWinChance}%` : `${100 - analysis.whiteWinChance}%` }}
                ></div>
                <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-[2px]">
                  <span className="rounded bg-black/70 px-1 py-1 md:py-0.5 text-center text-[10px] md:text-[10px] font-[700] text-white shadow-sm [writing-mode:vertical-lr] md:[writing-mode:horizontal-tb] rotate-180 md:rotate-0 tracking-widest md:tracking-normal">
                    {analysis.evalScore > 0 ? `+${analysis.evalScore.toFixed(1)}` : (analysis.evalScore < 0 ? analysis.evalScore.toFixed(1) : "0.0")}
                  </span>
                </div>
              </div>

              {/* Center Column: Player -> Board -> Player -> Predictions */}
              <div className="flex flex-col w-full relative">
                
                {/* Floating Action Buttons (Top Right of Board) */}
                <div className="w-auto flex justify-end absolute -top-2 -right-[52px] flex-col gap-2 z-50 items-center">
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center"
                    title="Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setBoardOrientation(prev => prev === 'white' ? 'black' : 'white')}
                    className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center flex-col gap-[2px]"
                    title="Flip Board"
                  >
                    <FlipVertical className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setIsTheaterMode(prev => !prev)}
                    className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center"
                    title="Toggle Theater Mode"
                  >
                    {isTheaterMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                  </button>
                </div>

                <PlayerCard 
                  player={topPlayer}
                  isWhite={isTopWhite}
                  clockMs={topClock}
                  isActiveTurn={liveGame.turn() === (isTopWhite ? 'w' : 'b') && match.status === 'in_progress'}
                  materialAdvantage={topAdvantage}
                  position="top"
                />

              {/* Board Container */}
              <div className="w-full aspect-square relative shadow-2xl rounded-sm overflow-hidden border border-[var(--border)] shrink-0">
                <Chessboard 
                  position={viewingFen} 
                  boardOrientation={boardOrientation}
                  arePiecesDraggable={false}
                  customBoardStyle={{
                    backgroundImage: `url(${(themeManifest.boardAssets as Record<string, string>)[boardTheme] ?? `/boards/green.png`})`,
                    backgroundSize: 'cover'
                  }}
                  customDarkSquareStyle={{ backgroundColor: 'transparent' }}
                  customLightSquareStyle={{ backgroundColor: 'transparent' }}
                  customPieces={customPieces}
                />
                
                {/* Emotes Overlay */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
                  {floatingEmotes.map(emote => (
                    <div 
                      key={emote.id} 
                      className="absolute bottom-0 text-4xl animate-floatUp"
                      style={{ left: `${emote.left}%` }}
                    >
                      {emote.emoji}
                    </div>
                  ))}
                </div>
              </div>

                <PlayerCard 
                  player={bottomPlayer}
                  isWhite={isBottomWhite}
                  clockMs={bottomClock}
                  isActiveTurn={liveGame.turn() === (isBottomWhite ? 'w' : 'b') && match.status === 'in_progress'}
                  materialAdvantage={bottomAdvantage}
                  position="bottom"
                />

              </div>
              
              {/* Quick Emote Buttons */}
              <div className="absolute -right-14 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                {['🤯', '🔥', '👏', '🥶'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => sendEmote(emoji)}
                    className="w-10 h-10 flex items-center justify-center bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-full shadow-lg text-xl hover:scale-110 transition-transform outline-none focus:outline-none focus:ring-0 tap-highlight-transparent"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Column 2: Moves */}
        <div 
          className={`bg-[var(--surface-alt)] lg:bg-[var(--surface)] border-[var(--border)] rounded-2xl shadow-xl flex flex-col shrink-0 transition-all duration-700 mt-2 overflow-hidden lg:ml-auto spectator-column-height ${isTheaterMode ? 'w-0 opacity-0 border-none m-0 p-0' : 'w-full lg:w-[300px] xl:w-[360px] opacity-100 border'}`}
          style={{ maxHeight: '100%' }}
        >
          <div className="w-full lg:w-[300px] xl:w-[360px] flex flex-col h-full shrink-0">
            {/* Moves Header */}
            <div className="p-3 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-2 font-bold text-[13px] text-[var(--text-primary)] shrink-0">
              <History className="w-4 h-4 text-[var(--text-primary)]" />
              Move History
            </div>

            {/* Move History */}
            <div className="flex-1 overflow-y-auto bg-[var(--bg)] custom-scrollbar min-h-0">
              <MoveHistoryPanel 
                history={historyMoves.map(m => m.san)}
                currentMoveIndex={currentViewMoveIndex}
                onMoveClick={(idx) => updateViewingFromIndex(idx)}
              />
            </div>

            {/* Navigation Controls */}
            <div className="p-3 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
              <GameControls 
                onFirstMove={handleFirstMove}
                onPrevMove={handlePrevMove}
                onNextMove={handleNextMove}
                onLastMove={handleLastMove}
                canGoBack={historyMoves.length > 0 && viewingIndex !== 0}
                canGoForward={!isLive}
              />
            </div>
          </div>
        </div>

        {/* Column 3: Chat */}
        <div 
          className={`bg-[var(--surface-alt)] lg:bg-[var(--surface)] border-[var(--border)] rounded-2xl shadow-xl flex flex-col shrink-0 transition-all duration-700 mt-2 overflow-hidden spectator-column-height ${isTheaterMode ? 'w-0 opacity-0 border-none m-0 p-0' : 'w-full lg:w-[300px] xl:w-[360px] opacity-100 border'}`}
          style={{ maxHeight: '100%' }}
        >
          <div className="w-full lg:w-[300px] xl:w-[360px] flex flex-col h-full shrink-0">
            {/* Chat Area */}
            <div className="p-3 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-bold text-[13px] text-[var(--text-primary)]">
                <MessageSquare className="w-4 h-4 text-[var(--text-primary)]" />
                Spectator Chat
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] bg-[var(--surface-alt)] px-2.5 py-1 rounded-full border border-[var(--border)]" title={`${spectatorCount} Spectating`}>
                <Eye className="w-3.5 h-3.5" />
                {spectatorCount}
              </div>
            </div>

            {/* Pinned Predictions Poll (YouTube Style) */}
            <div className="w-full bg-[var(--surface-hover)] px-4 py-2.5 border-b border-[var(--border)] shrink-0 flex flex-col gap-2 z-10 shadow-sm relative">
              <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsPredictionsCollapsed(!isPredictionsCollapsed)}>
                <span className="text-[13px] font-bold flex items-center gap-1.5 text-[var(--text-primary)]">
                  <PieChart className="w-4 h-4 text-[#0ea5e9]" /> 
                  Who will win?
                </span>
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <span className="text-xs font-mono">{totalVotes} Votes</span>
                  {isPredictionsCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>
              </div>
              
              {!isPredictionsCollapsed && (
                <>
                  <div className="w-full h-5 rounded-full overflow-hidden flex shadow-inner border border-[var(--border)] mt-1">
                    <div className="h-full bg-white transition-all duration-700 flex items-center justify-start px-1.5 font-bold text-black text-[10px]" style={{ width: `${whitePct}%` }}>
                      {whitePct > 15 && `${Math.round(whitePct)}%`}
                    </div>
                    <div className="h-full bg-gray-400 transition-all duration-700 flex items-center justify-center font-bold text-white text-[10px]" style={{ width: `${drawPct}%` }}>
                      {drawPct > 15 && `${Math.round(drawPct)}%`}
                    </div>
                    <div className="h-full bg-[#2b2b2b] transition-all duration-700 flex items-center justify-end px-1.5 font-bold text-white text-[10px]" style={{ width: `${blackPct}%` }}>
                      {blackPct > 15 && `${Math.round(blackPct)}%`}
                    </div>
                  </div>

                  {!hasVoted && (
                    <div className="flex gap-1.5 mt-0.5">
                      <button onClick={() => castVote("white")} className="flex-1 py-1 rounded bg-white border border-[#ccc] text-black font-bold text-[11px] hover:opacity-90 transition-all shadow-sm outline-none focus:outline-none focus:ring-0">White</button>
                      <button onClick={() => castVote("draw")} className="flex-1 py-1 rounded bg-gray-400 border border-gray-500 text-white font-bold text-[11px] hover:opacity-90 transition-all shadow-sm outline-none focus:outline-none focus:ring-0">Draw</button>
                      <button onClick={() => castVote("black")} className="flex-1 py-1 rounded bg-[#2b2b2b] border border-black text-white font-bold text-[11px] hover:opacity-90 transition-all shadow-sm outline-none focus:outline-none focus:ring-0">Black</button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
              {chatMessages.length === 0 ? (
                <div className="text-center text-[var(--text-muted)] my-auto flex flex-col items-center gap-2">
                  <Users className="w-8 h-8 opacity-50" />
                  Be the first to chat!
                </div>
              ) : (
                chatMessages.map((msg, i) => {
                  const isWhitePlayer = msg.user_id === match.white_player_id;
                  const isBlackPlayer = msg.user_id === match.black_player_id;
                  
                  return (
                    <div key={i} className="group flex items-start justify-between gap-2 w-full px-2 py-1 hover:bg-[var(--surface-hover)] rounded transition-colors">
                      <div className="flex items-baseline gap-1.5 flex-wrap flex-1">
                        <span className="font-bold text-[13px] text-[var(--text-primary)] shrink-0 transition-colors">
                          {msg.profiles?.username || "Unknown"}
                        </span>
                        {(isWhitePlayer || isBlackPlayer) && (
                          <div className="relative group/tag flex items-center justify-center">
                            <span className="text-[9px] font-bold bg-[#eab308] text-black px-1 rounded-[3px] shrink-0 cursor-default select-none">PL</span>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-primary)] text-[10px] font-bold rounded opacity-0 group-hover/tag:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] shadow-md">
                              PLAYER
                            </div>
                          </div>
                        )}
                        {msg.profiles?.username?.toLowerCase() === 'admin' && (
                          <div className="relative group/tag flex items-center justify-center">
                            <span className="text-[9px] font-bold bg-red-500 text-white px-1 rounded-[3px] shrink-0 cursor-default select-none">AD</span>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-primary)] text-[10px] font-bold rounded opacity-0 group-hover/tag:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] shadow-md">
                              ADMIN
                            </div>
                          </div>
                        )}
                        <span className="text-[14px] text-[var(--text-secondary)] break-words leading-tight ml-1">{msg.content}</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-[var(--border)] bg-[var(--surface)] relative shrink-0 p-3">
              {showEmojiPicker && (
                <div className="absolute bottom-[calc(100%+8px)] right-2 z-50 shadow-2xl rounded-xl overflow-hidden border border-[var(--border)]">
                  <EmojiPicker 
                    onEmojiClick={onEmojiClick} 
                    theme={Theme.AUTO} 
                    lazyLoadEmojis={true} 
                    searchDisabled={true} 
                    width={300} 
                    height={350} 
                  />
                </div>
              )}
              {currentUser ? (
                <form onSubmit={handleSendMessage} className="flex gap-2 relative">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Send a message..."
                      className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-full px-4 py-2 pr-10 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-0 tap-highlight-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 outline-none focus:outline-none focus:ring-0 tap-highlight-transparent"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-full text-[var(--brand)] hover:text-[var(--brand-hover)] disabled:opacity-50 transition-colors p-2 outline-none focus:outline-none focus:ring-0 tap-highlight-transparent"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </form>
              ) : (
                <div className="text-center text-sm text-[var(--text-muted)]">
                  Please sign in to chat
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Settings Modal */}
      <SettingsModalLayout
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeTabId={activeSettingsModalTab}
        onTabChange={setActiveSettingsModalTab}
        tabs={[
          {
            id: "board",
            label: "Board & Pieces",
            content: (
              <BoardPiecesSettingsTab
                activeSettingsTab={activeSettingsModalTab as "boards" | "pieces"}
                setActiveSettingsTab={(tab) => setActiveSettingsModalTab(tab)}
                boardTheme={boardTheme}
                onBoardThemeChange={setBoardTheme}
                pieceTheme={pieceTheme}
                onPieceThemeChange={setPieceTheme}
                boardThemes={Object.keys(themeManifest.boardAssets)}
                pieceThemes={Object.keys(themeManifest.pieceAssets)}
                boardAssets={themeManifest.boardAssets as Record<string, string>}
                pieceAssets={themeManifest.pieceAssets as Record<string, string>}
                boardPreviewNode={
                  <BoardPreview
                    boardTheme={boardTheme}
                    pieceTheme={pieceTheme}
                    boardAssets={themeManifest.boardAssets as Record<string, string>}
                    pieceAssets={themeManifest.pieceAssets as Record<string, string>}
                  />
                }
              />
            ),
          },
        ]}
        footer={
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setBoardTheme("green");
                setPieceTheme("neo");
              }}
              className="px-6 py-2 border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] font-bold rounded-lg transition-colors"
            >
              Reset to Default
            </button>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="px-8 py-2 bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] text-[var(--cta-text)] font-bold rounded-lg transition-colors shadow-md"
            >
              Save
            </button>
          </div>
        }
      />
    </>
  );
}
