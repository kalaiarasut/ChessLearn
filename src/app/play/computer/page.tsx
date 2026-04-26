"use client";

import type { DragEvent, MouseEvent } from "react";
import Link from "next/link";
import { useEffect, useState, useRef, useMemo } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowLeft, Settings, Play, Pause, Bot, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp, MoreHorizontal, Monitor, User, Gamepad2, MessageSquare, GraduationCap, Bell, CreditCard, Accessibility, LayoutGrid, Users, Sun, Moon, Crosshair, Crown, Info } from "lucide-react";
import themeManifest from "@/data/themeManifest.json";
import { useTheme } from "@/lib/theme-context";
import { STOCKFISH_ELO_LIMITS, useStockfishPlayer, type PlayerEngineVariant, type PlayerStrengthMode, type PlayerTimeMode } from "./use-stockfish-player";
import { useStockfishAnalysis } from "../../learn/[opening]/use-stockfish-analysis";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEFAULT_CLIENT_PREFERENCES, loadClientPreferences, saveClientPreferences } from "@/lib/client-preferences";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const DEFAULT_FEN = new Chess().fen();
const AVAILABLE_BOARD_THEMES = themeManifest.boardThemes;
const AVAILABLE_PIECE_THEMES = themeManifest.pieceThemes;
const BOARD_THEME_ASSETS = themeManifest.boardAssets as Record<string, string>;
const PIECE_THEME_ASSETS = themeManifest.pieceAssets as Record<string, string>;

const ELOS = [1320, 1400, 1500, 1650, 1800, 2000, 2200, 2500, 2850, 3190];
const ELO_MIN = STOCKFISH_ELO_LIMITS["stockfish-18"].min;
const ELO_MAX = STOCKFISH_ELO_LIMITS["stockfish-18"].max;
const FULL_ENGINE_WASM_PATH = "/engines/stockfish/stockfish-18-single.wasm";
const BEGINNER_ESTIMATED_ELOS = [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300];
const BEGINNER_ELO_MIN = BEGINNER_ESTIMATED_ELOS[0];
const BEGINNER_ELO_MAX = BEGINNER_ESTIMATED_ELOS[BEGINNER_ESTIMATED_ELOS.length - 1];
const BOT_OPENING_MOVES = [
  { id: "engine", label: "Engine Choice", uci: null as string | null },
  { id: "e4", label: "King Pawn (e4)", uci: "e2e4" },
  { id: "d4", label: "Queen Pawn (d4)", uci: "d2d4" },
  { id: "c4", label: "English (c4)", uci: "c2c4" },
  { id: "nf3", label: "Reti (Nf3)", uci: "g1f3" },
  { id: "e5", label: "Open Game (e5)", uci: "e7e5" },
  { id: "c5", label: "Sicilian (c5)", uci: "c7c5" },
  { id: "e6", label: "French (e6)", uci: "e7e6" },
  { id: "d5", label: "Queen Pawn (d5)", uci: "d7d5" },
  { id: "nf6", label: "Indian (Nf6)", uci: "g8f6" },
] as const;
const MATERIAL_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
} as const;
const STARTING_PIECE_COUNTS = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
  k: 1,
} as const;
const CAPTURE_DISPLAY_ORDER = ["q", "r", "b", "n", "p"] as const;

type MaterialPieceType = Exclude<keyof typeof MATERIAL_VALUES, "k">;
type SideColor = "w" | "b";
type StrengthMode = PlayerStrengthMode | "beginner";
type EngineVariant = PlayerEngineVariant;
type TimeMode = PlayerTimeMode;

const toBeginnerEngineProfile = (estimatedElo: number) => {
  const clamped = Math.max(BEGINNER_ELO_MIN, Math.min(BEGINNER_ELO_MAX, Math.round(estimatedElo)));
  const span = BEGINNER_ELO_MAX - BEGINNER_ELO_MIN;
  const ratio = span > 0 ? (clamped - BEGINNER_ELO_MIN) / span : 0;

  return {
    skillLevel: Math.max(0, Math.min(7, Math.round(ratio * 7))),
    fixedMoveTimeMs: Math.max(50, Math.min(250, Math.round(50 + ratio * 200))),
  };
};

type SerializableMove = {
  from: Square;
  to: Square;
  san: string;
  isCheck: boolean;
  isCapture: boolean;
  isCastle: boolean;
  isPromotion: boolean;
};

const toSquare = (rowIndex: number, columnIndex: number) =>
  `${FILES[columnIndex]}${8 - rowIndex}` as Square;

const getPieceCode = (
  piece: {
    color: "w" | "b";
    type: "p" | "n" | "b" | "r" | "q" | "k";
  } | null,
) => {
  if (!piece) {
    return null;
  }
  return `${piece.color}${piece.type}`;
};

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
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
};

/* Settings-only thumbnail with skeleton shimmer */
const BoardThumbnail = ({ src, className }: { src: string; className?: string }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`relative ${className || ""}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-[#2a2a2a] animate-pulse rounded-lg" />
      )}
      <img
        src={src}
        alt="Board"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
};

const PieceThumbnail = ({ src, alt }: { src: string; alt: string }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {!loaded && (
        <div className="absolute inset-[20%] bg-[#3a3a3a] animate-pulse rounded-full" />
      )}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={`select-none pointer-events-none w-[85%] h-[85%] object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.6)] transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
};

