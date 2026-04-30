"use client";

import type { DragEvent, MouseEvent } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowLeft, Settings, Play, Pause, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Monitor, User, Gamepad2, GraduationCap, Bell, CreditCard, Accessibility, LayoutGrid, Users, Sun, Moon, MoreHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import themeManifest from "@/data/themeManifest.json";
import { useStockfishAnalysis } from "./use-stockfish-analysis";
import { useTorchStatus } from "./use-torch-status";
import OpeningLoading from "./loading";
import { useTheme } from "@/lib/theme-context";
import {
  DEFAULT_CLIENT_PREFERENCES,
  loadClientPreferences,
  saveClientPreferences,
  type OpeningVariationSortMode,
  type LearnOpeningProgress,
} from "@/lib/client-preferences";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const DEFAULT_FEN = new Chess().fen();
const AVAILABLE_BOARD_THEMES = themeManifest.boardThemes;
const AVAILABLE_PIECE_THEMES = themeManifest.pieceThemes;
const BOARD_THEME_ASSETS = themeManifest.boardAssets as Record<string, string>;
const PIECE_THEME_ASSETS = themeManifest.pieceAssets as Record<string, string>;

type SerializableMove = {
  from: Square;
  to: Square;
  san: string;
  isCheck: boolean;
  isCapture: boolean;
  isCastle: boolean;
  isPromotion: boolean;
};

type QueuedPremove = {
  from: Square;
  to: Square;
  promotion?: "q" | "r" | "b" | "n";
};

const formatOpeningTitle = (slug: string) =>
  slug
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

type OpeningApiPayload = {
  slug: string;
  name: string;
  eco: string;
  openingStats: {
    source: string;
    sampleSizeGames: number;
    whiteWinPct: number;
    drawPct: number;
    blackWinPct: number;
    avgPlayerRating: number | null;
    perfRating: number | null;
    popularitySharePct: number | null;
    lastPlayed: string | null;
    rowCount: number;
    matchType?: "exact-name" | "root-name";
  } | null;
  variationCount: number;
  mainLine: {
    id: string;
    pgn: string;
    priority: number;
    sources: string[];
    stats: {
      source: string;
      sampleSizeGames: number;
      whiteWinPct: number;
      drawPct: number;
      blackWinPct: number;
      avgPlayerRating: number | null;
      perfRating: number | null;
      popularitySharePct: number | null;
      lastPlayed: string | null;
      rowCount: number;
      matchType?: "exact-name" | "root-name";
    } | null;
  };
  mainLineMovePopularity: Array<{
    ply: number;
    fen: string;
    playedSan: string;
    playedPct: number | null;
    totalGames: number | null;
    topMoves: Array<{
      san: string;
      pct: number;
      games: number;
    }>;
  }>;
  variations: Array<{
    id: string;
    eco: string;
    name: string;
    pgn: string;
    priority: number;
    sources: string[];
    triggerMoveSan: string | null;
    triggerMoveGlobalPopularity: {
      san: string;
      pct: number;
      games: number;
      totalGames: number;
    } | null;
    linePopularity: {
      sampleSizeGames: number;
      sharePct: number;
    } | null;
    stats: {
      source: string;
      sampleSizeGames: number;
      whiteWinPct: number;
      drawPct: number;
      blackWinPct: number;
      avgPlayerRating: number | null;
      perfRating: number | null;
      popularitySharePct: number | null;
      lastPlayed: string | null;
      rowCount: number;
      matchType?: "exact-name" | "root-name";
    } | null;
  }>;
};

type BranchVariation = {
  id: string;
  name: string;
  pgn: string;
  continuation: string;
  sanHistory: string[];
  triggerMoveSan: string | null;
  triggerMoveGlobalPopularity: {
    san: string;
    pct: number;
    games: number;
    totalGames: number;
  } | null;
  linePopularity: {
    sampleSizeGames: number;
    sharePct: number;
  } | null;
};

const SAN_RESULT_TOKENS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);
const TRAINER_USER_COLOR: "w" | "b" = "w";
const VARIATIONS_PAGE_SIZE = 8;
type VariationSortMode = OpeningVariationSortMode;

