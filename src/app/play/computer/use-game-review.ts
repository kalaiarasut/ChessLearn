"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import type { StockfishEngineVariant } from "../../learn/[opening]/use-stockfish-analysis";

export type MoveReviewCategory =
  | "book"
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export type ReviewedMove = {
  plyIndex: number;
  moveNumber: number;
  mover: "w" | "b";
  from: Square;
  to: Square;
  uci: string;
  san: string;
  bestMoveSan: string | null;
  bestMoveUci: string | null;
  category: MoveReviewCategory;
  lossCp: number | null;
  beforeScoreCp: number | null;
  afterScoreCp: number | null;
  isCheck: boolean;
  isCapture: boolean;
  isSacrifice: boolean;
};

type EvaluationSnapshot = {
  scoreCp: number | null;
  mate: number | null;
  bestMoveUci: string | null;
  bestMoveSan: string | null;
  numericScore: number;
};

type GameReviewState = {
  status: "idle" | "loading" | "analyzing" | "ready" | "error";
  progressPercent: number;
  currentPly: number;
  totalPlies: number;
  reviews: Record<number, ReviewedMove>;
  error: string | null;
};

const DEFAULT_STATE: GameReviewState = {
  status: "idle",
  progressPercent: 0,
  currentPly: 0,
  totalPlies: 0,
  reviews: {},
  error: null,
};

const MATERIAL_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
} as const;

const UCI_MOVE_PATTERN = /^[a-h][1-8][a-h][1-8][nbrq]?$/;

const normalizeForWhite = (fen: string, cp: number | null, mate: number | null) => {
  const turn = fen.split(" ")[1];

  return {
    cp: cp === null ? null : turn === "w" ? cp : -cp,
    mate: mate === null ? null : turn === "w" ? mate : -mate,
  };
};

const uciToSan = (fen: string, uciMove: string) => {
  if (!uciMove || !UCI_MOVE_PATTERN.test(uciMove)) {
    return null;
  }

  try {
    const game = new Chess(fen);
    const move = game.move({
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4),
      promotion: uciMove[4],
    });

    return move?.san ?? null;
  } catch {
    return null;
  }
};