const getPieceIcon = (code: string | null, pieceTheme: string) => {
  if (!code) return null;
  return (
    <PieceImage 
      src={`${PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`}/${code}.png`} 
      alt={code} 
    />
  );
};

const getPositionStatus = (game: Chess) => {
  const sideToMove = game.turn() === "w" ? "White" : "Black";
  if (game.isCheckmate()) return `${sideToMove} is checkmated.`;
  if (game.isStalemate()) return "Draw by stalemate.";
  if (game.isInsufficientMaterial()) return "Draw by insufficient material.";
  if (game.isThreefoldRepetition()) return "Draw by repetition.";
  if (game.isDraw()) return "Drawn position.";
  if (game.isCheck()) return `${sideToMove} to move and in check.`;
  return `${sideToMove} to move.`;
};

const getMaterialSnapshot = (game: Chess) => {
  const counts: Record<SideColor, Record<keyof typeof MATERIAL_VALUES, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };

  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      counts[piece.color][piece.type] += 1;
    }
  }

  const whiteMaterial =
    counts.w.p * MATERIAL_VALUES.p +
    counts.w.n * MATERIAL_VALUES.n +
    counts.w.b * MATERIAL_VALUES.b +
    counts.w.r * MATERIAL_VALUES.r +
    counts.w.q * MATERIAL_VALUES.q;

  const blackMaterial =
    counts.b.p * MATERIAL_VALUES.p +
    counts.b.n * MATERIAL_VALUES.n +
    counts.b.b * MATERIAL_VALUES.b +
    counts.b.r * MATERIAL_VALUES.r +
    counts.b.q * MATERIAL_VALUES.q;

  const materialDiff = whiteMaterial - blackMaterial;

  const buildCapturedTypes = (capturedFromColor: SideColor) => {
    const capturedTypes: MaterialPieceType[] = [];
    for (const type of CAPTURE_DISPLAY_ORDER) {
      const capturedCount = Math.max(0, STARTING_PIECE_COUNTS[type] - counts[capturedFromColor][type]);
      for (let index = 0; index < capturedCount; index += 1) {
        capturedTypes.push(type);
      }
    }
    return capturedTypes;
  };

  return {
    materialDiff,
    capturedByWhite: buildCapturedTypes("b"),
    capturedByBlack: buildCapturedTypes("w"),
  };
};

type PvDisplayMove = {
  key: string;
  label: string;
  fenAfter: string;
};

const buildPvDisplayMoves = (fen: string, pv: string[]) => {
  const game = new Chess(fen);
  const moves: PvDisplayMove[] = [];

  for (let index = 0; index < pv.length; index += 1) {
    const uci = pv[index];
    if (!/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(uci)) {
      break;
    }

    let playedMove: ReturnType<Chess["move"]> | null = null;
    try {
      playedMove = game.move({
        from: uci.slice(0, 2) as Square,
        to: uci.slice(2, 4) as Square,
        promotion: uci[4] as "q" | "r" | "b" | "n" | undefined,
      });
    } catch {
      break;
    }

    if (!playedMove) {
      break;
    }

    moves.push({
      key: `${index}-${uci}`,
      label: `${index + 1}. ${playedMove.san}`,
      fenAfter: game.fen(),
    });
  }

  return moves;
};

const InfoHint = ({ text }: { text: string }) => (
  <span className="relative inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer group transition-colors ml-1 align-bottom z-50">
    <Info className="w-3.5 h-3.5" />
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[min(260px,90vw)] px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-hover)] text-[var(--text-primary)] text-[12px] font-normal normal-case tracking-normal rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-center pointer-events-none before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-[5px] before:border-transparent before:border-t-[var(--border-hover)]">
      {text}
    </span>
  </span>
);

const MiniBoardPreview = ({
  fen,
  boardTheme,
  pieceTheme,
}: {
  fen: string;
  boardTheme: string;
  pieceTheme: string;
}) => {
  const game = new Chess(fen);
  const board = game.board().map((row) => row.map((piece) => getPieceCode(piece)));

  return (
    <div className="w-[170px] rounded-md border border-[#4a4a4d] bg-[#18181a] p-2 shadow-2xl">
      <div className="relative aspect-square overflow-hidden rounded-sm border border-[#2f2f32]">
        <img
          src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`}
          alt="Preview board"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
          {board.map((row, rowIndex) =>
            row.map((pieceCode, colIndex) => (
              <div key={`${rowIndex}-${colIndex}`} className="flex items-center justify-center p-[4%]">
                {pieceCode ? (
                  <img
                    src={`${PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`}/${pieceCode}.png`}
                    alt={pieceCode}
                    className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)]"
                  />
                ) : null}
              </div>
            )),
          )}
        </div>
      </div>
    </div>
  );
};

export default function PlayComputerPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Settings state
  const [boardTheme, setBoardTheme] = useState(themeManifest.defaultBoardTheme);
  const [pieceTheme, setPieceTheme] = useState(themeManifest.defaultPieceTheme);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"board" | "gameplay" | "engine" | "interface">("board");
  const [activeSettingsTab, setActiveSettingsTab] = useState<"boards" | "pieces">("boards");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [clientPreferences, setClientPreferences] = useState(DEFAULT_CLIENT_PREFERENCES);

  // Game state
  const [eloIndex, setEloIndex] = useState<number>(2);
  const [beginnerEloIndex, setBeginnerEloIndex] = useState<number>(5);
  const [strengthMode, setStrengthMode] = useState<StrengthMode>("skill");
  const [skillLevel, setSkillLevel] = useState<number>(20);
  const [botEngineVariant, setBotEngineVariant] = useState<EngineVariant>("stockfish-18");
  const [botTimeMode, setBotTimeMode] = useState<TimeMode>("clock");
  const [botFixedMoveTimeMs, setBotFixedMoveTimeMs] = useState<number>(1000);
  const elo = ELOS[Math.min(Math.max(eloIndex, 0), ELOS.length - 1)] ?? ELOS[0];
  const beginnerEstimatedElo = BEGINNER_ESTIMATED_ELOS[Math.min(Math.max(beginnerEloIndex, 0), BEGINNER_ESTIMATED_ELOS.length - 1)] ?? BEGINNER_ESTIMATED_ELOS[0];
  const [timeLimit, setTimeLimit] = useState<number>(10);
  const [playerColor, setPlayerColor] = useState<"w" | "b" | "bot-vs-bot">("w");
  const [gameState, setGameState] = useState<"setup" | "playing" | "game_over">("setup");
  const [fen, setFen] = useState(DEFAULT_FEN);
  const [history, setHistory] = useState<string[]>([DEFAULT_FEN]);
  const [sanHistory, setSanHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [isPlayingHistory, setIsPlayingHistory] = useState(false);
  const [isAnalysisMenuOpen, setIsAnalysisMenuOpen] = useState(false);
  const [showEvaluationBar, setShowEvaluationBar] = useState(true);
  const [showEngineLines, setShowEngineLines] = useState(true);
  const [showSuggestionArrow, setShowSuggestionArrow] = useState(false);
  const [showMoveFeedback, setShowMoveFeedback] = useState(false);
  const [analysisEngineVariant, setAnalysisEngineVariant] = useState<EngineVariant>("stockfish-18");
  const [analysisMaxTimeSeconds, setAnalysisMaxTimeSeconds] = useState(0);
  const [analysisMultiPv, setAnalysisMultiPv] = useState(3);
  const [analysisDepth, setAnalysisDepth] = useState(15);
  const [analysisThreads, setAnalysisThreads] = useState(1);
  const [fullEngineAvailable, setFullEngineAvailable] = useState(true);
  const [expandedEngineLineIds, setExpandedEngineLineIds] = useState<Record<number, boolean>>({});
  const [bot1EloIndex, setBot1EloIndex] = useState<number>(2);
  const [bot2EloIndex, setBot2EloIndex] = useState<number>(2);
  const [bot1OpeningId, setBot1OpeningId] = useState<string>("c5");
  const [bot2OpeningId, setBot2OpeningId] = useState<string>("e4");
  const [bot1OpeningUsed, setBot1OpeningUsed] = useState(false);
  const [bot2OpeningUsed, setBot2OpeningUsed] = useState(false);
  const [botMatchConfigOpen, setBotMatchConfigOpen] = useState(false);
  const [viewerName, setViewerName] = useState("Guest User");
  const [hoverPreview, setHoverPreview] = useState<{ fen: string; left: number; top: number } | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [draggedSquare, setDraggedSquare] = useState<Square | null>(null);
  const [dragOverSquare, setDragOverSquare] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<SerializableMove | null>(null);
  const [whiteTimeSeconds, setWhiteTimeSeconds] = useState(10 * 60);
  const [blackTimeSeconds, setBlackTimeSeconds] = useState(10 * 60);
  const [timeoutStatus, setTimeoutStatus] = useState<string | null>(null);
  const [warnedWhiteLowTime, setWarnedWhiteLowTime] = useState(false);
  const [warnedBlackLowTime, setWarnedBlackLowTime] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    fetch(FULL_ENGINE_WASM_PATH, {
      method: "HEAD",
      cache: "no-store",
      signal: abortController.signal,
    })
      .then((response) => {
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        const isLikelyHtml = contentType.includes("text/html");
        setFullEngineAvailable(response.ok && !isLikelyHtml);
      })
      .catch(() => {
        setFullEngineAvailable(false);
      });

    return () => {
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    if (!fullEngineAvailable) {
      setBotEngineVariant((current) => (current === "stockfish-18" ? "stockfish-18-lite" : current));
      setAnalysisEngineVariant((current) => (current === "stockfish-18" ? "stockfish-18-lite" : current));
    }
  }, [fullEngineAvailable]);

  const gameRef = useRef(new Chess(fen));
  const audioPoolRef = useRef<Record<string, HTMLAudioElement[]>>({});
  const nextAudioIndexRef = useRef<Record<string, number>>({});
  const isReviewing = currentMoveIndex !== history.length - 1;
  const isBotMatchMode = playerColor === "bot-vs-bot";
  const playerSide: SideColor = isBotMatchMode ? "w" : playerColor;
  const botSide: SideColor = playerSide === "w" ? "b" : "w";
  const bot1Elo = ELOS[Math.min(Math.max(bot1EloIndex, 0), ELOS.length - 1)] ?? ELOS[0];
  const bot2Elo = ELOS[Math.min(Math.max(bot2EloIndex, 0), ELOS.length - 1)] ?? ELOS[0];
  const beginnerEngineProfile = useMemo(
    () => toBeginnerEngineProfile(beginnerEstimatedElo),
    [beginnerEstimatedElo],
  );
  const activeStrengthMode: StrengthMode = isBotMatchMode ? "elo" : strengthMode;
  const engineStrengthMode: PlayerStrengthMode = activeStrengthMode === "elo" ? "elo" : "skill";
  const activeSkillLevel = isBotMatchMode
    ? 20
    : activeStrengthMode === "beginner"
      ? beginnerEngineProfile.skillLevel
      : skillLevel;
  const activeEngineElo = isBotMatchMode ? (gameRef.current.turn() === botSide ? bot1Elo : bot2Elo) : elo;
  const activeTimeMode: TimeMode = !isBotMatchMode && activeStrengthMode === "beginner" ? "fixed" : botTimeMode;
  const activeFixedMoveTimeMs = !isBotMatchMode && activeStrengthMode === "beginner"
    ? beginnerEngineProfile.fixedMoveTimeMs
    : botFixedMoveTimeMs;

  const isBotTurn =
    gameState === "playing" &&
    !isReviewing &&
    (isBotMatchMode || gameRef.current.turn() === botSide) &&
    !gameRef.current.isGameOver();

  const { ready: engineReady, bestMove } = useStockfishPlayer(
    fen,
    isBotTurn,
    {
      elo: activeEngineElo,
      skillLevel: activeSkillLevel,
      strengthMode: engineStrengthMode,
      whiteTimeSeconds,
      blackTimeSeconds,
      engineVariant: botEngineVariant,
      timeMode: activeTimeMode,
      fixedMoveTimeMs: activeFixedMoveTimeMs,
    },
  );
  const isBestMoveLegal = useMemo(() => {
    if (!bestMove || !/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(bestMove)) {
      return false;
    }

    const from = bestMove.slice(0, 2) as Square;
    const to = bestMove.slice(2, 4) as Square;
    const promotion = bestMove.length > 4 ? bestMove[4] : undefined;
    const legalMoves = gameRef.current.moves({ verbose: true });

    return legalMoves.some((move) => {
      if (move.from !== from || move.to !== to) {
        return false;
      }
      if (!promotion) {
        return true;
      }
      return move.promotion === promotion;
    });
  }, [bestMove, fen]);

  const analysis = useStockfishAnalysis(
    fen,
    gameState !== "setup",
    analysisDepth,
    analysisMultiPv,
    analysisThreads,
    analysisEngineVariant,
    analysisMaxTimeSeconds,
  );
  const analysisModelLabel = analysisEngineVariant === "stockfish-18" ? "Stockfish-18" : "Stockfish-18-Lite";

  const { toggleTheme, isDark } = useTheme();
  const botPreferences = clientPreferences.bot;
  const updateBotPreferences = (updates: Partial<typeof botPreferences>) => {
    setClientPreferences((previous) => ({
      ...previous,
      bot: {
        ...previous.bot,
        ...updates,
      },
    }));
  };
  const shouldLockBoard = isBotTurn || isBotMatchMode || botPreferences.boardLock;

  useEffect(() => {
    setClientPreferences(loadClientPreferences());
  }, []);

  useEffect(() => {
    return () => {
      Object.values(audioPoolRef.current)
        .flat()
        .forEach((audio) => {
          audio.pause();
          audio.src = "";
        });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;

      const user = session?.user;
      if (!user) {
        setViewerName("Guest User");
        return;
      }

      let resolvedName =
        (typeof user.user_metadata?.username === "string" && user.user_metadata.username.trim()) ||
        (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
        (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
        (typeof user.email === "string" && user.email.includes("@") ? user.email.split("@")[0] : "") ||
        "Guest User";

      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      if (typeof data?.username === "string" && data.username.trim()) {
        resolvedName = data.username.trim();
      }

      if (!cancelled) {
        setViewerName(resolvedName);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Fetch preferences
  useEffect(() => {
    let isCancelled = false;
    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/preferences", { method: "GET" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          boardTheme?: string;
          pieceTheme?: string;
          soundEnabled?: boolean;
        };
        if (isCancelled) return;
        if (typeof data.boardTheme === "string") setBoardTheme(data.boardTheme);
        if (typeof data.pieceTheme === "string") setPieceTheme(data.pieceTheme);
        if (typeof data.soundEnabled === "boolean") setSoundEnabled(data.soundEnabled);
      } finally {
        if (!isCancelled) setPreferencesLoading(false);
      }
    };
    loadPreferences().catch(() => {
      if (!isCancelled) setPreferencesLoading(false);
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  const playSound = (name: string, force = false) => {
    if (!force && !soundEnabled) return;
    if (typeof Audio === "undefined") return;

    if (!audioPoolRef.current[name]) {
      audioPoolRef.current[name] = Array.from({ length: 3 }, () => {
        const audio = new Audio(`/sounds/${name}.mp3`);
        audio.preload = "auto";
        return audio;
      });
      nextAudioIndexRef.current[name] = 0;
    }

    const pool = audioPoolRef.current[name];
    const currentIndex = nextAudioIndexRef.current[name] ?? 0;
    const audio = pool[currentIndex];
    nextAudioIndexRef.current[name] = (currentIndex + 1) % pool.length;

    audio.volume = Math.min(1, Math.max(0, botPreferences.masterVolume / 100));
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const formatClock = (seconds: number) => {
    const safe = Math.max(0, seconds);
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimeoutStatusByMaterial = () => {
    const { materialDiff } = getMaterialSnapshot(gameRef.current);
    if (materialDiff === 0) {
      return "Time over. Draw by equal material.";
    }

    const winner = materialDiff > 0 ? "White" : "Black";
    return `Time over. ${winner} wins on material (+${Math.abs(materialDiff)}).`;
  };

  const savePreferences = async () => {
    setPreferencesError(null);
    setPreferencesSaving(true);
    try {
      let shouldFallbackToLocal = false;

      try {
        const response = await fetch("/api/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardTheme, pieceTheme, soundEnabled }),
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            shouldFallbackToLocal = true;
          } else {
            const payload = (await response.json()) as { error?: string };
            throw new Error(payload.error ?? "Failed to save preferences.");
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("Failed to fetch")) {
          shouldFallbackToLocal = true;
        } else if (!shouldFallbackToLocal) {
          throw error;
        }
      }

      if (shouldFallbackToLocal) {
        setPreferencesError(null);
      }

      saveClientPreferences(clientPreferences);
      setIsSettingsOpen(false);
    } catch (error) {
      setPreferencesError(error instanceof Error ? error.message : "Failed to save preferences.");
    } finally {
      setPreferencesSaving(false);
    }
  };

  // Bot applies opening move (bot match) or best engine move.
  useEffect(() => {
    if (gameState !== "playing" || !isBotTurn) {
      return;
    }

    if (isBotMatchMode) {
      const turn = gameRef.current.turn();
      const isBot1Turn = turn === botSide;
      const selectedOpening = BOT_OPENING_MOVES.find((opening) =>
        opening.id === (isBot1Turn ? bot1OpeningId : bot2OpeningId),
      );
      const openingAlreadyUsed = isBot1Turn ? bot1OpeningUsed : bot2OpeningUsed;

      if (!openingAlreadyUsed) {
        const openingMove = selectedOpening?.uci;

        if (openingMove) {
          const from = openingMove.slice(0, 2) as Square;
          const to = openingMove.slice(2, 4) as Square;
          const promotion = openingMove.length > 4 ? openingMove[4] : undefined;
          commitMove(from, to, promotion);
        }

        if (isBot1Turn) {
          setBot1OpeningUsed(true);
        } else {
          setBot2OpeningUsed(true);
        }

        return;
      }
    }

    if (bestMove && isBestMoveLegal) {
      const from = bestMove.slice(0, 2) as Square;
      const to = bestMove.slice(2, 4) as Square;
      const promotion = bestMove.length > 4 ? bestMove[4] : undefined;
      
      commitMove(from, to, promotion);
    }
  }, [
    bestMove,
    isBotTurn,
    gameState,
    isBotMatchMode,
    botSide,
    bot1OpeningId,
    bot2OpeningId,
    bot1OpeningUsed,
    bot2OpeningUsed,
    isBestMoveLegal,
  ]);

  const startGame = (color: "w" | "b" | "random" | "bot-vs-bot") => {
    const finalColor = color === "random" ? (Math.random() > 0.5 ? "w" : "b") : color;
    const seededGame = new Chess();

    setPlayerColor(finalColor);
    setFen(seededGame.fen());
    setHistory([DEFAULT_FEN]);
    setSanHistory([]);
    setCurrentMoveIndex(0);
    setIsPlayingHistory(false);
    setLastMove(null);
    setTimeoutStatus(null);
    setWhiteTimeSeconds(timeLimit * 60);
    setBlackTimeSeconds(timeLimit * 60);
    setWarnedWhiteLowTime(false);
    setWarnedBlackLowTime(false);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setDragOverSquare(null);
    gameRef.current = seededGame;
    setBot1OpeningUsed(false);
    setBot2OpeningUsed(false);
    setBotMatchConfigOpen(false);
    setGameState("playing");
    playSound("game-start");
  };

  const stopGame = () => {
    setGameState("setup");
    setIsPlayingHistory(false);
    setTimeoutStatus(null);
  };

  const commitMove = (from: Square, to: Square, promotion?: string) => {
    const nextPosition = new Chess(fen);

    let resolvedPromotion: "q" | "r" | "b" | "n" | undefined = undefined;
    if (promotion && ["q", "r", "b", "n"].includes(promotion)) {
      resolvedPromotion = promotion as "q" | "r" | "b" | "n";
    } else {
      const movingPiece = nextPosition.get(from);
      const targetRank = Number(to[1]);
      const isPawnPromotion =
        movingPiece?.type === "p" &&
        ((movingPiece.color === "w" && targetRank === 8) || (movingPiece.color === "b" && targetRank === 1));

      if (isPawnPromotion) {
        if (botPreferences.autoQueen || isBotTurn) {
          resolvedPromotion = "q";
        } else {
          const selected = window.prompt("Promote to (q, r, b, n)", "q")?.trim().toLowerCase();
          if (!selected) {
            return false;
          }
          if (!["q", "r", "b", "n"].includes(selected)) {
            playSound("illegal");
            return false;
          }
          resolvedPromotion = selected as "q" | "r" | "b" | "n";
        }
      }
    }

    try {
      const move = nextPosition.move({
        from,
        to,
        promotion: resolvedPromotion,
      });

      if (!move) {
        if (!isBotTurn) playSound("illegal");
        return false;
      }

      const serializedMove: SerializableMove = {
        from: move.from,
        to: move.to,
        san: move.san,
        isCheck: nextPosition.isCheck(),
        isCapture: move.isCapture(),
        isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
        isPromotion: move.isPromotion(),
      };

      const newFen = nextPosition.fen();
      const nextHistory = [...history.slice(0, currentMoveIndex + 1), newFen];
      const nextSanHistory = [...sanHistory.slice(0, currentMoveIndex), move.san];
      
      gameRef.current = nextPosition;
      setHistory(nextHistory);
      setSanHistory(nextSanHistory);
      setCurrentMoveIndex(nextHistory.length - 1);
      setFen(newFen);
      setSelectedSquare(null);
      setDraggedSquare(null);
      setLastMove(serializedMove);

      let soundToPlay = "move-self";
      if (serializedMove.isCheck) {
        soundToPlay = "move-check";
      } else if (serializedMove.isCastle) {
        soundToPlay = "castle";
      } else if (serializedMove.isPromotion) {
        soundToPlay = "promote";
      } else if (serializedMove.isCapture) {
        soundToPlay = "capture";
      }
      
      playSound(soundToPlay);
      
      if (nextPosition.isGameOver()) {
        setGameState("game_over");
      }

      return true;
    } catch {
      if (!isBotTurn) playSound("illegal");
      return false;
    }
  };

  const setPositionFromHistory = (index: number) => {
    const bounded = Math.max(0, Math.min(index, history.length - 1));
    const fenAtIndex = history[bounded] ?? DEFAULT_FEN;
    setCurrentMoveIndex(bounded);
    setFen(fenAtIndex);
    gameRef.current = new Chess(fenAtIndex);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setDragOverSquare(null);
  };

  const goToStart = () => setPositionFromHistory(0);
  const goToPrev = () => setPositionFromHistory(currentMoveIndex - 1);
  const goToNext = () => setPositionFromHistory(currentMoveIndex + 1);
  const goToEnd = () => setPositionFromHistory(history.length - 1);
  const resetBoardReview = () => setPositionFromHistory(0);

  const handleSquareClick = (square: Square) => {
    if (botPreferences.moveMethod === "drag") return;
    if (gameState !== "playing" || shouldLockBoard || isReviewing) return;

    const game = gameRef.current;
    const clickedPiece = game.get(square);
    const legalTargets = selectedSquare ? game.moves({ square: selectedSquare, verbose: true }).map((m) => m.to) : [];

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    if (selectedSquare && legalTargets.includes(square)) {
      if (botPreferences.moveConfirmation && !window.confirm(`Confirm move ${selectedSquare} to ${square}?`)) {
        return;
      }
      commitMove(selectedSquare, square);
      return;
    }

    if (clickedPiece && clickedPiece.color === game.turn()) {
      setSelectedSquare(square);
      return;
    }

    if (selectedSquare) {
      playSound("illegal");
    }
    setSelectedSquare(null);
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, square: Square) => {
    if (botPreferences.moveMethod === "click") {
      event.preventDefault();
      return;
    }
    if (gameState !== "playing" || shouldLockBoard || isReviewing) {
      event.preventDefault();
      return;
    }

    const game = gameRef.current;
    const draggedPiece = game.get(square);

    if (!draggedPiece || draggedPiece.color !== game.turn()) {
      event.preventDefault();
      return;
    }

    const pieceImg = event.currentTarget.querySelector('img');
    if (pieceImg) {
      const size = pieceImg.getBoundingClientRect();
      event.dataTransfer.setDragImage(pieceImg, size.width / 2, size.height / 2);
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", square);
    setDraggedSquare(square);
    setSelectedSquare(square);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, square: Square) => {
    event.preventDefault();
    if (!draggedSquare || shouldLockBoard || isReviewing || gameState !== "playing") return;

    if (botPreferences.moveConfirmation && !window.confirm(`Confirm move ${draggedSquare} to ${square}?`)) {
      setDraggedSquare(null);
      setSelectedSquare(null);
      return;
    }

    const didMove = commitMove(draggedSquare, square);

    if (!didMove) {
      setDraggedSquare(null);
      setSelectedSquare(draggedSquare);
    }
  };

  const game = gameRef.current;
  const boardState = game.board().map((row) => row.map((piece) => getPieceCode(piece)));
  const legalTargets = selectedSquare && gameState === "playing" && !shouldLockBoard
    ? game.moves({ square: selectedSquare, verbose: true }).map((move) => move.to)
    : [];

  useEffect(() => {
    if (!isPlayingHistory) {
      return;
    }
    if (currentMoveIndex >= history.length - 1) {
      setIsPlayingHistory(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setPositionFromHistory(currentMoveIndex + 1);
    }, 850);

    return () => window.clearTimeout(timer);
  }, [isPlayingHistory, currentMoveIndex, history.length]);

  useEffect(() => {
    if (gameState !== "playing" || isReviewing || gameRef.current.isGameOver()) {
      return;
    }

    const timer = window.setInterval(() => {
      const turn = gameRef.current.turn();

      if (turn === "w") {
        setWhiteTimeSeconds((previous) => {
          const next = previous - 1;
          if (botPreferences.lowTimeWarning && next <= 10 && next > 0 && !warnedWhiteLowTime) {
            setWarnedWhiteLowTime(true);
            playSound("move-check");
          }
          if (next <= 0) {
            setGameState("game_over");
            setTimeoutStatus(getTimeoutStatusByMaterial());
            playSound("game-end");
            return 0;
          }
          return next;
        });
      } else {
        setBlackTimeSeconds((previous) => {
          const next = previous - 1;
          if (botPreferences.lowTimeWarning && next <= 10 && next > 0 && !warnedBlackLowTime) {
            setWarnedBlackLowTime(true);
            playSound("move-check");
          }
          if (next <= 0) {
            setGameState("game_over");
            setTimeoutStatus(getTimeoutStatusByMaterial());
            playSound("game-end");
            return 0;
          }
          return next;
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [gameState, isReviewing, botPreferences.lowTimeWarning, warnedWhiteLowTime, warnedBlackLowTime]);

  const toggleHistoryPlayback = () => {
    if (history.length <= 1) {
      return;
    }
    if (currentMoveIndex >= history.length - 1) {
      setPositionFromHistory(0);
      setIsPlayingHistory(true);
      return;
    }
    setIsPlayingHistory((previous) => !previous);
  };

  const isBoardFlipped = botSide === "w";

  const botClockSeconds = botSide === "w" ? whiteTimeSeconds : blackTimeSeconds;

  const playerClockSeconds = playerSide === "w" ? whiteTimeSeconds : blackTimeSeconds;

  const topSuggestedMove = analysis.lines[0]?.pv[0] ?? null;
  const pieceThemePath = PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`;
  const botSideColor: SideColor = botSide;
  const playerSideColor: SideColor = playerSide;
  const materialSnapshot = getMaterialSnapshot(game);
  const topSideColor: SideColor = botSideColor;
  const bottomSideColor: SideColor = playerSideColor;
  const capturedByTopTypes = topSideColor === "w" ? materialSnapshot.capturedByWhite : materialSnapshot.capturedByBlack;
  const capturedByBottomTypes = bottomSideColor === "w" ? materialSnapshot.capturedByWhite : materialSnapshot.capturedByBlack;
  const topMaterialLead = topSideColor === "w" ? materialSnapshot.materialDiff : -materialSnapshot.materialDiff;
  const bottomMaterialLead = bottomSideColor === "w" ? materialSnapshot.materialDiff : -materialSnapshot.materialDiff;
  const toCapturedPieceCodes = (capturerColor: SideColor, capturedTypes: MaterialPieceType[]) => {
    const capturedColor: SideColor = capturerColor === "w" ? "b" : "w";
    return capturedTypes.map((type) => `${capturedColor}${type}`);
  };
  const topCapturedPieceCodes = toCapturedPieceCodes(topSideColor, capturedByTopTypes);
  const bottomCapturedPieceCodes = toCapturedPieceCodes(bottomSideColor, capturedByBottomTypes);
  const topDisplayName = isBotMatchMode ? "Bot 1" : "MT Model";
  const topDisplaySubtitle = isBotMatchMode
    ? `ELO ${bot1Elo}`
    : strengthMode === "elo"
      ? `ELO ${elo}`
      : strengthMode === "beginner"
        ? `Est. Elo ${beginnerEstimatedElo}`
        : `Skill ${skillLevel}`;
  const bottomDisplayName = isBotMatchMode ? "Bot 2" : viewerName;
  const bottomDisplaySubtitle = isBotMatchMode ? `ELO ${bot2Elo}` : null;
  const whiteWinChance = Math.max(0, Math.min(100, analysis.whiteWinChance));

  const toBoardPoint = (square: string | null) => {
    if (!square || square.length !== 2) {
      return null;
    }

    const file = FILES.indexOf(square[0] as typeof FILES[number]);
    const rank = Number(square[1]);
    if (file < 0 || Number.isNaN(rank) || rank < 1 || rank > 8) {
      return null;
    }

    let row = 8 - rank;
    let col = file;

    if (isBoardFlipped) {
      row = 7 - row;
      col = 7 - col;
    }

    return {
      x: ((col + 0.5) / 8) * 100,
      y: ((row + 0.5) / 8) * 100,
    };
  };

  const suggestionFrom = topSuggestedMove?.slice(0, 2) ?? null;
  const suggestionTo = topSuggestedMove?.slice(2, 4) ?? null;
  const suggestionStart = showSuggestionArrow ? toBoardPoint(suggestionFrom) : null;
  const suggestionEnd = showSuggestionArrow ? toBoardPoint(suggestionTo) : null;
  const showMovePreview = (event: MouseEvent<HTMLSpanElement>, fenAfter: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const previewSize = 190;
    const padding = 12;
    const left = Math.min(Math.max(padding, rect.left), window.innerWidth - previewSize - padding);
    const top = Math.min(rect.bottom + 8, window.innerHeight - previewSize - padding);
    setHoverPreview({ fen: fenAfter, left, top });
  };

  useEffect(() => {
    const clearPreview = () => setHoverPreview(null);
    window.addEventListener("resize", clearPreview);
    window.addEventListener("scroll", clearPreview, true);
    return () => {
      window.removeEventListener("resize", clearPreview);
      window.removeEventListener("scroll", clearPreview, true);
    };
  }, []);

  const visibleSanMoves = sanHistory.slice(0, Math.max(0, currentMoveIndex));

  const playedMoveRows: Array<{
    moveNumber: number;
    whiteMove: string;
    blackMove: string;
  }> = [];

  for (let index = 0; index < visibleSanMoves.length; index += 2) {
    playedMoveRows.push({
      moveNumber: Math.floor(index / 2) + 1,
      whiteMove: visibleSanMoves[index] ?? "",
      blackMove: visibleSanMoves[index + 1] ?? "",
    });
  }

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[var(--bg)]">
      <header className="w-full px-8 py-5 flex items-center justify-between border-b border-[var(--border)]">
        <Link href="/" className="text-[22px] font-serif font-[800] text-[var(--text-primary)]">
          CHESS
        </Link>
        <Link
          href="/"
          className="inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[14px] font-medium group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" />
          Back to Play
        </Link>
      </header>

      <main className="flex-1 w-full flex flex-col lg:flex-row h-[calc(100vh-73px)]">
        {/* Left Side: Setup & Status */}
        <div className={gameState === "setup" ? "w-full lg:w-[35%] flex flex-col items-center justify-center p-10 bg-[var(--bg)] relative z-10 shrink-0" : "w-full lg:w-[35%] p-6 lg:p-5 bg-[var(--bg)] relative z-10 shrink-0 border-r border-[var(--border)]"}>
          <div className={gameState === "setup" ? "w-full max-w-[440px] bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 shadow-2xl relative" : "w-full h-full max-h-[85vh] bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col"}>
            {gameState === "setup" && <div className="absolute top-0 left-0 w-full h-[4px] rounded-t-2xl bg-gradient-to-r from-[var(--border-hover)] to-[var(--text-secondary)] opacity-30" />}

            {gameState === "setup" && (
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[var(--skeleton)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] shadow-sm">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-[28px] font-serif text-[var(--text-primary)] font-[500] leading-tight tracking-tight">
                    Play vs Computer
                  </h1>
                  <p className="text-[var(--text-muted)] text-[14px]">
                    Challenge Stockfish 18 at any level
                  </p>
                </div>
              </div>
            )}

            {gameState === "setup" ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <label className="text-[14px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex flex-wrap items-center gap-1.5 align-middle">
                      Strength Mode
                      <InfoHint text="Pick one mode: Beginner (estimated under 1320), Skill (0-20), or Elo-limited (1320-3190)." />
                    </label>
                    <div className="px-3 py-1 rounded-md bg-[var(--surface-hover)] border border-[var(--border-hover)] text-[var(--text-primary)]  shadow-sm">
                      {strengthMode === "skill"
                        ? `Skill ${skillLevel}`
                        : strengthMode === "elo"
                          ? `ELO ${elo}`
                          : `Est. Elo ${beginnerEstimatedElo}`}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-5">
                    <button
                      onClick={() => setStrengthMode("beginner")}
                      className={`py-2.5 rounded-lg border font-bold text-[13px] transition-all ${
                        strengthMode === "beginner"
                          ? "bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg)] shadow-sm"
                          : "bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Beginner
                    </button>
                    <button
                      onClick={() => setStrengthMode("skill")}
                      className={`py-2.5 rounded-lg border font-bold text-[13px] transition-all ${
                        strengthMode === "skill"
                          ? "bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg)] shadow-sm"
                          : "bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Skill
                    </button>
                    <button
                      onClick={() => setStrengthMode("elo")}
                      className={`py-2.5 rounded-lg border font-bold text-[13px] transition-all ${
                        strengthMode === "elo"
                          ? "bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg)] shadow-sm"
                          : "bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      ELO
                    </button>
                  </div>

                  {strengthMode === "elo" && (
                    <>
                      <label className="text-[14px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex flex-wrap items-center gap-1.5 align-middle px-1 mb-3">
                        Difficulty
                        <InfoHint text="Quick presets for Elo-limited mode." />
                      </label>
                      <div className="grid grid-cols-4 gap-2 mb-8">
                        {[
                          { label: "Easy", icon: <User className="w-4 h-4" />, val: 2 },
                          { label: "Med", icon: <GraduationCap className="w-4 h-4" />, val: 4 },
                          { label: "Hard", icon: <Crosshair className="w-4 h-4" />, val: 7 },
                          { label: "Pro", icon: <Crown className="w-4 h-4" />, val: 9 },
                        ].map((diff) => (
                          <button
                            key={diff.label}
                            onClick={() => setEloIndex(diff.val)}
                            className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all gap-1.5 ${
                              eloIndex === diff.val
                                ? "bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg)] shadow-md"
                                : "bg-[var(--surface-alt)] border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            {diff.icon}
                            <span className="text-[12px] font-bold">{diff.label}</span>
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mb-3 px-1">
                        <label className="text-[14px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex flex-wrap items-center gap-1.5 align-middle">
                          Engine ELO
                          <InfoHint text={`Elo-limited mode targets a reduced strength. Stockfish 18 supports ${ELO_MIN}-${ELO_MAX}.`} />
                        </label>
                        <div className="px-3 py-1 rounded-md bg-[var(--surface-hover)] border border-[var(--border-hover)] text-[var(--text-primary)]  shadow-sm">
                          {elo}
                        </div>
                      </div>
                  
                      {/* ELO Slider */}
                      <div className="w-full mt-8 mb-2 space-y-3 px-1 relative">
                    <style dangerouslySetInnerHTML={{__html: `
                      input[type=range].elo-slider {
                        -webkit-appearance: none;
                        appearance: none;
                        background: transparent;
                        outline: none;
                      }
                      input[type=range].elo-slider::-webkit-slider-runnable-track {
                        width: 100%;
                        height: 10px;
                        background: transparent;
                        border: none;
                      }
                      input[type=range].elo-slider::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        appearance: none;
                        height: 28px;
                        width: 28px;
                        border-radius: 50%;
                        background: #fff;
                        border: 4px solid #10b981;
                        margin-top: -9px;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(16,185,129,0.4);
                        transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                      }
                      input[type=range].elo-slider:hover::-webkit-slider-thumb {
                        transform: scale(1.15);
                      }
                      input[type=range].elo-slider::-moz-range-track {
                        width: 100%;
                        height: 10px;
                        background: transparent;
                        border: none;
                      }
                      input[type=range].elo-slider::-moz-range-thumb {
                        height: 24px;
                        width: 24px;
                        border-radius: 50%;
                        background: #fff;
                        border: 4px solid #10b981;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(16,185,129,0.4);
                        transition: transform 0.15s;
                      }
                      input[type=range].elo-slider:hover::-moz-range-thumb {
                        transform: scale(1.15);
                      }
                    `}} />
                    
                    <div className="relative w-full h-10 flex flex-col justify-center">
                      {/* The custom visual track */}
                      <div className="absolute left-0 right-0 h-[10px] bg-[var(--skeleton)] rounded-full border border-[var(--border-subtle)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] pointer-events-none overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-[var(--text-secondary)] to-[var(--text-primary)]"
                          style={{ width: `${(eloIndex / (ELOS.length - 1)) * 100}%` }}
                        />
                      </div>

                      {/* Scale Ticks */}
                      {ELOS.map((val, idx) => {
                        const leftPercent = (idx / (ELOS.length - 1)) * 100;
                        const isPassed = idx <= eloIndex;
                        const isMajorTick = val % 500 === 0;
                        return (
                          <div 
                            key={val}
                            className={`absolute top-1/2 rounded-full pointer-events-none transition-all duration-300 ${
                              isMajorTick 
                                ? 'w-[4px] h-[12px]' 
                                : 'w-[2px] h-[6px]'
                            } ${
                              isPassed 
                                ? (isMajorTick ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]' : 'bg-white/50') 
                                : (isMajorTick ? 'bg-[var(--text-secondary)] opacity-80' : 'bg-[var(--text-muted)] opacity-30')
                            }`}
                            style={{ left: `${leftPercent}%`, transform: 'translate(-50%, -50%)', zIndex: isPassed ? 10 : 0 }}
                          />
                        );
                      })}

                      <input
                        type="range"
                        min="0"
                        max={ELOS.length - 1}
                        step="1"
                        value={eloIndex}
                        onChange={(e) => setEloIndex(Number(e.target.value))}
                        className="elo-slider absolute left-0 right-0 top-1/2 -translate-y-1/2 z-20 m-0 w-full"
                      />
                    </div>
                    <div className="flex justify-between text-[13px] font-bold text-[var(--text-muted)]">
                      <span className="flex flex-col items-start"><span className="text-[11px] uppercase tracking-widest opacity-70">Min</span>{ELO_MIN}</span>
                      <span className="flex flex-col items-end"><span className="text-[11px] uppercase tracking-widest opacity-70">Max</span>{ELO_MAX}</span>
                    </div>
                      </div>
                    </>
                  )}

                  {strengthMode === "beginner" && (
                    <div className="w-full mt-4 mb-2 space-y-3 px-1 relative">
                      <div className="flex items-start justify-between gap-4">
                        <label className="text-[14px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-start gap-1.5 align-middle mt-1">
                          <span className="flex flex-col">
                            <span>Beginner Strength</span>
                            <span className="text-[11px] opacity-80">(Est. Elo)</span>
                          </span>
                          <InfoHint text="For Elo below 1320, this uses tuned Skill + fixed move time. Values are estimates, not official UCI Elo." />
                        </label>
                        <div className="px-3 py-1 rounded-md bg-[var(--surface-hover)] border border-[var(--border-hover)] text-[var(--text-primary)] shadow-sm shrink-0 mt-1">
                          {beginnerEstimatedElo}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={BEGINNER_ESTIMATED_ELOS.length - 1}
                        step="1"
                        value={beginnerEloIndex}
                        onChange={(event) => setBeginnerEloIndex(Number(event.target.value))}
                        className="elo-slider w-full"
                      />
                      <div className="flex justify-between text-[13px] font-bold text-[var(--text-muted)]">
                        <span>Est. {BEGINNER_ELO_MIN}</span>
                        <span>Est. {BEGINNER_ELO_MAX}</span>
                      </div>
                      <p className="text-[12px] text-[var(--text-muted)] px-0.5">
                        Auto-mapped to Skill {beginnerEngineProfile.skillLevel} and {beginnerEngineProfile.fixedMoveTimeMs}ms/move.
                      </p>
                    </div>
                  )}

                  {strengthMode === "skill" && (
                    <div className="w-full mt-4 mb-2 space-y-3 px-1 relative">
                      <div className="flex items-center justify-between">
                        <label className="text-[14px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex flex-wrap items-center gap-1.5 align-middle">
                          Skill Level
                          <InfoHint text="Skill mode is direct engine skill from 0 to 20. Level 20 is strongest." />
                        </label>
                        <div className="px-3 py-1 rounded-md bg-[var(--surface-hover)] border border-[var(--border-hover)] text-[var(--text-primary)]  shadow-sm">
                          {skillLevel}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="1"
                        value={skillLevel}
                        onChange={(event) => setSkillLevel(Number(event.target.value))}
                        className="elo-slider w-full"
                      />
                      <div className="flex justify-between text-[13px] font-bold text-[var(--text-muted)]">
                        <span>0 (Beginner)</span>
                        <span>20 (Strongest)</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mb-8 mt-10">
                  <label className="block text-[14px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 px-1 flex items-center gap-2">
                    Time Limit
                    <InfoHint text="Game clock for both sides. The engine manages its own thinking time from this clock by default." />
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {[1, 3, 5, 10].map((mins) => (
                       <button
                         key={mins}
                         onClick={() => setTimeLimit(mins)}
                         className={`py-3 rounded-xl border font-bold text-[14px] transition-all transform hover:scale-[1.02] shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
                           timeLimit === mins ? "bg-[var(--text-primary)] text-[var(--bg)] border-transparent" : "bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--border-hover)]"
                         }`}
                       >
                         {mins} min
                       </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-[14px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 px-1">
                    Play As
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <button 
                      onClick={() => startGame("w")}
                      className="relative overflow-hidden py-4 px-2 rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[var(--surface-alt)] to-[var(--surface)] hover:from-[var(--surface-hover)] hover:to-[var(--surface-alt)] text-[var(--text-primary)] transition-all flex flex-col items-center gap-3 group shadow-[0_4px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] hover:-translate-y-1"
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full blur-xl group-hover:bg-white/10 transition-colors" />
                      <div className="w-8 h-8 rounded-full bg-gradient-to-b from-white to-gray-200 border border-gray-300 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.1),_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-110 transition-transform relative z-10"/>
                      <span className="text-[13px] font-bold tracking-wide relative z-10">White</span>
                    </button>
                    <button 
                      onClick={() => startGame("random")}
                      className="relative overflow-hidden py-4 px-2 rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[var(--surface-alt)] to-[var(--surface)] hover:from-[var(--surface-hover)] hover:to-[var(--surface-alt)] text-[var(--text-primary)] transition-all flex flex-col items-center gap-3 group shadow-[0_4px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] hover:-translate-y-1"
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full blur-xl group-hover:bg-white/10 transition-colors" />
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white via-gray-400 to-[#111] border border-gray-500 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2),_0_4px_8px_rgba(0,0,0,0.2)] group-hover:scale-110 transition-transform relative z-10 overflow-hidden">
                         <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent skew-x-[-20deg] group-hover:translate-x-[150%] transition-transform duration-700" />
                      </div>
                      <span className="text-[13px] font-bold tracking-wide relative z-10">Random</span>
                    </button>
                    <button 
                      onClick={() => startGame("b")}
                      className="relative overflow-hidden py-4 px-2 rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[var(--surface-alt)] to-[var(--surface)] hover:from-[var(--surface-hover)] hover:to-[var(--surface-alt)] text-[var(--text-primary)] transition-all flex flex-col items-center gap-3 group shadow-[0_4px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] hover:-translate-y-1"
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-black/5 rounded-full blur-xl group-hover:bg-black/10 transition-colors" />
                      <div className="w-8 h-8 rounded-full bg-gradient-to-b from-[#333] to-[#0a0a0a] border border-[#000] shadow-[inset_0_-2px_4px_rgba(255,255,255,0.1),_0_4px_8px_rgba(0,0,0,0.3)] group-hover:scale-110 transition-transform relative z-10"/>
                      <span className="text-[13px] font-bold tracking-wide relative z-10">Black</span>
                    </button>
                    <button 
                      onClick={() => setBotMatchConfigOpen((open) => !open)}
                      className="relative overflow-hidden py-4 px-2 rounded-2xl border border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg)] hover:opacity-90 transition-all flex flex-col items-center gap-3 group shadow-md hover:shadow-lg hover:-translate-y-1"
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--bg)] opacity-10 rounded-full blur-xl transition-colors duration-500" />
                      <Bot className="w-8 h-8 group-hover:scale-110 transition-transform filter drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] relative z-10"/>
                      <span className="text-[13px] font-bold tracking-wide relative z-10">Bot Match</span>
                    </button>
                  </div>

                  {botMatchConfigOpen && (
                    <div className="mt-5 rounded-xl border border-[var(--border-hover)] bg-[var(--surface-alt)] p-4 space-y-3">
                      <div className="text-[12px] uppercase tracking-wider font-semibold text-[var(--text-primary)]">
                        Bot Match Setup
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="text-[12px] text-[var(--text-muted)] font-semibold">
                          Bot 1 ELO
                          <select
                            value={bot1EloIndex}
                            onChange={(event) => setBot1EloIndex(Number(event.target.value))}
                            className="mt-1 w-full bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-2 focus:outline-none focus:border-[var(--text-primary)]"
                          >
                            {ELOS.map((value, index) => (
                              <option key={`bot1-${value}`} value={index}>{value}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[12px] text-[var(--text-muted)] font-semibold">
                          Bot 2 ELO
                          <select
                            value={bot2EloIndex}
                            onChange={(event) => setBot2EloIndex(Number(event.target.value))}
                            className="mt-1 w-full bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-2 focus:outline-none focus:border-[var(--text-primary)]"
                          >
                            {ELOS.map((value, index) => (
                              <option key={`bot2-${value}`} value={index}>{value}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="text-[12px] text-[var(--text-muted)] font-semibold block">
                        Bot 1 Opening
                        <select
                          value={bot1OpeningId}
                          onChange={(event) => setBot1OpeningId(event.target.value)}
                          className="mt-1 w-full bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-2 focus:outline-none focus:border-[var(--text-primary)]"
                        >
                          {BOT_OPENING_MOVES.map((opening) => (
                            <option key={opening.id} value={opening.id}>{opening.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[12px] text-[var(--text-muted)] font-semibold block">
                        Bot 2 Opening
                        <select
                          value={bot2OpeningId}
                          onChange={(event) => setBot2OpeningId(event.target.value)}
                          className="mt-1 w-full bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-2 focus:outline-none focus:border-[var(--text-primary)]"
                        >
                          {BOT_OPENING_MOVES.map((opening) => (
                            <option key={`bot2-${opening.id}`} value={opening.id}>{opening.label}</option>
                          ))}
                        </select>
                      </label>

                      <button
                        onClick={() => startGame("bot-vs-bot")}
                        className="w-full py-2.5 rounded-lg bg-[var(--text-primary)] text-[var(--bg)]  hover:opacity-90 transition-colors"
                      >
                        Start Bot Match
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="h-12 px-3 border-b border-[var(--border)] flex items-center justify-between relative">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-primary)] text-[10px]">v</span>
                    <span className="text-[var(--text-primary)] text-[15px] font-[500] leading-none">Analysis</span>
                    <button
                      onClick={() => setIsAnalysisMenuOpen((open) => !open)}
                      className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"
                      title="Analysis menu"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded border border-[var(--border-subtle)] bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                      {analysisModelLabel}
                    </span>
                    <span className="text-[var(--text-secondary)] text-[14px]">depth-{analysis.depth || analysisDepth}</span>
                    <button
                      onClick={() => setIsSettingsOpen(true)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      title="Engine settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>

                  {isAnalysisMenuOpen && (
                    <div className="absolute top-11 left-20 z-30 w-[230px] rounded-md border border-[var(--border-subtle)] bg-[var(--surface-alt)] shadow-2xl py-2">
                      <button onClick={() => setShowEvaluationBar((v) => !v)} className="w-full px-3 py-2 text-left text-[var(--text-primary)] hover:bg-[var(--surface-hover)] text-[14px] flex items-center justify-between">
                        <span>Evaluation Bar</span>
                        <span className={showEvaluationBar ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>{showEvaluationBar ? "On" : "Off"}</span>
                      </button>
                      <button onClick={() => setShowEngineLines((v) => !v)} className="w-full px-3 py-2 text-left text-[var(--text-primary)] hover:bg-[var(--surface-hover)] text-[14px] flex items-center justify-between">
                        <span>Engine Lines</span>
                        <span className={showEngineLines ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>{showEngineLines ? "On" : "Off"}</span>
                      </button>
                      <button onClick={() => setShowSuggestionArrow((v) => !v)} className="w-full px-3 py-2 text-left text-[var(--text-primary)] hover:bg-[var(--surface-hover)] text-[14px] flex items-center justify-between">
                        <span>Suggestion Arrow</span>
                        <span className={showSuggestionArrow ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>{showSuggestionArrow ? "On" : "Off"}</span>
                      </button>
                      <button onClick={() => setShowMoveFeedback((v) => !v)} className="w-full px-3 py-2 text-left text-[var(--text-primary)] hover:bg-[var(--surface-hover)] text-[14px] flex items-center justify-between">
                        <span>Move Feedback</span>
                        <span className={showMoveFeedback ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>{showMoveFeedback ? "On" : "Off"}</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="max-h-[255px] overflow-visible border-b border-[var(--border)]">
                    {showEngineLines ? (
                      <>
                        {analysis.lines.slice(0, analysisMultiPv).map((line) => {
                          const pvMoves = buildPvDisplayMoves(fen, line.pv);
                          const isExpanded = expandedEngineLineIds[line.id] ?? false;
                          const canExpand = pvMoves.length > 6;
                          const visibleMoves = isExpanded ? pvMoves : pvMoves.slice(0, 6);

                          return (
                            <div key={line.id} className="min-h-[44px] px-2 py-1 border-b border-[var(--border)] flex items-start gap-2 text-[var(--text-secondary)] relative z-0 hover:z-40">
                              <div className="min-w-[52px] h-6 rounded bg-[var(--surface-alt)] border border-[var(--border-subtle)] flex items-center justify-center text-[12px] font-bold leading-none text-[var(--text-primary)] mt-[2px]">
                                {line.scoreText}
                              </div>
                              <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] leading-[1.1] text-[var(--text-secondary)]">
                                  {visibleMoves.map((pvMove) => (
                                    <div key={pvMove.key} className="relative z-0">
                                      <span
                                        className="inline-flex rounded-sm px-1 py-[2px] hover:bg-white/10 cursor-default"
                                        onMouseEnter={(event) => showMovePreview(event, pvMove.fenAfter)}
                                        onMouseLeave={() => setHoverPreview(null)}
                                      >
                                        {pvMove.label}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {canExpand && (
                                  <button
                                    onClick={() =>
                                      setExpandedEngineLineIds((prev) => ({
                                        ...prev,
                                        [line.id]: !isExpanded,
                                      }))
                                    }
                                    className="h-6 w-6 shrink-0 rounded text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] flex items-center justify-center"
                                    title={isExpanded ? "Collapse line" : "Show full line"}
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {analysis.error ? (
                          <div className="px-3 py-3 text-[var(--error-text)] text-[14px] border-b border-[var(--border)]">
                            Engine failed: {analysis.error}
                          </div>
                        ) : analysis.lines.length === 0 && (
                          <div className="px-3 py-3 text-[var(--text-muted)] text-[14px] border-b border-[var(--border)]">
                            {analysis.ready ? "Analyzing current position..." : "Starting engine..."}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="px-3 py-3 text-[var(--text-muted)] text-[14px] border-b border-[var(--border)]">
                        Engine lines hidden from menu.
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 flex flex-col bg-[var(--surface-alt)]">
                    <div className="px-3 py-2 border-b border-[var(--border)] text-[13px] font-semibold text-[var(--text-primary)]">
                      White - Black
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {playedMoveRows.length === 0 ? (
                        <div className="px-3 py-3 text-[13px] text-[var(--text-muted)]">No moves yet.</div>
                      ) : (
                        playedMoveRows.map((row, rowIndex) => {
                          const whitePlyIndex = rowIndex * 2 + 1;
                          const blackPlyIndex = rowIndex * 2 + 2;
                          const isCurrentWhite = currentMoveIndex === whitePlyIndex;
                          const isCurrentBlack = currentMoveIndex === blackPlyIndex;

                          return (
                            <div key={row.moveNumber} className="grid grid-cols-[36px_1fr_1fr] items-center px-3 py-1.5 border-b border-[#252527] text-[14px]">
                              <span className="text-[#a5a5a8]">{row.moveNumber}.</span>
                              <span className={`truncate ${isCurrentWhite ? "text-white font-semibold" : "text-[#d4d4d6]"}`}>
                                {row.whiteMove || ""}
                              </span>
                              <span className={`truncate ${isCurrentBlack ? "text-white font-semibold" : "text-[#d4d4d6]"}`}>
                                {row.blackMove || ""}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--surface)]">
                  <div className="flex items-center justify-center gap-2 mb-3 w-full">
                    <button onClick={goToStart} disabled={currentMoveIndex === 0} className="p-2 rounded-md bg-[var(--surface-alt)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-colors disabled:cursor-not-allowed">
                      <ChevronsLeft className="w-6 h-6" />
                    </button>
                    <button onClick={goToPrev} disabled={currentMoveIndex === 0} className="p-2 rounded-md bg-[var(--surface-alt)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-colors disabled:cursor-not-allowed">
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button onClick={toggleHistoryPlayback} className="p-2 px-4 rounded-md bg-[var(--surface-alt)] border border-[var(--border-hover)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-center min-w-[56px]">
                      {isPlayingHistory ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                    </button>
                    <button onClick={goToNext} disabled={currentMoveIndex === history.length - 1} className="p-2 rounded-md bg-[var(--surface-alt)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-colors disabled:cursor-not-allowed">
                      <ChevronRight className="w-6 h-6" />
                    </button>
                    <button onClick={goToEnd} disabled={currentMoveIndex === history.length - 1} className="p-2 rounded-md bg-[var(--surface-alt)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-colors disabled:cursor-not-allowed">
                      <ChevronsRight className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="text-[13px] text-[var(--text-muted)] mb-2">
                    {timeoutStatus ?? getPositionStatus(gameRef.current)}
                  </div>
                  {showMoveFeedback && (
                    <div className="text-[12px] text-[var(--text-secondary)] mb-2">
                      {topSuggestedMove ? `Suggested move: ${topSuggestedMove}` : "No suggestion yet."}
                    </div>
                  )}
                  <button
                    onClick={resetBoardReview}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-md font-semibold text-[13px] hover:bg-[var(--cta-hover)] transition-colors"
                  >
                    Reset Board
                  </button>
                </div>
              </>
            )}
            
          </div>
        </div>

        {/* Right Side: The Board */}
        <div className="w-full lg:w-[65%] flex-1 flex flex-row items-center lg:items-start justify-center lg:justify-end bg-[var(--bg-alt)] p-8 lg:p-0 lg:pr-[70px] relative shadow-[-30px_0_50px_rgba(0,0,0,0.15)] border-l border-[var(--border)]">
          <div className="absolute top-6 right-6 flex flex-col gap-3 z-50">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() =>
                updateBotPreferences({
                  boardOrientation: isBoardFlipped ? "white" : "black",
                })
              }
              className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center flex-col gap-[2px]"
              title="Flip Board"
            >
              <ArrowLeft className="w-[14px] h-[14px] -ml-1" />
              <ArrowLeft className="w-[14px] h-[14px] -mr-1 rotate-180" />
            </button>
            <button
              onClick={toggleTheme}
              data-theme-toggle
              className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center"
            >
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
          </div>

          <div className="flex flex-col items-center justify-start h-[75vh] max-h-[720px] max-w-[95%] lg:max-w-[70%] lg:min-w-[500px] w-full relative shrink-0 lg:ml-auto lg:mr-8 lg:mt-4">
            {/* Top Bar (Opponent: Stockfish) */}
            {gameState !== "setup" && (
              <div className="w-full flex items-center justify-between mb-3 bg-[var(--surface)] px-2.5 py-1 rounded-xl border border-[var(--border)] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--skeleton)] border border-[var(--border)] flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-[var(--text-secondary)]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[12px] text-[var(--text-primary)] tracking-wide">{topDisplayName}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-medium">{topDisplaySubtitle}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-0.5 min-h-[16px]">
                    {topCapturedPieceCodes.map((pieceCode, index) => (
                      <img
                        key={`${pieceCode}-${index}`}
                        src={`${pieceThemePath}/${pieceCode}.png`}
                        alt={pieceCode}
                        className="w-[14px] h-[14px] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                      />
                    ))}
                    {topMaterialLead > 0 ? (
                      <span className="ml-1 text-[11px] font-bold text-[var(--text-primary)]">+{topMaterialLead}</span>
                    ) : null}
                  </div>
                  <div className="px-2 py-0.5 bg-[var(--bg-alt)] border border-[var(--border-subtle)] rounded-lg font-mono font-bold text-[14px] text-[var(--text-primary)] shadow-inner w-[68px] text-center">
                    {formatClock(botClockSeconds)}
                  </div>
                </div>
              </div>
            )}
            
            <div className="w-full flex items-stretch gap-3">
              {gameState !== "setup" && showEvaluationBar ? (
                <div className="w-[30px] md:w-[30px] shrink-0 bg-[#333333] rounded overflow-hidden flex flex-col relative shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                  <div
                    className="w-full bg-[#202020] transition-[height] duration-300 relative"
                    style={{ height: `${100 - whiteWinChance}%` }}
                  >
                    <div className="absolute inset-0 bg-white/5 animate-pulse" />
                  </div>
                  <div
                    className="w-full bg-white relative shadow-[0_-2px_10px_rgba(255,255,255,0.6)] flex flex-col justify-end pb-1 border-t border-[#666] transition-[height] duration-300"
                    style={{ height: `${whiteWinChance}%` }}
                  >
                    <span className="text-center text-[10px] md:text-[12px] font-[700] text-black">
                      {analysis.evaluationText}
                    </span>
                  </div>
                </div>
              ) : null}

              <div
                className={`flex-1 aspect-square relative shadow-2xl transition-all duration-500 ${!engineReady && gameState === "setup" ? "opacity-90 grayscale-[0.3]" : ""}`}
              >
              <BoardImage src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`} className="w-full h-full overflow-hidden rounded-sm">
                {suggestionStart && suggestionEnd && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-[15]" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <marker id="analysis-arrow-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(16,185,129,0.95)" />
                      </marker>
                    </defs>
                    <line
                      x1={suggestionStart.x}
                      y1={suggestionStart.y}
                      x2={suggestionEnd.x}
                      y2={suggestionEnd.y}
                      stroke="rgba(16,185,129,0.95)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      markerEnd="url(#analysis-arrow-head)"
                    />
                    <circle cx={suggestionStart.x} cy={suggestionStart.y} r="1.8" fill="rgba(16,185,129,0.85)" />
                  </svg>
                )}
                <div className="w-full h-full grid grid-cols-8 grid-rows-8 relative">
                  {(isBoardFlipped
                    ? [...boardState].reverse().map(r => [...r].reverse())
                    : boardState
                  ).map((row, visRowIndex) =>
                  row.map((piece, visColIndex) => {
                    const logicalRow = isBoardFlipped ? 7 - visRowIndex : visRowIndex;
                    const logicalCol = isBoardFlipped ? 7 - visColIndex : visColIndex;
                    const square = toSquare(logicalRow, logicalCol);
                    const squarePiece = gameRef.current.get(square);
                    const isLightSquare = (logicalRow + logicalCol) % 2 === 0;
                    const isSelectedSquare = selectedSquare === square;
                    const isLegalTarget = botPreferences.showLegalMoves && legalTargets.includes(square);
                    const isLastMoveSquare = lastMove?.from === square || lastMove?.to === square;
                    const isDraggedSquare = draggedSquare === square;
                    const isKingInCheck = gameRef.current.isCheck() && squarePiece?.type === 'k' && squarePiece?.color === gameRef.current.turn();

                    return (
                      <div
                        key={square}
                        onClick={() => handleSquareClick(square)}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (dragOverSquare !== square) setDragOverSquare(square);
                        }}
                        onDragLeave={() => {
                          if (dragOverSquare === square) setDragOverSquare(null);
                        }}
                        onDrop={(event) => {
                          handleDrop(event, square);
                          setDragOverSquare(null);
                        }}
                        className={`relative flex items-center justify-center ${gameState === "playing" && !shouldLockBoard ? "cursor-pointer" : ""}`}
                      >
                        {dragOverSquare === square && (
                          <div className="absolute inset-0 ring-[3px] ring-white bg-white/20 z-20 pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                        )}
                        {isLastMoveSquare && (
                          <div className="absolute inset-[4%] rounded-[4px] bg-amber-300/20" />
                        )}
                        {isKingInCheck && (
                          <div className="absolute inset-0 bg-red-500/40 animate-pulse shadow-[inset_0_0_20px_rgba(239,68,68,0.7)] z-[5]" />
                        )}
                        {isLegalTarget && (
                          <div
                            className={
                              squarePiece
                                ? "absolute inset-[10%] rounded-full border-[6px] border-black/20"
                                : "absolute h-[25%] w-[25%] rounded-full bg-black/20"
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
                          draggable={Boolean(
                            botPreferences.moveMethod !== "click" &&
                            squarePiece &&
                            squarePiece.color === gameRef.current.turn(),
                          )}
                          onDragStart={(event) => handleDragStart(event, square)}
                          onDragEnd={() => setDraggedSquare(null)}
                          className={`relative z-10 h-full w-full p-[2.75%] ${isDraggedSquare ? "opacity-30" : "opacity-100"}`}
                        >
                          {getPieceIcon(piece, pieceTheme)}
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
                  
                  {/* Game Over Overlay */}
                  {gameState === "game_over" && (
                    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-[3px] animate-in fade-in duration-300 pointer-events-auto">
                      <div className="bg-[var(--surface)] border border-[var(--border)] shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-6 md:p-8 rounded-2xl flex flex-col items-center max-w-[85%] w-[340px] text-center animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="w-16 h-16 rounded-full bg-[var(--surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center mb-4 text-[#eab308] shadow-inner relative z-10">
                          <Crown className="w-8 h-8 drop-shadow-md" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-wide mb-1 relative z-10">
                          {(() => {
                            if (timeoutStatus) return timeoutStatus.includes("Draw") ? "Draw" : timeoutStatus.includes("White") ? "White Won" : "Black Won";
                            const goGame = gameRef.current;
                            if (goGame.isCheckmate()) return goGame.turn() === "w" ? "Black Won" : "White Won";
                            if (goGame.isStalemate() || goGame.isThreefoldRepetition() || goGame.isInsufficientMaterial() || goGame.isDraw()) return "Draw";
                            return "Game Over";
                          })()}
                        </h2>
                        <p className="text-[14px] text-[var(--text-secondary)] font-medium mb-8 relative z-10">
                          {(() => {
                            if (timeoutStatus) return timeoutStatus.split('. ')[1] || timeoutStatus;
                            const goGame = gameRef.current;
                            if (goGame.isCheckmate()) return "by Checkmate";
                            if (goGame.isStalemate()) return "by Stalemate";
                            if (goGame.isThreefoldRepetition()) return "by Repetition";
                            if (goGame.isInsufficientMaterial()) return "by Insufficient Material";
                            if (goGame.isDraw()) return "by 50-move rule or agreement";
                            return "";
                          })()}
                        </p>

                        <div className="flex flex-col gap-3 w-full relative z-10">
                          <button
                            onClick={() => startGame(playerColor)}
                            className="w-full py-[14px] bg-[var(--cta-bg)] text-white font-bold rounded-xl hover:bg-[var(--cta-hover)] hover:scale-[1.02] shadow-[0_4px_14px_rgba(0,0,0,0.25)] transition-all duration-300 relative overflow-hidden group border border-white/10"
                          >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                              <RotateCcw className="w-[18px] h-[18px]" strokeWidth={2.5} />
                              Try Again
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:animate-[shimmer_1.5s_infinite]" />
                          </button>
                          <button
                            onClick={stopGame}
                            className="w-full flex items-center justify-center gap-2 py-[12px] text-[14.5px] text-[var(--text-secondary)] font-bold hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors border border-transparent hover:border-[var(--border)]"
                          >
                            <Settings className="w-4 h-4" />
                            Change Settings
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </BoardImage>
              </div>
            </div>

            {/* Bottom Bar (Player: User) */}
            {gameState !== "setup" && (
              <div className="w-full flex items-center justify-between mt-3 bg-[var(--surface)] px-2.5 py-1 rounded-xl border border-[var(--border)] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-[#444] to-[#222] border border-[#555] flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                    {isBotMatchMode ? <Bot className="w-4 h-4 text-white/90" /> : <User className="w-4 h-4 text-white/90" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[12px] text-[var(--text-primary)] tracking-wide">{bottomDisplayName}</span>
                    {bottomDisplaySubtitle ? <span className="text-[10px] text-[var(--text-muted)] font-medium">{bottomDisplaySubtitle}</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-0.5 min-h-[16px]">
                    {bottomCapturedPieceCodes.map((pieceCode, index) => (
                      <img
                        key={`${pieceCode}-${index}`}
                        src={`${pieceThemePath}/${pieceCode}.png`}
                        alt={pieceCode}
                        className="w-[14px] h-[14px] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                      />
                    ))}
                    {bottomMaterialLead > 0 ? (
                      <span className="ml-1 text-[11px] font-bold text-[var(--text-primary)]">+{bottomMaterialLead}</span>
                    ) : null}
                  </div>
                  <div className="px-2 py-0.5 bg-[var(--bg-alt)] border border-[var(--border-subtle)] rounded-lg font-mono font-bold text-[14px] text-[var(--text-primary)] shadow-inner w-[68px] text-center">
                    {formatClock(playerClockSeconds)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {hoverPreview ? (
          <div className="pointer-events-none fixed" style={{ left: hoverPreview.left, top: hoverPreview.top, zIndex: 999999 }}>
            <div className="shadow-2xl rounded-sm overflow-hidden bg-[var(--surface-alt)] border border-[var(--border)]">
              <MiniBoardPreview fen={hoverPreview.fen} boardTheme={boardTheme} pieceTheme={pieceTheme} />
            </div>
          </div>
        ) : null}

        {/* Settings Modal (Copied exactly from learn page but adjusted) */}
        {isSettingsOpen && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsSettingsOpen(false)}
          >
            <div 
              className="w-[1050px] max-w-[95vw] h-[720px] max-h-[90vh] bg-[var(--surface-alt)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden flex flex-row relative cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              
              <div className="w-[240px] md:w-[260px] bg-[var(--surface)] border-r border-[var(--border)] flex flex-col py-4 overflow-y-auto shrink-0 z-10 custom-scrollbar">
                <div className="px-5 mb-4">
                  <span className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">Settings</span>
                </div>
                <button 
                  onClick={() => setActiveCategory("board")}
                  className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${activeCategory === "board" ? "bg-[var(--surface-alt)] text-[var(--text-primary)] font-medium border-[var(--border-hover)] shadow-[-10px_0_20px_rgba(0,0,0,0.12)]" : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"}`}>
                  <LayoutGrid className="w-[18px] h-[18px]" />
                  <span className="text-[14px]">Board & Pieces</span>
                </button>
                <button 
                  onClick={() => setActiveCategory("gameplay")}
                  className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${activeCategory === "gameplay" ? "bg-[var(--surface-alt)] text-[var(--text-primary)] font-medium border-[var(--border-hover)] shadow-[-10px_0_20px_rgba(0,0,0,0.12)]" : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"}`}>
                  <Gamepad2 className="w-[18px] h-[18px]" />
                  <span className="text-[14px]">Gameplay</span>
                </button>
                <button 
                  onClick={() => setActiveCategory("engine")}
                  className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${activeCategory === "engine" ? "bg-[var(--surface-alt)] text-[var(--text-primary)] font-medium border-[var(--border-hover)] shadow-[-10px_0_20px_rgba(0,0,0,0.12)]" : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"}`}>
                  <Bot className="w-[18px] h-[18px]" />
                  <span className="text-[14px]">Engine</span>
                </button>
                <button 
                  onClick={() => setActiveCategory("interface")}
                  className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${activeCategory === "interface" ? "bg-[var(--surface-alt)] text-[var(--text-primary)] font-medium border-[var(--border-hover)] shadow-[-10px_0_20px_rgba(0,0,0,0.12)]" : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"}`}>
                  <Monitor className="w-[18px] h-[18px]" />
                  <span className="text-[14px]">Interface</span>
                </button>
              </div>

              <div className="flex-1 flex flex-col relative min-w-0 bg-[var(--bg)]">
                <div className="px-8 pt-6 pb-3 shrink-0">
                  <h2 className="text-[24px] font-bold text-[var(--text-primary)] mb-1 font-sans">
                    {activeCategory === "board" && "Board & Pieces"}
                    {activeCategory === "engine" && "Engine"}
                    {activeCategory === "gameplay" && "Gameplay"}
                    {activeCategory === "interface" && "Interface"}
                  </h2>
                  <p className="text-[var(--text-secondary)] text-[14px]">
                    {activeCategory === "board" && "Customize the look and feel of your chess set."}
                    {activeCategory === "engine" && "Configure Stockfish strength and analysis parameters."}
                    {activeCategory === "gameplay" && "Configure rules and preferences for your games."}
                    {activeCategory === "interface" && "Change platform language, sounds, and UI interactions."}
                  </p>
                  {preferencesLoading && (
                    <p className="text-[var(--text-muted)] text-[12px] mt-2">Loading saved preferences...</p>
                  )}
                  {preferencesError && (
                    <p className="text-[var(--error-text)] text-[12px] mt-2">{preferencesError}</p>
                  )}
                </div>

                {activeCategory === "engine" && (
                  <div className="flex-1 px-8 pb-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar pt-2">
                    {/* GAME REVIEW Section */}
                    <div>
                      <h3 className="text-[11px] font-bold tracking-widest text-[var(--text-muted)] uppercase mb-3 px-1">Game Review</h3>
                      <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-2">Bot Engine <InfoHint text="Full engine is stronger but heavier. Lite is faster and lighter." /></span>
                          <select
                            value={botEngineVariant}
                            onChange={(event) => setBotEngineVariant(event.target.value as EngineVariant)}
                            className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] min-w-[200px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]"
                          >
                            <option value="stockfish-18" disabled={!fullEngineAvailable}>Stockfish 18.1 NNUE (Full{fullEngineAvailable ? "" : " unavailable on this deploy"})</option>
                            <option value="stockfish-18-lite">Stockfish 18 Lite</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-2">Bot Strength Mode <InfoHint text="Choose one: Beginner (estimated sub-1320), Skill, or Elo-limited." /></span>
                          <select
                            value={strengthMode}
                            onChange={(event) => setStrengthMode(event.target.value as StrengthMode)}
                            className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] min-w-[200px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]"
                          >
                            <option value="beginner">Beginner (estimated)</option>
                            <option value="skill">Skill (0-20)</option>
                            <option value="elo">Elo-limited</option>
                          </select>
                        </div>
                        {strengthMode === "beginner" ? (
                          <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                            <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-1.5 shrink-0">Beginner Elo <span className="opacity-70 text-[12px]">(Est.)</span> <InfoHint text="Below 1320 is estimated by tuning Skill + fixed move time, not official UCI Elo." /></span>
                            <select
                              value={beginnerEloIndex}
                              onChange={(event) => setBeginnerEloIndex(Number(event.target.value))}
                              className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] min-w-[200px]"
                            >
                              {BEGINNER_ESTIMATED_ELOS.map((value, index) => (
                                <option key={`beginner-elo-${value}`} value={index}>Est. {value}</option>
                              ))}
                            </select>
                          </div>
                        ) : strengthMode === "skill" ? (
                          <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                            <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-2">Skill Level <InfoHint text="Lower values make weaker play. 20 is strongest." /></span>
                            <input
                              type="number"
                              value={skillLevel}
                              onChange={(event) => setSkillLevel(Math.max(0, Math.min(20, Number(event.target.value) || 0)))}
                              min="0"
                              max="20"
                              className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] w-[200px]"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                            <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-2">Target Elo <InfoHint text={`Engine intentionally limits strength. Valid range for both Stockfish 18 variants is ${ELO_MIN}-${ELO_MAX}.`} /></span>
                            <select
                              value={eloIndex}
                              onChange={(event) => setEloIndex(Number(event.target.value))}
                              className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] min-w-[200px]"
                            >
                              {ELOS.map((value, index) => (
                                <option key={`elo-mode-${value}`} value={index}>{value}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {strengthMode === "beginner" ? (
                          <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                            <span className="text-[14px] text-[var(--text-primary)]">Beginner Mapping</span>
                            <span className="text-[13px] text-[var(--text-secondary)]">Skill {beginnerEngineProfile.skillLevel}, {beginnerEngineProfile.fixedMoveTimeMs}ms/move</span>
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-2">Bot Time Mode <InfoHint text={strengthMode === "beginner" ? "Beginner mode forces fixed time based on your estimated Elo." : "Clock-managed uses game clocks. Fixed uses the same think time per move."} /></span>
                          <select
                            value={strengthMode === "beginner" ? "fixed" : botTimeMode}
                            onChange={(event) => setBotTimeMode(event.target.value as TimeMode)}
                            disabled={strengthMode === "beginner"}
                            className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] min-w-[200px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]"
                          >
                            <option value="clock">Clock-managed (recommended)</option>
                            <option value="fixed">Fixed per move</option>
                          </select>
                        </div>
                        {strengthMode !== "beginner" && botTimeMode === "fixed" ? (
                          <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                            <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-2">Fixed Move Time (ms) <InfoHint text="Used only in fixed mode. Higher values produce stronger but slower moves." /></span>
                            <input
                              type="number"
                              value={botFixedMoveTimeMs}
                              onChange={(event) => setBotFixedMoveTimeMs(Math.max(50, Number(event.target.value) || 1000))}
                              min="50"
                              max="120000"
                              className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] w-[200px]"
                            />
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-2">Review Depth Preset <InfoHint text="Controls analysis depth presets in review pane." /></span>
                          <select
                            value={analysisDepth <= 13 ? "fast" : analysisDepth <= 17 ? "standard" : "deep"}
                            onChange={(event) => {
                              const next = event.target.value;
                              if (next === "fast") setAnalysisDepth(13);
                              if (next === "standard") setAnalysisDepth(17);
                              if (next === "deep") setAnalysisDepth(20);
                            }}
                            className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] min-w-[200px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTUgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]"
                          >
                            <option value="fast">Fast (~1 sec, 3270 Rating)</option>
                            <option value="standard">Standard (~3 sec, 3500 Rating)</option>
                            <option value="deep">Deep (~10 sec, 3600 Rating)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* ANALYSIS Section */}
                    <div>
                      <h3 className="text-[11px] font-bold tracking-widest text-[var(--text-muted)] uppercase mb-3 px-1">Analysis</h3>
                      <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-2">Chess Engine <InfoHint text="Analysis engine variant used for eval bar and lines." /></span>
                          <select
                            value={analysisEngineVariant}
                            onChange={(event) => setAnalysisEngineVariant(event.target.value as EngineVariant)}
                            className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] min-w-[200px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]"
                          >
                            <option value="stockfish-18-lite">Stockfish 18 Lite (7MB download)</option>
                            <option value="stockfish-18" disabled={!fullEngineAvailable}>Stockfish 18.1 NNUE (Full{fullEngineAvailable ? "" : " unavailable on this deploy"})</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-2">Maximum Time <InfoHint text="Unlimited lets analysis run until stopped. Lower values cap analysis time." /></span>
                          <select
                            value={String(analysisMaxTimeSeconds)}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setAnalysisMaxTimeSeconds(value);
                            }}
                            className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] min-w-[200px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]"
                          >
                            <option value="0">Unlimited</option>
                            <option value="3">3 sec</option>
                            <option value="5">5 sec</option>
                            <option value="10">10 sec</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)]">Number of Lines</span>
                          <select
                            value={String(analysisMultiPv)}
                            onChange={(event) => setAnalysisMultiPv(Number(event.target.value))}
                            className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] min-w-[200px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]"
                          >
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)]">Threads</span>
                          <input
                            type="number"
                            value={analysisThreads}
                            onChange={(event) => setAnalysisThreads(Math.max(1, Math.min(32, Number(event.target.value) || 1)))}
                            min="1"
                            max="32"
                            className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] w-[200px]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeCategory === "gameplay" && (
                  <div className="flex-1 px-8 pb-8 overflow-y-auto custom-scrollbar pt-2">
                    <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Move Method</span>
                        <select
                          value={botPreferences.moveMethod}
                          onChange={(event) => updateBotPreferences({ moveMethod: event.target.value as typeof botPreferences.moveMethod })}
                          className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5"
                        >
                          <option value="drag">Drag only</option>
                          <option value="click">Click only</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Show Legal Moves</span>
                        <input type="checkbox" checked={botPreferences.showLegalMoves} onChange={(event) => updateBotPreferences({ showLegalMoves: event.target.checked })} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Move Confirmation</span>
                        <input type="checkbox" checked={botPreferences.moveConfirmation} onChange={(event) => updateBotPreferences({ moveConfirmation: event.target.checked })} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Auto Queen</span>
                        <input type="checkbox" checked={botPreferences.autoQueen} onChange={(event) => updateBotPreferences({ autoQueen: event.target.checked })} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Lock Board On Bot Turn</span>
                        <input type="checkbox" checked={botPreferences.boardLock} onChange={(event) => updateBotPreferences({ boardLock: event.target.checked })} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Low Time Warning</span>
                        <input type="checkbox" checked={botPreferences.lowTimeWarning} onChange={(event) => updateBotPreferences({ lowTimeWarning: event.target.checked })} />
                      </div>
                    </div>
                  </div>
                )}

                {activeCategory === "interface" && (
                  <div className="flex-1 px-8 pb-8 overflow-y-auto custom-scrollbar pt-2">
                    <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Board Orientation</span>
                        <select
                          value={botPreferences.boardOrientation}
                          onChange={(event) => updateBotPreferences({ boardOrientation: event.target.value as typeof botPreferences.boardOrientation })}
                          className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5"
                        >
                          <option value="auto">Auto</option>
                          <option value="white">White bottom</option>
                          <option value="black">Black bottom</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Sound Volume</span>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={botPreferences.masterVolume}
                            onChange={(event) => updateBotPreferences({ masterVolume: Number(event.target.value) })}
                          />
                          <span className="text-[12px] text-[var(--text-secondary)] w-9">{botPreferences.masterVolume}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeCategory === "board" && (
                  <div className="flex flex-col md:flex-row px-8 pb-8 pt-0 gap-8 h-[650px] max-h-[75vh] w-full">
                  <div className="w-full md:w-[55%] flex flex-col h-full min-h-0">
                    <div className="flex border-b border-[var(--border)] mb-4 shrink-0">
                      <button
                        onClick={() => setActiveSettingsTab("boards")}
                        className={`px-4 py-2 font-semibold text-[14px] transition-colors relative ${activeSettingsTab === "boards" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                      >
                        Boards
                        {activeSettingsTab === "boards" && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--border-hover)]" />}
                      </button>
                      <button
                        onClick={() => setActiveSettingsTab("pieces")}
                        className={`px-4 py-2 font-semibold text-[14px] transition-colors relative ${activeSettingsTab === "pieces" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                      >
                        Pieces
                        {activeSettingsTab === "pieces" && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--border-hover)]" />}
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                      {activeSettingsTab === "boards" && (
                        <div className="grid grid-cols-4 gap-4 px-2 py-3 pb-6">
                          {AVAILABLE_BOARD_THEMES.map((theme) => {
                            const isSelected = boardTheme === theme;
                            const bgImage = BOARD_THEME_ASSETS[theme] ?? `/boards/${theme}.png`;
                            return (
                              <button
                                key={theme}
                                onClick={() => {
                                  setBoardTheme(theme);
                                  playSound("move-self");
                                }}
                                className={`group relative flex flex-col gap-1.5 transition-all ${isSelected ? "z-10" : "z-0"}`}
                              >
                                <div className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${isSelected ? "border-[var(--border-hover)] scale-[1.05] shadow-[0_0_15px_rgba(0,0,0,0.25)]" : "border-transparent group-hover:border-[var(--border-hover)]"}`}>
                                  <BoardThumbnail src={bgImage} className="w-full h-full" />
                                  {isSelected && (
                                    <div className="absolute top-1 right-1 w-4 h-4 bg-[var(--text-primary)] rounded-full flex items-center justify-center z-20">
                                      <svg className="w-2.5 h-2.5 text-[var(--surface)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                  )}
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider font-bold truncate px-1 transition-colors ${isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"}`}>
                                  {theme.replace(/_/g, " ")}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {activeSettingsTab === "pieces" && (
                        <div className="grid grid-cols-4 gap-4 px-2 py-3 pb-6">
                          {AVAILABLE_PIECE_THEMES.map((theme) => {
                            const isSelected = pieceTheme === theme;
                            const knightSrc = `${PIECE_THEME_ASSETS[theme] ?? `/pieces/${theme}/150`}/wn.png`;
                            return (
                              <button
                                key={theme}
                                onClick={() => {
                                  setPieceTheme(theme);
                                  playSound("move-self");
                                }}
                                className={`group relative flex flex-col gap-1.5 transition-all ${isSelected ? "z-10" : "z-0"}`}
                              >
                                <div className={`relative aspect-square rounded-lg border-2 bg-[var(--skeleton)] flex items-center justify-center transition-all p-2 ${isSelected ? "border-[var(--border-hover)] scale-[1.05] shadow-[0_0_15px_rgba(0,0,0,0.25)]" : "border-transparent group-hover:border-[var(--border-hover)] group-hover:bg-[var(--skeleton-soft)]"}`}>
                                  <PieceThumbnail src={knightSrc} alt={theme} />
                                  {isSelected && (
                                    <div className="absolute top-1 right-1 w-4 h-4 bg-[var(--text-primary)] rounded-full flex items-center justify-center z-10">
                                      <svg className="w-2.5 h-2.5 text-[var(--surface)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                  )}
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider font-bold truncate px-1 transition-colors ${isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"}`}>
                                  {theme.replace(/_/g, " ")}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full md:w-[45%] flex flex-col items-center justify-start rounded-xl p-0 relative shrink-0">
                    <div className="w-full aspect-square relative shadow-xl rounded-sm overflow-hidden border border-[var(--border)]">
                      <BoardImage src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`} className="w-full h-full">
                       <div className="w-full h-full grid grid-cols-3 grid-rows-3 relative">
                         {Array.from({length: 9}).map((_, i) => {
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
                                   skeletonClassName="w-[45%] h-[45%]"
                                 />
                               )}
                             </div>
                           );
                         })}
                       </div>
                      </BoardImage>
                    </div>
                    
                    <div className="mt-8 w-full flex items-center justify-start gap-4">
                      <label className="relative inline-flex items-center cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={soundEnabled} 
                          onChange={(e) => {
                            setSoundEnabled(e.target.checked);
                            if (e.target.checked) playSound("move-self", true);
                          }} 
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-[var(--skeleton)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--border)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-muted)] after:border border-[var(--border)] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--border-hover)] peer-checked:after:bg-[var(--surface)] group-hover:after:scale-[1.05]"></div>
                        <span className="ml-3 text-[14px] text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)] transition-colors">Enable Sounds</span>
                      </label>
                    </div>
                  </div>
                </div>
                )}

                <div className="mt-auto bg-[var(--surface-alt)] px-8 py-5 flex items-center justify-end border-t border-[var(--border)] w-full shrink-0">
                  <button 
                    onClick={() => savePreferences().catch(() => {})}
                    disabled={preferencesSaving || preferencesLoading}
                    className="px-8 py-2.5 bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] text-[var(--cta-text)] font-bold rounded-lg transition-colors shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {preferencesSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
