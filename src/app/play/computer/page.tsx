"use client";

import type { DragEvent, MouseEvent } from "react";
import Link from "next/link";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowLeft, Settings, Play, Pause, Bot, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp, MoreHorizontal, Monitor, User, Gamepad2, MessageSquare, GraduationCap, Bell, CreditCard, Accessibility, LayoutGrid, Users, Sun, Moon, Crosshair, Crown, Info, LoaderCircle, CheckCircle2, AlertCircle } from "lucide-react";
import themeManifest from "@/data/themeManifest.json";
import { useTheme } from "@/lib/theme-context";
import { STOCKFISH_ELO_LIMITS, useStockfishPlayer, type PlayerEngineVariant, type PlayerStrengthMode, type PlayerTimeMode } from "./use-stockfish-player";
import { useStockfishAnalysis } from "../../learn/[opening]/use-stockfish-analysis";
import { useStockfishEngineDownload } from "./use-stockfish-engine-download";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEFAULT_CLIENT_PREFERENCES, loadClientPreferences, saveClientPreferences } from "@/lib/client-preferences";
import { SettingsModalLayout, BoardPiecesSettingsTab } from "@/components/settings-layout";
import { Confetti, type ConfettiRef } from "@/registry/magicui/confetti";

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
const BOT_ENGINE_VARIANT_STORAGE_KEY = "chessify.bot.engineVariant.v1";
const ANALYSIS_ENGINE_VARIANT_STORAGE_KEY = "chessify.bot.analysisEngineVariant.v1";
const REPLAY_ARCHIVE_STORAGE_KEY = "chessify.bot.replayArchive.v1";
const REPLAY_ARCHIVE_MAX_ITEMS = 60;
const REPLAY_ARCHIVE_PAGE_SIZE = 6;
const BEGINNER_ESTIMATED_ELOS = [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300];
const BEGINNER_ELO_MIN = BEGINNER_ESTIMATED_ELOS[0];
const BEGINNER_ELO_MAX = BEGINNER_ESTIMATED_ELOS[BEGINNER_ESTIMATED_ELOS.length - 1];
const BOT_OPENING_ENGINE_ID = "engine";
const BOT_OPENINGS_LIMIT = 1000;
const SAN_RESULT_TOKENS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);
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

type NavigatorConnection = {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
};

type NavigatorWithConnection = Navigator & {
  connection?: NavigatorConnection;
  deviceMemory?: number;
};

type OpeningCardPayload = {
  slug: string;
  name: string;
  eco: string;
  moves: string;
  variationCount: number;
};

type BotOpeningChoice = {
  id: string;
  label: string;
  pgn: string;
  searchText: string;
  bookMovesBySide: Record<SideColor, string[]>;
};

const BOT_OPENING_ENGINE_CHOICE: BotOpeningChoice = {
  id: BOT_OPENING_ENGINE_ID,
  label: "Engine Choice",
  pgn: "",
  searchText: "engine choice",
  bookMovesBySide: { w: [], b: [] },
};

const UCI_MOVE_PATTERN = /^[a-h][1-8][a-h][1-8][nbrq]?$/;

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toSearchTokens = (query: string) =>
  normalizeSearchText(query)
    .split(" ")
    .filter(Boolean);

const parseUciMove = (uci: string) => {
  if (!UCI_MOVE_PATTERN.test(uci)) {
    return null;
  }

  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: (uci[4] as "q" | "r" | "b" | "n" | undefined) ?? undefined,
  };
};

const toOpeningChoice = (opening: OpeningCardPayload): BotOpeningChoice => {
  const ecoLabel = opening.eco?.trim() ? opening.eco.trim() : "N/A";
  const label = `${opening.name} (${ecoLabel})`;
  return {
    id: opening.slug,
    label,
    pgn: opening.moves,
    searchText: normalizeSearchText(`${opening.name} ${ecoLabel} ${opening.moves}`),
    bookMovesBySide: buildOpeningBookBySide(opening.moves),
  };
};

const tokenizePgnMoves = (pgn: string) =>
  pgn
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/;[^\n\r]*/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\d+\.(\.\.\.)?/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !SAN_RESULT_TOKENS.has(token));

const buildOpeningBookBySide = (pgn: string): Record<SideColor, string[]> => {
  const game = new Chess();
  const bookMovesBySide: Record<SideColor, string[]> = { w: [], b: [] };

  for (const token of tokenizePgnMoves(pgn)) {
    let move: ReturnType<Chess["move"]> | null = null;
    try {
      move = game.move(token);
    } catch {
      break;
    }

    if (!move) {
      break;
    }

    bookMovesBySide[move.color].push(`${move.from}${move.to}${move.promotion ?? ""}`);
  }

  return bookMovesBySide;
};

const resolveLegalBookMove = (game: Chess, uci: string) => {
  const parsedMove = parseUciMove(uci);
  if (!parsedMove) {
    return null;
  }

  const legalMoves = game.moves({ verbose: true });
  const isLegal = legalMoves.some((move) => {
    if (move.from !== parsedMove.from || move.to !== parsedMove.to) {
      return false;
    }

    if (!parsedMove.promotion) {
      return true;
    }

    return move.promotion === parsedMove.promotion;
  });

  return isLegal ? parsedMove : null;
};

const filterOpeningChoices = (
  choices: BotOpeningChoice[],
  query: string,
  selectedId: string,
  maxItems = 120,
) => {
  const tokens = toSearchTokens(query);
  const filtered = tokens.length === 0
    ? [...choices]
    : choices.filter((choice) => tokens.every((token) => choice.searchText.includes(token)));

  const selected = choices.find((choice) => choice.id === selectedId);
  const visible = filtered.slice(0, maxItems);

  if (selected && !visible.some((choice) => choice.id === selected.id)) {
    return [selected, ...visible.slice(0, Math.max(0, maxItems - 1))];
  }

  return visible;
};

const toBeginnerEngineProfile = (estimatedElo: number) => {
  const clamped = Math.max(BEGINNER_ELO_MIN, Math.min(BEGINNER_ELO_MAX, Math.round(estimatedElo)));
  const span = BEGINNER_ELO_MAX - BEGINNER_ELO_MIN;
  const ratio = span > 0 ? (clamped - BEGINNER_ELO_MIN) / span : 0;

  return {
    skillLevel: Math.max(0, Math.min(7, Math.round(ratio * 7))),
    fixedMoveTimeMs: Math.max(50, Math.min(250, Math.round(50 + ratio * 200))),
  };
};

const isEngineVariant = (value: unknown): value is EngineVariant =>
  value === "stockfish-18" || value === "stockfish-18-lite";

const getRecommendedBotEngineVariant = (fullEngineAvailable: boolean): EngineVariant => {
  if (!fullEngineAvailable || typeof window === "undefined") {
    return "stockfish-18-lite";
  }

  const navigatorWithConnection = window.navigator as NavigatorWithConnection;
  const connection = navigatorWithConnection.connection;
  const effectiveType = connection?.effectiveType?.toLowerCase() ?? "";
  const downlink = typeof connection?.downlink === "number" ? connection.downlink : 0;
  const saveData = connection?.saveData === true;
  const deviceMemory = typeof navigatorWithConnection.deviceMemory === "number" ? navigatorWithConnection.deviceMemory : 0;
  const hardwareConcurrency = typeof window.navigator.hardwareConcurrency === "number" ? window.navigator.hardwareConcurrency : 0;

  if (saveData || effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g") {
    return "stockfish-18-lite";
  }

  if (effectiveType === "4g" && downlink >= 10 && deviceMemory >= 8 && hardwareConcurrency >= 8) {
    return "stockfish-18";
  }

  return "stockfish-18-lite";
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

type QueuedPremove = {
  from: Square;
  to: Square;
  promotion?: "q" | "r" | "b" | "n";
};

type ReplayOutcome = "win" | "loss" | "draw";
type ReplayFilter = "all" | ReplayOutcome;

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

const createReplaySessionId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getReplayResultTone = (outcome: ReplayOutcome) => {
  if (outcome === "win") {
    return {
      badgeClassName: "bg-emerald-500/20 border-emerald-500/30 text-emerald-400",
      dotClassName: "border-emerald-500",
      iconClassName: "text-emerald-500",
    };
  }
  if (outcome === "loss") {
    return {
      badgeClassName: "bg-rose-500/20 border-rose-500/30 text-rose-400",
      dotClassName: "border-rose-500",
      iconClassName: "text-rose-500",
    };
  }
  return {
    badgeClassName: "bg-amber-500/20 border-amber-500/30 text-amber-400",
    dotClassName: "border-amber-500",
    iconClassName: "text-amber-500",
  };
};

const formatReplayDateLabel = (isoDate: string) => {
  const created = new Date(isoDate);
  if (Number.isNaN(created.getTime())) {
    return "Unknown";
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfCreated = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfCreated.getTime()) / 86400000);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return created.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: created.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
};

