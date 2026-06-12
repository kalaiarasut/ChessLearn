"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/ui/Navbar";
import { Chess, type Square } from "chess.js";
import { 
  Rocket, Zap, Clock, Sun, Settings, ArrowLeft, Moon, LayoutGrid, Users, Handshake, Bot, Info, ChevronDown, ChevronUp
} from "lucide-react";
import themeManifest from "@/data/themeManifest.json";
import { useTheme } from "@/lib/theme-context";
import { SettingsModalLayout, BoardPiecesSettingsTab } from "@/components/settings-layout";
import PlayersTab from "@/components/ui/PlayersTab";
import { Tooltip } from "@/components/ui/Tooltip";
import Link from "next/link";
import { generateChess960BackRank } from "../computer/page";
import { useSearchParams, useRouter } from "next/navigation";
import { useRealtimeMatch } from "@/hooks/useRealtimeMatch";
import { findOrCreateMatch, createFriendMatch, joinFriendMatch, syncGameState } from "@/app/actions/match";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const VARIANTS = [
  { id: "chess960", label: "Chess960", desc: "Randomized back rank starting position." },
  { id: "kingOfTheHill", label: "King of the Hill", desc: "Bring your king to the center squares (d4, d5, e4, e5) to win." },
  { id: "crazyhouse", label: "Crazyhouse", desc: "Captured pieces can be dropped back onto the board." },
  { id: "3check", label: "3-Check", desc: "Check the opponent's king 3 times to win." },
  { id: "atomic", label: "Atomic", desc: "Captures cause explosions that destroy surrounding pieces." },
  { id: "horde", label: "Horde", desc: "Black has a normal army, White has 36 pawns." },
  { id: "racingKings", label: "Racing Kings", desc: "Race your king to the 8th rank to win." },
];

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const AVAILABLE_BOARD_THEMES = themeManifest.boardThemes;
const AVAILABLE_PIECE_THEMES = themeManifest.pieceThemes;
const BOARD_THEME_ASSETS = themeManifest.boardAssets as Record<string, string>;
const PIECE_THEME_ASSETS = themeManifest.pieceAssets as Record<string, string>;

const toSquare = (rowIndex: number, columnIndex: number) =>
  `${FILES[columnIndex]}${8 - rowIndex}` as Square;

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