const sanitizeSan = (san: string | null) => san?.replace(/[+#?!]+/g, "") ?? null;

const scoreToNumeric = (cp: number | null, mate: number | null) => {
  if (mate !== null) {
    return mate > 0 ? 100000 - Math.abs(mate) * 1000 : -100000 + Math.abs(mate) * 1000;
  }

  return cp ?? 0;
};

const getSideMaterial = (fen: string, side: "w" | "b") => {
  try {
    const game = new Chess(fen);
    let total = 0;

    for (const row of game.board()) {
      for (const piece of row) {
        if (!piece || piece.color !== side) {
          continue;
        }
        total += MATERIAL_VALUES[piece.type];
      }
    }

    return total;
  } catch {
    return 0;
  }
};

const classifyMove = ({
  mover,
  isBest,
  lossCp,
  numericBefore,
  numericAfter,
  isSacrifice,
  isCheck,
}: {
  mover: "w" | "b";
  isBest: boolean;
  lossCp: number | null;
  numericBefore: number;
  numericAfter: number;
  isSacrifice: boolean;
  isCheck: boolean;
}): MoveReviewCategory => {
  const improvement = mover === "w" ? numericAfter - numericBefore : numericBefore - numericAfter;

  if (isBest) {
    if ((isSacrifice && improvement >= 90) || improvement >= 220) {
      return "brilliant";
    }
    if (improvement >= 80 || (isCheck && improvement >= 35)) {
      return "great";
    }
    return "best";
  }

  if (lossCp === null) {
    return "good";
  }
  if (lossCp <= 25) {
    return "excellent";
  }
  if (lossCp <= 60) {
    return "good";
  }
  if (lossCp <= 130) {
    return "inaccuracy";
  }
  if (lossCp <= 260) {
    return "mistake";
  }
  return "blunder";
};

const buildReviews = (history: string[], sanHistory: string[], evaluations: EvaluationSnapshot[]) => {
  const nextReviews: Record<number, ReviewedMove> = {};

  for (let index = 0; index < sanHistory.length; index += 1) {
    const beforeFen = history[index];
    const afterFen = history[index + 1];
    const beforeEvaluation = evaluations[index];
    const afterEvaluation = evaluations[index + 1];

    if (!beforeFen || !afterFen || !beforeEvaluation || !afterEvaluation) {
      continue;
    }

    try {
      const game = new Chess(beforeFen);
      const move = game.move(sanHistory[index]);
      if (!move) {
        continue;
      }

      const mover = beforeFen.split(" ")[1] === "b" ? "b" : "w";
      const scoreLossRaw =
        mover === "w"
          ? beforeEvaluation.numericScore - afterEvaluation.numericScore
          : afterEvaluation.numericScore - beforeEvaluation.numericScore;
      const lossCp = Math.max(0, Math.round(scoreLossRaw));
      const isBest = sanitizeSan(move.san) === sanitizeSan(beforeEvaluation.bestMoveSan);
      const materialBefore = getSideMaterial(beforeFen, mover);
      const materialAfter = getSideMaterial(afterFen, mover);
      const isSacrifice = materialAfter < materialBefore;
      const category = classifyMove({
        mover,
        isBest,
        lossCp,
        numericBefore: beforeEvaluation.numericScore,
        numericAfter: afterEvaluation.numericScore,
        isSacrifice,
        isCheck: move.san.includes("+") || move.san.includes("#"),
      });

      nextReviews[index + 1] = {
        plyIndex: index + 1,
        moveNumber: Math.floor(index / 2) + 1,
        mover,
        from: move.from,
        to: move.to,
        uci: `${move.from}${move.to}${move.promotion ?? ""}`,
        san: move.san,
        bestMoveSan: beforeEvaluation.bestMoveSan,
        bestMoveUci: beforeEvaluation.bestMoveUci,
        category,
        lossCp,
        beforeScoreCp: beforeEvaluation.scoreCp,
        afterScoreCp: afterEvaluation.scoreCp,
        isCheck: move.san.includes("+") || move.san.includes("#"),
        isCapture: move.isCapture(),
        isSacrifice,
      };
    } catch {
      continue;
    }
  }

  return nextReviews;
};

export function useGameReview(
  history: string[],
  sanHistory: string[],
  enabled: boolean,
  engineVariant: StockfishEngineVariant,
  threads: number,
  timePerPositionMs: number,
) {
  const [state, setState] = useState<GameReviewState>(DEFAULT_STATE);
  const workerRef = useRef<Worker | null>(null);
  const shouldRunReview = enabled && sanHistory.length > 0 && history.length >= 2 && typeof Worker !== "undefined";

  const workerScript = useMemo(() => {
    if (engineVariant === "stockfish-18") {
      return "/engines/stockfish/stockfish-18-single.js";
    }
    return "/engines/stockfish/stockfish-18-lite-single.js";
  }, [engineVariant]);

  useEffect(() => {
    if (!shouldRunReview) {
      return;
    }

    let disposed = false;
    let worker: Worker;

    try {
      worker = new Worker(workerScript);
    } catch (error) {
      queueMicrotask(() => {
        setState({
          status: "error",
          progressPercent: 0,
          currentPly: 0,
          totalPlies: sanHistory.length,
          reviews: {},
          error: error instanceof Error ? error.message : "Unable to create game review worker.",
        });
      });
      return;
    }

    workerRef.current = worker;

    const positions = history.slice(0, sanHistory.length + 1);
    const evaluations = new Array<EvaluationSnapshot>(positions.length);
    let activeIndex = 0;
    let currentSnapshot: EvaluationSnapshot = {
      scoreCp: null,
      mate: null,
      bestMoveUci: null,
      bestMoveSan: null,
      numericScore: 0,
    };

    const analyzePosition = (index: number) => {
      if (disposed) {
        return;
      }

      activeIndex = index;
      currentSnapshot = {
        scoreCp: null,
        mate: null,
        bestMoveUci: null,
        bestMoveSan: null,
        numericScore: 0,
      };

      setState((current) => ({
        ...current,
        status: "analyzing",
        progressPercent: Math.round((index / Math.max(1, sanHistory.length)) * 100),
        currentPly: Math.min(index + 1, sanHistory.length),
        totalPlies: sanHistory.length,
        error: null,
      }));

      worker.postMessage("stop");
      worker.postMessage(`setoption name Threads value ${Math.max(1, threads)}`);
      worker.postMessage("setoption name MultiPV value 1");
      worker.postMessage(`position fen ${positions[index]}`);
      worker.postMessage(`go movetime ${Math.max(120, timePerPositionMs)}`);
    };

    const handleMessage = (event: MessageEvent<string>) => {
      const message = String(event.data).trim();
      if (!message) {
        return;
      }

      if (message === "uciok") {
        worker.postMessage(`setoption name Threads value ${Math.max(1, threads)}`);
        worker.postMessage("setoption name MultiPV value 1");
        worker.postMessage("isready");
        return;
      }

      if (message === "readyok") {
        analyzePosition(0);
        return;
      }

      if (message.startsWith("info") && message.includes(" pv ")) {
        const fen = positions[activeIndex];
        const cpMatch = message.match(/\bscore cp (-?\d+)/);
        const mateMatch = message.match(/\bscore mate (-?\d+)/);
        const pvMatch = message.match(/\bpv ([a-h][1-8][a-h][1-8][nbrq]?(?:\s+[a-h][1-8][a-h][1-8][nbrq]?)*)/);

        if (!fen || !pvMatch) {
          return;
        }

        const rawCp = cpMatch ? Number(cpMatch[1]) : null;
        const rawMate = mateMatch ? Number(mateMatch[1]) : null;
        const normalized = normalizeForWhite(fen, rawCp, rawMate);
        const bestMoveUci = pvMatch[1].split(/\s+/)[0] ?? null;
        const bestMoveSan = bestMoveUci ? uciToSan(fen, bestMoveUci) : null;

        currentSnapshot = {
          scoreCp: normalized.cp,
          mate: normalized.mate,
          bestMoveUci,
          bestMoveSan,
          numericScore: scoreToNumeric(normalized.cp, normalized.mate),
        };
        return;
      }

      if (!message.startsWith("bestmove")) {
        return;
      }

      const fen = positions[activeIndex];
      const bestMoveMatch = message.match(/^bestmove\s+([a-h][1-8][a-h][1-8][nbrq]?)/);
      if (fen && !currentSnapshot.bestMoveUci && bestMoveMatch) {
        currentSnapshot = {
          ...currentSnapshot,
          bestMoveUci: bestMoveMatch[1],
          bestMoveSan: uciToSan(fen, bestMoveMatch[1]),
        };
      }

      evaluations[activeIndex] = currentSnapshot;

      if (activeIndex >= positions.length - 1) {
        const reviews = buildReviews(positions, sanHistory, evaluations);
        setState({
          status: "ready",
          progressPercent: 100,
          currentPly: sanHistory.length,
          totalPlies: sanHistory.length,
          reviews,
          error: null,
        });
        return;
      }

      analyzePosition(activeIndex + 1);
    };

    const handleError = (event: ErrorEvent) => {
      setState({
        status: "error",
        progressPercent: 0,
        currentPly: 0,
        totalPlies: sanHistory.length,
        reviews: {},
        error: event.message || "Game review engine worker failed.",
      });
    };

    queueMicrotask(() => {
      if (disposed) {
        return;
      }
      setState({
        status: "loading",
        progressPercent: 0,
        currentPly: 0,
        totalPlies: sanHistory.length,
        reviews: {},
        error: null,
      });
    });

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage("uci");

    return () => {
      disposed = true;
      worker.postMessage("quit");
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      workerRef.current = null;
      worker.terminate();
    };
  }, [engineVariant, history, sanHistory, shouldRunReview, threads, timePerPositionMs, workerScript]);

  if (!enabled) {
    return DEFAULT_STATE;
  }

  return shouldRunReview
    ? state
    : {
        ...DEFAULT_STATE,
        status: sanHistory.length > 0 ? "loading" : "idle",
        totalPlies: sanHistory.length,
      };
}
