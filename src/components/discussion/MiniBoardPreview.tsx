"use client";

import { useEffect, useState } from "react";
import { Chess } from "chess.js";

interface MiniBoardPreviewProps {
  fenOrPgn: string;
}

export function MiniBoardPreview({ fenOrPgn }: MiniBoardPreviewProps) {
  const [board, setBoard] = useState<(string | null)[][] | null>(null);
  const [parsedFen, setParsedFen] = useState<string | null>(null);

  useEffect(() => {
    try {
      const chess = new Chess();
      // Try to load as PGN first
      let success = false;
      try {
        chess.loadPgn(fenOrPgn);
        success = true;
      } catch (e) {
        // Not a PGN, try FEN
        try {
          chess.load(fenOrPgn);
          success = true;
        } catch (e2) {
          // Neither
        }
      }

      if (success) {
        setBoard(chess.board().map(row => row.map(p => p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : null)));
        setParsedFen(chess.fen());
      } else {
        setBoard(null);
        setParsedFen(null);
      }
    } catch (e) {
      setBoard(null);
      setParsedFen(null);
    }
  }, [fenOrPgn]);

  if (!board) return null;

  const getPieceIcon = (code: string | null) => {
    if (!code) return null;
    const isWhite = code === code.toUpperCase();
    const fileName = `${isWhite ? 'w' : 'b'}${code.toLowerCase()}`;
    // Using standard pieces theme
    return (
      <img 
        src={`/themes/pieces/standard/${fileName}.png`} 
        alt={fileName}
        className="w-full h-full object-contain drop-shadow-sm pointer-events-none"
      />
    );
  };

  return (
    <div className="flex flex-col gap-2 mt-2 max-w-[280px]">
      <div className="relative w-full aspect-square rounded-md overflow-hidden border border-[var(--border)]">
        {/* Board Background */}
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
          {Array.from({ length: 64 }).map((_, i) => {
            const row = Math.floor(i / 8);
            const col = i % 8;
            return (
              <div
                key={i}
                className={(row + col) % 2 === 0 ? 'bg-[#ebecd0]' : 'bg-[#739552]'}
              />
            );
          })}
        </div>
        
        {/* Pieces */}
        <div className="relative z-10 w-full h-full grid grid-cols-8 grid-rows-8">
          {board.map((row, rIdx) => 
            row.map((piece, cIdx) => (
              <div key={`${rIdx}-${cIdx}`} className="w-full h-full p-0.5">
                {getPieceIcon(piece)}
              </div>
            ))
          )}
        </div>
      </div>
      <div className="flex justify-between items-center text-xs text-[var(--text-secondary)]">
        <span>Chess Position</span>
        <button 
          className="text-[var(--brand)] hover:underline font-medium"
          onClick={(e) => {
            e.stopPropagation();
            if (parsedFen) {
              window.location.href = `/analysis?fen=${encodeURIComponent(parsedFen)}`;
            }
          }}
        >
          Analyze
        </button>
      </div>
    </div>
  );
}
