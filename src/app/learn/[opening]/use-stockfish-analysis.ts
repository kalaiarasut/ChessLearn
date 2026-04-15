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

type AnalysisState = {
  ready: boolean;
  analyzing: boolean;
  depth: number;
  evaluationText: string;
  whiteWinChance: number;
  lines: EngineLine[];
};

const DEFAULT_STATE: AnalysisState = {
  ready: false,
  analyzing: true,
  depth: 0,
  evaluationText: "...",
  whiteWinChance: 50,
  lines: [],
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

  const game = new Chess(fen);
  const move = game.move({
    from: uciMove.slice(0, 2),
    to: uciMove.slice(2, 4),
    promotion: uciMove[4],
  });

  return move?.san ?? uciMove;
};

export function useStockfishAnalysis(fen: string, enabled = true, depth = 13, multiPv = 3) {
  const [state, setState] = useState<AnalysisState>(DEFAULT_STATE);
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const fenRef = useRef(fen);
  const linesRef = useRef<Map<number, EngineLine>>(new Map());

  const workerScript = useMemo(
    () =>
      `/engines/stockfish/stockfish-18-lite-single.js#${encodeURIComponent("/engines/stockfish/stockfish-18-lite-single.wasm")},worker`,
    [],
  );

  useEffect(() => {
    fenRef.current = fen;
  }, [fen]);

  useEffect(() => {
    if (!enabled || typeof Worker === "undefined") {
      return;
    }

    const worker = new Worker(workerScript);
    workerRef.current = worker;

    const handleMessage = (event: MessageEvent<string>) => {
      const message = String(event.data).trim();

      if (message === "uciok") {
        worker.postMessage(`setoption name MultiPV value ${multiPv}`);
        worker.postMessage("isready");
        return;
      }

      if (message === "readyok") {
        readyRef.current = true;
        setState((current) => ({ ...current, ready: true }));
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

    worker.addEventListener("message", handleMessage);
    worker.postMessage("uci");

    return () => {
      readyRef.current = false;
      linesRef.current.clear();
      worker.postMessage("quit");
      worker.removeEventListener("message", handleMessage);
      workerRef.current = null;
      worker.terminate();
    };
  }, [enabled, multiPv, workerScript]);

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
      }));
      worker.postMessage("stop");
      worker.postMessage(`setoption name MultiPV value ${multiPv}`);
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      worker.postMessage("stop");
    };
  }, [depth, enabled, fen, multiPv]);

  return state;
}
