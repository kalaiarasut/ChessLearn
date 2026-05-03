"use client";

import { Chess, type Square } from "chess.js";

export type HikaruStyleTable = {
  total: number;
  counts: Record<string, number>;
};

export type HikaruStyleModel = {
  method: string;
  trainTargets: number;
  weights: Record<string, number>;
  tables: Record<string, HikaruStyleTable>;
};

export type EngineMoveCandidate = {
  move: string;
  multipv: number;
  scoreCp?: number;
  mate?: number;
};

const PIECE_NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const MODEL_PATH = "/hikaru_style_prior.json";

const DEFAULT_WEIGHTS: Record<string, number> = {
  piece: 0.25,
  piece_by_phase: 0.75,
  piece_by_phase_time: 1,
  to_square: 0.2,
  to_square_by_piece: 0.45,
  to_square_by_phase: 0.45,
  to_square_by_phase_piece: 1,
  flag: 0.2,
  flag_by_phase: 0.6,
  from_to_by_phase: 0.35,
  from_to_by_phase_piece: 0.55,
  uci_by_phase_time: 0.55,
};

const materialCount = (game: Chess) => game
  .board()
  .flat()
  .filter((piece) => piece && piece.type !== "k").length;

const phaseForFen = (fen: string) => {
  const parts = fen.split(/\s+/);
  const turn = parts[1] === "b" ? "b" : "w";
  const fullmove = Number.parseInt(parts[5] ?? "1", 10);
  const safeFullmove = Number.isFinite(fullmove) ? Math.max(1, fullmove) : 1;
  const plyIndex = (safeFullmove - 1) * 2 + (turn === "b" ? 1 : 0);

  if (plyIndex < 20) {
    return "opening";
  }

  const game = new Chess(fen);
  return materialCount(game) <= 12 ? "endgame" : "middlegame";
};

const tableName = (base: string, phase: string, timeClass: string, piece: string) => {
  if (base === "piece_by_phase") return `${base}:${phase}`;
  if (base === "piece_by_phase_time") return `${base}:${phase}|${timeClass}`;
  if (base === "to_square_by_piece") return `${base}:${piece}`;
  if (base === "to_square_by_phase") return `${base}:${phase}`;
  if (base === "to_square_by_phase_piece") return `${base}:${phase}|${piece}`;
  if (base === "flag_by_phase") return `${base}:${phase}`;
  if (base === "from_to_by_phase") return `${base}:${phase}`;
  if (base === "from_to_by_phase_piece") return `${base}:${phase}|${piece}`;
  if (base === "uci_by_phase_time") return `${base}:${phase}|${timeClass}`;
  return base;
};

const parseUciMove = (uci: string) => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, 4),
  promotion: uci.length > 4 ? uci[4] : undefined,
});

const moveFlag = (fen: string, uci: string) => {
  const game = new Chess(fen);
  const parsed = parseUciMove(uci);
  const verboseMove = game
    .moves({ verbose: true })
    .find((move) => (
      move.from === parsed.from &&
      move.to === parsed.to &&
      (!parsed.promotion || move.promotion === parsed.promotion)
    ));

  if (!verboseMove) {
    return "quiet";
  }

  const isCastle = verboseMove.isKingsideCastle() || verboseMove.isQueensideCastle();
  const isCapture = verboseMove.isCapture();
  const isPromotion = verboseMove.isPromotion();
  game.move({
    from: parsed.from,
    to: parsed.to,
    promotion: parsed.promotion,
  });
  const givesCheck = game.inCheck();

  if (isCastle) return "castle";
  if (isPromotion) return "promotion";
  if (isCapture && givesCheck) return "capture_check";
  if (givesCheck) return "check";
  if (isCapture) return "capture";
  return "quiet";
};

const moveFeatures = (fen: string, uci: string, phase: string, timeClass: string) => {
  const game = new Chess(fen);
  const piece = game.get(uci.slice(0, 2) as Square);
  const pieceName = piece ? PIECE_NAMES[piece.type] ?? "unknown" : "unknown";
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const flag = moveFlag(fen, uci);

  return {
    phase,
    timeClass,
    piece: pieceName,
    values: {
      piece: pieceName,
      piece_by_phase: pieceName,
      piece_by_phase_time: pieceName,
      to_square: to,
      to_square_by_piece: to,
      to_square_by_phase: to,
      to_square_by_phase_piece: to,
      flag,
      flag_by_phase: flag,
      from_to_by_phase: `${from}${to}`,
      from_to_by_phase_piece: `${from}${to}`,
      uci_by_phase_time: uci,
    },
  };
};

const featureLogProb = (table: HikaruStyleTable, value: string) => {
  const count = table.counts[value] ?? 0;
  const vocab = Math.max(8, Object.keys(table.counts).length);
  const alpha = 0.5;
  return Math.log((count + alpha) / (table.total + alpha * vocab));
};

const scoreStyleMove = (
  model: HikaruStyleModel,
  fen: string,
  uci: string,
  timeClass: string,
) => {
  const phase = phaseForFen(fen);
  const features = moveFeatures(fen, uci, phase, timeClass);
  let score = 0;

  for (const [base, value] of Object.entries(features.values)) {
    const name = tableName(base, phase, timeClass, features.piece);
    const table = model.tables[name];
    if (!table) {
      continue;
    }
    score += (model.weights[base] ?? DEFAULT_WEIGHTS[base] ?? 0) * featureLogProb(table, value);
  }

  return score;
};

const normalizeModel = (raw: unknown): HikaruStyleModel => {
  const payload = raw as {
    method?: string;
    train_targets?: number;
    trainTargets?: number;
    weights?: Record<string, number>;
    tables?: Record<string, HikaruStyleTable>;
  };

  return {
    method: payload.method ?? "hikaru_lightweight_style_prior",
    trainTargets: payload.train_targets ?? payload.trainTargets ?? 0,
    weights: payload.weights ?? DEFAULT_WEIGHTS,
    tables: payload.tables ?? {},
  };
};

export const loadHikaruStyleModel = async () => {
  const response = await fetch(MODEL_PATH);
  if (!response.ok) {
    throw new Error(`Failed to load Hikaru style model: ${response.status}`);
  }

  return normalizeModel(await response.json());
};

export const chooseHikaruStyleMove = (
  fen: string,
  candidates: EngineMoveCandidate[],
  model: HikaruStyleModel | null,
  timeClass = "blitz",
) => {
  if (!model || candidates.length === 0) {
    return null;
  }

  const game = new Chess(fen);
  const legalMoves = new Set(game.moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ""}`));
  const legalCandidates = candidates.filter((candidate) => legalMoves.has(candidate.move));
  if (legalCandidates.length === 0) {
    return null;
  }

  const scored = legalCandidates.map((candidate) => {
    const styleScore = scoreStyleMove(model, fen, candidate.move, timeClass);
    const engineOrderPenalty = Math.log(Math.max(1, candidate.multipv));
    const engineScore = typeof candidate.scoreCp === "number" ? Math.max(-1.5, Math.min(1.5, candidate.scoreCp / 250)) : 0;
    const mateScore = typeof candidate.mate === "number" ? (candidate.mate > 0 ? 2 : -2) : 0;

    return {
      ...candidate,
      styleScore,
      combinedScore: styleScore + engineScore + mateScore - engineOrderPenalty,
    };
  });

  scored.sort((a, b) => b.combinedScore - a.combinedScore || a.multipv - b.multipv || a.move.localeCompare(b.move));
  return scored[0]?.move ?? null;
};
