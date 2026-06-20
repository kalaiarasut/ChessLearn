"use client";

import { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface MiniBoardPreviewProps {
  fenOrPgn?: string;
  liveGameId?: string;
  wrapperClassName?: string;
  overlayNode?: React.ReactNode;
  showAnalyzeButton?: boolean;
}

export function MiniBoardPreview({ fenOrPgn, liveGameId: initialLiveGameId, wrapperClassName, overlayNode, showAnalyzeButton = true }: MiniBoardPreviewProps) {
  const [board, setBoard] = useState<(string | null)[][] | null>(null);
  const [parsedFen, setParsedFen] = useState<string | null>(null);
  const [historyFens, setHistoryFens] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [isPgn, setIsPgn] = useState(false);

  const updateBoardFromFen = (fen: string) => {
    try {
      const chess = new Chess(fen);
      setBoard(chess.board().map(row => row.map(p => p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : null)));
      setParsedFen(fen);
    } catch(e) {}
  };

  useEffect(() => {
    let activeLiveGameId = initialLiveGameId;
    let extracted = fenOrPgn;
    
    if (fenOrPgn && !activeLiveGameId) {
      const liveGameMatch = fenOrPgn.match(/\[livegame:([\w-]+)\]/i);
      if (liveGameMatch) {
        activeLiveGameId = liveGameMatch[1];
      }
    }
    
    if (fenOrPgn) {
      const fenMatch = fenOrPgn.match(/\[fen\]([\s\S]*?)\[\/fen\]/i);
      const pgnMatch = fenOrPgn.match(/\[pgn\]([\s\S]*?)\[\/pgn\]/i);
      if (fenMatch) extracted = fenMatch[1].trim();
      else if (pgnMatch) extracted = pgnMatch[1].trim();
    }

    if (activeLiveGameId) {
      const supabase = createSupabaseBrowserClient();
      supabase.from('games').select('fen').eq('id', activeLiveGameId).single().then(({ data }: any) => {
        if (data?.fen) updateBoardFromFen(data.fen);
      });
      
      const channel = supabase.channel(`game-${activeLiveGameId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${activeLiveGameId}`
        }, (payload: any) => {
          if (payload.new.fen) {
            updateBoardFromFen(payload.new.fen);
          }
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    } else if (extracted) {
      try {
        const chess = new Chess();
        let success = false;
        
        try {
          chess.loadPgn(extracted);
          success = true;
          const moves = chess.history();
          
          let startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
          const lines = extracted.split('\n');
          for (const line of lines) {
            if (line.startsWith('[FEN "')) {
              startFen = line.substring(6, line.length - 2);
              break;
            }
          }
          
          const simChess = new Chess();
          try {
             simChess.load(startFen);
          } catch(e) {}
          
          const fens = [simChess.fen()];
          for (const move of moves) {
            simChess.move(move);
            fens.push(simChess.fen());
          }
          setHistoryFens(fens);
          setCurrentMoveIndex(fens.length - 1);
          setIsPgn(true);
          updateBoardFromFen(fens[fens.length - 1]);
        } catch (e) {
          try {
            chess.load(extracted);
            success = true;
            setIsPgn(false);
            updateBoardFromFen(chess.fen());
          } catch (e2) {}
        }
        
        if (!success) {
          setBoard(null);
          setParsedFen(null);
        }
      } catch (e) {
        setBoard(null);
        setParsedFen(null);
      }
    }
  }, [fenOrPgn, initialLiveGameId]);

  useEffect(() => {
    if (isPgn && historyFens.length > 0 && currentMoveIndex >= 0 && currentMoveIndex < historyFens.length) {
      updateBoardFromFen(historyFens[currentMoveIndex]);
    }
  }, [currentMoveIndex, historyFens, isPgn]);

  if (!board) return null;

  const getPieceIcon = (code: string | null) => {
    if (!code) return null;
    const isWhite = code === code.toUpperCase();
    const fileName = `${isWhite ? 'w' : 'b'}${code.toLowerCase()}`;
    return (
      <img 
        src={`/pieces/neo/150/${fileName}.png`} 
        alt={fileName}
        className="w-full h-full object-contain drop-shadow-sm pointer-events-none"
      />
    );
  };

  return (
    <div className={`flex flex-col gap-2 max-w-[280px] relative ${wrapperClassName || 'mt-2'}`}>
      <div className="relative w-full aspect-square rounded-md overflow-hidden border border-[var(--border)] shadow-sm">
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

      {isPgn && (
        <div className="flex items-center justify-center gap-1 bg-[var(--surface-hover)] rounded-md py-1 px-2 border border-[var(--border)]">
          <button 
            disabled={currentMoveIndex <= 0}
            onClick={(e) => { e.stopPropagation(); setCurrentMoveIndex(0); }}
            className="p-1 hover:bg-[var(--surface-alt)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button 
            disabled={currentMoveIndex <= 0}
            onClick={(e) => { e.stopPropagation(); setCurrentMoveIndex(p => Math.max(0, p - 1)); }}
            className="p-1 hover:bg-[var(--surface-alt)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center text-xs font-mono text-[var(--text-secondary)]">
            {currentMoveIndex} / {historyFens.length - 1}
          </div>
          <button 
            disabled={currentMoveIndex >= historyFens.length - 1}
            onClick={(e) => { e.stopPropagation(); setCurrentMoveIndex(p => Math.min(historyFens.length - 1, p + 1)); }}
            className="p-1 hover:bg-[var(--surface-alt)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button 
            disabled={currentMoveIndex >= historyFens.length - 1}
            onClick={(e) => { e.stopPropagation(); setCurrentMoveIndex(historyFens.length - 1); }}
            className="p-1 hover:bg-[var(--surface-alt)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex justify-between items-center text-xs text-[var(--text-secondary)] mt-1">
        <span className="font-medium">{initialLiveGameId ? "Live Game" : (isPgn ? "PGN Viewer" : "Chess Position")}</span>
        {showAnalyzeButton && (
          <button 
            className="bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] px-3 py-1 rounded-full hover:bg-[var(--surface-alt)] font-medium transition-colors flex items-center gap-1 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              if (parsedFen) {
                window.location.href = `/analysis?fen=${encodeURIComponent(parsedFen)}`;
              }
            }}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            Analyze
          </button>
        )}
      </div>
      {overlayNode}
    </div>
  );
}
