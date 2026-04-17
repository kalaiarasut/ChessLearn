export type MoveMethod = "drag" | "click" | "both";
export type BoardOrientation = "auto" | "white" | "black";

export type LearnClientPreferences = {
  autoQueen: boolean;
  moveConfirmation: boolean;
  showLegalMoves: boolean;
  moveMethod: MoveMethod;
  boardOrientation: BoardOrientation;
  engineDepth: number;
  showOpeningNames: boolean;
  masterVolume: number;
};

export type BotClientPreferences = {
  autoQueen: boolean;
  moveConfirmation: boolean;
  showLegalMoves: boolean;
  moveMethod: MoveMethod;
  boardOrientation: BoardOrientation;
  lowTimeWarning: boolean;
  boardLock: boolean;
  masterVolume: number;
};

export type ClientPreferences = {
  learn: LearnClientPreferences;
  bot: BotClientPreferences;
};

export const CLIENT_PREFERENCES_STORAGE_KEY = "chessify-client-preferences";

export const DEFAULT_CLIENT_PREFERENCES: ClientPreferences = {
  learn: {
    autoQueen: false,
    moveConfirmation: false,
    showLegalMoves: true,
    moveMethod: "both",
    boardOrientation: "auto",
    engineDepth: 18,
    showOpeningNames: true,
    masterVolume: 80,
  },
  bot: {
    autoQueen: false,
    moveConfirmation: false,
    showLegalMoves: true,
    moveMethod: "both",
    boardOrientation: "auto",
    lowTimeWarning: true,
    boardLock: false,
    masterVolume: 80,
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
      return {
        learn: {
          ...DEFAULT_CLIENT_PREFERENCES.learn,
          ...parsed.learn,
          engineDepth: clampNumber(parsed.learn.engineDepth, 10, 24, DEFAULT_CLIENT_PREFERENCES.learn.engineDepth),
          masterVolume: clampNumber(parsed.learn.masterVolume, 0, 100, DEFAULT_CLIENT_PREFERENCES.learn.masterVolume),
        },
        bot: {
          ...DEFAULT_CLIENT_PREFERENCES.bot,
          ...parsed.bot,
          masterVolume: clampNumber(parsed.bot.masterVolume, 0, 100, DEFAULT_CLIENT_PREFERENCES.bot.masterVolume),
        },
      };
    }

    // Legacy migration from old flat preference shape.
    const legacy = parsed as Record<string, unknown>;
    return {
      learn: {
        ...DEFAULT_CLIENT_PREFERENCES.learn,
        autoQueen: legacy.autoQueen === true,
        moveConfirmation: legacy.moveConfirmation === true,
        showLegalMoves: legacy.showLegalMoves !== false,
        moveMethod: toMoveMethod(legacy.moveMethod),
        boardOrientation: toBoardOrientation(legacy.boardOrientation),
        engineDepth: clampNumber(asNumber(legacy.engineDepth), 10, 24, DEFAULT_CLIENT_PREFERENCES.learn.engineDepth),
        showOpeningNames: legacy.showOpeningNames !== false,
        masterVolume: clampNumber(asNumber(legacy.masterVolume), 0, 100, DEFAULT_CLIENT_PREFERENCES.learn.masterVolume),
      },
      bot: {
        ...DEFAULT_CLIENT_PREFERENCES.bot,
        autoQueen: legacy.autoQueen === true,
        moveConfirmation: legacy.moveConfirmation === true,
        showLegalMoves: legacy.showLegalMoves !== false,
        moveMethod: toMoveMethod(legacy.moveMethod),
        boardOrientation: toBoardOrientation(legacy.boardOrientation),
        lowTimeWarning: legacy.lowTimeWarning !== false,
        boardLock: legacy.boardLock === true,
        masterVolume: clampNumber(asNumber(legacy.masterVolume), 0, 100, DEFAULT_CLIENT_PREFERENCES.bot.masterVolume),
      },
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

function asNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function toMoveMethod(value: unknown): MoveMethod {
  if (value === "drag" || value === "click" || value === "both") {
    return value;
  }
  return DEFAULT_CLIENT_PREFERENCES.learn.moveMethod;
}

function toBoardOrientation(value: unknown): BoardOrientation {
  if (value === "auto" || value === "white" || value === "black") {
    return value;
  }
  return DEFAULT_CLIENT_PREFERENCES.learn.boardOrientation;
}

function isScopedPreferences(value: Partial<ClientPreferences> & Record<string, unknown>): value is ClientPreferences {
  return typeof value.learn === "object" && value.learn !== null && typeof value.bot === "object" && value.bot !== null;
}