const normalizeSan = (san: string) => san.replace(/[+#?!]+/g, "").trim();

const isSanPrefixMatch = (left: string[], right: string[]) =>
  left.every((move, index) => normalizeSan(move) === normalizeSan(right[index] ?? ""));

const buildHistoryFromPgn = (pgn: string) => {
  const tokens = pgn
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\d+\.(\.\.\.)?/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !SAN_RESULT_TOKENS.has(token));

  const game = new Chess();
  const history = [game.fen()];
  const sanHistory: string[] = [];

  for (const token of tokens) {
    const move = game.move(token);
    if (!move) {
      break;
    }

    sanHistory.push(move.san);
    history.push(game.fen());
  }

  return {
    history,
    sanHistory,
    soundHistory: ["game-start", ...sanHistory.map(() => "move-self")],
  };
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
  if (!code) {
    return null;
  }

  return (
    <PieceImage 
      src={`${PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`}/${code}.png`} 
      alt={code} 
    />
  );
};

const getPositionStatus = (game: Chess) => {
  const sideToMove = game.turn() === "w" ? "White" : "Black";

  if (game.isCheckmate()) {
    return `${sideToMove} is checkmated.`;
  }

  if (game.isStalemate()) {
    return "Draw by stalemate.";
  }

  if (game.isInsufficientMaterial()) {
    return "Draw by insufficient material.";
  }

  if (game.isThreefoldRepetition()) {
    return "Draw by repetition.";
  }

  if (game.isDraw()) {
    return "Drawn position.";
  }

  if (game.isCheck()) {
    return `${sideToMove} to move and in check.`;
  }

  return `${sideToMove} to move.`;
};

type AnalysisStrength = "fast" | "standard" | "deep" | "maximum";
type AnalysisEngineChoice = "stockfish-18" | "stockfish-18-lite" | "torch-4" | "torch-4-lite" | "off";

const ANALYSIS_PRESET_TO_DEPTH: Record<AnalysisStrength, number> = {
  fast: 13,
  standard: 17,
  deep: 20,
  maximum: 22,
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
    <div className="w-[170px] rounded-md border border-[var(--border-subtle)] bg-[var(--surface-alt)] p-2 shadow-2xl">
      <div className="relative aspect-square overflow-hidden rounded-sm border border-[var(--border)]">
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

export default function OpeningPage() {
  const pathname = usePathname();
  const openingSlug = decodeURIComponent(pathname.split("/").pop() ?? "");

  const [boardTheme, setBoardTheme] = useState(themeManifest.defaultBoardTheme);
  const [pieceTheme, setPieceTheme] = useState(themeManifest.defaultPieceTheme);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"boards" | "pieces" | "engine" | "gameplay">("boards");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fen, setFen] = useState(DEFAULT_FEN);
  const [history, setHistory] = useState<string[]>([DEFAULT_FEN]);
  const [sanHistory, setSanHistory] = useState<string[]>([]);
  const [soundHistory, setSoundHistory] = useState<string[]>(["game-start"]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBoardFlipped, setIsBoardFlipped] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [draggedSquare, setDraggedSquare] = useState<Square | null>(null);
  const [dragOverSquare, setDragOverSquare] = useState<Square | null>(null);
  const [queuedPremoves, setQueuedPremoves] = useState<QueuedPremove[]>([]);
  const [lastMove, setLastMove] = useState<SerializableMove | null>(null);
  const [rightClickHighlights, setRightClickHighlights] = useState<Set<Square>>(new Set());
  const [rightClickArrows, setRightClickArrows] = useState<{ start: Square; end: Square }[]>([]);
  const [rightClickStartSquare, setRightClickStartSquare] = useState<Square | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [isAnalysisMenuOpen, setIsAnalysisMenuOpen] = useState(false);
  const [showAnalysisSection, setShowAnalysisSection] = useState(true);
  const [showEvaluationBar, setShowEvaluationBar] = useState(true);
  const [showEngineLines, setShowEngineLines] = useState(true);
  const [showSuggestionArrow, setShowSuggestionArrow] = useState(false);
  const [showMoveFeedback, setShowMoveFeedback] = useState(false);
  const [analysisStrength, setAnalysisStrength] = useState<AnalysisStrength>("standard");
  const [analysisEngineChoice, setAnalysisEngineChoice] = useState<AnalysisEngineChoice>("stockfish-18");
  const [analysisMaxTimeSeconds, setAnalysisMaxTimeSeconds] = useState(5);
  const [analysisMultiPv, setAnalysisMultiPv] = useState(3);
  const [analysisThreads, setAnalysisThreads] = useState(1);
  const [analysisDepth, setAnalysisDepth] = useState(ANALYSIS_PRESET_TO_DEPTH.standard);
  const [expandedEngineLineIds, setExpandedEngineLineIds] = useState<Record<number, boolean>>({});
  const [hoverPreview, setHoverPreview] = useState<{ fen: string; left: number; top: number } | null>(null);
  const [clientPreferences, setClientPreferences] = useState(DEFAULT_CLIENT_PREFERENCES);
  const [openingData, setOpeningData] = useState<OpeningApiPayload | null>(null);
  const [openingLoading, setOpeningLoading] = useState(true);
  const [openingError, setOpeningError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [trainerHint, setTrainerHint] = useState<string | null>(null);
  const [variationQuery, setVariationQuery] = useState("");
  const [variationSortMode, setVariationSortMode] = useState<VariationSortMode>("popularity");
  const [variationVisibleCount, setVariationVisibleCount] = useState(VARIATIONS_PAGE_SIZE);
  const [branchAttemptStats, setBranchAttemptStats] = useState<{ lineId: string; correct: number; wrong: number } | null>(null);
  const autoMoveTriggerKeyRef = useRef<string>("");
  const branchCompletionTriggerRef = useRef<string>("");

  const formattedTitle = openingData?.name ?? formatOpeningTitle(openingSlug.replace(/-/g, " "));
  const learnPreferences = clientPreferences.learn;
  const openingProgressSlug = openingData?.slug ?? openingSlug;
  const openingProgress = learnPreferences.openingProgressBySlug[openingProgressSlug] ?? null;
  const variationProgressById = openingProgress?.variations ?? {};
  const updateOpeningProgress = useCallback((updater: (current: LearnOpeningProgress) => LearnOpeningProgress) => {
    setClientPreferences((previous) => {
      const currentOpeningProgress = previous.learn.openingProgressBySlug[openingProgressSlug] ?? {
        lastPracticedLineId: null,
        lastPracticedAt: "",
        variations: {},
      };
      const nextOpeningProgress = updater(currentOpeningProgress);
      const nextPreferences = {
        ...previous,
        learn: {
          ...previous.learn,
          openingProgressBySlug: {
            ...previous.learn.openingProgressBySlug,
            [openingProgressSlug]: nextOpeningProgress,
          },
        },
      };

      saveClientPreferences(nextPreferences);
      return nextPreferences;
    });
  }, [openingProgressSlug]);

  const updateLearnPreferences = (updates: Partial<typeof learnPreferences>) => {
    setClientPreferences((previous) => ({
      ...previous,
      learn: {
        ...previous.learn,
        ...updates,
      },
    }));
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      if (currentMoveIndex < history.length - 1) {
        const nextIndex = currentMoveIndex + 1;
        timer = setTimeout(() => {
          const sound = soundHistory[nextIndex] || "move-self";
          playSound(sound);
          setFen(history[nextIndex]);
          setCurrentMoveIndex(nextIndex);
        }, 1000);
      } else {
        setIsPlaying(false);
      }
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentMoveIndex, history, soundEnabled, soundHistory]);

  useEffect(() => {
    let cancelled = false;

    const loadOpening = async () => {
      if (!openingSlug) {
        if (!cancelled) {
          setOpeningLoading(false);
          setOpeningError("Opening slug is missing.");
        }
        return;
      }

      try {
        const response = await fetch(`/api/openings/${encodeURIComponent(openingSlug)}`);
        if (!response.ok) {
          if (!cancelled) {
            setOpeningError("Opening not found in opening database.");
          }
          return;
        }

        const payload = (await response.json()) as OpeningApiPayload;
        if (!cancelled) {
          setOpeningData(payload);
          setOpeningError(null);
        }
      } catch {
        if (!cancelled) {
          setOpeningError("Failed to load opening data.");
        }
      } finally {
        if (!cancelled) {
          setOpeningLoading(false);
        }
      }
    };

    setOpeningLoading(true);
    setOpeningError(null);
    setOpeningData(null);
    loadOpening().catch(() => {
      if (!cancelled) {
        setOpeningLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [openingSlug]);

  useEffect(() => {
    if (!openingData?.mainLine?.pgn) {
      return;
    }

    const firstRequiredMove = buildHistoryFromPgn(openingData.mainLine.pgn).sanHistory[0] ?? null;

    setHistory([DEFAULT_FEN]);
    setSanHistory([]);
    setSoundHistory(["game-start"]);
    setCurrentMoveIndex(0);
    setFen(DEFAULT_FEN);
    setSelectedLineId(openingData.mainLine.id);
    setTrainerHint(firstRequiredMove ? `Required move: ${firstRequiredMove}` : null);
    setIsPlaying(false);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setDragOverSquare(null);
    setQueuedPremoves([]);
    setLastMove(null);
    setRightClickHighlights(new Set());
    setRightClickArrows([]);
    setVariationQuery("");
    setVariationVisibleCount(VARIATIONS_PAGE_SIZE);
    setBranchAttemptStats(null);
    branchCompletionTriggerRef.current = "";
  }, [openingData?.mainLine?.pgn]);

  const applyOpeningLine = (lineId: string, pgn: string, startMoveIndex?: number, lineName?: string) => {
    const seeded = buildHistoryFromPgn(pgn);
    const boundedMoveIndex = Math.max(0, Math.min(startMoveIndex ?? (seeded.history.length - 1), seeded.history.length - 1));
    const nextExpectedMove = seeded.sanHistory[boundedMoveIndex] ?? null;
    const isBranchLine = lineId !== openingData?.mainLine.id;
    if (isBranchLine) {
      const timestamp = new Date().toISOString();
      updateOpeningProgress((current) => ({
        ...current,
        lastPracticedLineId: lineId,
        lastPracticedAt: timestamp,
      }));
      setBranchAttemptStats({ lineId, correct: 0, wrong: 0 });
      branchCompletionTriggerRef.current = "";
    } else {
      setBranchAttemptStats(null);
      branchCompletionTriggerRef.current = "";
    }
    setHistory(seeded.history);
    setSanHistory(seeded.sanHistory);
    setSoundHistory(seeded.soundHistory);
    setCurrentMoveIndex(boundedMoveIndex);
    setFen(seeded.history[boundedMoveIndex] ?? DEFAULT_FEN);
    setSelectedLineId(lineId);
    setTrainerHint(nextExpectedMove ? `Required move: ${nextExpectedMove}` : lineName ? `${lineName} loaded.` : null);
    setIsPlaying(false);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setDragOverSquare(null);
    setQueuedPremoves([]);
    setLastMove(null);
    setRightClickHighlights(new Set());
    setRightClickArrows([]);
  };

  const playedSanMoves = sanHistory.slice(0, Math.max(0, currentMoveIndex));
  const mainLinePreview = useMemo(
    () => (openingData?.mainLine?.pgn ? buildHistoryFromPgn(openingData.mainLine.pgn) : null),
    [openingData?.mainLine?.pgn],
  );
  const mainLineSan = mainLinePreview?.sanHistory ?? [];
  const matchedMainLinePlies = useMemo(() => {
    let count = 0;
    const maxComparablePlies = Math.min(mainLineSan.length, playedSanMoves.length);

    while (
      count < maxComparablePlies &&
      normalizeSan(mainLineSan[count] ?? "") === normalizeSan(playedSanMoves[count] ?? "")
    ) {
      count += 1;
    }

    return count;
  }, [mainLineSan, playedSanMoves]);
  const isMainLineComplete = mainLineSan.length > 0 && matchedMainLinePlies >= mainLineSan.length;

  const allBranchVariations = useMemo(() => {
    if (!openingData || !isMainLineComplete) {
      return [] as BranchVariation[];
    }

    return openingData.variations
      .filter((line) => line.id !== openingData.mainLine.id)
      .map((line) => {
        const parsed = buildHistoryFromPgn(line.pgn);
        if (!isSanPrefixMatch(mainLineSan, parsed.sanHistory)) {
          return null;
        }

        const continuationMoves = parsed.sanHistory.slice(mainLineSan.length);
        if (continuationMoves.length === 0) {
          return null;
        }

        const shortName = line.name.startsWith(`${openingData.name}:`)
          ? line.name.slice(openingData.name.length + 1).trim()
          : line.name;

        return {
          id: line.id,
          name: shortName || "Branch variation",
          pgn: line.pgn,
          continuation: continuationMoves.slice(0, 6).join(" "),
          sanHistory: parsed.sanHistory,
          triggerMoveSan: line.triggerMoveSan,
          triggerMoveGlobalPopularity: line.triggerMoveGlobalPopularity,
          linePopularity: line.linePopularity,
        };
      })
      .filter((line): line is BranchVariation => Boolean(line));
  }, [openingData, isMainLineComplete, mainLineSan]);

  const selectedBranchVariation = useMemo(
    () => allBranchVariations.find((line) => line.id === selectedLineId) ?? null,
    [allBranchVariations, selectedLineId],
  );
  const activeLineSan = selectedBranchVariation?.sanHistory ?? mainLineSan;
  const isFollowingActiveLine = isSanPrefixMatch(playedSanMoves, activeLineSan);
  const isActiveLineComplete = isFollowingActiveLine && playedSanMoves.length >= activeLineSan.length && activeLineSan.length > 0;
  const expectedTrainerMove = !isActiveLineComplete ? activeLineSan[playedSanMoves.length] ?? null : null;
  const expectedTrainerLegalMove = useMemo(() => {
    if (!expectedTrainerMove) {
      return null;
    }

    const expectedBoard = new Chess(fen);
    return expectedBoard
      .moves({ verbose: true })
      .find((move) => normalizeSan(move.san) === normalizeSan(expectedTrainerMove)) ?? null;
  }, [expectedTrainerMove, fen]);
  const isBranchMode = Boolean(selectedBranchVariation);
  const isBranchComplete = isBranchMode && isActiveLineComplete;
  const selectedBranchContinuationLength = selectedBranchVariation
    ? Math.max(0, selectedBranchVariation.sanHistory.length - mainLineSan.length)
    : 0;
  const selectedBranchProgress = selectedBranchVariation
    ? Math.max(
      0,
      Math.min(playedSanMoves.length, selectedBranchVariation.sanHistory.length) - mainLineSan.length,
    )
    : 0;
  const progressRankedBranchVariations = useMemo(() => {
    return [...allBranchVariations].sort((left, right) => {
      const leftProgress = variationProgressById[left.id];
      const rightProgress = variationProgressById[right.id];
      const leftIsNew = (leftProgress?.completions ?? 0) === 0 ? 0 : 1;
      const rightIsNew = (rightProgress?.completions ?? 0) === 0 ? 0 : 1;
      if (leftIsNew !== rightIsNew) {
        return leftIsNew - rightIsNew;
      }

      const leftAccuracy = leftProgress?.bestAccuracy ?? 0;
      const rightAccuracy = rightProgress?.bestAccuracy ?? 0;
      if (leftAccuracy !== rightAccuracy) {
        return leftAccuracy - rightAccuracy;
      }

      const leftLast = leftProgress?.lastPracticedAt ? Date.parse(leftProgress.lastPracticedAt) : -1;
      const rightLast = rightProgress?.lastPracticedAt ? Date.parse(rightProgress.lastPracticedAt) : -1;
      if (leftLast !== rightLast) {
        return leftLast - rightLast;
      }

      const leftAttempts = leftProgress?.attempts ?? 0;
      const rightAttempts = rightProgress?.attempts ?? 0;
      if (leftAttempts !== rightAttempts) {
        return leftAttempts - rightAttempts;
      }

      return left.name.localeCompare(right.name);
    });
  }, [allBranchVariations, variationProgressById]);

  const popularityRankedBranchVariations = useMemo(() => {
    return [...allBranchVariations].sort((left, right) => {
      const leftShare = left.linePopularity?.sharePct ?? -1;
      const rightShare = right.linePopularity?.sharePct ?? -1;
      if (leftShare !== rightShare) {
        return rightShare - leftShare;
      }

      const leftGames = left.linePopularity?.sampleSizeGames ?? 0;
      const rightGames = right.linePopularity?.sampleSizeGames ?? 0;
      if (leftGames !== rightGames) {
        return rightGames - leftGames;
      }

      const leftTriggerPct = left.triggerMoveGlobalPopularity?.pct ?? -1;
      const rightTriggerPct = right.triggerMoveGlobalPopularity?.pct ?? -1;
      if (leftTriggerPct !== rightTriggerPct) {
        return rightTriggerPct - leftTriggerPct;
      }

      return left.name.localeCompare(right.name);
    });
  }, [allBranchVariations]);

  const sortedBranchVariations = useMemo(
    () => (variationSortMode === "progress" ? progressRankedBranchVariations : popularityRankedBranchVariations),
    [variationSortMode, progressRankedBranchVariations, popularityRankedBranchVariations],
  );

  const filteredBranchVariations = useMemo(() => {
    const query = variationQuery.trim().toLowerCase();
    if (!query) {
      return sortedBranchVariations;
    }

    return sortedBranchVariations.filter((line) =>
      line.name.toLowerCase().includes(query) ||
      line.continuation.toLowerCase().includes(query),
    );
  }, [sortedBranchVariations, variationQuery]);
  const visibleBranchVariations = useMemo(
    () => filteredBranchVariations.slice(0, variationVisibleCount),
    [filteredBranchVariations, variationVisibleCount],
  );
  const hasMoreVariations = filteredBranchVariations.length > visibleBranchVariations.length;

  const recommendedNextBranch = useMemo(() => {
    if (progressRankedBranchVariations.length === 0) {
      return null;
    }

    const candidates = progressRankedBranchVariations.filter((line) => line.id !== selectedBranchVariation?.id);
    return candidates[0] ?? null;
  }, [progressRankedBranchVariations, selectedBranchVariation]);

  useEffect(() => {
    setVariationVisibleCount(VARIATIONS_PAGE_SIZE);
  }, [variationQuery, variationSortMode]);

  useEffect(() => {
    if (!selectedBranchVariation || !isBranchComplete) {
      if (!selectedBranchVariation) {
        branchCompletionTriggerRef.current = "";
      }
      return;
    }

    const attemptStats = branchAttemptStats?.lineId === selectedBranchVariation.id
      ? branchAttemptStats
      : { lineId: selectedBranchVariation.id, correct: 0, wrong: 0 };
    const totalAttemptedMoves = attemptStats.correct + attemptStats.wrong;
    const accuracy = totalAttemptedMoves === 0
      ? 100
      : Math.round((attemptStats.correct / totalAttemptedMoves) * 100);
    const completionKey = `${selectedBranchVariation.id}:${attemptStats.correct}:${attemptStats.wrong}:${playedSanMoves.length}`;

    if (branchCompletionTriggerRef.current === completionKey) {
      return;
    }
    branchCompletionTriggerRef.current = completionKey;

    const completedName = selectedBranchVariation.name;
    const completedLineId = selectedBranchVariation.id;
    const timestamp = new Date().toISOString();
    updateOpeningProgress((current) => {
      const previousVariation = current.variations[completedLineId] ?? {
        attempts: 0,
        completions: 0,
        bestAccuracy: 0,
        lastAccuracy: 0,
        lastPracticedAt: "",
      };

      return {
        ...current,
        lastPracticedLineId: completedLineId,
        lastPracticedAt: timestamp,
        variations: {
          ...current.variations,
          [completedLineId]: {
            attempts: previousVariation.attempts + 1,
            completions: previousVariation.completions + 1,
            bestAccuracy: Math.max(previousVariation.bestAccuracy, accuracy),
            lastAccuracy: accuracy,
            lastPracticedAt: timestamp,
          },
        },
      };
    });
    setTrainerHint(`Completed ${completedName} (${accuracy}% accuracy).`);
  }, [
    branchAttemptStats,
    isBranchComplete,
    playedSanMoves.length,
    selectedBranchVariation,
    updateOpeningProgress,
  ]);

  const game = new Chess(fen);
  const isUserTurnInTrainer = game.turn() === TRAINER_USER_COLOR;
  const canUsePremoves = learnPreferences.premoveEnabled && currentMoveIndex === history.length - 1 && !game.isGameOver();
  const isPremoveTurn = canUsePremoves && !isUserTurnInTrainer;
  const legalTargets = selectedSquare
    ? isPremoveTurn
      ? []
      : expectedTrainerLegalMove
      ? selectedSquare === expectedTrainerLegalMove.from
        ? [expectedTrainerLegalMove.to]
        : []
      : game.moves({ square: selectedSquare, verbose: true }).map((move) => move.to)
    : [];
  const boardState = game.board().map((row) => row.map((piece) => getPieceCode(piece)));
  const statusText = getPositionStatus(game);
  const isEngineEnabled = analysisEngineChoice !== "off";
  const stockfishVariant = analysisEngineChoice === "stockfish-18" ? "stockfish-18" : "stockfish-18-lite";
  const analysisModelLabel = !isEngineEnabled
    ? "Engine-Off"
    : stockfishVariant === "stockfish-18"
      ? "Stockfish-18"
      : "Stockfish-18-Lite";
  const analysis = useStockfishAnalysis(
    fen,
    isEngineEnabled,
    analysisDepth,
    analysisMultiPv,
    analysisThreads,
    stockfishVariant,
  );
  const { status: torchStatus, loading: torchLoading } = useTorchStatus();
  const clearQueuedPremoves = useCallback(() => {
    setQueuedPremoves([]);
  }, []);
  const validateQueuedLearnPremoves = useCallback((moves: QueuedPremove[]) => {
    const preview = new Chess(fen);
    let sanIndex = playedSanMoves.length;

    for (const queuedMove of moves) {
      while (preview.turn() !== TRAINER_USER_COLOR) {
        const expectedAutoSan = activeLineSan[sanIndex] ?? null;
        if (!expectedAutoSan) {
          return false;
        }

        const autoMove = preview
          .moves({ verbose: true })
          .find((candidate) => normalizeSan(candidate.san) === normalizeSan(expectedAutoSan));

        if (!autoMove) {
          return false;
        }

        preview.move({ from: autoMove.from, to: autoMove.to, promotion: autoMove.promotion });
        sanIndex += 1;
      }

      const legalMove = preview
        .moves({ verbose: true })
        .find((candidate) => candidate.from === queuedMove.from && candidate.to === queuedMove.to);

      if (!legalMove) {
        return false;
      }

      const expectedUserSan = activeLineSan[sanIndex] ?? null;
      if (expectedUserSan && normalizeSan(legalMove.san) !== normalizeSan(expectedUserSan)) {
        return false;
      }

      preview.move({ from: legalMove.from, to: legalMove.to, promotion: legalMove.promotion });
      sanIndex += 1;
    }

    return true;
  }, [activeLineSan, fen, playedSanMoves.length]);

  useEffect(() => {
    const loaded = loadClientPreferences();
    setClientPreferences(loaded);
    setAnalysisDepth(loaded.learn.engineDepth);
    setIsBoardFlipped(loaded.learn.boardOrientation === "black");
    setVariationSortMode(loaded.learn.openingVariationSortMode);
  }, []);

  useEffect(() => {
    if (!learnPreferences.premoveEnabled && queuedPremoves.length > 0) {
      setQueuedPremoves([]);
    }
  }, [learnPreferences.premoveEnabled, queuedPremoves.length]);

  const setVariationSortModePreference = useCallback((mode: VariationSortMode) => {
    setVariationSortMode(mode);
    setClientPreferences((previous) => {
      if (previous.learn.openingVariationSortMode === mode) {
        return previous;
      }

      const nextPreferences = {
        ...previous,
        learn: {
          ...previous.learn,
          openingVariationSortMode: mode,
        },
      };

      saveClientPreferences(nextPreferences);
      return nextPreferences;
    });
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/preferences", { method: "GET" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          boardTheme?: string;
          pieceTheme?: string;
          soundEnabled?: boolean;
        };

        if (isCancelled) {
          return;
        }

        if (typeof data.boardTheme === "string") {
          setBoardTheme(data.boardTheme);
        }

        if (typeof data.pieceTheme === "string") {
          setPieceTheme(data.pieceTheme);
        }

        if (typeof data.soundEnabled === "boolean") {
          setSoundEnabled(data.soundEnabled);
        }
      } finally {
        if (!isCancelled) {
          setPreferencesLoading(false);
        }
      }
    };

    loadPreferences().catch(() => {
      if (!isCancelled) {
        setPreferencesLoading(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    setAnalysisDepth(ANALYSIS_PRESET_TO_DEPTH[analysisStrength]);
    setAnalysisMaxTimeSeconds(
      analysisStrength === "fast" ? 1 : analysisStrength === "standard" ? 5 : analysisStrength === "deep" ? 20 : 90,
    );
  }, [analysisStrength]);

  useEffect(() => {
    if (!analysis.error) {
      return;
    }

    if (analysisEngineChoice === "stockfish-18") {
      setAnalysisEngineChoice("stockfish-18-lite");
    }
  }, [analysis.error, analysisEngineChoice]);

  const playSound = (name: string) => {
    if (!soundEnabled) {
      return;
    }
    const audio = new Audio(`/sounds/${name}.mp3`);
    audio.volume = Math.min(1, Math.max(0, learnPreferences.masterVolume / 100));
    audio.play().catch(() => {});
  };

  const resetBoard = () => {
    setFen(DEFAULT_FEN);
    setHistory([DEFAULT_FEN]);
    setSanHistory([]);
    setSoundHistory(["game-start"]);
    setCurrentMoveIndex(0);
    setIsPlaying(false);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setDragOverSquare(null);
    setQueuedPremoves([]);
    setLastMove(null);
    setSelectedLineId(openingData?.mainLine.id ?? null);
    setTrainerHint(mainLineSan[0] ? `Required move: ${mainLineSan[0]}` : null);
    setVariationQuery("");
    setVariationVisibleCount(VARIATIONS_PAGE_SIZE);
    setBranchAttemptStats(null);
    branchCompletionTriggerRef.current = "";
    playSound("game-start");
  };

  const skipBaseLine = () => {
    if (!mainLinePreview || !openingData?.mainLine.id) {
      return;
    }

    setHistory(mainLinePreview.history);
    setSanHistory(mainLinePreview.sanHistory);
    setSoundHistory(mainLinePreview.soundHistory);
    const lastIndex = mainLinePreview.history.length - 1;
    setCurrentMoveIndex(lastIndex);
    setFen(mainLinePreview.history[lastIndex] ?? DEFAULT_FEN);
    setSelectedLineId(openingData.mainLine.id);
    setTrainerHint(null);
    setIsPlaying(false);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setDragOverSquare(null);
    setQueuedPremoves([]);
    setLastMove(null);
    setRightClickHighlights(new Set());
    setRightClickArrows([]);
    setVariationQuery("");
    setVariationVisibleCount(VARIATIONS_PAGE_SIZE);
    setBranchAttemptStats(null);
    branchCompletionTriggerRef.current = "";
  };

  const goToStart = () => {
    setFen(history[0]);
    setCurrentMoveIndex(0);
    setIsPlaying(false);
    playSound("game-start");
  };

  const goToPrev = () => {
    if (currentMoveIndex > 0) {
      if (soundEnabled && soundHistory[currentMoveIndex]) {
        playSound(soundHistory[currentMoveIndex]);
      }
      setFen(history[currentMoveIndex - 1]);
      setCurrentMoveIndex(currentMoveIndex - 1);
      setIsPlaying(false);
    }
  };

  const goToNext = () => {
    if (currentMoveIndex < history.length - 1) {
      if (soundEnabled && soundHistory[currentMoveIndex + 1]) {
        playSound(soundHistory[currentMoveIndex + 1]);
      }
      setFen(history[currentMoveIndex + 1]);
      setCurrentMoveIndex(currentMoveIndex + 1);
      setIsPlaying(false);
    }
  };

  const goToEnd = () => {
    const lastIndex = history.length - 1;
    if (soundEnabled && soundHistory[lastIndex]) {
      playSound(soundHistory[lastIndex]);
    }
    setFen(history[lastIndex]);
    setCurrentMoveIndex(lastIndex);
    setIsPlaying(false);
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const updateBranchAttempt = (field: "correct" | "wrong") => {
    if (!selectedBranchVariation) {
      return;
    }

    setBranchAttemptStats((previous) => {
      if (!previous || previous.lineId !== selectedBranchVariation.id) {
        return {
          lineId: selectedBranchVariation.id,
          correct: field === "correct" ? 1 : 0,
          wrong: field === "wrong" ? 1 : 0,
        };
      }

      return {
        ...previous,
        [field]: previous[field] + 1,
      };
    });
  };

  const commitMove = (from: Square, to: Square) => {
    const nextPosition = new Chess(fen);
    const shouldTrackBranchAttempt = Boolean(selectedBranchVariation && expectedTrainerMove && isUserTurnInTrainer);

    let promotion: "q" | "r" | "b" | "n" | undefined = undefined;
    const movingPiece = nextPosition.get(from);
    const targetRank = Number(to[1]);
    const isPawnPromotion =
      movingPiece?.type === "p" &&
      ((movingPiece.color === "w" && targetRank === 8) || (movingPiece.color === "b" && targetRank === 1));

    if (isPawnPromotion) {
      if (learnPreferences.autoQueen) {
        promotion = "q";
      } else {
        const selected = window.prompt("Promote to (q, r, b, n)", "q")?.trim().toLowerCase();
        if (!selected) {
          return false;
        }
        if (!["q", "r", "b", "n"].includes(selected)) {
          playSound("illegal");
          return false;
        }
        promotion = selected as "q" | "r" | "b" | "n";
      }
    }

    try {
      const move = nextPosition.move({
        from,
        to,
        promotion,
      });

      if (!move) {
        playSound("illegal");
        return false;
      }

      if (expectedTrainerMove && normalizeSan(move.san) !== normalizeSan(expectedTrainerMove)) {
        if (shouldTrackBranchAttempt) {
          updateBranchAttempt("wrong");
        }
        setTrainerHint(`Required move: ${expectedTrainerMove}`);
        playSound("illegal");
        return false;
      }

      if (shouldTrackBranchAttempt) {
        updateBranchAttempt("correct");
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
      const nextHistory = history.slice(0, currentMoveIndex + 1);
      nextHistory.push(newFen);
      const nextSanHistory = sanHistory.slice(0, currentMoveIndex);
      nextSanHistory.push(move.san);
      setHistory(nextHistory);
      setSanHistory(nextSanHistory);
      setCurrentMoveIndex(nextHistory.length - 1);
      setFen(newFen);
      setSelectedSquare(null);
      setDraggedSquare(null);
      setLastMove(serializedMove);
      setRightClickHighlights(new Set());
      setRightClickArrows([]);
      if (expectedTrainerMove) {
        const nextExpected = activeLineSan[nextSanHistory.length] ?? null;
        if (nextExpected) {
          const shouldAutoOpponentMove = nextPosition.turn() !== TRAINER_USER_COLOR;
          if (shouldAutoOpponentMove) {
            const autoReply = nextPosition
              .moves({ verbose: true })
              .find((candidate) => normalizeSan(candidate.san) === normalizeSan(nextExpected));

            if (autoReply) {
              setTrainerHint(`Opponent auto move: ${autoReply.san}`);
            } else {
              setTrainerHint(`Required move: ${nextExpected}`);
            }
          } else {
            setTrainerHint(`Required move: ${nextExpected}`);
          }
        } else {
          setTrainerHint(null);
        }
      } else {
        setTrainerHint(null);
      }

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
      setSoundHistory(prev => [...prev.slice(0, currentMoveIndex + 1), soundToPlay]);

      return true;
    } catch {
      playSound("illegal");
      return false;
    }
  };

  const queuePremove = useCallback((from: Square, to: Square) => {
    const piece = game.get(from);
    if (!piece || piece.color !== TRAINER_USER_COLOR || from === to) {
      playSound("illegal");
      setSelectedSquare(null);
      return false;
    }

    let accepted = false;
    setQueuedPremoves((previous) => {
      const nextEntry: QueuedPremove = { from, to };
      const nextQueue = learnPreferences.premoveMode === "multiple" ? [...previous, nextEntry] : [nextEntry];
      accepted = validateQueuedLearnPremoves(nextQueue);
      return accepted ? nextQueue : previous;
    });

    if (!accepted) {
      setTrainerHint("Queued premove does not match the trainer line.");
      playSound("illegal");
      setSelectedSquare(null);
      setDraggedSquare(null);
      setDragOverSquare(null);
      return false;
    }

    setSelectedSquare(null);
    setDraggedSquare(null);
    setDragOverSquare(null);
    setTrainerHint("Premove queued.");
    playSound("move-self");
    return true;
  }, [game, learnPreferences.premoveMode, playSound, validateQueuedLearnPremoves]);

  useEffect(() => {
    if (!expectedTrainerLegalMove || isUserTurnInTrainer) {
      autoMoveTriggerKeyRef.current = "";
      return;
    }

    const triggerKey = `${fen}|${expectedTrainerLegalMove.from}${expectedTrainerLegalMove.to}`;
    if (autoMoveTriggerKeyRef.current === triggerKey) {
      return;
    }

    autoMoveTriggerKeyRef.current = triggerKey;
    const timer = window.setTimeout(() => {
      commitMove(expectedTrainerLegalMove.from, expectedTrainerLegalMove.to);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [commitMove, expectedTrainerLegalMove, fen, isUserTurnInTrainer]);

  useEffect(() => {
    if (!canUsePremoves || !isUserTurnInTrainer || queuedPremoves.length === 0) {
      return;
    }

    const nextPremove = queuedPremoves[0];
    const legalMove = game
      .moves({ verbose: true })
      .find((candidate) => candidate.from === nextPremove.from && candidate.to === nextPremove.to);

    if (!legalMove) {
      clearQueuedPremoves();
      setTrainerHint("Queued premove is no longer legal.");
      playSound("illegal");
      return;
    }

    const didMove = commitMove(nextPremove.from, nextPremove.to);
    if (!didMove) {
      clearQueuedPremoves();
      return;
    }

    setQueuedPremoves((previous) => previous.slice(1));
  }, [canUsePremoves, clearQueuedPremoves, commitMove, game, isUserTurnInTrainer, playSound, queuedPremoves]);

  const handleSquareClick = (square: Square) => {
    if (learnPreferences.moveMethod === "drag") {
      return;
    }

    if (isPremoveTurn) {
      const clickedPiece = game.get(square);

      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      if (selectedSquare) {
        queuePremove(selectedSquare, square);
        return;
      }

      if (clickedPiece?.color === TRAINER_USER_COLOR) {
        setSelectedSquare(square);
        return;
      }

      if (queuedPremoves.length > 0) {
        clearQueuedPremoves();
        setTrainerHint("Premoves cleared.");
        playSound("move-self");
      } else {
        playSound("illegal");
      }
      setSelectedSquare(null);
      return;
    }

    if (expectedTrainerLegalMove) {
      if (selectedSquare && legalTargets.includes(square)) {
        if (learnPreferences.moveConfirmation && !window.confirm(`Confirm move ${selectedSquare} to ${square}?`)) {
          return;
        }
        commitMove(selectedSquare, square);
        return;
      }

      if (square === expectedTrainerLegalMove.from) {
        setSelectedSquare(square);
        return;
      }

      setTrainerHint(`Required move: ${expectedTrainerLegalMove.san}`);
      if (selectedSquare) {
        playSound("illegal");
      }
      setSelectedSquare(null);
      return;
    }

    const clickedPiece = game.get(square);

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    if (selectedSquare && legalTargets.includes(square)) {
      if (learnPreferences.moveConfirmation && !window.confirm(`Confirm move ${selectedSquare} to ${square}?`)) {
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

  const handleRightClickDown = (e: React.MouseEvent, square: Square) => {
    if (e.button === 2) {
      setRightClickStartSquare(square);
    } else {
      if (rightClickHighlights.size > 0) setRightClickHighlights(new Set());
      if (rightClickArrows.length > 0) setRightClickArrows([]);
    }
  };

  const handleRightClickUp = (e: React.MouseEvent, square: Square) => {
    if (e.button === 2 && rightClickStartSquare) {
      if (rightClickStartSquare === square) {
        setRightClickHighlights((prev) => {
          const next = new Set(prev);
          if (next.has(square)) next.delete(square);
          else next.add(square);
          return next;
        });
      } else {
        setRightClickArrows((prev) => {
          const existingIndex = prev.findIndex(
            (arrow) => arrow.start === rightClickStartSquare && arrow.end === square
          );
          if (existingIndex >= 0) {
            return prev.filter((_, i) => i !== existingIndex);
          }
          return [...prev, { start: rightClickStartSquare, end: square }];
        });
      }
      setRightClickStartSquare(null);
    }
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, square: Square) => {
    if (learnPreferences.moveMethod === "click") {
      event.preventDefault();
      return;
    }
    const draggedPiece = game.get(square);

    const expectedColor = isPremoveTurn ? TRAINER_USER_COLOR : game.turn();
    if (!draggedPiece || draggedPiece.color !== expectedColor) {
      event.preventDefault();
      return;
    }

    if (expectedTrainerLegalMove && !isUserTurnInTrainer && !isPremoveTurn) {
      event.preventDefault();
      return;
    }

    if (expectedTrainerLegalMove && !isPremoveTurn && square !== expectedTrainerLegalMove.from) {
      event.preventDefault();
      setTrainerHint(`Required move: ${expectedTrainerLegalMove.san}`);
      playSound("illegal");
      return;
    }

    // Use the piece image as drag ghost to avoid multiple pieces appearing
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

    if (!draggedSquare) {
      return;
    }

    if (isPremoveTurn) {
      queuePremove(draggedSquare, square);
      return;
    }

    if (expectedTrainerLegalMove) {
      const isRequiredMove = draggedSquare === expectedTrainerLegalMove.from && square === expectedTrainerLegalMove.to;
      if (!isRequiredMove) {
        setTrainerHint(`Required move: ${expectedTrainerLegalMove.san}`);
        setDraggedSquare(null);
        setSelectedSquare(null);
        playSound("illegal");
        return;
      }
    }

    if (learnPreferences.moveConfirmation && !window.confirm(`Confirm move ${draggedSquare} to ${square}?`)) {
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

  const savePreferences = async () => {
    setPreferencesError(null);
    setPreferencesSaving(true);

    try {
      let shouldFallbackToLocal = false;

      try {
        const response = await fetch("/api/preferences", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            boardTheme,
            pieceTheme,
            soundEnabled,
          }),
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

  const { toggleTheme, isDark } = useTheme();

  const topSuggestedMove = analysis.lines[0]?.pv[0] ?? null;
  const suggestionFrom = topSuggestedMove?.slice(0, 2) ?? null;
  const suggestionTo = topSuggestedMove?.slice(2, 4) ?? null;

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

  const visibleSanMoves = playedSanMoves;
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

  const isEngineLoading = isEngineEnabled && !analysis.ready && !analysis.error;
  if (openingLoading || preferencesLoading) {
    return <OpeningLoading />;
  }

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[var(--bg)]">
      <header className="w-full px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between border-b border-[var(--border)]">
        <Link href="/" className="text-[20px] sm:text-[22px] font-serif font-[800] text-[var(--text-primary)]">
          CHESS
        </Link>
        <Link
          href="/learn"
          className="inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[13px] sm:text-[14px] font-medium group"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5 sm:mr-2 transform group-hover:-translate-x-1 transition-transform" />
          <span className="hidden sm:inline">Back to Learn</span>
          <span className="sm:hidden">Back</span>
        </Link>
      </header>

      <main className="flex-1 w-full flex flex-col-reverse lg:flex-row h-auto lg:h-[calc(100vh-73px)]">
        <div className="w-full lg:w-[35%] h-[550px] lg:h-full p-4 lg:p-5 bg-[var(--bg)] relative z-10 shrink-0 border-t lg:border-t-0 lg:border-r border-[var(--border)]">
          <div className="w-full h-full bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="border-b border-[var(--border)] px-3 py-2 bg-[var(--surface-alt)]">
              <div className="text-[16px] font-serif font-[600] leading-tight text-[var(--text-primary)]">
                {formattedTitle} - {statusText}
              </div>
            </div>
            <div className="border-b border-[var(--border)] px-3 py-2 bg-[var(--surface)] flex flex-col shrink-0">
              <div className="text-[14px] font-semibold tracking-wide text-[var(--text-primary)] mb-1 shrink-0">Opening Trainer</div>
              {openingLoading ? (
                <div className="text-[12px] text-[var(--text-muted)] shrink-0">Loading opening line...</div>
              ) : openingError ? (
                <div className="text-[12px] text-[var(--text-primary)] shrink-0">{openingError}</div>
              ) : openingData ? (
                <div className="flex flex-col shrink-0">
                  {openingData.openingStats ? (
                    <div className="mb-2 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-primary)]">
                        Popularity and Results
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                        {`${openingData.openingStats.sampleSizeGames.toLocaleString()} games sampled`}
                        {openingData.openingStats.avgPlayerRating
                          ? ` • Avg ${Math.round(openingData.openingStats.avgPlayerRating)}`
                          : ""}
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                        {`White ${openingData.openingStats.whiteWinPct}% • Draw ${openingData.openingStats.drawPct}% • Black ${openingData.openingStats.blackWinPct}%`}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 mb-1 shrink-0">
                    <div className="text-[12px] text-[var(--text-secondary)]">
                      Base line progress: {Math.min(matchedMainLinePlies, mainLineSan.length)}/{mainLineSan.length} plies
                    </div>
                    {!isMainLineComplete ? (
                      <button
                        onClick={skipBaseLine}
                        className="text-[11px] font-semibold px-2 py-1 rounded border border-[var(--border)] text-[var(--text-primary)] bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        Skip base line
                      </button>
                    ) : null}
                  </div>
                  {selectedBranchVariation ? (
                    <div className="text-[12px] text-[var(--text-secondary)] mb-1 shrink-0">
                      Variation progress: {selectedBranchProgress}/{selectedBranchContinuationLength} plies
                    </div>
                  ) : null}
                  {expectedTrainerMove ? (
                    <div className="text-[12px] text-[var(--text-primary)] font-semibold mb-2 shrink-0">
                      {isUserTurnInTrainer
                        ? `Required move: ${expectedTrainerLegalMove?.san ?? expectedTrainerMove ?? "-"}`
                        : `Opponent auto move: ${expectedTrainerLegalMove?.san ?? expectedTrainerMove ?? "-"}`}
                    </div>
                  ) : trainerHint ? (
                    <div className="text-[12px] text-[var(--text-primary)] font-semibold mb-2 shrink-0">{trainerHint}</div>
                  ) : null}
                  {isBranchComplete && selectedBranchVariation ? (
                    <div className="mb-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-2">
                      <div className="text-[12px] font-semibold text-[var(--text-primary)]">Variation complete: {selectedBranchVariation.name}</div>
                      {variationProgressById[selectedBranchVariation.id] ? (
                        <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                          Best {variationProgressById[selectedBranchVariation.id].bestAccuracy}% · Attempts {variationProgressById[selectedBranchVariation.id].attempts}
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          onClick={() => applyOpeningLine(selectedBranchVariation.id, selectedBranchVariation.pgn, mainLineSan.length, selectedBranchVariation.name)}
                          className="text-[11px] font-semibold px-2 py-1 rounded border border-[var(--border)] text-[var(--text-primary)] bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          Retry
                        </button>
                        <button
                          onClick={skipBaseLine}
                          className="text-[11px] font-semibold px-2 py-1 rounded border border-[var(--border)] text-[var(--text-primary)] bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          Back to base
                        </button>
                        {recommendedNextBranch ? (
                          <button
                            onClick={() => applyOpeningLine(recommendedNextBranch.id, recommendedNextBranch.pgn, mainLineSan.length, recommendedNextBranch.name)}
                            className="text-[11px] font-semibold px-2 py-1 rounded border border-[var(--border-hover)] text-[var(--text-primary)] bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] transition-colors"
                          >
                            Next branch
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {openingData.mainLineMovePopularity.length > 0 ? (
                    <div className="mb-2 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-primary)]">
                        Main Line Move Popularity (Global)
                      </div>
                      <div className="mt-1 max-h-[108px] overflow-y-auto pr-1 custom-scrollbar space-y-1">
                        {openingData.mainLineMovePopularity.slice(0, 8).map((step) => (
                          <div key={`${step.ply}-${step.playedSan}`} className="text-[11px] text-[var(--text-secondary)] border-b border-[var(--border-subtle)] pb-1 last:border-b-0">
                            <div>
                              {`${step.ply}. ${step.playedSan} ${step.playedPct === null ? "(no sample)" : `(${step.playedPct}%)`}`}
                            </div>
                            {step.topMoves.length > 0 ? (
                              <div className="text-[10px] text-[var(--text-muted)]">
                                Top: {step.topMoves.map((move) => `${move.san} ${move.pct}%`).join(" • ")}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-1 flex flex-col shrink-0" style={{ height: "180px", overflow: "hidden" }}>
                    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-alt)] flex flex-col h-full overflow-hidden">
                      <div className="px-2 py-1 border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-primary)] shrink-0">
                        Variations
                      </div>
                      <div
                        className="overflow-y-auto overscroll-contain custom-scrollbar pr-1 flex-1 relative"
                        style={{ scrollbarGutter: "stable" }}
                      >
                      {!isMainLineComplete ? (
                        <div className="px-2 py-2 text-[12px] text-[var(--text-muted)]">
                          Complete the base line (or skip) to unlock variations.
                        </div>
                      ) : allBranchVariations.length === 0 ? (
                        <div className="px-2 py-2 text-[12px] text-[var(--text-muted)]">
                          No mapped continuations found after this base line.
                        </div>
                      ) : (
                        <div className="space-y-1 p-1">
                          <div className="pb-1">
                            <input
                              type="text"
                              value={variationQuery}
                              onChange={(event) => setVariationQuery(event.target.value)}
                              placeholder="Search variations"
                              className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-hover)]"
                            />
                            <div className="mt-1 flex items-center gap-1">
                              <button
                                onClick={() => setVariationSortModePreference("popularity")}
                                className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors ${variationSortMode === "popularity" ? "border-[var(--border-hover)] bg-[var(--surface-hover)] text-[var(--text-primary)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
                              >
                                Popularity
                              </button>
                              <button
                                onClick={() => setVariationSortModePreference("progress")}
                                className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors ${variationSortMode === "progress" ? "border-[var(--border-hover)] bg-[var(--surface-hover)] text-[var(--text-primary)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
                              >
                                Progress
                              </button>
                            </div>
                            <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                              Cards show line popularity (within mapped variations) and trigger move popularity (global).
                            </div>
                          </div>
                          {visibleBranchVariations.length === 0 ? (
                            <div className="px-1 py-2 text-[11px] text-[var(--text-muted)]">No variation matches your search.</div>
                          ) : null}
                          {visibleBranchVariations.map((line) => (
                            <button
                              key={line.id}
                              onClick={() => applyOpeningLine(line.id, line.pgn, mainLineSan.length, line.name)}
                              className={`w-full text-left rounded border px-2 py-1 transition-colors ${selectedLineId === line.id ? "border-[var(--border-hover)] bg-[var(--surface-hover)] text-[var(--text-primary)]" : "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
                              title={line.pgn}
                            >
                              <div className="mb-0.5 flex items-center justify-between gap-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide truncate">{line.name}</div>
                                <div className="shrink-0 text-[10px] text-[var(--text-muted)]">
                                  {variationProgressById[line.id]?.completions
                                    ? `${variationProgressById[line.id].bestAccuracy}%`
                                    : "new"}
                                </div>
                              </div>
                              <div className="text-[11px] text-[var(--text-muted)] truncate">{line.continuation}</div>
                              <div className="mt-0.5 text-[10px] text-[var(--text-muted)] truncate">
                                {line.linePopularity
                                  ? `Line: ${line.linePopularity.sharePct}% (${line.linePopularity.sampleSizeGames.toLocaleString()} games)`
                                  : "Line: no sample"}
                                {" • "}
                                {line.triggerMoveGlobalPopularity
                                  ? `Global trigger ${line.triggerMoveGlobalPopularity.san}: ${line.triggerMoveGlobalPopularity.pct}%`
                                  : line.triggerMoveSan
                                    ? `Global trigger ${line.triggerMoveSan}: no sample`
                                    : "Global trigger: n/a"}
                              </div>
                            </button>
                          ))}
                          {hasMoreVariations ? (
                            <button
                              onClick={() => setVariationVisibleCount((previous) => previous + VARIATIONS_PAGE_SIZE)}
                              className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                            >
                              Show more ({filteredBranchVariations.length - visibleBranchVariations.length})
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="h-12 px-3 border-b border-[var(--border)] flex items-center justify-between relative shrink-0">
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
                  <button onClick={() => setShowAnalysisSection((v) => !v)} className="w-full px-3 py-2 text-left text-[var(--text-primary)] hover:bg-[var(--surface-hover)] text-[14px] flex items-center justify-between">
                    <span>Analysis Section</span>
                    <span className={showAnalysisSection ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>{showAnalysisSection ? "On" : "Off"}</span>
                  </button>
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

            {showAnalysisSection ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="max-h-[255px] overflow-y-auto custom-scrollbar border-b border-[var(--border)]">
                {showEngineLines ? (
                  <>
                    {analysis.lines.slice(0, analysisMultiPv).map((line) => {
                      const pvMoves = buildPvDisplayMoves(fen, line.pv);
                      const isExpanded = expandedEngineLineIds[line.id] ?? false;
                      const canExpand = pvMoves.length > 6;
                      const visibleMoves = isExpanded ? pvMoves : pvMoves.slice(0, 6);

                      return (
                        <div key={line.id} className="min-h-[44px] px-2 py-1 border-b border-[var(--border)] flex items-start gap-2 text-[var(--text-secondary)] relative z-0 hover:z-40">
                          <div className="min-w-[52px] h-6 rounded bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[12px] font-bold leading-none text-[var(--text-primary)] mt-[2px]">
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
                      <div className="flex flex-col border-b border-[var(--border)]">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="min-h-[44px] px-2 py-2 border-b border-[var(--border)] flex items-start gap-2 last:border-0">
                            <div className="w-[52px] h-6 rounded bg-[var(--skeleton)] animate-pulse"></div>
                            <div className="flex-1 flex flex-wrap gap-2 pt-[2px]">
                              <div className="w-8 h-4 rounded bg-[var(--skeleton-soft)] animate-pulse"></div>
                              <div className="w-10 h-4 rounded bg-[var(--skeleton-soft)] animate-pulse"></div>
                              <div className="w-6 h-4 rounded bg-[var(--skeleton-soft)] animate-pulse"></div>
                              <div className="w-12 h-4 rounded bg-[var(--skeleton-soft)] animate-pulse"></div>
                              <div className="w-8 h-4 rounded bg-[var(--skeleton-soft)] animate-pulse"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="px-3 py-3 text-[var(--text-muted)] text-[14px] border-b border-[var(--border)]">
                    Engine lines hidden from menu.
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 flex flex-col bg-[var(--surface)]">
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
                        <div key={row.moveNumber} className="grid grid-cols-[36px_1fr_1fr] items-center px-3 py-1.5 border-b border-[var(--border)] text-[14px]">
                          <span className="text-[var(--text-dimmed)]">{row.moveNumber}.</span>
                          <span className={`truncate ${isCurrentWhite ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-secondary)]"}`}>
                            {row.whiteMove || ""}
                          </span>
                          <span className={`truncate ${isCurrentBlack ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-secondary)]"}`}>
                            {row.blackMove || ""}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            ) : null}

            <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--surface-alt)]">
              <div className="flex items-center justify-center gap-2 mb-3 w-full">
                  <button onClick={goToStart} disabled={currentMoveIndex === 0} className="p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-colors disabled:cursor-not-allowed">
                    <ChevronsLeft className="w-6 h-6" />
                  </button>
                  <button onClick={goToPrev} disabled={currentMoveIndex === 0} className="p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-colors disabled:cursor-not-allowed">
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button onClick={togglePlay} className="p-2 px-4 rounded-md bg-[var(--surface)] border border-[var(--border-hover)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-center min-w-[56px]">
                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                  </button>
                  <button onClick={goToNext} disabled={currentMoveIndex === history.length - 1} className="p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-colors disabled:cursor-not-allowed">
                    <ChevronRight className="w-6 h-6" />
                  </button>
                  <button onClick={goToEnd} disabled={currentMoveIndex === history.length - 1} className="p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-colors disabled:cursor-not-allowed">
                    <ChevronsRight className="w-6 h-6" />
                  </button>
                </div>

              {showMoveFeedback && (
                <div className="text-[12px] text-[var(--text-secondary)] mb-2">
                  {topSuggestedMove ? `Suggested move: ${topSuggestedMove}` : "No suggestion yet."}
                </div>
              )}
              <button
                onClick={resetBoard}
                className="w-full flex items-center justify-center px-4 py-2.5 bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-md font-semibold text-[13px] hover:bg-[var(--cta-hover)] transition-colors"
              >
                Reset Board
              </button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[65%] flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center lg:justify-end bg-[var(--bg-alt)] p-4 lg:p-0 lg:pt-6 lg:pr-[70px] relative shadow-none lg:shadow-[-30px_0_50px_rgba(0,0,0,0.15)] border-l-0 lg:border-l border-[var(--border)]">
          <div className="w-full lg:w-auto flex justify-end lg:absolute lg:top-6 lg:right-6 flex-row lg:flex-col gap-1.5 lg:gap-3 z-50 mb-1 lg:mb-0">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 lg:p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-sm lg:shadow-lg flex items-center justify-center"
              title="Settings"
            >
              <Settings className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
            <button
              onClick={() => setIsBoardFlipped(!isBoardFlipped)}
              className="p-1.5 lg:p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-sm lg:shadow-lg flex items-center justify-center flex-col gap-[1px] lg:gap-[2px]"
              title="Flip Board"
            >
              <ArrowLeft className="w-[11px] h-[11px] lg:w-[14px] lg:h-[14px] -ml-1" />
              <ArrowLeft className="w-[11px] h-[11px] lg:w-[14px] lg:h-[14px] -mr-1 rotate-180" />
            </button>
            <button
              onClick={toggleTheme}
              data-theme-toggle
              className="p-1.5 lg:p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-sm lg:shadow-lg flex items-center justify-center"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="w-[15px] h-[15px] lg:w-[18px] lg:h-[18px]" /> : <Moon className="w-[15px] h-[15px] lg:w-[18px] lg:h-[18px]" />}
            </button>
          </div>

          {isSettingsOpen && (
            <div 
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--skeleton-soft)] backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setIsSettingsOpen(false)}
            >
              <div 
                className="w-[1050px] max-w-[95vw] h-[720px] max-h-[90vh] bg-[var(--surface-alt)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden flex flex-row relative cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                
                {/* Left Sidebar Menu */}
                <div className="w-[240px] md:w-[260px] bg-[var(--surface)] border-r border-[var(--border)] flex flex-col py-4 overflow-y-auto shrink-0 z-10 custom-scrollbar">
                  <div className="px-5 mb-4">
                    <span className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">Settings</span>
                  </div>
                  <button
                    onClick={() => setActiveSettingsTab("boards")}
                    className={`flex items-center gap-3 px-5 py-3 w-full text-left font-medium border-l-2 transition-colors ${
                      activeSettingsTab === "boards" || activeSettingsTab === "pieces"
                        ? "bg-[var(--surface-alt)] text-[var(--text-primary)] border-[var(--border-hover)] shadow-[-10px_0_20px_rgba(0,0,0,0.12)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"
                    }`}
                  >
                    <LayoutGrid className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Board & Pieces</span>
                  </button>
                  <button
                    onClick={() => setActiveSettingsTab("gameplay")}
                    className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${
                      activeSettingsTab === "gameplay"
                        ? "bg-[var(--surface-alt)] text-[var(--text-primary)] font-medium border-[var(--border-hover)] shadow-[-10px_0_20px_rgba(0,0,0,0.12)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"
                    }`}
                  >
                    <Monitor className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Gameplay</span>
                  </button>
                  <button
                    onClick={() => setActiveSettingsTab("engine")}
                    className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${
                      activeSettingsTab === "engine"
                        ? "bg-[var(--surface-alt)] text-[var(--text-primary)] font-medium border-[var(--border-hover)] shadow-[-10px_0_20px_rgba(0,0,0,0.12)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"
                    }`}
                  >
                    <Gamepad2 className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Engine</span>
                  </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col relative min-w-0 bg-[var(--surface-alt)] text-[var(--text-primary)]">
                  {/* Header */}
                  <div className="px-8 pt-6 pb-3 shrink-0">
                  <h2 className="text-[24px] font-bold mb-1 font-sans">
                    {activeSettingsTab === "engine" ? "Engine" : activeSettingsTab === "gameplay" ? "Gameplay" : "Board & Pieces"}
                  </h2>
                  <p className="text-[var(--text-muted)] text-[14px]">
                    {activeSettingsTab === "engine"
                      ? "Configure analysis engine options and line depth."
                      : activeSettingsTab === "gameplay"
                        ? "Configure interaction and move behavior for Learn mode."
                      : "Customize the look and feel of your chess set."}
                  </p>
                  {preferencesLoading && (
                    <p className="text-[var(--text-muted)] text-[12px] mt-2">Loading saved preferences...</p>
                  )}
                  {preferencesError && (
                    <p className="text-[var(--error-text)] text-[12px] mt-2">{preferencesError}</p>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-col md:flex-row px-8 pb-8 pt-0 gap-8 h-[650px] max-h-[75vh] w-full">
                  {/* Left Side: Tabs & Grid */}
                  <div className="w-full md:w-[55%] flex flex-col h-full min-h-0">
                    {/* Tabs */}
                    {(activeSettingsTab === "boards" || activeSettingsTab === "pieces") && (
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
                    )}

                    {/* Grid Selection */}
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
                                <div className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${isSelected ? "border-[var(--border-hover)] scale-[1.05] shadow-[0_0_15px_rgba(0,0,0,0.25)]" : "border-transparent group-hover:border-[var(--border)]"}`}>
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
                                <div className={`relative aspect-square rounded-lg border-2 bg-[var(--skeleton)] flex items-center justify-center transition-all p-2 ${isSelected ? "border-[var(--border-hover)] bg-[var(--skeleton-soft)] scale-[1.05] shadow-[0_0_15px_rgba(0,0,0,0.25)]" : "border-transparent group-hover:border-[var(--border)] group-hover:bg-[var(--skeleton-soft)]"}`}>
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
                      {activeSettingsTab === "engine" && (
                        <div className="px-2 py-2 space-y-4 text-[var(--text-primary)]">
                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[var(--text-muted)]">Strength</label>
                            <select
                              value={analysisStrength}
                              onChange={(event) => setAnalysisStrength(event.target.value as AnalysisStrength)}
                              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-[14px] text-[var(--text-primary)]"
                            >
                              <option value="fast">Fast (~1 sec, 3270 Rating)</option>
                              <option value="standard">Standard (~5 sec, 3430 Rating)</option>
                              <option value="deep">Deep (~20 sec, 3500 Rating)</option>
                              <option value="maximum">Maximum (~1 min 30 sec, 3560 Rating)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[var(--text-muted)]">Analysis Engine</label>
                            <select
                              value={analysisEngineChoice}
                              onChange={(event) => setAnalysisEngineChoice(event.target.value as AnalysisEngineChoice)}
                              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-[14px] text-[var(--text-primary)]"
                            >
                              <option value="stockfish-18">Stockfish 18 (108MB download)</option>
                              <option value="stockfish-18-lite">Stockfish 18 Lite (7MB download)</option>
                              <option value="torch-4">Torch 4 (73MB download)</option>
                              <option value="torch-4-lite">Torch 4 Lite (6MB download)</option>
                              <option value="off">Engine Off</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[var(--text-muted)]">Number of Lines</label>
                            <select
                              value={analysisMultiPv}
                              onChange={(event) => setAnalysisMultiPv(Number(event.target.value))}
                              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-[14px] text-[var(--text-primary)]"
                            >
                              <option value={1}>1</option>
                              <option value={2}>2</option>
                              <option value={3}>3</option>
                              <option value={4}>4</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[var(--text-muted)]">Maximum Time (sec)</label>
                            <input
                              type="number"
                              min={1}
                              max={180}
                              value={analysisMaxTimeSeconds}
                              onChange={(event) => setAnalysisMaxTimeSeconds(Math.max(1, Number(event.target.value) || 1))}
                              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-[14px] text-[var(--text-primary)]"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[var(--text-muted)]">Threads</label>
                            <input
                              type="number"
                              min={1}
                              max={1}
                              value={analysisThreads}
                              onChange={(event) => setAnalysisThreads(Math.max(1, Number(event.target.value) || 1))}
                              disabled
                              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-[14px] text-[var(--text-muted)] cursor-not-allowed"
                            />
                          </div>

                          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
                            {analysisEngineChoice === "torch-4" || analysisEngineChoice === "torch-4-lite"
                              ? torchLoading
                                ? "Checking Torch runtime..."
                                : torchStatus.ok
                                  ? torchStatus.model_present
                                    ? "Torch runtime detected. Until a Torch inference backend is wired, analysis still runs through Stockfish."
                                    : "Torch runtime detected but model file is missing. Analysis still runs through Stockfish."
                                  : "Torch runtime unavailable. Analysis runs through Stockfish."
                              : "Stockfish engine is used for live analysis in this build."}
                          </div>
                        </div>
                      )}
                      {activeSettingsTab === "gameplay" && (
                        <div className="px-2 py-2 space-y-4 text-[var(--text-primary)]">
                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[var(--text-muted)]">Move Method</label>
                            <select
                              value={learnPreferences.moveMethod}
                              onChange={(event) => updateLearnPreferences({ moveMethod: event.target.value as typeof learnPreferences.moveMethod })}
                              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-[14px] text-[var(--text-primary)]"
                            >
                              <option value="drag">Drag only</option>
                              <option value="click">Click only</option>
                              <option value="both">Both</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[var(--text-muted)]">Board Orientation</label>
                            <select
                              value={learnPreferences.boardOrientation}
                              onChange={(event) => {
                                const orientation = event.target.value as typeof learnPreferences.boardOrientation;
                                updateLearnPreferences({ boardOrientation: orientation });
                                if (orientation === "black") setIsBoardFlipped(true);
                                if (orientation === "white") setIsBoardFlipped(false);
                              }}
                              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-[14px] text-[var(--text-primary)]"
                            >
                              <option value="auto">Auto</option>
                              <option value="white">White bottom</option>
                              <option value="black">Black bottom</option>
                            </select>
                          </div>

                          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] flex items-center justify-between">
                            <span>Show legal moves</span>
                            <input type="checkbox" checked={learnPreferences.showLegalMoves} onChange={(event) => updateLearnPreferences({ showLegalMoves: event.target.checked })} />
                          </div>
                          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] flex items-center justify-between">
                            <span>Move confirmation</span>
                            <input type="checkbox" checked={learnPreferences.moveConfirmation} onChange={(event) => updateLearnPreferences({ moveConfirmation: event.target.checked })} />
                          </div>
                          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] flex items-center justify-between">
                            <span>Enable premove</span>
                            <input type="checkbox" checked={learnPreferences.premoveEnabled} onChange={(event) => updateLearnPreferences({ premoveEnabled: event.target.checked })} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[var(--text-muted)]">Premove Mode</label>
                            <select
                              value={learnPreferences.premoveMode}
                              onChange={(event) => updateLearnPreferences({ premoveMode: event.target.value as typeof learnPreferences.premoveMode })}
                              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-[14px] text-[var(--text-primary)]"
                            >
                              <option value="single">Single premove</option>
                              <option value="multiple">Multiple premoves</option>
                            </select>
                          </div>
                          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] flex items-center justify-between">
                            <span>Auto queen</span>
                            <input type="checkbox" checked={learnPreferences.autoQueen} onChange={(event) => updateLearnPreferences({ autoQueen: event.target.checked })} />
                          </div>
                          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] flex items-center justify-between">
                            <span>Show opening title</span>
                            <input type="checkbox" checked={learnPreferences.showOpeningNames} onChange={(event) => updateLearnPreferences({ showOpeningNames: event.target.checked })} />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[var(--text-muted)]">Engine Depth</label>
                            <input
                              type="range"
                              min={10}
                              max={24}
                              value={learnPreferences.engineDepth}
                              onChange={(event) => {
                                const depth = Number(event.target.value);
                                updateLearnPreferences({ engineDepth: depth });
                                setAnalysisDepth(depth);
                              }}
                              className="w-full"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[var(--text-muted)]">Sound Volume</label>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={learnPreferences.masterVolume}
                              onChange={(event) => updateLearnPreferences({ masterVolume: Number(event.target.value) })}
                              className="w-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Preview */}
                  <div className="w-full md:w-[45%] flex flex-col items-center justify-start rounded-xl p-0 relative shrink-0">
                    <div className="w-full aspect-square relative shadow-2xl rounded-sm overflow-hidden border border-[var(--border)]">
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
                    
                    {/* Sounds Toggle */}
                    <div className="mt-8 w-full flex items-center justify-start gap-4">
                      <label className="relative inline-flex items-center cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={soundEnabled} 
                          onChange={(e) => {
                            setSoundEnabled(e.target.checked);
                            if (e.target.checked) new Audio("/sounds/move-self.mp3").play().catch(() => {});
                          }} 
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-[var(--skeleton)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--border)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-muted)] after:border-[var(--border)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--border-hover)] peer-checked:after:bg-[var(--surface)] group-hover:after:scale-[1.05]"></div>
                        <span className="ml-3 text-[14px] text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)] transition-colors">Enable Sounds</span>
                      </label>
                    </div>
                  </div>
                </div>

                  {/* Footer / Actions */}
                  <div className="mt-auto bg-[var(--surface-alt)] px-8 py-5 flex items-center justify-end border-t border-[var(--border)] w-full shrink-0">
                    <button 
                      onClick={() => {
                        savePreferences().catch(() => {});
                      }}
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

          <div className="flex items-stretch w-full lg:w-auto h-auto lg:h-[85vh] max-h-[820px] lg:aspect-[1/0.95] max-w-[100%] lg:max-w-[85%] justify-center lg:justify-end">
            {showEvaluationBar && (
              <div className="w-[16px] md:w-[30px] mr-[8px] md:mr-[24px] bg-[#333333] rounded overflow-hidden flex flex-col relative shadow-[0_2px_10px_rgba(0,0,0,0.5)] shrink-0">
                <div
                  className="w-full bg-[#202020] transition-[height] duration-300 relative"
                  style={{ height: `${100 - analysis.whiteWinChance}%` }}
                >
                  <div className="absolute inset-0 bg-white/5 animate-pulse" />
                </div>
                <div
                  className="w-full bg-white relative shadow-[0_-2px_10px_rgba(255,255,255,0.6)] flex flex-col justify-end items-center pb-1.5 border-t border-[#666] transition-[height] duration-300"
                  style={{ height: `${analysis.whiteWinChance}%` }}
                >
                  <span className="text-[10.5px] md:text-[13px] font-[800] text-black [writing-mode:vertical-lr] lg:[writing-mode:horizontal-tb] rotate-180 lg:rotate-0 tracking-widest lg:tracking-normal">
                    {isEngineEnabled ? analysis.evaluationText : "OFF"}
                  </span>
                </div>
              </div>
            )}

            <div
              className="flex-1 lg:flex-none h-auto lg:h-full aspect-square relative overflow-hidden"
            >
              <BoardImage src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`} className="w-full h-full">
                <div className="w-full h-full grid grid-cols-8 grid-rows-8 relative">
                  {(isBoardFlipped
                    ? [...boardState].reverse().map(r => [...r].reverse())
                    : boardState
                  ).map((row, visRowIndex) =>
                  row.map((piece, visColIndex) => {
                    // When flipped, visual row 0 = logical row 7, etc.
                    const logicalRow = isBoardFlipped ? 7 - visRowIndex : visRowIndex;
                    const logicalCol = isBoardFlipped ? 7 - visColIndex : visColIndex;
                    const square = toSquare(logicalRow, logicalCol);
                    const squarePiece = game.get(square);
                    const isLightSquare = (logicalRow + logicalCol) % 2 === 0;
                    const isLegalTarget = learnPreferences.showLegalMoves && legalTargets.includes(square);
                    const isLastMoveSquare =
                      lastMove?.from === square || lastMove?.to === square;
                    const isDraggedSquare = draggedSquare === square;
                    const isKingInCheck = game.isCheck() && squarePiece?.type === 'k' && squarePiece?.color === game.turn();
                    const queuedPremoveFromIndex = queuedPremoves.findIndex((move) => move.from === square);
                    const queuedPremoveToIndex = queuedPremoves.findIndex((move) => move.to === square);
                    const isQueuedPremoveFrom = queuedPremoveFromIndex >= 0;
                    const isQueuedPremoveTo = queuedPremoveToIndex >= 0;

                    return (
                      <div
                        key={square}
                        onClick={() => handleSquareClick(square)}
                        onMouseDown={(e) => handleRightClickDown(e, square)}
                        onMouseUp={(e) => handleRightClickUp(e, square)}
                        onContextMenu={(e) => e.preventDefault()}
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
                        className="relative flex items-center justify-center cursor-pointer"
                      >
                        {dragOverSquare === square && (
                          <div className="absolute inset-0 ring-[3px] ring-white bg-white/20 z-20 pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                        )}
                        {rightClickHighlights.has(square) && (
                          <div className="absolute inset-0 bg-red-500/50 z-[4]" />
                        )}
                        {isLastMoveSquare && (
                          <div className="absolute inset-[4%] rounded-[4px] bg-amber-300/20" />
                        )}
                        {isQueuedPremoveFrom && (
                          <div className="absolute inset-[8%] rounded-[4px] border-[3px] border-sky-300/90 bg-sky-400/12 z-[6]" />
                        )}
                        {isQueuedPremoveTo && (
                          <div className="absolute inset-[14%] rounded-full border-[4px] border-sky-200/90 bg-sky-400/18 z-[6]" />
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
                          <span
                            className={`absolute top-0.5 left-1 text-[13px] font-[700] ${isLightSquare ? "text-[#b07b46]" : "text-[#e6ca9a]"} select-none`}
                          >
                            {8 - logicalRow}
                          </span>
                        )}

                        {visRowIndex === 7 && (
                          <span
                            className={`absolute bottom-0 right-1 text-[13px] font-[700] ${isLightSquare ? "text-[#b07b46]" : "text-[#e6ca9a]"} select-none`}
                          >
                            {FILES[logicalCol]}
                          </span>
                        )}

                        <div
                          draggable={Boolean(
                            learnPreferences.moveMethod !== "click" &&
                            squarePiece &&
                            squarePiece.color === (isPremoveTurn ? TRAINER_USER_COLOR : game.turn()),
                          )}
                          onDragStart={(event) => handleDragStart(event, square)}
                          onDragEnd={() => setDraggedSquare(null)}
                          className={`relative z-10 h-full w-full p-[2.75%] ${isDraggedSquare ? "opacity-30" : "opacity-100"}`}
                        >
                          {getPieceIcon(piece, pieceTheme)}
                        </div>
                        {isQueuedPremoveFrom && learnPreferences.premoveMode === "multiple" && (
                          <span className="absolute right-1 top-1 z-[7] flex h-5 w-5 items-center justify-center rounded-full bg-sky-300 text-[11px] font-black text-slate-900 shadow-md">
                            {queuedPremoveFromIndex + 1}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
                </div>
                {rightClickArrows.length > 0 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-[16]" viewBox="0 0 100 100" preserveAspectRatio="none" opacity="0.85">
                    <defs>
                      <marker id="right-click-arrow-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.4" markerHeight="3.4" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(255, 170, 0)" />
                      </marker>
                    </defs>
                    {rightClickArrows.map((arrow, idx) => {
                      const getCoords = (sq: Square) => {
                        const col = FILES.indexOf(sq[0] as typeof FILES[number]);
                        const row = 8 - parseInt(sq[1]);
                        const visCol = isBoardFlipped ? 7 - col : col;
                        const visRow = isBoardFlipped ? 7 - row : row;
                        return {
                          x: (visCol + 0.5) * 12.5,
                          y: (visRow + 0.5) * 12.5
                        };
                      };
                      const start = getCoords(arrow.start);
                      const end = getCoords(arrow.end);

                      const dx = end.x - start.x;
                      const dy = end.y - start.y;
                      const isKnightMove = Math.abs(dx) > 0 && Math.abs(dy) > 0 && Math.abs(dx) !== Math.abs(dy);

                      if (isKnightMove) {
                        const useXFirst = Math.abs(dx) > Math.abs(dy);
                        const corner = useXFirst ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
                        
                        return (
                          <g key={idx}>
                            <path
                              d={`M ${start.x} ${start.y} L ${corner.x} ${corner.y} L ${end.x} ${end.y}`}
                              stroke="rgb(255, 170, 0)"
                              strokeWidth="1.8"
                              fill="none"
                              strokeLinecap="butt"
                              strokeLinejoin="miter"
                              markerEnd="url(#right-click-arrow-head)"
                            />
                          </g>
                        );
                      }

                      return (
                        <g key={idx}>
                          <line
                            x1={start.x} y1={start.y}
                            x2={end.x} y2={end.y}
                            stroke="rgb(255, 170, 0)"
                            strokeWidth="1.8"
                            strokeLinecap="butt"
                            markerEnd="url(#right-click-arrow-head)"
                          />
                        </g>
                      );
                    })}
                  </svg>
                )}
                {suggestionStart && suggestionEnd && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                    <defs>
                      <marker id="suggestion-arrow-head" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L6,3 z" fill="#22d3ee" />
                      </marker>
                    </defs>
                    <line
                      x1={`${suggestionStart.x}%`}
                      y1={`${suggestionStart.y}%`}
                      x2={`${suggestionEnd.x}%`}
                      y2={`${suggestionEnd.y}%`}
                      stroke="#22d3ee"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      markerEnd="url(#suggestion-arrow-head)"
                      opacity="0.85"
                    />
                  </svg>
                )}
              </BoardImage>
            </div>
          </div>
        </div>
      </main>
      {hoverPreview ? (
        <div className="pointer-events-none fixed" style={{ left: hoverPreview.left, top: hoverPreview.top, zIndex: 999999 }}>
          <div className="shadow-2xl rounded-sm overflow-hidden bg-[var(--surface-alt)] border border-[var(--border)]">
            <MiniBoardPreview fen={hoverPreview.fen} boardTheme={boardTheme} pieceTheme={pieceTheme} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
