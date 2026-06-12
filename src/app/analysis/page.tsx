"use client";

import { useEffect, useState, useMemo, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import Link from "next/link";
import {
  Volume2,
  Search,
  BookOpen,
  Check,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Lightbulb,
  Star,
  ThumbsUp,
  X,
} from "lucide-react";
import themeManifest from "@/data/themeManifest.json";
import {
  useGameReview,
  type MoveReviewCategory,
  type ReviewedMove,
} from "../play/computer/use-game-review";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReplayOutcome = "win" | "loss" | "draw";

type ReplayArchiveEntry = {
  id: string;
  createdAt: string;
  finalFen: string;
  fenHistory: string[];
  sanMoves: string[];
  moveCount: number;
  timeControlMinutes: number;
  playerSide: "w" | "b" | "bot-vs-bot";
  opponentLabel: string;
  outcome: ReplayOutcome;
  outcomeLabel: string;
  title: string;
  reason: string;
  resultTag: "1-0" | "0-1" | "1/2-1/2";
  whiteLabel: string;
  blackLabel: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const REPLAY_ARCHIVE_STORAGE_KEY = "ChessLearn.bot.replayArchive.v1";
const BOARD_THEME_ASSETS = themeManifest.boardAssets as Record<string, string>;
const PIECE_THEME_ASSETS = themeManifest.pieceAssets as Record<string, string>;
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

const MOVE_REVIEW_TONES: Record<
  MoveReviewCategory,
  {
    label: string;
    symbol: string;
    icon: "text" | "star" | "book" | "thumbs-up" | "check" | "x";
    badgeColor: string;
    badgeTextColor: string;
    fromFill: string;
    toFill: string;
    glow: string;
  }
> = {
  book: {
    label: "Book",
    symbol: "",
    icon: "book",
    badgeColor: "#d19a66",
    badgeTextColor: "#fff",
    fromFill: "rgba(214,161,111,0.22)",
    toFill: "rgba(214,161,111,0.38)",
    glow: "rgba(214,161,111,0.42)",
  },
  brilliant: {
    label: "Brilliant",
    symbol: "!!",
    icon: "text",
    badgeColor: "#2bc7b4",
    badgeTextColor: "#fff",
    fromFill: "rgba(66,220,202,0.34)",
    toFill: "rgba(66,220,202,0.56)",
    glow: "rgba(66,220,202,0.6)",
  },
  great: {
    label: "Great Move",
    symbol: "!",
    icon: "text",
    badgeColor: "#7fa6d9",
    badgeTextColor: "#fff",
    fromFill: "rgba(126,167,217,0.28)",
    toFill: "rgba(126,167,217,0.5)",
    glow: "rgba(126,167,217,0.55)",
  },
  best: {
    label: "Best",
    symbol: "★",
    icon: "star",
    badgeColor: "#81b64c",
    badgeTextColor: "#fff",
    fromFill: "rgba(149,207,98,0.24)",
    toFill: "rgba(149,207,98,0.42)",
    glow: "rgba(149,207,98,0.45)",
  },
  excellent: {
    label: "Excellent",
    symbol: "",
    icon: "thumbs-up",
    badgeColor: "#81b64c",
    badgeTextColor: "#fff",
    fromFill: "rgba(149,207,98,0.22)",
    toFill: "rgba(149,207,98,0.36)",
    glow: "rgba(149,207,98,0.35)",
  },
  good: {
    label: "Good",
    symbol: "",
    icon: "check",
    badgeColor: "#81b64c",
    badgeTextColor: "#fff",
    fromFill: "rgba(127,186,104,0.2)",
    toFill: "rgba(127,186,104,0.32)",
    glow: "rgba(127,186,104,0.3)",
  },
  inaccuracy: {
    label: "Inaccuracy",
    symbol: "?!",
    icon: "text",
    badgeColor: "#f5c242",
    badgeTextColor: "#fff",
    fromFill: "rgba(240,173,94,0.26)",
    toFill: "rgba(240,173,94,0.42)",
    glow: "rgba(240,173,94,0.45)",
  },
  mistake: {
    label: "Mistake",
    symbol: "?",
    icon: "text",
    badgeColor: "#ffa459",
    badgeTextColor: "#fff",
    fromFill: "rgba(255,138,101,0.26)",
    toFill: "rgba(255,138,101,0.42)",
    glow: "rgba(255,138,101,0.45)",
  },
  miss: {
    label: "Miss",
    symbol: "X",
    icon: "x",
    badgeColor: "#fa5b4b",
    badgeTextColor: "#fff",
    fromFill: "rgba(250,107,95,0.22)",
    toFill: "rgba(250,107,95,0.42)",
    glow: "rgba(250,107,95,0.45)",
  },
  blunder: {
    label: "Blunder",
    symbol: "??",
    icon: "text",
    badgeColor: "#fa412d",
    badgeTextColor: "#fff",
    fromFill: "rgba(239,83,80,0.24)",
    toFill: "rgba(239,83,80,0.46)",
    glow: "rgba(239,83,80,0.48)",
  },
};

const COLLAPSED_CATEGORIES: MoveReviewCategory[] = [
  "brilliant",
  "great",
  "best",
  "mistake",
  "miss",
  "blunder",
];

const EXPANDED_CATEGORIES: MoveReviewCategory[] = [
  "brilliant",
  "great",
  "book",
  "best",
  "excellent",
  "good",
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safeParseReplayArchive = (
  serializedArchive: string | null
): ReplayArchiveEntry[] => {
  if (!serializedArchive) return [];
  try {
    const parsed = JSON.parse(serializedArchive) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ReplayArchiveEntry[];
  } catch {
    return [];
  }
};

const getSquareCenter = (sq: string) => {
  const col = FILES.indexOf(sq[0] as typeof FILES[number]);
  const row = 8 - Number(sq[1]);
  return { x: (col + 0.5) * 12.5, y: (row + 0.5) * 12.5 };
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const cpToWhiteWinPercent = (scoreCp: number | null) => {
  const cp = clamp(scoreCp ?? 0, -1000, 1000);
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
};

const getMoveAccuracy = (review: ReviewedMove) => {
  const beforeWhite = cpToWhiteWinPercent(review.beforeScoreCp);
  const afterWhite = cpToWhiteWinPercent(review.afterScoreCp);
  const before = review.mover === "w" ? beforeWhite : 100 - beforeWhite;
  const after = review.mover === "w" ? afterWhite : 100 - afterWhite;
  const winPercentLoss = Math.max(0, before - after);
  return clamp(103.1668 * Math.exp(-0.04354 * winPercentLoss) - 3.1669, 0, 100);
};

const getCategoryFromAccuracy = (accuracy: number): MoveReviewCategory => {
  if (accuracy >= 98) return "great";
  if (accuracy >= 90) return "excellent";
  if (accuracy >= 80) return "good";
  if (accuracy >= 65) return "inaccuracy";
  if (accuracy >= 45) return "mistake";
  if (accuracy >= 25) return "miss";
  return "blunder";
};

const getPhaseLabel = (plyIndex: number, totalPlies: number) => {
  if (plyIndex <= Math.min(16, totalPlies)) return "Opening";
  if (totalPlies > 32 && plyIndex > totalPlies - 16) return "Endgame";
  return "Middlegame";
};

const formatEval = (scoreCp: number | null) => {
  const pawns = (scoreCp ?? 0) / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
};

const getReviewHeadline = (review: ReviewedMove) => {
  const tone = MOVE_REVIEW_TONES[review.category];
  const label =
    review.category === "book"
      ? "is a book move"
      : `is ${tone.label.toLowerCase()}`;
  return `${review.san} ${label}`;
};

const getReviewExplanation = (review: ReviewedMove) => {
  if (review.category === "book") {
    return review.mover === "w"
      ? "Solid opening choice. You are developing normally and keeping central control."
      : "Your opponent is following known opening play, so the position is still in book.";
  }
  if (review.category === "brilliant") {
    return "This move finds a difficult tactical idea and keeps the position working in your favor.";
  }
  if (review.category === "great") {
    return "This is a strong move that improves the position and avoids the main tactical problems.";
  }
  if (review.category === "best") {
    return review.bestMoveSan
      ? `This matches the engine's top choice: ${review.bestMoveSan}.`
      : "This keeps the position at its best according to the engine.";
  }
  if (review.category === "excellent") {
    return "This is a clean move that keeps your advantage or holds the position well.";
  }
  if (review.category === "good") {
    return "This is playable and does not change the evaluation much.";
  }
  if (review.category === "inaccuracy") {
    return review.bestMoveSan
      ? `This gives up a little. ${review.bestMoveSan} was more precise.`
      : "This gives up a little accuracy, but the position remains playable.";
  }
  if (review.category === "mistake") {
    return review.bestMoveSan
      ? `This loses ground. The stronger move was ${review.bestMoveSan}.`
      : "This changes the position in your opponent's favor.";
  }
  if (review.category === "miss") {
    return review.bestMoveSan
      ? `This misses a better chance. The engine preferred ${review.bestMoveSan}.`
      : "This misses a chance to improve the position.";
  }
  return review.bestMoveSan
    ? `This is a major swing. ${review.bestMoveSan} was the best move.`
    : "This is a major swing in the evaluation.";
};

function ReviewSymbol({
  category,
  className = "",
  iconClassName = "h-4 w-4",
}: {
  category: MoveReviewCategory;
  className?: string;
  iconClassName?: string;
}) {
  const tone = MOVE_REVIEW_TONES[category];
  const commonProps = {
    className: iconClassName,
    strokeWidth: 3,
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-black leading-none shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_2px_8px_rgba(0,0,0,0.28)] ${className}`}
      style={{
        backgroundColor: tone.badgeColor,
        color: tone.badgeTextColor,
      }}
    >
      {tone.icon === "book" ? (
        <BookOpen {...commonProps} />
      ) : tone.icon === "star" ? (
        <Star {...commonProps} fill="currentColor" />
      ) : tone.icon === "thumbs-up" ? (
        <ThumbsUp {...commonProps} fill="currentColor" />
      ) : tone.icon === "check" ? (
        <Check {...commonProps} />
      ) : tone.icon === "x" ? (
        <X {...commonProps} />
      ) : (
        <span>{tone.symbol}</span>
      )}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function AnalysisContent() {
  const searchParams = useSearchParams();
  const id = searchParams?.get("id");

  const [gameEntry, setGameEntry] = useState<ReplayArchiveEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [isPlayingHistory, setIsPlayingHistory] = useState(false);
  const [hasStartedReview, setHasStartedReview] = useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);

  // Celebration state
  const [celebrationPly, setCelebrationPly] = useState<number | null>(null);
  const [celebrationPhase, setCelebrationPhase] = useState<
    "hidden" | "center" | "corner"
  >("hidden");
  const [showCelebrationLabel, setShowCelebrationLabel] = useState(false);
  const celebTimers = useRef<number[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(REPLAY_ARCHIVE_STORAGE_KEY);
    const archive = safeParseReplayArchive(stored);
    const found = archive.find((g) => g.id === id);
    const loadTimer = window.setTimeout(() => {
      if (found) {
        setGameEntry(found);
        setCurrentMoveIndex(0);
        setHasStartedReview(false);
        setIsPlayingHistory(false);
        setIsStatsExpanded(false);
      } else {
        setGameEntry(null);
      }
      setLoading(false);
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [id]);

  // Stable memoised references so useGameReview deps don't change on every render
  const history = useMemo(() => gameEntry?.fenHistory ?? [], [gameEntry]);
  const sanHistory = useMemo(() => gameEntry?.sanMoves ?? [], [gameEntry]);

  // Only enable analysis once the game has fully loaded
  const analysisEnabled = !loading && !!gameEntry && history.length >= 2 && sanHistory.length > 0;

  const { status, progressPercent, reviews, currentPly } = useGameReview(
    history,
    sanHistory,
    analysisEnabled,
    "stockfish-18-lite",
    1,
    200
  );

  const isAnalyzing = status === "analyzing" || status === "loading";
  const finalMoveIndex = Math.max(0, history.length - 1);
  const displayMoveIndex = isAnalyzing
    ? clamp(currentPly, 0, finalMoveIndex)
    : status === "ready" && !hasStartedReview
      ? finalMoveIndex
      : clamp(currentMoveIndex, 0, finalMoveIndex);
  const currentFen =
    history[displayMoveIndex] ??
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  // While analyzing → follow the engine's current ply on the board
  // Auto-play history once analysis is ready
  // Step playback timer during review replay
  useEffect(() => {
    if (!isPlayingHistory || status !== "ready") return;
    if (currentMoveIndex >= history.length - 1) return;
    const t = window.setTimeout(() => {
      setCurrentMoveIndex((prev) => {
        const next = Math.min(history.length - 1, prev + 1);
        if (next >= history.length - 1) {
          window.setTimeout(() => setIsPlayingHistory(false), 0);
        }
        return next;
      });
    }, 900);
    return () => window.clearTimeout(t);
  }, [isPlayingHistory, currentMoveIndex, history.length, status]);

  // Celebration for brilliant/great moves
  const currentReview: ReviewedMove | null =
    reviews[displayMoveIndex] ?? null;
  const currentTone = currentReview
    ? MOVE_REVIEW_TONES[currentReview.category]
    : null;
  const reviewRows = useMemo(() => {
    const rows: Array<{
      moveNumber: number;
      white: { san: string; ply: number; review: ReviewedMove | null } | null;
      black: { san: string; ply: number; review: ReviewedMove | null } | null;
    }> = [];

    for (let index = 0; index < sanHistory.length; index += 2) {
      const whitePly = index + 1;
      const blackPly = index + 2;
      rows.push({
        moveNumber: Math.floor(index / 2) + 1,
        white: sanHistory[index]
          ? {
              san: sanHistory[index],
              ply: whitePly,
              review: reviews[whitePly] ?? null,
            }
          : null,
        black: sanHistory[index + 1]
          ? {
              san: sanHistory[index + 1],
              ply: blackPly,
              review: reviews[blackPly] ?? null,
            }
          : null,
      });
    }

    return rows;
  }, [reviews, sanHistory]);
  const reviewMoveAccuracy = currentReview ? getMoveAccuracy(currentReview) : null;
  const reviewEvalLabel = currentReview ? formatEval(currentReview.afterScoreCp) : "+0.00";

  useEffect(() => {
    celebTimers.current.forEach(clearTimeout);
    celebTimers.current = [];

    if (
      !currentReview ||
      (currentReview.category !== "great" &&
        currentReview.category !== "brilliant")
    ) {
      const resetTimer = window.setTimeout(() => {
        setCelebrationPly(null);
        setCelebrationPhase("hidden");
        setShowCelebrationLabel(false);
      }, 0);
      celebTimers.current = [resetTimer];
      return;
    }

    const startTimer = window.setTimeout(() => {
      setCelebrationPly(currentReview.plyIndex);
      setCelebrationPhase("center");
      setShowCelebrationLabel(false);
    }, 0);

    const t1 = window.setTimeout(() => setCelebrationPhase("corner"), 190);
    const t2 = window.setTimeout(() => setShowCelebrationLabel(true), 250);
    const t3 = window.setTimeout(() => setShowCelebrationLabel(false), 1000);
    const t4 = window.setTimeout(() => {
      setCelebrationPhase("hidden");
      setCelebrationPly(null);
    }, 1400);
    celebTimers.current = [startTimer, t1, t2, t3, t4];
    return () => celebTimers.current.forEach(clearTimeout);
  }, [currentReview]);

  // Stats
  const stats = useMemo(() => {
    const counts = {
      w: {} as Record<MoveReviewCategory, number>,
      b: {} as Record<MoveReviewCategory, number>,
    };
    const all: MoveReviewCategory[] = [
      "brilliant",
      "great",
      "best",
      "excellent",
      "good",
      "inaccuracy",
      "mistake",
      "miss",
      "blunder",
      "book",
    ];
    all.forEach((c) => {
      counts.w[c] = 0;
      counts.b[c] = 0;
    });
    Object.values(reviews).forEach((r) => {
      if (counts[r.mover]?.[r.category] !== undefined) {
        counts[r.mover][r.category]++;
      }
    });
    const calcAcc = (side: "w" | "b") => {
      const sr = Object.values(reviews).filter((r) => r.mover === side);
      if (!sr.length) return 0;
      return sr.reduce((sum, review) => sum + getMoveAccuracy(review), 0) / sr.length;
    };
    return { counts, accW: calcAcc("w"), accB: calcAcc("b") };
  }, [reviews]);

  const visibleCategories = isStatsExpanded
    ? EXPANDED_CATEGORIES
    : COLLAPSED_CATEGORIES;
  const estimateRating = (accuracy: number) =>
    status === "ready" ? Math.round(clamp(250 + accuracy * 15, 250, 2300)) : null;
  const whiteGameRating = estimateRating(stats.accW);
  const blackGameRating = estimateRating(stats.accB);
  const graphPoints = useMemo(() => {
    if (status !== "ready") return [];

    const points = [
      {
        ply: 0,
        score: Object.values(reviews).find((review) => review.beforeScoreCp !== null)
          ?.beforeScoreCp ?? 0,
        color: "rgba(148,163,184,0.9)",
      },
      ...sanHistory.map((_, index) => {
        const ply = index + 1;
        const review = reviews[ply];
        return {
          ply,
          score: review?.afterScoreCp ?? review?.beforeScoreCp ?? 0,
          color: review
            ? MOVE_REVIEW_TONES[review.category].badgeColor
            : "rgba(148,163,184,0.9)",
        };
      }),
    ];

    return points.map((point, index) => {
      const score = clamp(point.score, -1000, 1000);
      const review = index === 0 ? null : reviews[index];
      const isNotable =
        !!review &&
        (review.category === "brilliant" ||
          review.category === "great" ||
          review.category === "inaccuracy" ||
          review.category === "mistake" ||
          review.category === "miss" ||
          review.category === "blunder" ||
          (review.category === "best" &&
            (review.isCheck || review.isCapture || review.isSacrifice)));
      return {
        x: (index / Math.max(1, points.length - 1)) * 100,
        y: 21 - (score / 1000) * 18,
        color: point.color,
        review,
        isNotable,
      };
    });
  }, [reviews, sanHistory, status]);
  const graphPath = graphPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const reversedGraphPath = [...graphPoints]
    .reverse()
    .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const graphDarkAreaPath =
    graphPoints.length > 0
      ? `M 0 0 H 100 V ${graphPoints[graphPoints.length - 1].y.toFixed(2)} ${reversedGraphPath} Z`
      : "";
  const graphLightAreaPath =
    graphPoints.length > 0
      ? `M 0 42 H 100 V ${graphPoints[graphPoints.length - 1].y.toFixed(2)} ${reversedGraphPath} Z`
      : "";
  const graphMarks = graphPoints.filter((point) => point.isNotable);
  const phaseSummaries = useMemo(() => {
    const phaseLabels = ["Opening", "Middlegame", "Endgame"] as const;
    return phaseLabels.map((phase) => {
      const sideSummary = (side: "w" | "b") => {
        const phaseReviews = Object.values(reviews).filter(
          (review) =>
            review.mover === side &&
            getPhaseLabel(review.plyIndex, sanHistory.length) === phase
        );
        if (!phaseReviews.length) {
          return { accuracy: null as number | null, category: "good" as MoveReviewCategory };
        }
        const accuracy =
          phaseReviews.reduce((sum, review) => sum + getMoveAccuracy(review), 0) /
          phaseReviews.length;
        return {
          accuracy,
          category: getCategoryFromAccuracy(accuracy),
        };
      };

      return {
        label: phase,
        w: sideSummary("w"),
        b: sideSummary("b"),
      };
    });
  }, [reviews, sanHistory.length]);

  // Board rendering
  let boardObj: Chess;
  try {
    boardObj = new Chess(currentFen);
  } catch {
    boardObj = new Chess();
  }
  const boardRows = boardObj.board();
  const boardTheme = themeManifest.defaultBoardTheme;
  const pieceTheme = themeManifest.defaultPieceTheme;

  // Celebration coords
  const celebrationReview =
    celebrationPly !== null ? reviews[celebrationPly] ?? null : null;
  const celebrationTone = celebrationReview
    ? MOVE_REVIEW_TONES[celebrationReview.category]
    : null;
  const celebrationCoords = celebrationReview
    ? getSquareCenter(celebrationReview.to)
    : null;

  // Manual controls (only when ready)
  const handleFirstMove = () => {
    setHasStartedReview(true);
    setIsPlayingHistory(false);
    setCurrentMoveIndex(1);
  };
  const handlePrevMove = () => {
    setHasStartedReview(true);
    setIsPlayingHistory(false);
    setCurrentMoveIndex((prev) => Math.max(0, prev - 1));
  };
  const handleNextMove = () => {
    setHasStartedReview(true);
    setIsPlayingHistory(false);
    setCurrentMoveIndex((prev) => Math.min(history.length - 1, prev + 1));
  };
  const handleLastMove = () => {
    setHasStartedReview(true);
    setIsPlayingHistory(false);
    setCurrentMoveIndex(history.length - 1);
  };
  const togglePlayback = () => {
    if (isAnalyzing) return;
    setHasStartedReview(true);
    if (currentMoveIndex <= 0 || currentMoveIndex >= history.length - 1) {
      setCurrentMoveIndex(1);
      setIsPlayingHistory(true);
      return;
    }
    setIsPlayingHistory((prev) => !prev);
  };
  const startReview = () => {
    if (isAnalyzing) return;
    setHasStartedReview(true);
    setIsPlayingHistory(false);
    setCurrentMoveIndex(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--text-primary)]">
        <div className="text-lg text-[var(--text-secondary)]">
          Loading game...
        </div>
      </div>
    );
  }

  if (!gameEntry) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--text-primary)]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No Game Found</h2>
          <p className="text-[var(--text-secondary)] mb-6">
            Could not find a valid game replay.
          </p>
          <Link
            href="/play/computer"
            className="px-6 py-3 bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] text-[var(--cta-text)] font-bold rounded-lg transition-colors"
          >
            Play a Game
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] flex select-none justify-center">
      <div className="w-full max-w-5xl flex flex-col md:flex-row p-4 md:p-6 gap-6 justify-center items-start overflow-auto">

        {/* ── Board Section ── */}
        <div className="w-full max-w-[600px] flex flex-col items-center">

          {/* Black player */}
          <div className="w-full flex items-center justify-between mb-2 px-1">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[var(--surface-alt)] border border-[var(--border)] rounded-sm overflow-hidden flex items-center justify-center">
                <span className="text-2xl text-[var(--text-primary)]">♙</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm text-[var(--text-primary)]">
                  {gameEntry.blackLabel}
                </span>
              </div>
            </div>

            {/* Live move badge (top) */}
            {currentTone && currentReview && currentReview.mover === "b" && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-md animate-[fadeIn_0.2s_ease]"
                style={{
                  backgroundColor: currentTone.badgeColor,
                  color: currentTone.badgeTextColor,
                }}
              >
                <ReviewSymbol
                  category={currentReview.category}
                  className="h-6 w-6 text-[12px]"
                  iconClassName="h-3.5 w-3.5"
                />
                <span>{currentTone.label}</span>
              </div>
            )}
          </div>

          {/* Board */}
          <div className="w-full relative aspect-square overflow-hidden rounded-sm border-2 border-[var(--border)] shadow-2xl">
            {/* Board background */}
            <img
              src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`}
              alt="Board"
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Grid */}
            <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
              {boardRows.map((row, rowIndex) =>
                row.map((piece, colIndex) => {
                  const square = `${FILES[colIndex]}${8 - rowIndex}` as Square;
                  const pieceCode = piece
                    ? `${piece.color}${piece.type}`
                    : null;
                  const isFromSq = currentReview?.from === square;
                  const isToSq = currentReview?.to === square;

                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className="relative flex items-center justify-center p-[4%]"
                    >
                      {/* Rank labels */}
                      {colIndex === 0 && (
                        <span className="absolute top-0.5 left-0.5 text-[10px] font-bold text-white/60 select-none z-10">
                          {8 - rowIndex}
                        </span>
                      )}
                      {/* File labels */}
                      {rowIndex === 7 && (
                        <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-white/60 select-none z-10">
                          {FILES[colIndex]}
                        </span>
                      )}

                      {/* Square highlight */}
                      {currentTone && (isFromSq || isToSq) && (
                        <div
                          className="absolute inset-0 transition-all duration-300"
                          style={{
                            backgroundColor: isToSq
                              ? currentTone.toFill
                              : currentTone.fromFill,
                            boxShadow: isToSq
                              ? `inset 0 0 10px ${currentTone.glow}`
                              : undefined,
                          }}
                        />
                      )}

                      {/* Piece */}
                      {pieceCode && (
                        <div
                          className="relative z-10 h-full w-full"
                          style={
                            isToSq && currentTone
                              ? {
                                  filter: `drop-shadow(0 0 10px ${currentTone.glow})`,
                                }
                              : undefined
                          }
                        >
                          <img
                            src={`${PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`}/${pieceCode}.png`}
                            alt={pieceCode}
                            className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)]"
                          />
                        </div>
                      )}

                      {/* Category badge on target square */}
                      {isToSq && currentReview && currentTone && (
                        <ReviewSymbol
                          category={currentReview.category}
                          className="absolute right-0.5 top-0.5 z-20 h-6 w-6 text-[11px] transition-opacity duration-300"
                          iconClassName="h-3.5 w-3.5"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Celebration overlay (brilliant / great) */}
            {celebrationTone &&
              celebrationCoords &&
              celebrationPhase !== "hidden" && (
                <div className="pointer-events-none absolute inset-0 z-[90]">
                  <div
                    className="absolute flex h-16 w-16 items-center justify-center rounded-full text-[28px] font-black shadow-2xl transition-all duration-500"
                    style={
                      celebrationPhase === "center"
                        ? {
                            left: "50%",
                            top: "50%",
                            backgroundColor: celebrationTone.badgeColor,
                            color: celebrationTone.badgeTextColor,
                            opacity: 1,
                            transform: "translate(-50%, -50%) scale(1.08)",
                          }
                        : {
                            left: `${celebrationCoords.x}%`,
                            top: `${celebrationCoords.y}%`,
                            backgroundColor: celebrationTone.badgeColor,
                            color: celebrationTone.badgeTextColor,
                            opacity: 1,
                            transform: "translate(15%, -115%) scale(0.45)",
                          }
                    }
                  >
                    {celebrationReview && (
                      <ReviewSymbol
                        category={celebrationReview.category}
                        className="h-full w-full text-[28px] shadow-none"
                        iconClassName="h-8 w-8"
                      />
                    )}
                  </div>

                  {/* Label pop */}
                  <div
                    className="absolute rounded-full px-4 py-1.5 text-[15px] border-[2.5px] border-white font-black shadow-2xl transition-all duration-300"
                    style={{
                      left: `${celebrationCoords.x}%`,
                      top: `${celebrationCoords.y}%`,
                      backgroundColor: celebrationTone.badgeColor,
                      color: "#fff",
                      opacity: showCelebrationLabel ? 1 : 0,
                      transform: showCelebrationLabel
                        ? "translate(-50%, -200%) scale(1)"
                        : "translate(-50%, -150%) scale(0.92)",
                    }}
                  >
                    {celebrationTone.label}
                  </div>
                </div>
              )}
          </div>

          {/* White player + controls */}
          <div className="w-full flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--surface-alt)] border border-[var(--border)] rounded-sm overflow-hidden flex items-center justify-center">
                <span className="text-2xl text-[var(--text-primary)]">♘</span>
              </div>
              <span className="font-semibold text-sm text-[var(--text-primary)]">
                {gameEntry.whiteLabel}
              </span>

              {/* Live move badge (bottom) */}
              {currentTone && currentReview && currentReview.mover === "w" && (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-md animate-[fadeIn_0.2s_ease]"
                  style={{
                    backgroundColor: currentTone.badgeColor,
                    color: currentTone.badgeTextColor,
                  }}
                >
                  <ReviewSymbol
                    category={currentReview.category}
                    className="h-6 w-6 text-[12px]"
                    iconClassName="h-3.5 w-3.5"
                  />
                  <span>{currentTone.label}</span>
                </div>
              )}
            </div>

            {/* Playback controls */}
            <div className="flex items-center bg-[var(--surface)] rounded-md overflow-hidden border border-[var(--border)]">
              <button
                onClick={handleFirstMove}
                disabled={isAnalyzing}
                className="p-2 hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
              >
                <ChevronsLeft size={20} />
              </button>
              <button
                onClick={handlePrevMove}
                disabled={isAnalyzing}
                className="p-2 hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={togglePlayback}
                disabled={isAnalyzing}
                className="px-3 py-2 hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40 text-[11px] font-bold"
              >
                {isPlayingHistory ? "⏸" : "▶"}
              </button>
              <button
                onClick={handleNextMove}
                disabled={isAnalyzing}
                className="p-2 hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
              >
                <ChevronRight size={20} />
              </button>
              <button
                onClick={handleLastMove}
                disabled={isAnalyzing}
                className="p-2 hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
              >
                <ChevronsRight size={20} />
              </button>
            </div>
          </div>

          {/* Move counter */}
          <div className="w-full mt-2 px-1 text-[12px] text-[var(--text-muted)] text-right">
            Move {Math.max(0, displayMoveIndex)} / {Math.max(0, history.length - 1)}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="w-full max-w-[380px] bg-[var(--surface)] rounded-lg border border-[var(--border)] flex flex-col overflow-hidden shrink-0 shadow-xl">

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--bg)]">
            <div className="flex items-center space-x-2 text-[var(--text-primary)]">
              <Star size={18} fill="currentColor" />
              <span className="font-bold tracking-wide">Game Review</span>
            </div>
            <div className="flex items-center space-x-3 text-[var(--text-secondary)]">
              <Volume2
                size={18}
                className="cursor-pointer hover:text-[var(--text-primary)] transition-colors"
              />
              <Search
                size={18}
                className="cursor-pointer hover:text-[var(--text-primary)] transition-colors"
              />
            </div>
          </div>

          {hasStartedReview && status === "ready" ? (
            <div className="flex min-h-[720px] flex-col bg-[#262522] text-white">
              <div className="flex items-center justify-between border-b border-black/30 px-4 py-3">
                <div className="flex items-center gap-4 text-white/80">
                  <button
                    type="button"
                    onClick={() => setHasStartedReview(false)}
                    className="rounded-md p-1 hover:bg-white/10"
                    aria-label="Back to review summary"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <Settings size={21} />
                </div>
                <div className="text-lg font-black">Game Review</div>
                <div className="flex items-center gap-4 text-white/80">
                  <Volume2 size={20} />
                  <Search size={20} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-4 flex items-start gap-3">
                  <div className="mt-3 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white/10 bg-[#ede8dc] text-sm font-black text-[#24231f]">
                    AI
                  </div>
                  <div className="relative flex-1 rounded-xl bg-white px-4 py-3 text-[#111] shadow-lg before:absolute before:left-[-10px] before:top-10 before:h-0 before:w-0 before:border-y-[10px] before:border-r-[12px] before:border-y-transparent before:border-r-white">
                    {currentReview && currentTone ? (
                      <>
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2 text-[17px] font-black">
                            <ReviewSymbol
                              category={currentReview.category}
                              className="h-7 w-7 shrink-0 text-[12px]"
                              iconClassName="h-4 w-4"
                            />
                            <span className="truncate">{getReviewHeadline(currentReview)}</span>
                          </div>
                          <a
                            href="https://support.chess.com/article/656-what-do-the-computer-evaluation-numbers-mean-like-225"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-[#2b2b2b] px-2.5 py-1 text-sm font-black text-white"
                          >
                            {reviewEvalLabel}
                          </a>
                        </div>
                        <p className="text-[15px] font-semibold leading-snug">
                          {getReviewExplanation(currentReview)}
                        </p>
                      </>
                    ) : (
                      <p className="text-[15px] font-semibold">
                        Select a move to begin the review.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 rounded-md border border-black/40 bg-gradient-to-b from-[#45433f] to-[#34322f] px-3 py-3 text-sm font-black shadow-inner"
                  >
                    {currentReview?.bestMoveSan ? (
                      <>
                        <ReviewSymbol
                          category="best"
                          className="h-6 w-6 text-[11px]"
                          iconClassName="h-3.5 w-3.5"
                        />
                        <span>{currentReview.bestMoveSan}</span>
                      </>
                    ) : (
                      <>
                        <ReviewSymbol
                          category="best"
                          className="h-6 w-6 text-[11px]"
                          iconClassName="h-3.5 w-3.5"
                        />
                        <span>Best</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 rounded-md border border-black/40 bg-gradient-to-b from-[#45433f] to-[#34322f] px-3 py-3 text-sm font-black shadow-inner"
                    title={currentReview ? `Move accuracy: ${reviewMoveAccuracy?.toFixed(1)}` : undefined}
                  >
                    <Lightbulb size={18} fill="currentColor" />
                    Explain
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMove}
                    disabled={displayMoveIndex >= finalMoveIndex}
                    className="flex items-center justify-center gap-2 rounded-md border border-[#4f8d2d] bg-gradient-to-b from-[#8dcc58] to-[#67a642] px-3 py-3 text-sm font-black text-white shadow disabled:opacity-50"
                  >
                    <ChevronRight size={22} strokeWidth={4} />
                    Next
                  </button>
                </div>

                <div className="mb-3 max-h-56 overflow-y-auto border-y border-white/5 text-sm font-bold">
                  {reviewRows.map((row) => (
                    <div
                      key={row.moveNumber}
                      className="grid grid-cols-[48px_1fr_1fr] items-center border-b border-white/5 odd:bg-white/[0.035] even:bg-black/10"
                    >
                      <div className="px-3 py-2 text-white/65">{row.moveNumber}.</div>
                      {[row.white, row.black].map((move) => {
                        if (!move) {
                          return <div key="empty" className="px-3 py-2" />;
                        }
                        const isCurrent = move.ply === displayMoveIndex;
                        return (
                          <button
                            key={move.ply}
                            type="button"
                            onClick={() => {
                              setHasStartedReview(true);
                              setIsPlayingHistory(false);
                              setCurrentMoveIndex(move.ply);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-2 text-left transition-colors ${
                              isCurrent
                                ? "bg-white/12 text-white"
                                : "text-white/85 hover:bg-white/10"
                            }`}
                          >
                            {move.review && (
                              <ReviewSymbol
                                category={move.review.category}
                                className="h-5 w-5 shrink-0 text-[9px]"
                                iconClassName="h-3 w-3"
                              />
                            )}
                            <span className={isCurrent ? "rounded bg-white/20 px-1" : ""}>
                              {move.san}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-md border border-black/40 bg-[#3b3935]">
                  <svg
                    viewBox="0 0 100 42"
                    className="h-24 w-full"
                    preserveAspectRatio="none"
                    aria-label="Evaluation graph"
                  >
                    <rect x="0" y="0" width="100" height="42" fill="#ffffff" />
                    {graphLightAreaPath && <path d={graphLightAreaPath} fill="#f7f7f2" />}
                    {graphDarkAreaPath && <path d={graphDarkAreaPath} fill="#3b3935" />}
                    <line x1="0" y1="21" x2="100" y2="21" stroke="rgba(126,126,118,0.55)" strokeWidth="0.55" />
                    {graphPath && (
                      <path
                        d={graphPath}
                        fill="none"
                        stroke="#24231f"
                        strokeWidth="1.15"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {graphMarks.map((point, index) => (
                      <circle
                        key={`${point.x}-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r="1.35"
                        fill={point.color}
                        stroke="rgba(255,255,255,0.95)"
                        strokeWidth="0.7"
                      />
                    ))}
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2 border-t border-black/30 bg-[#1f1e1b] p-3">
                <button onClick={handleFirstMove} className="rounded-lg bg-gradient-to-b from-[#3f3d39] to-[#2b2926] py-4 text-white/85 shadow">
                  <ChevronsLeft className="mx-auto" size={28} />
                </button>
                <button onClick={handlePrevMove} className="rounded-lg bg-gradient-to-b from-[#3f3d39] to-[#2b2926] py-4 text-white/85 shadow">
                  <ChevronLeft className="mx-auto" size={28} />
                </button>
                <button onClick={togglePlayback} className="rounded-lg bg-gradient-to-b from-[#3f3d39] to-[#2b2926] py-4 text-white/85 shadow">
                  <span className="block text-center text-2xl">{isPlayingHistory ? "⏸" : "▶"}</span>
                </button>
                <button onClick={handleNextMove} className="rounded-lg bg-gradient-to-b from-[#3f3d39] to-[#2b2926] py-4 text-white/85 shadow">
                  <ChevronRight className="mx-auto" size={28} />
                </button>
                <button onClick={handleLastMove} className="rounded-lg bg-gradient-to-b from-[#3f3d39] to-[#2b2926] py-4 text-white/85 shadow">
                  <ChevronsRight className="mx-auto" size={28} />
                </button>
              </div>
            </div>
          ) : (
          <>
          <div className="p-4 flex flex-col flex-1 overflow-y-auto">

            {/* Coach Message */}
            <div className="flex items-start space-x-3 mb-6">
              <div className="w-14 h-14 shrink-0 rounded-full bg-[var(--bg-alt)] border-2 border-[var(--border)] overflow-hidden flex items-center justify-center">
                <span className="text-sm font-black text-[var(--text-primary)]">AI</span>
              </div>
              <div className="flex-1 bg-[var(--text-primary)] text-[var(--bg)] p-3 rounded-2xl rounded-tl-sm text-sm font-medium leading-tight relative shadow-sm">
                {isAnalyzing
                  ? "Analyzing your game… watch the board as we go through every move!"
                  : "Analysis complete! Let's review how you played."}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-6 relative">
              <div className="w-full h-10 bg-[var(--surface-alt)] rounded-md overflow-hidden relative border border-[var(--border)]">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-[var(--cta-bg)] transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[var(--text-primary)] mix-blend-difference pointer-events-none">
                {isAnalyzing ? `${progressPercent}%` : "Analysis Complete"}
              </div>
            </div>

            {/* Current move label during analysis */}
            {isAnalyzing && currentReview && currentTone && (
              <div
                className="mb-4 flex items-center gap-3 px-3 py-2 rounded-lg border text-sm font-semibold transition-all duration-300"
                style={{
                  backgroundColor: currentTone.toFill,
                  borderColor: currentTone.badgeColor + "55",
                  color: currentTone.badgeColor,
                }}
              >
                <ReviewSymbol
                  category={currentReview.category}
                  className="h-7 w-7 shrink-0 text-[13px]"
                  iconClassName="h-4 w-4"
                />
                <span>
                  {sanHistory[displayMoveIndex - 1] ?? ""} —{" "}
                  <span className="font-bold">{currentTone.label}</span>
                </span>
              </div>
            )}

            <div className="mb-6 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-alt)]">
              <svg
                viewBox="0 0 100 42"
                className="h-24 w-full"
                preserveAspectRatio="none"
                aria-label="Evaluation graph"
              >
                <rect x="0" y="0" width="100" height="42" fill="#ffffff" />
                {status === "ready" && graphLightAreaPath && (
                  <path d={graphLightAreaPath} fill="#f7f7f2" />
                )}
                {status === "ready" && graphDarkAreaPath && (
                  <path d={graphDarkAreaPath} fill="#3b3935" />
                )}
                <line x1="0" y1="21" x2="100" y2="21" stroke="rgba(126,126,118,0.55)" strokeWidth="0.55" />
                <line x1="0" y1="10.5" x2="100" y2="10.5" stroke="rgba(255,255,255,0.16)" strokeWidth="0.35" />
                <line x1="0" y1="31.5" x2="100" y2="31.5" stroke="rgba(40,40,36,0.12)" strokeWidth="0.35" />
                {status === "ready" && graphPath && (
                  <path
                    d={graphPath}
                    fill="none"
                    stroke="#24231f"
                    strokeWidth="1.15"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {graphMarks.map((point, index) => (
                  <circle
                    key={`${point.x}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r="1.35"
                    fill={point.color}
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth="0.7"
                  >
                    <title>
                      {point.review
                        ? `${point.review.moveNumber}. ${point.review.san} • ${MOVE_REVIEW_TONES[point.review.category].label}`
                        : "Evaluation mark"}
                    </title>
                  </circle>
                ))}
              </svg>
            </div>

            {/* Accuracy & Avatars */}
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-[var(--border)]">
              <div className="text-sm font-semibold text-[var(--text-secondary)] w-20">
                Players
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] mb-2 truncate w-24 text-center">
                  {gameEntry.whiteLabel}
                </span>
                <div className="w-12 h-12 rounded-sm bg-[var(--surface-alt)] mb-3 overflow-hidden border border-[var(--border)] flex items-center justify-center">
                  <span className="text-sm font-black text-[var(--text-primary)]">
                    {gameEntry.whiteLabel.slice(0, 1).toUpperCase() || "W"}
                  </span>
                </div>
                <div className="w-14 py-1 bg-[var(--text-primary)] text-[var(--bg)] rounded text-center font-bold text-sm">
                  {status === "ready" ? stats.accW.toFixed(1) : "—"}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] mb-2 truncate w-24 text-center">
                  {gameEntry.blackLabel}
                </span>
                <div className="w-12 h-12 rounded-sm bg-[var(--surface-alt)] mb-3 overflow-hidden flex items-center justify-center border border-[var(--border)]">
                  <span className="text-3xl text-[var(--text-primary)]">♙</span>
                </div>
                <div className="w-14 py-1 bg-[var(--text-primary)] text-[var(--bg)] rounded text-center font-bold text-sm">
                  {status === "ready" ? stats.accB.toFixed(1) : "—"}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-sm font-semibold text-[var(--text-secondary)] mb-4">
              <span className="w-20">Accuracy</span>
            </div>

            {/* Move Stats */}
            <div className="flex flex-col space-y-2 mb-6">
              {visibleCategories.map((category) => {
                const tone = MOVE_REVIEW_TONES[category];
                return (
                  <div
                    key={category}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="w-20 font-semibold text-[var(--text-secondary)]">
                      {tone.label}
                    </div>
                    <div
                      className="flex items-center justify-center w-8 font-bold"
                      style={{ color: tone.badgeColor }}
                    >
                      {status === "ready" ? stats.counts.w[category] || 0 : 0}
                    </div>
                    <div
                      className="flex w-10 items-center justify-center"
                    >
                      <ReviewSymbol
                        category={category}
                        className="h-7 w-7 text-[12px]"
                        iconClassName="h-4 w-4"
                      />
                    </div>
                    <div
                      className="flex items-center justify-center w-8 font-bold"
                      style={{ color: tone.badgeColor }}
                    >
                      {status === "ready" ? stats.counts.b[category] || 0 : 0}
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setIsStatsExpanded((prev) => !prev)}
                className="flex justify-center mt-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label={isStatsExpanded ? "Collapse move categories" : "Show all move categories"}
              >
                {isStatsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>

            {/* Game Rating */}
            <div className="flex items-center justify-between bg-[var(--bg-alt)] p-3 rounded-md border border-[var(--border)] mb-4">
              <span className="text-sm font-semibold text-[var(--text-secondary)]">
                Game Rating
              </span>
              <div className="flex space-x-6">
                <div className="w-14 py-1 bg-[var(--text-primary)] text-[var(--bg)] rounded text-center font-bold text-sm">
                  {whiteGameRating ?? "—"}
                </div>
                <div className="w-14 py-1 bg-[var(--text-primary)] text-[var(--bg)] rounded text-center font-bold text-sm">
                  {blackGameRating ?? "—"}
                </div>
              </div>
            </div>

            {/* Phase Evaluation */}
            <div className="flex flex-col space-y-3 mb-6 bg-[var(--bg-alt)] p-3 rounded-md border border-[var(--border)]">
              {phaseSummaries.map(({ label, w, b }) => (
                <div
                  key={label}
                  className="flex items-center justify-between text-sm font-semibold"
                >
                  <span className="text-[var(--text-secondary)]">{label}</span>
                  <div className="flex space-x-8">
                    <div
                      title={`${label} Accuracy: ${
                        w.accuracy === null ? "No moves" : w.accuracy.toFixed(1)
                      }`}
                    >
                      {w.accuracy === null ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-alt)] text-xs text-[var(--text-muted)]">
                          -
                        </span>
                      ) : (
                        <ReviewSymbol
                          category={w.category}
                          className="h-7 w-7 text-[12px]"
                          iconClassName="h-4 w-4"
                        />
                      )}
                    </div>
                    <div
                      title={`${label} Accuracy: ${
                        b.accuracy === null ? "No moves" : b.accuracy.toFixed(1)
                      }`}
                    >
                      {b.accuracy === null ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-alt)] text-xs text-[var(--text-muted)]">
                          -
                        </span>
                      ) : (
                        <ReviewSymbol
                          category={b.category}
                          className="h-7 w-7 text-[12px]"
                          iconClassName="h-4 w-4"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-[var(--bg)] border-t border-[var(--border)] flex flex-col space-y-3">
            <Link
              href="/play/computer"
              className="w-full py-3 bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] font-bold rounded-md shadow-sm transition-colors border border-[var(--border)] text-center"
            >
              New Game
            </Link>
            <button
              onClick={startReview}
              disabled={isAnalyzing}
              className="w-full py-3 bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] text-[var(--cta-text)] font-bold text-lg rounded-md shadow-md transition-colors border-none disabled:opacity-50"
            >
              {isAnalyzing
                ? `Analyzing… ${progressPercent}%`
                : hasStartedReview
                  ? "Restart Review"
                  : "Start Review"}
            </button>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--text-primary)]">
          <div className="text-lg text-[var(--text-secondary)]">Loading...</div>
        </div>
      }
    >
      <AnalysisContent />
    </Suspense>
  );
}
