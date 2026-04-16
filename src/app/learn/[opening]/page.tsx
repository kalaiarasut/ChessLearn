"use client";

import type { DragEvent } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowLeft, Settings, Play, Pause, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Monitor, User, Gamepad2, MessageSquare, GraduationCap, Bell, CreditCard, Accessibility, LayoutGrid, Users, Sun, Moon } from "lucide-react";
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

export default function OpeningPage() {
  const pathname = usePathname();
  const title = pathname.split("/").pop()?.replace(/-/g, " ") || "Opening";
  const formattedTitle = formatOpeningTitle(title);

  const [boardTheme, setBoardTheme] = useState(themeManifest.defaultBoardTheme);
  const [pieceTheme, setPieceTheme] = useState(themeManifest.defaultPieceTheme);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"boards" | "pieces">("boards");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fen, setFen] = useState(DEFAULT_FEN);
  const [history, setHistory] = useState<string[]>([DEFAULT_FEN]);
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
  const moveCount = game.history().length;
  const statusText = getPositionStatus(game);
  const analysis = useStockfishAnalysis(fen, true, 13, 3);
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

  const playSound = (name: string) => {
    if (!soundEnabled) {
      return;
    }

    new Audio(`/sounds/${name}.mp3`).play().catch(() => {});
  };

  const resetBoard = () => {
    setFen(DEFAULT_FEN);
    setHistory([DEFAULT_FEN]);
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
      setHistory(nextHistory);
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
        <div className="w-full lg:w-[35%] flex flex-col items-center justify-center p-10 bg-[var(--bg)] relative z-10 shrink-0">
          <div className="w-full max-w-[420px] bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-blue-500 to-emerald-400" />
            <h1 className="text-[32px] font-serif text-[var(--text-primary)] font-[500] leading-tight mb-2 tracking-tight">
              {formattedTitle}
            </h1>
            <div className="bg-[var(--badge-bg)] rounded-md py-2 px-3 mb-6 font-mono text-[13px] font-bold text-[var(--text-secondary)] border border-[var(--badge-ring)] inline-flex shadow-inner">
              {lastMove ? `Last move ${lastMove.san}` : "Interactive analysis board"}
            </div>

            <p className="text-[var(--text-muted)] text-[15px] leading-relaxed mb-8">
              Click a piece and then a highlighted target square, or drag pieces directly on the
              board. Legal moves, turn order, captures, castling, check, and promotion are all
              enforced now.
            </p>

            <div className="flex items-center justify-center gap-2 mb-6 w-full">
              <button onClick={goToStart} disabled={currentMoveIndex === 0} className="p-2.5 rounded-lg bg-[var(--skeleton)] hover:bg-[var(--border)] text-[var(--text-muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button onClick={goToPrev} disabled={currentMoveIndex === 0} className="p-2.5 rounded-lg bg-[var(--skeleton)] hover:bg-[var(--border)] text-[var(--text-muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <button onClick={togglePlay} className="p-2.5 px-4 rounded-lg bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50 transition-colors flex items-center justify-center min-w-[60px]">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button onClick={goToNext} disabled={currentMoveIndex === history.length - 1} className="p-2.5 rounded-lg bg-[var(--skeleton)] hover:bg-[var(--border)] text-[var(--text-muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={goToEnd} disabled={currentMoveIndex === history.length - 1} className="p-2.5 rounded-lg bg-[var(--skeleton)] hover:bg-[var(--border)] text-[var(--text-muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>


            <button
              onClick={resetBoard}
              className="w-full flex items-center justify-center px-6 py-4 bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-lg font-bold text-[15px] hover:bg-[var(--cta-hover)] transition-colors shadow-lg"
            >
              Reset Board <span className="ml-2">&rarr;</span>
            </button>
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
                  <button className="flex items-center gap-3 px-5 py-3 w-full text-left bg-[var(--surface-alt)] text-emerald-400 font-medium border-l-2 border-emerald-500 shadow-[-10px_0_20px_rgba(16,185,129,0.05)]">
                    <LayoutGrid className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Board & Pieces</span>
                  </button>
                  <button className="flex items-center gap-3 px-5 py-3 w-full text-left text-[#999] hover:bg-white/5 hover:text-white transition-colors border-l-2 border-transparent">
                    <Gamepad2 className="w-[18px] h-[18px]" />
                    <span className="text-[14px]">Gameplay</span>
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
                    Board & Pieces
                  </h2>
                  <p className="text-[#a1a1aa] text-[14px]">
                    Customize the look and feel of your chess set.
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
                  {analysis.evaluationText}
                </span>
              </div>
            </div>

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
                    const isSelectedSquare = selectedSquare === square;
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
              </BoardImage>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
