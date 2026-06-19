"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Chess, Move } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PuzzleBoardPreviewProps {
  initialFen: string;
  solutionMoves: string[]; // e.g. ["e2e4", "e7e5", "g1f3"]
}

export function PuzzleBoardPreview({ initialFen, solutionMoves }: PuzzleBoardPreviewProps) {
  const [game, setGame] = useState(new Chess(initialFen));
  const [moveIndex, setMoveIndex] = useState(0);
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong' | 'solved'>('playing');
  const [boardWidth, setBoardWidth] = useState(400);
  
  // Responsive board sizing
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 500) {
        setBoardWidth(window.innerWidth - 80);
      } else {
        setBoardWidth(400);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const makeMove = useCallback((move: { from: string, to: string, promotion?: string }) => {
    if (status === 'solved' || status === 'wrong') return false;

    try {
      const moveResult = game.move(move);
      if (moveResult) {
        setGame(new Chess(game.fen()));
        return moveResult;
      }
    } catch (e) {
      return null;
    }
    return null;
  }, [game, status]);

  const onDrop = (sourceSquare: string, targetSquare: string, piece: string) => {
    if (status === 'solved' || status === 'wrong') return false;

    const moveAttempt = {
      from: sourceSquare,
      to: targetSquare,
      promotion: piece[1].toLowerCase() ?? "q",
    };

    // Check if the move attempt matches the solution move at the current index
    const expectedMoveLan = solutionMoves[moveIndex];
    if (!expectedMoveLan) return false;

    // We must validate the user's move using chess.js
    const testGame = new Chess(game.fen());
    let validMove: Move | null = null;
    try {
      validMove = testGame.move(moveAttempt);
    } catch (e) {}

    if (!validMove) return false;

    // Convert validMove to LAN (e.g. e2e4 or e7e8q)
    const moveLan = validMove.from + validMove.to + (validMove.promotion || '');

    if (moveLan === expectedMoveLan) {
      // User guessed correctly
      setGame(new Chess(testGame.fen()));
      setStatus('correct');

      // Next move is opponent's move, or puzzle solved
      if (moveIndex + 1 >= solutionMoves.length) {
        setStatus('solved');
      } else {
        // Play opponent's move automatically after a short delay
        setTimeout(() => {
          const opponentMove = solutionMoves[moveIndex + 1];
          const nextGame = new Chess(testGame.fen());
          try {
            // we have to parse LAN for the opponent move to pass to chess.js
            // If the solution array contains LANs, we use them
            nextGame.move({
              from: opponentMove.substring(0, 2),
              to: opponentMove.substring(2, 4),
              promotion: opponentMove.length === 5 ? opponentMove[4] : undefined
            });
            setGame(new Chess(nextGame.fen()));
            setMoveIndex(prev => prev + 2);
            setStatus('playing');
          } catch(e) {
            console.error("Invalid opponent move in solution:", opponentMove);
          }
        }, 500);
      }
      return true;
    } else {
      // User guessed wrong
      setStatus('wrong');
      return false; // Don't allow the piece to drop
    }
  };

  const handleRetry = () => {
    setGame(new Chess(initialFen));
    setMoveIndex(0);
    setStatus('playing');
  };

  return (
    <div className="flex flex-col items-center max-w-[400px] w-full bg-[var(--surface-alt)] rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="w-full p-3 bg-[var(--surface-hover)] border-b border-[var(--border)] flex items-center justify-between">
        <h3 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
          🧩 Tactics Puzzle
        </h3>
        <div className="flex items-center gap-2 text-xs font-bold">
          {status === 'playing' && <span className="text-[var(--cta-bg)]">Your Turn</span>}
          {status === 'correct' && <span className="text-green-500 flex items-center gap-1"><CheckCircle2 size={14}/> Correct</span>}
          {status === 'wrong' && <span className="text-red-500 flex items-center gap-1"><XCircle size={14}/> Wrong Move</span>}
          {status === 'solved' && <span className="text-green-500 flex items-center gap-1"><CheckCircle2 size={14}/> Solved!</span>}
        </div>
      </div>
      
      <div className="w-full aspect-square relative">
        <Chessboard 
          id="PuzzleBoard"
          position={game.fen()} 
          onPieceDrop={onDrop}
          boardWidth={boardWidth}
          customDarkSquareStyle={{ backgroundColor: "#779556" }}
          customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
          animationDuration={200}
          arePiecesDraggable={status === 'playing' || status === 'correct'}
        />
        
        <AnimatePresence>
          {(status === 'wrong' || status === 'solved') && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm"
            >
              <div className="flex flex-col items-center text-center p-6 bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)]">
                {status === 'solved' ? (
                  <>
                    <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Puzzle Solved!</h2>
                    <p className="text-[var(--text-secondary)] text-sm mb-6">Brilliant vision, Grandmaster.</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4">
                      <XCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Incorrect</h2>
                    <p className="text-[var(--text-secondary)] text-sm mb-6">That move loses the advantage.</p>
                  </>
                )}
                
                <button 
                  onClick={handleRetry}
                  className="flex items-center gap-2 bg-[var(--cta-bg)] text-[var(--cta-text)] font-bold py-2 px-6 rounded-full hover:scale-105 transition-transform"
                >
                  <RotateCcw size={18} /> Retry Puzzle
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
