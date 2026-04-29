import type { PuzzleActivityEntry, PuzzleClientPreferences } from "@/lib/client-preferences";

export type PuzzleAttemptOutcome = "solved" | "failed";
export type PuzzleReviewState = "queued" | "done" | "snoozed";
export type PuzzleReviewReason = "failed" | "manual_save" | "streak_break";
export type PuzzleAttemptMode = "standard" | "random" | "daily" | "review" | "storm" | "streak";
export type CanonicalPuzzleMode = Exclude<PuzzleAttemptMode, "standard">;

export type PuzzleAttemptInput = {
  puzzleId: string;
  puzzleRating: number;
  themes: string[];
  outcome: PuzzleAttemptOutcome;
  mode: PuzzleAttemptMode;
  timeTakenMs?: number;
  dailyDate?: string;
  modeScore?: number;
};

export type DailyPuzzleStatus = {
  date: string;
  puzzleId: string | null;
  completed: boolean;
  solvedAt: string | null;
  completionState: "pending" | "attempted" | "solved";
};

export type PuzzleThemeStat = {
  solved: number;
  failed: number;
  played: number;
  accuracy: number;
  lastAttemptAt: string | null;
};

export type PuzzleProgressSummary = {
  currentRating: number;
  puzzlesSolved: number;
  puzzlesFailed: number;
  currentStreak: number;
  bestStormScore: number;
  bestStreakScore: number;
  lastActivityAt: string | null;
};

export type PuzzleRecentActivityEntry = {
  puzzleId: string;
  theme: string;
  rating: number;
  solved: boolean;
  timestamp: string;
  timeTakenMs?: number;
  mode: CanonicalPuzzleMode;
};

export type PuzzleRatingHistoryPoint = {
  date: string;
  rating: number;
};

export type PuzzleReviewItem = {
  id: number;
  puzzleId: string;
  sourceReason: PuzzleReviewReason | string;
  nextReviewAt: string;
  reviewState: PuzzleReviewState;
  lastResult: PuzzleAttemptOutcome | null;
  themeSnapshot: string[];
  createdAt: string;
  updatedAt: string;
};

export type PuzzleProgressDataSource = "local" | "server";

export type PuzzleProgressSnapshot = {
  authenticated: boolean;
  dataSource: PuzzleProgressDataSource;
  hasServerHistory: boolean;
  summary: PuzzleProgressSummary;
  dailyStatus: DailyPuzzleStatus;
  replayCount: number;
  reviewThemeCounts: Record<string, number>;
  themeStats: Record<string, PuzzleThemeStat>;
  ratingHistory: PuzzleRatingHistoryPoint[];
  recentActivity: PuzzleRecentActivityEntry[];
  recentPuzzleIds: string[];
};

export type PuzzleThemeDashboardRow = {
  themeId: string;
  played: number;
  solved: number;
  failed: number;
  solvedPercent: number;
  performance: number | string;
  toReplay: number;
  lastAttemptAt: string | null;
};

export type PuzzleProgressImportInput = {
  summary: Pick<
    PuzzleProgressSummary,
    "currentRating" | "puzzlesSolved" | "puzzlesFailed" | "currentStreak" | "bestStormScore" | "bestStreakScore"
  >;
  themeStats: Record<string, { solved: number; failed: number }>;
  recentActivity: PuzzleActivityEntry[];
  dailyStatus: Pick<DailyPuzzleStatus, "date" | "completed">;
};

export const DEFAULT_PUZZLE_PROGRESS_SUMMARY: PuzzleProgressSummary = {
  currentRating: 1200,
  puzzlesSolved: 0,
  puzzlesFailed: 0,
  currentStreak: 0,
  bestStormScore: 0,
  bestStreakScore: 0,
  lastActivityAt: null,
};

export function getTodayUtcDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function normalizePuzzleMode(mode: PuzzleAttemptMode): CanonicalPuzzleMode {
  return mode === "standard" ? "random" : mode;
}

export function createEmptyDailyPuzzleStatus(date = getTodayUtcDate()): DailyPuzzleStatus {
  return {
    date,
    puzzleId: null,
    completed: false,
    solvedAt: null,
    completionState: "pending",
  };
}

export function createEmptyPuzzleProgressSnapshot(authenticated: boolean): PuzzleProgressSnapshot {
  return {
    authenticated,
    dataSource: authenticated ? "server" : "local",
    hasServerHistory: false,
    summary: { ...DEFAULT_PUZZLE_PROGRESS_SUMMARY },
    dailyStatus: createEmptyDailyPuzzleStatus(),
    replayCount: 0,
    reviewThemeCounts: {},
    themeStats: {},
    ratingHistory: [],
    recentActivity: [],
    recentPuzzleIds: [],
  };
}

