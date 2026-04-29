"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  ArrowLeft,
  Sun,
  Moon,
  RotateCcw,
  Lightbulb,
  SkipForward,
  Eye,
  FlipVertical,
  Zap,
  Flame,
  Target,
  Check,
  X,
  Trophy,
  Clock,
  Heart,
  LogIn,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { AuthMenu } from "@/components/auth-menu";
import { loadClientPreferences, saveClientPreferences } from "@/lib/client-preferences";
import themeManifest from "@/data/themeManifest.json";
import { PuzzleSyncBanner } from "../_components/PuzzleSyncBanner";
import {
  applyAttemptToLocalPuzzlePreferences,
  buildLocalPuzzleProgressSnapshot,
  getTodayUtcDate,
  type PuzzleAttemptInput,
  type PuzzleReviewItem,
} from "@/lib/puzzle-progress";
import { usePuzzleProgress } from "@/lib/use-puzzle-progress";

const PIECE_ASSETS = themeManifest.pieceAssets as Record<string, string>;
const BOARD_ASSETS = themeManifest.boardAssets as Record<string, string>;

type PuzzleData = {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
  popularity: number;
};

type MoveResult = "correct" | "wrong" | null;
type GamePhase = "playing" | "solved" | "failed" | "storm_over" | "streak_over";
type PuzzleMode = "standard" | "daily" | "review" | "storm" | "streak";
type EmptyState = "none" | "review_empty" | "review_auth";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

