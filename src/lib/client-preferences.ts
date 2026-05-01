export type MoveMethod = "drag" | "click" | "both";
export type BoardOrientation = "auto" | "white" | "black";
export type PremoveMode = "single" | "multiple";
export type LearnSortMode = "recommended" | "recent" | "mastery" | "new" | "white" | "black" | "popularity";
export type OpeningVariationSortMode = "popularity" | "progress";

export type LearnVariationProgress = {
  attempts: number;
  completions: number;
  bestAccuracy: number;
  lastAccuracy: number;
  lastPracticedAt: string;
};

export type LearnOpeningProgress = {
  lastPracticedLineId: string | null;
  lastPracticedAt: string;
  variations: Record<string, LearnVariationProgress>;
};

export type LearnClientPreferences = {
  autoQueen: boolean;
  moveConfirmation: boolean;
  premoveEnabled: boolean;
  premoveMode: PremoveMode;
  showLegalMoves: boolean;
  moveMethod: MoveMethod;
  boardOrientation: BoardOrientation;
  engineDepth: number;
  showOpeningNames: boolean;
  masterVolume: number;
  learnSortMode: LearnSortMode;
  openingVariationSortMode: OpeningVariationSortMode;
  openingProgressBySlug: Record<string, LearnOpeningProgress>;
};

export type BotClientPreferences = {
  autoQueen: boolean;
  moveConfirmation: boolean;
  premoveEnabled: boolean;
  premoveMode: PremoveMode;
  showLegalMoves: boolean;
  moveMethod: MoveMethod;
  boardOrientation: BoardOrientation;
  lowTimeWarning: boolean;
  boardLock: boolean;
  masterVolume: number;
};

export type PuzzleThemeStat = {
  solved: number;
  failed: number;
};

export type PuzzleActivityEntry = {
  puzzleId: string;
  theme: string;
  rating: number;
  solved: boolean;
  timestamp: string;
  timeTakenMs?: number;
};

export type PuzzleClientPreferences = {
  puzzleRating: number;
  puzzlesSolved: number;
  puzzlesFailed: number;
  bestStormScore: number;
  bestStreakScore: number;
  currentStreak: number;
  lastDailyPuzzleDate: string;
  dailyPuzzleSolved: boolean;
  puzzleThemeStats: Record<string, PuzzleThemeStat>;
  ratingHistory: { date: string; rating: number }[];
  recentActivity: PuzzleActivityEntry[];
};

export type ClientPreferences = {
  learn: LearnClientPreferences;
  bot: BotClientPreferences;
  puzzle: PuzzleClientPreferences;
};

export const CLIENT_PREFERENCES_STORAGE_KEY = "ChessLearn-client-preferences";

export const DEFAULT_CLIENT_PREFERENCES: ClientPreferences = {
  learn: {
    autoQueen: false,
    moveConfirmation: false,
    premoveEnabled: true,
    premoveMode: "single",
    showLegalMoves: true,
    moveMethod: "both",
    boardOrientation: "auto",
    engineDepth: 18,
    showOpeningNames: true,
    masterVolume: 80,
    learnSortMode: "recommended",
    openingVariationSortMode: "popularity",
    openingProgressBySlug: {},
  },
  bot: {
    autoQueen: false,
    moveConfirmation: false,
    premoveEnabled: true,
    premoveMode: "single",
    showLegalMoves: true,
    moveMethod: "both",
    boardOrientation: "auto",
    lowTimeWarning: true,
    boardLock: false,
    masterVolume: 80,
  },
  puzzle: {
    puzzleRating: 1200,
    puzzlesSolved: 0,
    puzzlesFailed: 0,
    bestStormScore: 0,
    bestStreakScore: 0,
    currentStreak: 0,
    lastDailyPuzzleDate: "",
    dailyPuzzleSolved: false,
    puzzleThemeStats: {},
    ratingHistory: [],
    recentActivity: [],
  },
};