const getPieceIcon = (code: string | null, pieceTheme: string) => {
  if (!code) return null;
  return (
    <PieceImage
      src={`${PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`}/${code}.png`}
      alt={code}
    />
  );
};

type TimeControlItem = {
  id: string;
  label: string;
  expandedOnly?: boolean;
};

type TimeControlCategory = {
  category: string;
  icon: React.ElementType;
  iconColor: string;
  hasInfo?: boolean;
  items: TimeControlItem[];
};

const TIME_CONTROLS: TimeControlCategory[] = [
  {
    category: "Bullet",
    icon: Rocket,
    iconColor: "text-[#D4A373] dark:text-[#E6B981]",
    items: [
      { id: "1min", label: "1 min" },
      { id: "1|1", label: "1 | 1" },
      { id: "2|1", label: "2 | 1" },
      { id: "30s", label: "30 sec", expandedOnly: true },
      { id: "20s", label: "20 sec ...", expandedOnly: true },
    ]
  },
  {
    category: "Blitz",
    icon: Zap,
    iconColor: "text-yellow-400",
    items: [
      { id: "3min", label: "3 min" },
      { id: "3|2", label: "3 | 2" },
      { id: "5min", label: "5 min" },
      { id: "5|5", label: "5 | 5", expandedOnly: true },
      { id: "5|2", label: "5 | 2", expandedOnly: true },
    ]
  },
  {
    category: "Rapid",
    icon: Clock,
    iconColor: "text-[#81B64C]",
    items: [
      { id: "10min", label: "10 min" },
      { id: "15|10", label: "15 | 10" },
      { id: "30min", label: "30 min" },
      { id: "10|5", label: "10 | 5", expandedOnly: true },
      { id: "20min", label: "20 min", expandedOnly: true },
      { id: "60min", label: "60 min", expandedOnly: true },
    ]
  },
  {
    category: "Daily",
    icon: Sun,
    iconColor: "text-yellow-500",
    hasInfo: true,
    items: [
      { id: "1d", label: "1 day" },
      { id: "3d", label: "3 days" },
      { id: "7d", label: "7 days" },
      { id: "2d", label: "2 days", expandedOnly: true },
      { id: "5d", label: "5 days", expandedOnly: true },
      { id: "14d", label: "14 days", expandedOnly: true },
    ]
  }
];

export default function PlayOnlinePage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">Loading...</div>}>
      <PlayOnlineContent />
    </React.Suspense>
  );
}

function PlayOnlineContent() {
  const { isDark, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();
  const matchId = searchParams.get("matchId");
  
  const [userId, setUserId] = useState<string | null>(null);
  
  useEffect(() => {
    createSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      if (!data.user) {
        const currentUrl = window.location.pathname + window.location.search;
        router.push(`/login?next=${encodeURIComponent(currentUrl)}`);
      } else {
        setUserId(data.user.id);
      }
    });
  }, [router]);

  const { gameState, isLoading: isMatchLoading, error: matchError, sendMove } = useRealtimeMatch(matchId);
  const [isSearching, setIsSearching] = useState(false);

  // Auto-join invite matches if we're not the creator
  useEffect(() => {
    if (matchId && gameState.status === "invite_only" && userId && gameState.whitePlayerId !== userId && gameState.blackPlayerId !== userId) {
      joinFriendMatch(matchId).catch(console.error);
    }
  }, [matchId, gameState.status, userId, gameState.whitePlayerId, gameState.blackPlayerId]);

  // Board State
  const [game, setGame] = useState(new Chess());
  const [boardState, setBoardState] = useState<(string | null)[][]>(() => {
    const g = new Chess();
    return g.board().map(row => row.map(p => p ? `${p.color}${p.type}` : null));
  });

  // Sync network state to local board
  useEffect(() => {
    if (gameState.pgn && gameState.pgn !== game.pgn()) {
      try {
        const newGame = new Chess();
        newGame.loadPgn(gameState.pgn);
        setGame(newGame);
        setBoardState(newGame.board().map(row => row.map(p => p ? `${p.color}${p.type}` : null)));
      } catch (e) { console.error("Invalid incoming PGN", e); }
    }
  }, [gameState.pgn, game]);
  
  const [isBoardFlipped, setIsBoardFlipped] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [draggedSquare, setDraggedSquare] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [displayLastMove, setDisplayLastMove] = useState<{from: string, to: string} | null>(null);

  // Settings & Preferences
  const [boardTheme, setBoardTheme] = useState(themeManifest.defaultBoardTheme || "green");
  const [pieceTheme, setPieceTheme] = useState(themeManifest.defaultPieceTheme || "neo");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"boards" | "pieces">("boards");
  
  const [activeTab, setActiveTab] = useState<"new_game" | "games" | "players">(
    (searchParams.get("tab") as any) || "new_game"
  );
  const [selectedTimeControl, setSelectedTimeControl] = useState("10min");
  const [showMoreControls, setShowMoreControls] = useState(false);
  const [isRated, setIsRated] = useState(true);

  // Variant Preview State
  const [previewVariant, setPreviewVariant] = useState<string | null>(null);
  const [previewBoardState, setPreviewBoardState] = useState<(string | null)[][] | null>(null);

  useEffect(() => {
    if (!previewVariant) {
      setPreviewBoardState(null);
      return;
    }

    const parseFenToBoard = (fen: string): (string | null)[][] => {
      const [boardPart] = fen.split(" ");
      return boardPart.split("/").map(row => {
        const parsedRow: (string | null)[] = [];
        for (const char of row) {
          if (!isNaN(parseInt(char))) {
            for (let i = 0; i < parseInt(char); i++) parsedRow.push(null);
          } else {
            const color = char === char.toLowerCase() ? 'b' : 'w';
            const type = char.toLowerCase();
            parsedRow.push(`${color}${type}`);
          }
        }
        return parsedRow;
      });
    };

    let initialBoard: (string | null)[][];
    const FEN_SETUPS: Record<string, string> = {
      horde: "rnbqkbnr/pppppppp/8/1PP5/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP w kq - 0 1",
      racingKings: "8/8/8/8/8/8/krbnNBRK/qrbnNBRQ w - - 0 1",
      kingOfTheHill: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      crazyhouse: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "3check": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      atomic: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    };

    if (previewVariant === "chess960") {
      const whiteBackRank = generateChess960BackRank();
      const blackBackRank = whiteBackRank.toLowerCase();
      initialBoard = Array(8).fill(null).map(() => Array(8).fill(null));
      for (let i = 0; i < 8; i++) initialBoard[0][i] = `b${blackBackRank[i]}`;
      for (let i = 0; i < 8; i++) initialBoard[1][i] = `bp`;
      for (let i = 0; i < 8; i++) initialBoard[6][i] = `wp`;
      for (let i = 0; i < 8; i++) initialBoard[7][i] = `w${whiteBackRank[i]}`;
    } else {
      initialBoard = parseFenToBoard(FEN_SETUPS[previewVariant] || FEN_SETUPS.kingOfTheHill);
    }

    setPreviewBoardState(initialBoard);

    // Simple Walkthrough Animation Loop
    let moveIndex = 0;
    const interval = setInterval(() => {
      setPreviewBoardState(prev => {
        if (!prev) return prev;

        if (previewVariant === "chess960") {
          const whiteBackRank = generateChess960BackRank();
          const blackBackRank = whiteBackRank.toLowerCase();
          const newBoard = Array(8).fill(null).map(() => Array(8).fill(null));
          for (let i = 0; i < 8; i++) newBoard[0][i] = `b${blackBackRank[i]}`;
          for (let i = 0; i < 8; i++) newBoard[1][i] = `bp`;
          for (let i = 0; i < 8; i++) newBoard[6][i] = `wp`;
          for (let i = 0; i < 8; i++) newBoard[7][i] = `w${whiteBackRank[i]}`;
          return newBoard;
        }

        const nextBoard = prev.map(row => [...row]);
        
        // Define accurate move sequences for visualization
        const moves: Record<string, {from: [number, number] | string, to: [number, number]}[]> = {
          horde: [
            {from: [4, 4], to: [3, 4]}, // e4-e5
            {from: [0, 1], to: [2, 2]}, // Nc6
            {from: [4, 3], to: [3, 3]}, // d4-d5
            {from: [2, 2], to: [3, 4]}  // Nxe5
          ],
          racingKings: [
            {from: [6, 7], to: [5, 6]}, // Kh2-g3
            {from: [6, 0], to: [5, 1]}, // Ka2-b3
            {from: [5, 6], to: [4, 5]}, // Kg3-f4
            {from: [5, 1], to: [4, 2]}  // Kb3-c4
          ],
          kingOfTheHill: [
            {from: [6, 4], to: [4, 4]}, // e4
            {from: [1, 4], to: [3, 4]}, // e5
            {from: [7, 4], to: [6, 4]}, // Ke2
            {from: [0, 4], to: [1, 4]}, // Ke7
            {from: [6, 4], to: [5, 3]}, // Kd3
            {from: [1, 4], to: [2, 3]}, // Kd6
            {from: [5, 3], to: [4, 3]}  // Kd4 (White reaches center!)
          ],
          crazyhouse: [
            {from: [6, 4], to: [4, 4]}, // e4
            {from: [1, 3], to: [3, 3]}, // d5
            {from: [4, 4], to: [3, 3]}, // exd5
            {from: "drop_bp", to: [4, 4]} // P@e4
          ],
          "3check": [
            {from: [6, 4], to: [4, 4]}, // e4
            {from: [1, 4], to: [2, 4]}, // e6
            {from: [7, 5], to: [3, 1]}, // Bb5+ (1st)
            {from: [1, 2], to: [2, 2]}, // c6
            {from: [3, 1], to: [4, 2]}, // Ba4
            {from: [1, 3], to: [3, 3]}, // d5
            {from: [4, 2], to: [3, 1]}, // Bb5+ (2nd)
            {from: [0, 1], to: [2, 2]}, // Nc6
            {from: [3, 1], to: [2, 2]}  // Bxc6+ (3rd!)
          ],
          atomic: [
            {from: [6, 4], to: [4, 4]}, // e4
            {from: [1, 5], to: [2, 5]}, // f6
            {from: [7, 6], to: [5, 5]}, // Nf3
            {from: [1, 4], to: [2, 4]}, // e6
            {from: [5, 5], to: [3, 4]}, // Ne5
            {from: [0, 6], to: [1, 4]}, // Ne7
            {from: [3, 4], to: [1, 5]}  // Nxf7 (Boom!)
          ]
        };

        const sequence = moves[previewVariant] || moves.kingOfTheHill;
        
        if (moveIndex >= sequence.length) {
          // Reset after sequence
          moveIndex = 0;
          return initialBoard;
        }

        const move = sequence[moveIndex];
        
        if (typeof move.from === "string") {
           // Handle Crazyhouse piece drops
           const [color, type] = move.from.replace("drop_", "").split("");
           nextBoard[move.to[0]][move.to[1]] = move.from.replace("drop_", "");
        } else {
           nextBoard[move.to[0]][move.to[1]] = nextBoard[move.from[0]][move.from[1]];
           nextBoard[move.from[0]][move.from[1]] = null;
        }

        // Atomic explosion simulation
        if (previewVariant === "atomic" && moveIndex === sequence.length - 1) {
           const [r, c] = move.to;
           for (let dr = -1; dr <= 1; dr++) {
             for (let dc = -1; dc <= 1; dc++) {
               if (r+dr >= 0 && r+dr <= 7 && c+dc >= 0 && c+dc <= 7) {
                 nextBoard[r+dr][c+dc] = null;
               }
             }
           }
        }

        moveIndex++;
        return nextBoard;
      });
    }, previewVariant === "chess960" ? 1500 : 1200);

    return () => clearInterval(interval);
  }, [previewVariant]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ChessThemeSettings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.boardTheme) setBoardTheme(parsed.boardTheme);
        if (parsed.pieceTheme) setPieceTheme(parsed.pieceTheme);
        if (typeof parsed.soundEnabled === "boolean") setSoundEnabled(parsed.soundEnabled);
      }
    } catch (e) {}
  }, []);

  const saveSettings = (updates: { boardTheme?: string, pieceTheme?: string, soundEnabled?: boolean }) => {
    try {
      const stored = localStorage.getItem("ChessThemeSettings");
      const current = stored ? JSON.parse(stored) : {};
      localStorage.setItem("ChessThemeSettings", JSON.stringify({ ...current, ...updates }));
    } catch (e) {}
  };

  const handleBoardThemeChange = (theme: string) => {
    setBoardTheme(theme);
    saveSettings({ boardTheme: theme });
  };

  const handlePieceThemeChange = (theme: string) => {
    setPieceTheme(theme);
    saveSettings({ pieceTheme: theme });
  };

  const handleSoundEnabledChange = (enabled: boolean) => {
    setSoundEnabled(enabled);
    saveSettings({ soundEnabled: enabled });
  };

  const updateBoard = (g: Chess) => {
    setBoardState(g.board().map(row => row.map(p => p ? `${p.color}${p.type}` : null)));
  };

  const makeMove = (from: Square, to: Square) => {
    try {
      const moves = game.moves({ verbose: true });
      const move = moves.find(m => m.from === from && m.to === to);
      
      if (move) {
        // Auto-promote to Queen for simplicity
        const moveResult = game.move({ from, to, promotion: 'q' });
        if (moveResult) {
          updateBoard(game);
          setDisplayLastMove({ from, to });
          setSelectedSquare(null);
          setLegalTargets([]);
          if (soundEnabled) {
            // In a real app we'd play audio here
          }
          if (matchId) {
            const pgn = game.pgn();
            sendMove(pgn);
            const isGameOver = game.isGameOver();
            let winnerId = null;
            if (isGameOver && !game.isDraw()) {
              winnerId = game.turn() === 'b' ? gameState.whitePlayerId : gameState.blackPlayerId;
            }
            syncGameState(matchId, pgn, isGameOver ? 'finished' : 'in_progress', winnerId);
          }
        }
      }
    } catch (e) {
      // Invalid move
    }
  };

  const isMyTurn = () => {
    if (!matchId) return true; // Local play allows both sides
    if (gameState.status !== "in_progress") return false;
    if (game.turn() === 'w' && userId !== gameState.whitePlayerId) return false;
    if (game.turn() === 'b' && userId !== gameState.blackPlayerId) return false;
    return true;
  };

  const handleSquareClick = (square: Square) => {
    if (!isMyTurn()) return;

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalTargets([]);
      return;
    }

    if (selectedSquare && legalTargets.includes(square)) {
      makeMove(selectedSquare, square);
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setLegalTargets(moves.map(m => m.to as Square));
    } else {
      setSelectedSquare(null);
      setLegalTargets([]);
    }
  };

  const handleDragStart = (e: React.DragEvent, square: Square) => {
    if (!isMyTurn()) {
      e.preventDefault();
      return;
    }
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setDraggedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setLegalTargets(moves.map(m => m.to as Square));
      
      // Create empty drag image
      const dragImg = new Image(0, 0);
      dragImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      e.dataTransfer.setDragImage(dragImg, 0, 0);
    } else {
      e.preventDefault();
    }
  };

  const handleDrop = (e: React.DragEvent, square: Square) => {
    if (draggedSquare) {
      if (legalTargets.includes(square)) {
        makeMove(draggedSquare, square);
      }
    }
    setDraggedSquare(null);
    setSelectedSquare(null);
    setLegalTargets([]);
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] transition-colors duration-300 font-sans flex flex-col items-center overflow-x-hidden">
      <Navbar />
      
      <div className="flex-1 w-full max-w-[1536px] flex flex-col lg:flex-row items-stretch lg:items-start justify-center pt-24 pb-12 px-4 gap-6">
        
        {/* Left Side: The Board */}
        <div className="w-full lg:w-[65%] flex-1 flex flex-col items-center lg:items-start justify-center lg:justify-end bg-[var(--bg-alt)] p-2 sm:p-4 lg:p-0 relative rounded-2xl border lg:border-none border-[var(--border)] lg:bg-transparent">
          <div className={`flex flex-col items-center justify-start max-w-[100%] sm:max-w-[95%] lg:max-w-[70%] lg:min-w-[500px] w-full relative shrink-0 lg:ml-auto lg:mr-16 lg:mt-12 h-[75vh] max-h-[640px]`}>
            
            <div className="w-full lg:w-auto flex justify-end lg:absolute lg:-top-2 lg:-right-[52px] flex-row lg:flex-col gap-2 sm:gap-3 z-50 mb-2 lg:mb-0 px-1 lg:px-0 items-center">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsBoardFlipped((current) => !current)}
                className="p-2.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)] shadow-lg flex items-center justify-center flex-col gap-[2px]"
                title="Flip Board"
              >
                <ArrowLeft className="w-[14px] h-[14px] -ml-1" />
                <ArrowLeft className="w-[14px] h-[14px] -mr-1 rotate-180" />
              </button>
            </div>

            <div className="w-full h-full flex flex-col justify-center gap-1 md:gap-3 relative">
              
              {/* Opponent Top Panel Placeholder Removed */}

              <div className="flex-1 aspect-square relative shrink-0">
                <BoardImage
                  src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`}
                  className="w-full h-full shadow-[0_15px_35px_rgba(0,0,0,0.15)] rounded-sm overflow-hidden border border-[var(--border)]"
                >
                  <div className="w-full h-full grid grid-cols-8 grid-rows-8 relative" onContextMenu={(e) => e.preventDefault()}>
                    {(isBoardFlipped
                      ? [...(previewBoardState || boardState)].reverse().map(r => [...r].reverse())
                      : (previewBoardState || boardState)
                    ).map((row, visRowIndex) =>
                      row.map((pieceCode, visColIndex) => {
                        const logicalRow = isBoardFlipped ? 7 - visRowIndex : visRowIndex;
                        const logicalCol = isBoardFlipped ? 7 - visColIndex : visColIndex;
                        const square = toSquare(logicalRow, logicalCol);
                        
                        const isLightSquare = (logicalRow + logicalCol) % 2 === 0;
                        const isSelectedSquare = selectedSquare === square;
                        const isLegalTarget = legalTargets.includes(square);
                        const isLastMoveSquare = displayLastMove?.from === square || displayLastMove?.to === square;
                        const isDraggedSquare = draggedSquare === square;

                        return (
                          <div
                            key={square}
                            onClick={() => handleSquareClick(square)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, square)}
                            className="relative flex items-center justify-center cursor-pointer"
                          >
                            {isLastMoveSquare && (
                              <div className="absolute inset-[4%] rounded-[4px] bg-amber-300/30" />
                            )}
                            {isSelectedSquare && (
                              <div className="absolute inset-[6%] rounded-[4px] ring-[3px] ring-white/95 bg-white/12 z-[6] shadow-[0_0_14px_rgba(255,255,255,0.45)]" />
                            )}
                            {isLegalTarget && (
                              <div
                                className={
                                  pieceCode
                                    ? "absolute inset-[10%] rounded-full border-[6px] border-black/20 dark:border-white/40"
                                    : "absolute h-[25%] w-[25%] rounded-full bg-black/20 dark:bg-white/45 shadow-[0_0_10px_rgba(0,0,0,0.15)] dark:shadow-[0_0_10px_rgba(255,255,255,0.35)]"
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
                              draggable={Boolean(pieceCode)}
                              onDragStart={(e) => handleDragStart(e, square)}
                              onDragEnd={() => setDraggedSquare(null)}
                              className={`relative z-10 h-full w-full p-[2.75%] ${isDraggedSquare ? "opacity-30" : "opacity-100"}`}
                            >
                              {getPieceIcon(pieceCode, pieceTheme)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </BoardImage>
              </div>

              {/* Player Bottom Panel Placeholder Removed */}

            </div>
          </div>
        </div>

        {/* Right Side: Matchmaking Hub */}
        <div className="w-full lg:w-[650px] bg-[var(--surface-alt)] lg:bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl flex flex-col overflow-hidden shrink-0 mt-4 lg:mt-0">
          
          {/* Header Tabs */}
          <div className="flex border-b border-[var(--border)] bg-[var(--surface-alt)]">
            <button 
              onClick={() => setActiveTab("new_game")}
              className={`flex-1 py-4 px-6 flex flex-col items-center justify-center transition-colors relative ${activeTab === "new_game" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
            >
              <div className="w-6 h-6 mb-1 rounded border-2 border-current flex items-center justify-center text-[14px] font-bold">+</div>
              <span className="text-xs font-semibold">New Game</span>
              {activeTab === "new_game" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[var(--text-primary)]"></div>}
            </button>
            <button 
              onClick={() => setActiveTab("games")}
              className={`flex-1 py-4 px-6 flex flex-col items-center justify-center transition-colors relative ${activeTab === "games" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
            >
              <LayoutGrid className="w-6 h-6 mb-1 opacity-80" />
              <span className="text-xs font-semibold">Games</span>
              {activeTab === "games" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[var(--text-primary)]"></div>}
            </button>
            <button 
              onClick={() => setActiveTab("players")}
              className={`flex-1 py-4 px-6 flex flex-col items-center justify-center transition-colors relative ${activeTab === "players" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
            >
              <Users className="w-6 h-6 mb-1 opacity-80" />
              <span className="text-xs font-semibold">Players</span>
              {activeTab === "players" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[var(--text-primary)]"></div>}
            </button>
          </div>

          {/* Body Content */}
          <div className="flex flex-col flex-1 overflow-y-auto bg-[var(--bg)] p-4">
            {activeTab === "new_game" && (
              <div className="flex flex-col lg:flex-row h-full gap-4">
                
                {/* Left Column: Match Info OR Time Controls & Play */}
                <div className="flex flex-col flex-1 lg:w-[350px]">
                  {matchId ? (
                    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 mb-4 flex flex-col items-center justify-center flex-1">
                      <div className="w-16 h-16 rounded-full bg-[var(--cta-bg)] flex items-center justify-center mb-4">
                        <Handshake className="w-8 h-8 text-white" />
                      </div>
                      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                        {gameState.status === 'invite_only' ? 'Invite a Friend' : 'Match Found!'}
                      </h2>
                      {gameState.status === 'invite_only' && (
                        <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
                          Share this link with your friend to play:<br/>
                          <span className="font-mono text-[var(--cta-bg)] break-all select-all mt-2 block p-2 bg-[var(--surface-alt)] rounded border border-[var(--border)]">
                            {typeof window !== 'undefined' ? `${window.location.origin}/play/online?matchId=${matchId}` : ''}
                          </span>
                        </p>
                      )}
                      {gameState.status === 'in_progress' && (
                        <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
                          The game has started. Good luck!
                        </p>
                      )}
                      {gameState.status === 'waiting' && (
                        <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
                          Waiting for opponent to join...
                        </p>
                      )}
                      
                      <div className="w-full flex items-center justify-between p-4 bg-[var(--surface-alt)] rounded-lg border border-[var(--border)]">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${gameState.opponentOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {gameState.opponentOnline ? 'Opponent Connected' : 'Opponent Disconnected'}
                          </span>
                        </div>
                      </div>

                      <button 
                        onClick={() => router.push("/play/online")}
                        className="mt-6 text-[var(--text-muted)] hover:text-[var(--text-primary)] font-semibold text-sm transition-colors"
                      >
                        Leave Match
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Time Controls Selector container */}
                  <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 mb-4">
                    
                    {/* Rated Toggle */}
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-[var(--text-primary)] font-bold text-lg">Rated</span>
                      <button 
                        onClick={() => setIsRated(!isRated)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isRated ? 'bg-[var(--cta-bg)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${isRated ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    {/* Categories */}
                    <div className="space-y-6">
                      {TIME_CONTROLS.map((category) => {
                        const Icon = category.icon;
                        const visibleItems = category.items.filter(item => showMoreControls || !item.expandedOnly);
                        
                        return (
                          <div key={category.category} className="flex flex-col">
                            <div className="flex items-center space-x-2 mb-3">
                              <Icon className={`w-4 h-4 ${category.iconColor}`} />
                              <span className="text-[var(--text-primary)] font-bold text-sm tracking-wide">{category.category}</span>
                              {category.hasInfo && <Info className="w-4 h-4 text-[var(--text-muted)] ml-1" />}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {visibleItems.map(item => (
                                <button
                                  key={item.id}
                                  onClick={() => setSelectedTimeControl(item.id)}
                                  className={`py-3 px-1 rounded-lg text-sm font-semibold transition-all border ${
                                    selectedTimeControl === item.id 
                                      ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] border-[var(--cta-bg)] shadow-[0_0_0_1px_var(--cta-bg)]' 
                                      : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* More Time Controls Toggle */}
                    <div className="mt-5 pt-4 flex justify-center">
                      <button 
                        onClick={() => setShowMoreControls(!showMoreControls)}
                        className="flex items-center space-x-1 text-[13px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <span>{showMoreControls ? "Less Time Controls" : "More Time Controls"}</span>
                        {showMoreControls ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Primary Action */}
                  <button 
                    onClick={async () => {
                      if (!userId) return router.push("/login");
                      try {
                        setIsSearching(true);
                        const result = await findOrCreateMatch();
                        if (result.error === "needs_onboarding") {
                          router.push("/onboarding");
                        } else if (result.matchId) {
                          router.push(`/play/online?matchId=${result.matchId}`);
                        }
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsSearching(false);
                      }
                    }}
                    disabled={isSearching || !!matchId}
                    className={`w-full text-white text-[28px] font-[900] py-4 rounded-xl transition-all tracking-wide ${isSearching || matchId ? 'bg-gray-500 cursor-not-allowed opacity-70' : 'bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] shadow-[0_6px_0_var(--cta-shadow)] active:translate-y-[6px] active:shadow-none'}`}
                  >
                    {isSearching ? "Searching..." : matchId ? "In Game" : "Play"}
                  </button>

                  {/* Secondary Actions */}
                  <div className="flex flex-col space-y-3 mt-6">
                    <button 
                      onClick={() => setActiveTab("players")}
                      disabled={!!matchId}
                      className="w-full bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl py-4 flex items-center justify-center space-x-3 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Handshake className="w-5 h-5 text-[#D4A373] dark:text-[#E6B981]" />
                      <span className="text-lg font-bold text-[var(--text-primary)]">Play a Friend</span>
                    </button>
                    
                    <Link href="/play/computer" className="w-full bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl py-4 flex items-center justify-center space-x-3 transition-colors shadow-sm">
                      <Bot className="w-5 h-5 text-[var(--text-muted)]" />
                      <span className="text-lg font-bold text-[var(--text-primary)]">Play Bots</span>
                    </Link>
                  </div>
                    </>
                  )}
                </div>

                {/* Right Column: Custom Challenges */}
                <div className="flex flex-col lg:w-[280px]">
                  <div className="flex flex-col bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl shadow-sm z-10 h-full">
                    <div className="w-full py-4 flex items-center justify-center space-x-3 border-b border-[var(--border)] px-4">
                      <Settings className="w-5 h-5 text-[var(--text-muted)]" />
                      <span className="text-lg font-bold text-[var(--text-primary)] flex-1 text-center">Custom Challenge</span>
                    </div>
                    
                    <div className="p-2 flex flex-col gap-1 bg-[var(--surface)] rounded-b-xl flex-1">
                      {VARIANTS.map(variant => (
                        <div 
                          key={variant.id}
                          onMouseEnter={() => setPreviewVariant(variant.id)}
                          onMouseLeave={() => setPreviewVariant(null)}
                          className="w-full"
                        >
                          <Tooltip content={variant.desc} position="top">
                            <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-[var(--surface-hover)] transition-colors flex items-center group">
                              <div className={`w-1.5 h-1.5 rounded-full bg-[var(--cta-bg)] mr-3 transition-opacity ${previewVariant === variant.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
                              <span className={`text-[15px] font-semibold transition-colors ${previewVariant === variant.id ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"}`}>
                                {variant.label}
                              </span>
                            </button>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            )}
            {activeTab === "players" && (
              <PlayersTab 
                currentUserId={userId} 
                onInviteFriend={async (friend) => {
                  try {
                    // Create an invite-only match
                    const { createFriendMatch } = await import('@/app/actions/match');
                    const result = await createFriendMatch();
                    
                    // Broadcast the invite to the friend's personal channel
                    const supabase = createSupabaseBrowserClient();
                    
                    // Fetch current user's profile to send to friend
                    const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', userId).single();
                    
                    if (myProfile) {
                      const channel = supabase.channel(`invites:${friend.id}`);
                      channel.subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                          channel.send({
                            type: 'broadcast',
                            event: 'game_invite',
                            payload: {
                              inviterId: userId,
                              inviterUsername: myProfile.username,
                              inviterRating: Math.round(myProfile.rating),
                              matchId: result.matchId,
                              timeControl: "10 min" // Defaulting to Rapid for now, could be dynamic
                            }
                          });
                        }
                      });
                    }
                    
                    // Redirect myself to the match
                    router.push(`/play/online?matchId=${result.matchId}`);
                  } catch (err) {
                    console.error("Failed to invite friend", err);
                  }
                }} 
              />
            )}
          </div>
          
        </div>
      </div>

      {/* Settings Modal Component */}
      {isSettingsOpen && (
        <SettingsModalLayout
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          activeTabId="board"
          onTabChange={() => {}}
          loading={false}
          error={null}
          tabs={[
            {
              id: "board",
              icon: <LayoutGrid className="w-[18px] h-[18px]" />,
              label: "Board & Pieces",
              title: "Board & Pieces",
              description: "Customize the look and feel of your chess set.",
              content: (
                <BoardPiecesSettingsTab
                  activeSettingsTab={activeSettingsTab}
                  setActiveSettingsTab={setActiveSettingsTab}
                  boardTheme={boardTheme}
                  pieceTheme={pieceTheme}
                  boardThemes={AVAILABLE_BOARD_THEMES}
                  pieceThemes={AVAILABLE_PIECE_THEMES}
                  boardAssets={BOARD_THEME_ASSETS}
                  pieceAssets={PIECE_THEME_ASSETS}
                  soundEnabled={soundEnabled}
                  onBoardThemeChange={handleBoardThemeChange}
                  onPieceThemeChange={handlePieceThemeChange}
                  onSoundEnabledChange={handleSoundEnabledChange}
                  onPreviewSound={() => {}}
                  boardPreviewNode={
                    <div className="w-full aspect-square relative shadow-xl rounded-sm overflow-hidden border border-[var(--border)]">
                      <BoardImage src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`} className="w-full h-full">
                        <div className="w-full h-full grid grid-cols-3 grid-rows-3 relative">
                          {Array.from({ length: 9 }).map((_, i) => {
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
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </BoardImage>
                    </div>
                  }
                />
              ),
            }
          ]}
        />
      )}

    </main>
  );
}
