"use client";

import type { DragEvent } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowLeft, ChevronDown, Settings } from "lucide-react";
import themeManifest from "@/data/themeManifest.json";
import { useStockfishAnalysis } from "./use-stockfish-analysis";

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

const getPieceIcon = (code: string | null, pieceTheme: string) => {
  if (!code) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`}/${code}.png`}
      alt={code}
      draggable={false}
      className="w-full h-full scale-[1.03] select-none object-contain pointer-events-none drop-shadow-[0_6px_8px_rgba(0,0,0,0.55)]"
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
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [draggedSquare, setDraggedSquare] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<SerializableMove | null>(null);

  const game = new Chess(fen);
  const legalTargets = selectedSquare
    ? game.moves({ square: selectedSquare, verbose: true }).map((move) => move.to)
    : [];
  const boardState = game.board().map((row) => row.map((piece) => getPieceCode(piece)));
  const moveCount = game.history().length;
  const statusText = getPositionStatus(game);
  const analysis = useStockfishAnalysis(fen, true, 13, 3);

  const playSound = (name: string) => {
    if (!soundEnabled) {
      return;
    }

    new Audio(`/sounds/${name}.mp3`).play().catch(() => {});
  };

  const resetBoard = () => {
    setFen(DEFAULT_FEN);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setLastMove(null);
    playSound("game-start");
  };

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

      setFen(nextPosition.fen());
      setSelectedSquare(null);
      setDraggedSquare(null);
      setLastMove(serializedMove);

      if (serializedMove.isCheck) {
        playSound("move-check");
      } else if (serializedMove.isCastle) {
        playSound("castle");
      } else if (serializedMove.isPromotion) {
        playSound("promote");
      } else {
        playSound("move-self");
      }

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

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[#0f0f0f]">
      <header className="w-full px-8 py-5 flex items-center justify-between border-b border-white/5">
        <Link href="/" className="text-[22px] font-serif font-[800] text-white">
          CHESS
        </Link>
        <Link
          href="/learn"
          className="inline-flex items-center text-[#aaaaaa] hover:text-white transition-colors text-[14px] font-medium group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" />
          Back to Learn
        </Link>
      </header>

      <main className="flex-1 w-full flex flex-col lg:flex-row h-[calc(100vh-73px)]">
        <div className="w-full lg:w-[35%] flex flex-col items-center justify-center p-10 bg-[#0f0f0f] relative z-10 shrink-0">
          <div className="w-full max-w-[420px] bg-[#161616] border border-[#2a2a2a] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-blue-500 to-emerald-400" />
            <h1 className="text-[32px] font-serif text-white font-[500] leading-tight mb-2 tracking-tight">
              {formattedTitle}
            </h1>
            <div className="bg-black/60 rounded-md py-2 px-3 mb-6 font-mono text-[13px] font-bold text-[#d0d0d0] border border-white/5 inline-flex shadow-inner">
              {lastMove ? `Last move ${lastMove.san}` : "Interactive analysis board"}
            </div>

            <p className="text-[#999999] text-[15px] leading-relaxed mb-8">
              Click a piece and then a highlighted target square, or drag pieces directly on the
              board. Legal moves, turn order, captures, castling, check, and promotion are all
              enforced now.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-3">
                <div className="text-[#727272] uppercase tracking-[0.18em] text-[11px] mb-1">
                  Turn
                </div>
                <div className="text-white font-semibold">
                  {game.turn() === "w" ? "White" : "Black"}
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-3">
                <div className="text-[#727272] uppercase tracking-[0.18em] text-[11px] mb-1">
                  Moves
                </div>
                <div className="text-white font-semibold">{moveCount}</div>
              </div>
            </div>

            <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-4 mb-8">
              <div className="text-[#727272] uppercase tracking-[0.18em] text-[11px] mb-2">
                Position
              </div>
              <p className="text-white text-[14px] leading-relaxed">{statusText}</p>
            </div>

            <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-4 mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[#727272] uppercase tracking-[0.18em] text-[11px]">
                  Stockfish 18
                </div>
                <div className="text-[11px] font-semibold text-[#8f8f8f]">
                  {analysis.ready
                    ? analysis.analyzing
                      ? `Analyzing d${analysis.depth || "…"}`
                      : `Ready d${analysis.depth || "…"}`
                    : "Loading engine"}
                </div>
              </div>

              <div className="space-y-2">
                {analysis.lines.length > 0 ? (
                  analysis.lines.map((line) => (
                    <div
                      key={line.id}
                      className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-[#8d8d8d]">
                          #{line.id}
                        </span>
                        <span className="font-mono text-[14px] text-white">{line.move}</span>
                      </div>
                      <span className="font-mono text-[13px] font-semibold text-emerald-300">
                        {line.scoreText}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg bg-white/[0.03] px-3 py-3 text-[13px] text-[#8d8d8d]">
                    {analysis.ready ? "Starting analysis…" : "Loading latest engine…"}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={resetBoard}
              className="w-full flex items-center justify-center px-6 py-4 bg-white text-black rounded-lg font-bold text-[15px] hover:bg-gray-200 transition-colors shadow-lg"
            >
              Reset Board <span className="ml-2">&rarr;</span>
            </button>
          </div>
        </div>

        <div className="w-full lg:w-[65%] flex-1 flex flex-row items-center justify-center bg-[#131212] p-8 lg:p-0 relative shadow-[-30px_0_50px_rgba(0,0,0,0.4)] border-l border-[#222]">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="absolute top-6 right-6 p-2.5 rounded-full bg-[#202020] text-gray-400 hover:text-white hover:bg-gray-800 transition-all z-50 border border-white/10 shadow-lg flex items-center gap-2"
          >
            <Settings className="w-5 h-5" />
          </button>

          {isSettingsOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-[800px] max-w-[95vw] bg-[#1a1a1a] rounded-2xl border border-[#333] shadow-2xl overflow-hidden flex flex-col pt-6 relative">
                
                {/* Header */}
                <div className="px-8 pb-4">
                  <h2 className="text-[24px] font-bold text-white mb-1 font-sans">
                    Board & Pieces
                  </h2>
                  <p className="text-[#a1a1aa] text-[14px]">
                    Customize the look and feel of your chess set.
                  </p>
                </div>

                {/* Body */}
                <div className="flex flex-col md:flex-row px-8 pb-8 pt-2 gap-8 min-h-[400px] max-h-[70vh] w-full">
                  {/* Left Side: Tabs & Grid */}
                  <div className="w-full md:w-[55%] flex flex-col h-full overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-[#333] mb-6 shrink-0">
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
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      {activeSettingsTab === "boards" && (
                        <div className="grid grid-cols-4 gap-3 pb-4">
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
                                className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${isSelected ? "border-emerald-500 scale-[1.02]" : "border-transparent hover:border-white/20"}`}
                                style={{ backgroundImage: `url("${bgImage}")`, backgroundSize: "cover" }}
                              >
                                {isSelected && (
                                  <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {activeSettingsTab === "pieces" && (
                        <div className="grid grid-cols-4 gap-3 pb-4">
                          {AVAILABLE_PIECE_THEMES.map((theme) => {
                            const isSelected = pieceTheme === theme;
                            const knightSrc = `${PIECE_THEME_ASSETS[theme] ?? `/pieces/${theme}/150`}/wN.png`;
                            return (
                              <button
                                key={theme}
                                onClick={() => {
                                  setPieceTheme(theme);
                                  playSound("move-self");
                                }}
                                className={`relative aspect-square rounded-lg border-2 bg-black/40 flex items-center justify-center transition-all ${isSelected ? "border-emerald-500 bg-black/60 scale-[1.02]" : "border-transparent hover:border-white/20 hover:bg-black/50"}`}
                              >
                                <img src={knightSrc} alt={theme} className="w-[70%] h-[70%] object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.6)]" draggable={false} />
                                {isSelected && (
                                  <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center z-10">
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Preview */}
                  <div className="w-full md:w-[45%] flex flex-col items-center justify-start rounded-xl p-0 relative shrink-0">
                    <div className="w-full aspect-square relative shadow-2xl rounded-sm overflow-hidden border border-[#111]" style={{ backgroundImage: `url("${BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`}")`, backgroundSize: "100% 100%" }}>
                       <div className="w-full h-full grid grid-cols-3 grid-rows-3 relative">
                         {Array.from({length: 9}).map((_, i) => {
                           const row = Math.floor(i / 3);
                           const col = i % 3;
                           
                           let piece = null;
                           if (row === 0 && col === 0) piece = "bB";
                           if (row === 0 && col === 1) piece = "bQ";
                           if (row === 0 && col === 2) piece = "bP";
                           
                           if (row === 2 && col === 0) piece = "wN";
                           if (row === 2 && col === 1) piece = "wK";
                           if (row === 2 && col === 2) piece = "wR";

                           const isLightSquare = (row + col) % 2 === 0;

                           return (
                             <div key={i} className="flex items-center justify-center relative">
                               {col === 0 && (
                                 <span className={`absolute top-1 left-1.5 text-[14px] font-bold ${isLightSquare ? "text-[#b07b46]" : "text-[#e6ca9a]"} select-none`}>
                                   {8 - row}
                                 </span>
                               )}
                               {piece && (
                                 <img 
                                   src={`${PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`}/${piece}.png`} 
                                   className="w-[85%] h-[85%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" 
                                   draggable={false}
                                 />
                               )}
                             </div>
                           );
                         })}
                       </div>
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
                        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-white/20 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white group-hover:after:scale-[1.05]"></div>
                        <span className="ml-3 text-[14px] text-gray-300 font-medium group-hover:text-white transition-colors">Enable Sounds</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Footer / Actions */}
                <div className="bg-[#1f1f1f] px-8 py-5 flex items-center justify-end border-t border-white/5">
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors shadow-lg"
                  >
                    Save
                  </button>
                </div>

              </div>
            </div>
          )}

          <div className="flex items-stretch h-[95vh] max-h-[1000px] aspect-[1/0.95] max-w-[95%] justify-center">
            <div className="w-[30px] md:w-[45px] mr-[20px] md:mr-[40px] bg-[#333333] rounded overflow-hidden flex flex-col relative h-[100%] shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              <div
                className="w-full bg-[#202020] transition-[height] duration-300"
                style={{ height: `${100 - analysis.whiteWinChance}%` }}
              ></div>
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
              style={{
                backgroundImage: `url("${BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`}")`,
                backgroundSize: "100% 100%",
              }}
            >
              <div className="w-full h-full grid grid-cols-8 grid-rows-8 relative">
                {boardState.map((row, rowIndex) =>
                  row.map((piece, columnIndex) => {
                    const square = toSquare(rowIndex, columnIndex);
                    const squarePiece = game.get(square);
                    const isLightSquare = (rowIndex + columnIndex) % 2 === 0;
                    const isSelectedSquare = selectedSquare === square;
                    const isLegalTarget = legalTargets.includes(square);
                    const isLastMoveSquare =
                      lastMove?.from === square || lastMove?.to === square;
                    const isDraggedSquare = draggedSquare === square;

                    return (
                      <div
                        key={square}
                        onClick={() => handleSquareClick(square)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(event, square)}
                        className="relative flex items-center justify-center cursor-pointer"
                      >
                        {isLastMoveSquare && (
                          <div className="absolute inset-[4%] rounded-[4px] bg-amber-300/20" />
                        )}

                        {isSelectedSquare && (
                          <div className="absolute inset-[4%] rounded-[4px] ring-2 ring-emerald-400 bg-emerald-400/12" />
                        )}

                        {isLegalTarget && (
                          <div
                            className={
                              squarePiece
                                ? "absolute inset-[14%] rounded-full border-[3px] border-emerald-300/80"
                                : "absolute h-[18%] w-[18%] rounded-full bg-emerald-300/80"
                            }
                          />
                        )}

                        {columnIndex === 0 && (
                          <span
                            className={`absolute top-0.5 left-1 text-[13px] font-[700] ${isLightSquare ? "text-[#b07b46]" : "text-[#e6ca9a]"} select-none`}
                          >
                            {8 - rowIndex}
                          </span>
                        )}

                        {rowIndex === 7 && (
                          <span
                            className={`absolute bottom-0 right-1 text-[13px] font-[700] ${isLightSquare ? "text-[#b07b46]" : "text-[#e6ca9a]"} select-none`}
                          >
                            {FILES[columnIndex]}
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
                  }),
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
