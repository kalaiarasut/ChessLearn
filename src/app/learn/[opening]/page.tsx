"use client";

import type { DragEvent } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowLeft, Settings, Play, Pause, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Monitor, User, Gamepad2, GraduationCap, Bell, CreditCard, Accessibility, LayoutGrid, Users, Sun, Moon, MoreHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import themeManifest from "@/data/themeManifest.json";
import { useStockfishAnalysis } from "./use-stockfish-analysis";
import { useTorchStatus } from "./use-torch-status";
import { useTheme } from "@/lib/theme-context";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const DEFAULT_FEN = new Chess().fen();
const AVAILABLE_BOARD_THEMES = themeManifest.boardThemes;
const AVAILABLE_PIECE_THEMES = themeManifest.pieceThemes;
const BOARD_THEME_ASSETS = themeManifest.boardAssets as Record<string, string>;
const PIECE_THEME_ASSETS = themeManifest.pieceAssets as Record<string, string>;

type SerializableMove = {
  from: Square;
  to: Square;
  san: string;
  isCheck: boolean;
  isCapture: boolean;
  isCastle: boolean;
  isPromotion: boolean;
};

const formatOpeningTitle = (slug: string) =>
  slug
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

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
  if (!code) {
    return null;
  }

  return (
    <PieceImage 
      src={`${PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`}/${code}.png`} 
      alt={code} 
    />
  );
};

const getPositionStatus = (game: Chess) => {
  const sideToMove = game.turn() === "w" ? "White" : "Black";

  if (game.isCheckmate()) {
    return `${sideToMove} is checkmated.`;
  }

  if (game.isStalemate()) {
    return "Draw by stalemate.";
  }

  if (game.isInsufficientMaterial()) {
    return "Draw by insufficient material.";
  }

  if (game.isThreefoldRepetition()) {
    return "Draw by repetition.";
  }

  if (game.isDraw()) {
    return "Drawn position.";
  }

  if (game.isCheck()) {
    return `${sideToMove} to move and in check.`;
  }

  return `${sideToMove} to move.`;
};

type AnalysisStrength = "fast" | "standard" | "deep" | "maximum";
type AnalysisEngineChoice = "stockfish-18" | "stockfish-18-lite" | "torch-4" | "torch-4-lite" | "off";

const ANALYSIS_PRESET_TO_DEPTH: Record<AnalysisStrength, number> = {
  fast: 13,
  standard: 17,
  deep: 20,
  maximum: 22,
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

export default function OpeningPage() {
  const pathname = usePathname();
  const title = pathname.split("/").pop()?.replace(/-/g, " ") || "Opening";
  const formattedTitle = formatOpeningTitle(title);

  const [boardTheme, setBoardTheme] = useState(themeManifest.defaultBoardTheme);
  const [pieceTheme, setPieceTheme] = useState(themeManifest.defaultPieceTheme);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"boards" | "pieces" | "engine">("boards");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fen, setFen] = useState(DEFAULT_FEN);
  const [history, setHistory] = useState<string[]>([DEFAULT_FEN]);
  const [sanHistory, setSanHistory] = useState<string[]>([]);
  const [soundHistory, setSoundHistory] = useState<string[]>(["game-start"]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBoardFlipped, setIsBoardFlipped] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [draggedSquare, setDraggedSquare] = useState<Square | null>(null);
  const [dragOverSquare, setDragOverSquare] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<SerializableMove | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [isAnalysisMenuOpen, setIsAnalysisMenuOpen] = useState(false);
  const [showEvaluationBar, setShowEvaluationBar] = useState(true);
  const [showEngineLines, setShowEngineLines] = useState(true);
  const [showSuggestionArrow, setShowSuggestionArrow] = useState(false);
  const [showMoveFeedback, setShowMoveFeedback] = useState(false);
  const [analysisStrength, setAnalysisStrength] = useState<AnalysisStrength>("standard");
  const [analysisEngineChoice, setAnalysisEngineChoice] = useState<AnalysisEngineChoice>("stockfish-18-lite");
  const [analysisMaxTimeSeconds, setAnalysisMaxTimeSeconds] = useState(5);
  const [analysisMultiPv, setAnalysisMultiPv] = useState(3);
  const [analysisThreads, setAnalysisThreads] = useState(1);
  const [analysisDepth, setAnalysisDepth] = useState(ANALYSIS_PRESET_TO_DEPTH.standard);
  const [expandedEngineLineIds, setExpandedEngineLineIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      if (currentMoveIndex < history.length - 1) {
        const nextIndex = currentMoveIndex + 1;
        timer = setTimeout(() => {
          const sound = soundHistory[nextIndex] || "move-self";
          playSound(sound);
          setFen(history[nextIndex]);
          setCurrentMoveIndex(nextIndex);
        }, 1000);
      } else {
        setIsPlaying(false);
      }
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentMoveIndex, history, soundEnabled, soundHistory]);

  const game = new Chess(fen);
  const legalTargets = selectedSquare
    ? game.moves({ square: selectedSquare, verbose: true }).map((move) => move.to)
    : [];
  const boardState = game.board().map((row) => row.map((piece) => getPieceCode(piece)));
  const statusText = getPositionStatus(game);
  const isEngineEnabled = analysisEngineChoice !== "off";
  const stockfishVariant = analysisEngineChoice === "stockfish-18" ? "stockfish-18" : "stockfish-18-lite";
  const analysis = useStockfishAnalysis(
    fen,
    isEngineEnabled,
    analysisDepth,
    analysisMultiPv,
    analysisThreads,
    stockfishVariant,
  );
  const { status: torchStatus, loading: torchLoading } = useTorchStatus();

  useEffect(() => {
    let isCancelled = false;

    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/preferences", { method: "GET" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          boardTheme?: string;
          pieceTheme?: string;
          soundEnabled?: boolean;
        };

        if (isCancelled) {
          return;
        }

        if (typeof data.boardTheme === "string") {
          setBoardTheme(data.boardTheme);
        }

        if (typeof data.pieceTheme === "string") {
          setPieceTheme(data.pieceTheme);
        }

        if (typeof data.soundEnabled === "boolean") {
          setSoundEnabled(data.soundEnabled);
        }
      } finally {
        if (!isCancelled) {
          setPreferencesLoading(false);
        }
      }
    };

    loadPreferences().catch(() => {
      if (!isCancelled) {
        setPreferencesLoading(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    setAnalysisDepth(ANALYSIS_PRESET_TO_DEPTH[analysisStrength]);
    setAnalysisMaxTimeSeconds(
      analysisStrength === "fast" ? 1 : analysisStrength === "standard" ? 5 : analysisStrength === "deep" ? 20 : 90,
    );
  }, [analysisStrength]);

  useEffect(() => {
    if (!analysis.error) {
      return;
    }

    if (analysisEngineChoice === "stockfish-18") {
      setAnalysisEngineChoice("stockfish-18-lite");
    }
  }, [analysis.error, analysisEngineChoice]);

  const playSound = (name: string) => {
    if (!soundEnabled) {
      return;
    }

    new Audio(`/sounds/${name}.mp3`).play().catch(() => {});
  };

  const resetBoard = () => {
    setFen(DEFAULT_FEN);
    setHistory([DEFAULT_FEN]);
    setSanHistory([]);
    setSoundHistory(["game-start"]);
    setCurrentMoveIndex(0);
    setIsPlaying(false);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setDragOverSquare(null);
    setLastMove(null);
    playSound("game-start");
  };

  const goToStart = () => {
    setFen(history[0]);
    setCurrentMoveIndex(0);
    setIsPlaying(false);
    playSound("game-start");
  };

  const goToPrev = () => {
    if (currentMoveIndex > 0) {
      if (soundEnabled && soundHistory[currentMoveIndex]) {
        playSound(soundHistory[currentMoveIndex]);
      }
      setFen(history[currentMoveIndex - 1]);
      setCurrentMoveIndex(currentMoveIndex - 1);
      setIsPlaying(false);
    }
  };

  const goToNext = () => {
    if (currentMoveIndex < history.length - 1) {
      if (soundEnabled && soundHistory[currentMoveIndex + 1]) {
        playSound(soundHistory[currentMoveIndex + 1]);
      }
      setFen(history[currentMoveIndex + 1]);
      setCurrentMoveIndex(currentMoveIndex + 1);
      setIsPlaying(false);
    }
  };

  const goToEnd = () => {
    const lastIndex = history.length - 1;
    if (soundEnabled && soundHistory[lastIndex]) {
      playSound(soundHistory[lastIndex]);
    }
    setFen(history[lastIndex]);
    setCurrentMoveIndex(lastIndex);
    setIsPlaying(false);
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const commitMove = (from: Square, to: Square) => {
    const nextPosition = new Chess(fen);

    try {
      const move = nextPosition.move({
        from,
        to,
        promotion: "q",
      });

      if (!move) {
        playSound("illegal");
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
      const nextHistory = history.slice(0, currentMoveIndex + 1);
      nextHistory.push(newFen);
      const nextSanHistory = sanHistory.slice(0, currentMoveIndex);
      nextSanHistory.push(move.san);
      setHistory(nextHistory);
      setSanHistory(nextSanHistory);
      setCurrentMoveIndex(nextHistory.length - 1);
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
      setSoundHistory(prev => [...prev.slice(0, currentMoveIndex + 1), soundToPlay]);

      return true;
    } catch {
      playSound("illegal");
      return false;
    }
  };

  const handleSquareClick = (square: Square) => {
    const clickedPiece = game.get(square);

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    if (selectedSquare && legalTargets.includes(square)) {
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
    const draggedPiece = game.get(square);

    if (!draggedPiece || draggedPiece.color !== game.turn()) {
      event.preventDefault();
      return;
    }

    // Use the piece image as drag ghost to avoid multiple pieces appearing
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

    if (!draggedSquare) {
      return;
    }

    const didMove = commitMove(draggedSquare, square);

    if (!didMove) {
      setDraggedSquare(null);
      setSelectedSquare(draggedSquare);
    }
  };

  const savePreferences = async () => {
    setPreferencesError(null);
    setPreferencesSaving(true);

    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          boardTheme,
          pieceTheme,
          soundEnabled,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to save preferences.");
      }

      setIsSettingsOpen(false);
    } catch (error) {
      setPreferencesError(error instanceof Error ? error.message : "Failed to save preferences.");
    } finally {
      setPreferencesSaving(false);
    }
  };

  const { toggleTheme, isDark } = useTheme();

  const topSuggestedMove = analysis.lines[0]?.pv[0] ?? null;
  const suggestionFrom = topSuggestedMove?.slice(0, 2) ?? null;
  const suggestionTo = topSuggestedMove?.slice(2, 4) ?? null;

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

  const suggestionStart = showSuggestionArrow ? toBoardPoint(suggestionFrom) : null;
  const suggestionEnd = showSuggestionArrow ? toBoardPoint(suggestionTo) : null;
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
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[var(--bg)]">
      <header className="w-full px-8 py-5 flex items-center justify-between border-b border-[var(--border)]">
        <Link href="/" className="text-[22px] font-serif font-[800] text-[var(--text-primary)]">
          CHESS
        </Link>
        <Link
          href="/learn"
          className="inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[14px] font-medium group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" />
          Back to Learn
        </Link>
      </header>

      <main className="flex-1 w-full flex flex-col lg:flex-row h-[calc(100vh-73px)]">
        <div className="w-full lg:w-[35%] p-6 lg:p-5 bg-[var(--bg)] relative z-10 shrink-0 border-r border-[var(--border)]">
          <div className="w-full h-full max-h-[85vh] bg-[#1e1e1f] border border-[#2d2d2f] rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="h-12 px-3 border-b border-[#2c2c2d] flex items-center justify-between relative">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#3a3a3a] text-[#d4d4d4] text-[10px]">v</span>
                <span className="text-[#f0f0f0] text-[20px] font-[500] leading-none">Analysis</span>
                <button
                  onClick={() => setIsAnalysisMenuOpen((open) => !open)}
                  className="p-1 rounded hover:bg-white/10 text-[#b8b8b8]"
                  title="Analysis menu"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#cfcfcf] text-[14px]">depth-{analysis.depth || analysisDepth}</span>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-[#bfbfbf] hover:text-white"
                  title="Engine settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              {isAnalysisMenuOpen && (
                <div className="absolute top-11 left-20 z-30 w-[230px] rounded-md border border-[#3a3a3d] bg-[#242426] shadow-2xl py-2">
                  <button onClick={() => setShowEvaluationBar((v) => !v)} className="w-full px-3 py-2 text-left text-[#e8e8e8] hover:bg-white/5 text-[14px] flex items-center justify-between">
                    <span>Evaluation Bar</span>
                    <span className={showEvaluationBar ? "text-emerald-400" : "text-[#7b7b7b]"}>{showEvaluationBar ? "On" : "Off"}</span>
                  </button>
                  <button onClick={() => setShowEngineLines((v) => !v)} className="w-full px-3 py-2 text-left text-[#e8e8e8] hover:bg-white/5 text-[14px] flex items-center justify-between">
                    <span>Engine Lines</span>
                    <span className={showEngineLines ? "text-emerald-400" : "text-[#7b7b7b]"}>{showEngineLines ? "On" : "Off"}</span>
                  </button>
                  <button onClick={() => setShowSuggestionArrow((v) => !v)} className="w-full px-3 py-2 text-left text-[#e8e8e8] hover:bg-white/5 text-[14px] flex items-center justify-between">
                    <span>Suggestion Arrow</span>
                    <span className={showSuggestionArrow ? "text-emerald-400" : "text-[#7b7b7b]"}>{showSuggestionArrow ? "On" : "Off"}</span>
                  </button>
                  <button onClick={() => setShowMoveFeedback((v) => !v)} className="w-full px-3 py-2 text-left text-[#e8e8e8] hover:bg-white/5 text-[14px] flex items-center justify-between">
                    <span>Move Feedback</span>
                    <span className={showMoveFeedback ? "text-emerald-400" : "text-[#7b7b7b]"}>{showMoveFeedback ? "On" : "Off"}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              <div className="max-h-[255px] overflow-visible border-b border-[#2a2a2c]">
                {showEngineLines ? (
                  <>
                    {analysis.lines.slice(0, analysisMultiPv).map((line) => {
                      const pvMoves = buildPvDisplayMoves(fen, line.pv);
                      const isExpanded = expandedEngineLineIds[line.id] ?? false;
                      const canExpand = pvMoves.length > 6;
                      const visibleMoves = isExpanded ? pvMoves : pvMoves.slice(0, 6);

                      return (
                        <div key={line.id} className="min-h-[44px] px-2 py-1 border-b border-[#2a2a2c] flex items-start gap-2 text-[#d8d8d8] relative z-20">
                          <div className="min-w-[52px] h-6 rounded bg-[#151515] border border-[#3a3a3c] flex items-center justify-center text-[12px] font-bold leading-none text-white mt-[2px]">
                            {line.scoreText}
                          </div>
                          <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] leading-[1.1] text-[#d7d7d7]">
                              {visibleMoves.map((pvMove) => (
                                <div key={pvMove.key} className="relative group">
                                  <span className="inline-flex rounded-sm px-1 py-[2px] hover:bg-white/10 cursor-default">
                                    {pvMove.label}
                                  </span>
                                  <div className="pointer-events-none hidden group-hover:block absolute left-0 top-[calc(100%+8px)] z-[200]">
                                    <MiniBoardPreview fen={pvMove.fenAfter} boardTheme={boardTheme} pieceTheme={pieceTheme} />
                                  </div>
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
                                className="h-6 w-6 shrink-0 rounded text-[#c1c1c4] hover:bg-white/10 hover:text-white flex items-center justify-center"
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
                      <div className="px-3 py-3 text-rose-300 text-[14px] border-b border-[#2a2a2c]">
                        Engine failed: {analysis.error}
                      </div>
                    ) : analysis.lines.length === 0 && (
                      <div className="px-3 py-3 text-[#9a9a9a] text-[14px] border-b border-[#2a2a2c]">
                        {analysis.ready ? "Analyzing current position..." : "Starting engine..."}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="px-3 py-3 text-[#9a9a9a] text-[14px] border-b border-[#2a2a2c]">
                    Engine lines hidden from menu.
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 flex flex-col bg-[#1d1d1f]">
                <div className="px-3 py-2 border-b border-[#2a2a2c] text-[15px] font-semibold text-white">
                  White - Black
                </div>
                <div className="flex-1 overflow-y-auto">
                  {playedMoveRows.length === 0 ? (
                    <div className="px-3 py-3 text-[13px] text-[#8f8f92]">No moves yet.</div>
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

            <div className="px-3 py-2 border-t border-[#2a2a2c] bg-[#1b1b1c]">
              <div className="flex items-center justify-center gap-2 mb-3 w-full">
                <button onClick={goToStart} disabled={currentMoveIndex === 0} className="p-2 rounded-md bg-[#2b2b2c] hover:bg-[#353537] text-[#c7c7c7] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button onClick={goToPrev} disabled={currentMoveIndex === 0} className="p-2 rounded-md bg-[#2b2b2c] hover:bg-[#353537] text-[#c7c7c7] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={togglePlay} className="p-2 px-4 rounded-md bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 transition-colors flex items-center justify-center min-w-[56px]">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={goToNext} disabled={currentMoveIndex === history.length - 1} className="p-2 rounded-md bg-[#2b2b2c] hover:bg-[#353537] text-[#c7c7c7] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={goToEnd} disabled={currentMoveIndex === history.length - 1} className="p-2 rounded-md bg-[#2b2b2c] hover:bg-[#353537] text-[#c7c7c7] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>

              <div className="text-[13px] text-[#a8a8aa] mb-2">
                {formattedTitle} - {statusText}
              </div>
              {showMoveFeedback && (
                <div className="text-[12px] text-[#b8e8d0] mb-2">
                  {topSuggestedMove ? `Suggested move: ${topSuggestedMove}` : "No suggestion yet."}
                </div>
              )}
              <button
                onClick={resetBoard}
                className="w-full flex items-center justify-center px-4 py-2.5 bg-[#2f78cf] text-white rounded-md font-semibold text-[13px] hover:bg-[#3f88df] transition-colors"
              >
                Reset Board
              </button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[65%] flex-1 flex flex-row items-start justify-end bg-[var(--bg-alt)] p-8 lg:p-0 lg:pt-6 lg:pr-[70px] relative shadow-[-30px_0_50px_rgba(0,0,0,0.15)] border-l border-[var(--border)]">
          <div className="absolute top-6 right-6 flex flex-col gap-3 z-50">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsBoardFlipped(!isBoardFlipped)}
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
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
          </div>

          {isSettingsOpen && (
            <div 
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setIsSettingsOpen(false)}
            >
              <div 
                className="w-[1050px] max-w-[95vw] h-[720px] max-h-[90vh] bg-[var(--surface-alt)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden flex flex-row relative cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                
                {/* Left Sidebar Menu */}
                <div className="w-[240px] md:w-[260px] bg-[var(--surface)] border-r border-[var(--border)] flex flex-col py-4 overflow-y-auto shrink-0 z-10 custom-scrollbar">
                  <div className="px-5 mb-4">
                    <span className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">Settings</span>
                  </div>
                  <button
                    onClick={() => setActiveSettingsTab("boards")}
                    className={`flex items-center gap-3 px-5 py-3 w-full text-left font-medium border-l-2 transition-colors ${
                      activeSettingsTab === "boards" || activeSettingsTab === "pieces"
                        ? "bg-[var(--surface-alt)] text-emerald-400 border-emerald-500 shadow-[-10px_0_20px_rgba(16,185,129,0.05)]"
                        : "text-[#999] hover:bg-white/5 hover:text-white border-transparent"
                    }`}
                  >
                    <LayoutGrid className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Board & Pieces</span>
                  </button>
                  <button
                    onClick={() => setActiveSettingsTab("engine")}
                    className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${
                      activeSettingsTab === "engine"
                        ? "bg-[var(--surface-alt)] text-emerald-400 font-medium border-emerald-500 shadow-[-10px_0_20px_rgba(16,185,129,0.05)]"
                        : "text-[#999] hover:bg-white/5 hover:text-white border-transparent"
                    }`}
                  >
                    <Gamepad2 className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Engine</span>
                  </button>
                  <button className="flex items-center gap-3 px-5 py-3 w-full text-left text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] transition-colors border-l-2 border-transparent">
                    <User className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Profile</span>
                  </button>
                  <button className="flex items-center gap-3 px-5 py-3 w-full text-left text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] transition-colors border-l-2 border-transparent">
                    <Monitor className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Interface</span>
                  </button>
                  <button className="flex items-center gap-3 px-5 py-3 w-full text-left text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] transition-colors border-l-2 border-transparent">
                    <Users className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Social</span>
                  </button>
                  <button className="flex items-center gap-3 px-5 py-3 w-full text-left text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] transition-colors border-l-2 border-transparent">
                    <GraduationCap className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Coach</span>
                  </button>
                  <button className="flex items-center gap-3 px-5 py-3 w-full text-left text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] transition-colors border-l-2 border-transparent">
                    <Bell className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Notifications</span>
                  </button>
                  <button className="flex items-center gap-3 px-5 py-3 w-full text-left text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] transition-colors border-l-2 border-transparent">
                    <CreditCard className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Membership</span>
                  </button>
                  <button className="flex items-center gap-3 px-5 py-3 w-full text-left text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] transition-colors border-l-2 border-transparent">
                    <Accessibility className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Accessibility</span>
                  </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col relative min-w-0 bg-[#1a1a1a]">
                  {/* Header */}
                  <div className="px-8 pt-6 pb-3 shrink-0">
                  <h2 className="text-[24px] font-bold text-white mb-1 font-sans">
                    {activeSettingsTab === "engine" ? "Engine" : "Board & Pieces"}
                  </h2>
                  <p className="text-[#a1a1aa] text-[14px]">
                    {activeSettingsTab === "engine"
                      ? "Configure analysis engine options and line depth."
                      : "Customize the look and feel of your chess set."}
                  </p>
                  {preferencesLoading && (
                    <p className="text-[#8f8f8f] text-[12px] mt-2">Loading saved preferences...</p>
                  )}
                  {preferencesError && (
                    <p className="text-red-300 text-[12px] mt-2">{preferencesError}</p>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-col md:flex-row px-8 pb-8 pt-0 gap-8 h-[650px] max-h-[75vh] w-full">
                  {/* Left Side: Tabs & Grid */}
                  <div className="w-full md:w-[55%] flex flex-col h-full min-h-0">
                    {/* Tabs */}
                    <div className="flex border-b border-[#333] mb-4 shrink-0">
                      <button
                        onClick={() => setActiveSettingsTab("boards")}
                        className={`px-4 py-2 font-semibold text-[14px] transition-colors relative ${activeSettingsTab === "boards" ? "text-emerald-400" : "text-[#888] hover:text-gray-200"}`}
                      >
                        Boards
                        {activeSettingsTab === "boards" && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-emerald-400" />}
                      </button>
                      <button
                        onClick={() => setActiveSettingsTab("pieces")}
                        className={`px-4 py-2 font-semibold text-[14px] transition-colors relative ${activeSettingsTab === "pieces" ? "text-emerald-400" : "text-[#888] hover:text-gray-200"}`}
                      >
                        Pieces
                        {activeSettingsTab === "pieces" && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-emerald-400" />}
                      </button>
                      <button
                        onClick={() => setActiveSettingsTab("engine")}
                        className={`px-4 py-2 font-semibold text-[14px] transition-colors relative ${activeSettingsTab === "engine" ? "text-emerald-400" : "text-[#888] hover:text-gray-200"}`}
                      >
                        Engine
                        {activeSettingsTab === "engine" && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-emerald-400" />}
                      </button>
                    </div>

                    {/* Grid Selection */}
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
                                <div className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${isSelected ? "border-emerald-500 scale-[1.05] shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "border-transparent group-hover:border-white/20"}`}>
                                  <BoardThumbnail src={bgImage} className="w-full h-full" />
                                  {isSelected && (
                                    <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center z-20">
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                  )}
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider font-bold truncate px-1 transition-colors ${isSelected ? "text-emerald-400" : "text-[#666] group-hover:text-gray-400"}`}>
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
                                <div className={`relative aspect-square rounded-lg border-2 bg-black/40 flex items-center justify-center transition-all p-2 ${isSelected ? "border-emerald-500 bg-black/60 scale-[1.05] shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "border-transparent group-hover:border-white/20 group-hover:bg-black/50"}`}>
                                  <PieceThumbnail src={knightSrc} alt={theme} />
                                  {isSelected && (
                                    <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center z-10">
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                  )}
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider font-bold truncate px-1 transition-colors ${isSelected ? "text-emerald-400" : "text-[#666] group-hover:text-gray-400"}`}>
                                  {theme.replace(/_/g, " ")}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {activeSettingsTab === "engine" && (
                        <div className="px-2 py-2 space-y-4 text-[#d4d4d4]">
                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[#8c8c8c]">Strength</label>
                            <select
                              value={analysisStrength}
                              onChange={(event) => setAnalysisStrength(event.target.value as AnalysisStrength)}
                              className="w-full bg-[#242424] border border-[#3a3a3a] rounded-md px-3 py-2 text-[14px] text-white"
                            >
                              <option value="fast">Fast (~1 sec, 3270 Rating)</option>
                              <option value="standard">Standard (~5 sec, 3430 Rating)</option>
                              <option value="deep">Deep (~20 sec, 3500 Rating)</option>
                              <option value="maximum">Maximum (~1 min 30 sec, 3560 Rating)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[#8c8c8c]">Analysis Engine</label>
                            <select
                              value={analysisEngineChoice}
                              onChange={(event) => setAnalysisEngineChoice(event.target.value as AnalysisEngineChoice)}
                              className="w-full bg-[#242424] border border-[#3a3a3a] rounded-md px-3 py-2 text-[14px] text-white"
                            >
                              <option value="stockfish-18">Stockfish 18 (108MB download)</option>
                              <option value="stockfish-18-lite">Stockfish 18 Lite (7MB download)</option>
                              <option value="torch-4">Torch 4 (73MB download)</option>
                              <option value="torch-4-lite">Torch 4 Lite (6MB download)</option>
                              <option value="off">Engine Off</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[#8c8c8c]">Number of Lines</label>
                            <select
                              value={analysisMultiPv}
                              onChange={(event) => setAnalysisMultiPv(Number(event.target.value))}
                              className="w-full bg-[#242424] border border-[#3a3a3a] rounded-md px-3 py-2 text-[14px] text-white"
                            >
                              <option value={1}>1</option>
                              <option value={2}>2</option>
                              <option value={3}>3</option>
                              <option value={4}>4</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[#8c8c8c]">Maximum Time (sec)</label>
                            <input
                              type="number"
                              min={1}
                              max={180}
                              value={analysisMaxTimeSeconds}
                              onChange={(event) => setAnalysisMaxTimeSeconds(Math.max(1, Number(event.target.value) || 1))}
                              className="w-full bg-[#242424] border border-[#3a3a3a] rounded-md px-3 py-2 text-[14px] text-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[12px] uppercase tracking-wide text-[#8c8c8c]">Threads</label>
                            <input
                              type="number"
                              min={1}
                              max={1}
                              value={analysisThreads}
                              onChange={(event) => setAnalysisThreads(Math.max(1, Number(event.target.value) || 1))}
                              disabled
                              className="w-full bg-[#242424] border border-[#3a3a3a] rounded-md px-3 py-2 text-[14px] text-[#8a8a8a] cursor-not-allowed"
                            />
                          </div>

                          <div className="rounded-md border border-[#323234] bg-[#202022] px-3 py-2 text-[12px] text-[#a5a5a8]">
                            {analysisEngineChoice === "torch-4" || analysisEngineChoice === "torch-4-lite"
                              ? torchLoading
                                ? "Checking Torch runtime..."
                                : torchStatus.ok
                                  ? torchStatus.model_present
                                    ? "Torch runtime detected. Until a Torch inference backend is wired, analysis still runs through Stockfish."
                                    : "Torch runtime detected but model file is missing. Analysis still runs through Stockfish."
                                  : "Torch runtime unavailable. Analysis runs through Stockfish."
                              : "Stockfish engine is used for live analysis in this build."}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Preview */}
                  <div className="w-full md:w-[45%] flex flex-col items-center justify-start rounded-xl p-0 relative shrink-0">
                    <div className="w-full aspect-square relative shadow-2xl rounded-sm overflow-hidden border border-[var(--border)]">
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
                    
                    {/* Sounds Toggle */}
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
                        <div className="w-11 h-6 bg-[var(--skeleton)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-muted)] after:border-[var(--border)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white group-hover:after:scale-[1.05]"></div>
                        <span className="ml-3 text-[14px] text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)] transition-colors">Enable Sounds</span>
                      </label>
                    </div>
                  </div>
                </div>

                  {/* Footer / Actions */}
                  <div className="mt-auto bg-[#1f1f1f] px-8 py-5 flex items-center justify-end border-t border-white/5 w-full shrink-0">
                    <button 
                      onClick={() => {
                        savePreferences().catch(() => {});
                      }}
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

          <div className="flex items-stretch h-[85vh] max-h-[820px] aspect-[1/0.95] max-w-[85%] justify-end">
            {showEvaluationBar && (
              <div className="w-[25px] md:w-[30px] mr-[12px] md:mr-[24px] bg-[#333333] rounded overflow-hidden flex flex-col relative h-[100%] shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                <div
                  className="w-full bg-[#202020] transition-[height] duration-300 relative"
                  style={{ height: `${100 - analysis.whiteWinChance}%` }}
                >
                  <div className="absolute inset-0 bg-white/5 animate-pulse" />
                </div>
                <div
                  className="w-full bg-white relative shadow-[0_-2px_10px_rgba(255,255,255,0.6)] flex flex-col justify-end pb-1.5 border-t border-[#666] transition-[height] duration-300"
                  style={{ height: `${analysis.whiteWinChance}%` }}
                >
                  <span className="text-center text-[11px] md:text-[13px] font-[700] text-black">
                    {isEngineEnabled ? analysis.evaluationText : "OFF"}
                  </span>
                </div>
              </div>
            )}

            <div
              className="h-full aspect-square relative overflow-hidden"
            >
              <BoardImage src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`} className="w-full h-full">
                <div className="w-full h-full grid grid-cols-8 grid-rows-8 relative">
                  {(isBoardFlipped
                    ? [...boardState].reverse().map(r => [...r].reverse())
                    : boardState
                  ).map((row, visRowIndex) =>
                  row.map((piece, visColIndex) => {
                    // When flipped, visual row 0 = logical row 7, etc.
                    const logicalRow = isBoardFlipped ? 7 - visRowIndex : visRowIndex;
                    const logicalCol = isBoardFlipped ? 7 - visColIndex : visColIndex;
                    const square = toSquare(logicalRow, logicalCol);
                    const squarePiece = game.get(square);
                    const isLightSquare = (logicalRow + logicalCol) % 2 === 0;
                    const isLegalTarget = legalTargets.includes(square);
                    const isLastMoveSquare =
                      lastMove?.from === square || lastMove?.to === square;
                    const isDraggedSquare = draggedSquare === square;
                    const isKingInCheck = game.isCheck() && squarePiece?.type === 'k' && squarePiece?.color === game.turn();

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
                        className="relative flex items-center justify-center cursor-pointer"
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
                          <span
                            className={`absolute top-0.5 left-1 text-[13px] font-[700] ${isLightSquare ? "text-[#b07b46]" : "text-[#e6ca9a]"} select-none`}
                          >
                            {8 - logicalRow}
                          </span>
                        )}

                        {visRowIndex === 7 && (
                          <span
                            className={`absolute bottom-0 right-1 text-[13px] font-[700] ${isLightSquare ? "text-[#b07b46]" : "text-[#e6ca9a]"} select-none`}
                          >
                            {FILES[logicalCol]}
                          </span>
                        )}

                        <div
                          draggable={Boolean(squarePiece && squarePiece.color === game.turn())}
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
                {suggestionStart && suggestionEnd && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                    <defs>
                      <marker id="suggestion-arrow-head" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L6,3 z" fill="#22d3ee" />
                      </marker>
                    </defs>
                    <line
                      x1={`${suggestionStart.x}%`}
                      y1={`${suggestionStart.y}%`}
                      x2={`${suggestionEnd.x}%`}
                      y2={`${suggestionEnd.y}%`}
                      stroke="#22d3ee"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      markerEnd="url(#suggestion-arrow-head)"
                      opacity="0.85"
                    />
                  </svg>
                )}
              </BoardImage>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
