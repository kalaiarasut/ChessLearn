"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
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
  Settings,
  Play,
  Pause,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { AuthMenu } from "@/components/auth-menu";
import { BoardSettingsModal } from "@/components/board-settings-modal";
import { loadClientPreferences, saveClientPreferences, type MoveMethod } from "@/lib/client-preferences";
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
const AVAILABLE_BOARD_THEMES = themeManifest.boardThemes as string[];
const AVAILABLE_PIECE_THEMES = themeManifest.pieceThemes as string[];
const PUZZLE_APPEARANCE_STORAGE_KEY = "ChessLearn-puzzle-appearance";

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
type SolutionState = "hidden" | "paused" | "playing" | "complete";
type FreeMoveHistoryEntry = {
  fen: string;
  lastMove: { from: string; to: string } | null;
};
type PrefetchedPuzzleEntry = {
  mode: PuzzleMode;
  theme: string;
  requestedPuzzleId: string | null;
  streakCount: number;
  sourcePuzzleId: string | null;
  puzzle: PuzzleData;
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

function PuzzleSolveSkeleton({ mode }: { mode: PuzzleMode }) {
  const renderSkeletonDescription = (className = "") => (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-5 ${className}`}>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="h-[30px] w-[92px] rounded-full bg-[var(--skeleton)] animate-pulse" />
        <div className="h-[30px] w-[118px] rounded-full bg-[var(--skeleton)] animate-pulse" />
        <div className="h-[30px] w-[84px] rounded-full bg-[var(--skeleton)] animate-pulse" />
      </div>
      <div className="h-[17px] w-[230px] rounded bg-[var(--skeleton-soft)] animate-pulse" />
    </div>
  );

  return (
    <>
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Loading {mode === "storm" ? "storm" : mode === "streak" ? "streak" : mode === "daily" ? "daily puzzle" : mode === "review" ? "review puzzle" : "puzzle"}
        </div>
        <div style={{ width: "min(85vw, 520px)" }} className="lg:hidden block">
          {renderSkeletonDescription()}
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-5 h-5 rounded-full bg-[var(--skeleton)] animate-pulse" />
          <div className="h-4 w-36 rounded-full bg-[var(--skeleton)] animate-pulse" />
          <div className="h-7 w-24 rounded-full bg-[var(--skeleton)] animate-pulse" />
        </div>

        <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]" style={{ width: "min(85vw, 520px)", height: "min(85vw, 520px)" }}>
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
            {Array.from({ length: 64 }).map((_, index) => {
              const row = Math.floor(index / 8);
              const col = index % 8;
              return (
                <div
                  key={index}
                  className={`relative ${((row + col) % 2 === 0 ? "bg-[var(--skeleton-soft)]" : "bg-[var(--skeleton)]")} animate-pulse`}
                >
                  {col === 0 && <div className="absolute top-[4px] left-[4px] h-2 w-2 rounded bg-[var(--surface)]/50" />}
                  {row === 7 && <div className="absolute bottom-[4px] right-[4px] h-2 w-2 rounded bg-[var(--surface)]/50" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-4 w-56 rounded-full bg-[var(--skeleton)] animate-pulse" />
      </div>
      <div className="w-full lg:w-[300px] flex flex-col gap-4">
        {renderSkeletonDescription("hidden lg:block")}
        <div className="h-[46px] rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] animate-pulse" />
          ))}
        </div>
      </div>
    </>
  );
}

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
  const [boardTheme, setBoardTheme] = useState(themeManifest.defaultBoardTheme);
  const [pieceTheme, setPieceTheme] = useState(themeManifest.defaultPieceTheme);
  const [showLegalMoves, setShowLegalMoves] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [masterVolume, setMasterVolume] = useState(80);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
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
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [visualReady, setVisualReady] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [emptyState, setEmptyState] = useState<EmptyState>("none");
  const [reviewItem, setReviewItem] = useState<PuzzleReviewItem | null>(null);
  const [moveMethod, setMoveMethod] = useState<MoveMethod>("both");
  const [solutionState, setSolutionState] = useState<SolutionState>("hidden");
  const [solutionStepCount, setSolutionStepCount] = useState(0);
  const [solutionTotalSteps, setSolutionTotalSteps] = useState(0);
  const [wrongMoveSquare, setWrongMoveSquare] = useState<string | null>(null);
  const [rightClickHighlights, setRightClickHighlights] = useState<Set<string>>(new Set());
  const [rightClickArrows, setRightClickArrows] = useState<Array<{ start: string; end: string }>>([]);
  const [rightClickStartSquare, setRightClickStartSquare] = useState<string | null>(null);
  const [freeMoveHistory, setFreeMoveHistory] = useState<FreeMoveHistoryEntry[]>([]);
  const [freeMoveHistoryIndex, setFreeMoveHistoryIndex] = useState(0);

  const [stormScore, setStormScore] = useState(0);
  const [stormLives, setStormLives] = useState(3);
  const [stormTime, setStormTime] = useState(180);
  const stormTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [streakCount, setStreakCount] = useState(0);
  const [playerSide, setPlayerSide] = useState<"w" | "b">("w");

  const consumedRequestedIdRef = useRef<string | null>(null);
  const solveStartedAtRef = useRef<number>(Date.now());
  const draggingFromRef = useRef<string | null>(null);
  const prefetchedPuzzlesRef = useRef<PrefetchedPuzzleEntry[]>([]);
  const prefetchInFlightRef = useRef(false);
  const solutionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const solutionGameRef = useRef<Chess | null>(null);
  const solutionCursorRef = useRef<number | null>(null);
  const solutionPlayingRef = useRef(false);
  const solutionAutoReplayRef = useRef(false);
  const audioPoolRef = useRef<Record<string, HTMLAudioElement[]>>({});
  const nextAudioIndexRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const preferences = loadClientPreferences();
    setMoveMethod(preferences.learn.moveMethod);
    setShowLegalMoves(preferences.learn.showLegalMoves);
    setMasterVolume(preferences.learn.masterVolume);

    try {
      const raw = window.localStorage.getItem(PUZZLE_APPEARANCE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { boardTheme?: string; pieceTheme?: string; soundEnabled?: boolean };
        if (typeof parsed.boardTheme === "string") {
          setBoardTheme(parsed.boardTheme);
        }
        if (typeof parsed.pieceTheme === "string") {
          setPieceTheme(parsed.pieceTheme);
        }
        if (typeof parsed.soundEnabled === "boolean") {
          setSoundEnabled(parsed.soundEnabled);
        }
      }
    } catch {
    } finally {
      setPreferencesReady(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      PUZZLE_APPEARANCE_STORAGE_KEY,
      JSON.stringify({ boardTheme, pieceTheme, soundEnabled })
    );
  }, [boardTheme, pieceTheme, soundEnabled]);

  function persistGameplayPreferences(nextMoveMethod: MoveMethod, nextShowLegalMoves: boolean) {
    const preferences = loadClientPreferences();
    preferences.learn.moveMethod = nextMoveMethod;
    preferences.learn.showLegalMoves = nextShowLegalMoves;
    preferences.learn.masterVolume = masterVolume;
    saveClientPreferences(preferences);
  }

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
    audio.volume = Math.min(1, Math.max(0, masterVolume / 100));
    audio.currentTime = 0;
    audio.play().catch(() => { });
  };

  const getMoveSound = (gameAfterMove: Chess, moveResultValue: { captured?: string; flags: string; promotion?: string }) => {
    if (gameAfterMove.isCheck()) return "move-check";
    if (moveResultValue.promotion) return "promote";
    if (moveResultValue.flags.includes("k") || moveResultValue.flags.includes("q")) return "castle";
    if (moveResultValue.captured) return "capture";
    return "move-self";
  };

  const savePuzzleSettings = async () => {
    setPreferencesError(null);
    setPreferencesSaving(true);

    try {
      const preferences = loadClientPreferences();
      preferences.learn.moveMethod = moveMethod;
      preferences.learn.showLegalMoves = showLegalMoves;
      preferences.learn.masterVolume = masterVolume;
      saveClientPreferences(preferences);

      try {
        await fetch("/api/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardTheme, pieceTheme, soundEnabled }),
        });
      } catch { }

      setIsSettingsOpen(false);
    } catch (error) {
      setPreferencesError(error instanceof Error ? error.message : "Failed to save preferences.");
    } finally {
      setPreferencesSaving(false);
    }
  };

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
    setSolutionState("hidden");
    setSolutionStepCount(0);
    setSolutionTotalSteps(0);
    solutionGameRef.current = null;
    solutionCursorRef.current = null;
    solutionPlayingRef.current = false;
    solutionAutoReplayRef.current = false;
    setMoveIndex(1);
    setPhase("playing");
    setMoveResult(null);
    setHintSquare(null);
    setSelectedSq(null);
    setLegalMoves([]);
    setLastMove(firstMove ? { from: firstMove.slice(0, 2), to: firstMove.slice(2, 4) } : null);
    setFreeMoveHistory([]);
    setFreeMoveHistoryIndex(0);
    setFetchError(null);
    setEmptyState("none");
    setLoading(false);
  }

  function clearSolutionTimer() {
    if (solutionTimerRef.current) {
      clearTimeout(solutionTimerRef.current);
      solutionTimerRef.current = null;
    }
    solutionPlayingRef.current = false;
    solutionAutoReplayRef.current = false;
  }

  async function requestPuzzleData(args: {
    initialLoad?: boolean;
    currentPuzzleId?: string | null;
    currentRecentIds?: string[];
    streakCountOverride?: number;
  }) {
    if (mode === "review") {
      const reviewResponse = await fetch(
        `/api/puzzle-progress/review${themeFilter ? `?theme=${encodeURIComponent(themeFilter)}` : ""}`,
        { cache: "no-store" },
      );

      if (reviewResponse.status === 401) {
        return { kind: "review_auth" as const };
      }

      const reviewData = await reviewResponse.json();
      if (!reviewResponse.ok || !reviewData.puzzle) {
        return { kind: "review_empty" as const };
      }

      return {
        kind: "ok" as const,
        puzzle: reviewData.puzzle as PuzzleData,
        reviewItem: (reviewData.item as PuzzleReviewItem | null) ?? null,
      };
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
      const activeStreakCount = args.streakCountOverride ?? streakCount;
      search.set("minRating", `${600 + activeStreakCount * 50}`);
      search.set("maxRating", `${900 + activeStreakCount * 50}`);
    }

    const shouldUseRequestedId =
      requestedPuzzleId &&
      (mode === "standard" || mode === "daily") &&
      (args.initialLoad || consumedRequestedIdRef.current !== requestedPuzzleId);

    if (shouldUseRequestedId) {
      search.set("puzzleId", requestedPuzzleId);
    } else if (mode === "daily" && !requestedPuzzleId) {
      search.set("mode", "daily");
    } else {
      search.set("random", "true");
      if (args.currentPuzzleId) {
        search.set("excludeId", args.currentPuzzleId);
      }

      if (progress.dataSource === "server") {
        search.set("excludeRecent", "true");
      } else if ((args.currentRecentIds ?? []).length > 0) {
        search.set("excludeIds", args.currentRecentIds!.join(","));
      }
    }

    const response = await fetch(`/api/puzzles?${search.toString()}`, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok || !data.puzzles?.[0]) {
      throw new Error(data.details ?? data.error ?? "No puzzle found.");
    }

    return {
      kind: "ok" as const,
      puzzle: data.puzzles[0] as PuzzleData,
      reviewItem: null,
    };
  }

  function getPrefetchTargetSize() {
    if (mode === "storm") return 4;
    if (mode === "streak") return 2;
    if (mode === "standard") return 2;
    return 1;
  }

  function takePrefetchedPuzzle(currentPuzzleId: string | null, streakCountOverride: number) {
    const matchIndex = prefetchedPuzzlesRef.current.findIndex(
      (entry) =>
        entry.mode === mode &&
        entry.theme === themeFilter &&
        entry.requestedPuzzleId === requestedPuzzleId &&
        entry.streakCount === streakCountOverride &&
        entry.puzzle.id !== currentPuzzleId,
    );

    if (matchIndex < 0) {
      return null;
    }

    const [entry] = prefetchedPuzzlesRef.current.splice(matchIndex, 1);
    return entry;
  }

  async function prefetchNextPuzzle(currentPuzzleId: string, streakCountOverride = streakCount) {
    if (mode === "review" || requestedPuzzleId || prefetchInFlightRef.current) {
      return;
    }

    prefetchInFlightRef.current = true;
    try {
      const targetSize = getPrefetchTargetSize();
      const queue = prefetchedPuzzlesRef.current.filter(
        (entry) =>
          entry.mode === mode &&
          entry.theme === themeFilter &&
          entry.requestedPuzzleId === requestedPuzzleId &&
          entry.streakCount === streakCountOverride,
      );
      const queuedIds = new Set(queue.map((entry) => entry.puzzle.id));
      prefetchedPuzzlesRef.current = prefetchedPuzzlesRef.current.filter(
        (entry) =>
          entry.mode === mode &&
          entry.theme === themeFilter &&
          entry.requestedPuzzleId === requestedPuzzleId &&
          entry.streakCount === streakCountOverride,
      );

      while (prefetchedPuzzlesRef.current.length < targetSize) {
        const result = await requestPuzzleData({
          currentPuzzleId,
          streakCountOverride,
          currentRecentIds:
            progress.dataSource === "server" ? [] : [...progress.recentPuzzleIds, currentPuzzleId, ...queuedIds],
        });

        if (result.kind !== "ok" || result.puzzle.id === currentPuzzleId || queuedIds.has(result.puzzle.id)) {
          break;
        }

        queuedIds.add(result.puzzle.id);
        prefetchedPuzzlesRef.current.push({
          mode,
          theme: themeFilter,
          requestedPuzzleId,
          streakCount: streakCountOverride,
          sourcePuzzleId: currentPuzzleId,
          puzzle: result.puzzle,
        });
      }
    } catch {
      prefetchedPuzzlesRef.current = prefetchedPuzzlesRef.current.filter((entry) => entry.mode !== mode);
    } finally {
      prefetchInFlightRef.current = false;
    }
  }

  async function fetchPuzzle(initialLoad = false, streakCountOverride = streakCount) {
    setLoading(true);
    setFetchError(null);
    setEmptyState("none");
    clearSolutionTimer();

    const currentPuzzleId = puzzle?.id ?? null;
    const prefetched = !initialLoad ? takePrefetchedPuzzle(currentPuzzleId, streakCountOverride) : null;

    if (prefetched) {
      initPuzzle(prefetched.puzzle);
      void prefetchNextPuzzle(prefetched.puzzle.id, streakCountOverride);
      return;
    }

    try {
      const result = await requestPuzzleData({
        initialLoad,
        currentPuzzleId,
        streakCountOverride,
        currentRecentIds: progress.recentPuzzleIds,
      });

      if (result.kind === "review_auth") {
        setEmptyState("review_auth");
        setPuzzle(null);
        setGame(null);
        setLoading(false);
        return;
      }

      if (result.kind === "review_empty") {
        setEmptyState("review_empty");
        setPuzzle(null);
        setGame(null);
        setLoading(false);
        return;
      }

      initPuzzle(result.puzzle, result.reviewItem);
      void prefetchNextPuzzle(result.puzzle.id, streakCountOverride);
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
    setSolutionState("hidden");
    setSolutionStepCount(0);
    setSolutionTotalSteps(0);
    solutionGameRef.current = null;
    solutionCursorRef.current = null;
    solutionPlayingRef.current = false;
    solutionAutoReplayRef.current = false;
    setRightClickHighlights(new Set());
    setRightClickArrows([]);
    setRightClickStartSquare(null);
    setFreeMoveHistory([]);
    setFreeMoveHistoryIndex(0);
    prefetchedPuzzlesRef.current = [];
    clearSolutionTimer();

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
            void submitAttempt("failed", stormScore);
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
    // submitAttempt is intentionally omitted so the active storm timer is not recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, loading, phase, stormScore]);

  const pushFreeMove = (nextGame: Chess, nextLastMove: { from: string; to: string }) => {
    const nextEntry = { fen: nextGame.fen(), lastMove: nextLastMove };
    setFreeMoveHistory((previous) => {
      const base =
        previous.length > 0
          ? previous.slice(0, freeMoveHistoryIndex + 1)
          : game
            ? [{ fen: game.fen(), lastMove }]
            : [];
      const next = [...base, nextEntry];
      setFreeMoveHistoryIndex(next.length - 1);
      return next;
    });
  };

  const goToFreeMoveHistory = (direction: -1 | 1) => {
    if (freeMoveHistory.length === 0) {
      return;
    }

    const nextIndex = freeMoveHistoryIndex + direction;
    const entry = freeMoveHistory[nextIndex];
    if (!entry) {
      return;
    }

    setFreeMoveHistoryIndex(nextIndex);
    setGame(new Chess(entry.fen));
    setLastMove(entry.lastMove);
    setSelectedSq(null);
    setLegalMoves([]);
  };

  const handleSquareClick = (sq: string) => {
    if (!game || !puzzle || (phase !== "playing" && phase !== "solved" && phase !== "failed")) {
      return;
    }
    if (phase === "playing" && game.turn() !== playerSide) {
      return;
    }
    if (phase === "playing" && solutionState !== "hidden") {
      return;
    }
    const piece = game.get(sq as Square);
    const activeColor = phase === "playing" ? playerSide : game.turn();

    if (selectedSq === sq) {
      setSelectedSq(null);
      setLegalMoves([]);
      return;
    }

    if (selectedSq) {
      if (piece && piece.color === activeColor) {
        setSelectedSq(sq);
        const nextMoves = game.moves({ square: sq as Square, verbose: true });
        setLegalMoves(nextMoves.map((move) => move.to));
        return;
      }

      if (!legalMoves.includes(sq)) {
        handleIllegalInput(selectedSq);
        setSelectedSq(null);
        setLegalMoves([]);
        return;
      }

      if (phase !== "playing") {
        const sandboxGame = new Chess(game.fen());
        const moved = sandboxGame.move({ from: selectedSq as Square, to: sq as Square, promotion: "q" });
        if (moved) {
          pushFreeMove(sandboxGame, { from: selectedSq, to: sq });
          setGame(sandboxGame);
          setLastMove({ from: selectedSq, to: sq });
          playSound(getMoveSound(sandboxGame, moved));
        }
        setSelectedSq(null);
        setLegalMoves([]);
        return;
      }

      attemptMove(selectedSq, sq);
      setSelectedSq(null);
      setLegalMoves([]);
      return;
    }

    if (piece && piece.color === activeColor) {
      setSelectedSq(sq);
      const moves = game.moves({ square: sq as Square, verbose: true });
      setLegalMoves(moves.map((move) => move.to));
    }
  };

  const handleRightClickDown = (event: MouseEvent, square: string) => {
    if (event.button === 2) {
      setRightClickStartSquare(square);
      return;
    }

    if (rightClickHighlights.size > 0) {
      setRightClickHighlights(new Set());
    }
    if (rightClickArrows.length > 0) {
      setRightClickArrows([]);
    }
  };

  const handleRightClickUp = (event: MouseEvent, square: string) => {
    if (event.button !== 2 || !rightClickStartSquare) {
      return;
    }

    if (rightClickStartSquare === square) {
      setRightClickHighlights((previous) => {
        const next = new Set(previous);
        if (next.has(square)) {
          next.delete(square);
        } else {
          next.add(square);
        }
        return next;
      });
    } else {
      setRightClickArrows((previous) => {
        const existingIndex = previous.findIndex(
          (arrow) => arrow.start === rightClickStartSquare && arrow.end === square
        );
        if (existingIndex >= 0) {
          return previous.filter((_, index) => index !== existingIndex);
        }
        return [...previous, { start: rightClickStartSquare, end: square }];
      });
    }

    setRightClickStartSquare(null);
  };

  const handleDragStart = (sq: string) => {
    if (!game || (phase !== "playing" && phase !== "solved" && phase !== "failed")) {
      return;
    }
    if ((phase === "playing" && solutionState !== "hidden") || moveMethod === "click") {
      return;
    }
    if (phase === "playing" && game.turn() !== playerSide) {
      return;
    }

    const piece = game.get(sq as Square);
    const activeColor = phase === "playing" ? playerSide : game.turn();
    if (!piece || piece.color !== activeColor) {
      return;
    }

    draggingFromRef.current = sq;
    setSelectedSq(sq);
    const moves = game.moves({ square: sq as Square, verbose: true });
    setLegalMoves(moves.map((move) => move.to));
  };

  const handleDragEnd = () => {
    draggingFromRef.current = null;
    setSelectedSq(null);
    setLegalMoves([]);
  };

  const handleDrop = (sq: string) => {
    const from = draggingFromRef.current;
    draggingFromRef.current = null;

    if (!from || !legalMoves.includes(sq)) {
      if (from) {
        handleIllegalInput(from);
      }
      setSelectedSq(null);
      setLegalMoves([]);
      return;
    }

    if (phase !== "playing" && game) {
      const sandboxGame = new Chess(game.fen());
      const moved = sandboxGame.move({ from: from as Square, to: sq as Square, promotion: "q" });
      if (moved) {
        pushFreeMove(sandboxGame, { from, to: sq });
        setGame(sandboxGame);
        setLastMove({ from, to: sq });
        playSound(getMoveSound(sandboxGame, moved));
      }
      setSelectedSq(null);
      setLegalMoves([]);
      return;
    }

    attemptMove(from, sq);
    setSelectedSq(null);
    setLegalMoves([]);
  };

  const handleIllegalInput = (from: string) => {
    playSound("illegal");
    setWrongMoveSquare(from);
    setMoveResult(null);
    window.setTimeout(() => {
      setWrongMoveSquare((current) => (current === from ? null : current));
    }, 350);
  };

  const handleWrongMove = (from: string) => {
    playSound("illegal");
    setWrongMoveSquare(from);
    setMoveResult(null);
    window.setTimeout(() => {
      setWrongMoveSquare((current) => (current === from ? null : current));
    }, 450);

    if (mode === "storm" && phase === "playing") {
      setStormLives((currentLives) => {
        const nextLives = Math.max(0, currentLives - 1);
        if (nextLives === 0) {
          void submitAttempt("failed", stormScore);
          setPhase("storm_over");
        } else {
          window.setTimeout(() => {
            void fetchPuzzle();
          }, 450);
        }
        return nextLives;
      });
      return;
    }

    if (mode === "streak" && phase === "playing") {
      void submitAttempt("failed", streakCount);
      setPhase("streak_over");
    }
  };

  const handleStormPass = () => {
    if (mode !== "storm" || phase !== "playing" || !puzzle) {
      return;
    }

    const sourceSquare = puzzle.moves[moveIndex]?.slice(0, 2) ?? lastMove?.to ?? "a1";
    handleWrongMove(sourceSquare);
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
      if (puzzle) {
        void prefetchNextPuzzle(puzzle.id, nextStreak);
      }
      setTimeout(() => {
        void fetchPuzzle(false, nextStreak);
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
    clearSolutionTimer();
    setSolutionState("hidden");
    setSolutionStepCount(0);
    setSolutionTotalSteps(0);
    solutionGameRef.current = null;
    solutionCursorRef.current = null;

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
        handleWrongMove(from);
        return;
      }

      setGame(nextGame);
      setLastMove({ from, to });
      setMoveResult("correct");
      playSound(getMoveSound(nextGame, moveResultValue));

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
        playSound(replyGame.isCheck() ? "move-check" : "move-opponent");
      }, 500);
      return;
    }

    handleWrongMove(from);
  };

  const handleHint = () => {
    if (!puzzle || moveIndex >= puzzle.moves.length) {
      return;
    }
    setHintSquare(puzzle.moves[moveIndex].slice(0, 2));
  };

  function initializeSolutionReplay() {
    if (!game || !puzzle) {
      return false;
    }

    setSolutionStepCount(0);
    setSolutionTotalSteps(Math.max(0, puzzle.moves.length - moveIndex));
    solutionGameRef.current = new Chess(game.fen());
    solutionCursorRef.current = moveIndex;
    setPhase("playing");
    return true;
  }

  function runSolutionStep(autoReplay: boolean) {
    if (!puzzle || !solutionGameRef.current) {
      return;
    }
    if (autoReplay && !solutionPlayingRef.current) {
      return;
    }

    const cursor = solutionCursorRef.current;
    if (cursor === null) {
      return;
    }

    const nextUci = puzzle.moves[cursor];
    if (!nextUci) {
      solutionPlayingRef.current = false;
      solutionAutoReplayRef.current = false;
      solutionCursorRef.current = null;
      setSolutionState("complete");
      setPhase("solved");
      return;
    }

    const replayGame = solutionGameRef.current;
    const moved = replayGame.move({
      from: nextUci.slice(0, 2) as Square,
      to: nextUci.slice(2, 4) as Square,
      promotion: (nextUci[4] as "q" | "r" | "b" | "n") || undefined,
    });

    if (!moved) {
      solutionPlayingRef.current = false;
      solutionAutoReplayRef.current = false;
      solutionCursorRef.current = null;
      setSolutionState("complete");
      setPhase("solved");
      return;
    }

    const nextIndex = cursor + 1;
    solutionCursorRef.current = nextIndex;
    setGame(new Chess(replayGame.fen()));
    setMoveIndex(nextIndex);
    setLastMove({ from: nextUci.slice(0, 2), to: nextUci.slice(2, 4) });
    setMoveResult(null);
    setHintSquare(null);
    setSelectedSq(null);
    setLegalMoves([]);
    setSolutionStepCount((value) => value + 1);
    playSound(getMoveSound(replayGame, moved));

    if (nextIndex >= puzzle.moves.length) {
      solutionPlayingRef.current = false;
      solutionAutoReplayRef.current = false;
      solutionCursorRef.current = null;
      setSolutionState("complete");
      setPhase("solved");
      return;
    }

    if (autoReplay) {
      solutionTimerRef.current = setTimeout(() => runSolutionStep(true), 700);
    } else {
      setSolutionState("paused");
    }
  }

  const handleShowSolution = () => {
    if (solutionState === "playing") {
      clearSolutionTimer();
      setSolutionState("paused");
      return;
    }

    if (solutionState === "hidden") {
      if (!initializeSolutionReplay()) {
        return;
      }
    }

    clearSolutionTimer();
    solutionPlayingRef.current = true;
    solutionAutoReplayRef.current = true;
    setSolutionState("playing");
    solutionTimerRef.current = setTimeout(() => runSolutionStep(true), 150);
  };

  const handleNextSolutionMove = () => {
    if (solutionState === "complete") {
      return;
    }

    clearSolutionTimer();
    if (solutionState === "hidden" && !initializeSolutionReplay()) {
      return;
    }

    solutionPlayingRef.current = false;
    solutionAutoReplayRef.current = false;
    runSolutionStep(false);
  };

  const handleRetry = () => {
    clearSolutionTimer();
    if (puzzle) {
      initPuzzle(puzzle, reviewItem);
    }
  };

  useEffect(() => () => clearSolutionTimer(), []);

  const board = useMemo(() => {
    if (!game) {
      return Array.from({ length: 8 }, () => Array(8).fill(null));
    }
    return game.board().map((row) => row.map((piece) => (piece ? `${piece.color}${piece.type}` : null)));
  }, [game]);

  useEffect(() => {
    if (!game || !puzzle || !preferencesReady) {
      setVisualReady(false);
      return;
    }

    let cancelled = false;
    setVisualReady(false);

    const pieceCodes = new Set<string>();
    for (const row of game.board()) {
      for (const piece of row) {
        if (piece) {
          pieceCodes.add(`${piece.color}${piece.type}`);
        }
      }
    }

    const sources = [boardPath, ...Array.from(pieceCodes).map((piece) => `${piecePath}/${piece}.png`)];
    let remaining = sources.length;

    const markLoaded = () => {
      remaining -= 1;
      if (!cancelled && remaining <= 0) {
        setVisualReady(true);
      }
    };

    for (const source of sources) {
      const image = new window.Image();
      image.onload = markLoaded;
      image.onerror = markLoaded;
      image.src = source;
    }

    return () => {
      cancelled = true;
    };
  }, [boardPath, game, piecePath, preferencesReady, puzzle]);

  const ranks = flipped ? [...RANKS].reverse() : RANKS;
  const files = flipped ? [...FILES].reverse() : FILES;
  const getBoardArrowCoords = (square: string) => {
    const col = FILES.indexOf(square[0]);
    const row = 8 - Number.parseInt(square[1] ?? "1", 10);
    const visibleCol = flipped ? 7 - col : col;
    const visibleRow = flipped ? 7 - row : row;

    return {
      x: (visibleCol + 0.5) * 12.5,
      y: (visibleRow + 0.5) * 12.5,
    };
  };

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
  const sideInstruction =
    mode === "storm"
      ? "Solve fast. Wrong moves cost one life, and three misses end the run."
      : mode === "streak"
        ? "Keep the chain alive. One wrong move ends the streak."
        : mode === "daily" && progress.dailyStatus.completed
          ? "Daily puzzle completed. You can still review the line or continue free play."
          : mode === "review"
            ? `Replay queue: ${progress.replayCount} ${progress.replayCount === 1 ? "puzzle" : "puzzles"} waiting.`
        : `${playerSide === "w" ? "White" : "Black"} to move - find the best continuation.`;
  const streakMinRating = 600 + streakCount * 50;
  const streakMaxRating = 900 + streakCount * 50;
  const endedScore = phase === "storm_over" ? stormScore : streakCount;
  const previousBest = phase === "storm_over" ? progress.summary.bestStormScore : progress.summary.bestStreakScore;
  const isNewBest = endedScore > previousBest;

  const renderEmptyPanel = () => {
    if (loading) {
      return null;
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

  const renderDescriptionBox = (className = "") => (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-5 ${className}`}>
      <div className="flex flex-wrap gap-2 mb-4">
        {puzzle?.themes.slice(0, 4).map((theme) => (
          <span
            key={theme}
            className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-dimmed)] bg-[var(--surface)] border border-[var(--border)] rounded-full px-2.5 py-1 capitalize"
          >
            {theme.replace(/([A-Z])/g, " $1").trim()}
          </span>
        ))}
      </div>
      <p className="text-[13px] text-[var(--text-muted)] font-medium">
        {sideInstruction}
      </p>
      {mode === "storm" && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-dimmed)] font-bold">Score</p>
            <p className="text-[16px] text-[var(--text-primary)] font-bold tabular-nums">{stormScore}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-dimmed)] font-bold">Lives</p>
            <p className="text-[16px] text-rose-400 font-bold tabular-nums">{stormLives}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-dimmed)] font-bold">Best</p>
            <p className="text-[16px] text-[var(--text-primary)] font-bold tabular-nums">{progress.summary.bestStormScore}</p>
          </div>
        </div>
      )}
      {mode === "streak" && (
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-dimmed)] font-bold">Current</p>
            <p className="text-[16px] text-[var(--text-primary)] font-bold tabular-nums">{streakCount}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-dimmed)] font-bold">Best</p>
            <p className="text-[16px] text-[var(--text-primary)] font-bold tabular-nums">{progress.summary.bestStreakScore}</p>
          </div>
          <div className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-dimmed)] font-bold">Current Rating Band</p>
            <p className="text-[14px] text-[var(--text-primary)] font-bold tabular-nums">
              {streakMinRating}-{streakMaxRating}
            </p>
          </div>
        </div>
      )}
      {mode === "daily" && progress.dailyStatus.completed && (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] font-semibold text-emerald-400">
          Daily complete for {progress.dailyStatus.date}.
        </p>
      )}
      {mode === "review" && reviewItem && (
        <p className="mt-3 text-[12px] text-sky-400 font-semibold">
          Replay item #{reviewItem.id} due {new Date(reviewItem.nextReviewAt).toLocaleString()}.
        </p>
      )}
    </div>
  );

  const shouldShowSkeleton = loading || !preferencesReady || Boolean(puzzle && game && !visualReady);

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
        {shouldShowSkeleton ? (
          <PuzzleSolveSkeleton mode={mode} />
        ) : !puzzle || !game ? (
          <div className="w-full max-w-[640px]">{renderEmptyPanel()}</div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4">
              <div style={{ width: "min(85vw, 520px)" }} className="lg:hidden block">
                {renderDescriptionBox()}
              </div>

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
                    className={`absolute inset-0 z-30 rounded-xl pointer-events-none transition-opacity duration-200 ${moveResult === "correct"
                        ? "bg-emerald-500/10 border-2 border-emerald-500/40"
                        : "bg-red-500/10 border-2 border-red-500/40"
                      }`}
                  />
                )}

                {rightClickArrows.length > 0 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-[16]" viewBox="0 0 100 100" preserveAspectRatio="none" opacity="0.85">
                    <defs>
                      <marker id="puzzle-right-click-arrow-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.4" markerHeight="3.4" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(255, 170, 0)" />
                      </marker>
                    </defs>
                    {rightClickArrows.map((arrow, index) => {
                      const start = getBoardArrowCoords(arrow.start);
                      const end = getBoardArrowCoords(arrow.end);
                      const dx = end.x - start.x;
                      const dy = end.y - start.y;
                      const isKnightMove = Math.abs(dx) > 0 && Math.abs(dy) > 0 && Math.abs(dx) !== Math.abs(dy);

                      if (isKnightMove) {
                        const useXFirst = Math.abs(dx) > Math.abs(dy);
                        const corner = useXFirst ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
                        return (
                          <path
                            key={`${arrow.start}-${arrow.end}-${index}`}
                            d={`M ${start.x} ${start.y} L ${corner.x} ${corner.y} L ${end.x} ${end.y}`}
                            stroke="rgb(255, 170, 0)"
                            strokeWidth="1.8"
                            fill="none"
                            strokeLinecap="butt"
                            strokeLinejoin="miter"
                            markerEnd="url(#puzzle-right-click-arrow-head)"
                          />
                        );
                      }

                      return (
                        <line
                          key={`${arrow.start}-${arrow.end}-${index}`}
                          x1={start.x}
                          y1={start.y}
                          x2={end.x}
                          y2={end.y}
                          stroke="rgb(255, 170, 0)"
                          strokeWidth="1.8"
                          strokeLinecap="butt"
                          markerEnd="url(#puzzle-right-click-arrow-head)"
                        />
                      );
                    })}
                  </svg>
                )}

                <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 rounded-xl overflow-hidden" onContextMenu={(event) => event.preventDefault()}>
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
                      const isWrongMoveSource = wrongMoveSquare === square;
                      const hasPiece = Boolean(piece);
                      const activeColor = phase === "playing" ? playerSide : game.turn();

                      return (
                        <div
                          key={square}
                          className="relative flex items-center justify-center cursor-pointer"
                          onClick={() => handleSquareClick(square)}
                          onMouseDown={(event) => handleRightClickDown(event, square)}
                          onMouseUp={(event) => handleRightClickUp(event, square)}
                          onContextMenu={(event) => event.preventDefault()}
                          onDragOver={(event) => {
                            if (moveMethod !== "click") {
                              event.preventDefault();
                            }
                          }}
                          onDrop={() => handleDrop(square)}
                        >
                          {isLastMove && <div className="absolute inset-0 bg-amber-400/25 z-10" />}
                          {rightClickHighlights.has(square) && <div className="absolute inset-0 bg-red-500/50 z-[4]" />}
                          {isSelected && <div className="absolute inset-0 bg-emerald-400/30 z-10" />}
                          {isHint && <div className="absolute inset-0 bg-sky-400/35 z-10 animate-pulse" />}
                          {isWrongMoveSource && <div className="absolute inset-0 bg-red-500/45 z-20 animate-pulse" />}

                          {showLegalMoves && isLegal && !hasPiece && (
                            <div className="absolute z-20 w-[26%] h-[26%] rounded-full bg-[var(--text-primary)] opacity-20" />
                          )}
                          {showLegalMoves && isLegal && hasPiece && (
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
                              draggable={moveMethod !== "click" && piece[0] === activeColor}
                              onDragStart={() => handleDragStart(square)}
                              onDragEnd={handleDragEnd}
                            />
                          )}

                          {fileIndex === 0 && (
                            <span className="absolute top-[2px] left-[4px] text-[11px] font-bold z-20 opacity-60 text-[var(--text-primary)] pointer-events-none select-none">
                              {rank}
                            </span>
                          )}
                          {rankIndex === 7 && (
                            <span className="absolute bottom-[1px] right-[4px] text-[11px] font-bold z-20 opacity-60 text-[var(--text-primary)] pointer-events-none select-none">
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
                  <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                    Free play
                  </span>
                )}
              </div>
            </div>

            <div className="w-full lg:w-[300px] flex flex-col gap-4">
              {renderDescriptionBox("hidden lg:block")}

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all text-[13px] font-semibold"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>

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
                        {solutionState === "playing" ? <Pause className="w-4 h-4" /> : solutionState === "paused" ? <Play className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {solutionState === "playing" ? "Pause" : solutionState === "paused" ? "Auto Replay" : "Auto Replay"}
                      </button>
                      <button
                        onClick={handleNextSolutionMove}
                        disabled={solutionState === "complete"}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all text-[13px] font-semibold disabled:opacity-50"
                      >
                        <Play className="w-4 h-4" />
                        Next Move
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
                  {mode === "storm" && (
                    <button
                      onClick={handleStormPass}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-400/50 transition-all text-[13px] font-semibold"
                    >
                      <SkipForward className="w-4 h-4" />
                      Pass -1 Life
                    </button>
                  )}
                </div>
              )}

              {phase === "solved" && (mode === "standard" || mode === "daily" || mode === "review") && (
                <div
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="w-5 h-5 text-emerald-400" />
                    <span className="text-[16px] font-bold text-emerald-400">Correct!</span>
                  </div>
                  <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                    <p className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">Free move navigation</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => goToFreeMoveHistory(-1)}
                        disabled={freeMoveHistoryIndex <= 0}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Prev Move
                      </button>
                      <button
                        onClick={() => goToFreeMoveHistory(1)}
                        disabled={freeMoveHistoryIndex >= freeMoveHistory.length - 1}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <SkipForward className="w-4 h-4" />
                        Next Move
                      </button>
                    </div>
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
                  <p className={`text-[12px] font-semibold mb-4 ${isNewBest ? "text-amber-300" : "text-[var(--text-dimmed)]"}`}>
                    {isNewBest ? "New personal best" : `Personal best: ${previousBest}`}
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

              {solutionState !== "hidden" && puzzle && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-bold text-[var(--text-primary)]">Solution Replay</p>
                      <p className="text-[12px] text-[var(--text-dimmed)] font-medium">
                        Showing the line one move at a time: {solutionStepCount} / {solutionTotalSteps}
                      </p>
                    </div>
                    {solutionState !== "complete" && (
                      <button
                        onClick={handleShowSolution}
                        className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[12px] font-semibold text-[var(--text-primary)]"
                      >
                        {solutionState === "playing" ? "Pause" : "Resume"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <BoardSettingsModal
        open={isSettingsOpen}
        boardTheme={boardTheme}
        pieceTheme={pieceTheme}
        boardThemes={AVAILABLE_BOARD_THEMES}
        pieceThemes={AVAILABLE_PIECE_THEMES}
        boardAssets={BOARD_ASSETS}
        pieceAssets={PIECE_ASSETS}
        moveMethod={moveMethod}
        showLegalMoves={showLegalMoves}
        soundEnabled={soundEnabled}
        masterVolume={masterVolume}
        saving={preferencesSaving}
        error={preferencesError}
        onBoardThemeChange={setBoardTheme}
        onPieceThemeChange={setPieceTheme}
        onMoveMethodChange={(next) => {
          setMoveMethod(next);
          persistGameplayPreferences(next, showLegalMoves);
        }}
        onShowLegalMovesChange={(next) => {
          setShowLegalMoves(next);
          persistGameplayPreferences(moveMethod, next);
        }}
        onSoundEnabledChange={setSoundEnabled}
        onMasterVolumeChange={(next) => {
          setMasterVolume(next);
          const preferences = loadClientPreferences();
          preferences.learn.masterVolume = next;
          saveClientPreferences(preferences);
        }}
        onPreviewSound={() => playSound("move-self", true)}
        onClose={() => setIsSettingsOpen(false)}
        onSave={() => {
          void savePuzzleSettings();
        }}
      />
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
