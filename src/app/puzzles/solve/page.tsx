"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  ArrowLeft, Sun, Moon, ChevronDown, RotateCcw, Lightbulb,
  SkipForward, Eye, FlipVertical, Zap, Flame, Target,
  Check, X, Trophy, Clock, Heart,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { AuthMenu } from "@/components/auth-menu";
import {
  loadClientPreferences, saveClientPreferences,
  type PuzzleClientPreferences,
} from "@/lib/client-preferences";
import themeManifest from "@/data/themeManifest.json";

const PIECE_ASSETS = themeManifest.pieceAssets as Record<string, string>;
const BOARD_ASSETS = themeManifest.boardAssets as Record<string, string>;

type PuzzleData = { id: string; fen: string; moves: string[]; rating: number; themes: string[]; popularity: number };
type MoveResult = "correct" | "wrong" | null;
type GamePhase = "playing" | "solved" | "failed" | "storm_over" | "streak_over";
type PuzzleMode = "standard" | "storm" | "streak";

const FILES = ["a","b","c","d","e","f","g","h"];
const RANKS = ["8","7","6","5","4","3","2","1"];

function SolverInner() {
  const params = useSearchParams();
  const mode = (params.get("mode") || "standard") as PuzzleMode;
  const themeFilter = params.get("theme") || "";
  const { toggleTheme, isDark } = useTheme();

  const boardTheme = themeManifest.defaultBoardTheme;
  const pieceTheme = themeManifest.defaultPieceTheme;
  const piecePath = PIECE_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`;
  const boardPath = BOARD_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`;

  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [game, setGame] = useState<Chess | null>(null);
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [moveIndex, setMoveIndex] = useState(0);
  const [moveResult, setMoveResult] = useState<MoveResult>(null);
  const [flipped, setFlipped] = useState(false);
  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const [selectedSq, setSelectedSq] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [puzzlePrefs, setPuzzlePrefs] = useState<PuzzleClientPreferences | null>(null);

  // Storm state
  const [stormScore, setStormScore] = useState(0);
  const [stormLives, setStormLives] = useState(3);
  const [stormTime, setStormTime] = useState(180);
  const stormTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Streak state
  const [streakCount, setStreakCount] = useState(0);

  const [playerSide, setPlayerSide] = useState<"w" | "b">("w");

  useEffect(() => {
    const prefs = loadClientPreferences();
    setPuzzlePrefs(prefs.puzzle);
  }, []);

  const fetchPuzzle = useCallback(async () => {
    setLoading(true);
    const ratingRange = mode === "streak"
      ? `&minRating=${600 + streakCount * 50}&maxRating=${900 + streakCount * 50}`
      : mode === "storm" ? "&minRating=600&maxRating=1400" : "";
    const themeParam = themeFilter ? `&theme=${themeFilter}` : "";
    try {
      const res = await fetch(`/api/puzzles?count=1&random=true${ratingRange}${themeParam}`);
      const data = await res.json();
      if (data.puzzles?.[0]) {
        initPuzzle(data.puzzles[0]);
      }
    } catch { setLoading(false); }
  }, [mode, themeFilter, streakCount]);

  useEffect(() => { fetchPuzzle(); }, [fetchPuzzle]);

  // Storm timer
  useEffect(() => {
    if (mode === "storm" && !loading && phase === "playing") {
      stormTimerRef.current = setInterval(() => {
        setStormTime(prev => {
          if (prev <= 1) {
            clearInterval(stormTimerRef.current!);
            setPhase("storm_over");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (stormTimerRef.current) clearInterval(stormTimerRef.current); };
    }
  }, [mode, loading, phase]);

  const initPuzzle = (p: PuzzleData) => {
    const g = new Chess(p.fen);
    // Execute opponent's first move
    const firstMove = p.moves[0];
    if (firstMove) {
      g.move({ from: firstMove.slice(0,2) as Square, to: firstMove.slice(2,4) as Square, promotion: (firstMove[4] as "q"|"r"|"b"|"n") || undefined });
    }
    const side = g.turn();
    setPlayerSide(side);
    setFlipped(side === "b");
    setGame(g);
    setPuzzle(p);
    setMoveIndex(1); // Player starts at index 1
    setPhase("playing");
    setMoveResult(null);
    setHintSquare(null);
    setSelectedSq(null);
    setLegalMoves([]);
    setLastMove(firstMove ? { from: firstMove.slice(0,2), to: firstMove.slice(2,4) } : null);
    setLoading(false);
  };

  const handleSquareClick = (sq: string) => {
    if (!game || !puzzle || phase !== "playing") return;
    if (game.turn() !== playerSide) return;

    if (selectedSq) {
      // Try to make a move
      const moveStr = selectedSq + sq;
      attemptMove(selectedSq, sq);
      setSelectedSq(null);
      setLegalMoves([]);
    } else {
      const piece = game.get(sq as Square);
      if (piece && piece.color === playerSide) {
        setSelectedSq(sq);
        const moves = game.moves({ square: sq as Square, verbose: true });
        setLegalMoves(moves.map(m => m.to));
      }
    }
  };

  const attemptMove = (from: string, to: string) => {
    if (!game || !puzzle) return;
    const expectedUCI = puzzle.moves[moveIndex];
    if (!expectedUCI) return;

    const expectedFrom = expectedUCI.slice(0,2);
    const expectedTo = expectedUCI.slice(2,4);
    const expectedPromo = expectedUCI[4] as "q"|"r"|"b"|"n" | undefined;

    if (from === expectedFrom && to === expectedTo) {
      // Correct move
      const g = new Chess(game.fen());
      const result = g.move({ from: from as Square, to: to as Square, promotion: expectedPromo || "q" });
      if (!result) { handleWrongMove(); return; }

      setGame(g);
      setLastMove({ from, to });
      setMoveResult("correct");

      const nextIndex = moveIndex + 1;
      if (nextIndex >= puzzle.moves.length) {
        // Puzzle solved!
        setTimeout(() => handlePuzzleSolved(), 400);
      } else {
        // Computer responds
        setTimeout(() => {
          const compMove = puzzle.moves[nextIndex];
          const g2 = new Chess(g.fen());
          g2.move({ from: compMove.slice(0,2) as Square, to: compMove.slice(2,4) as Square, promotion: (compMove[4] as "q"|"r"|"b"|"n") || undefined });
          setGame(g2);
          setLastMove({ from: compMove.slice(0,2), to: compMove.slice(2,4) });
          setMoveIndex(nextIndex + 1);
          setMoveResult(null);
        }, 500);
      }
    } else {
      handleWrongMove();
    }
  };

  const handleWrongMove = () => {
    setMoveResult("wrong");
    if (mode === "storm") {
      const newLives = stormLives - 1;
      setStormLives(newLives);
      if (newLives <= 0) { setPhase("storm_over"); return; }
      setTimeout(() => { setMoveResult(null); fetchPuzzle(); }, 800);
    } else if (mode === "streak") {
      setPhase("streak_over");
    } else {
      setPhase("failed");
      // Update prefs
      const prefs = loadClientPreferences();
      prefs.puzzle.puzzlesFailed += 1;
      prefs.puzzle.currentStreak = 0;
      
      if (puzzle) {
        const kFactor = 20;
        const expectedScore = 1 / (1 + Math.pow(10, (puzzle.rating - prefs.puzzle.puzzleRating) / 400));
        const ratingChange = Math.round(kFactor * (0 - expectedScore));
        prefs.puzzle.puzzleRating = Math.max(400, prefs.puzzle.puzzleRating + ratingChange);

        puzzle.themes.forEach(t => {
          if (!prefs.puzzle.puzzleThemeStats[t]) prefs.puzzle.puzzleThemeStats[t] = { solved: 0, failed: 0 };
          prefs.puzzle.puzzleThemeStats[t].failed += 1;
        });

        prefs.puzzle.recentActivity.unshift({
          puzzleId: puzzle.id,
          theme: puzzle.themes[0] || "mix",
          rating: puzzle.rating,
          solved: false,
          timestamp: new Date().toISOString(),
        });
        if (prefs.puzzle.recentActivity.length > 100) prefs.puzzle.recentActivity.pop();

        prefs.puzzle.ratingHistory.push({
          date: new Date().toISOString(),
          rating: prefs.puzzle.puzzleRating,
        });
      }
      saveClientPreferences(prefs);
      setPuzzlePrefs(prefs.puzzle);
    }
  };

  const handlePuzzleSolved = () => {
    if (mode === "storm") {
      setStormScore(prev => prev + 1);
      setTimeout(() => fetchPuzzle(), 300);
    } else if (mode === "streak") {
      setStreakCount(prev => prev + 1);
      setTimeout(() => fetchPuzzle(), 300);
    } else {
      setPhase("solved");
      // Update prefs
      const prefs = loadClientPreferences();
      prefs.puzzle.puzzlesSolved += 1;
      prefs.puzzle.currentStreak += 1;
      
      if (puzzle) {
        const kFactor = 20;
        const expectedScore = 1 / (1 + Math.pow(10, (puzzle.rating - prefs.puzzle.puzzleRating) / 400));
        const ratingChange = Math.round(kFactor * (1 - expectedScore));
        prefs.puzzle.puzzleRating = Math.max(400, prefs.puzzle.puzzleRating + ratingChange);

        puzzle.themes.forEach(t => {
          if (!prefs.puzzle.puzzleThemeStats[t]) prefs.puzzle.puzzleThemeStats[t] = { solved: 0, failed: 0 };
          prefs.puzzle.puzzleThemeStats[t].solved += 1;
        });

        prefs.puzzle.recentActivity.unshift({
          puzzleId: puzzle.id,
          theme: puzzle.themes[0] || "mix",
          rating: puzzle.rating,
          solved: true,
          timestamp: new Date().toISOString(),
        });
        if (prefs.puzzle.recentActivity.length > 100) prefs.puzzle.recentActivity.pop();

        prefs.puzzle.ratingHistory.push({
          date: new Date().toISOString(),
          rating: prefs.puzzle.puzzleRating,
        });
      }
      saveClientPreferences(prefs);
      setPuzzlePrefs(prefs.puzzle);
    }
  };

  const handleHint = () => {
    if (!puzzle || moveIndex >= puzzle.moves.length) return;
    const move = puzzle.moves[moveIndex];
    setHintSquare(move.slice(0,2));
  };

  const handleShowSolution = () => {
    if (!game || !puzzle) return;
    const g = new Chess(game.fen());
    for (let i = moveIndex; i < puzzle.moves.length; i++) {
      const m = puzzle.moves[i];
      g.move({ from: m.slice(0,2) as Square, to: m.slice(2,4) as Square, promotion: (m[4] as "q"|"r"|"b"|"n") || undefined });
    }
    setGame(g);
    setPhase("solved");
  };

  const handleNextPuzzle = () => { fetchPuzzle(); };

  const handleRetry = () => { if (puzzle) initPuzzle(puzzle); };

  // Save storm/streak scores on game over
  useEffect(() => {
    if (phase === "storm_over") {
      const prefs = loadClientPreferences();
      if (stormScore > prefs.puzzle.bestStormScore) prefs.puzzle.bestStormScore = stormScore;
      saveClientPreferences(prefs);
      setPuzzlePrefs(prefs.puzzle);
    }
    if (phase === "streak_over") {
      const prefs = loadClientPreferences();
      if (streakCount > prefs.puzzle.bestStreakScore) prefs.puzzle.bestStreakScore = streakCount;
      saveClientPreferences(prefs);
      setPuzzlePrefs(prefs.puzzle);
    }
  }, [phase]);

  // Board rendering
  const board = useMemo(() => {
    if (!game) return Array.from({ length: 8 }, () => Array(8).fill(null));
    return game.board().map(row => row.map(p => p ? `${p.color}${p.type}` : null));
  }, [game?.fen()]);

  const ranks = flipped ? [...RANKS].reverse() : RANKS;
  const files = flipped ? [...FILES].reverse() : FILES;

  const modeTitle = mode === "storm" ? "Puzzle Storm" : mode === "streak" ? "Puzzle Streak" : "Puzzle Training";
  const ModeIcon = mode === "storm" ? Zap : mode === "streak" ? Flame : Target;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {/* Navbar */}
      <header className="w-full max-w-[1400px] mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/puzzles" className="inline-flex items-center text-[var(--text-dimmed)] hover:text-[var(--text-primary)] transition-colors text-[14px] font-medium group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Puzzles
        </Link>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} data-theme-toggle className="p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <AuthMenu />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 px-6 py-8 max-w-[1200px] mx-auto w-full">
        {/* Board Section */}
        <div className="flex flex-col items-center gap-4">
          {/* Mode indicator */}
          <div className="flex items-center gap-3 mb-2">
            <ModeIcon className={`w-5 h-5 ${mode === "storm" ? "text-amber-400" : mode === "streak" ? "text-rose-400" : "text-violet-400"}`} />
            <span className="text-[14px] font-bold text-[var(--text-primary)]">{modeTitle}</span>
            {puzzle && mode === "standard" && (
              <span className="text-[12px] font-semibold text-[var(--text-dimmed)] border border-[var(--border)] rounded-full px-3 py-1">
                Rating {puzzle.rating}
              </span>
            )}
          </div>

          {/* Storm/Streak bar */}
          {mode === "storm" && (
            <div className="flex items-center gap-6 mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-[20px] font-bold tabular-nums text-[var(--text-primary)]">
                  {Math.floor(stormTime / 60)}:{(stormTime % 60).toString().padStart(2, "0")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-[20px] font-bold tabular-nums text-[var(--text-primary)]">{stormScore}</span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(3)].map((_, i) => (
                  <Heart key={i} className={`w-4 h-4 ${i < stormLives ? "text-rose-400 fill-rose-400" : "text-[var(--text-dimmed)]"}`} />
                ))}
              </div>
            </div>
          )}

          {mode === "streak" && (
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                <span className="text-[20px] font-bold tabular-nums text-[var(--text-primary)]">{streakCount}</span>
                <span className="text-[12px] text-[var(--text-dimmed)] font-semibold">streak</span>
              </div>
            </div>
          )}

          {/* Chessboard */}
          <div className="relative select-none" style={{ width: "min(85vw, 520px)", height: "min(85vw, 520px)" }}>
            {/* Board bg */}
            <img src={boardPath} alt="" className="absolute inset-0 w-full h-full rounded-xl object-cover" draggable={false} />

            {/* Move result overlay */}
            {moveResult && (
              <div className={`absolute inset-0 z-30 rounded-xl pointer-events-none transition-opacity duration-200 ${
                moveResult === "correct" ? "bg-emerald-500/10 border-2 border-emerald-500/40" : "bg-red-500/10 border-2 border-red-500/40"
              }`} />
            )}

            {/* Grid */}
            <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 rounded-xl overflow-hidden">
              {ranks.map((rank, ri) =>
                files.map((file, ci) => {
                  const sq = `${file}${rank}`;
                  const boardRi = RANKS.indexOf(rank);
                  const boardCi = FILES.indexOf(file);
                  const piece = board[boardRi]?.[boardCi];
                  const isSelected = selectedSq === sq;
                  const isLegal = legalMoves.includes(sq);
                  const isLastMove = lastMove && (lastMove.from === sq || lastMove.to === sq);
                  const isHint = hintSquare === sq;
                  const hasPiece = !!piece;

                  return (
                    <div
                      key={sq}
                      className="relative flex items-center justify-center cursor-pointer"
                      onClick={() => handleSquareClick(sq)}
                    >
                      {/* Highlights */}
                      {isLastMove && <div className="absolute inset-0 bg-amber-400/25 z-10" />}
                      {isSelected && <div className="absolute inset-0 bg-emerald-400/30 z-10" />}
                      {isHint && <div className="absolute inset-0 bg-sky-400/35 z-10 animate-pulse" />}

                      {/* Legal move dot */}
                      {isLegal && !hasPiece && (
                        <div className="absolute z-20 w-[26%] h-[26%] rounded-full bg-[var(--text-primary)] opacity-20" />
                      )}
                      {isLegal && hasPiece && (
                        <div className="absolute z-20 inset-0 border-[3px] border-[var(--text-primary)] opacity-20 rounded-full" />
                      )}

                      {/* Piece */}
                      {piece && (
                        <img
                          src={`${piecePath}/${piece}.png`}
                          alt={piece}
                          className="absolute inset-[8%] w-[84%] h-[84%] object-contain z-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
                          draggable={false}
                        />
                      )}

                      {/* Coordinates */}
                      {ci === 0 && (
                        <span className="absolute top-[2px] left-[4px] text-[9px] font-bold z-20 opacity-50 text-[var(--text-primary)] pointer-events-none select-none">
                          {rank}
                        </span>
                      )}
                      {ri === 7 && (
                        <span className="absolute bottom-[1px] right-[4px] text-[9px] font-bold z-20 opacity-50 text-[var(--text-primary)] pointer-events-none select-none">
                          {file}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Turn indicator */}
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-muted)]">
            {phase === "playing" && game && (
              <>
                <div className={`w-3 h-3 rounded-full border border-[var(--border)] ${game.turn() === "w" ? "bg-white" : "bg-gray-800"}`} />
                {game.turn() === playerSide ? "Your turn — find the best move" : "Opponent is moving..."}
              </>
            )}
            {phase === "solved" && (
              <span className="text-emerald-400 flex items-center gap-1.5"><Check className="w-4 h-4" /> Puzzle Solved!</span>
            )}
            {phase === "failed" && (
              <span className="text-red-400 flex items-center gap-1.5"><X className="w-4 h-4" /> Incorrect</span>
            )}
          </div>
        </div>

        {/* Controls Panel */}
        <div className="w-full lg:w-[300px] flex flex-col gap-4">
          {/* Puzzle info card */}
          {puzzle && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-5">
              <div className="flex flex-wrap gap-2 mb-4">
                {puzzle.themes.slice(0, 4).map(t => (
                  <span key={t} className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-dimmed)] bg-[var(--surface)] border border-[var(--border)] rounded-full px-2.5 py-1 capitalize">
                    {t.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                ))}
              </div>
              <p className="text-[13px] text-[var(--text-muted)] font-medium">
                {playerSide === "w" ? "White" : "Black"} to move — find the best continuation.
              </p>
            </div>
          )}

          {/* Action buttons */}
          {phase === "playing" && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleHint} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all text-[13px] font-semibold">
                <Lightbulb className="w-4 h-4" /> Hint
              </button>
              <button onClick={() => setFlipped(f => !f)} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all text-[13px] font-semibold">
                <FlipVertical className="w-4 h-4" /> Flip
              </button>
              {mode === "standard" && (
                <>
                  <button onClick={handleShowSolution} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all text-[13px] font-semibold">
                    <Eye className="w-4 h-4" /> Solution
                  </button>
                  <button onClick={handleNextPuzzle} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all text-[13px] font-semibold">
                    <SkipForward className="w-4 h-4" /> Skip
                  </button>
                </>
              )}
            </div>
          )}

          {/* Solved/Failed panel */}
          {(phase === "solved" || phase === "failed") && mode === "standard" && (
            <div className={`rounded-xl border p-5 ${
              phase === "solved"
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-red-500/30 bg-red-500/5"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {phase === "solved" ? (
                  <><Check className="w-5 h-5 text-emerald-400" /><span className="text-[16px] font-bold text-emerald-400">Correct!</span></>
                ) : (
                  <><X className="w-5 h-5 text-red-400" /><span className="text-[16px] font-bold text-red-400">Incorrect</span></>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={handleRetry} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all text-[13px] font-semibold">
                  <RotateCcw className="w-4 h-4" /> Retry
                </button>
                <button onClick={handleNextPuzzle} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)] transition-all text-[13px] font-bold">
                  <SkipForward className="w-4 h-4" /> Next
                </button>
              </div>
            </div>
          )}

          {/* Storm/Streak game over */}
          {(phase === "storm_over" || phase === "streak_over") && (
            <div className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--card-from)] to-[var(--card-to)] p-6 text-center">
              <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h3 className="text-[24px] font-serif font-[500] text-[var(--text-primary)] mb-2">
                {phase === "storm_over" ? "Storm Over!" : "Streak Ended!"}
              </h3>
              <p className="text-[36px] font-bold text-[var(--text-primary)] tabular-nums mb-1">
                {phase === "storm_over" ? stormScore : streakCount}
              </p>
              <p className="text-[13px] text-[var(--text-dimmed)] font-semibold mb-4">
                {phase === "storm_over" ? "puzzles solved" : "puzzle streak"}
              </p>
              {puzzlePrefs && (
                <p className="text-[12px] text-[var(--text-dimmed)] mb-4">
                  Personal best: {phase === "storm_over" ? puzzlePrefs.bestStormScore : puzzlePrefs.bestStreakScore}
                </p>
              )}
              <div className="flex gap-3">
                <Link href="/puzzles" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-[13px] font-semibold">
                  <ArrowLeft className="w-4 h-4" /> Hub
                </Link>
                <button onClick={() => { setStormScore(0); setStormLives(3); setStormTime(180); setStreakCount(0); fetchPuzzle(); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)] transition-all text-[13px] font-bold">
                  <RotateCcw className="w-4 h-4" /> Again
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function PuzzleSolvePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)]">Loading puzzle...</div>}>
      <SolverInner />
    </Suspense>
  );
}
