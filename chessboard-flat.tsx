"use client";

import Image from "next/image";
import { motion, MotionValue, useTransform, useMotionTemplate } from "framer-motion";

const PIECE_SET = "neo";
const PIECE_SIZE = 150;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

// Standard starting position
const INITIAL_POSITION: Record<string, string> = {
  'a8': 'br', 'b8': 'bn', 'c8': 'bb', 'd8': 'bq', 'e8': 'bk', 'f8': 'bb', 'g8': 'bn', 'h8': 'br',
  'a7': 'bp', 'b7': 'bp', 'c7': 'bp', 'd7': 'bp', 'e7': 'bp', 'f7': 'bp', 'g7': 'bp', 'h7': 'bp',
  'a2': 'wp', 'b2': 'wp', 'c2': 'wp', 'd2': 'wp', 'e2': 'wp', 'f2': 'wp', 'g2': 'wp', 'h2': 'wp',
  'a1': 'wr', 'b1': 'wn', 'c1': 'wb', 'd1': 'wq', 'e1': 'wk', 'f1': 'wb', 'g1': 'wn', 'h1': 'wr',
};

// These pieces will be animated separately
const ANIMATED_SQUARES = ['g1', 'e7'];

function squareToPosition(square: string) {
  const col = FILES.indexOf(square[0]);
  const row = 8 - parseInt(square[1]);
  return { col, row };
}

interface ChessboardFlatProps {
  scrollProgress: MotionValue<number>;
  isDark: boolean;
}

export function ChessboardFlat({ scrollProgress, isDark }: ChessboardFlatProps) {
  const lightSquare = isDark ? '#3a3a3a' : '#f0f0f0';
  const darkSquare = isDark ? '#1e1e1e' : '#4a4a4a';
  const borderColor = isDark ? '#2a2a2a' : '#333';
  const labelColor = isDark ? '#666' : '#999';

  // Knight: g1 (col6, row7) → f3 (col5, row5) = -1 col, -2 rows
  const knightFrom = squareToPosition('g1');
  const knightMoveXVal = useTransform(scrollProgress, [0.72, 0.84], [0, -100]);
  const knightMoveYVal = useTransform(scrollProgress, [0.72, 0.84], [0, -200]);
  const knightX = useMotionTemplate`${knightMoveXVal}%`;
  const knightY = useMotionTemplate`${knightMoveYVal}%`;

  // Pawn: e7 (col4, row1) → e5 (col4, row3) = 0 col, +2 rows
  const pawnMoveXVal = useTransform(scrollProgress, [0.84, 0.95], [0, 0]);
  const pawnMoveYVal = useTransform(scrollProgress, [0.84, 0.95], [0, 200]);
  const pawnX = useMotionTemplate`${pawnMoveXVal}%`;
  const pawnY = useMotionTemplate`${pawnMoveYVal}%`;

  // Highlight squares that pieces move to
  const knightHighlight = useTransform(scrollProgress, [0.82, 0.84], [0, 0.35]);
  const pawnHighlight = useTransform(scrollProgress, [0.93, 0.95], [0, 0.35]);

  const staticPieces = Object.entries(INITIAL_POSITION)
    .filter(([square]) => !ANIMATED_SQUARES.includes(square));

  return (
    <div className="relative w-full h-full"
      style={{ border: `2px solid ${borderColor}`, borderRadius: '6px', overflow: 'hidden' }}>

      {/* Board Squares */}
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {RANKS.map((rank, rowIdx) =>
          FILES.map((file, colIdx) => {
            const isLight = (rowIdx + colIdx) % 2 === 0;
            const square = `${file}${rank}`;
            const isKnightTarget = square === 'f3';
            const isPawnTarget = square === 'e5';

            return (
              <div
                key={square}
                className="aspect-square relative"
                style={{ backgroundColor: isLight ? lightSquare : darkSquare }}
              >
                {/* Move highlight on target squares */}
                {isKnightTarget && (
                  <motion.div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: '#7fa650',
                      opacity: knightHighlight,
                    }}
                  />
                )}
                {isPawnTarget && (
                  <motion.div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: '#7fa650',
                      opacity: pawnHighlight,
                    }}
                  />
                )}

                {/* Coordinate labels on edges */}
                {colIdx === 0 && (
                  <span className="absolute top-[2px] left-[3px] text-[9px] font-semibold select-none"
                    style={{ color: isLight ? darkSquare : lightSquare, opacity: 0.6 }}>
                    {rank}
                  </span>
                )}
                {rowIdx === 7 && (
                  <span className="absolute bottom-[1px] right-[3px] text-[9px] font-semibold select-none"
                    style={{ color: isLight ? darkSquare : lightSquare, opacity: 0.6 }}>
                    {file}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Static Pieces */}
      {staticPieces.map(([square, piece]) => {
        const { col, row } = squareToPosition(square);
        return (
          <div
            key={square}
            className="absolute pointer-events-none"
            style={{
              left: `${col * 12.5}%`,
              top: `${row * 12.5}%`,
              width: '12.5%',
              height: '12.5%',
            }}
          >
            <Image
              src={`/pieces/${PIECE_SET}/${PIECE_SIZE}/${piece}.png`}
              alt={piece}
              fill
              sizes="60px"
              className="object-contain p-[3px]"
            />
          </div>
        );
      })}

      {/* Animated White Knight (g1 → f3) */}
      <motion.div
        className="absolute z-10 pointer-events-none"
        style={{
          left: `${knightFrom.col * 12.5}%`,
          top: `${knightFrom.row * 12.5}%`,
          width: '12.5%',
          height: '12.5%',
          x: knightX,
          y: knightY,
        }}
      >
        <Image
          src={`/pieces/${PIECE_SET}/${PIECE_SIZE}/wn.png`}
          alt="White Knight"
          fill
          sizes="60px"
          className="object-contain p-[3px]"
        />
      </motion.div>

      {/* Animated Black Pawn (e7 → e5) */}
      <motion.div
        className="absolute z-10 pointer-events-none"
        style={{
          left: `${squareToPosition('e7').col * 12.5}%`,
          top: `${squareToPosition('e7').row * 12.5}%`,
          width: '12.5%',
          height: '12.5%',
          x: pawnX,
          y: pawnY,
        }}
      >
        <Image
          src={`/pieces/${PIECE_SET}/${PIECE_SIZE}/bp.png`}
          alt="Black Pawn"
          fill
          sizes="60px"
          className="object-contain p-[3px]"
        />
      </motion.div>
    </div>
  );
}