export function loadClientPreferences(): ClientPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_CLIENT_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(CLIENT_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CLIENT_PREFERENCES;
    }

    const parsed = JSON.parse(raw) as Partial<ClientPreferences> & Record<string, unknown>;
    if (isScopedPreferences(parsed)) {
      const puzzleRaw = (parsed as Record<string, unknown>).puzzle as Partial<PuzzleClientPreferences> | undefined;
      return {
        learn: {
          ...DEFAULT_CLIENT_PREFERENCES.learn,
          ...parsed.learn,
          engineDepth: clampNumber(parsed.learn.engineDepth, 10, 24, DEFAULT_CLIENT_PREFERENCES.learn.engineDepth),
          masterVolume: clampNumber(parsed.learn.masterVolume, 0, 100, DEFAULT_CLIENT_PREFERENCES.learn.masterVolume),
          learnSortMode: toLearnSortMode(parsed.learn.learnSortMode),
          openingVariationSortMode: toOpeningVariationSortMode(parsed.learn.openingVariationSortMode),
          openingProgressBySlug: normalizeOpeningProgressBySlug(parsed.learn.openingProgressBySlug),
        },
        bot: {
          ...DEFAULT_CLIENT_PREFERENCES.bot,
          ...parsed.bot,
          masterVolume: clampNumber(parsed.bot.masterVolume, 0, 100, DEFAULT_CLIENT_PREFERENCES.bot.masterVolume),
        },
        puzzle: normalizePuzzlePreferences(puzzleRaw),
      };
    }

    // Legacy migration from old flat preference shape.
    const legacy = parsed as Record<string, unknown>;
    return {
      learn: {
        ...DEFAULT_CLIENT_PREFERENCES.learn,
        autoQueen: legacy.autoQueen === true,
        moveConfirmation: legacy.moveConfirmation === true,
        premoveEnabled: legacy.premoveEnabled !== false,
        premoveMode: toPremoveMode(legacy.premoveMode),
        showLegalMoves: legacy.showLegalMoves !== false,
        moveMethod: toMoveMethod(legacy.moveMethod),
        boardOrientation: toBoardOrientation(legacy.boardOrientation),
        engineDepth: clampNumber(asNumber(legacy.engineDepth), 10, 24, DEFAULT_CLIENT_PREFERENCES.learn.engineDepth),
        showOpeningNames: legacy.showOpeningNames !== false,
        masterVolume: clampNumber(asNumber(legacy.masterVolume), 0, 100, DEFAULT_CLIENT_PREFERENCES.learn.masterVolume),
        learnSortMode: DEFAULT_CLIENT_PREFERENCES.learn.learnSortMode,
        openingVariationSortMode: DEFAULT_CLIENT_PREFERENCES.learn.openingVariationSortMode,
        openingProgressBySlug: {},
      },
      bot: {
        ...DEFAULT_CLIENT_PREFERENCES.bot,
        autoQueen: legacy.autoQueen === true,
        moveConfirmation: legacy.moveConfirmation === true,
        premoveEnabled: legacy.premoveEnabled !== false,
        premoveMode: toPremoveMode(legacy.premoveMode),
        showLegalMoves: legacy.showLegalMoves !== false,
        moveMethod: toMoveMethod(legacy.moveMethod),
        boardOrientation: toBoardOrientation(legacy.boardOrientation),
        lowTimeWarning: legacy.lowTimeWarning !== false,
        boardLock: legacy.boardLock === true,
        masterVolume: clampNumber(asNumber(legacy.masterVolume), 0, 100, DEFAULT_CLIENT_PREFERENCES.bot.masterVolume),
      },
      puzzle: DEFAULT_CLIENT_PREFERENCES.puzzle,
    };
  } catch {
    return DEFAULT_CLIENT_PREFERENCES;
  }
}

