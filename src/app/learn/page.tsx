import Link from "next/link";
import { ChevronDown, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Learn Chess Openings | Play Chess Online",
  description: "Master the most popular chess openings.",
};

const openings = [
  {
    name: "Italian Game",
    moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4",
    description: "A classical opening that develops pieces quickly and controls the center. Perfect for beginners and masters alike."
  },
  {
    name: "Sicilian Defense",
    moves: "1. e4 c5",
    description: "The most popular and best-scoring response to White's first move 1.e4. Highly tactical and aggressive."
  },
  {
    name: "Queen's Gambit",
    moves: "1. d4 d5 2. c4",
    description: "White offers a pawn to gain control of the center. A staple of positional and strategic chess."
  },
  {
    name: "Ruy Lopez",
    moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5",
    description: "Named after a Spanish bishop, this opening aims to apply pressure on the knight defending the e5 pawn."
  },
  {
    name: "French Defense",
    moves: "1. e4 e6",
    description: "A solid and resilient opening for Black that immediately challenges White's central pawn on e4."
  },
  {
    name: "Caro-Kann Defense",
    moves: "1. e4 c6",
    description: "Known for its extreme solidity, Black prepares to challenge the center with d5 on the next move."
  },
  {
    name: "King's Indian Defense",
    moves: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7",
    description: "A hypermodern opening where Black allows White to build a pawn center, aiming to attack it later."
  },
  {
    name: "English Opening",
    moves: "1. c4",
    description: "A flexible and flank opening where White fights for the center using the c-pawn instead of the d or e pawns."
  },
  {
    name: "Scandinavian Defense",
    moves: "1. e4 d5",
    description: "Directly challenging White's central e4 pawn. It leads to open and complex positions."
  }
];

export default function LearnPage() {
  return (
    <div className="min-h-screen flex flex-col items-center overflow-x-hidden">
      {/* Navbar (matching home) */}
      <header className="w-full max-w-[1400px] px-6 py-8 flex items-center justify-between">
        <Link href="/" className="text-[26px] font-serif tracking-normal font-[800] text-white cursor-pointer select-none">
          CHESS
        </Link>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-10 text-[14px] font-medium text-[#adadad]">
          <a href="#" className="hover:text-white transition-colors">Puzzles</a>
          <Link href="/learn" className="text-white transition-colors">Learn</Link>
          <a href="#" className="hover:text-white transition-colors">Watch</a>
          <a href="#" className="hover:text-white transition-colors">News</a>
          <a href="#" className="hover:text-white transition-colors">Social</a>
          <div className="flex items-center space-x-1 cursor-pointer hover:text-white transition-colors">
            <span>More</span>
            <ChevronDown className="w-4 h-4 ml-[2px]" strokeWidth={2.5} />
          </div>
        </nav>

        {/* Auth Buttons */}
        <div className="flex items-center space-x-6 text-[14px] font-medium">
          <a href="#" className="text-[#adadad] hover:text-white transition-colors hidden sm:block">Login</a>
          <a href="#" className="px-6 py-[8px] border border-[#525252] rounded-full text-white hover:bg-white/10 transition-colors">
            Sign In
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1200px] px-6 py-12 mb-20 md:py-20">
        <div className="mb-12 md:mb-16">
          <Link href="/" className="inline-flex items-center text-[#737373] hover:text-white transition-colors mb-6 text-[14px] font-medium group">
            <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Link>
          <h1 className="text-[44px] md:text-[64px] font-serif text-[#ffffff] font-[500] leading-[1.1] tracking-[-0.02em] [text-shadow:0_0_1px_rgba(255,255,255,0.1)]">
            Master the Openings
          </h1>
          <p className="mt-6 text-[#9b9b9b] text-xl font-medium max-w-2xl leading-relaxed">
            Explore the most popular chess openings used by Grandmasters. Learn the core moves, understand the tactical ideas, and improve your early game strategy.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {openings.map((opening, idx) => (
            <div 
              key={idx} 
              className="bg-gradient-to-b from-[#1b1b1b] to-[#121212] border border-[#2a2a2a] hover:border-[#4a4a4a] rounded-2xl p-8 hover:bg-[#222222] transition-all cursor-pointer group shadow-lg hover:shadow-2xl hover:-translate-y-1 duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[26px] font-serif text-white font-[500]">{opening.name}</h2>
              </div>
              <div className="bg-black/80 ring-1 ring-white/5 rounded-lg py-2.5 px-4 mb-5 font-mono text-[14px] font-bold text-[#f1f1f1] inline-block shadow-inner">
                {opening.moves}
              </div>
              <p className="text-[#a0a0a0] text-[15px] leading-relaxed font-medium">
                {opening.description}
              </p>
              <div className="mt-8 flex items-center text-[14px] font-bold text-white opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                Study Opening <span className="ml-2 bg-white text-black px-2 py-1 rounded-md text-xs">&rarr;</span>
              </div>
              <Link href={`/learn/${opening.name.toLowerCase().replace(/\s+/g, '-')}`} className="absolute inset-0 z-10">
                <span className="sr-only">Study {opening.name}</span>
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}