"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";

export type EngineLine = {
  id: number;
  move: string;
  scoreText: string;
  scoreCp: number | null;
  mate: number | null;
  pv: string[];
};

export type StockfishEngineVariant = "stockfish-18" | "stockfish-18-lite";

type AnalysisState = {
  ready: boolean;
  analyzing: boolean;
  depth: number;
  evaluationText: string;
  whiteWinChance: number;
  lines: EngineLine[];
  error: string | null;
};

const DEFAULT_STATE: AnalysisState = {
  ready: false,
  analyzing: true,
  depth: 0,
  evaluationText: "...",
  whiteWinChance: 50,
  lines: [],
  error: null,
};

const scoreToWinChance = (cp: number | null, mate: number | null) => {
  if (mate !== null) {
    return mate > 0 ? 100 : 0;
  }

  if (cp === null) {
    return 50;
  }

  const normalized = 1 / (1 + Math.exp(-cp / 220));
  return Math.max(3, Math.min(97, normalized * 100));
};

const formatScore = (cp: number | null, mate: number | null) => {
  if (mate !== null) {
    return `#${Math.abs(mate)}`;
  }

  if (cp === null) {
    return "0.0";
  }

  const pawns = cp / 100;
  return pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
};

const normalizeForWhite = (fen: string, cp: number | null, mate: number | null) => {
  const turn = fen.split(" ")[1];

  return {
    cp: cp === null ? null : turn === "w" ? cp : -cp,
    mate: mate === null ? null : turn === "w" ? mate : -mate,
  };
};

const uciToSan = (fen: string, uciMove: string) => {
  if (!uciMove || uciMove.length < 4) {
    return uciMove;
  }

  try {
    const game = new Chess(fen);
    const move = game.move({
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4),
      promotion: uciMove[4],
    });

    return move?.san ?? uciMove;
  } catch {
    return uciMove;
  }
};

export function useStockfishAnalysis(
  fen: string,
  enabled = true,
  depth = 13,
  multiPv = 3,
  threads = 1,
  engineVariant: StockfishEngineVariant = "stockfish-18-lite",
  maxTimeSeconds?: number,
) {
  const [state, setState] = useState<AnalysisState>(DEFAULT_STATE);
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const fenRef = useRef(fen);
  const linesRef = useRef<Map<number, EngineLine>>(new Map());

  const workerScript = useMemo(
    () => {
      if (engineVariant === "stockfish-18") {
        return "/engines/stockfish/stockfish-18-single.js";
      }

      return "/engines/stockfish/stockfish-18-lite-single.js";
    },
    [engineVariant],
  );

  useEffect(() => {
    fenRef.current = fen;
  }, [fen]);

  useEffect(() => {
    if (!enabled || typeof Worker === "undefined") {
      return;
    }

    let worker: Worker;
    try {
      worker = new Worker(workerScript);
    } catch (error) {
      setState((current) => ({
        ...current,
        ready: false,
        analyzing: false,
        error: error instanceof Error ? error.message : "Unable to create analysis worker.",
      }));
      return;
    }

    workerRef.current = worker;

    const handleMessage = (event: MessageEvent<string>) => {
      const message = String(event.data).trim();

      if (message === "uciok") {
        worker.postMessage(`setoption name Threads value ${Math.max(1, threads)}`);
        worker.postMessage(`setoption name MultiPV value ${multiPv}`);
        worker.postMessage("isready");
        return;
      }

      if (message === "readyok") {
        readyRef.current = true;
        setState((current) => ({ ...current, ready: true, error: null }));
        return;
      }

      if (message.startsWith("bestmove")) {
        setState((current) => ({ ...current, analyzing: false }));
        return;
      }

      if (!message.startsWith("info") || !message.includes(" pv ")) {
        return;
      }

      const currentFen = fenRef.current;
      const multiPvMatch = message.match(/\bmultipv (\d+)/);
      const depthMatch = message.match(/\bdepth (\d+)/);
      const cpMatch = message.match(/\bscore cp (-?\d+)/);
      const mateMatch = message.match(/\bscore mate (-?\d+)/);
      const pvMatch = message.match(/\bpv ([a-h][1-8][a-h][1-8][nbrq]?(?:\s+[a-h][1-8][a-h][1-8][nbrq]?){0,})/);

      if (!multiPvMatch || !pvMatch) {
        return;
      }

      const id = Number(multiPvMatch[1]);
      const rawCp = cpMatch ? Number(cpMatch[1]) : null;
      const rawMate = mateMatch ? Number(mateMatch[1]) : null;
      const normalized = normalizeForWhite(currentFen, rawCp, rawMate);
      const pv = pvMatch[1].split(/\s+/).filter(Boolean);
      const move = uciToSan(currentFen, pv[0] ?? "");
      const line: EngineLine = {
        id,
        move,
        scoreText: formatScore(normalized.cp, normalized.mate),
        scoreCp: normalized.cp,
        mate: normalized.mate,
        pv,
      };

      linesRef.current.set(id, line);
      const sortedLines = [...linesRef.current.values()].sort((a, b) => a.id - b.id);
      const topLine = sortedLines[0] ?? null;

      setState((current) => ({
        ...current,
        analyzing: true,
        depth: depthMatch ? Number(depthMatch[1]) : current.depth,
        evaluationText: topLine?.scoreText ?? current.evaluationText,
        whiteWinChance: topLine
          ? scoreToWinChance(topLine.scoreCp, topLine.mate)
          : current.whiteWinChance,
        lines: sortedLines,
      }));
    };

    const handleError = (event: ErrorEvent) => {
      setState((current) => ({
        ...current,
        ready: false,
        analyzing: false,
        error: event.message || "Engine worker failed to load.",
      }));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage("uci");

    return () => {
      readyRef.current = false;
      linesRef.current.clear();
      worker.postMessage("quit");
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      workerRef.current = null;
      worker.terminate();
    };
  }, [enabled, multiPv, threads, workerScript]);

  useEffect(() => {
    if (!enabled || !readyRef.current || !workerRef.current) {
      return;
    }

    const worker = workerRef.current;
    linesRef.current = new Map();

    const timeoutId = window.setTimeout(() => {
      setState((current) => ({
        ...current,
        analyzing: true,
        depth: 0,
        evaluationText: "...",
        lines: [],
        error: null,
      }));
      worker.postMessage("stop");
      worker.postMessage(`setoption name Threads value ${Math.max(1, threads)}`);
      worker.postMessage(`setoption name MultiPV value ${multiPv}`);
      worker.postMessage(`position fen ${fen}`);

      if (typeof maxTimeSeconds === "number") {
        if (maxTimeSeconds > 0) {
          worker.postMessage(`go movetime ${Math.round(maxTimeSeconds * 1000)}`);
        } else {
          worker.postMessage("go infinite");
        }
      } else {
        worker.postMessage(`go depth ${depth}`);
      }
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      worker.postMessage("stop");
    };
  }, [depth, enabled, fen, maxTimeSeconds, multiPv, threads]);

  return state;
}