export function calculateNextPuzzleRating(
  currentRating: number,
  puzzleRating: number,
  outcome: PuzzleAttemptOutcome,
) {
  const kFactor = 20;
  const expectedScore = 1 / (1 + Math.pow(10, (puzzleRating - currentRating) / 400));
  const actualScore = outcome === "solved" ? 1 : 0;
  const ratingChange = Math.round(kFactor * (actualScore - expectedScore));
  return Math.max(400, currentRating + ratingChange);
}

export function calculateThemePerformance(
  baseRating: number,
  solved: number,
  failed: number,
): number | "?" {
  const played = solved + failed;
  if (played < 3) {
    return "?";
  }

  const expectedScore = solved / played;
  if (expectedScore <= 0) {
    return Math.max(400, baseRating - 200);
  }

  if (expectedScore >= 1) {
    return baseRating + 200;
  }

  const ratingDiff = -400 * Math.log10(1 / expectedScore - 1);
  return Math.round(baseRating + ratingDiff);
}

export function buildThemeDashboardRows(
  themeStats: Record<string, PuzzleThemeStat>,
  baseRating: number,
  reviewThemeCounts: Record<string, number>,
) {
  return Object.entries(themeStats).map(([themeId, stats]): PuzzleThemeDashboardRow => ({
    themeId,
    played: stats.played,
    solved: stats.solved,
    failed: stats.failed,
    solvedPercent: stats.played > 0 ? (stats.solved / stats.played) * 100 : 0,
    performance: calculateThemePerformance(baseRating, stats.solved, stats.failed),
    toReplay: reviewThemeCounts[themeId] ?? 0,
    lastAttemptAt: stats.lastAttemptAt,
  }));
}

export function buildLocalPuzzleProgressSnapshot(
  puzzlePreferences: PuzzleClientPreferences,
  authenticated = false,
): PuzzleProgressSnapshot {
  const today = getTodayUtcDate();
  const next = createEmptyPuzzleProgressSnapshot(authenticated);
  next.dataSource = "local";
  next.hasServerHistory = false;
  const latestPuzzleOutcome = new Map<string, PuzzleRecentActivityEntry>();
  const latestThemeAttempt = new Map<string, string>();

  const recentActivity = puzzlePreferences.recentActivity.map((entry) => {
    const mode: CanonicalPuzzleMode = "random";
    return {
      puzzleId: entry.puzzleId,
      theme: entry.theme,
      rating: entry.rating,
      solved: entry.solved,
      timestamp: entry.timestamp,
      timeTakenMs: entry.timeTakenMs,
      mode,
    } satisfies PuzzleRecentActivityEntry;
  });

  for (const entry of recentActivity) {
    if (!latestPuzzleOutcome.has(entry.puzzleId)) {
      latestPuzzleOutcome.set(entry.puzzleId, entry);
    }
    if (!latestThemeAttempt.has(entry.theme)) {
      latestThemeAttempt.set(entry.theme, entry.timestamp);
    }
  }

  const reviewThemeCounts: Record<string, number> = {};
  for (const entry of latestPuzzleOutcome.values()) {
    if (!entry.solved) {
      reviewThemeCounts[entry.theme] = (reviewThemeCounts[entry.theme] ?? 0) + 1;
    }
  }

  const themeStats: Record<string, PuzzleThemeStat> = {};
  for (const [themeId, stat] of Object.entries(puzzlePreferences.puzzleThemeStats)) {
    const played = stat.solved + stat.failed;
    themeStats[themeId] = {
      solved: stat.solved,
      failed: stat.failed,
      played,
      accuracy: played > 0 ? stat.solved / played : 0,
      lastAttemptAt: latestThemeAttempt.get(themeId) ?? null,
    };
  }

  next.summary = {
    currentRating: puzzlePreferences.puzzleRating,
    puzzlesSolved: puzzlePreferences.puzzlesSolved,
    puzzlesFailed: puzzlePreferences.puzzlesFailed,
    currentStreak: puzzlePreferences.currentStreak,
    bestStormScore: puzzlePreferences.bestStormScore,
    bestStreakScore: puzzlePreferences.bestStreakScore,
    lastActivityAt: recentActivity[0]?.timestamp ?? null,
  };
  next.dailyStatus = {
    date: today,
    puzzleId: null,
    completed: puzzlePreferences.lastDailyPuzzleDate === today && puzzlePreferences.dailyPuzzleSolved,
    solvedAt: null,
    completionState:
      puzzlePreferences.lastDailyPuzzleDate === today
        ? puzzlePreferences.dailyPuzzleSolved
          ? "solved"
          : "attempted"
        : "pending",
  };
  next.replayCount = Array.from(latestPuzzleOutcome.values()).filter((entry) => !entry.solved).length;
  next.reviewThemeCounts = reviewThemeCounts;
  next.themeStats = themeStats;
  next.ratingHistory = puzzlePreferences.ratingHistory.map((point) => ({
    date: point.date,
    rating: point.rating,
  }));
  next.recentActivity = recentActivity;
  next.recentPuzzleIds = Array.from(new Set(recentActivity.map((entry) => entry.puzzleId))).slice(0, 12);
  return next;
}

