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

const MIN_CLOCK_MOVE_TIME_MS = 250;
const MAX_CLOCK_MOVE_TIME_MS = 5000;

const getClockManagedMoveTimeMs = (fen: string, whiteTimeSeconds: number, blackTimeSeconds: number) => {
  const fenParts = fen.split(" ");
  const turn = fenParts[1] === "b" ? "b" : "w";
  const fullmoveNumber = Number.parseInt(fenParts[5] ?? "1", 10);
  const safeFullmoveNumber = Number.isFinite(fullmoveNumber) ? Math.max(1, fullmoveNumber) : 1;
  const plyCount = (safeFullmoveNumber - 1) * 2 + (turn === "b" ? 1 : 0);
  const remainingMs = Math.max(
    1,
    Math.round((turn === "w" ? whiteTimeSeconds : blackTimeSeconds) * 1000),
  );

  let divisor = 240;
  if (plyCount >= 12) divisor = 180;
  if (plyCount >= 30) divisor = 140;
  if (plyCount >= 60) divisor = 100;

  const computedBudget = Math.round(remainingMs / divisor);
  return Math.max(MIN_CLOCK_MOVE_TIME_MS, Math.min(MAX_CLOCK_MOVE_TIME_MS, computedBudget));
};

export function useStockfishPlayer(
  fen: string,
  isBotTurn: boolean,
  options: PlayerEngineOptions,
  enabled = true,
) {
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
    if (!enabled || typeof Worker === "undefined") {
      queueMicrotask(() => {
        setState({
          ready: false,
          isThinking: false,
          bestMove: null,
        });
      });
      return;
    }

    queueMicrotask(() => {
      setState({
        ready: false,
        isThinking: false,
        bestMove: null,
      });
    });

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
  }, [enabled, workerScript]);

  // Handle bot's turn
  useEffect(() => {
    if (!enabled || !state.ready || !workerRef.current || !isBotTurn) {
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
        const moveTimeMs = getClockManagedMoveTimeMs(fen, whiteTimeSeconds, blackTimeSeconds);
        worker.postMessage(`go movetime ${moveTimeMs}`);
      } else {
        const safeMoveTimeMs = Math.max(50, Math.round(fixedMoveTimeMs));
        worker.postMessage(`go movetime ${safeMoveTimeMs}`);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      worker.postMessage("stop");
    };
  }, [enabled, fen, isBotTurn, state.ready]);

  return state;
}
