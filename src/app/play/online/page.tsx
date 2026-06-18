"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "@/components/ui/Navbar";
import { Chess, type Square } from "chess.js";
import { 
  Rocket, Zap, Clock, Sun, Settings, ArrowLeft, Moon, LayoutGrid, Users, Handshake, Bot, Info, ChevronDown, ChevronUp, Bomb, Swords, Flag, User, SignalHigh, SkipBack, SkipForward, ChevronLeft, ChevronRight, MessageSquare, Palette, Gamepad2, Volume2, Monitor, Shield, Crown, RotateCcw, LineChart
} from "lucide-react";
import themeManifest from "@/data/themeManifest.json";
import { useTheme } from "@/lib/theme-context";
import { SettingsModalLayout, BoardPiecesSettingsTab } from "@/components/settings-layout";
import PlayersTab from "@/components/ui/PlayersTab";
import GamesHistory from "@/components/ui/GamesHistory";
import { Tooltip } from "@/components/ui/Tooltip";
import Link from "next/link";
import { generateChess960BackRank } from "../computer/page";
import { useSearchParams, useRouter } from "next/navigation";
import { useRealtimeMatch } from "@/hooks/useRealtimeMatch";
import { findOrCreateMatch, createFriendMatch, joinFriendMatch, syncGameState, setChatStatus } from "@/app/actions/match";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEFAULT_CLIENT_PREFERENCES, loadClientPreferences, saveClientPreferences } from "@/lib/client-preferences";
import { useDisplayPreferences } from "@/lib/display-preferences-context";
import { ACHIEVEMENTS } from "@/lib/data/gamification";
import { showAchievement } from "@/components/ui/AchievementToast";
import { evaluateMoveAchievements, evaluateGameEndAchievements } from "@/lib/chess/achievement-engine";

const VARIANTS = [
  { id: "chess960", label: "Chess960", desc: "Randomized back rank starting position." },
  { id: "kingOfTheHill", label: "King of the Hill", desc: "Bring your king to the center squares (d4, d5, e4, e5) to win." },
  { id: "crazyhouse", label: "Crazyhouse", desc: "Captured pieces can be dropped back onto the board." },
  { id: "bughouse", label: "Bughouse", desc: "Team variant where captured pieces are passed to your partner." },
  { id: "3check", label: "3-Check", desc: "Check the opponent's king 3 times to win." },
  { id: "atomic", label: "Atomic", desc: "Captures cause explosions that destroy surrounding pieces." },
  { id: "horde", label: "Horde", desc: "Black has a normal army, White has 36 pawns." },
  { id: "racingKings", label: "Racing Kings", desc: "Race your king to the 8th rank to win." },
  { id: "custom", label: "Custom Position / Odds", desc: "Play from a custom starting position or with material odds." },

];

