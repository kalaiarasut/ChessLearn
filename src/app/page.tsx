import { ChevronDown, Play, Bot } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center overflow-x-hidden">
      {/* Navbar */}
      <header className="w-full max-w-[1400px] px-6 py-8 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-[26px] font-serif tracking-normal font-[800] text-white cursor-pointer select-none">
          CHESS
        </Link>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-10 text-[14px] font-medium text-[#adadad]">
          <a href="#" className="hover:text-white transition-colors">Puzzles</a>
          <Link href="/learn" className="hover:text-white transition-colors">Learn</Link>
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

      {/* Main Hero Content */}
      <main className="flex-1 flex flex-col items-center text-center w-full px-4 mt-6 md:mt-16">
        <h1 className="text-[52px] md:text-[80px] font-serif text-[#ffffff] font-[500] leading-[1.05] max-w-4xl mx-auto tracking-normal lg:tracking-[-0.02em] [text-shadow:0_0_1px_rgba(255,255,255,0.1)]">
          Play Chess Online<br />on the #1 Site!
        </h1>
        
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6 mt-8 text-[#9b9b9b] text-[16px] font-medium">
          <div><span className="text-white font-[600]">18,123,165+</span> Games Today</div>
          <div><span className="text-white font-[600]">301,512</span> Playing Now</div>
        </div>

        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-5 mt-12 w-full max-w-md sm:max-w-none justify-center">
          <button className="w-full sm:w-auto flex items-center justify-center px-10 py-5 bg-[#ffffff] text-[#161616] rounded-full font-bold text-xl hover:bg-gray-200 transition-colors shadow-[0_0_40px_rgba(255,255,255,0.1)]">
            {/* Custom SVG for Knight */}
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="mr-3"
            >
              <path d="M12 22v-3" />
              <path d="M5.5 19H18.5" />
              <path d="M10 19c-1-2-1-4-1-6" />
              <path d="M14 19c1-2 1-4 1-6" />
              <path d="M7 13c1.5 0 3-1.5 3-3.5S8.5 6 7 6" />
              <path d="M17 13c-1.5 0-3-1.5-3-3.5S15.5 6 17 6" />
              <path d="M12 6c0-2-1-4-1-4h2s-1 2-1 4" />
            </svg>
            Play Online
          </button>
          
          <button className="w-full sm:w-auto flex items-center justify-center px-10 py-5 bg-[#262522] border-none text-[#e0e0e0] rounded-full font-bold text-xl hover:bg-[#33312e] transition-colors shadow-lg">
            <Bot className="w-6 h-6 mr-3 text-[#b3b3b3]" />
            Play Bots
          </button>
        </div>

        {/* Video / 3D Chessboard container */}
        <div className="w-full max-w-[1000px] mt-24 relative mb-24 aspect-[16/10] overflow-hidden flex items-center justify-center group" style={{ maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", mixBlendMode: "lighten" }}>
          
          <video 
            src="/chessboard.mp4" 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="w-full h-full object-cover z-0 grayscale"
          />

        </div>
      </main>
    </div>
  );
}