const getReplayWinnerDetails = (game: Chess, timeoutStatus: string | null) => {
  if (timeoutStatus) {
    const lowered = timeoutStatus.toLowerCase();
    if ((lowered.includes("white") && lowered.includes("won")) || (lowered.includes("white") && lowered.includes("wins"))) {
      return { winner: "w" as const, reason: timeoutStatus };
    }
    if ((lowered.includes("black") && lowered.includes("won")) || (lowered.includes("black") && lowered.includes("wins"))) {
      return { winner: "b" as const, reason: timeoutStatus };
    }
    return { winner: "draw" as const, reason: timeoutStatus };
  }

  if (game.isCheckmate()) {
    return {
      winner: game.turn() === "w" ? ("b" as const) : ("w" as const),
      reason: "Checkmate",
    };
  }
  if (game.isStalemate()) {
    return { winner: "draw" as const, reason: "Draw by stalemate" };
  }
  if (game.isThreefoldRepetition()) {
    return { winner: "draw" as const, reason: "Draw by repetition" };
  }
  if (game.isInsufficientMaterial()) {
    return { winner: "draw" as const, reason: "Draw by insufficient material" };
  }
  if (game.isDraw()) {
    return { winner: "draw" as const, reason: "Draw" };
  }

  return { winner: "draw" as const, reason: "Game ended" };
};

const getGameOverHeadline = (
  game: Chess,
  timeoutStatus: string | null,
  playerColor: "w" | "b" | "bot-vs-bot",
) => {
  const winnerDetails = getReplayWinnerDetails(game, timeoutStatus);

  if (playerColor === "bot-vs-bot") {
    if (winnerDetails.winner === "w") return "White Won";
    if (winnerDetails.winner === "b") return "Black Won";
    return "Draw";
  }

  if (winnerDetails.winner === "draw") {
    return "Draw";
  }

  return winnerDetails.winner === playerColor ? "Victory" : "Defeat";
};

const getGameOverReasonLabel = (game: Chess, timeoutStatus: string | null) => {
  if (timeoutStatus) {
    return timeoutStatus.split(". ")[1] || timeoutStatus;
  }
  if (game.isCheckmate()) return "by Checkmate";
  if (game.isStalemate()) return "by Stalemate";
  if (game.isThreefoldRepetition()) return "by Repetition";
  if (game.isInsufficientMaterial()) return "by Insufficient Material";
  if (game.isDraw()) return "by 50-move rule or agreement";
  return "";
};

const safeParseReplayArchive = (serializedArchive: string | null): ReplayArchiveEntry[] => {
  if (!serializedArchive) {
    return [];
  }

  try {
    const parsed = JSON.parse(serializedArchive) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized: ReplayArchiveEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const entry = item as Partial<ReplayArchiveEntry>;
      if (
        typeof entry.id !== "string" ||
        typeof entry.createdAt !== "string" ||
        typeof entry.finalFen !== "string" ||
        !Array.isArray(entry.fenHistory) ||
        !Array.isArray(entry.sanMoves)
      ) {
        continue;
      }

      try {
        new Chess(entry.finalFen);
      } catch {
        continue;
      }

      normalized.push({
        id: entry.id,
        createdAt: entry.createdAt,
        finalFen: entry.finalFen,
        fenHistory: entry.fenHistory.filter((fenValue): fenValue is string => typeof fenValue === "string"),
        sanMoves: entry.sanMoves.filter((move): move is string => typeof move === "string"),
        moveCount: typeof entry.moveCount === "number" ? entry.moveCount : 0,
        timeControlMinutes: typeof entry.timeControlMinutes === "number" ? entry.timeControlMinutes : 10,
        playerSide:
          entry.playerSide === "w" || entry.playerSide === "b" || entry.playerSide === "bot-vs-bot"
            ? entry.playerSide
            : "w",
        opponentLabel: typeof entry.opponentLabel === "string" ? entry.opponentLabel : "Stockfish",
        outcome: entry.outcome === "win" || entry.outcome === "loss" || entry.outcome === "draw" ? entry.outcome : "draw",
        outcomeLabel: typeof entry.outcomeLabel === "string" ? entry.outcomeLabel : "Draw",
        title: typeof entry.title === "string" ? entry.title : "Game",
        reason: typeof entry.reason === "string" ? entry.reason : "Game ended",
        resultTag: entry.resultTag === "1-0" || entry.resultTag === "0-1" || entry.resultTag === "1/2-1/2" ? entry.resultTag : "1/2-1/2",
        whiteLabel: typeof entry.whiteLabel === "string" ? entry.whiteLabel : "White",
        blackLabel: typeof entry.blackLabel === "string" ? entry.blackLabel : "Black",
      });
    }

    return normalized.slice(0, REPLAY_ARCHIVE_MAX_ITEMS);
  } catch {
    return [];
  }
};

