import React, { useRef, useEffect } from "react";
import { LayoutGrid } from "lucide-react";
import themeManifest from "@/data/themeManifest.json";

const PIECE_THEME_ASSETS = themeManifest.pieceAssets as Record<string, string>;

interface MoveHistoryPanelProps {
  history: string[]; // array of SAN moves e.g., ["e4", "e5", "Nf3", ...]
  pieceTheme?: string;
  onMoveClick?: (index: number) => void;
  currentMoveIndex?: number; // to highlight the currently viewed move
}

const PieceImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
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

const getPieceIcon = (code: string | null, pieceTheme: string) => {
  if (!code) return null;
  let fileName = code;
  if (code.length === 1) {
    const isWhite = code === code.toUpperCase();
    fileName = `${isWhite ? 'w' : 'b'}${code.toLowerCase()}`;
  }
  return (
    <PieceImage
      src={`${PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`}/${fileName}.png`}
      alt={code}
    />
  );
};

export function MoveHistoryPanel({
  history,
  pieceTheme = "neo",
  onMoveClick,
  currentMoveIndex = -1
}: MoveHistoryPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new moves are added
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [history.length]);

  const renderMove = (san: string, isWhite: boolean) => {
    if (!san) return null;
    const pieceMatch = san.match(/^[NBRQK]/);
    const pieceLetter = pieceMatch ? pieceMatch[0] : null;
    const rest = pieceMatch ? san.slice(1) : san;
    
    // Generate a visually plausible fake time for demonstration
    let hash = 0;
    for (let i = 0; i < san.length; i++) hash = san.charCodeAt(i) + ((hash << 5) - hash);
    const timeNum = 0.5 + (Math.abs(hash) % 75) / 10;
    const fakeTime = timeNum.toFixed(1);
    const barWidth = Math.max(8, Math.min(24, (timeNum / 5) * 24)); // Bar scales with time, up to 24px

    return (
      <div className="flex items-center w-full">
        {pieceLetter && (
          <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0 -ml-0.5 mr-0.5 opacity-80">
            {getPieceIcon(isWhite ? pieceLetter : pieceLetter.toLowerCase(), pieceTheme)}
          </div>
        )}
        <span className={pieceLetter ? "mt-[2px]" : ""}>{rest}</span>
        <div className="ml-auto flex items-center gap-1.5 opacity-60">
          <div className={`h-1.5 ${isWhite ? 'bg-[var(--text-primary)]' : 'bg-[var(--text-muted)]'} rounded-[1px]`} style={{ width: `${barWidth}px` }} />
          <span className="text-[10px] text-[var(--text-muted)] font-mono hidden sm:inline-block">{fakeTime}s</span>
        </div>
      </div>
    );
  };

  // Group into pairs: [[white, black], [white, black]]
  const groupedMoves = history.reduce((result: string[][], move: string, index: number) => {
    if (index % 2 === 0) result.push([move]);
    else result[result.length - 1].push(move);
    return result;
  }, []);

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-[28px_1fr_1fr] gap-x-1.5 gap-y-0.5 p-2">
        {groupedMoves.map((pair, rowIdx) => {
          const whiteMoveIdx = rowIdx * 2;
          const blackMoveIdx = rowIdx * 2 + 1;
          const isWhiteActive = currentMoveIndex === whiteMoveIdx;
          const isBlackActive = currentMoveIndex === blackMoveIdx;

          return (
            <React.Fragment key={rowIdx}>
              <div className="text-[var(--text-muted)] font-mono text-xs flex items-center justify-end pr-1 py-1 opacity-60">
                {rowIdx + 1}.
              </div>
              
              {/* White Move */}
              <div 
                onClick={() => onMoveClick?.(whiteMoveIdx)}
                className={`px-2 py-1 rounded-md font-bold text-sm border cursor-pointer transition-colors flex items-center ${
                  isWhiteActive 
                    ? "bg-[var(--text-primary)] text-[var(--bg)] border-[var(--text-primary)]" 
                    : "bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {renderMove(pair[0], true)}
              </div>
              
              {/* Black Move */}
              {pair[1] ? (
                <div 
                  onClick={() => onMoveClick?.(blackMoveIdx)}
                  className={`px-2 py-1 rounded-md font-bold text-sm border cursor-pointer transition-colors flex items-center ${
                    isBlackActive 
                      ? "bg-[var(--brand)] text-white border-[var(--brand)]" 
                      : "bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {renderMove(pair[1], false)}
                </div>
              ) : (
                <div />
              )}
            </React.Fragment>
          );
        })}
        {history.length === 0 && (
          <div className="col-span-3 flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <LayoutGrid className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-sm font-semibold">No moves yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