const VARIANT_ICONS: Record<string, { file?: string, Icon?: any, color: string }> = {
  standard: { file: "standard.svg", color: "#a3a3a3" },
  chess960: { file: "chess960.svg", color: "#f97316" },
  bughouse: { file: "bughouse.svg", color: "#84cc16" },
  custom: { file: "custom.svg", color: "#64748b" },
  "3check": { file: "three-check.svg", color: "#14b8a6" },
  crazyhouse: { file: "crazyhouse.svg", color: "#0ea5e9" },
  kingOfTheHill: { file: "king-of-the-hill.svg", color: "#b45309" },
  atomic: { Icon: Bomb, color: "#ef4444" },
  horde: { Icon: Swords, color: "#8b5cf6" },
  racingKings: { Icon: Flag, color: "#ec4899" }
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const AVAILABLE_BOARD_THEMES = themeManifest.boardThemes;
const AVAILABLE_PIECE_THEMES = themeManifest.pieceThemes;
const BOARD_THEME_ASSETS = themeManifest.boardAssets as Record<string, string>;
const PIECE_THEME_ASSETS = themeManifest.pieceAssets as Record<string, string>;

const toSquare = (rowIndex: number, columnIndex: number) =>
  `${FILES[columnIndex]}${8 - rowIndex}` as Square;

const PieceImage = ({ src, alt, className }: { src: string; alt: string; className?: string; skeletonClassName?: string }) => {
  return (
    <div className={`relative w-full h-full flex items-center justify-center`}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={`select-none pointer-events-none ${className || "w-full h-full scale-[1.03] object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.55)]"}`}
      />
    </div>
  );
};

const BoardImage = ({ src, className, children }: { src: string; className?: string; children?: React.ReactNode }) => {
  return (
    <div className={`relative ${className || ""}`}>
      {/* Fallback color while image loads */}
      <div className="absolute inset-0 w-full h-full grid grid-cols-8 grid-rows-8">
        {Array.from({ length: 64 }).map((_, i) => {
          const row = Math.floor(i / 8);
          const col = i % 8;
          return (
            <div
              key={i}
              className={(row + col) % 2 === 0 ? 'bg-[#e6ca9a]' : 'bg-[#b07b46]'}
            />
          );
        })}
      </div>
      <img
        src={src}
        alt="Board Theme"
        loading="eager"
        fetchPriority="high"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
};

const getPieceIcon = (code: string | null, pieceTheme: string) => {
  if (!code) return null;
  // Convert FEN piece symbols (e.g., 'P', 'k') to image filename format (e.g., 'wp', 'bk')
  let fileName = code;
  if (code.length === 1) {
    const isWhite = code === code.toUpperCase();
    fileName = `${isWhite ? 'w' : 'b'}${code.toLowerCase()}`;
  }
  return (
    <PieceImage
      src={`${PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`}/${fileName}.png`}
      alt={code}
    />
  );
};

type TimeControlItem = {
  id: string;
  label: string;
  expandedOnly?: boolean;
};

type TimeControlCategory = {
  category: string;
  icon: React.ElementType;
  iconColor: string;
  hasInfo?: boolean;
  items: TimeControlItem[];
};

const TIME_CONTROLS: TimeControlCategory[] = [
  {
    category: "Bullet",
    icon: Rocket,
    iconColor: "text-[#D4A373] dark:text-[#E6B981]",
    items: [
      { id: "1min", label: "1 min" },
      { id: "1|1", label: "1 | 1" },
      { id: "2|1", label: "2 | 1" },
      { id: "30s", label: "30 sec", expandedOnly: true },
      { id: "20s", label: "20 sec ...", expandedOnly: true },
    ]
  },
  {
    category: "Blitz",
    icon: Zap,
    iconColor: "text-yellow-400",
    items: [
      { id: "3min", label: "3 min" },
      { id: "3|2", label: "3 | 2" },
      { id: "5min", label: "5 min" },
      { id: "5|5", label: "5 | 5", expandedOnly: true },
      { id: "5|2", label: "5 | 2", expandedOnly: true },
    ]
  },
  {
    category: "Rapid",
    icon: Clock,
    iconColor: "text-[#81B64C]",
    items: [
      { id: "10min", label: "10 min" },
      { id: "15|10", label: "15 | 10" },
      { id: "30min", label: "30 min" },
      { id: "10|5", label: "10 | 5", expandedOnly: true },
      { id: "20min", label: "20 min", expandedOnly: true },
      { id: "60min", label: "60 min", expandedOnly: true },
    ]
  },
  {
    category: "Daily",
    icon: Sun,
    iconColor: "text-yellow-500",
    hasInfo: true,
    items: [
      { id: "1d", label: "1 day" },
      { id: "3d", label: "3 days" },
      { id: "7d", label: "7 days" },
      { id: "2d", label: "2 days", expandedOnly: true },
      { id: "5d", label: "5 days", expandedOnly: true },
      { id: "14d", label: "14 days", expandedOnly: true },
    ]
  }
];

const getOpening = (pgn: string) => {
  if (!pgn) return "Starting Position";
  if (pgn.startsWith("1. e4 e5 2. Nf3 Nc6 3. Bb5")) return "Ruy Lopez";
  if (pgn.startsWith("1. e4 e5 2. Nf3 Nc6 3. Bc4")) return "Italian Game";
  if (pgn.startsWith("1. e4 e5 2. Nf3 Nc6 3. d4")) return "Scotch Game";
  if (pgn.startsWith("1. e4 c5")) return "Sicilian Defense";
  if (pgn.startsWith("1. d4 d5 2. c4")) return "Queen's Gambit";
  if (pgn.startsWith("1. d4 Nf6 2. c4 g6 3. Nc3 Bg7")) return "King's Indian Defense";
  if (pgn.startsWith("1. e4 e6")) return "French Defense";
  if (pgn.startsWith("1. e4 c6")) return "Caro-Kann Defense";
  if (pgn.startsWith("1. d4 Nf6 2. c4 e6")) return "Nimzo-Indian Defense";
  if (pgn.startsWith("1. e4")) return "King's Pawn Opening";
  if (pgn.startsWith("1. d4")) return "Queen's Pawn Opening";
  if (pgn.startsWith("1. c4")) return "English Opening";
  if (pgn.startsWith("1. Nf3")) return "Réti Opening";
  return "Custom Opening";
};

export default function PlayOnlinePage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">Loading...</div>}>
      <PlayOnlineContent />
    </React.Suspense>
  );
}

function PlayOnlineContent() {
  const { isDark, toggleTheme } = useTheme();
  const { boardTheme, pieceTheme, soundEnabled, setBoardTheme, setPieceTheme, setSoundEnabled } = useDisplayPreferences();
  const searchParams = useSearchParams();
  const router = useRouter();
  const matchId = searchParams.get("matchId");
  // `invite=1` is appended by GlobalInviteListener when a friend invite is accepted
  const isFriendInviteParam = searchParams.get("invite") === "1";
  
  const [userId, setUserId] = useState<string | null>(null);
  
  useEffect(() => {
    createSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      if (!data.user) {
        const currentUrl = window.location.pathname + window.location.search;
        router.push(`/login?next=${encodeURIComponent(currentUrl)}`);
      } else {
        setUserId(data.user.id);
      }
    });
  }, [router]);

  const { 
    gameState, isLoading: isMatchLoading, error: matchError, sendMove, 
    chatMessages, sendChatMessage, drawOfferReceived, setDrawOfferReceived, sendDrawOffer, declineDrawOffer,
    rematchOfferReceived, setRematchOfferReceived, sendRematchOffer
  } = useRealtimeMatch(matchId, userId);
  const [rematchSent, setRematchSent] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [moveTimes, setMoveTimes] = useState<number[]>([]);
  const [lastMoveTimestamp, setLastMoveTimestamp] = useState<number>(Date.now());
  const [ratingRangeEnabled, setRatingRangeEnabled] = useState(false);
  const [ratingMin, setRatingMin] = useState(-50);
  const [ratingMax, setRatingMax] = useState(50);

  // Gamification state
  const [gamificationState, setGamificationState] = useState<Record<string, { current: number, max: number, unlocked: boolean }>>({});
  const gamificationIncrementsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/gamification/progress').then(res => res.json()).then(data => {
      if (data.progress) setGamificationState(data.progress);
    });
  }, []);

  // ── Player Profiles ──────────────────────────────────────────────────────────
  const [myProfile, setMyProfile] = useState<{ username: string; rating: number } | null>(null);
  const [opponentProfile, setOpponentProfile] = useState<{ username: string; rating: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    createSupabaseBrowserClient().from("profiles").select("username, rating").eq("id", userId).single()
      .then(({ data }) => { if (data) setMyProfile({ username: data.username, rating: Math.round(data.rating) }); });
  }, [userId]);

  useEffect(() => {
    const oppId = userId === gameState.whitePlayerId ? gameState.blackPlayerId : gameState.whitePlayerId;
    if (!oppId) { setOpponentProfile(null); return; }
    createSupabaseBrowserClient().from("profiles").select("username, rating").eq("id", oppId).single()
      .then(({ data }) => { if (data) setOpponentProfile({ username: data.username, rating: Math.round(data.rating) }); });
  }, [gameState.whitePlayerId, gameState.blackPlayerId, userId]);

  // ── Clocks ───────────────────────────────────────────────────────────────────
  const parseTimeControl = useCallback((tc: string | null): number => {
    if (!tc) return 10 * 60 * 1000;
    const minMatch = tc.match(/^(\d+)min$/);    if (minMatch) return parseInt(minMatch[1]) * 60 * 1000;
    const incMatch = tc.match(/^(\d+)\|(\d+)$/); if (incMatch) return parseInt(incMatch[1]) * 60 * 1000;
    const secMatch = tc.match(/^(\d+)s$/);       if (secMatch) return parseInt(secMatch[1]) * 1000;
    const dayMatch = tc.match(/^(\d+)d$/);       if (dayMatch) return parseInt(dayMatch[1]) * 86400 * 1000;
    return 10 * 60 * 1000;
  }, []);

  const getIncrementMs = useCallback((tc: string | null): number => {
    if (!tc) return 0;
    const incMatch = tc.match(/^(\d+)\|(\d+)$/); if (incMatch) return parseInt(incMatch[2]) * 1000;
    return 0;
  }, []);

  const [myClock, setMyClock] = useState(() => parseTimeControl(null));
  const [opponentClock, setOpponentClock] = useState(() => parseTimeControl(null));
  const clockInitialized = useRef(false);

  useEffect(() => {
    if (gameState.timeControl && !clockInitialized.current) {
      const ms = parseTimeControl(gameState.timeControl);
      setMyClock(ms);
      setOpponentClock(ms);
      clockInitialized.current = true;
    }
  }, [gameState.timeControl, parseTimeControl]);

  const isMyTurnFn = () => {
    if (!matchId) return true;
    if (gameState.status !== "in_progress") return false;
    if (game.turn() === 'w' && userId !== gameState.whitePlayerId) return false;
    if (game.turn() === 'b' && userId !== gameState.blackPlayerId) return false;
    return true;
  };

  const formatClock = (ms: number) => {
    if (ms <= 0) return "0:00";
    if (ms < 20000) {
      return (ms / 1000).toFixed(1) + "s";
    }
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds >= 3600) {
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      return `${h}:${m.toString().padStart(2, "0")}:00`;
    }
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ── Sound System ─────────────────────────────────────────────────────────────
  const audioPoolRef = useRef<Record<string, HTMLAudioElement[]>>({});
  const nextAudioRef = useRef<Record<string, number>>({});

  const playSound = useCallback((name: string) => {
    if (!soundEnabled) return;
    if (typeof Audio === "undefined") return;
    if (!audioPoolRef.current[name]) {
      audioPoolRef.current[name] = Array.from({ length: 3 }, () => {
        const a = new Audio(`/sounds/${name}.mp3`); a.preload = "auto"; return a;
      });
      nextAudioRef.current[name] = 0;
    }
    const pool = audioPoolRef.current[name];
    const idx = nextAudioRef.current[name] ?? 0;
    pool[idx].currentTime = 0;
    pool[idx].volume = 0.8;
    pool[idx].play().catch(() => {});
    nextAudioRef.current[name] = (idx + 1) % pool.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled]);

  // ── Arrow / Highlight Drawing (right-click) ───────────────────────────────
  const [arrows, setArrows] = useState<{ from: Square; to: Square; color?: string }[]>([]);
  const [highlightedSquares, setHighlightedSquares] = useState<Square[]>([]);
  const rightClickStartRef = useRef<Square | null>(null);

  const handleBoardMouseDown = (e: React.MouseEvent, square: Square) => {
    if (e.button === 2) { e.preventDefault(); rightClickStartRef.current = square; }
  };
  const handleBoardMouseUp = (e: React.MouseEvent, square: Square) => {
    if (e.button !== 2) return;
    e.preventDefault();
    const from = rightClickStartRef.current;
    rightClickStartRef.current = null;
    if (!from) return;
    if (from === square) {
      setHighlightedSquares(prev => prev.includes(square) ? prev.filter(s => s !== square) : [...prev, square]);
    } else {
      setArrows(prev => {
        const exists = prev.find(a => a.from === from && a.to === square);
        return exists ? prev.filter(a => !(a.from === from && a.to === square)) : [...prev, { from, to: square }];
      });
    }
  };

  // ── Chat State ────────────────────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const isAmIWhite = userId === gameState.whitePlayerId;
  const chatStatus = gameState.chatStatus;
  const iChatRequested = chatStatus === "pending_white" && isAmIWhite || chatStatus === "pending_black" && !isAmIWhite;
  const opponentChatRequested = chatStatus === "pending_white" && !isAmIWhite || chatStatus === "pending_black" && isAmIWhite;
  const chatEnabled = chatStatus === "enabled";

  const renderMove = (san: string, isWhite: boolean) => {
    if (!san) return null;
    const pieceMatch = san.match(/^[NBRQK]/);
    const pieceLetter = pieceMatch ? pieceMatch[0] : null;
    const rest = pieceMatch ? san.slice(1) : san;
    
    // Generate a visually plausible fake time for demonstration
    let hash = 0;
    for (let i = 0; i < san.length; i++) hash = san.charCodeAt(i) + ((hash << 5) - hash);
    const timeNum = 0.5 + (Math.abs(hash) % 75) / 10;
    const fakeTime = timeNum.toFixed(1);
    const barWidth = Math.max(8, Math.min(24, (timeNum / 5) * 24)); // Bar scales with time, up to 24px

    return (
      <div className="flex items-center w-full">
        {pieceLetter && (
          <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0 -ml-0.5 mr-0.5 opacity-80">
            {getPieceIcon(isWhite ? pieceLetter : pieceLetter.toLowerCase(), pieceTheme)}
          </div>
        )}
        <span className={pieceLetter ? "mt-[2px]" : ""}>{rest}</span>
        <div className="ml-auto flex items-center gap-1.5 opacity-60">
          <div className={`h-1.5 ${isWhite ? 'bg-[var(--text-primary)]' : 'bg-[var(--text-muted)]'} rounded-[1px]`} style={{ width: `${barWidth}px` }} />
          <span className="text-[10px] text-[var(--text-muted)] font-mono">{fakeTime}s</span>
        </div>
      </div>
    );
  };

  const handleRequestChat = async () => {
    if (!matchId || !userId) return;
    const newStatus = isAmIWhite ? "pending_white" : "pending_black";
    await setChatStatus(matchId, newStatus as any);
  };

  const handleAcceptChat = async () => {
    if (!matchId) return;
    await setChatStatus(matchId, "enabled");
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || !userId || !chatEnabled) return;
    sendChatMessage(chatInput.trim(), userId);
    setChatInput("");
  };


  // Auto-join invite matches if we're not the creator
  useEffect(() => {
    if (matchId && gameState.status === "invite_only" && userId && gameState.whitePlayerId !== userId && gameState.blackPlayerId !== userId) {
      joinFriendMatch(matchId).catch(console.error);
    }
  }, [matchId, gameState.status, userId, gameState.whitePlayerId, gameState.blackPlayerId]);

  // Board State
  const [game, setGame] = useState(new Chess());
    
  useEffect(() => {
    if (gameState.status !== 'in_progress') return;
    let lastTime = performance.now();
    
    const interval = setInterval(() => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;
      
      if (isMyTurnFn()) setMyClock(prev => Math.max(0, prev - delta));
      else setOpponentClock(prev => Math.max(0, prev - delta));
    }, 100);
    return () => clearInterval(interval);
  }, [gameState.status]);

  const [boardState, setBoardState] = useState<(string | null)[][]>(() => {
    const g = new Chess();
    return g.board().map(row => row.map(p => p ? `${p.color}${p.type}` : null));
  });

  // Sync network state to local board + play opponent move sound
  useEffect(() => {
    if (gameState.pgn && gameState.pgn !== game.pgn()) {
      // Add increment if opponent made a move.
      if (game.history().length > 0) {
        setOpponentClock(prev => prev + getIncrementMs(gameState.timeControl));
      }
      
      const newGame = new Chess();
      newGame.loadPgn(gameState.pgn);
      setGame(newGame);

      // Update the visual board state
      setBoardState(newGame.board().map(row => row.map(p => p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : null)));

      // Show last move highlight
      const history = newGame.history({ verbose: true });
      if (history.length > 0) {
        const lastMove = history[history.length - 1];
        setDisplayLastMove({ from: lastMove.from, to: lastMove.to });
      }

      // Play appropriate sound for opponent's move
      if (newGame.isGameOver()) {
        playSound("game-end");
        setTimeout(() => {
          if (newGame.isCheckmate()) {
            const epicAch = ACHIEVEMENTS.find(a => a.title === "The Immortal King") || ACHIEVEMENTS[0];
            showAchievement(epicAch);
          }
        }, 1000);
      } else if (newGame.inCheck()) {
        playSound("move-check");
      } else if (history.length > 0 && history[history.length - 1].captured) {
        playSound("capture");
      } else {
        playSound("move-opponent");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.pgn]);
  
  const [isBoardFlipped, setIsBoardFlipped] = useState(false);
  
  // Auto-flip for black player
  useEffect(() => {
    if (userId && gameState.blackPlayerId === userId) {
      setIsBoardFlipped(true);
    } else {
      setIsBoardFlipped(false);
    }
  }, [userId, gameState.blackPlayerId]);

  // When matchId is present, we must ensure we show the match UI
  useEffect(() => {
    if (matchId) {
      setActiveTab("new_game");
      setIsSearching(false);
      setRematchSent(false);
    } else {
      // Reset game state when returning to lobby
      setIsInGame(false);
      setGame(new Chess());
      setBoardState(new Chess().board().map(row => row.map(p => p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : null)));
      setDisplayLastMove(null);
      setSelectedSquare(null);
      setLegalTargets([]);
      setDrawOfferSent(false);
      setShowResignConfirm(false);
      clockInitialized.current = false;
      setRematchSent(false);
      toastShownRef.current = false;
    }
  }, [matchId, searchParams]);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [draggedSquare, setDraggedSquare] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [displayLastMove, setDisplayLastMove] = useState<{from: string, to: string} | null>(null);

  // In-game transition state
  const [isInGame, setIsInGame] = useState(false);
  const [inGameTab, setInGameTab] = useState<"moves" | "chat" | "info">("moves");
  const [unreadChat, setUnreadChat] = useState(false);

  // Track whether this is a friend invite match (invite_only → in_progress)
  // Detected via URL param (set by acceptor) or by seeing invite_only status (set by inviter)
  const [isFriendInvite, setIsFriendInvite] = useState(isFriendInviteParam);

  useEffect(() => {
    if (gameState.status === "invite_only") {
      setIsFriendInvite(true); // inviter side: they created the match
    }
  }, [gameState.status]);

  // Transition to in-game: immediate for friend invites, 1.5s delay for matchups
  useEffect(() => {
    if (gameState.status === "in_progress" && !isInGame) {
      if (isFriendInvite) {
        setIsInGame(true); // instant — no connection screen needed
      } else {
        const timer = setTimeout(() => setIsInGame(true), 1500);
        return () => clearTimeout(timer);
      }
    } else if (gameState.status === "waiting" || gameState.status === "invite_only") {
      setIsInGame(false); // Reset to lobby when waiting for opponent
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.status, isFriendInvite]);


  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"boards" | "pieces">("boards");
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [ignoreDrawOffers, setIgnoreDrawOffers] = useState(false);
  const [drawOfferSent, setDrawOfferSent] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsModalTab, setActiveSettingsModalTab] = useState("board");

  // ── Online Game Preferences ────────────────────────────────────────────────
  const [clientPreferences, setClientPreferences] = useState(DEFAULT_CLIENT_PREFERENCES);

  useEffect(() => {
    setClientPreferences(loadClientPreferences());
  }, []);

  const onlinePreferences = clientPreferences.online;

  const updateOnlinePreferences = (updates: Partial<typeof onlinePreferences>) => {
    setClientPreferences((previous) => {
      const next = { ...previous, online: { ...previous.online, ...updates } };
      saveClientPreferences(next);
      return next;
    });
  };

  // ── Abandon Timer ────────────────────────────────────────────────────────────
  const [abandonTimer, setAbandonTimer] = useState<number | null>(null);

  useEffect(() => {
    if (gameState.status !== 'in_progress') { setAbandonTimer(null); return; }
    if (gameState.opponentOnline) { setAbandonTimer(null); return; }
    // Start 60-second countdown when opponent disconnects during a live game
    setAbandonTimer(60);
    const interval = setInterval(() => {
      setAbandonTimer(prev => {
        if (prev === null || prev <= 0) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState.opponentOnline, gameState.status]);

  // ── Elo Toast ─────────────────────────────────────────────────────────────────
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (gameState.status === 'finished' && myProfile && userId && !toastShownRef.current) {
      toastShownRef.current = true;
      const timer = setTimeout(async () => {
        const { data } = await createSupabaseBrowserClient().from("profiles").select("rating").eq("id", userId).single();
        if (data) {
          const newRating = Math.round(data.rating);
          const diff = newRating - myProfile.rating;
          if (diff !== 0) {
            import("sonner").then(({ toast }) => {
              toast.success(`Rating Update: ${newRating} (${diff > 0 ? '+' : ''}${diff})`, {
                icon: '📈',
                duration: 5000,
              });
            });
            setMyProfile(prev => prev ? { ...prev, rating: newRating } : prev);
          }
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gameState.status, myProfile, userId]);

  // ── Game Over Reason ──────────────────────────────────────────────────────────
  const getGameOverReasonLabel = () => {
    if (gameState.status === 'abandoned') return 'by Abandonment';
    if (game.isCheckmate()) return 'by Checkmate';
    if (game.isStalemate()) return 'by Stalemate';
    if (game.isThreefoldRepetition()) return 'by Repetition';
    if (game.isInsufficientMaterial()) return 'by Insufficient Material';
    if (game.isDraw()) return 'by Draw';
    if (gameState.status === 'finished' && gameState.winnerId) return 'by Resignation';
    if (gameState.status === 'finished' && !gameState.winnerId) return 'by Agreement';
    return '';
  };
  
  const [activeTab, setActiveTab] = useState<"new_game" | "games" | "players">(
    (searchParams.get("tab") as any) || "new_game"
  );

  useEffect(() => {
    if (matchId) {
      setActiveTab("new_game");
    } else {
      const tab = searchParams.get("tab");
      if (tab === "players" || tab === "games" || tab === "new_game") {
        setActiveTab(tab as any);
      }
    }
  }, [matchId, searchParams]);
  const [selectedTimeControl, setSelectedTimeControl] = useState("10min");
  const [showMoreControls, setShowMoreControls] = useState(false);
  const [isRated, setIsRated] = useState(true);

  // Variant Preview State
  const [previewVariant, setPreviewVariant] = useState<string | null>(null);
  const [previewBoardState, setPreviewBoardState] = useState<(string | null)[][] | null>(null);
  const [selectedVariant, setSelectedVariant] = useState("standard");
  const [customFen, setCustomFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [customEditorPiece, setCustomEditorPiece] = useState<string | "erase" | null>(null);

  useEffect(() => {
    if (previewVariant === null && selectedVariant === "standard") {
      setPreviewBoardState(null);
      return;
    }
    
    let variantToPreview = previewVariant || selectedVariant;
    if (variantToPreview === "custom") {
      try {
        const game = new Chess(customFen);
        setPreviewBoardState(game.board().map(r => r.map(p => p ? p.color === 'w' ? p.type.toUpperCase() : p.type : null)));
      } catch (e) {
        setPreviewBoardState(null);
      }
      return;
    }


    const parseFenToBoard = (fen: string): (string | null)[][] => {
      const [boardPart] = fen.split(" ");
      return boardPart.split("/").map(row => {
        const parsedRow: (string | null)[] = [];
        for (const char of row) {
          if (!isNaN(parseInt(char))) {
            for (let i = 0; i < parseInt(char); i++) parsedRow.push(null);
          } else {
            parsedRow.push(char);
          }
        }
        return parsedRow;
      });
    };

    let initialBoard: (string | null)[][];
    const FEN_SETUPS: Record<string, string> = {
      horde: "rnbqkbnr/pppppppp/8/1PP5/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP w kq - 0 1",
      racingKings: "8/8/8/8/8/8/krbnNBRK/qrbnNBRQ w - - 0 1",
      kingOfTheHill: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      crazyhouse: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "3check": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      atomic: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    };

    if (variantToPreview === "chess960") {
      const whiteBackRank = generateChess960BackRank();
      const blackBackRank = whiteBackRank.toLowerCase();
      initialBoard = Array(8).fill(null).map(() => Array(8).fill(null));
      for (let i = 0; i < 8; i++) initialBoard[0][i] = blackBackRank[i];
      for (let i = 0; i < 8; i++) initialBoard[1][i] = "p";
      for (let i = 0; i < 8; i++) initialBoard[6][i] = "P";
      for (let i = 0; i < 8; i++) initialBoard[7][i] = whiteBackRank[i];
    } else {
      initialBoard = parseFenToBoard(FEN_SETUPS[variantToPreview] || FEN_SETUPS.kingOfTheHill);
    }

    setPreviewBoardState(initialBoard);

    // Simple Walkthrough Animation Loop
    let moveIndex = 0;
    const interval = setInterval(() => {
      setPreviewBoardState(prev => {
        if (!prev) return prev;

        if (variantToPreview === "chess960") {
          const whiteBackRank = generateChess960BackRank();
          const blackBackRank = whiteBackRank.toLowerCase();
          const newBoard = Array(8).fill(null).map(() => Array(8).fill(null));
          for (let i = 0; i < 8; i++) newBoard[0][i] = blackBackRank[i];
          for (let i = 0; i < 8; i++) newBoard[1][i] = "p";
          for (let i = 0; i < 8; i++) newBoard[6][i] = "P";
          for (let i = 0; i < 8; i++) newBoard[7][i] = whiteBackRank[i];
          return newBoard;
        }

        const nextBoard = prev.map(row => [...row]);
        
        // Define accurate move sequences for visualization
        const moves: Record<string, {from: [number, number] | string, to: [number, number]}[]> = {
          horde: [
            {from: [4, 4], to: [3, 4]}, // e4-e5
            {from: [0, 1], to: [2, 2]}, // Nc6
            {from: [4, 3], to: [3, 3]}, // d4-d5
            {from: [2, 2], to: [3, 4]}  // Nxe5
          ],
          racingKings: [
            {from: [6, 7], to: [5, 6]}, // Kh2-g3
            {from: [6, 0], to: [5, 1]}, // Ka2-b3
            {from: [5, 6], to: [4, 5]}, // Kg3-f4
            {from: [5, 1], to: [4, 2]}  // Kb3-c4
          ],
          kingOfTheHill: [
            {from: [6, 4], to: [4, 4]}, // e4
            {from: [1, 4], to: [3, 4]}, // e5
            {from: [7, 4], to: [6, 4]}, // Ke2
            {from: [0, 4], to: [1, 4]}, // Ke7
            {from: [6, 4], to: [5, 3]}, // Kd3
            {from: [1, 4], to: [2, 3]}, // Kd6
            {from: [5, 3], to: [4, 3]}  // Kd4 (White reaches center!)
          ],
          crazyhouse: [
            {from: [6, 4], to: [4, 4]}, // e4
            {from: [1, 3], to: [3, 3]}, // d5
            {from: [4, 4], to: [3, 3]}, // exd5
            {from: "drop_p", to: [4, 4]} // P@e4
          ],
          "3check": [
            {from: [6, 4], to: [4, 4]}, // e4
            {from: [1, 4], to: [2, 4]}, // e6
            {from: [7, 5], to: [3, 1]}, // Bb5+ (1st)
            {from: [1, 2], to: [2, 2]}, // c6
            {from: [3, 1], to: [4, 2]}, // Ba4
            {from: [1, 3], to: [3, 3]}, // d5
            {from: [4, 2], to: [3, 1]}, // Bb5+ (2nd)
            {from: [0, 1], to: [2, 2]}, // Nc6
            {from: [3, 1], to: [2, 2]}  // Bxc6+ (3rd!)
          ],
          atomic: [
            {from: [6, 4], to: [4, 4]}, // e4
            {from: [1, 5], to: [2, 5]}, // f6
            {from: [7, 6], to: [5, 5]}, // Nf3
            {from: [1, 4], to: [2, 4]}, // e6
            {from: [5, 5], to: [3, 4]}, // Ne5
            {from: [0, 6], to: [1, 4]}, // Ne7
            {from: [3, 4], to: [1, 5]}  // Nxf7 (Boom!)
          ]
        };

        const sequence = moves[variantToPreview] || moves.kingOfTheHill;
        
        if (moveIndex >= sequence.length) {
          // Reset after sequence
          moveIndex = 0;
          return initialBoard;
        }

        const move = sequence[moveIndex];
        
        if (typeof move.from === "string") {
           // Handle Crazyhouse piece drops
           const [color, type] = move.from.replace("drop_", "").split("");
           nextBoard[move.to[0]][move.to[1]] = move.from.replace("drop_", "");
        } else {
           nextBoard[move.to[0]][move.to[1]] = nextBoard[move.from[0]][move.from[1]];
           nextBoard[move.from[0]][move.from[1]] = null;
        }

        // Atomic explosion simulation
        if (variantToPreview === "atomic" && moveIndex === sequence.length - 1) {
           const [r, c] = move.to;
           for (let dr = -1; dr <= 1; dr++) {
             for (let dc = -1; dc <= 1; dc++) {
               if (r+dr >= 0 && r+dr <= 7 && c+dc >= 0 && c+dc <= 7) {
                 nextBoard[r+dr][c+dc] = null;
               }
             }
           }
        }

        moveIndex++;
        return nextBoard;
      });
    }, variantToPreview === "chess960" ? 1500 : 1200);

    return () => clearInterval(interval);
  }, [previewVariant, selectedVariant, customFen]);

  const handleBoardThemeChange = (theme: string) => {
    setBoardTheme(theme);
  };

  const handlePieceThemeChange = (theme: string) => {
    setPieceTheme(theme);
  };

  const handleSoundEnabledChange = (enabled: boolean) => {
    setSoundEnabled(enabled);
  };

  const updateBoard = (g: Chess) => {
    setBoardState(g.board().map(row => row.map(p => p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : null)));
  };

  const makeMove = (sourceSquare: Square, targetSquare: Square, promotionPiece = 'q') => {
    try {
      const moves = game.moves({ verbose: true });
      const move = moves.find(m => m.from === sourceSquare && m.to === targetSquare);
      
      if (move) {
        // Auto-promote to Queen for simplicity
        const moveResult = game.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
        if (moveResult) {
          const inc = evaluateMoveAchievements(moveResult, userId === gameState.whitePlayerId);
          for (const [title, val] of Object.entries(inc)) {
            gamificationIncrementsRef.current[title] = (gamificationIncrementsRef.current[title] || 0) + val;
            const baseline = gamificationState[title];
            if (baseline && !baseline.unlocked) {
              const currentProgress = baseline.current + gamificationIncrementsRef.current[title];
              if (currentProgress === baseline.max) {
                 const achInfo = ACHIEVEMENTS.find(a => a.title === title);
                 if (achInfo) {
                   showAchievement(achInfo);
                   setGamificationState(prev => ({
                     ...prev,
                     [title]: { ...baseline, current: baseline.max, unlocked: true }
                   }));
                 }
              }
            }
          }

          updateBoard(game);
          setDisplayLastMove({ from: sourceSquare, to: targetSquare });
          setSelectedSquare(null);
          setLegalTargets([]);
          setArrows([]);
          setHighlightedSquares([]);
          // Play appropriate sound
          if (game.isGameOver()) {
            playSound("game-end");
            
            const endInc = evaluateGameEndAchievements(game, userId === gameState.whitePlayerId);
            for (const [title, val] of Object.entries(endInc)) {
              gamificationIncrementsRef.current[title] = (gamificationIncrementsRef.current[title] || 0) + val;
            }

            fetch('/api/gamification/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ increments: gamificationIncrementsRef.current })
            }).then(res => res.json()).then(data => {
               if (data.newUnlocks) {
                 data.newUnlocks.forEach((title: string, i: number) => {
                    const achInfo = ACHIEVEMENTS.find(a => a.title === title);
                    if (achInfo) {
                      setTimeout(() => showAchievement(achInfo), i * 1500);
                      setGamificationState(prev => ({
                        ...prev,
                        [title]: { current: achInfo.maxProgress || 1, max: achInfo.maxProgress || 1, unlocked: true }
                      }));
                    }
                 });
               }
            }).catch(err => console.error(err));
          } else if (game.inCheck()) {
            playSound("move-check");
          } else if (moveResult.captured) {
            playSound("capture");
          } else {
            playSound("move-self");
          }
          if (matchId) {
            const pgn = game.pgn();
            sendMove(pgn);
            const isGameOver = game.isGameOver();
            let winnerId = null;
            if (isGameOver && !game.isDraw()) {
              winnerId = game.turn() === 'b' ? gameState.whitePlayerId : gameState.blackPlayerId;
            }
            syncGameState(matchId, pgn, isGameOver ? 'finished' : 'in_progress', winnerId);
          }
        }
      }
    } catch (e) {
      // Invalid move
    }
  };


  const handleSquareClick = (square: Square) => {
    if (!isMyTurnFn()) return;
    setArrows([]);
    setHighlightedSquares([]);

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalTargets([]);
      return;
    }

    if (selectedSquare && legalTargets.includes(square)) {
      makeMove(selectedSquare, square);
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setLegalTargets(moves.map(m => m.to as Square));
    } else {
      setSelectedSquare(null);
      setLegalTargets([]);
    }
  };

  const handleDragStart = (e: React.DragEvent, square: Square) => {
    if (!isMyTurnFn()) {
      e.preventDefault();
      return;
    }
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setDraggedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setLegalTargets(moves.map(m => m.to as Square));
      
      const pieceImg = e.currentTarget.querySelector('img');
      if (pieceImg) {
        const size = pieceImg.getBoundingClientRect();
        e.dataTransfer.setDragImage(pieceImg, size.width / 2, size.height / 2);
      }
    } else {
      e.preventDefault();
    }
  };

  const handleDrop = (e: React.DragEvent, square: Square) => {
    if (draggedSquare) {
      if (legalTargets.includes(square)) {
        makeMove(draggedSquare, square);
      }
    }
    setDraggedSquare(null);
    setSelectedSquare(null);
    setLegalTargets([]);
  };

  useEffect(() => {
    if (chatMessages.length > 0 && inGameTab !== "chat") {
      setUnreadChat(true);
    }
  }, [chatMessages, inGameTab]);

  const movesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (inGameTab === "moves") {
      movesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [game.history().length, inGameTab]);

  return (
    <main className={`min-h-screen bg-[var(--bg)] transition-colors duration-700 font-sans flex flex-col items-center overflow-x-hidden ${isInGame ? 'overflow-hidden' : ''}`}>
      {!isInGame && <Navbar />}
      
      <div className={`flex-1 w-full max-w-[1536px] flex flex-col lg:flex-row items-stretch justify-center px-4 gap-6 lg:gap-12 transition-all duration-700 ${isInGame ? 'pt-4 pb-4 h-screen' : 'lg:items-start pt-24 pb-12'}`}>
        
        {/* Left Side: The Board */}
        <div className={`w-full lg:w-[60%] flex-1 flex flex-col items-center relative transition-all duration-700 ${isInGame ? 'justify-start lg:items-center' : 'justify-center lg:items-start lg:justify-end bg-[var(--bg-alt)] p-2 sm:p-4 lg:p-0 rounded-2xl border lg:border-none border-[var(--border)] lg:bg-transparent'}`}>
          <div className={`flex flex-col items-center justify-start w-full relative shrink-0 transition-all duration-700 ${isInGame ? 'max-w-[100%] sm:max-w-[90%] lg:max-w-[min(720px,calc(100vh-100px))] lg:mx-auto lg:mt-0' : 'max-w-[100%] sm:max-w-[95%] lg:max-w-[70%] lg:min-w-[500px] lg:ml-auto lg:mr-16 lg:mt-12 h-[75vh] max-h-[640px]'}`}>
            
            <div className="w-full lg:w-auto flex justify-end lg:absolute lg:-top-2 lg:-right-[52px] flex-row lg:flex-col gap-2 sm:gap-3 z-50 mb-2 lg:mb-0 px-1 lg:px-0 items-center">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsBoardFlipped((current) => !current)}
                className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center flex-col gap-[2px]"
                title="Flip Board"
              >
                <ArrowLeft className="w-[14px] h-[14px] -ml-1" />
                <ArrowLeft className="w-[14px] h-[14px] -mr-1 rotate-180" />
              </button>
            </div>

            <div className={`w-full flex flex-col relative ${isInGame ? 'justify-start gap-0' : 'h-full justify-center gap-1.5'}`}>
              
              {/* Opponent Top Panel */}
              {isInGame && (
                <div className="w-full flex items-center justify-between bg-[var(--surface)] px-2.5 py-1.5 rounded-t-xl rounded-b-none border border-[var(--border)] border-b-0 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--skeleton)] border border-[var(--border)] flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-[var(--text-secondary)]" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[13px] text-[var(--text-primary)] tracking-wide">
                          {opponentProfile?.username ?? "Opponent"}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] font-semibold">{opponentProfile ? `(${opponentProfile.rating})` : ""}</span>
                        <SignalHigh className="w-3.5 h-3.5 text-green-500" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-0.5 border rounded-lg font-mono font-bold text-[14px] shadow-inner w-[72px] text-center transition-colors ${
                      !isMyTurnFn() && gameState.status === "in_progress"
                        ? "bg-[var(--text-primary)] text-[var(--bg)] border-[var(--text-primary)]"
                        : "bg-[var(--bg-alt)] text-[var(--text-primary)] border-[var(--border-subtle)]"
                    }`}>
                      {formatClock(opponentClock)}
                    </div>
                  </div>
                </div>
              )}

              <div className="w-full aspect-square relative shrink-0">
                <BoardImage
                  src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`}
                  className="w-full h-full shadow-[0_15px_35px_rgba(0,0,0,0.15)] overflow-hidden border border-[var(--border)]"
                >
                  <div className="w-full h-full grid grid-cols-8 grid-rows-8 relative" onContextMenu={(e) => e.preventDefault()}>
                    {(gameState.status === 'finished' || gameState.status === 'abandoned') && (
                      <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-500">
                        <div className="bg-[var(--surface)]/96 border border-[var(--border)] shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-6 md:p-8 rounded-2xl flex flex-col items-center max-w-[85%] w-[340px] text-center transition-all duration-700 relative overflow-hidden">
                          <div className="w-16 h-16 rounded-full bg-[var(--surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center mb-4 text-[#eab308] shadow-inner relative z-10">
                            <Crown className="w-8 h-8 drop-shadow-md" strokeWidth={2.5} />
                          </div>
                          <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-wide mb-1 relative z-10">
                            {gameState.winnerId ? (gameState.winnerId === userId ? "You Won!" : "You Lost") : "Draw"}
                          </h2>
                          <p className="text-[14px] text-[var(--text-secondary)] font-medium mb-8 relative z-10">
                            {getGameOverReasonLabel()}
                          </p>

                          <div className="flex flex-col gap-3 w-full relative z-10">
                            <button
                              onClick={async () => {
                                if (rematchOfferReceived) {
                                  // Accept!
                                  await joinFriendMatch(rematchOfferReceived);
                                  router.push(`/play/online?matchId=${rematchOfferReceived}&invite=1`);
                                } else {
                                  if (rematchSent) return;
                                  setRematchSent(true);
                                  // Create friend match (private) so it's guaranteed to be the same opponent
                                  const res = await createFriendMatch(undefined, gameState.timeControl || undefined, gameState.variant || undefined);
                                  if (res.matchId) {
                                    await sendRematchOffer(res.matchId);
                                    router.push(`/play/online?matchId=${res.matchId}&invite=1`);
                                  }
                                }
                              }}
                              disabled={rematchSent && !rematchOfferReceived}
                              className={`pointer-events-auto w-full py-[14px] font-bold rounded-xl shadow-[0_12px_28px_rgba(0,0,0,0.28)] transition-all duration-300 relative overflow-hidden group border border-white/10 ${
                                rematchOfferReceived
                                  ? "bg-green-600 hover:bg-green-500 text-white"
                                  : "bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] text-[var(--cta-text)] hover:scale-[1.02]"
                              } ${rematchSent && !rematchOfferReceived ? "opacity-70 cursor-not-allowed hover:scale-100" : ""}`}
                            >
                              <span className="relative z-10 flex items-center justify-center gap-2 text-white">
                                <RotateCcw className="w-[18px] h-[18px]" strokeWidth={2.5} />
                                {rematchOfferReceived ? "Accept Rematch" : (rematchSent ? "Waiting for opponent..." : "Rematch")}
                              </span>
                            </button>
                            <button
                              className="pointer-events-auto w-full flex items-center justify-center gap-2 py-[12px] text-[14.5px] text-[var(--text-secondary)] font-bold hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors border border-transparent hover:border-[var(--border)]"
                            >
                              <LineChart className="w-4 h-4" />
                              Analyze
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {(isBoardFlipped
                      ? [...(previewBoardState || boardState)].reverse().map(r => [...r].reverse())
                      : (previewBoardState || boardState)
                    ).map((row, visRowIndex) =>
                      row.map((pieceCode, visColIndex) => {
                        const logicalRow = isBoardFlipped ? 7 - visRowIndex : visRowIndex;
                        const logicalCol = isBoardFlipped ? 7 - visColIndex : visColIndex;
                        const square = toSquare(logicalRow, logicalCol);
                        
                        const isLightSquare = (logicalRow + logicalCol) % 2 === 0;
                        const isSelectedSquare = selectedSquare === square;
                        const isLegalTarget = legalTargets.includes(square);
                        const isLastMoveSquare = displayLastMove?.from === square || displayLastMove?.to === square;
                        const isDraggedSquare = draggedSquare === square;

                        return (
                          <div
                            key={square}
                            onClick={() => {
                              if (selectedVariant === "custom" && !matchId && customEditorPiece) {
                                try {
                                  const g = new Chess(customFen);
                                  if (customEditorPiece === "erase") {
                                    g.remove(square);
                                  } else {
                                    g.put({ type: customEditorPiece.toLowerCase() as any, color: customEditorPiece === customEditorPiece.toUpperCase() ? 'w' : 'b' }, square);
                                  }
                                  setCustomFen(g.fen());
                                } catch (e) { console.error(e); }
                                return;
                              }
                              handleSquareClick(square);
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, square)}
                            className="relative flex items-center justify-center cursor-pointer"
                            onMouseDown={(e) => handleBoardMouseDown(e, square)}
                            onMouseUp={(e) => handleBoardMouseUp(e, square)}
                          >
                            {isLastMoveSquare && (
                              <div className="absolute inset-[4%] rounded-[4px] bg-amber-300/30" />
                            )}
                            {highlightedSquares.includes(square) && (
                              <div className="absolute inset-0 bg-red-400/40 z-[1]" />
                            )}
                            {isSelectedSquare && (
                              <div className="absolute inset-[6%] rounded-[4px] ring-[3px] ring-white/95 bg-white/12 z-[6] shadow-[0_0_14px_rgba(255,255,255,0.45)]" />
                            )}
                            {isLegalTarget && (
                              <div
                                className={
                                  pieceCode
                                    ? "absolute inset-[10%] rounded-full border-[6px] border-black/20 dark:border-white/40"
                                    : "absolute h-[25%] w-[25%] rounded-full bg-black/20 dark:bg-white/45 shadow-[0_0_10px_rgba(0,0,0,0.15)] dark:shadow-[0_0_10px_rgba(255,255,255,0.35)]"
                                }
                              />
                            )}

                            {visColIndex === 0 && (
                              <span className={`absolute top-0.5 left-1 text-[13px] font-[700] ${isLightSquare ? "text-[#b07b46]" : "text-[#e6ca9a]"} select-none`}>
                                {8 - logicalRow}
                              </span>
                            )}
                            {visRowIndex === 7 && (
                              <span className={`absolute bottom-0 right-1 text-[13px] font-[700] ${isLightSquare ? "text-[#b07b46]" : "text-[#e6ca9a]"} select-none`}>
                                {FILES[logicalCol]}
                              </span>
                            )}

                            <div
                              draggable={Boolean(pieceCode)}
                              onDragStart={(e) => handleDragStart(e, square)}
                              onDragEnd={() => setDraggedSquare(null)}
                              className={`relative z-10 h-full w-full p-[2.75%] ${isDraggedSquare ? "opacity-30" : "opacity-100"}`}
                            >
                              {getPieceIcon(pieceCode, pieceTheme)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </BoardImage>

                {/* Setup Tools Overlay (only for Custom Variant) */}
                {selectedVariant === "custom" && !matchId && (
                  <div className="absolute top-[calc(100%+16px)] left-0 w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col pointer-events-auto">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-alt)]">
                      <span className="text-[13px] font-bold text-[var(--text-primary)]">Setup Tools</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCustomEditorPiece((current) => current === "erase" ? null : "erase")}
                          className={`flex h-8 w-8 items-center justify-center rounded border transition-colors ${customEditorPiece === "erase" ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg)]" : "border-[var(--border-subtle)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"}`}
                          title="Erase squares"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")}
                          className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--surface-alt)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                          title="Reset to standard"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomFen("8/8/8/8/8/8/8/8 w - - 0 1")}
                          className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--surface-alt)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                          title="Clear board"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 p-2">
                      {["P", "N", "B", "R", "Q", "K", "p", "n", "b", "r", "q", "k"].map((pieceCode) => (
                        <button
                          key={pieceCode}
                          type="button"
                          onClick={() => setCustomEditorPiece((current) => current === pieceCode ? null : pieceCode)}
                          className={`aspect-square min-h-9 rounded border bg-[var(--surface-alt)] p-0.5 transition-colors hover:bg-[var(--surface-hover)] ${customEditorPiece === pieceCode ? "border-[var(--text-primary)] ring-1 ring-[var(--text-primary)]" : "border-[var(--border-subtle)]"}`}
                          title={`Place ${pieceCode}`}
                        >
                          {getPieceIcon(pieceCode, pieceTheme)}
                        </button>
                      ))}
                    </div>
                    <div className="p-2 border-t border-[var(--border-subtle)]">
                      <input
                        type="text"
                        value={customFen}
                        onChange={(e) => setCustomFen(e.target.value)}
                        placeholder="Paste FEN here"
                        className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-[var(--cta-bg)]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Player Bottom Panel */}
              {isInGame && (
                <div className="w-full flex items-center justify-between bg-[var(--surface)] px-2.5 py-1.5 rounded-b-xl rounded-t-none border border-[var(--border)] border-t-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-[var(--cta-bg)] to-[var(--cta-hover)] border border-[var(--border)] flex items-center justify-center shrink-0 shadow-inner">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[13px] text-[var(--text-primary)] tracking-wide">
                          {myProfile?.username ?? "You"}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] font-semibold">{myProfile ? `(${myProfile.rating})` : ""}</span>
                        <SignalHigh className="w-3.5 h-3.5 text-green-500" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-0.5 border rounded-lg font-mono font-bold text-[14px] shadow-inner w-[72px] text-center transition-colors ${
                      isMyTurnFn() && gameState.status === "in_progress"
                        ? "bg-[var(--text-primary)] text-[var(--bg)] border-[var(--text-primary)]"
                        : "bg-[var(--bg-alt)] text-[var(--text-primary)] border-[var(--border-subtle)]"
                    }`}>
                      {formatClock(myClock)}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Right Side: Panel */}
        <div className={`w-full bg-[var(--surface-alt)] lg:bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl flex flex-col shrink-0 transition-all duration-700 ${isInGame ? 'lg:w-[540px] mt-0 lg:h-[calc(100vh-100px)] lg:max-h-[720px] overflow-hidden' : 'lg:w-[650px] mt-4 lg:mt-0 overflow-hidden'}`}>
          
          {/* Header Tabs — lobby vs in-game */}
          <div className="flex border-b border-[var(--border)] bg-[var(--surface-alt)]">
            {!isInGame ? (
              <>
                <button 
                  onClick={() => setActiveTab("new_game")}
                  className={`flex-1 py-4 px-6 flex flex-col items-center justify-center transition-colors relative ${activeTab === "new_game" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                >
                  <div className="w-6 h-6 mb-1 rounded border-2 border-current flex items-center justify-center text-[14px] font-bold">+</div>
                  <span className="text-xs font-semibold">New Game</span>
                  {activeTab === "new_game" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[var(--text-primary)]"></div>}
                </button>
                <button 
                  onClick={() => setActiveTab("games")}
                  className={`flex-1 py-4 px-6 flex flex-col items-center justify-center transition-colors relative ${activeTab === "games" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                >
                  <LayoutGrid className="w-6 h-6 mb-1 opacity-80" />
                  <span className="text-xs font-semibold">Games</span>
                  {activeTab === "games" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[var(--text-primary)]"></div>}
                </button>
                <button 
                  onClick={() => setActiveTab("players")}
                  className={`flex-1 py-4 px-6 flex flex-col items-center justify-center transition-colors relative ${activeTab === "players" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                >
                  <Users className="w-6 h-6 mb-1 opacity-80" />
                  <span className="text-xs font-semibold">Players</span>
                  {activeTab === "players" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[var(--text-primary)]"></div>}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setInGameTab("moves")}
                  className={`flex-1 py-4 px-6 flex flex-col items-center justify-center transition-colors relative ${inGameTab === "moves" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                >
                  <LayoutGrid className="w-6 h-6 mb-1 opacity-80" />
                  <span className="text-xs font-semibold">Moves</span>
                  {inGameTab === "moves" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[var(--text-primary)]"></div>}
                </button>
                <button
                  onClick={() => setInGameTab("chat")}
                  className={`flex-1 py-3 px-2 flex flex-col items-center justify-center transition-colors relative ${inGameTab === "chat" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                >
                  <MessageSquare size={18} className="mb-1" />
                  <span className="text-xs font-semibold">Chat</span>
                  {unreadChat && inGameTab !== "chat" && (
                    <div className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                  {inGameTab === "chat" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[var(--text-primary)]"></div>}
                </button>
                <button
                  onClick={() => setInGameTab("info")}
                  className={`flex-1 py-4 px-6 flex flex-col items-center justify-center transition-colors relative ${inGameTab === "info" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                >
                  <Info className="w-6 h-6 mb-1 opacity-80" />
                  <span className="text-xs font-semibold">Info</span>
                  {inGameTab === "info" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[var(--text-primary)]"></div>}
                </button>
              </>
            )}
          </div>

          {/* Body Content */}
          <div className={`flex flex-col flex-1 min-h-0 bg-[var(--bg)] relative ${isInGame && inGameTab === "moves" ? 'p-0 overflow-hidden' : 'p-4 overflow-y-auto'}`}>
            {/* === IN-GAME PANELS === */}
            {isInGame && inGameTab === "moves" && (
              <div className="flex flex-col h-full">
                <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-alt)] flex justify-between items-center text-[12px] text-[var(--text-secondary)]">
                  <span className="truncate">{getOpening(game.pgn())}</span>
                  <Info className="w-4 h-4 opacity-50 shrink-0 ml-2" />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-[28px_1fr_1fr] gap-x-1.5 gap-y-0.5 p-2">
                    {game.history().reduce((result: string[][], move: string, index: number) => {
                      if (index % 2 === 0) result.push([move]);
                      else result[result.length - 1].push(move);
                      return result;
                    }, []).map((pair: string[], idx: number) => (
                      <React.Fragment key={idx}>
                        <div className="text-[var(--text-muted)] font-mono text-xs flex items-center justify-end pr-1 py-1 opacity-60">{idx + 1}.</div>
                        <div className="px-2 py-1 rounded-md font-bold text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors flex items-center">{renderMove(pair[0], true)}</div>
                        {pair[1] ? (
                          <div className="px-2 py-1 rounded-md font-bold text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors flex items-center">{renderMove(pair[1], false)}</div>
                        ) : <div />}
                      </React.Fragment>
                    ))}
                    {game.history().length === 0 && (
                      <div className="col-span-3 flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                        <LayoutGrid className="w-8 h-8 mb-3 opacity-30" />
                        <p className="text-sm font-semibold">No moves yet</p>
                      </div>
                    )}
                    <div ref={movesEndRef} />
                  </div>
                </div>
                {/* Game Controls */}
                <div className="border-t border-[var(--border)] bg-[var(--surface-alt)] p-3 flex flex-col gap-2 mt-auto shrink-0">
                  <div className="flex items-center justify-center gap-2">
                    <button className="p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] opacity-50 cursor-not-allowed"><SkipBack className="w-4 h-4" /></button>
                    <button className="p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] opacity-50 cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                    <button className="p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] opacity-50 cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
                    <button className="p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] opacity-50 cursor-not-allowed"><SkipForward className="w-4 h-4" /></button>
                  </div>
                  <div className="flex gap-2">
                    {gameState.status === 'in_progress' && (userId === gameState.whitePlayerId || userId === gameState.blackPlayerId) && (
                    <>
                      <button
                        onClick={() => {
                          if (drawOfferSent) return;
                          sendDrawOffer();
                          setDrawOfferSent(true);
                        }}
                        disabled={drawOfferSent}
                        className="flex flex-col items-center justify-center p-3 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors"
                      >
                        <Handshake size={20} className="mb-1" />
                        <span className="text-xs font-semibold">{drawOfferSent ? "Offer Sent" : "½ Draw"}</span>
                      </button>
                      <button
                        onClick={() => {
                          if (showResignConfirm) {
                            const opponentId = userId === gameState.whitePlayerId ? gameState.blackPlayerId : gameState.whitePlayerId;
                            syncGameState(matchId!, game.pgn(), 'finished', opponentId);
                            setShowResignConfirm(false);
                          } else {
                            setShowResignConfirm(true);
                            setTimeout(() => setShowResignConfirm(false), 3000);
                          }
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-colors ${
                          showResignConfirm 
                            ? "bg-red-500/20 text-red-500 border-red-500 hover:bg-red-500/30" 
                            : "bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-red-500 border-[var(--border)]"
                        }`}
                      >
                        <Flag size={20} className="mb-1" />
                        <span className="text-xs font-semibold">{showResignConfirm ? "Sure?" : "Resign"}</span>
                      </button>
                    </>
                  )}
                  </div>
                </div>
              </div>
            )}
            {isInGame && inGameTab === "chat" && (
              <div className="flex flex-col h-full">
                {/* Chat not yet unlocked */}
                {!chatEnabled && !opponentChatRequested && !iChatRequested && (
                  <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
                    <MessageSquare className="w-10 h-10 text-[var(--text-muted)] opacity-40" />
                    <p className="text-[var(--text-secondary)] text-sm">Chat is locked by default. Send a request to start chatting.</p>
                    <button
                      onClick={handleRequestChat}
                      className="px-5 py-2 bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] text-white rounded-xl font-bold text-sm transition-colors"
                    >Request Chat</button>
                  </div>
                )}
                {/* I requested, waiting */}
                {iChatRequested && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                    <MessageSquare className="w-10 h-10 text-[var(--cta-bg)] opacity-60" />
                    <p className="text-[var(--text-secondary)] text-sm">Chat request sent. Waiting for opponent to accept...</p>
                  </div>
                )}
                {/* Opponent requested, I need to accept */}
                {opponentChatRequested && (
                  <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
                    <MessageSquare className="w-10 h-10 text-[var(--cta-bg)]" />
                    <p className="text-[var(--text-primary)] font-semibold text-sm">Opponent wants to chat</p>
                    <div className="flex gap-3">
                      <button onClick={handleAcceptChat} className="px-5 py-2 bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] text-white rounded-xl font-bold text-sm transition-colors">Accept</button>
                      <button onClick={() => setChatStatus(matchId!, "disabled" as any)} className="px-5 py-2 bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl font-bold text-sm transition-colors">Decline</button>
                    </div>
                  </div>
                )}
                {/* Chat enabled — message list + input */}
                {chatEnabled && (
                  <>
                    <div className="flex-1 overflow-y-auto flex flex-col gap-2 px-3 py-3 min-h-0">
                      {chatMessages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
                          <MessageSquare className="w-8 h-8" />
                          <p className="text-xs">No messages yet</p>
                        </div>
                      )}
                      {chatMessages.map((msg: any, i: number) => {
                        const isMe = msg.senderId === userId;
                        return (
                          <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] px-3 py-1.5 rounded-2xl text-[13px] leading-snug ${
                              isMe
                                ? 'bg-[var(--cta-bg)] text-white rounded-br-sm'
                                : 'bg-[var(--surface-alt)] text-[var(--text-primary)] border border-[var(--border)] rounded-bl-sm'
                            }`}>
                              {msg.text}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="border-t border-[var(--border)] px-3 py-2 flex gap-2">
                      <input
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                        placeholder="Type a message…"
                        className="flex-1 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--cta-bg)] transition-colors"
                      />
                      <button
                        onClick={handleSendChat}
                        disabled={!chatInput.trim()}
                        className="px-3 py-1.5 bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] disabled:opacity-40 text-white rounded-xl text-[13px] font-bold transition-colors"
                      >Send</button>
                    </div>
                  </>
                )}
              </div>
            )}
            {isInGame && inGameTab === "info" && (
              <div className="flex flex-col gap-4 p-2">
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                  <h3 className="font-bold text-[var(--text-primary)] mb-3 text-sm">Match Info</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-[var(--text-secondary)]"><span>Variant</span><span className="font-bold text-[var(--text-primary)] capitalize">{gameState.variant ?? selectedVariant}</span></div>
                    <div className="flex justify-between text-[var(--text-secondary)]"><span>Time Control</span><span className="font-bold text-[var(--text-primary)]">{gameState.timeControl ?? selectedTimeControl}</span></div>
                    <div className="flex justify-between text-[var(--text-secondary)]"><span>Rated</span><span className="font-bold text-[var(--text-primary)]">{isRated ? 'Yes' : 'No'}</span></div>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/play/online')}
                  className="w-full py-3 bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl font-bold text-sm text-[var(--text-primary)] transition-colors"
                >Leave Match</button>
              </div>
            )}
            {/* === LOBBY PANELS === */}
            {!isInGame && activeTab === "games" && (
              <div className="flex-1 bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 mb-4 h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
                <GamesHistory userId={userId} />
              </div>
            )}
            
            {!isInGame && activeTab === "new_game" && (
              <div className="flex flex-col lg:flex-row h-full gap-4">
                
                {/* Left Column: Match Info OR Time Controls & Play */}
                <div className="flex flex-col flex-1 lg:w-[400px]">
                  {matchId ? (
                    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 mb-4 flex flex-col items-center justify-center flex-1">
                      <div className="w-16 h-16 rounded-full bg-[var(--cta-bg)] flex items-center justify-center mb-4">
                        <Handshake className="w-8 h-8 text-white" />
                      </div>
                      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                        {gameState.status === 'invite_only' ? 'Invite a Friend' : 'Match Found!'}
                      </h2>

                      {gameState.status === 'in_progress' && (
                        <div className="flex flex-col items-center justify-center w-full mb-6 gap-3">
                          <p className="text-lg font-bold text-[var(--text-primary)] text-center">
                            The game has started. Good luck!
                          </p>
                          <div className="flex w-full gap-3 mt-2">
                            <button 
                              onClick={() => {
                                if (drawOfferSent) return;
                                sendDrawOffer();
                                setDrawOfferSent(true);
                              }}
                              className="flex-1 py-3 bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl font-bold text-[var(--text-primary)] transition-colors disabled:opacity-50"
                              disabled={drawOfferSent}>
                              {drawOfferSent ? "Draw Offered" : "½ Draw"}
                            </button>
                            <button 
                              onClick={() => {
                                if (matchId) {
                                  const opponentId = userId === gameState.whitePlayerId ? gameState.blackPlayerId : gameState.whitePlayerId;
                                  syncGameState(matchId, game.pgn(), 'finished', opponentId);
                                }
                              }}
                              className="flex-1 py-3 bg-[var(--error-bg)] hover:bg-[#ff5555] border border-[var(--error-border)] rounded-xl font-bold text-white transition-colors">
                              Resign
                            </button>
                          </div>
                        </div>
                      )}

                      {gameState.status === 'waiting' && (
                        <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
                          Waiting for opponent to join...
                        </p>
                      )}
                      
                      <div className="w-full flex items-center justify-between p-4 bg-[var(--surface-alt)] rounded-lg border border-[var(--border)]">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${gameState.opponentOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {gameState.status === 'invite_only' || gameState.status === 'waiting' 
                              ? 'Waiting for connection...' 
                              : (gameState.opponentOnline ? 'Opponent Connected' : `Opponent Disconnected${abandonTimer !== null ? ` (${abandonTimer}s)` : ''}`)}
                          </span>
                        </div>
                        {abandonTimer === 0 && gameState.status === 'in_progress' && (
                          <button
                            onClick={() => {
                              if (matchId) syncGameState(matchId, game.pgn(), 'abandoned', userId);
                            }}
                            className="px-3 py-1 bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] text-white text-xs font-bold rounded transition-colors"
                          >
                            Claim Win
                          </button>
                        )}
                        </div>

                      <button 
                        onClick={() => router.push("/play/online")}
                        className="mt-6 text-[var(--text-muted)] hover:text-[var(--text-primary)] font-semibold text-sm transition-colors"
                      >
                        Leave Match
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Time Controls Selector container */}
                  <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 mb-4">
                    
                    {/* Rated Toggle */}
                    <div className="flex flex-col mb-6">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-primary)] font-bold text-lg">Rated</span>
                        <button 
                          onClick={() => setIsRated(!isRated)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isRated ? 'bg-[var(--cta-bg)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${isRated ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      {/* Rating Range Selection */}
                      {isRated && (
                        <div className="mt-4 flex flex-col transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)] mb-2">Rating Range</span>
                          <div className="flex items-center space-x-3">
                            <div className="relative flex-1">
                              <select className="w-full bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg px-3 py-2.5 outline-none appearance-none font-bold text-sm cursor-pointer transition-colors">
                                <option value="any">Any</option>
                                <option value="-25">-25</option>
                                <option value="-50">-50</option>
                                <option value="-100">-100</option>
                                <option value="-200">-200</option>
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                            </div>
                            
                            <span className="text-[15px] font-[900] text-[var(--cta-bg)] px-1">557</span>
                            
                            <div className="relative flex-1">
                              <select className="w-full bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg px-3 py-2.5 outline-none appearance-none font-bold text-sm cursor-pointer transition-colors">
                                <option value="any">Any</option>
                                <option value="+25">+25</option>
                                <option value="+50">+50</option>
                                <option value="+100">+100</option>
                                <option value="+200">+200</option>
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Categories */}
                    <div className="space-y-6">
                      {TIME_CONTROLS.map((category) => {
                        const Icon = category.icon;
                        const visibleItems = category.items.filter(item => showMoreControls || !item.expandedOnly);
                        
                        return (
                          <div key={category.category} className="flex flex-col">
                            <div className="flex items-center space-x-2 mb-3">
                              <Icon className={`w-4 h-4 ${category.iconColor}`} />
                              <span className="text-[var(--text-primary)] font-bold text-sm tracking-wide">{category.category}</span>
                              {category.hasInfo && <Info className="w-4 h-4 text-[var(--text-muted)] ml-1" />}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {visibleItems.map(item => (
                                <button
                                  key={item.id}
                                  onClick={() => setSelectedTimeControl(item.id)}
                                  className={`py-3 px-1 rounded-lg text-sm font-semibold transition-all border ${
                                    selectedTimeControl === item.id 
                                      ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] border-[var(--cta-bg)] shadow-[0_0_0_1px_var(--cta-bg)]' 
                                      : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* More Time Controls Toggle */}
                    <div className="mt-5 pt-4 flex justify-center">
                      <button 
                        onClick={() => setShowMoreControls(!showMoreControls)}
                        className="flex items-center space-x-1 text-[13px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <span>{showMoreControls ? "Less Time Controls" : "More Time Controls"}</span>
                        {showMoreControls ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Primary Action */}
                  <button 
                    onClick={async () => {
                      if (!userId) return router.push("/login");
                      try {
                        setIsSearching(true);
                        const result = await findOrCreateMatch();
                        if (result.error === "needs_onboarding") {
                          router.push("/onboarding");
                        } else if (result.matchId) {
                          router.push(`/play/online?matchId=${result.matchId}`);
                        }
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsSearching(false);
                      }
                    }}
                    disabled={isSearching || !!matchId}
                    className={`w-full text-white text-[28px] font-[900] py-4 rounded-xl transition-all tracking-wide ${isSearching || matchId ? 'bg-gray-500 cursor-not-allowed opacity-70' : 'bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] shadow-[0_6px_0_var(--cta-shadow)] active:translate-y-[6px] active:shadow-none'}`}
                  >
                    {isSearching ? "Searching..." : matchId ? "In Game" : "Play"}
                  </button>

                  {/* Secondary Actions */}
                  <div className="flex flex-col space-y-3 mt-6">
                    <button 
                      onClick={() => setActiveTab("players")}
                      disabled={!!matchId}
                      className="w-full bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl py-4 flex items-center justify-center space-x-3 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Handshake className="w-5 h-5 text-[#D4A373] dark:text-[#E6B981]" />
                      <span className="text-lg font-bold text-[var(--text-primary)]">Play a Friend</span>
                    </button>
                    
                    <Link href="/play/computer" className="w-full bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl py-4 flex items-center justify-center space-x-3 transition-colors shadow-sm">
                      <Bot className="w-5 h-5 text-[var(--text-muted)]" />
                      <span className="text-lg font-bold text-[var(--text-primary)]">Play Bots</span>
                    </Link>
                  </div>
                    </>
                  )}
                </div>

                {/* Right Column: Custom Challenges */}
                {!matchId && (
                  <div className="flex flex-col lg:w-[280px]">
                  <div className="flex flex-col bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl shadow-sm z-10 h-full">
                    <div className="w-full py-4 flex items-center justify-center gap-2 border-b border-[var(--border)] px-4">
                      <Settings className="w-5 h-5 text-[var(--text-muted)]" />
                      <span className="text-lg font-bold text-[var(--text-primary)]">Custom Challenge</span>
                    </div>
                    
                    <div className="p-2 flex flex-col gap-1 bg-[var(--surface)] rounded-b-xl flex-1">
                      <div className="w-full">
                        <button 
                          onClick={() => setSelectedVariant("standard")}
                          className={`w-full text-left px-4 py-3 rounded-lg hover:bg-[var(--surface-hover)] transition-colors flex items-center group ${selectedVariant === "standard" ? "bg-[var(--surface-hover)]" : ""}`}
                        >
                          <div 
                            className="w-5 h-5 mr-3 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity" 
                            style={{
                              WebkitMaskImage: `url('/custom games/standard.svg')`,
                              WebkitMaskSize: 'contain',
                              WebkitMaskRepeat: 'no-repeat',
                              WebkitMaskPosition: 'center',
                              backgroundColor: VARIANT_ICONS.standard.color
                            }}
                          />
                          <span className={`text-[15px] font-semibold transition-colors ${selectedVariant === "standard" ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"}`}>
                            Standard
                          </span>
                        </button>
                      </div>
                      
                      {VARIANTS.map(variant => {
                        const iconData = VARIANT_ICONS[variant.id] || VARIANT_ICONS.standard;
                        return (
                        <div 
                          key={variant.id}
                          className="w-full relative"
                          onMouseEnter={() => setPreviewVariant(variant.id)}
                          onMouseLeave={() => setPreviewVariant(null)}
                        >
                          <Tooltip content={variant.desc}>
                            <button 
                              onClick={() => setSelectedVariant(variant.id)}
                              className={`w-full text-left px-4 py-3 rounded-lg hover:bg-[var(--surface-hover)] transition-colors flex items-center group ${selectedVariant === variant.id ? "bg-[var(--surface-hover)]" : ""}`}
                            >
                              {iconData.Icon ? (
                                <iconData.Icon 
                                  className="w-5 h-5 mr-3 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity" 
                                  style={{ color: iconData.color }} 
                                />
                              ) : (
                                <div 
                                  className="w-5 h-5 mr-3 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity" 
                                  style={{
                                    WebkitMaskImage: `url('/custom games/${iconData.file}')`,
                                    WebkitMaskSize: 'contain',
                                    WebkitMaskRepeat: 'no-repeat',
                                    WebkitMaskPosition: 'center',
                                    backgroundColor: iconData.color
                                  }}
                                />
                              )}
                              <span className={`text-[15px] font-semibold transition-colors ${selectedVariant === variant.id || previewVariant === variant.id ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"}`}>
                                {variant.label}
                              </span>
                            </button>
                          </Tooltip>
                        </div>
                      )})}
                    </div>
                  </div>
                </div>
                )}

              </div>
            )}
            {!isInGame && activeTab === "players" && (
              <PlayersTab 
                currentUserId={userId} 
                onInviteFriend={async (friend) => {
                  try {
                    let initialPgn = "";
                    if (selectedVariant === "custom") {
                      initialPgn = `[Variant "From Position"]\n[FEN "${customFen}"]\n[SetUp "1"]\n\n`;
                    } else if (selectedVariant !== "standard") {
                      initialPgn = `[Variant "${selectedVariant}"]\n\n`;
                    }

                    // Create an invite-only match
                    const { createFriendMatch } = await import('@/app/actions/match');
                    const result = await createFriendMatch(initialPgn);
                    
                    // Broadcast the invite to the friend's personal channel
                    const supabase = createSupabaseBrowserClient();
                    
                    // Fetch current user's profile to send to friend
                    const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', userId).single();
                    
                    if (myProfile) {
                      const channel = supabase.channel(`invites:${friend.id}`);
                      channel.subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                          channel.send({
                            type: 'broadcast',
                            event: 'game_invite',
                            payload: {
                              inviterId: userId,
                              inviterUsername: myProfile.username,
                              inviterRating: Math.round(myProfile.rating),
                              matchId: result.matchId,
                              timeControl: "10 min" // Defaulting to Rapid for now, could be dynamic
                            }
                          });
                        }
                      });
                    }
                    
                    // Redirect myself to the match
                    router.push(`/play/online?matchId=${result.matchId}`);
                  } catch (err) {
                    console.error("Failed to invite friend", err);
                  }
                }} 
              />
            )}
          </div>
          
        </div>
      </div>

      {/* Settings Modal Component */}
      {isSettingsOpen && (
        <SettingsModalLayout
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          activeTabId={activeSettingsModalTab}
          onTabChange={setActiveSettingsModalTab}
          loading={false}
          error={null}
          tabs={[
            {
              id: "board",
              icon: <LayoutGrid className="w-[18px] h-[18px]" />,
              label: "Board & Pieces",
              title: "Board & Pieces",
              description: "Customize the look and feel of your chess set.",
              content: (
                <BoardPiecesSettingsTab
                  activeSettingsTab={activeSettingsTab}
                  setActiveSettingsTab={setActiveSettingsTab}
                  boardTheme={boardTheme}
                  pieceTheme={pieceTheme}
                  boardThemes={AVAILABLE_BOARD_THEMES}
                  pieceThemes={AVAILABLE_PIECE_THEMES}
                  boardAssets={BOARD_THEME_ASSETS}
                  pieceAssets={PIECE_THEME_ASSETS}
                  soundEnabled={soundEnabled}
                  onBoardThemeChange={handleBoardThemeChange}
                  onPieceThemeChange={handlePieceThemeChange}
                  onSoundEnabledChange={handleSoundEnabledChange}
                  onPreviewSound={() => {}}
                  boardPreviewNode={
                    <div className="w-full aspect-square relative shadow-xl rounded-sm overflow-hidden border border-[var(--border)]">
                      <BoardImage src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`} className="w-full h-full">
                        <div className="w-full h-full grid grid-cols-3 grid-rows-3 relative">
                          {Array.from({ length: 9 }).map((_, i) => {
                            const row = Math.floor(i / 3);
                            const col = i % 3;

                            let piece = null;
                            if (row === 0 && col === 0) piece = "bb";
                            if (row === 0 && col === 1) piece = "bq";
                            if (row === 0 && col === 2) piece = "bp";

                            if (row === 2 && col === 0) piece = "wn";
                            if (row === 2 && col === 1) piece = "wk";
                            if (row === 2 && col === 2) piece = "wr";

                            const isLightSquare = (row + col) % 2 === 0;

                            return (
                              <div key={i} className="flex items-center justify-center relative p-1 md:p-2">
                                {col === 0 && (
                                  <span className={`absolute top-1 left-1.5 text-[14px] font-bold ${isLightSquare ? "text-[#b07b46]" : "text-[#e6ca9a]"} select-none`}>
                                    {8 - row}
                                  </span>
                                )}
                                {piece && (
                                  <PieceImage
                                    src={`${PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`}/${piece}.png`}
                                    alt={piece}
                                    className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </BoardImage>
                    </div>
                  }
                />
              ),
            },
            {
              id: "game",
              icon: <Gamepad2 className="w-[18px] h-[18px]" />,
              label: "Game Settings",
              title: "Game Behavior",
              description: "Configure how the game reacts to your inputs.",
              content: (
                <div className="px-5 md:px-8 pb-5 md:pb-8 pt-2">
                  <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                      <span className="text-[14px] text-[var(--text-primary)]">Move Method</span>
                      <select
                        value={onlinePreferences.moveMethod}
                        onChange={(event) => updateOnlinePreferences({ moveMethod: event.target.value as typeof onlinePreferences.moveMethod })}
                        className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5"
                      >
                        <option value="drag">Drag only</option>
                        <option value="click">Click only</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                      <span className="text-[14px] text-[var(--text-primary)]">Show Legal Moves</span>
                      <input type="checkbox" checked={onlinePreferences.showLegalMoves} onChange={(event) => updateOnlinePreferences({ showLegalMoves: event.target.checked })} />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                      <span className="text-[14px] text-[var(--text-primary)]">Enable Premove</span>
                      <input type="checkbox" checked={onlinePreferences.premoveEnabled} onChange={(event) => updateOnlinePreferences({ premoveEnabled: event.target.checked })} />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                      <span className="text-[14px] text-[var(--text-primary)]">Premove Mode</span>
                      <select
                        value={onlinePreferences.premoveMode}
                        onChange={(event) => updateOnlinePreferences({ premoveMode: event.target.value as typeof onlinePreferences.premoveMode })}
                        className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] w-full md:w-auto md:min-w-[160px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]"
                      >
                        <option value="single">Single premove</option>
                        <option value="multiple">Multiple premoves</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                      <span className="text-[14px] text-[var(--text-primary)]">Auto Queen</span>
                      <input type="checkbox" checked={onlinePreferences.autoQueen} onChange={(event) => updateOnlinePreferences({ autoQueen: event.target.checked })} />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                      <span className="text-[14px] text-[var(--text-primary)]">Low Time Warning</span>
                      <input type="checkbox" checked={onlinePreferences.lowTimeWarning} onChange={(event) => updateOnlinePreferences({ lowTimeWarning: event.target.checked })} />
                    </div>
                  </div>
                </div>
              ),
            },
            {
              id: "audio",
              icon: <Volume2 className="w-[18px] h-[18px]" />,
              label: "Audio",
              title: "Sound Preferences",
              description: "Adjust volume and audio cues.",
              content: (
                <div className="flex flex-col gap-6 text-[var(--text-primary)] px-8 py-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Master Volume</label>
                      <span className="text-sm text-[var(--text-muted)] font-mono">{onlinePreferences.masterVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={onlinePreferences.masterVolume}
                      onChange={(e) => {
                        updateOnlinePreferences({ masterVolume: parseInt(e.target.value) });
                        if (typeof playSound === 'function') {
                          playSound('move-self');
                        }
                      }}
                      className="w-full accent-[var(--brand)]"
                    />
                  </div>
                </div>
              ),
            }
          ]}
        />
      )}

      {/* Draw Request Popup */}
      {drawOfferReceived && !ignoreDrawOffers && (
        <div className="fixed bottom-6 right-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl p-5 w-80 z-50 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[var(--cta-bg)]/20 text-[var(--cta-bg)] flex items-center justify-center">
              <Handshake size={20} />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text-primary)]">Draw Offer</h3>
              <p className="text-sm text-[var(--text-secondary)]">Opponent offered a draw</p>
            </div>
          </div>
          <div className="flex gap-2 mb-3">
            <button 
              onClick={async () => { await syncGameState(matchId!, game.pgn(), 'finished', null); setDrawOfferReceived(false); }} 
              className="flex-1 py-2 bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] text-white rounded-lg font-bold text-sm transition-colors"
            >
              Accept
            </button>
            <button 
              onClick={() => { declineDrawOffer(); }} 
              className="flex-1 py-2 bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] rounded-lg font-bold text-sm transition-colors"
            >
              Decline
            </button>
          </div>
          <button 
            onClick={() => { setIgnoreDrawOffers(true); declineDrawOffer(); }} 
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] w-full text-center transition-colors hover:underline"
          >
            Ignore future requests
          </button>
        </div>
      )}

    </main>
  );
}