const buildReplayPgn = (entry: ReplayArchiveEntry) => {
  const date = new Date(entry.createdAt);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const dateTag = Number.isNaN(date.getTime()) ? "????.??.??" : `${year}.${month}.${day}`;
  const timeControlTag = `${Math.max(0, Math.round(entry.timeControlMinutes * 60))}`;

  const moveText = entry.sanMoves
    .map((sanMove, index) => {
      if (index % 2 === 0) {
        return `${Math.floor(index / 2) + 1}. ${sanMove}`;
      }
      return sanMove;
    })
    .join(" ")
    .trim();

  return [
    `[Event "Chessify Replay"]`,
    `[Site "Chessify"]`,
    `[Date "${dateTag}"]`,
    `[White "${entry.whiteLabel}"]`,
    `[Black "${entry.blackLabel}"]`,
    `[Result "${entry.resultTag}"]`,
    `[TimeControl "${timeControlTag}"]`,
    `[Termination "${entry.reason.replace(/\"/g, "'")}"]`,
    "",
    `${moveText} ${entry.resultTag}`.trim(),
  ].join("\n");
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
    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-[min(260px,90vw)] px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-hover)] text-[var(--text-primary)] text-[12px] font-normal normal-case tracking-normal rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-center pointer-events-none before:content-[''] before:absolute before:bottom-full before:left-1/2 before:-translate-x-1/2 before:border-[5px] before:border-transparent before:border-b-[var(--border-hover)]">
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
  const [analysisEngineVariant, setAnalysisEngineVariant] = useState<EngineVariant>("stockfish-18-lite");
  const [analysisMaxTimeSeconds, setAnalysisMaxTimeSeconds] = useState(0);
  const [analysisMultiPv, setAnalysisMultiPv] = useState(3);
  const [analysisDepth, setAnalysisDepth] = useState(15);
  const [analysisThreads, setAnalysisThreads] = useState(1);
  const [fullEngineAvailable, setFullEngineAvailable] = useState(true);
  const [fullEngineAvailabilityChecked, setFullEngineAvailabilityChecked] = useState(false);
  const [engineVariantsResolved, setEngineVariantsResolved] = useState(false);
  const [expandedEngineLineIds, setExpandedEngineLineIds] = useState<Record<number, boolean>>({});
  const [bot1EloIndex, setBot1EloIndex] = useState<number>(2);
  const [bot2EloIndex, setBot2EloIndex] = useState<number>(2);
  const [botOpeningChoices, setBotOpeningChoices] = useState<BotOpeningChoice[]>([BOT_OPENING_ENGINE_CHOICE]);
  const [botOpeningsLoading, setBotOpeningsLoading] = useState(false);
  const [botOpeningsError, setBotOpeningsError] = useState<string | null>(null);
  const [bot1OpeningQuery, setBot1OpeningQuery] = useState("");
  const [bot2OpeningQuery, setBot2OpeningQuery] = useState("");
  const [bot1OpeningId, setBot1OpeningId] = useState<string>(BOT_OPENING_ENGINE_ID);
  const [bot2OpeningId, setBot2OpeningId] = useState<string>(BOT_OPENING_ENGINE_ID);
  const [bot1OpeningMoveIndex, setBot1OpeningMoveIndex] = useState(0);
  const [bot2OpeningMoveIndex, setBot2OpeningMoveIndex] = useState(0);
  const [botMatchConfigOpen, setBotMatchConfigOpen] = useState(false);
  const [viewerName, setViewerName] = useState("Guest User");
  const [hoverPreview, setHoverPreview] = useState<{ fen: string; left: number; top: number } | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [draggedSquare, setDraggedSquare] = useState<Square | null>(null);
  const [dragOverSquare, setDragOverSquare] = useState<Square | null>(null);
  const [queuedPremoves, setQueuedPremoves] = useState<QueuedPremove[]>([]);
  const [lastMove, setLastMove] = useState<SerializableMove | null>(null);
  const [whiteTimeSeconds, setWhiteTimeSeconds] = useState(10 * 60);
  const [blackTimeSeconds, setBlackTimeSeconds] = useState(10 * 60);
  const [timeoutStatus, setTimeoutStatus] = useState<string | null>(null);
  const [warnedWhiteLowTime, setWarnedWhiteLowTime] = useState(false);
  const [warnedBlackLowTime, setWarnedBlackLowTime] = useState(false);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [replayArchive, setReplayArchive] = useState<ReplayArchiveEntry[]>([]);
  const [replayFilter, setReplayFilter] = useState<ReplayFilter>("all");
  const [visibleReplayCount, setVisibleReplayCount] = useState(REPLAY_ARCHIVE_PAGE_SIZE);
  const [isBoardViewInverted, setIsBoardViewInverted] = useState(false);
  const [showGameOverOverlay, setShowGameOverOverlay] = useState(false);
  const [showGameOverOverview, setShowGameOverOverview] = useState(false);
  const [showGameOverActions, setShowGameOverActions] = useState(false);
  const [rightClickHighlights, setRightClickHighlights] = useState<Set<Square>>(new Set());
  const [rightClickArrows, setRightClickArrows] = useState<{ start: Square; end: Square }[]>([]);
  const [rightClickStartSquare, setRightClickStartSquare] = useState<Square | null>(null);
  const archivedGameIdsRef = useRef<Set<string>>(new Set());

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
      })
      .finally(() => {
        setFullEngineAvailabilityChecked(true);
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

  useEffect(() => {
    if (!fullEngineAvailabilityChecked || typeof window === "undefined") {
      return;
    }

    const storedBotVariant = window.localStorage.getItem(BOT_ENGINE_VARIANT_STORAGE_KEY);
    const storedAnalysisVariant = window.localStorage.getItem(ANALYSIS_ENGINE_VARIANT_STORAGE_KEY);

    const resolvedBotVariant =
      isEngineVariant(storedBotVariant) && (storedBotVariant !== "stockfish-18" || fullEngineAvailable)
        ? storedBotVariant
        : getRecommendedBotEngineVariant(fullEngineAvailable);
    const resolvedAnalysisVariant =
      isEngineVariant(storedAnalysisVariant) && (storedAnalysisVariant !== "stockfish-18" || fullEngineAvailable)
        ? storedAnalysisVariant
        : "stockfish-18-lite";

    setBotEngineVariant(resolvedBotVariant);
    setAnalysisEngineVariant(resolvedAnalysisVariant);
    window.localStorage.setItem(BOT_ENGINE_VARIANT_STORAGE_KEY, resolvedBotVariant);
    window.localStorage.setItem(ANALYSIS_ENGINE_VARIANT_STORAGE_KEY, resolvedAnalysisVariant);
    setEngineVariantsResolved(true);
  }, [fullEngineAvailabilityChecked, fullEngineAvailable]);

  const gameRef = useRef(new Chess(fen));
  const confettiRef = useRef<ConfettiRef>(null);
  const audioPoolRef = useRef<Record<string, HTMLAudioElement[]>>({});
  const nextAudioIndexRef = useRef<Record<string, number>>({});
  const previousGameStateRef = useRef(gameState);
  const isReviewing = currentMoveIndex !== history.length - 1;
  const isBotMatchMode = playerColor === "bot-vs-bot";
  const playerSide: SideColor = isBotMatchMode ? "w" : playerColor;
  const botSide: SideColor = playerSide === "w" ? "b" : "w";
  const botOpeningChoiceById = useMemo(() => {
    const map = new Map<string, BotOpeningChoice>();
    for (const choice of botOpeningChoices) {
      map.set(choice.id, choice);
    }
    return map;
  }, [botOpeningChoices]);
  const bot1Elo = ELOS[Math.min(Math.max(bot1EloIndex, 0), ELOS.length - 1)] ?? ELOS[0];
  const bot2Elo = ELOS[Math.min(Math.max(bot2EloIndex, 0), ELOS.length - 1)] ?? ELOS[0];
  const bot1OpeningBookMoves = useMemo(() => {
    const selected = botOpeningChoiceById.get(bot1OpeningId);
    if (!selected) {
      return [];
    }

    return selected.bookMovesBySide[botSide] ?? [];
  }, [botOpeningChoiceById, bot1OpeningId, botSide]);
  const bot2OpeningBookMoves = useMemo(() => {
    const selected = botOpeningChoiceById.get(bot2OpeningId);
    if (!selected) {
      return [];
    }

    return selected.bookMovesBySide[playerSide] ?? [];
  }, [botOpeningChoiceById, bot2OpeningId, playerSide]);
  const bot1VisibleOpeningChoices = useMemo(
    () => filterOpeningChoices(botOpeningChoices, bot1OpeningQuery, bot1OpeningId),
    [botOpeningChoices, bot1OpeningQuery, bot1OpeningId],
  );
  const bot2VisibleOpeningChoices = useMemo(
    () => filterOpeningChoices(botOpeningChoices, bot2OpeningQuery, bot2OpeningId),
    [botOpeningChoices, bot2OpeningQuery, bot2OpeningId],
  );
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
  const botPreferences = clientPreferences.bot;
  const botStrengthSubtitle = strengthMode === "elo"
    ? `ELO ${elo}`
    : strengthMode === "beginner"
      ? `Est. Elo ${beginnerEstimatedElo}`
      : `Skill ${skillLevel}`;
  const baseIsBoardFlipped = botPreferences.boardOrientation === "white"
    ? false
    : botPreferences.boardOrientation === "black"
      ? true
      : botSide === "w";
  const isBoardFlipped = isBoardViewInverted ? !baseIsBoardFlipped : baseIsBoardFlipped;
  const analysisEnabled =
    gameState !== "setup" &&
    (showEvaluationBar || showEngineLines || showSuggestionArrow || showMoveFeedback);
  const { statuses: engineDownloadStatuses, ensureEngineReady } = useStockfishEngineDownload(fullEngineAvailable);

  const isBotTurn =
    gameState === "playing" &&
    !isReviewing &&
    (isBotMatchMode || gameRef.current.turn() === botSide) &&
    !gameRef.current.isGameOver();
  const canUsePremoves =
    !isBotMatchMode &&
    botPreferences.premoveEnabled &&
    gameState === "playing" &&
    !isReviewing &&
    !gameRef.current.isGameOver();
  const isPremoveTurn = canUsePremoves && gameRef.current.turn() !== playerSide;
  const analysisRequestMaxTimeSeconds = gameState === "playing" && isBotTurn
    ? analysisMaxTimeSeconds > 0
      ? Math.min(analysisMaxTimeSeconds, 0.35)
      : 0.2
    : analysisMaxTimeSeconds;
  const botEngineDownloadStatus = engineDownloadStatuses[botEngineVariant];
  const analysisEngineDownloadStatus = engineDownloadStatuses[analysisEngineVariant];
  const isBotEngineReady = engineVariantsResolved && botEngineDownloadStatus.ready;
  const isAnalysisEngineReady = engineVariantsResolved && analysisEngineDownloadStatus.ready;
  const liveWinnerDetails = getReplayWinnerDetails(gameRef.current, timeoutStatus);
  const gameOverHeadline = getGameOverHeadline(gameRef.current, timeoutStatus, playerColor);
  const gameOverReasonLabel = getGameOverReasonLabel(gameRef.current, timeoutStatus);
  const shouldCelebrateWin = playerColor !== "bot-vs-bot" && liveWinnerDetails.winner === playerColor;
  const shouldShowBoardOverlay = showGameOverOverlay && gameState === "game_over";

  useEffect(() => {
    if (!engineVariantsResolved) {
      return;
    }

    ensureEngineReady(botEngineVariant).catch(() => {});
  }, [botEngineVariant, engineVariantsResolved, ensureEngineReady]);

  useEffect(() => {
    const previousGameState = previousGameStateRef.current;
    previousGameStateRef.current = gameState;

    if (previousGameState !== "playing" || gameState !== "game_over") {
      if (gameState !== "game_over") {
        setShowGameOverOverlay(false);
        setShowGameOverOverview(false);
        setShowGameOverActions(false);
      }
      return;
    }

    setShowGameOverOverlay(true);
    setShowGameOverOverview(false);
    setShowGameOverActions(false);

    const overviewTimer = window.setTimeout(() => {
      setShowGameOverOverview(true);
    }, 180);
    const actionsTimer = window.setTimeout(() => {
      setShowGameOverActions(true);
    }, 760);
    const dismissTimer = window.setTimeout(() => {
      setShowGameOverOverlay(false);
    }, 2800);

    let confettiTimer: number | null = null;
    if (shouldCelebrateWin) {
      confettiTimer = window.setTimeout(() => {
        confettiRef.current?.fire({});
      }, 240);
    }

    return () => {
      window.clearTimeout(overviewTimer);
      window.clearTimeout(actionsTimer);
      window.clearTimeout(dismissTimer);
      if (confettiTimer !== null) {
        window.clearTimeout(confettiTimer);
      }
    };
  }, [gameState, shouldCelebrateWin]);

  useEffect(() => {
    if (!engineVariantsResolved || !analysisEnabled) {
      return;
    }

    ensureEngineReady(analysisEngineVariant).catch(() => {});
  }, [analysisEnabled, analysisEngineVariant, engineVariantsResolved, ensureEngineReady]);

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
    isBotEngineReady,
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
  }, [bestMove]);

  const analysis = useStockfishAnalysis(
    fen,
    analysisEnabled && isAnalysisEngineReady,
    analysisDepth,
    analysisMultiPv,
    analysisThreads,
    analysisEngineVariant,
    analysisRequestMaxTimeSeconds,
  );
  const analysisModelLabel = analysisEngineVariant === "stockfish-18" ? "Stockfish-18" : "Stockfish-18-Lite";
  const engineStatusBadge = useMemo(() => {
    const prioritizedStatuses = [
      {
        variant: botEngineVariant,
        label: botEngineVariant === "stockfish-18" ? "Full" : "Lite",
        status: botEngineDownloadStatus,
      },
      ...(analysisEnabled
        ? [
            {
              variant: analysisEngineVariant,
              label: analysisEngineVariant === "stockfish-18" ? "Full" : "Lite",
              status: analysisEngineDownloadStatus,
            },
          ]
        : []),
    ];

    const downloading = prioritizedStatuses.find(({ status }) => status.isDownloading);
    if (downloading) {
      return {
        tone: "downloading" as const,
        text: `Downloading ${downloading.label}... ${downloading.status.progressPercent}%`,
      };
    }

    const ready = prioritizedStatuses.find(({ status }) => status.badgeState === "ready");
    if (ready) {
      return {
        tone: "ready" as const,
        text: `${ready.label} ready`,
      };
    }

    const error = prioritizedStatuses.find(({ status }) => status.badgeState === "error" && status.error);
    if (error) {
      return {
        tone: "error" as const,
        text: error.status.error ?? "Engine download failed",
      };
    }

    return null;
  }, [
    analysisEnabled,
    analysisEngineDownloadStatus,
    analysisEngineVariant,
    botEngineDownloadStatus,
    botEngineVariant,
  ]);

  const { toggleTheme, isDark } = useTheme();
  const updateBotPreferences = (updates: Partial<typeof botPreferences>) => {
    setClientPreferences((previous) => ({
      ...previous,
      bot: {
        ...previous.bot,
        ...updates,
      },
    }));
  };
  const shouldLockBoard = isBotMatchMode || (isBotTurn && botPreferences.boardLock);
  const clearQueuedPremoves = useCallback(() => {
    setQueuedPremoves([]);
  }, []);

  useEffect(() => {
    setClientPreferences(loadClientPreferences());
  }, []);

  useEffect(() => {
    if (!botPreferences.premoveEnabled && queuedPremoves.length > 0) {
      setQueuedPremoves([]);
    }
  }, [botPreferences.premoveEnabled, queuedPremoves.length]);

  useEffect(() => {
    if (!engineVariantsResolved || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(BOT_ENGINE_VARIANT_STORAGE_KEY, botEngineVariant);
  }, [botEngineVariant, engineVariantsResolved]);

  useEffect(() => {
    if (!engineVariantsResolved || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(ANALYSIS_ENGINE_VARIANT_STORAGE_KEY, analysisEngineVariant);
  }, [analysisEngineVariant, engineVariantsResolved]);

  useEffect(() => {
    const audioPool = audioPoolRef.current;

    return () => {
      Object.values(audioPool)
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

  useEffect(() => {
    let cancelled = false;

    const loadBotOpenings = async () => {
      setBotOpeningsLoading(true);
      setBotOpeningsError(null);

      try {
        const response = await fetch(`/api/openings?limit=${BOT_OPENINGS_LIMIT}`, { method: "GET" });
        if (!response.ok) {
          throw new Error("Failed to load opening catalog.");
        }

        const payload = (await response.json()) as { openings?: OpeningCardPayload[] };
        const openings = Array.isArray(payload.openings) ? payload.openings : [];
        const mappedChoices = openings.map(toOpeningChoice);

        if (!cancelled) {
          setBotOpeningChoices([BOT_OPENING_ENGINE_CHOICE, ...mappedChoices]);
        }
      } catch {
        if (!cancelled) {
          setBotOpeningsError("Opening database unavailable. Using engine-only opening mode.");
          setBotOpeningChoices([BOT_OPENING_ENGINE_CHOICE]);
        }
      } finally {
        if (!cancelled) {
          setBotOpeningsLoading(false);
        }
      }
    };

    loadBotOpenings().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!botOpeningChoiceById.has(bot1OpeningId)) {
      setBot1OpeningId(BOT_OPENING_ENGINE_ID);
      setBot1OpeningMoveIndex(0);
    }

    if (!botOpeningChoiceById.has(bot2OpeningId)) {
      setBot2OpeningId(BOT_OPENING_ENGINE_ID);
      setBot2OpeningMoveIndex(0);
    }
  }, [botOpeningChoiceById, bot1OpeningId, bot2OpeningId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedArchive = window.localStorage.getItem(REPLAY_ARCHIVE_STORAGE_KEY);
    const parsedArchive = safeParseReplayArchive(storedArchive);
    setReplayArchive(parsedArchive);
    archivedGameIdsRef.current = new Set(parsedArchive.map((entry) => entry.id));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(REPLAY_ARCHIVE_STORAGE_KEY, JSON.stringify(replayArchive));
  }, [replayArchive]);

  useEffect(() => {
    setVisibleReplayCount(REPLAY_ARCHIVE_PAGE_SIZE);
  }, [replayFilter]);

  useEffect(() => {
    setIsBoardViewInverted(false);
  }, [botPreferences.boardOrientation, playerSide]);

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
  const queuePremove = useCallback((from: Square, to: Square) => {
    const piece = gameRef.current.get(from);
    if (!piece || piece.color !== playerSide || from === to) {
      playSound("illegal");
      setSelectedSquare(null);
      return false;
    }

    setQueuedPremoves((previous) => {
      const nextEntry: QueuedPremove = { from, to };
      return botPreferences.premoveMode === "multiple" ? [...previous, nextEntry] : [nextEntry];
    });
    setSelectedSquare(null);
    setDraggedSquare(null);
    setDragOverSquare(null);
    playSound("move-self");
    return true;
  }, [botPreferences.premoveMode, playSound, playerSide]);

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

  // Bot applies configured opening-book moves first, then falls back to engine search.
  useEffect(() => {
    if (gameState !== "playing" || !isBotTurn) {
      return;
    }

    const isBot1Turn = isBotMatchMode ? gameRef.current.turn() === botSide : true;
    const openingBookMoves = isBotMatchMode
      ? (isBot1Turn ? bot1OpeningBookMoves : bot2OpeningBookMoves)
      : bot1OpeningBookMoves;
    const openingMoveIndex = isBotMatchMode
      ? (isBot1Turn ? bot1OpeningMoveIndex : bot2OpeningMoveIndex)
      : bot1OpeningMoveIndex;
    const openingMove = openingBookMoves[openingMoveIndex];

    if (openingMove) {
      const legalBookMove = resolveLegalBookMove(gameRef.current, openingMove);

      if (legalBookMove && commitMove(legalBookMove.from, legalBookMove.to, legalBookMove.promotion)) {
        if (isBotMatchMode) {
          if (isBot1Turn) {
            setBot1OpeningMoveIndex((current) => current + 1);
          } else {
            setBot2OpeningMoveIndex((current) => current + 1);
          }
        } else {
          setBot1OpeningMoveIndex((current) => current + 1);
        }
        return;
      }

      if (isBotMatchMode) {
        if (isBot1Turn) {
          setBot1OpeningMoveIndex(openingBookMoves.length);
        } else {
          setBot2OpeningMoveIndex(openingBookMoves.length);
        }
      } else {
        setBot1OpeningMoveIndex(openingBookMoves.length);
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
    bot1OpeningBookMoves,
    bot2OpeningBookMoves,
    bot1OpeningMoveIndex,
    bot2OpeningMoveIndex,
    isBestMoveLegal,
  ]);

  const startGame = (color: "w" | "b" | "random" | "bot-vs-bot") => {
    const finalColor = color === "random" ? (Math.random() > 0.5 ? "w" : "b") : color;
    const seededGame = new Chess();
    const initialFen = seededGame.fen();

    setShowGameOverOverlay(false);
    setShowGameOverOverview(false);
    setShowGameOverActions(false);
    setActiveGameId(createReplaySessionId());
    setPlayerColor(finalColor);
    setFen(initialFen);
    setHistory([initialFen]);
    setSanHistory([]);
    setCurrentMoveIndex(0);
    setIsPlayingHistory(false);
    setHoverPreview(null);
    setLastMove(null);
    setTimeoutStatus(null);
    setWhiteTimeSeconds(timeLimit * 60);
    setBlackTimeSeconds(timeLimit * 60);
    setWarnedWhiteLowTime(false);
    setWarnedBlackLowTime(false);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setDragOverSquare(null);
    setQueuedPremoves([]);
    setRightClickHighlights(new Set());
    setRightClickArrows([]);
    gameRef.current = seededGame;
    setBot1OpeningMoveIndex(0);
    setBot2OpeningMoveIndex(0);
    setBotMatchConfigOpen(false);
    setGameState("playing");
    playSound("game-start");
  };

  const stopGame = () => {
    setShowGameOverOverlay(false);
    setShowGameOverOverview(false);
    setShowGameOverActions(false);
    setGameState("setup");
    setIsPlayingHistory(false);
    setTimeoutStatus(null);
    setQueuedPremoves([]);
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
      setRightClickHighlights(new Set());
      setRightClickArrows([]);

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

  useEffect(() => {
    if (!canUsePremoves || isPremoveTurn || queuedPremoves.length === 0) {
      return;
    }

    const nextPremove = queuedPremoves[0];
    const legalMove = gameRef.current
      .moves({ verbose: true })
      .find((move) => move.from === nextPremove.from && move.to === nextPremove.to);

    if (!legalMove) {
      clearQueuedPremoves();
      playSound("illegal");
      return;
    }

    const didMove = commitMove(nextPremove.from, nextPremove.to, nextPremove.promotion);
    if (!didMove) {
      clearQueuedPremoves();
      return;
    }

    setQueuedPremoves((previous) => previous.slice(1));
  }, [canUsePremoves, clearQueuedPremoves, commitMove, isPremoveTurn, playSound, queuedPremoves]);

  const setPositionFromHistory = (index: number) => {
    const bounded = Math.max(0, Math.min(index, history.length - 1));
    const fenAtIndex = history[bounded] ?? DEFAULT_FEN;
    setCurrentMoveIndex(bounded);
    setFen(fenAtIndex);
    gameRef.current = new Chess(fenAtIndex);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setDragOverSquare(null);
    setQueuedPremoves([]);
    setRightClickHighlights(new Set());
    setRightClickArrows([]);
  };

  const goToStart = () => {
    setIsPlayingHistory(false);
    setPositionFromHistory(0);
  };
  const goToPrev = () => setPositionFromHistory(currentMoveIndex - 1);
  const goToNext = () => setPositionFromHistory(currentMoveIndex + 1);
  const goToEnd = () => setPositionFromHistory(history.length - 1);
  const resetBoardReview = () => {
    setIsPlayingHistory(false);
    setPositionFromHistory(0);
  };
  const restartCurrentGame = () => startGame(playerColor);

  const handleSquareClick = (square: Square) => {
    if (botPreferences.moveMethod === "drag") return;
    if (gameState !== "playing" || isReviewing) return;

    const game = gameRef.current;
    const clickedPiece = game.get(square);
    const clickedPlayerPiece = clickedPiece?.color === playerSide;
    const legalTargets = selectedSquare ? game.moves({ square: selectedSquare, verbose: true }).map((m) => m.to) : [];

    if (isPremoveTurn) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      if (clickedPlayerPiece) {
        setSelectedSquare(square);
        return;
      }

      if (selectedSquare) {
        queuePremove(selectedSquare, square);
        return;
      }

      if (queuedPremoves.length > 0) {
        clearQueuedPremoves();
        playSound("move-self");
      } else {
        playSound("illegal");
      }
      setSelectedSquare(null);
      return;
    }

    if (shouldLockBoard) return;

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
    if (botPreferences.moveMethod === "click") {
      event.preventDefault();
      return;
    }
    if (gameState !== "playing" || isReviewing) {
      event.preventDefault();
      return;
    }

    const game = gameRef.current;
    const draggedPiece = game.get(square);

    const expectedColor = isPremoveTurn ? playerSide : game.turn();
    if (!draggedPiece || draggedPiece.color !== expectedColor) {
      event.preventDefault();
      return;
    }

    if (!isPremoveTurn && shouldLockBoard) {
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
    if (!draggedSquare || isReviewing || gameState !== "playing") return;

    if (isPremoveTurn) {
      queuePremove(draggedSquare, square);
      return;
    }

    if (shouldLockBoard) return;

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
  const legalTargets = selectedSquare && gameState === "playing" && !shouldLockBoard && !isPremoveTurn
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

  const topSuggestedMove = analysis.lines[0]?.pv[0] ?? null;
  const pieceThemePath = PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`;
  const materialSnapshot = getMaterialSnapshot(game);
  const topSideColor: SideColor = isBoardFlipped ? "w" : "b";
  const bottomSideColor: SideColor = isBoardFlipped ? "b" : "w";
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
  const botModelLabel = botEngineVariant === "stockfish-18" ? "Stockfish-18" : "Stockfish-18-Lite";
  const sidePanelsByColor: Record<SideColor, { name: string; subtitle: string | null; icon: "bot" | "user"; clockSeconds: number }> = {
    w: isBotMatchMode
      ? {
          name: "Bot 1",
          subtitle: `ELO ${bot1Elo}`,
          icon: "bot",
          clockSeconds: whiteTimeSeconds,
        }
      : playerSide === "w"
        ? {
            name: viewerName,
            subtitle: null,
            icon: "user",
            clockSeconds: whiteTimeSeconds,
          }
        : {
            name: botModelLabel,
            subtitle: botStrengthSubtitle,
            icon: "bot",
            clockSeconds: whiteTimeSeconds,
          },
    b: isBotMatchMode
      ? {
          name: "Bot 2",
          subtitle: `ELO ${bot2Elo}`,
          icon: "bot",
          clockSeconds: blackTimeSeconds,
        }
      : playerSide === "b"
        ? {
            name: viewerName,
            subtitle: null,
            icon: "user",
            clockSeconds: blackTimeSeconds,
          }
        : {
            name: botModelLabel,
            subtitle: botStrengthSubtitle,
            icon: "bot",
            clockSeconds: blackTimeSeconds,
          },
  };
  const topPanel = sidePanelsByColor[topSideColor];
  const bottomPanel = sidePanelsByColor[bottomSideColor];
  const whiteWinChance = Math.max(0, Math.min(100, analysis.whiteWinChance));
  const blackWinChance = 100 - whiteWinChance;
  const topEvalShare = topSideColor === "w" ? whiteWinChance : blackWinChance;
  const bottomEvalShare = topSideColor === "w" ? blackWinChance : whiteWinChance;
  const replayFilters: Array<{ value: ReplayFilter; label: string }> = [
    { value: "all", label: "All Games" },
    { value: "win", label: "Wins" },
    { value: "loss", label: "Losses" },
    { value: "draw", label: "Draws" },
  ];
  const filteredReplayArchive = useMemo(() => {
    if (replayFilter === "all") {
      return replayArchive;
    }
    return replayArchive.filter((entry) => entry.outcome === replayFilter);
  }, [replayArchive, replayFilter]);
  const visibleReplayArchive = filteredReplayArchive.slice(0, visibleReplayCount);
  const hasMoreReplayItems = visibleReplayCount < filteredReplayArchive.length;
  const isReplayView = gameState === "game_over" && activeGameId === null && history.length > 1;
  const handleResetAction = () => {
    if (isReplayView) {
      resetBoardReview();
      return;
    }

    restartCurrentGame();
  };

  useEffect(() => {
    if (gameState !== "game_over" || !activeGameId || archivedGameIdsRef.current.has(activeGameId)) {
      return;
    }
    if (sanHistory.length === 0 || history.length < 2) {
      return;
    }

    let endedGame: Chess;
    try {
      endedGame = new Chess(fen);
    } catch {
      return;
    }

    const winnerDetails = getReplayWinnerDetails(endedGame, timeoutStatus);
    const opponentLabel =
      playerColor === "bot-vs-bot"
        ? `Bot 1 (ELO ${bot1Elo}) vs Bot 2 (ELO ${bot2Elo})`
        : `${botModelLabel}${botStrengthSubtitle ? ` • ${botStrengthSubtitle}` : ""}`;

    let outcome: ReplayOutcome = "draw";
    let outcomeLabel = "Draw";
    let title = "Draw";

    if (winnerDetails.winner !== "draw") {
      if (playerColor === "bot-vs-bot") {
        outcome = "win";
        outcomeLabel = winnerDetails.winner === "w" ? "White Won" : "Black Won";
        title = outcomeLabel;
      } else {
        const playerWon = winnerDetails.winner === playerColor;
        outcome = playerWon ? "win" : "loss";
        outcomeLabel = playerWon ? "Victory" : "Defeat";
        title = playerWon ? "You Won" : "You Lost";
      }
    }

    const resultTag = winnerDetails.winner === "w" ? "1-0" : winnerDetails.winner === "b" ? "0-1" : "1/2-1/2";
    const playerLabel = viewerName.trim() || "Guest User";
    const botLabel = botModelLabel;
    const whiteLabel =
      playerColor === "bot-vs-bot"
        ? "Bot 1"
        : playerColor === "w"
          ? playerLabel
          : botLabel;
    const blackLabel =
      playerColor === "bot-vs-bot"
        ? "Bot 2"
        : playerColor === "b"
          ? playerLabel
          : botLabel;

    const replayEntry: ReplayArchiveEntry = {
      id: activeGameId,
      createdAt: new Date().toISOString(),
      finalFen: fen,
      fenHistory: [...history],
      sanMoves: [...sanHistory],
      moveCount: sanHistory.length,
      timeControlMinutes: timeLimit,
      playerSide: playerColor,
      opponentLabel,
      outcome,
      outcomeLabel,
      title,
      reason: winnerDetails.reason,
      resultTag,
      whiteLabel,
      blackLabel,
    };

    setReplayArchive((previous) => [replayEntry, ...previous.filter((entry) => entry.id !== replayEntry.id)].slice(0, REPLAY_ARCHIVE_MAX_ITEMS));
    archivedGameIdsRef.current.add(activeGameId);
  }, [
    gameState,
    activeGameId,
    fen,
    history,
    sanHistory,
    timeoutStatus,
    playerColor,
    botModelLabel,
    botStrengthSubtitle,
    bot1Elo,
    bot2Elo,
    timeLimit,
    viewerName,
  ]);

  const downloadReplayPgnDocument = (entries: ReplayArchiveEntry[], fileName: string) => {
    if (entries.length === 0) {
      return;
    }

    const pgnDocument = entries.map((entry) => buildReplayPgn(entry)).join("\n\n");
    const blob = new Blob([pgnDocument], { type: "text/plain;charset=utf-8" });
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectUrl);
  };

  const openReplayGame = (entry: ReplayArchiveEntry, autoPlayFromStart = true) => {
    if (!entry.fenHistory.length) {
      return;
    }

    const replayIndex = autoPlayFromStart ? 0 : entry.fenHistory.length - 1;
    const replayFen = entry.fenHistory[replayIndex] ?? entry.finalFen;

    setHistory(entry.fenHistory);
    setSanHistory(entry.sanMoves);
    setCurrentMoveIndex(replayIndex);
    setFen(replayFen);
    gameRef.current = new Chess(replayFen);
    setPlayerColor(entry.playerSide);
    setGameState("game_over");
    setIsPlayingHistory(autoPlayFromStart && entry.fenHistory.length > 1);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setDragOverSquare(null);
    setLastMove(null);
    setTimeoutStatus(entry.reason);
    setWhiteTimeSeconds(entry.timeControlMinutes * 60);
    setBlackTimeSeconds(entry.timeControlMinutes * 60);
    setActiveGameId(null);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const exportSingleReplayPgn = (entry: ReplayArchiveEntry) => {
    const dateStamp = entry.createdAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
    downloadReplayPgnDocument([entry], `chessify-replay-${dateStamp}-${entry.id.slice(0, 6)}.pgn`);
  };

  const exportReplayArchive = () => {
    if (replayArchive.length === 0) {
      return;
    }

    downloadReplayPgnDocument(replayArchive, `chessify-replays-${new Date().toISOString().slice(0, 10)}.pgn`);
  };

  const deleteReplayEntry = (entryId: string) => {
    setReplayArchive((previous) => previous.filter((entry) => entry.id !== entryId));
    archivedGameIdsRef.current.delete(entryId);
  };

  const clearReplayArchive = () => {
    if (!window.confirm("Clear all saved replay games? This cannot be undone.")) {
      return;
    }
    setReplayArchive([]);
    archivedGameIdsRef.current.clear();
  };

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
    <div className="min-h-screen flex flex-col overflow-x-hidden overflow-y-scroll bg-[var(--bg)]">
      <header className="w-full px-4 py-3 md:px-8 md:py-5 flex items-center justify-between border-b border-[var(--border)]">
        <Link href="/" className="text-[22px] font-serif font-[800] text-[var(--text-primary)]">
          CHESS
        </Link>
        <div className="flex items-center gap-3">
          {engineStatusBadge ? (
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium shadow-sm transition-colors ${
                engineStatusBadge.tone === "ready"
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : engineStatusBadge.tone === "error"
                    ? "border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-text)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-alt)] text-[var(--text-secondary)]"
              }`}
            >
              {engineStatusBadge.tone === "ready" ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : engineStatusBadge.tone === "error" ? (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <LoaderCircle className="w-3.5 h-3.5 shrink-0 animate-spin" />
              )}
              <span className="leading-none">{engineStatusBadge.text}</span>
            </div>
          ) : null}
          <Link
            href="/"
            className="inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[14px] font-medium group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" />
            Back to Play
          </Link>
        </div>
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
                      <InfoHint text="Pick one mode: Beginner (estimated 400-1300), Skill (0-20), or official Stockfish Elo-limited mode (1320-3190)." />
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
                          <InfoHint text={`Official Stockfish UCI_Elo mode. Supported range is ${ELO_MIN}-${ELO_MAX}; lower values are not available from the engine.`} />
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
                          <InfoHint text="For 400-1300 only, this uses a tuned Skill + fixed move time mapping. These values are estimates, not official Stockfish UCI_Elo." />
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="text-[12px] text-[var(--text-muted)] font-semibold block">
                          Bot 1 Opening Filter
                          <input
                            type="text"
                            value={bot1OpeningQuery}
                            onChange={(event) => setBot1OpeningQuery(event.target.value)}
                            placeholder="Type to filter openings"
                            className="mt-1 w-full bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-2 focus:outline-none focus:border-[var(--text-primary)]"
                          />
                          <select
                            value={bot1OpeningId}
                            onChange={(event) => {
                              setBot1OpeningId(event.target.value);
                              setBot1OpeningMoveIndex(0);
                            }}
                            className="mt-2 w-full bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-2 focus:outline-none focus:border-[var(--text-primary)]"
                          >
                            {bot1VisibleOpeningChoices.map((opening) => (
                              <option key={opening.id} value={opening.id}>{opening.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[12px] text-[var(--text-muted)] font-semibold block">
                          Bot 2 Opening Filter
                          <input
                            type="text"
                            value={bot2OpeningQuery}
                            onChange={(event) => setBot2OpeningQuery(event.target.value)}
                            placeholder="Type to filter openings"
                            className="mt-1 w-full bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-2 focus:outline-none focus:border-[var(--text-primary)]"
                          />
                          <select
                            value={bot2OpeningId}
                            onChange={(event) => {
                              setBot2OpeningId(event.target.value);
                              setBot2OpeningMoveIndex(0);
                            }}
                            className="mt-2 w-full bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-2 focus:outline-none focus:border-[var(--text-primary)]"
                          >
                            {bot2VisibleOpeningChoices.map((opening) => (
                              <option key={`bot2-${opening.id}`} value={opening.id}>{opening.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="text-[11px] text-[var(--text-muted)]">
                        {botOpeningsLoading
                          ? "Loading openings from the internal catalog..."
                          : botOpeningsError
                            ? botOpeningsError
                            : `${Math.max(0, botOpeningChoices.length - 1)} openings available from the internal catalog.`}
                      </div>

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
                            {analysisEnabled && analysisEngineDownloadStatus.isDownloading
                              ? `Downloading ${analysisEngineVariant === "stockfish-18" ? "Full" : "Lite"}... ${analysisEngineDownloadStatus.progressPercent}%`
                              : analysis.ready
                                ? "Analyzing current position..."
                                : "Starting engine..."}
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
                    onClick={handleResetAction}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-md font-semibold text-[13px] hover:bg-[var(--cta-hover)] transition-colors"
                  >
                    {isReplayView ? "Reset Replay" : "Reset Game"}
                  </button>
                </div>
              </>
            )}
            
          </div>
        </div>

        {/* Right Side: The Board */}
        <div className="w-full lg:w-[65%] flex-1 flex flex-row items-center lg:items-start justify-center lg:justify-end bg-[var(--bg-alt)] p-2 sm:p-4 lg:p-0 lg:pr-[70px] relative shadow-[-30px_0_50px_rgba(0,0,0,0.15)] border-l border-[var(--border)]">
          <div className="flex flex-col items-center justify-start h-[75vh] max-h-[720px] max-w-[100%] px-1 sm:px-0 sm:max-w-[95%] lg:max-w-[70%] lg:min-w-[500px] w-full relative shrink-0 lg:ml-auto lg:mr-8 lg:mt-4">
            
            <div className="w-full lg:w-auto flex justify-end lg:absolute lg:-top-2 lg:-right-[52px] flex-row lg:flex-col gap-2 sm:gap-3 z-50 mb-2 lg:mb-0 px-1 lg:px-0 items-center">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsBoardViewInverted((current) => !current)}
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
            {/* Top Side Panel */}
            {gameState !== "setup" && (
              <div className="w-full flex items-center justify-between mb-3 bg-[var(--surface)] px-2.5 py-1 rounded-xl border border-[var(--border)] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--skeleton)] border border-[var(--border)] flex items-center justify-center shrink-0">
                    {topPanel.icon === "bot" ? (
                      <Bot className="w-4 h-4 text-[var(--text-secondary)]" />
                    ) : (
                      <User className="w-4 h-4 text-[var(--text-secondary)]" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[12px] text-[var(--text-primary)] tracking-wide">{topPanel.name}</span>
                    {topPanel.subtitle ? <span className="text-[10px] text-[var(--text-muted)] font-medium">{topPanel.subtitle}</span> : null}
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
                    {formatClock(topPanel.clockSeconds)}
                  </div>
                </div>
              </div>
            )}
            
            <div className="w-full flex items-stretch gap-1 md:gap-3">
              {gameState !== "setup" && showEvaluationBar ? (
                <div className="w-[16px] md:w-[30px] shrink-0 bg-[#333333] rounded overflow-hidden flex flex-col relative shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                  <div
                    className={`w-full transition-[height] duration-300 relative ${topSideColor === "w" ? "bg-white" : "bg-[#202020]"}`}
                    style={{ height: `${topEvalShare}%` }}
                  >
                    {topSideColor === "b" ? <div className="absolute inset-0 bg-white/5 animate-pulse" /> : null}
                  </div>
                  <div
                    className={`w-full relative border-t border-[#666] transition-[height] duration-300 ${bottomSideColor === "w" ? "bg-white shadow-[0_-2px_10px_rgba(255,255,255,0.6)]" : "bg-[#202020]"}`}
                    style={{ height: `${bottomEvalShare}%` }}
                  >
                    {bottomSideColor === "b" ? <div className="absolute inset-0 bg-white/5 animate-pulse" /> : null}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-[2px]">
                    <span className="rounded bg-black/70 px-1 py-1 md:py-0.5 text-center text-[10px] md:text-[10px] font-[700] text-white shadow-sm [writing-mode:vertical-lr] md:[writing-mode:horizontal-tb] rotate-180 md:rotate-0 tracking-widest md:tracking-normal">
                      {analysis.evaluationText}
                    </span>
                  </div>
                </div>
              ) : null}

              <div
                className={`flex-1 aspect-square relative shadow-2xl ${!engineReady && gameState === "setup" ? "opacity-90 grayscale-[0.3]" : ""}`}
              >
              <BoardImage src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`} className="w-full h-full overflow-hidden rounded-sm">
                <Confetti ref={confettiRef} className="pointer-events-none absolute inset-0 z-[95] h-full w-full" />
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
                <div className="w-full h-full grid grid-cols-8 grid-rows-8 relative" onContextMenu={(e) => e.preventDefault()}>
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
                          if (!draggedSquare || isPremoveTurn) return;
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
                        className={`relative flex items-center justify-center ${gameState === "playing" && (!shouldLockBoard || isPremoveTurn) ? "cursor-pointer" : ""}`}
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
                        {isSelectedSquare && (
                          <div className="absolute inset-[6%] rounded-[4px] ring-[3px] ring-sky-300/90 bg-sky-400/10 z-[6]" />
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
                            (botPreferences.moveMethod === "drag" || !isPremoveTurn) &&
                            squarePiece &&
                            squarePiece.color === (isPremoveTurn ? playerSide : gameRef.current.turn()),
                          )}
                          onDragStart={(event) => handleDragStart(event, square)}
                          onDragEnd={() => setDraggedSquare(null)}
                          className={`relative z-10 h-full w-full p-[2.75%] ${isDraggedSquare ? "opacity-30" : "opacity-100"}`}
                        >
                          {getPieceIcon(piece, pieceTheme)}
                        </div>
                        {isQueuedPremoveFrom && botPreferences.premoveMode === "multiple" && (
                          <span className="absolute right-1 top-1 z-[7] flex h-5 w-5 items-center justify-center rounded-full bg-sky-300 text-[11px] font-black text-slate-900 shadow-md">
                            {queuedPremoveFromIndex + 1}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
                </div>
                  
                  {/* Game Over Overlay */}
                  {shouldShowBoardOverlay && (
                    <div className="pointer-events-none absolute inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-[3px] transition-opacity duration-500">
                      <div className="bg-[var(--surface)]/96 border border-[var(--border)] shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-6 md:p-8 rounded-2xl flex flex-col items-center max-w-[85%] w-[340px] text-center transition-all duration-700 relative overflow-hidden">
                        <div
                          className={`w-16 h-16 rounded-full bg-[var(--surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center mb-4 text-[#eab308] shadow-inner relative z-10 transition-all duration-700 ${
                            showGameOverOverview ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-90"
                          }`}
                        >
                          <Crown className="w-8 h-8 drop-shadow-md" strokeWidth={2.5} />
                        </div>
                        <h2
                          className={`text-2xl font-black text-[var(--text-primary)] tracking-wide mb-1 relative z-10 transition-all duration-700 ${
                            showGameOverOverview ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                          }`}
                        >
                          {gameOverHeadline}
                        </h2>
                        <p
                          className={`text-[14px] text-[var(--text-secondary)] font-medium mb-8 relative z-10 transition-all duration-700 ${
                            showGameOverOverview ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                          }`}
                        >
                          {gameOverReasonLabel}
                        </p>

                        <div
                          className={`flex flex-col gap-3 w-full relative z-10 transition-all duration-700 ${
                            showGameOverActions ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
                          }`}
                        >
                          <button
                            onClick={() => startGame(playerColor)}
                            className="pointer-events-auto w-full py-[14px] bg-[var(--cta-bg)] text-white font-bold rounded-xl hover:bg-[var(--cta-hover)] hover:scale-[1.02] shadow-[0_4px_14px_rgba(0,0,0,0.25)] transition-all duration-300 relative overflow-hidden group border border-white/10"
                          >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                              <RotateCcw className="w-[18px] h-[18px]" strokeWidth={2.5} />
                              Try Again
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:animate-[shimmer_1.5s_infinite]" />
                          </button>
                          <button
                            onClick={stopGame}
                            className="pointer-events-auto w-full flex items-center justify-center gap-2 py-[12px] text-[14.5px] text-[var(--text-secondary)] font-bold hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors border border-transparent hover:border-[var(--border)]"
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

            {/* Bottom Side Panel */}
            {gameState !== "setup" && (
              <div className="w-full flex items-center justify-between mt-3 bg-[var(--surface)] px-2.5 py-1 rounded-xl border border-[var(--border)] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-[#444] to-[#222] border border-[#555] flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                    {bottomPanel.icon === "bot" ? <Bot className="w-4 h-4 text-white/90" /> : <User className="w-4 h-4 text-white/90" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[12px] text-[var(--text-primary)] tracking-wide">{bottomPanel.name}</span>
                    {bottomPanel.subtitle ? <span className="text-[10px] text-[var(--text-muted)] font-medium">{bottomPanel.subtitle}</span> : null}
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
                    {formatClock(bottomPanel.clockSeconds)}
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

        {/* Settings Modal */}
        {isSettingsOpen && (
          <SettingsModalLayout
            open={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            activeTabId={activeCategory === "boards" || activeCategory === "pieces" ? "board" : activeCategory}
            onTabChange={(id) => {
              if (id === "board") {
                setActiveCategory("board");
                setActiveSettingsTab("boards");
              } else {
                setActiveCategory(id);
              }
            }}
            loading={preferencesLoading}
            error={preferencesError}
            tabs={[
              {
                id: "board",
                icon: <LayoutGrid className="w-[18px] h-[18px]" />,
                label: "Board & Pieces",
                title: "Board & Pieces",
                description: "Customize the look and feel of your chess set.",
                content: (
                  <BoardPiecesSettingsTab
                    activeSettingsTab={activeSettingsTab === "pieces" ? "pieces" : "boards"}
                    setActiveSettingsTab={setActiveSettingsTab}
                    boardTheme={boardTheme}
                    pieceTheme={pieceTheme}
                    boardThemes={AVAILABLE_BOARD_THEMES}
                    pieceThemes={AVAILABLE_PIECE_THEMES}
                    boardAssets={BOARD_THEME_ASSETS}
                    pieceAssets={PIECE_THEME_ASSETS}
                    soundEnabled={soundEnabled}
                    onBoardThemeChange={(theme) => setBoardTheme(theme)}
                    onPieceThemeChange={(theme) => setPieceTheme(theme)}
                    onSoundEnabledChange={setSoundEnabled}
                    onPreviewSound={() => playSound("move-self", true)}
                    boardPreviewNode={
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
                    }
                  />
                ),
              },
              {
                id: "gameplay",
                icon: <Gamepad2 className="w-[18px] h-[18px]" />,
                label: "Gameplay",
                title: "Gameplay",
                description: "Configure rules and preferences for your games.",
                content: (
                  <div className="flex-1 min-h-0 px-5 md:px-8 pb-5 md:pb-8 overflow-y-auto custom-scrollbar pt-2">
                    <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
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
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                        <span className="text-[14px] text-[var(--text-primary)]">Show Legal Moves</span>
                        <input type="checkbox" checked={botPreferences.showLegalMoves} onChange={(event) => updateBotPreferences({ showLegalMoves: event.target.checked })} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                        <span className="text-[14px] text-[var(--text-primary)]">Move Confirmation</span>
                        <input type="checkbox" checked={botPreferences.moveConfirmation} onChange={(event) => updateBotPreferences({ moveConfirmation: event.target.checked })} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                        <span className="text-[14px] text-[var(--text-primary)]">Enable Premove</span>
                        <input type="checkbox" checked={botPreferences.premoveEnabled} onChange={(event) => updateBotPreferences({ premoveEnabled: event.target.checked })} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                        <span className="text-[14px] text-[var(--text-primary)]">Premove Mode</span>
                        <select
                          value={botPreferences.premoveMode}
                          onChange={(event) => updateBotPreferences({ premoveMode: event.target.value as typeof botPreferences.premoveMode })}
                          className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] w-full md:w-auto md:min-w-[160px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]"
                        >
                          <option value="single">Single premove</option>
                          <option value="multiple">Multiple premoves</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                        <span className="text-[14px] text-[var(--text-primary)]">Auto Queen</span>
                        <input type="checkbox" checked={botPreferences.autoQueen} onChange={(event) => updateBotPreferences({ autoQueen: event.target.checked })} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                        <span className="text-[14px] text-[var(--text-primary)]">Lock Board On Bot Turn</span>
                        <input type="checkbox" checked={botPreferences.boardLock} onChange={(event) => updateBotPreferences({ boardLock: event.target.checked })} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                        <span className="text-[14px] text-[var(--text-primary)]">Low Time Warning</span>
                        <input type="checkbox" checked={botPreferences.lowTimeWarning} onChange={(event) => updateBotPreferences({ lowTimeWarning: event.target.checked })} />
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                id: "engine",
                icon: <Bot className="w-[18px] h-[18px]" />,
                label: "Engine",
                title: "Engine",
                description: "Configure Stockfish strength and analysis parameters.",
                content: (
                  <div className="flex-1 min-h-0 px-5 md:px-8 pb-5 md:pb-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar pt-2">
                    {/* GAME REVIEW Section */}
                    <div>
                      <h3 className="text-[11px] font-bold tracking-widest text-[var(--text-muted)] uppercase mb-3 px-1">Game Review</h3>
                      <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-2">Bot Engine <InfoHint text="Selected engine downloads automatically on first use and stays cached locally. Full is stronger but much heavier. Lite is faster and lighter." /></span>
                          <select
                            value={botEngineVariant}
                            onChange={(event) => setBotEngineVariant(event.target.value as EngineVariant)}
                            className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] min-w-[200px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]"
                          >
                            <option value="stockfish-18" disabled={!fullEngineAvailable}>Stockfish 18.1 NNUE (Full{fullEngineAvailable ? ", 108MB" : " unavailable on this deploy"})</option>
                            <option value="stockfish-18-lite">Stockfish 18 Lite (7MB)</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-2">Bot Strength Mode <InfoHint text="Choose one: Beginner (estimated 400-1300), Skill, or official Stockfish Elo-limited mode (1320-3190)." /></span>
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
                            <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-1.5 shrink-0">Beginner Elo <span className="opacity-70 text-[12px]">(Est.)</span> <InfoHint text="These 400-1300 presets are estimated by tuning Skill + fixed move time, not official Stockfish UCI_Elo." /></span>
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
                              className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] min-w-[200px]"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                            <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-2">Target Elo <InfoHint text={`Official Stockfish UCI_Elo setting. Valid range for both Stockfish 18 variants is ${ELO_MIN}-${ELO_MAX}.`} /></span>
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
                              className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] min-w-[200px]"
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
                            className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] w-full md:w-auto md:min-w-full md:w-[200px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTUgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]"
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
                          <span className="text-[14px] text-[var(--text-primary)] flex items-center gap-2">Chess Engine <InfoHint text="Analysis engine variant used for eval bar and lines. The selected engine downloads automatically on first use." /></span>
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
                            className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--border-hover)] min-w-[200px]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                id: "interface",
                icon: <Monitor className="w-[18px] h-[18px]" />,
                label: "Interface",
                title: "Interface",
                description: "Change platform language, sounds, and UI interactions.",
                content: (
                  <div className="flex-1 min-h-0 px-5 md:px-8 pb-5 md:pb-8 overflow-y-auto custom-scrollbar pt-2">
                    <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                        <span className="text-[14px] text-[var(--text-primary)]">Default Board Orientation</span>
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
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
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
                ),
              },
            ]}
            footer={
              <button 
                onClick={() => savePreferences().catch(() => {})}
                disabled={preferencesSaving || preferencesLoading}
                className="px-8 py-2.5 bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] text-[var(--cta-text)] font-bold rounded-lg transition-colors shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {preferencesSaving ? "Saving..." : "Save"}
              </button>
            }
          />
        )}

      </main>

      {/* Game Replay Section */}
      {gameState === "setup" ? (
        <section className="w-full bg-[var(--bg-alt)] border-t border-[var(--border)] py-16 px-6 lg:px-12 flex flex-col items-center justify-center shrink-0">
          <div className="max-w-6xl w-full flex flex-col gap-10">

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shadow-sm">
                <Monitor className="w-6 h-6 text-[var(--text-primary)]" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-[28px] font-serif font-medium text-[var(--text-primary)] tracking-tight leading-none">Game Replay Archive</h2>
                <span className="text-[15px] font-medium text-[var(--text-muted)]">
                  {replayArchive.length > 0
                    ? `${replayArchive.length} saved ${replayArchive.length === 1 ? "game" : "games"} ready for review`
                    : "Your completed games will appear here automatically"}
                </span>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="inline-flex items-center gap-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] p-1 shadow-sm">
                {replayFilters.map((filterOption) => (
                  <button
                    key={filterOption.value}
                    onClick={() => setReplayFilter(filterOption.value)}
                    className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-colors ${
                      replayFilter === filterOption.value
                        ? "bg-[var(--text-primary)] text-[var(--bg)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {filterOption.label}
                  </button>
                ))}
              </div>

              <button
                onClick={clearReplayArchive}
                disabled={replayArchive.length === 0}
                className="px-5 py-2.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-[14px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear Archive
              </button>

              <button
                onClick={exportReplayArchive}
                disabled={replayArchive.length === 0}
                className="px-5 py-2.5 bg-[var(--text-primary)] hover:bg-[var(--text-primary)]/90 text-[var(--bg)] border border-transparent rounded-xl text-[14px] font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export PGN
              </button>
            </div>
          </div>

          {visibleReplayArchive.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {visibleReplayArchive.map((replay) => {
                let replayBoard: Array<Array<string | null>>;
                try {
                  replayBoard = new Chess(replay.finalFen).board().map((row) => row.map((piece) => getPieceCode(piece)));
                } catch {
                  replayBoard = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
                }

                const replayTone = getReplayResultTone(replay.outcome);

                return (
                  <article
                    key={replay.id}
                    className="flex flex-col bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden hover:border-[var(--border-hover)] hover:shadow-xl transition-all duration-300 group shadow-sm cursor-pointer"
                    onClick={() => openReplayGame(replay, true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openReplayGame(replay, true);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="h-[220px] w-full relative overflow-hidden flex items-center justify-center">
                      <img
                        src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`}
                        alt="Replay board"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 z-[5]">
                        {replayBoard.map((row, rowIndex) =>
                          row.map((pieceCode, colIndex) => (
                            <div key={`${replay.id}-${rowIndex}-${colIndex}`} className="flex items-center justify-center p-[6%]">
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
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-10" />

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openReplayGame(replay, true);
                        }}
                        className="absolute z-20 w-14 h-14 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 text-white"
                        aria-label="Open replay"
                      >
                        <Play className="w-6 h-6 ml-1" fill="currentColor" />
                      </button>

                      <div className="absolute bottom-3 left-3 z-20 flex gap-2">
                        <span className="px-2 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded uppercase tracking-widest text-[9px] font-black text-white shadow-sm">
                          {replay.timeControlMinutes} Min
                        </span>
                        <span className={`px-2 py-1 backdrop-blur-md border rounded uppercase tracking-widest text-[9px] font-black shadow-sm ${replayTone.badgeClassName}`}>
                          {replay.outcomeLabel}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 flex flex-col gap-4 bg-[var(--surface)]">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[12px] font-bold text-[var(--text-muted)] tracking-wider uppercase">
                            {replay.opponentLabel}
                          </span>
                          <span className="text-[17px] font-bold text-[var(--text-primary)] leading-tight">
                            {replay.title} • {replay.moveCount} moves
                          </span>
                        </div>
                        <span className="text-[13px] text-[var(--text-secondary)] font-medium whitespace-nowrap">
                          {formatReplayDateLabel(replay.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-[14px] text-[var(--text-primary)] bg-[var(--bg)] px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)]">
                        <div className="flex items-center gap-2">
                          <Crosshair className={`w-4 h-4 ${replayTone.iconClassName}`} />
                          <span className="font-bold">{replay.reason}</span>
                        </div>
                        <div className="w-[1px] h-4 bg-[var(--border)]" />
                        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                          <span className={`w-2.5 h-2.5 rounded-full border-[2px] bg-transparent ${replayTone.dotClassName}`} />
                          <span className="font-medium text-[13px] truncate max-w-[120px]">
                            {replay.sanMoves.slice(-3).join(" ") || "No moves"}
                          </span>
                        </div>
                      </div>

                      <div className="w-full flex flex-col gap-3 pt-3 border-t border-[var(--border-subtle)]">
                        <div className="flex -space-x-2">
                          <div className="relative min-w-8 h-8 px-2 rounded-full bg-[#eee] border-2 border-[var(--surface)] flex items-center justify-center shadow-sm z-10">
                            <span className="text-[11px] font-black text-[#333]">{replay.whiteLabel.slice(0, 1).toUpperCase()}</span>
                          </div>
                          <div className="relative min-w-8 h-8 px-2 rounded-full bg-[#333] border-2 border-[var(--surface)] flex items-center justify-center shadow-sm z-0">
                            <span className="text-[11px] font-black text-[#eee]">{replay.blackLabel.slice(0, 1).toUpperCase()}</span>
                          </div>
                        </div>

                        <div className="w-full flex items-center justify-between gap-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              exportSingleReplayPgn(replay);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                          >
                            Export
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteReplayEntry(replay.id);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--error-text)] hover:bg-[var(--surface-hover)] transition-colors"
                          >
                            Delete
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              openReplayGame(replay, true);
                            }}
                            className="text-[14px] font-bold text-[var(--text-primary)] group-hover:text-[var(--cta-bg)] transition-colors flex items-center gap-1"
                          >
                            Watch Replay <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="w-full rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/70 px-6 py-16 flex flex-col items-center gap-3 text-center">
              <Bot className="w-8 h-8 text-[var(--text-muted)]" />
              <h3 className="text-[20px] font-semibold text-[var(--text-primary)]">No replay games yet</h3>
              <p className="text-[14px] text-[var(--text-secondary)] max-w-[560px]">
                Finish a game against the bot and it will be saved here automatically with move history, final board position, and PGN export support.
              </p>
            </div>
          )}

          {hasMoreReplayItems ? (
            <div className="w-full flex justify-center mt-2">
              <button
                onClick={() => setVisibleReplayCount((previous) => previous + REPLAY_ARCHIVE_PAGE_SIZE)}
                className="px-6 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)] text-[14px] font-bold text-[var(--text-primary)] shadow-sm transition-all flex items-center gap-2 group"
              >
                Load More <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
              </button>
            </div>
          ) : null}

          </div>
        </section>
      ) : null}
    </div>
  );
}