export function hasMeaningfulLocalPuzzleProgress(puzzlePreferences: PuzzleClientPreferences) {
  return (
    puzzlePreferences.puzzlesSolved > 0 ||
    puzzlePreferences.puzzlesFailed > 0 ||
    puzzlePreferences.bestStormScore > 0 ||
    puzzlePreferences.bestStreakScore > 0 ||
    puzzlePreferences.currentStreak > 0 ||
    puzzlePreferences.dailyPuzzleSolved ||
    puzzlePreferences.recentActivity.length > 0 ||
    Object.keys(puzzlePreferences.puzzleThemeStats).length > 0
  );
}

export function createPuzzleProgressImportInput(
  puzzlePreferences: PuzzleClientPreferences,
): PuzzleProgressImportInput {
  return {
    summary: {
      currentRating: puzzlePreferences.puzzleRating,
      puzzlesSolved: puzzlePreferences.puzzlesSolved,
      puzzlesFailed: puzzlePreferences.puzzlesFailed,
      currentStreak: puzzlePreferences.currentStreak,
      bestStormScore: puzzlePreferences.bestStormScore,
      bestStreakScore: puzzlePreferences.bestStreakScore,
    },
    themeStats: Object.fromEntries(
      Object.entries(puzzlePreferences.puzzleThemeStats).map(([themeId, stats]) => [
        themeId,
        {
          solved: stats.solved,
          failed: stats.failed,
        },
      ]),
    ),
    recentActivity: puzzlePreferences.recentActivity.map((entry) => ({ ...entry })),
    dailyStatus: {
      date: puzzlePreferences.lastDailyPuzzleDate || getTodayUtcDate(),
      completed: puzzlePreferences.dailyPuzzleSolved,
    },
  };
}

export function applyAttemptToLocalPuzzlePreferences(
  current: PuzzleClientPreferences,
  input: PuzzleAttemptInput,
): PuzzleClientPreferences {
  const timestamp = new Date().toISOString();
  const mode = normalizePuzzleMode(input.mode);
  const nextThemeStats = Object.fromEntries(
    Object.entries(current.puzzleThemeStats).map(([key, value]) => [key, { ...value }]),
  );
  const nextRecentActivity = [...current.recentActivity];
  const nextRatingHistory = [...current.ratingHistory];
  const next = {
    ...current,
    puzzleThemeStats: nextThemeStats,
    recentActivity: nextRecentActivity,
    ratingHistory: nextRatingHistory,
  };

  next.puzzleRating = calculateNextPuzzleRating(current.puzzleRating, input.puzzleRating, input.outcome);

  if (input.outcome === "solved") {
    next.puzzlesSolved += 1;
  } else {
    next.puzzlesFailed += 1;
  }

  if (mode === "random" || mode === "daily" || mode === "review") {
    next.currentStreak = input.outcome === "solved" ? current.currentStreak + 1 : 0;
  }

  if (mode === "storm" && typeof input.modeScore === "number") {
    next.bestStormScore = Math.max(current.bestStormScore, input.modeScore);
  }

  if (mode === "streak" && typeof input.modeScore === "number") {
    next.bestStreakScore = Math.max(current.bestStreakScore, input.modeScore);
  }

  for (const themeId of input.themes) {
    if (!next.puzzleThemeStats[themeId]) {
      next.puzzleThemeStats[themeId] = { solved: 0, failed: 0 };
    }
    if (input.outcome === "solved") {
      next.puzzleThemeStats[themeId].solved += 1;
    } else {
      next.puzzleThemeStats[themeId].failed += 1;
    }
  }

  next.recentActivity.unshift({
    puzzleId: input.puzzleId,
    theme: input.themes[0] ?? "mix",
    rating: input.puzzleRating,
    solved: input.outcome === "solved",
    timestamp,
    timeTakenMs: input.timeTakenMs,
  });
  if (next.recentActivity.length > 100) {
    next.recentActivity.length = 100;
  }

  next.ratingHistory.push({
    date: timestamp,
    rating: next.puzzleRating,
  });
  if (next.ratingHistory.length > 1000) {
    next.ratingHistory.splice(0, next.ratingHistory.length - 1000);
  }

  if (mode === "daily") {
    next.lastDailyPuzzleDate = input.dailyDate ?? getTodayUtcDate();
    next.dailyPuzzleSolved = input.outcome === "solved";
  }

  return next;
}