function SolverInner() {
  const params = useSearchParams();
  const rawMode = params.get("mode") ?? "standard";
  const mode: PuzzleMode =
    rawMode === "daily" || rawMode === "review" || rawMode === "storm" || rawMode === "streak"
      ? rawMode
      : "standard";
  const themeFilter = params.get("theme") ?? "";
  const requestedPuzzleId = params.get("id");
  const { toggleTheme, isDark } = useTheme();
  const { progress, authenticated, importNotice, syncStatus, dismissImportNotice, dismissSyncError, refresh, setProgress } = usePuzzleProgress();

  const boardTheme = themeManifest.defaultBoardTheme;
  const pieceTheme = themeManifest.defaultPieceTheme;
  const piecePath = PIECE_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`;
  const boardPath = BOARD_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`;

  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [game, setGame] = useState<Chess | null>(null);
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [moveIndex, setMoveIndex] = useState(0);
  const [moveResult, setMoveResult] = useState<MoveResult>(null);
  const [flipped, setFlipped] = useState(false);
  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const [selectedSq, setSelectedSq] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [emptyState, setEmptyState] = useState<EmptyState>("none");
  const [reviewItem, setReviewItem] = useState<PuzzleReviewItem | null>(null);

  const [stormScore, setStormScore] = useState(0);
  const [stormLives, setStormLives] = useState(3);
  const [stormTime, setStormTime] = useState(180);
  const stormTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [streakCount, setStreakCount] = useState(0);
  const [playerSide, setPlayerSide] = useState<"w" | "b">("w");

  const consumedRequestedIdRef = useRef<string | null>(null);
  const solveStartedAtRef = useRef<number>(Date.now());

  const syncLocalAttempt = (attempt: PuzzleAttemptInput) => {
    const preferences = loadClientPreferences();
    preferences.puzzle = applyAttemptToLocalPuzzlePreferences(preferences.puzzle, attempt);
    saveClientPreferences(preferences);
    setProgress(buildLocalPuzzleProgressSnapshot(preferences.puzzle, authenticated));
  };

  const submitAttempt = async (outcome: "solved" | "failed", modeScore?: number) => {
    if (!puzzle) {
      return;
    }

    const attempt: PuzzleAttemptInput = {
      puzzleId: puzzle.id,
      puzzleRating: puzzle.rating,
      themes: puzzle.themes,
      outcome,
      mode,
      timeTakenMs: Math.max(0, Date.now() - solveStartedAtRef.current),
      dailyDate: mode === "daily" ? getTodayUtcDate() : undefined,
      modeScore,
    };

    if (!authenticated) {
      syncLocalAttempt(attempt);
      return;
    }

    try {
      const attemptResponse = await fetch("/api/puzzle-progress/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt),
      });

      if (attemptResponse.ok) {
        const snapshot = await attemptResponse.json();
        setProgress(snapshot);
      }

      if (mode === "review" && reviewItem) {
        await fetch(`/api/puzzle-progress/review/${reviewItem.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcome }),
        });
        await refresh();
      }
    } catch {
      syncLocalAttempt(attempt);
    }
  };

  function initPuzzle(nextPuzzle: PuzzleData, nextReviewItem?: PuzzleReviewItem | null) {
    const nextGame = new Chess(nextPuzzle.fen);
    const firstMove = nextPuzzle.moves[0];
    if (firstMove) {
      nextGame.move({
        from: firstMove.slice(0, 2) as Square,
        to: firstMove.slice(2, 4) as Square,
        promotion: (firstMove[4] as "q" | "r" | "b" | "n") || undefined,
      });
    }

    const side = nextGame.turn();
    consumedRequestedIdRef.current = requestedPuzzleId;
    solveStartedAtRef.current = Date.now();
    setPlayerSide(side);
    setFlipped(side === "b");
    setGame(nextGame);
    setPuzzle(nextPuzzle);
    setReviewItem(nextReviewItem ?? null);
    setMoveIndex(1);
    setPhase("playing");
    setMoveResult(null);
    setHintSquare(null);
    setSelectedSq(null);
    setLegalMoves([]);
    setLastMove(firstMove ? { from: firstMove.slice(0, 2), to: firstMove.slice(2, 4) } : null);
    setFetchError(null);
    setEmptyState("none");
    setLoading(false);
  }

  async function fetchPuzzle(initialLoad = false) {
    setLoading(true);
    setFetchError(null);
    setEmptyState("none");

    try {
      if (mode === "review") {
        const reviewResponse = await fetch(
          `/api/puzzle-progress/review${themeFilter ? `?theme=${encodeURIComponent(themeFilter)}` : ""}`,
          { cache: "no-store" },
        );

        if (reviewResponse.status === 401) {
          setEmptyState("review_auth");
          setPuzzle(null);
          setGame(null);
          setLoading(false);
          return;
        }

        const reviewData = await reviewResponse.json();
        if (!reviewResponse.ok || !reviewData.puzzle) {
          setEmptyState("review_empty");
          setPuzzle(null);
          setGame(null);
          setLoading(false);
          return;
        }

        initPuzzle(reviewData.puzzle as PuzzleData, reviewData.item as PuzzleReviewItem | null);
        return;
      }

      const search = new URLSearchParams();
      search.set("count", "1");
      search.set("mode", mode);
      if (themeFilter) {
        search.set("theme", themeFilter);
      }

      if (mode === "storm") {
        search.set("minRating", "600");
        search.set("maxRating", "1400");
      } else if (mode === "streak") {
        search.set("minRating", `${600 + streakCount * 50}`);
        search.set("maxRating", `${900 + streakCount * 50}`);
      }

      const shouldUseRequestedId =
        requestedPuzzleId &&
        (mode === "standard" || mode === "daily") &&
        (initialLoad || consumedRequestedIdRef.current !== requestedPuzzleId);

      if (shouldUseRequestedId) {
        search.set("puzzleId", requestedPuzzleId);
      } else if (mode === "daily" && !requestedPuzzleId) {
        search.set("mode", "daily");
      } else {
        search.set("random", "true");
        if (puzzle?.id) {
          search.set("excludeId", puzzle.id);
        }

        if (progress.dataSource === "server") {
          search.set("excludeRecent", "true");
        } else if (progress.recentPuzzleIds.length > 0) {
          search.set("excludeIds", progress.recentPuzzleIds.join(","));
        }
      }

      const response = await fetch(`/api/puzzles?${search.toString()}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.puzzles?.[0]) {
        throw new Error(data.error ?? "No puzzle found.");
      }

      initPuzzle(data.puzzles[0] as PuzzleData);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Failed to load puzzle.");
      setPuzzle(null);
      setGame(null);
      setLoading(false);
    }
  }

  useEffect(() => {
    consumedRequestedIdRef.current = null;
    setReviewItem(null);
    setPuzzle(null);
    setGame(null);
    setPhase("playing");
    setMoveResult(null);
    setHintSquare(null);
    setSelectedSq(null);
    setLegalMoves([]);
    setLastMove(null);

    if (mode === "storm") {
      setStormScore(0);
      setStormLives(3);
      setStormTime(180);
    } else if (mode === "streak") {
      setStreakCount(0);
    }

    const timeoutId = setTimeout(() => {
      void fetchPuzzle(true);
    }, 0);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, themeFilter, requestedPuzzleId]);

  useEffect(() => {
    if (mode === "storm" && !loading && phase === "playing") {
      stormTimerRef.current = setInterval(() => {
        setStormTime((previous) => {
          if (previous <= 1) {
            if (stormTimerRef.current) {
              clearInterval(stormTimerRef.current);
            }
            setPhase("storm_over");
            return 0;
          }
          return previous - 1;
        });
      }, 1000);

      return () => {
        if (stormTimerRef.current) {
          clearInterval(stormTimerRef.current);
        }
      };
    }
  }, [mode, loading, phase]);

  const handleSquareClick = (sq: string) => {
    if (!game || !puzzle || phase !== "playing") {
      return;
    }
    if (game.turn() !== playerSide) {
      return;
    }

    if (selectedSq) {
      attemptMove(selectedSq, sq);
      setSelectedSq(null);
      setLegalMoves([]);
      return;
    }

    const piece = game.get(sq as Square);
    if (piece && piece.color === playerSide) {
      setSelectedSq(sq);
      const moves = game.moves({ square: sq as Square, verbose: true });
      setLegalMoves(moves.map((move) => move.to));
    }
  };

  const handleWrongMove = () => {
    setMoveResult("wrong");

    if (mode === "storm") {
      const nextLives = stormLives - 1;
      void submitAttempt("failed", stormScore);
      setStormLives(nextLives);
      if (nextLives <= 0) {
        setPhase("storm_over");
        return;
      }
      setTimeout(() => {
        setMoveResult(null);
        void fetchPuzzle();
      }, 800);
      return;
    }

    if (mode === "streak") {
      void submitAttempt("failed", streakCount);
      setPhase("streak_over");
      return;
    }

    void submitAttempt("failed");
    setPhase("failed");
  };

  const handlePuzzleSolved = () => {
    if (mode === "storm") {
      const nextScore = stormScore + 1;
      setStormScore(nextScore);
      void submitAttempt("solved", nextScore);
      setTimeout(() => {
        void fetchPuzzle();
      }, 300);
      return;
    }

    if (mode === "streak") {
      const nextStreak = streakCount + 1;
      setStreakCount(nextStreak);
      void submitAttempt("solved", nextStreak);
      setTimeout(() => {
        void fetchPuzzle();
      }, 300);
      return;
    }

    void submitAttempt("solved");
    setPhase("solved");
  };

  const attemptMove = (from: string, to: string) => {
    if (!game || !puzzle) {
      return;
    }

    const expectedUci = puzzle.moves[moveIndex];
    if (!expectedUci) {
      return;
    }

    const expectedFrom = expectedUci.slice(0, 2);
    const expectedTo = expectedUci.slice(2, 4);
    const expectedPromotion = expectedUci[4] as "q" | "r" | "b" | "n" | undefined;

    if (from === expectedFrom && to === expectedTo) {
      const nextGame = new Chess(game.fen());
      const moveResultValue = nextGame.move({
        from: from as Square,
        to: to as Square,
        promotion: expectedPromotion || "q",
      });

      if (!moveResultValue) {
        handleWrongMove();
        return;
      }

      setGame(nextGame);
      setLastMove({ from, to });
      setMoveResult("correct");

      const nextIndex = moveIndex + 1;
      if (nextIndex >= puzzle.moves.length) {
        setTimeout(() => handlePuzzleSolved(), 400);
        return;
      }

      setTimeout(() => {
        const replyMove = puzzle.moves[nextIndex];
        const replyGame = new Chess(nextGame.fen());
        replyGame.move({
          from: replyMove.slice(0, 2) as Square,
          to: replyMove.slice(2, 4) as Square,
          promotion: (replyMove[4] as "q" | "r" | "b" | "n") || undefined,
        });
        setGame(replyGame);
        setLastMove({ from: replyMove.slice(0, 2), to: replyMove.slice(2, 4) });
        setMoveIndex(nextIndex + 1);
        setMoveResult(null);
      }, 500);
      return;
    }

    handleWrongMove();
  };

  const handleHint = () => {
    if (!puzzle || moveIndex >= puzzle.moves.length) {
      return;
    }
    setHintSquare(puzzle.moves[moveIndex].slice(0, 2));
  };

  const handleShowSolution = () => {
    if (!game || !puzzle) {
      return;
    }

    const solvedGame = new Chess(game.fen());
    for (let index = moveIndex; index < puzzle.moves.length; index += 1) {
      const move = puzzle.moves[index];
      solvedGame.move({
        from: move.slice(0, 2) as Square,
        to: move.slice(2, 4) as Square,
        promotion: (move[4] as "q" | "r" | "b" | "n") || undefined,
      });
    }

    setGame(solvedGame);
    setPhase("solved");
  };

  const handleRetry = () => {
    if (puzzle) {
      initPuzzle(puzzle, reviewItem);
    }
  };

  const board = useMemo(() => {
    if (!game) {
      return Array.from({ length: 8 }, () => Array(8).fill(null));
    }
    return game.board().map((row) => row.map((piece) => (piece ? `${piece.color}${piece.type}` : null)));
  }, [game]);

  const ranks = flipped ? [...RANKS].reverse() : RANKS;
  const files = flipped ? [...FILES].reverse() : FILES;

  const modeTitle =
    mode === "storm"
      ? "Puzzle Storm"
      : mode === "streak"
        ? "Puzzle Streak"
        : mode === "daily"
          ? "Daily Puzzle"
          : mode === "review"
            ? "Replay Queue"
            : "Puzzle Training";
  const ModeIcon = mode === "storm" ? Zap : mode === "streak" ? Flame : Target;
  const modeColor =
    mode === "storm"
      ? "text-amber-400"
      : mode === "streak"
        ? "text-rose-400"
        : mode === "review"
          ? "text-sky-400"
          : mode === "daily"
            ? "text-emerald-400"
            : "text-violet-400";

  const renderEmptyPanel = () => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-8 text-center text-[var(--text-muted)] font-medium">
          Loading puzzle...
        </div>
      );
    }

    if (emptyState === "review_auth") {
      return (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-8 text-center">
          <LogIn className="w-8 h-8 mx-auto mb-3 text-[var(--text-dimmed)]" />
          <h3 className="text-[20px] font-serif text-[var(--text-primary)] mb-2">Sign in to use replay mode</h3>
          <p className="text-[14px] text-[var(--text-muted)] font-medium mb-5">
            Replay queues are stored on your account so they sync across sessions and devices. Your current local puzzle progress will auto-sync the first time you sign in.
          </p>
          <Link
            href="/login?next=%2Fpuzzles%2Fsolve%3Fmode%3Dreview"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--cta-bg)] text-[var(--cta-text)] text-[13px] font-bold"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Link>
        </div>
      );
    }

    if (emptyState === "review_empty") {
      return (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-8 text-center">
          <Check className="w-8 h-8 mx-auto mb-3 text-emerald-400" />
          <h3 className="text-[20px] font-serif text-[var(--text-primary)] mb-2">Replay queue cleared</h3>
          <p className="text-[14px] text-[var(--text-muted)] font-medium mb-5">
            No review puzzles are waiting right now. Miss a puzzle or train a weaker theme to refill the queue.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/puzzles/dashboard/improvement-areas"
              className="px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[13px] font-semibold text-[var(--text-primary)]"
            >
              Improvement Areas
            </Link>
            <Link
              href="/puzzles"
              className="px-4 py-3 rounded-xl bg-[var(--cta-bg)] text-[var(--cta-text)] text-[13px] font-bold"
            >
              Back to Puzzle Hub
            </Link>
          </div>
        </div>
      );
    }

    if (fetchError) {
      return (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
          <X className="w-8 h-8 mx-auto mb-3 text-red-400" />
          <h3 className="text-[20px] font-serif text-[var(--text-primary)] mb-2">Could not load puzzle</h3>
          <p className="text-[14px] text-[var(--text-muted)] font-medium mb-5">{fetchError}</p>
          <button
            onClick={() => {
              void fetchPuzzle(true);
            }}
            className="px-4 py-3 rounded-xl bg-[var(--cta-bg)] text-[var(--cta-text)] text-[13px] font-bold"
          >
            Retry
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <header className="w-full max-w-[1400px] mx-auto px-6 py-6 flex items-center justify-between">
        <Link
          href="/puzzles"
          className="inline-flex items-center text-[var(--text-dimmed)] hover:text-[var(--text-primary)] transition-colors text-[14px] font-medium group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Puzzles
        </Link>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            data-theme-toggle
            className="p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
          >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <AuthMenu />
        </div>
      </header>

      {(importNotice || syncStatus.badgeState !== "hidden") && (
        <div className="w-full max-w-[1200px] mx-auto px-6 mb-2">
          <PuzzleSyncBanner
            status={syncStatus}
            notice={importNotice}
            onDismissNotice={dismissImportNotice}
            onDismissError={dismissSyncError}
          />
        </div>
      )}

      <main className="flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 px-6 py-8 max-w-[1200px] mx-auto w-full">
        {!puzzle || !game ? (
          <div className="w-full max-w-[640px]">{renderEmptyPanel()}</div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3 mb-2">
                <ModeIcon className={`w-5 h-5 ${modeColor}`} />
                <span className="text-[14px] font-bold text-[var(--text-primary)]">{modeTitle}</span>
                {(mode === "standard" || mode === "daily" || mode === "review") && (
                  <span className="text-[12px] font-semibold text-[var(--text-dimmed)] border border-[var(--border)] rounded-full px-3 py-1">
                    Rating {puzzle.rating}
                  </span>
                )}
              </div>

              {mode === "storm" && (
                <div className="flex items-center gap-6 mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-[20px] font-bold tabular-nums text-[var(--text-primary)]">
                      {Math.floor(stormTime / 60)}:{(stormTime % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="text-[20px] font-bold tabular-nums text-[var(--text-primary)]">{stormScore}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(3)].map((_, index) => (
                      <Heart
                        key={index}
                        className={`w-4 h-4 ${index < stormLives ? "text-rose-400 fill-rose-400" : "text-[var(--text-dimmed)]"}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {mode === "streak" && (
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-rose-400" />
                    <span className="text-[20px] font-bold tabular-nums text-[var(--text-primary)]">{streakCount}</span>
                    <span className="text-[12px] text-[var(--text-dimmed)] font-semibold">streak</span>
                  </div>
                </div>
              )}

              <div className="relative select-none" style={{ width: "min(85vw, 520px)", height: "min(85vw, 520px)" }}>
                <Image
                  src={boardPath}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 85vw, 520px"
                  className="rounded-xl object-cover"
                  unoptimized
                />

                {moveResult && (
                  <div
                    className={`absolute inset-0 z-30 rounded-xl pointer-events-none transition-opacity duration-200 ${
                      moveResult === "correct"
                        ? "bg-emerald-500/10 border-2 border-emerald-500/40"
                        : "bg-red-500/10 border-2 border-red-500/40"
                    }`}
                  />
                )}

                <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 rounded-xl overflow-hidden">
                  {ranks.map((rank, rankIndex) =>
                    files.map((file, fileIndex) => {
                      const square = `${file}${rank}`;
                      const boardRankIndex = RANKS.indexOf(rank);
                      const boardFileIndex = FILES.indexOf(file);
                      const piece = board[boardRankIndex]?.[boardFileIndex];
                      const isSelected = selectedSq === square;
                      const isLegal = legalMoves.includes(square);
                      const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
                      const isHint = hintSquare === square;
                      const hasPiece = Boolean(piece);

                      return (
                        <div
                          key={square}
                          className="relative flex items-center justify-center cursor-pointer"
                          onClick={() => handleSquareClick(square)}
                        >
                          {isLastMove && <div className="absolute inset-0 bg-amber-400/25 z-10" />}
                          {isSelected && <div className="absolute inset-0 bg-emerald-400/30 z-10" />}
                          {isHint && <div className="absolute inset-0 bg-sky-400/35 z-10 animate-pulse" />}

                          {isLegal && !hasPiece && (
                            <div className="absolute z-20 w-[26%] h-[26%] rounded-full bg-[var(--text-primary)] opacity-20" />
                          )}
                          {isLegal && hasPiece && (
                            <div className="absolute z-20 inset-0 border-[3px] border-[var(--text-primary)] opacity-20 rounded-full" />
                          )}

                          {piece && (
                            <Image
                              src={`${piecePath}/${piece}.png`}
                              alt={piece}
                              fill
                              sizes="64px"
                              className="absolute inset-[8%] object-contain z-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
                              unoptimized
                            />
                          )}

                          {fileIndex === 0 && (
                            <span className="absolute top-[2px] left-[4px] text-[9px] font-bold z-20 opacity-50 text-[var(--text-primary)] pointer-events-none select-none">
                              {rank}
                            </span>
                          )}
                          {rankIndex === 7 && (
                            <span className="absolute bottom-[1px] right-[4px] text-[9px] font-bold z-20 opacity-50 text-[var(--text-primary)] pointer-events-none select-none">
                              {file}
                            </span>
                          )}
                        </div>
                      );
                    }),
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-muted)]">
                {phase === "playing" && (
                  <>
                    <div
                      className={`w-3 h-3 rounded-full border border-[var(--border)] ${game.turn() === "w" ? "bg-white" : "bg-gray-800"}`}
                    />
                    {game.turn() === playerSide ? "Your turn - find the best move" : "Opponent is moving..."}
                  </>
                )}
                {phase === "solved" && (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    Puzzle Solved!
                  </span>
                )}
                {phase === "failed" && (
                  <span className="text-red-400 flex items-center gap-1.5">
                    <X className="w-4 h-4" />
                    Incorrect
                  </span>
                )}
              </div>
            </div>

            <div className="w-full lg:w-[300px] flex flex-col gap-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-5">
                <div className="flex flex-wrap gap-2 mb-4">
                  {puzzle.themes.slice(0, 4).map((theme) => (
                    <span
                      key={theme}
                      className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-dimmed)] bg-[var(--surface)] border border-[var(--border)] rounded-full px-2.5 py-1 capitalize"
                    >
                      {theme.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                  ))}
                </div>
                <p className="text-[13px] text-[var(--text-muted)] font-medium">
                  {playerSide === "w" ? "White" : "Black"} to move - find the best continuation.
                </p>
                <p className="mt-3 text-[12px] text-[var(--text-dimmed)] font-medium">
                  Drawn from a live pool of 5,882,680 public-domain puzzles.
                </p>
                {mode === "review" && reviewItem && (
                  <p className="mt-3 text-[12px] text-sky-400 font-semibold">
                    Replay item #{reviewItem.id} due {new Date(reviewItem.nextReviewAt).toLocaleString()}.
                  </p>
                )}
              </div>

              {phase === "playing" && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleHint}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all text-[13px] font-semibold"
                  >
                    <Lightbulb className="w-4 h-4" />
                    Hint
                  </button>
                  <button
                    onClick={() => setFlipped((value) => !value)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all text-[13px] font-semibold"
                  >
                    <FlipVertical className="w-4 h-4" />
                    Flip
                  </button>
                  {(mode === "standard" || mode === "daily" || mode === "review") && (
                    <>
                      <button
                        onClick={handleShowSolution}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all text-[13px] font-semibold"
                      >
                        <Eye className="w-4 h-4" />
                        Solution
                      </button>
                      <button
                        onClick={() => {
                          void fetchPuzzle();
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all text-[13px] font-semibold"
                      >
                        <SkipForward className="w-4 h-4" />
                        {mode === "review" ? "Next Replay" : "Skip"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {(phase === "solved" || phase === "failed") && (mode === "standard" || mode === "daily" || mode === "review") && (
                <div
                  className={`rounded-xl border p-5 ${
                    phase === "solved" ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {phase === "solved" ? (
                      <>
                        <Check className="w-5 h-5 text-emerald-400" />
                        <span className="text-[16px] font-bold text-emerald-400">Correct!</span>
                      </>
                    ) : (
                      <>
                        <X className="w-5 h-5 text-red-400" />
                        <span className="text-[16px] font-bold text-red-400">Incorrect</span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleRetry}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all text-[13px] font-semibold"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Retry
                    </button>
                    <button
                      onClick={() => {
                        void fetchPuzzle();
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)] transition-all text-[13px] font-bold"
                    >
                      <SkipForward className="w-4 h-4" />
                      {mode === "review" ? "Next Replay" : "Next"}
                    </button>
                  </div>
                </div>
              )}

              {(phase === "storm_over" || phase === "streak_over") && (
                <div className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--card-from)] to-[var(--card-to)] p-6 text-center">
                  <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                  <h3 className="text-[24px] font-serif font-[500] text-[var(--text-primary)] mb-2">
                    {phase === "storm_over" ? "Storm Over!" : "Streak Ended!"}
                  </h3>
                  <p className="text-[36px] font-bold text-[var(--text-primary)] tabular-nums mb-1">
                    {phase === "storm_over" ? stormScore : streakCount}
                  </p>
                  <p className="text-[13px] text-[var(--text-dimmed)] font-semibold mb-4">
                    {phase === "storm_over" ? "puzzles solved" : "puzzle streak"}
                  </p>
                  <p className="text-[12px] text-[var(--text-dimmed)] mb-4">
                    Personal best: {phase === "storm_over" ? progress.summary.bestStormScore : progress.summary.bestStreakScore}
                  </p>
                  <div className="flex gap-3">
                    <Link
                      href="/puzzles"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-[13px] font-semibold"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Hub
                    </Link>
                    <button
                      onClick={() => {
                        setStormScore(0);
                        setStormLives(3);
                        setStormTime(180);
                        setStreakCount(0);
                        void fetchPuzzle(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)] transition-all text-[13px] font-bold"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function PuzzleSolvePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)]">
          Loading puzzle...
        </div>
      }
    >
      <SolverInner />
    </Suspense>
  );
}
