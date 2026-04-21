"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type EngineState = {
  ready: boolean;
  isThinking: boolean;
  bestMove: string | null;
};

export type PlayerEngineVariant = "stockfish-18" | "stockfish-18-lite";
export type PlayerStrengthMode = "elo" | "skill";
export type PlayerTimeMode = "clock" | "fixed";

export const STOCKFISH_ELO_LIMITS: Record<PlayerEngineVariant, { min: number; max: number }> = {
  "stockfish-18": { min: 1320, max: 3190 },
  "stockfish-18-lite": { min: 1320, max: 3190 },
};

type PlayerEngineOptions = {
  elo: number;
  skillLevel: number;
  strengthMode: PlayerStrengthMode;
  whiteTimeSeconds: number;
  blackTimeSeconds: number;
  engineVariant: PlayerEngineVariant;
  timeMode: PlayerTimeMode;
  fixedMoveTimeMs: number;
};

export function useStockfishPlayer(fen: string, isBotTurn: boolean, options: PlayerEngineOptions) {
  const [state, setState] = useState<EngineState>({
    ready: false,
    isThinking: false,
    bestMove: null,
  });
  
  const workerRef = useRef<Worker | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const workerScript = useMemo(
    () => {
      if (options.engineVariant === "stockfish-18") {
        return "/engines/stockfish/stockfish-18-single.js";
      }

      return "/engines/stockfish/stockfish-18-lite-single.js";
    },
    [options.engineVariant],
  );

  useEffect(() => {
    if (typeof Worker === "undefined") return;

    const worker = new Worker(workerScript);
    workerRef.current = worker;

    const handleMessage = (event: MessageEvent<string>) => {
      const message = String(event.data).trim();

      if (message === "uciok") {
        worker.postMessage("isready");
        return;
      }

      if (message === "readyok") {
        setState((current) => ({ ...current, ready: true }));
        return;
      }

      if (message.startsWith("bestmove")) {
        const parts = message.split(" ");
        const bestMove = parts[1]; // e.g. "e2e4"
        setState((current) => ({ ...current, isThinking: false, bestMove }));
        return;
      }
    };

    worker.addEventListener("message", handleMessage);
    worker.postMessage("uci");

    return () => {
      worker.postMessage("quit");
      worker.removeEventListener("message", handleMessage);
      workerRef.current = null;
      worker.terminate();
    };
  }, [workerScript]);

  // Handle bot's turn
  useEffect(() => {
    if (!state.ready || !workerRef.current || !isBotTurn) {
      if (!isBotTurn) {
        // Reset best move when it's not bot turn
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState(s => ({ ...s, bestMove: null }));
      }
      return;
    }

    const worker = workerRef.current;
    
    // Slight delay to make it feel natural
    const timeoutId = window.setTimeout(() => {
      setState((current) => ({ ...current, isThinking: true, bestMove: null }));

      const {
        elo,
        skillLevel,
        strengthMode,
        whiteTimeSeconds,
        blackTimeSeconds,
        timeMode,
        fixedMoveTimeMs,
      } = optionsRef.current;

      if (strengthMode === "elo") {
        const eloLimits = STOCKFISH_ELO_LIMITS[optionsRef.current.engineVariant];
        const boundedElo = Math.max(eloLimits.min, Math.min(eloLimits.max, Math.round(elo)));
        worker.postMessage("setoption name UCI_LimitStrength value true");
        worker.postMessage(`setoption name UCI_Elo value ${boundedElo}`);
      } else {
        worker.postMessage("setoption name UCI_LimitStrength value false");
      }

      const boundedSkill = Math.max(0, Math.min(20, Math.round(skillLevel)));
      worker.postMessage(`setoption name Skill Level value ${boundedSkill}`);
      
      worker.postMessage(`position fen ${fen}`);

      if (timeMode === "clock") {
        const whiteMs = Math.max(1, Math.round(whiteTimeSeconds * 1000));
        const blackMs = Math.max(1, Math.round(blackTimeSeconds * 1000));
        worker.postMessage(`go wtime ${whiteMs} btime ${blackMs} winc 0 binc 0`);
      } else {
        const safeMoveTimeMs = Math.max(50, Math.round(fixedMoveTimeMs));
        worker.postMessage(`go movetime ${safeMoveTimeMs}`);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      worker.postMessage("stop");
    };
  }, [fen, isBotTurn, state.ready]);

  return state;
}
