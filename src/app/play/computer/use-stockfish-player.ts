"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type EngineState = {
  ready: boolean;
  isThinking: boolean;
  bestMove: string | null;
};

export function useStockfishPlayer(fen: string, isBotTurn: boolean, elo: number) {
  const [state, setState] = useState<EngineState>({
    ready: false,
    isThinking: false,
    bestMove: null,
  });
  
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);

  // We use the same single-threaded stockfish 18 lite
  const workerScript = useMemo(
    () =>
      `/engines/stockfish/stockfish-18-lite-single.js#${encodeURIComponent("/engines/stockfish/stockfish-18-lite-single.wasm")},worker`,
    [],
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
        readyRef.current = true;
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
      readyRef.current = false;
      worker.postMessage("quit");
      worker.removeEventListener("message", handleMessage);
      workerRef.current = null;
      worker.terminate();
    };
  }, [workerScript]);

  // Handle bot's turn
  useEffect(() => {
    if (!readyRef.current || !workerRef.current || !isBotTurn) {
      if (!isBotTurn) {
        // Reset best move when it's not bot turn
        setState(s => ({ ...s, bestMove: null }));
      }
      return;
    }

    const worker = workerRef.current;
    
    // Slight delay to make it feel natural
    const timeoutId = window.setTimeout(() => {
      setState((current) => ({ ...current, isThinking: true, bestMove: null }));
      
      // Configure ELO
      worker.postMessage(`setoption name UCI_LimitStrength value true`);
      worker.postMessage(`setoption name UCI_Elo value ${elo}`);
      // Configure skill level (0-20) just in case ELO isn't perfectly supported by this compile
      const skillLevel = Math.max(0, Math.min(20, Math.floor((elo - 250) / 150)));
      worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
      
      worker.postMessage(`position fen ${fen}`);
      
      // If higher ELO, let it think longer (search deeper), if low ELO, fast move.
      // But we generally want responsive play. We'll specify a move time to force it to move.
      const moveTime = elo > 2000 ? 1000 : elo > 1000 ? 500 : 200;
      worker.postMessage(`go movetime ${moveTime}`);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      worker.postMessage("stop");
    };
  }, [fen, isBotTurn, elo]);

  return state;
}
