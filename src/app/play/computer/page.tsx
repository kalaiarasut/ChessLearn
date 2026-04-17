"use client";

import type { DragEvent } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowLeft, Settings, Play, Bot, RotateCcw, ChevronLeft, ChevronRight, Monitor, User, Gamepad2, MessageSquare, GraduationCap, Bell, CreditCard, Accessibility, LayoutGrid, Users, Sun, Moon, Crosshair, Crown } from "lucide-react";
import themeManifest from "@/data/themeManifest.json";
import { useTheme } from "@/lib/theme-context";
import { useStockfishPlayer } from "./use-stockfish-player";
import { DEFAULT_CLIENT_PREFERENCES, loadClientPreferences, saveClientPreferences } from "@/lib/client-preferences";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const DEFAULT_FEN = new Chess().fen();
const AVAILABLE_BOARD_THEMES = themeManifest.boardThemes;
const AVAILABLE_PIECE_THEMES = themeManifest.pieceThemes;
const BOARD_THEME_ASSETS = themeManifest.boardAssets as Record<string, string>;
const PIECE_THEME_ASSETS = themeManifest.pieceAssets as Record<string, string>;

const ELOS = [250, 400, 700, 1000, 1300, 1500, 1800, 2000, 2400, 3200];

type SerializableMove = {
  from: Square;
  to: Square;
  san: string;
  isCheck: boolean;
  isCapture: boolean;
  isCastle: boolean;
  isPromotion: boolean;
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

export default function PlayComputerPage() {
  const pathname = usePathname();

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
  const [eloIndex, setEloIndex] = useState<number>(5);
  const elo = ELOS[eloIndex];
  const [timeLimit, setTimeLimit] = useState<number>(10);
  const [playerColor, setPlayerColor] = useState<"w" | "b" | "bot-vs-bot">("w");
  const [gameState, setGameState] = useState<"setup" | "playing" | "game_over">("setup");
  const [fen, setFen] = useState(DEFAULT_FEN);
  const [history, setHistory] = useState<string[]>([DEFAULT_FEN]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [draggedSquare, setDraggedSquare] = useState<Square | null>(null);
  const [dragOverSquare, setDragOverSquare] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<SerializableMove | null>(null);

  const gameRef = useRef(new Chess(fen));

  const isBotTurn = gameState === "playing" && (playerColor === "bot-vs-bot" || gameRef.current.turn() !== playerColor) && !gameRef.current.isGameOver();
  
  const { ready: engineReady, isThinking, bestMove } = useStockfishPlayer(
    fen,
    isBotTurn,
    elo
  );

  const { toggleTheme, isDark } = useTheme();
  const botPreferences = clientPreferences.bot;
  const updateBotPreferences = (updates: Partial<typeof botPreferences>) => {
    setClientPreferences((previous) => ({
      ...previous,
      bot: {
        ...previous.bot,
        ...updates,
      },
    }));
  };

  useEffect(() => {
    setClientPreferences(loadClientPreferences());
  }, []);

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

  const playSound = (name: string) => {
    if (!soundEnabled) return;
    const audio = new Audio(`/sounds/${name}.mp3`);
    audio.volume = Math.min(1, Math.max(0, botPreferences.masterVolume / 100));
    audio.play().catch(() => {});
  };

  const savePreferences = async () => {
    setPreferencesError(null);
    setPreferencesSaving(true);
    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardTheme, pieceTheme, soundEnabled }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to save preferences.");
      }
      saveClientPreferences(clientPreferences);
      setIsSettingsOpen(false);
    } catch (error) {
      setPreferencesError(error instanceof Error ? error.message : "Failed to save preferences.");
    } finally {
      setPreferencesSaving(false);
    }
  };

  // Bot applies its best move
  useEffect(() => {
    if (gameState === "playing" && isBotTurn && bestMove) {
      const from = bestMove.slice(0, 2) as Square;
      const to = bestMove.slice(2, 4) as Square;
      const promotion = bestMove.length > 4 ? bestMove[4] : undefined;
      
      commitMove(from, to, promotion);
    }
  }, [bestMove, isBotTurn, gameState]);

  const startGame = (color: "w" | "b" | "random" | "bot-vs-bot") => {
    const finalColor = color === "random" ? (Math.random() > 0.5 ? "w" : "b") : color;
    setPlayerColor(finalColor);
    setFen(DEFAULT_FEN);
    setHistory([DEFAULT_FEN]);
    setLastMove(null);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setDragOverSquare(null);
    gameRef.current = new Chess();
    setGameState("playing");
    playSound("game-start");
  };

  const stopGame = () => {
    setGameState("setup");
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
      const nextHistory = [...history, newFen];
      
      gameRef.current = nextPosition;
      setHistory(nextHistory);
      setFen(newFen);
      setSelectedSquare(null);
      setDraggedSquare(null);
      setLastMove(serializedMove);

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

  const handleSquareClick = (square: Square) => {
    if (botPreferences.moveMethod === "drag") return;
    if (gameState !== "playing" || isBotTurn) return;

    const game = gameRef.current;
    const clickedPiece = game.get(square);
    const legalTargets = selectedSquare ? game.moves({ square: selectedSquare, verbose: true }).map((m) => m.to) : [];

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

  const handleDragStart = (event: DragEvent<HTMLDivElement>, square: Square) => {
    if (botPreferences.moveMethod === "click") {
      event.preventDefault();
      return;
    }
    if (gameState !== "playing" || isBotTurn) {
      event.preventDefault();
      return;
    }

    const game = gameRef.current;
    const draggedPiece = game.get(square);

    if (!draggedPiece || draggedPiece.color !== game.turn()) {
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
    if (!draggedSquare || isBotTurn || gameState !== "playing") return;

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
  const legalTargets = selectedSquare && gameState === "playing" && !isBotTurn
    ? game.moves({ square: selectedSquare, verbose: true }).map((move) => move.to)
    : [];

  const isBoardFlipped =
    botPreferences.boardOrientation === "black"
      ? true
      : botPreferences.boardOrientation === "white"
        ? false
        : playerColor === "b";

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[var(--bg)]">
      <header className="w-full px-8 py-5 flex items-center justify-between border-b border-[var(--border)]">
        <Link href="/" className="text-[22px] font-serif font-[800] text-[var(--text-primary)]">
          CHESS
        </Link>
        <Link
          href="/play"
          className="inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[14px] font-medium group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" />
          Back to Play
        </Link>
      </header>

      <main className="flex-1 w-full flex flex-col lg:flex-row h-[calc(100vh-73px)]">
        {/* Left Side: Setup & Status */}
        <div className="w-full lg:w-[35%] flex flex-col items-center justify-center p-10 bg-[var(--bg)] relative z-10 shrink-0">
          <div className="w-full max-w-[440px] bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-blue-500 to-emerald-400" />
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-[var(--skeleton)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] shadow-sm">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-[28px] font-serif text-[var(--text-primary)] font-[500] leading-tight tracking-tight">
                  Play vs Computer
                </h1>
                <p className="text-[var(--text-muted)] text-[14px]">
                  Challenge Stockfish 16 at any level
                </p>
              </div>
            </div>

            {gameState === "setup" ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="mb-6">
                  <label className="text-[14px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2 px-1 mb-3">
                     Difficulty
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-8">
                    {[
                      { label: "Easy", icon: <User className="w-4 h-4" />, val: 2 }, 
                      { label: "Med", icon: <GraduationCap className="w-4 h-4" />, val: 4 }, 
                      { label: "Hard", icon: <Crosshair className="w-4 h-4" />, val: 7 }, 
                      { label: "Pro", icon: <Crown className="w-4 h-4" />, val: 9 } 
                    ].map((diff) => (
                      <button
                        key={diff.label}
                        onClick={() => setEloIndex(diff.val)}
                        className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all gap-1.5 ${
                          eloIndex === diff.val
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                            : "bg-[var(--surface-alt)] border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                         {diff.icon}
                         <span className="text-[12px] font-bold">{diff.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mb-3 px-1">
                    <label className="text-[14px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                       Engine ELO
                    </label>
                    <div className="px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[18px] shadow-[0_0_10px_rgba(16,185,129,0.1)]">
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
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-[#10b981]"
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
                      <span className="flex flex-col items-start"><span className="text-[11px] uppercase tracking-widest opacity-70">Beginner</span>250</span>
                      <span className="flex flex-col items-end"><span className="text-[11px] uppercase tracking-widest opacity-70">Master</span>3200</span>
                    </div>
                  </div>
                </div>

                <div className="mb-8 mt-10">
                  <label className="block text-[14px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 px-1">
                    Time Limit
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
                      onClick={() => startGame("bot-vs-bot")}
                      className="relative overflow-hidden py-4 px-2 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 hover:from-emerald-500/20 hover:to-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-all flex flex-col items-center gap-3 group shadow-[0_4px_15px_rgba(16,185,129,0.1)] hover:shadow-[0_8px_25px_rgba(16,185,129,0.2)] hover:-translate-y-1"
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-colors duration-500" />
                      <Bot className="w-8 h-8 group-hover:scale-110 transition-transform filter drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] relative z-10"/>
                      <span className="text-[13px] font-bold tracking-wide relative z-10">Bot Match</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                
                {/* Game Status */}
                <div className="bg-[var(--surface-alt)] rounded-xl border border-[var(--border)] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--skeleton)] flex items-center justify-center relative shadow-inner">
                        <Bot className="w-5 h-5 text-[var(--text-muted)]" />
                        {isThinking && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />}
                        {isThinking && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full" />}
                      </div>
                      <div>
                        <h3 className="text-[15px] font-bold text-[var(--text-primary)]">Stockfish</h3>
                        <p className="text-[13px] text-[var(--text-muted)] font-mono">ELO {elo}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-[var(--border-subtle)] pt-4 mt-2">
                    <p className={`font-medium text-[15px] ${gameState === "game_over" ? "text-red-400" : "text-[var(--text-secondary)]"}`}>
                      {getPositionStatus(gameRef.current)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={stopGame}
                    className="flex-1 py-3.5 bg-[var(--skeleton)] text-[var(--text-primary)] font-bold rounded-xl hover:bg-[var(--border)] transition-colors"
                  >
                    Abort Setup
                  </button>
                  <button
                    onClick={() => {
                        const nextColor = playerColor === "w" ? "b" : "w";
                        startGame(nextColor);
                    }}
                    className="aspect-square p-3.5 bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)] font-bold rounded-xl transition-colors shadow-lg flex items-center justify-center group"
                    title="Rematch with opposite colors"
                  >
                    <RotateCcw className="w-5 h-5 group-hover:-rotate-90 transition-transform duration-300" />
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </div>

        {/* Right Side: The Board */}
        <div className="w-full lg:w-[65%] flex-1 flex flex-row items-center justify-center lg:justify-end bg-[var(--bg-alt)] p-8 lg:p-0 lg:pt-6 lg:pr-[70px] relative shadow-[-30px_0_50px_rgba(0,0,0,0.15)] border-l border-[var(--border)]">
          <div className="absolute top-6 right-6 flex flex-col gap-3 z-50">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={toggleTheme}
              data-theme-toggle
              className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center"
            >
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
          </div>

          <div className="flex flex-col items-center justify-center h-[90vh] max-h-[860px] max-w-[95%] lg:max-w-[70%] lg:min-w-[500px] w-full relative pt-12 lg:pt-0 shrink-0 lg:ml-auto lg:mr-4">
            {/* Top Bar (Opponent: Stockfish) */}
            {gameState !== "setup" && (
              <div className="w-full flex items-center justify-between mb-4 bg-[var(--surface)] px-5 py-3.5 rounded-xl border border-[var(--border)] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-lg bg-[var(--skeleton)] border border-[var(--border)] flex items-center justify-center shrink-0">
                    <Bot className="w-6 h-6 text-[var(--text-secondary)]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[15px] text-[var(--text-primary)] tracking-wide">MT Model</span>
                    <span className="text-[12px] text-[var(--text-muted)] font-medium">Bot Level {eloIndex + 1}</span>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <span className="text-[14px] font-bold text-[var(--text-muted)] tracking-widest hidden sm:inline-block">+2 ♙♙♙</span>
                  <div className="px-4 py-2 bg-[var(--bg-alt)] border border-[var(--border-subtle)] rounded-lg font-mono font-bold text-[20px] text-[var(--text-primary)] shadow-inner w-[90px] text-center">
                    {timeLimit}:00
                  </div>
                </div>
              </div>
            )}
            
            <div
              className={`w-full aspect-square relative overflow-hidden shadow-2xl rounded-sm transition-all duration-500 ${!engineReady && gameState === "setup" ? "opacity-90 grayscale-[0.3]" : ""}`}
            >
              <BoardImage src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`} className="w-full h-full">
                <div className="w-full h-full grid grid-cols-8 grid-rows-8 relative">
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

                    return (
                      <div
                        key={square}
                        onClick={() => handleSquareClick(square)}
                        onDragOver={(event) => {
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
                        className={`relative flex items-center justify-center ${gameState === "playing" && !isBotTurn ? "cursor-pointer" : ""}`}
                      >
                        {dragOverSquare === square && (
                          <div className="absolute inset-0 ring-[3px] ring-white bg-white/20 z-20 pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                        )}
                        {isLastMoveSquare && (
                          <div className="absolute inset-[4%] rounded-[4px] bg-amber-300/20" />
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
                            squarePiece &&
                            squarePiece.color === gameRef.current.turn(),
                          )}
                          onDragStart={(event) => handleDragStart(event, square)}
                          onDragEnd={() => setDraggedSquare(null)}
                          className={`relative z-10 h-full w-full p-[2.75%] ${isDraggedSquare ? "opacity-30" : "opacity-100"}`}
                        >
                          {getPieceIcon(piece, pieceTheme)}
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </BoardImage>
            </div>

            {/* Bottom Bar (Player: User) */}
            {gameState !== "setup" && (
              <div className="w-full flex items-center justify-between mt-4 bg-[var(--surface)] px-5 py-3.5 rounded-xl border border-[var(--border)] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-lg bg-gradient-to-b from-[#444] to-[#222] border border-[#555] flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                     <User className="w-6 h-6 text-white/90" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[15px] text-[var(--text-primary)] tracking-wide">Guest User</span>
                    <span className="text-[12px] text-[var(--text-muted)] font-medium">1200</span>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="px-4 py-2 bg-[var(--bg-alt)] border border-[var(--border-subtle)] rounded-lg font-mono font-bold text-[20px] text-[var(--text-primary)] shadow-inner w-[90px] text-center">
                    {timeLimit}:00
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Settings Modal (Copied exactly from learn page but adjusted) */}
        {isSettingsOpen && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsSettingsOpen(false)}
          >
            <div 
              className="w-[1050px] max-w-[95vw] h-[720px] max-h-[90vh] bg-[var(--surface-alt)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden flex flex-row relative cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              
              <div className="w-[240px] md:w-[260px] bg-[var(--surface)] border-r border-[var(--border)] flex flex-col py-4 overflow-y-auto shrink-0 z-10 custom-scrollbar">
                <div className="px-5 mb-4">
                  <span className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">Settings</span>
                </div>
                <button 
                  onClick={() => setActiveCategory("board")}
                  className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${activeCategory === "board" ? "bg-[var(--surface-alt)] text-emerald-400 font-medium border-emerald-500 shadow-[-10px_0_20px_rgba(16,185,129,0.05)]" : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"}`}>
                  <LayoutGrid className="w-[18px] h-[18px]" />
                  <span className="text-[14px]">Board & Pieces</span>
                </button>
                <button 
                  onClick={() => setActiveCategory("gameplay")}
                  className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${activeCategory === "gameplay" ? "bg-[var(--surface-alt)] text-emerald-400 font-medium border-emerald-500 shadow-[-10px_0_20px_rgba(16,185,129,0.05)]" : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"}`}>
                  <Gamepad2 className="w-[18px] h-[18px]" />
                  <span className="text-[14px]">Gameplay</span>
                </button>
                <button 
                  onClick={() => setActiveCategory("engine")}
                  className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${activeCategory === "engine" ? "bg-[var(--surface-alt)] text-emerald-400 font-medium border-emerald-500 shadow-[-10px_0_20px_rgba(16,185,129,0.05)]" : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"}`}>
                  <Bot className="w-[18px] h-[18px]" />
                  <span className="text-[14px]">Engine</span>
                </button>
                <button 
                  onClick={() => setActiveCategory("interface")}
                  className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${activeCategory === "interface" ? "bg-[var(--surface-alt)] text-emerald-400 font-medium border-emerald-500 shadow-[-10px_0_20px_rgba(16,185,129,0.05)]" : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"}`}>
                  <Monitor className="w-[18px] h-[18px]" />
                  <span className="text-[14px]">Interface</span>
                </button>
              </div>

              <div className="flex-1 flex flex-col relative min-w-0 bg-[var(--bg)]">
                <div className="px-8 pt-6 pb-3 shrink-0">
                  <h2 className="text-[24px] font-bold text-[var(--text-primary)] mb-1 font-sans">
                    {activeCategory === "board" && "Board & Pieces"}
                    {activeCategory === "engine" && "Engine"}
                    {activeCategory === "gameplay" && "Gameplay"}
                    {activeCategory === "interface" && "Interface"}
                  </h2>
                  <p className="text-[var(--text-secondary)] text-[14px]">
                    {activeCategory === "board" && "Customize the look and feel of your chess set."}
                    {activeCategory === "engine" && "Configure Stockfish strength and analysis parameters."}
                    {activeCategory === "gameplay" && "Configure rules and preferences for your games."}
                    {activeCategory === "interface" && "Change platform language, sounds, and UI interactions."}
                  </p>
                  {preferencesLoading && (
                    <p className="text-[var(--text-muted)] text-[12px] mt-2">Loading saved preferences...</p>
                  )}
                  {preferencesError && (
                    <p className="text-[var(--error-text)] text-[12px] mt-2">{preferencesError}</p>
                  )}
                </div>

                {activeCategory === "engine" && (
                  <div className="flex-1 px-8 pb-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar pt-2">
                    {/* GAME REVIEW Section */}
                    <div>
                      <h3 className="text-[11px] font-bold tracking-widest text-[var(--text-muted)] uppercase mb-3 px-1">Game Review</h3>
                      <div className="bg-[#0b243b] text-[#3ca2fb] w-full rounded-sm py-2 px-3 mb-2 font-medium text-[13px] flex items-center shadow-sm">
                        Upgrade to Diamond for increased Game Review strength
                      </div>
                      <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)]">Chess Engine</span>
                          <span className="text-[14px] text-[var(--text-secondary)] font-medium">Stockfish 16</span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)]">Strength</span>
                          <select className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500 min-w-[200px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTUgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]">
                            <option>Fast (~1 sec, 3270 Rating)</option>
                            <option>Standard (~3 sec, 3500 Rating)</option>
                            <option>Deep (~10 sec, 3600 Rating)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* ANALYSIS Section */}
                    <div>
                      <h3 className="text-[11px] font-bold tracking-widest text-[var(--text-muted)] uppercase mb-3 px-1">Analysis</h3>
                      <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)]">Chess Engine</span>
                          <select className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500 min-w-[200px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]">
                            <option>Stockfish 18 Lite (7MB download)</option>
                            <option>Stockfish 18.1 NNUE (Full)</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)]">Maximum Time</span>
                          <select className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500 min-w-[200px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]">
                            <option>Unlimited</option>
                            <option>3 sec</option>
                            <option selected>5 sec</option>
                            <option>10 sec</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)]">Number of Lines</span>
                          <select className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500 min-w-[200px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[center_right_0.5rem]">
                            <option>1</option>
                            <option>2</option>
                            <option selected>3</option>
                            <option>4</option>
                            <option>5</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors">
                          <span className="text-[14px] text-[var(--text-primary)]">Threads</span>
                          <input type="number" defaultValue="1" min="1" max="32" className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500 w-[200px]" />
                        </div>
                      </div>
                    </div>

                    {/* CLOUD Section */}
                    <div>
                      <h3 className="text-[11px] font-bold tracking-widest text-[var(--text-muted)] uppercase mb-3 px-1">Cloud</h3>
                      <div className="bg-[#0b243b] text-[#3ca2fb] w-full rounded-sm py-2 px-3 mb-2 font-medium text-[13px] flex items-center shadow-sm">
                        Upgrade to Diamond to enable Cloud Analysis
                      </div>
                    </div>
                  </div>
                )}

                {activeCategory === "gameplay" && (
                  <div className="flex-1 px-8 pb-8 overflow-y-auto custom-scrollbar pt-2">
                    <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
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
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Show Legal Moves</span>
                        <input type="checkbox" checked={botPreferences.showLegalMoves} onChange={(event) => updateBotPreferences({ showLegalMoves: event.target.checked })} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Move Confirmation</span>
                        <input type="checkbox" checked={botPreferences.moveConfirmation} onChange={(event) => updateBotPreferences({ moveConfirmation: event.target.checked })} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Auto Queen</span>
                        <input type="checkbox" checked={botPreferences.autoQueen} onChange={(event) => updateBotPreferences({ autoQueen: event.target.checked })} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Lock Board On Bot Turn</span>
                        <input type="checkbox" checked={botPreferences.boardLock} onChange={(event) => updateBotPreferences({ boardLock: event.target.checked })} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Low Time Warning</span>
                        <input type="checkbox" checked={botPreferences.lowTimeWarning} onChange={(event) => updateBotPreferences({ lowTimeWarning: event.target.checked })} />
                      </div>
                    </div>
                  </div>
                )}

                {activeCategory === "interface" && (
                  <div className="flex-1 px-8 pb-8 overflow-y-auto custom-scrollbar pt-2">
                    <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                        <span className="text-[14px] text-[var(--text-primary)]">Board Orientation</span>
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
                      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
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
                )}

                {activeCategory === "board" && (
                  <div className="flex flex-col md:flex-row px-8 pb-8 pt-0 gap-8 h-[650px] max-h-[75vh] w-full">
                  <div className="w-full md:w-[55%] flex flex-col h-full min-h-0">
                    <div className="flex border-b border-[var(--border)] mb-4 shrink-0">
                      <button
                        onClick={() => setActiveSettingsTab("boards")}
                        className={`px-4 py-2 font-semibold text-[14px] transition-colors relative ${activeSettingsTab === "boards" ? "text-emerald-500" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                      >
                        Boards
                        {activeSettingsTab === "boards" && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-emerald-500" />}
                      </button>
                      <button
                        onClick={() => setActiveSettingsTab("pieces")}
                        className={`px-4 py-2 font-semibold text-[14px] transition-colors relative ${activeSettingsTab === "pieces" ? "text-emerald-500" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                      >
                        Pieces
                        {activeSettingsTab === "pieces" && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-emerald-500" />}
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                      {activeSettingsTab === "boards" && (
                        <div className="grid grid-cols-4 gap-4 px-2 py-3 pb-6">
                          {AVAILABLE_BOARD_THEMES.map((theme) => {
                            const isSelected = boardTheme === theme;
                            const bgImage = BOARD_THEME_ASSETS[theme] ?? `/boards/${theme}.png`;
                            return (
                              <button
                                key={theme}
                                onClick={() => {
                                  setBoardTheme(theme);
                                  playSound("move-self");
                                }}
                                className={`group relative flex flex-col gap-1.5 transition-all ${isSelected ? "z-10" : "z-0"}`}
                              >
                                <div className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${isSelected ? "border-emerald-500 scale-[1.05] shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "border-transparent group-hover:border-[var(--border-hover)]"}`}>
                                  <BoardThumbnail src={bgImage} className="w-full h-full" />
                                  {isSelected && (
                                    <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center z-20">
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                  )}
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider font-bold truncate px-1 transition-colors ${isSelected ? "text-emerald-500" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"}`}>
                                  {theme.replace(/_/g, " ")}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {activeSettingsTab === "pieces" && (
                        <div className="grid grid-cols-4 gap-4 px-2 py-3 pb-6">
                          {AVAILABLE_PIECE_THEMES.map((theme) => {
                            const isSelected = pieceTheme === theme;
                            const knightSrc = `${PIECE_THEME_ASSETS[theme] ?? `/pieces/${theme}/150`}/wn.png`;
                            return (
                              <button
                                key={theme}
                                onClick={() => {
                                  setPieceTheme(theme);
                                  playSound("move-self");
                                }}
                                className={`group relative flex flex-col gap-1.5 transition-all ${isSelected ? "z-10" : "z-0"}`}
                              >
                                <div className={`relative aspect-square rounded-lg border-2 bg-[var(--skeleton)] flex items-center justify-center transition-all p-2 ${isSelected ? "border-emerald-500 scale-[1.05] shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "border-transparent group-hover:border-[var(--border-hover)] group-hover:bg-[var(--skeleton-soft)]"}`}>
                                  <PieceThumbnail src={knightSrc} alt={theme} />
                                  {isSelected && (
                                    <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center z-10">
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                  )}
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider font-bold truncate px-1 transition-colors ${isSelected ? "text-emerald-500" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"}`}>
                                  {theme.replace(/_/g, " ")}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full md:w-[45%] flex flex-col items-center justify-start rounded-xl p-0 relative shrink-0">
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
                    
                    <div className="mt-8 w-full flex items-center justify-start gap-4">
                      <label className="relative inline-flex items-center cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={soundEnabled} 
                          onChange={(e) => {
                            setSoundEnabled(e.target.checked);
                            if (e.target.checked) new Audio("/sounds/move-self.mp3").play().catch(() => {});
                          }} 
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-[var(--skeleton)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-muted)] after:border border-[var(--border)] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white peer-checked:after:border-white group-hover:after:scale-[1.05]"></div>
                        <span className="ml-3 text-[14px] text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)] transition-colors">Enable Sounds</span>
                      </label>
                    </div>
                  </div>
                </div>
                )}

                <div className="mt-auto bg-[var(--surface-alt)] px-8 py-5 flex items-center justify-end border-t border-[var(--border)] w-full shrink-0">
                  <button 
                    onClick={() => savePreferences().catch(() => {})}
                    disabled={preferencesSaving || preferencesLoading}
                    className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {preferencesSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