export function saveClientPreferences(preferences: ClientPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CLIENT_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeOpeningProgressBySlug(value: unknown): Record<string, LearnOpeningProgress> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: Record<string, LearnOpeningProgress> = {};

  for (const [slug, openingValue] of entries) {
    if (!openingValue || typeof openingValue !== "object") {
      continue;
    }

    const opening = openingValue as Record<string, unknown>;
    const variationsValue = opening.variations;
    const normalizedVariations: Record<string, LearnVariationProgress> = {};

    if (variationsValue && typeof variationsValue === "object") {
      for (const [variationId, variationValue] of Object.entries(variationsValue as Record<string, unknown>)) {
        if (!variationValue || typeof variationValue !== "object") {
          continue;
        }

        const variation = variationValue as Record<string, unknown>;
        const attempts = clampNumber(asNumber(variation.attempts), 0, 1_000_000, 0);
        const completions = clampNumber(asNumber(variation.completions), 0, 1_000_000, 0);
        const bestAccuracy = clampNumber(asNumber(variation.bestAccuracy), 0, 100, 0);
        const lastAccuracy = clampNumber(asNumber(variation.lastAccuracy), 0, 100, 0);
        const lastPracticedAt = typeof variation.lastPracticedAt === "string" ? variation.lastPracticedAt : "";

        normalizedVariations[variationId] = {
          attempts,
          completions,
          bestAccuracy,
          lastAccuracy,
          lastPracticedAt,
        };
      }
    }

    normalized[slug] = {
      lastPracticedLineId: typeof opening.lastPracticedLineId === "string" ? opening.lastPracticedLineId : null,
      lastPracticedAt: typeof opening.lastPracticedAt === "string" ? opening.lastPracticedAt : "",
      variations: normalizedVariations,
    };
  }

  return normalized;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function toMoveMethod(value: unknown): MoveMethod {
  if (value === "drag" || value === "click" || value === "both") {
    return value;
  }
  return DEFAULT_CLIENT_PREFERENCES.learn.moveMethod;
}

function toPremoveMode(value: unknown): PremoveMode {
  if (value === "single" || value === "multiple") {
    return value;
  }
  return DEFAULT_CLIENT_PREFERENCES.learn.premoveMode;
}

function toBoardOrientation(value: unknown): BoardOrientation {
  if (value === "auto" || value === "white" || value === "black") {
    return value;
  }
  return DEFAULT_CLIENT_PREFERENCES.learn.boardOrientation;
}

function toLearnSortMode(value: unknown): LearnSortMode {
  if (
    value === "recommended" ||
    value === "recent" ||
    value === "mastery" ||
    value === "new" ||
    value === "white" ||
    value === "black" ||
    value === "popularity"
  ) {
    return value;
  }
  return DEFAULT_CLIENT_PREFERENCES.learn.learnSortMode;
}

function toOpeningVariationSortMode(value: unknown): OpeningVariationSortMode {
  if (value === "popularity" || value === "progress") {
    return value;
  }

  return DEFAULT_CLIENT_PREFERENCES.learn.openingVariationSortMode;
}

function isScopedPreferences(value: Partial<ClientPreferences> & Record<string, unknown>): value is ClientPreferences {
  return typeof value.learn === "object" && value.learn !== null && typeof value.bot === "object" && value.bot !== null;
}

function normalizePuzzlePreferences(value: Partial<PuzzleClientPreferences> | undefined | null): PuzzleClientPreferences {
  if (!value || typeof value !== "object") {
    return DEFAULT_CLIENT_PREFERENCES.puzzle;
  }

  const themeStats: Record<string, PuzzleThemeStat> = {};
  if (value.puzzleThemeStats && typeof value.puzzleThemeStats === "object") {
    for (const [key, stat] of Object.entries(value.puzzleThemeStats)) {
      if (stat && typeof stat === "object") {
        themeStats[key] = {
          solved: clampNumber(asNumber((stat as Record<string, unknown>).solved), 0, 1_000_000, 0),
          failed: clampNumber(asNumber((stat as Record<string, unknown>).failed), 0, 1_000_000, 0),
        };
      }
    }
  }

  let ratingHistory: { date: string; rating: number }[] = [];
  if (Array.isArray(value.ratingHistory)) {
    ratingHistory = value.ratingHistory.filter((entry): entry is { date: string; rating: number } => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      const parsed = entry as { date?: unknown; rating?: unknown };
      return typeof parsed.date === "string" && typeof parsed.rating === "number";
    });
  }

  let recentActivity: PuzzleActivityEntry[] = [];
  if (Array.isArray(value.recentActivity)) {
    recentActivity = value.recentActivity.filter((entry): entry is PuzzleActivityEntry => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      const parsed = entry as {
        puzzleId?: unknown;
        theme?: unknown;
        rating?: unknown;
        solved?: unknown;
        timestamp?: unknown;
      };

      return (
        typeof parsed.puzzleId === "string" &&
        typeof parsed.theme === "string" &&
        typeof parsed.rating === "number" &&
        typeof parsed.solved === "boolean" &&
        typeof parsed.timestamp === "string"
      );
    });
  }

  return {
    puzzleRating: clampNumber(asNumber(value.puzzleRating), 400, 3200, 1200),
    puzzlesSolved: clampNumber(asNumber(value.puzzlesSolved), 0, 1_000_000, 0),
    puzzlesFailed: clampNumber(asNumber(value.puzzlesFailed), 0, 1_000_000, 0),
    bestStormScore: clampNumber(asNumber(value.bestStormScore), 0, 1_000_000, 0),
    bestStreakScore: clampNumber(asNumber(value.bestStreakScore), 0, 1_000_000, 0),
    currentStreak: clampNumber(asNumber(value.currentStreak), 0, 1_000_000, 0),
    lastDailyPuzzleDate: typeof value.lastDailyPuzzleDate === "string" ? value.lastDailyPuzzleDate : "",
    dailyPuzzleSolved: value.dailyPuzzleSolved === true,
    puzzleThemeStats: themeStats,
    ratingHistory,
    recentActivity,
  };
}
