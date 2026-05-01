"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Chess, type Square } from "chess.js";
import {
  ChevronDown,
  ArrowLeft,
  Sun,
  Moon,
  Zap,
  Flame,
  Target,
  Trophy,
  TrendingUp,
  Clock,
  Star,
  ArrowRight,
  BarChart3,
  Crosshair,
  Split,
  Pin,
  Eye,
  CornerUpRight,
  Magnet,
  Wind,
  ShieldAlert,
  Lock,
  MoveHorizontal,
  VolumeX,
  ChevronsUp,
  Crown,
  AlignHorizontalJustifyStart,
  BoxSelect,
  BookOpen,
  Swords,
  Flag,
  Scale,
  Hammer,
  ArrowUp,
  Castle,
  Shuffle,
  TowerControl,
  Navigation,
  Command,
  AlertTriangle,
  Unlock,
  Ban,
  Wifi,
  Search,
  CheckCircle2,
  ArrowLeftRight,
  MoveDiagonal,
  ChevronUp,
  Timer,
  Users,
  Award,
  Medal,
  StarHalf,
  Shield,
  AlignJustify,
  Heart
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { AuthMenu } from "@/components/auth-menu";
import themeManifest from "@/data/themeManifest.json";
import type { PuzzleEntry } from "@/lib/puzzle-service";
import { usePuzzleProgress } from "@/lib/use-puzzle-progress";
import { PuzzleLoginOverlay } from "./_components/PuzzleLoginOverlay";
import { PuzzleSyncBanner } from "./_components/PuzzleSyncBanner";

const PIECE_THEME_ASSETS = themeManifest.pieceAssets as Record<string, string>;
const BOARD_THEME_ASSETS = themeManifest.boardAssets as Record<string, string>;

export const THEME_CATEGORIES = [
  {
    id: "recommended",
    title: "Recommended",
    description: "Start here if you're not sure what to play.",
    themes: [
      { id: "mix", label: "Healthy Mix", icon: Shuffle, description: "A mix of everything. You don't know what to expect, so be ready for anything! Just like in real games." },
    ]
  },
  {
    id: "phases",
    title: "Phases",
    description: "Train specific stages of the game or piece combinations.",
    themes: [
      { id: "opening", label: "Opening", icon: BookOpen, description: "A tactic during the first phase of the game." },
      { id: "middlegame", label: "Middlegame", icon: Swords, description: "A tactic during the second phase of the game." },
      { id: "endgame", label: "Endgame", icon: Flag, description: "A tactic during the last phase of the game." },
      { id: "rookEndgame", label: "Rook Endgame", icon: TowerControl, description: "An endgame with only rooks and pawns." },
      { id: "bishopEndgame", label: "Bishop Endgame", icon: Navigation, description: "An endgame with only bishops and pawns." },
      { id: "pawnEndgame", label: "Pawn Endgame", icon: ArrowUp, description: "An endgame with only pawns." },
      { id: "knightEndgame", label: "Knight Endgame", icon: Command, description: "An endgame with only knights and pawns." },
      { id: "queenEndgame", label: "Queen Endgame", icon: Crown, description: "An endgame with only queens and pawns." },
      { id: "queenRookEndgame", label: "Queen and Rook", icon: Castle, description: "An endgame with only queens, rooks, and pawns." },
    ]
  },
  {
    id: "motifs",
    title: "Motifs",
    description: "Fundamental tactical patterns.",
    themes: [
      { id: "advancedPawn", label: "Advanced Pawn", icon: ChevronsUp, description: "One of your pawns is deep into the opponent position, maybe threatening to promote." },
      { id: "attackingF2F7", label: "Attacking f2/f7", icon: Crosshair, description: "An attack focusing on the f2 or f7 pawn, such as in the fried liver opening." },
      { id: "captureTheDefender", label: "Capture Defender", icon: ShieldAlert, description: "Removing a piece that is critical to defense of another piece, allowing it to be captured." },
      { id: "discoveredAttack", label: "Discovered Attack", icon: Eye, description: "Moving a piece that previously blocked an attack by another long range piece." },
      { id: "doubleCheck", label: "Double Check", icon: Zap, description: "Checking with two pieces at once, as a result of a discovered attack." },
      { id: "exposedKing", label: "Exposed King", icon: AlertTriangle, description: "A tactic involving a king with few defenders around it, often leading to checkmate." },
      { id: "fork", label: "Fork", icon: Split, description: "A move where the moved piece attacks two opponent pieces at once." },
      { id: "hangingPiece", label: "Hanging Piece", icon: Unlock, description: "A tactic involving an opponent piece being undefended or insufficiently defended." },
      { id: "kingsideAttack", label: "Kingside Attack", icon: ArrowRight, description: "An attack of the opponent's king, after they castled on the king side." },
      { id: "pin", label: "Pin", icon: Pin, description: "A tactic involving pins, where a piece is unable to move without revealing an attack." },
      { id: "queensideAttack", label: "Queenside Attack", icon: ArrowLeft, description: "An attack of the opponent's king, after they castled on the queen side." },
      { id: "sacrifice", label: "Sacrifice", icon: Flame, description: "A tactic involving giving up material in the short-term, to gain an advantage again." },
      { id: "skewer", label: "Skewer", icon: Swords, description: "A motif involving a high value piece being attacked, moving out the way, and allowing a lower value piece behind it to be captured." },
      { id: "trappedPiece", label: "Trapped Piece", icon: Lock, description: "A piece is unable to escape capture as it has limited moves." },
    ]
  },
  {
    id: "advanced",
    title: "Advanced",
    description: "Complex tactical motifs and positional ideas.",
    themes: [
      { id: "attraction", label: "Attraction", icon: Magnet, description: "An exchange or sacrifice encouraging or forcing an opponent piece to a square." },
      { id: "clearance", label: "Clearance", icon: Wind, description: "A move, often with tempo, that clears a square, file or diagonal for a follow-up tactical idea." },
      { id: "collinearMove", label: "Collinear Move", icon: AlignJustify, description: "Two opposing pieces face each other, and one slides along the line of attack without capturing." },
      { id: "discoveredCheck", label: "Discovered Check", icon: Search, description: "Move a piece to reveal a check from a hidden attacking piece." },
      { id: "defensiveMove", label: "Defensive Move", icon: Shield, description: "A precise move or sequence of moves that is needed to avoid losing material." },
      { id: "deflection", label: "Deflection", icon: CornerUpRight, description: "A move that distracts an opposing piece from another duty that it performs." },
      { id: "interference", label: "Interference", icon: Ban, description: "Moving a piece between two opponent pieces to leave one or both opponent pieces undefended." },
      { id: "intermezzo", label: "Intermezzo", icon: Clock, description: "Instead of playing the expected move, first interpose another move posing an immediate threat." },
      { id: "quietMove", label: "Quiet Move", icon: VolumeX, description: "A move that does not check, capture, or create an immediate threat to capture." },
      { id: "xRayAttack", label: "X-Ray Attack", icon: Wifi, description: "A piece attacks or defends a square, through an enemy piece." },
      { id: "zugzwang", label: "Zugzwang", icon: MoveHorizontal, description: "The opponent is limited in the moves they can make, and all moves worsen their position." },
    ]
  },
  {
    id: "mates",
    title: "Mates",
    description: "Deliver the final blow.",
    themes: [
      { id: "mate", label: "Checkmate", icon: Crown, description: "Win the game with style." },
      { id: "mateIn1", label: "Mate in 1", icon: Target, description: "Deliver checkmate in one move." },
      { id: "mateIn2", label: "Mate in 2", icon: Target, description: "Deliver checkmate in two moves." },
      { id: "mateIn3", label: "Mate in 3", icon: Target, description: "Deliver checkmate in three moves." },
      { id: "mateIn4", label: "Mate in 4", icon: Target, description: "Deliver checkmate in four moves." },
      { id: "mateIn5", label: "Mate in 5+", icon: Target, description: "Figure out a long mating sequence." },
    ]
  },
  {
    id: "mateThemes",
    title: "Mate Themes",
    description: "Specific checkmating patterns and traps.",
    themes: [
      { id: "anastasiaMate", label: "Anastasia's Mate", icon: Award, description: "A knight and rook team up to trap the opposing king." },
      { id: "arabianMate", label: "Arabian Mate", icon: Medal, description: "A knight and a rook team up to trap the opposing king on a corner." },
      { id: "backRankMate", label: "Back Rank Mate", icon: AlignHorizontalJustifyStart, description: "Checkmate the king on the home rank, when it is trapped there by its own pieces." },
      { id: "balestraMate", label: "Balestra Mate", icon: StarHalf, description: "A bishop delivers the checkmate, while a queen blocks the remaining escape squares." },
      { id: "blindSwineMate", label: "Blind Swine", icon: CheckCircle2, description: "Two rooks team up to mate the king in an area of 2 by 2 squares." },
      { id: "bodenMate", label: "Boden's Mate", icon: Crosshair, description: "Two attacking bishops on criss-crossing diagonals deliver mate." },
      { id: "cornerMate", label: "Corner Mate", icon: BoxSelect, description: "Confine the king to the corner using a rook or queen and a knight." },
      { id: "doubleBishopMate", label: "Double Bishop", icon: Target, description: "Two attacking bishops on adjacent diagonals deliver mate." },
      { id: "dovetailMate", label: "Dovetail Mate", icon: Award, description: "A queen delivers mate to an adjacent king, whose only two escape squares are obstructed." },
      { id: "epauletteMate", label: "Epaulette Mate", icon: Medal, description: "Two adjacent escape squares for a checked king are occupied by other pieces." },
      { id: "hookMate", label: "Hook Mate", icon: StarHalf, description: "Checkmate with a rook, knight, and pawn along with one enemy pawn." },
      { id: "killBoxMate", label: "Kill Box Mate", icon: BoxSelect, description: "A rook is next to the enemy king and supported by a queen." },
      { id: "pillsburyMate", label: "Pillsbury's Mate", icon: Target, description: "The rook delivers checkmate, while the bishop helps to confine it." },
      { id: "morphyMate", label: "Morphy's Mate", icon: Award, description: "Use the bishop to check the king, while your rook helps to confine it." },
      { id: "operaMate", label: "Opera Mate", icon: CheckCircle2, description: "Check the king with a rook and use a bishop to defend the rook." },
      { id: "swallowTailMate", label: "Swallow's Tail", icon: Target, description: "A checkmate pattern that visually resembles the appearance of a swallow's tail." },
      { id: "triangleMate", label: "Triangle Mate", icon: StarHalf, description: "The queen and rook form a triangle around the enemy king." },
      { id: "vukovicMate", label: "VukoviÄ‡ Mate", icon: Crosshair, description: "A rook and knight team up to mate the king, supported by a third piece." },
      { id: "smotheredMate", label: "Smothered Mate", icon: ShieldAlert, description: "A checkmate delivered by a knight in which the mated king is unable to move." },
    ]
  },
  {
    id: "specialMoves",
    title: "Special Moves",
    description: "Tactics involving special chess rules.",
    themes: [
      { id: "castling", label: "Castling", icon: ArrowLeftRight, description: "Bring the king to safety, and deploy the rook for attack." },
      { id: "enPassant", label: "En Passant", icon: MoveDiagonal, description: "A tactic involving the en passant rule, where a pawn can capture an opponent pawn." },
      { id: "promotion", label: "Promotion", icon: ChevronsUp, description: "Promote one of your pawns to a queen or minor piece." },
      { id: "underPromotion", label: "Underpromotion", icon: ChevronUp, description: "Promotion to a knight, bishop, or rook." },
    ]
  },
  {
    id: "goals",
    title: "Goals",
    description: "The primary objective of the puzzle.",
    themes: [
      { id: "equality", label: "Equality", icon: Scale, description: "Come back from a losing position, and secure a draw or a balanced position." },
      { id: "advantage", label: "Advantage", icon: TrendingUp, description: "Seize your chance to get a decisive advantage." },
      { id: "crushing", label: "Crushing", icon: Hammer, description: "Spot the opponent blunder to obtain a crushing advantage." },
      { id: "mate", label: "Checkmate", icon: Crown, description: "Win the game with style." },
    ]
  },
  {
    id: "lengths",
    title: "Lengths",
    description: "Filter by puzzle calculation depth.",
    themes: [
      { id: "oneMove", label: "One-Move", icon: Timer, description: "A puzzle that is only one move long." },
      { id: "short", label: "Short", icon: Timer, description: "Two moves to win." },
      { id: "long", label: "Long", icon: Timer, description: "Three moves to win." },
      { id: "veryLong", label: "Very Long", icon: Timer, description: "Four moves or more to win." },
    ]
  },
  {
    id: "origin",
    title: "Origin",
    description: "The source games of the puzzles.",
    themes: [
      { id: "master", label: "Master Games", icon: Star, description: "Puzzles from games played by titled players." },
      { id: "masterVsMaster", label: "Master vs Master", icon: Users, description: "Puzzles from games between two titled players." },
      { id: "superGM", label: "Super GM Games", icon: Trophy, description: "Puzzles from games played by the best players in the world." },
    ]
  }
];

const PUZZLE_MODES = [
  {
    id: "standard",
    title: "Standard",
    subtitle: "Tactical Training",
    description:
      "Solve puzzles at your own pace. Difficulty adapts to your rating. The core training experience for building calculation depth.",
    icon: Target,
    gradient: "from-violet-500/20 to-indigo-500/20",
    borderGlow: "hover:shadow-violet-500/10",
    accentColor: "text-violet-400",
    accentBg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    id: "storm",
    title: "Puzzle Storm",
    subtitle: "3 Minutes Â· 3 Lives",
    description:
      "Race against the clock to solve as many puzzles as possible in 3 minutes. Three wrong answers and it's over. Sharpen your pattern recognition.",
    icon: Zap,
    gradient: "from-amber-500/20 to-orange-500/20",
    borderGlow: "hover:shadow-amber-500/10",
    accentColor: "text-amber-400",
    accentBg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    id: "streak",
    title: "Puzzle Streak",
    subtitle: "Zero Mistakes Allowed",
    description:
      "How far can you go without a single mistake? Puzzles start easy and get progressively harder. One wrong move ends the streak.",
    icon: Flame,
    gradient: "from-rose-500/20 to-pink-500/20",
    borderGlow: "hover:shadow-rose-500/10",
    accentColor: "text-rose-400",
    accentBg: "bg-rose-500/10 border-rose-500/20",
  },
];

const MiniBoardPreview = ({
  fen,
  size = 200,
}: {
  fen: string;
  size?: number;
}) => {
  const boardTheme = themeManifest.defaultBoardTheme;
  const pieceTheme = themeManifest.defaultPieceTheme;

  let board: (string | null)[][] = [];
  try {
    const game = new Chess(fen);
    board = game.board().map((row) =>
      row.map((p) => (p ? `${p.color}${p.type}` : null))
    );
  } catch {
    board = Array.from({ length: 8 }, () => Array(8).fill(null));
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-[var(--border)] shadow-lg"
      style={{ width: size, height: size }}
    >
      <Image
        src={BOARD_THEME_ASSETS[boardTheme] ?? `/boards/${boardTheme}.png`}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-cover"
        unoptimized
      />
      <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
        {board.map((row, ri) =>
          row.map((code, ci) => (
            <div key={`${ri}-${ci}`} className="relative flex items-center justify-center p-[5%]">
              {code && (
                <Image
                  src={`${PIECE_THEME_ASSETS[pieceTheme] ?? `/pieces/${pieceTheme}/150`}/${code}.png`}
                  alt={code}
                  fill
                  sizes={`${Math.floor(size / 8)}px`}
                  className="object-contain p-[5%] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                  unoptimized
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const StatItem = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) => (
  <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] min-w-[100px]">
    <Icon className="w-4 h-4 text-[var(--text-dimmed)]" />
    <span className="text-[22px] font-bold text-[var(--text-primary)] tabular-nums">{value}</span>
    <span className="text-[11px] font-semibold text-[var(--text-dimmed)] uppercase tracking-[0.1em]">
      {label}
    </span>
  </div>
);

export default function PuzzlesClientPage({
  initialDailyPuzzle,
}: {
  initialDailyPuzzle: PuzzleEntry | null;
}) {
  const router = useRouter();
  const { toggleTheme, isDark } = useTheme();
  const { progress, authenticated, importNotice, syncStatus, dismissImportNotice, dismissSyncError } = usePuzzleProgress();
  const [showDashboardOverlay, setShowDashboardOverlay] = useState(false);

  const dailyDisplayFen = useMemo(() => {
    if (!initialDailyPuzzle) return null;
    try {
      const game = new Chess(initialDailyPuzzle.fen);
      const firstMove = initialDailyPuzzle.moves[0];
      if (firstMove) {
        game.move({
          from: firstMove.slice(0, 2) as Square,
          to: firstMove.slice(2, 4) as Square,
          promotion: (firstMove[4] as "q" | "r" | "b" | "n") || undefined,
        });
      }
      return game.fen();
    } catch {
      return initialDailyPuzzle.fen;
    }
  }, [initialDailyPuzzle]);

  const playerSide = useMemo(() => {
    if (!initialDailyPuzzle) return "White";
    try {
      const game = new Chess(initialDailyPuzzle.fen);
      const firstMove = initialDailyPuzzle.moves[0];
      if (firstMove) {
        game.move({
          from: firstMove.slice(0, 2) as Square,
          to: firstMove.slice(2, 4) as Square,
          promotion: (firstMove[4] as "q" | "r" | "b" | "n") || undefined,
        });
      }
      return game.turn() === "w" ? "White" : "Black";
    } catch {
      return "White";
    }
  }, [initialDailyPuzzle]);

  const stats = progress.summary;

  return (
    <div className="min-h-screen flex flex-col items-center overflow-x-hidden bg-[var(--bg)]">
      <header className="w-full max-w-[1400px] px-6 py-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-[26px] font-serif tracking-normal font-[800] text-[var(--text-primary)] cursor-pointer select-none"
        >
          CHESS
        </Link>

        <nav className="hidden lg:flex items-center space-x-10 text-[14px] font-medium text-[var(--text-secondary)]">
          <Link href="/puzzles" className="text-[var(--text-primary)] transition-colors">
            Puzzles
          </Link>
          <Link href="/learn" className="hover:text-[var(--text-primary)] transition-colors">
            Learn
          </Link>
          <Link href="/play/computer" className="hover:text-[var(--text-primary)] transition-colors">
            Play Bot
          </Link>
          <Link href="/whats-new" className="hover:text-[var(--text-primary)] transition-colors">What&apos;s New</Link>
          <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Social</a>
          <div className="flex items-center space-x-1 cursor-pointer hover:text-[var(--text-primary)] transition-colors">
            <span>More</span>
            <ChevronDown className="w-4 h-4 ml-[2px]" strokeWidth={2.5} />
          </div>
        </nav>

        <div className="flex items-center space-x-5 text-[14px] font-medium">
          <button
            onClick={toggleTheme}
            data-theme-toggle
            className="p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all duration-300 shadow-sm"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <AuthMenu />
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1200px] px-6 py-12 mb-20 md:py-16">
        <div className="mb-8">
          <PuzzleSyncBanner
            status={syncStatus}
            notice={importNotice}
            onDismissNotice={dismissImportNotice}
            onDismissError={dismissSyncError}
          />
        </div>
        <div className="mb-14 md:mb-18">
          <Link
            href="/"
            className="inline-flex items-center text-[var(--text-dimmed)] hover:text-[var(--text-primary)] transition-colors mb-6 text-[14px] font-medium group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Link>
          <h1 className="text-[44px] md:text-[64px] font-serif text-[var(--text-primary)] font-[500] leading-[1.1] tracking-[-0.02em]">
            Puzzles
          </h1>
          <p className="mt-6 text-[var(--text-muted)] text-xl font-medium max-w-2xl leading-relaxed">
            Sharpen your tactical vision with 5,882,680 puzzles from real games.
            Train at your own pace, race the clock, or challenge your streak.
          </p>
        </div>

        {initialDailyPuzzle && dailyDisplayFen && (
          <Link href={`/puzzles/solve?mode=daily&id=${initialDailyPuzzle.id}`}>
            <div className="mb-14 group relative rounded-2xl border border-[var(--border)] hover:border-[var(--border-hover)] bg-gradient-to-br from-[var(--card-from)] to-[var(--card-to)] p-8 md:p-10 shadow-[var(--shadow-card)] hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[var(--glow-orb)] blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex-shrink-0 mx-auto md:mx-0">
                  <MiniBoardPreview fen={dailyDisplayFen} size={220} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">
                      <Star className="w-3.5 h-3.5" />
                      Daily Puzzle
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--text-dimmed)]">
                      {new Date().toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {progress.dailyStatus.completed && (
                      <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-400">
                        Solved
                      </span>
                    )}
                  </div>

                  <h2 className="text-[28px] md:text-[36px] font-serif text-[var(--text-primary)] font-[500] leading-tight mb-4">
                    Find the best move for {playerSide}
                  </h2>

                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                      Rating {initialDailyPuzzle.rating}
                    </span>
                    {initialDailyPuzzle.themes.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] capitalize"
                      >
                        {t.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                    ))}
                  </div>

                  <div className="inline-flex items-center gap-2 text-[14px] font-bold text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 duration-300">
                    Solve Now
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        )}

        <div className="mb-14">
          <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--text-dimmed)] mb-6">
            Training Modes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PUZZLE_MODES.map((mode) => {
              const Icon = mode.icon;
              const bestScore =
                mode.id === "storm"
                  ? stats.bestStormScore
                  : mode.id === "streak"
                    ? stats.bestStreakScore
                    : stats.puzzlesSolved;
              const bestLabel =
                mode.id === "standard" ? "Solved" : "Best";

              return (
                <Link
                  key={mode.id}
                  href={`/puzzles/solve?mode=${mode.id}`}
                >
                  <div
                    className={`group relative rounded-2xl border border-[var(--border)] hover:border-[var(--border-hover)] bg-gradient-to-br ${mode.gradient} p-7 shadow-[var(--shadow-card)] hover:shadow-2xl ${mode.borderGlow} transition-all duration-300 cursor-pointer hover:-translate-y-1 overflow-hidden h-full`}
                  >
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-[var(--glow-orb)] blur-3xl pointer-events-none opacity-60" />

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div
                          className={`w-12 h-12 rounded-xl ${mode.accentBg} border flex items-center justify-center`}
                        >
                          <Icon className={`w-6 h-6 ${mode.accentColor}`} />
                        </div>
                        {bestScore > 0 && (
                          <span className="text-[12px] font-bold text-[var(--text-dimmed)] tabular-nums">
                            {bestLabel}: {bestScore}
                          </span>
                        )}
                      </div>

                      <h3 className="text-[22px] font-serif text-[var(--text-primary)] font-[500] mb-1">
                        {mode.title}
                      </h3>
                      <p className={`text-[12px] font-bold uppercase tracking-[0.12em] ${mode.accentColor} mb-3`}>
                        {mode.subtitle}
                      </p>
                      <p className="text-[14px] text-[var(--text-muted)] leading-relaxed font-medium">
                        {mode.description}
                      </p>

                      <div className="mt-6 flex items-center gap-2 text-[13px] font-bold text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 duration-300">
                        Start Training
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mb-14">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--text-dimmed)]">
              Your Progress
            </h2>
            <button
              onClick={() => {
                if (!authenticated) {
                  setShowDashboardOverlay(true);
                  return;
                }
                router.push("/puzzles/dashboard");
              }}
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--text-primary)] text-[var(--bg)] text-[14px] font-bold hover:opacity-90 transition-all shadow-sm"
            >
              View Dashboard
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--card-from)] to-[var(--card-to)] p-7 shadow-[var(--shadow-card)]">
            <p className="mb-5 text-[13px] text-[var(--text-dimmed)] font-medium">
              {progress.dataSource === "server"
                ? "Signed-in progress is synced from your server-backed puzzle history."
                : authenticated
                  ? "Signed in, but still using local puzzle progress until account sync finishes."
                  : "You are viewing local puzzle progress. Sign in to auto-sync replay queues, daily completion, and analytics on first login."}
            </p>
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              <StatItem label="Rating" value={stats.currentRating} icon={TrendingUp} />
              <StatItem label="Solved" value={stats.puzzlesSolved} icon={Trophy} />
              <StatItem label="Streak" value={stats.currentStreak} icon={Flame} />
              <StatItem label="Best Storm" value={stats.bestStormScore} icon={Zap} />
              <StatItem label="Best Streak" value={stats.bestStreakScore} icon={BarChart3} />
            </div>
          </div>
        </div>

        <div className="mb-14">
          <div className="mb-10 text-center md:text-left">
            <h2 className="text-[32px] md:text-[40px] font-serif text-[var(--text-primary)] font-[500] leading-tight mb-4">
              Train by Theme
            </h2>
            <p className="text-[16px] text-[var(--text-muted)] font-medium max-w-2xl">
              Focus on specific tactical motifs, checkmating patterns, or phases of the game to eliminate your weaknesses.
            </p>
          </div>

          <div className="flex flex-col gap-12">
            {THEME_CATEGORIES.map((category) => (
              <div key={category.id}>
                <div className="mb-6 flex items-baseline gap-4 border-b border-[var(--border)] pb-2">
                  <h3 className="text-[18px] font-bold text-[var(--text-primary)] uppercase tracking-[0.08em]">
                    {category.title}
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {category.themes.map((theme) => {
                    const themeStat = progress.themeStats[theme.id];
                    const solved = themeStat?.solved ?? 0;
                    const Icon = theme.icon;

                    return (
                      <Link
                        key={theme.id}
                        href={`/puzzles/solve?mode=standard&theme=${theme.id}`}
                      >
                        <div className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)] shadow-sm hover:shadow-md p-5 transition-all duration-300 cursor-pointer hover:-translate-y-1 h-full flex flex-col">
                          <div className="mb-4 w-10 h-10 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--border-hover)] transition-colors">
                            <Icon className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
                          </div>

                          <h4 className="text-[15px] font-bold text-[var(--text-primary)] mb-1">
                            {theme.label}
                          </h4>
                          <p className="text-[12px] text-[var(--text-dimmed)] font-medium leading-relaxed flex-1">
                            {theme.description}
                          </p>

                          {solved > 0 && (
                            <div className="mt-4 pt-3 border-t border-[var(--border)]">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-dimmed)] uppercase tracking-[0.08em]">
                                <Trophy className="w-3 h-3 text-emerald-500/70" />
                                {solved} Solved
                              </span>
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-24 pt-12 border-t border-[var(--border)]">
          <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface-alt)] to-[var(--bg)] p-10 md:p-14 shadow-2xl text-center max-w-4xl mx-auto relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-40 bg-rose-500/10 blur-[80px] rounded-full pointer-events-none" />

            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 mb-6 shadow-[0_0_20px_rgba(244,63,94,0.15)]">
                <Heart className="w-8 h-8 fill-rose-500/20" />
              </div>

              <h2 className="text-[32px] md:text-[40px] font-serif text-[var(--text-primary)] font-[500] mb-4">
                Powered by the Community
              </h2>

              <p className="text-[16px] md:text-[18px] text-[var(--text-muted)] leading-relaxed mb-10 max-w-2xl mx-auto font-medium">
                Our platform features 5,882,680 tactical puzzles completely in the public domain.
                This incredible resource is made possible by the games of millions of players and the dedication
                of the <strong className="text-[var(--text-primary)]">Lichess.org</strong> open-source team.
              </p>

              <a
                href="https://database.lichess.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-hover)] text-[15px] text-[var(--text-primary)] font-bold hover:border-rose-500/30 hover:bg-rose-500/5 hover:text-rose-400 transition-all duration-300 shadow-sm"
              >
                Explore the Open Database
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </main>

      <PuzzleLoginOverlay
        open={showDashboardOverlay}
        title="Sync your puzzle records"
        description="Dashboard insights, replay queues, and saved puzzle records work best when they are tied to your account. Sign in to store them permanently, or continue locally for this session."
        nextHref="/login?next=%2Fpuzzles%2Fdashboard"
        onClose={() => setShowDashboardOverlay(false)}
        onContinueLocal={() => {
          setShowDashboardOverlay(false);
          router.push("/puzzles/dashboard");
        }}
      />
    </div>
  );
}
