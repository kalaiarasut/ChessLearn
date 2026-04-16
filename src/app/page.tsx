"use client";

import { ChevronDown, Bot, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/lib/theme-context";

export default function Home() {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <div className="min-h-screen flex flex-col items-center overflow-x-hidden bg-[var(--bg)]">
      {/* Navbar */}
      <header className="w-full max-w-[1400px] px-6 py-8 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-[26px] font-serif tracking-normal font-[800] text-[var(--text-primary)] cursor-pointer select-none">
          CHESS
        </Link>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-10 text-[14px] font-medium text-[var(--text-secondary)]">
          <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Puzzles</a>
          <Link href="/learn" className="hover:text-[var(--text-primary)] transition-colors">Learn</Link>
          <Link href="/play/computer" className="hover:text-[var(--text-primary)] transition-colors">Play Bot</Link>
          <a href="#" className="hover:text-[var(--text-primary)] transition-colors">News</a>
          <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Social</a>
          <div className="flex items-center space-x-1 cursor-pointer hover:text-[var(--text-primary)] transition-colors">
            <span>More</span>
            <ChevronDown className="w-4 h-4 ml-[2px]" strokeWidth={2.5} />
          </div>
        </nav>

        {/* Auth Buttons + Theme Toggle */}
        <div className="flex items-center space-x-5 text-[14px] font-medium">
          <button
            onClick={toggleTheme}
            data-theme-toggle
            className="p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all duration-300 shadow-sm"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <Link href="/login" className="relative text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-300 hidden sm:block after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1px] after:bg-[var(--text-primary)] hover:after:w-full after:transition-all after:duration-300">Login</Link>
          <Link href="/signup" className="px-6 py-[8px] border border-transparent bg-[var(--cta-bg)] text-[var(--cta-text)] font-bold rounded-full hover:bg-[var(--cta-hover)] hover:scale-105 transition-all duration-300 relative overflow-hidden group">
            <span className="relative z-10">Sign Up</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:animate-[shimmer_1.5s_infinite]" />
          </Link>
        </div>
      </header>

      {/* Main Hero Content */}
      <main className="flex-1 flex flex-col items-center text-center w-full px-4 mt-6 md:mt-16">
        <h1 className="text-[52px] md:text-[80px] font-serif text-[var(--text-primary)] font-[500] leading-[1.05] max-w-4xl mx-auto tracking-normal lg:tracking-[-0.02em]">
          Play Chess Online<br />on the #1 Site!
        </h1>
        
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6 mt-8 text-[var(--text-muted)] text-[16px] font-medium">
          <div><span className="text-[var(--text-primary)] font-[600]">18,123,165+</span> Games Today</div>
          <div><span className="text-[var(--text-primary)] font-[600]">301,512</span> Playing Now</div>
        </div>

        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-5 mt-12 w-full max-w-md sm:max-w-none justify-center">
          <button className="w-full sm:w-auto flex items-center justify-center px-10 py-5 bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-full font-bold text-xl hover:bg-[var(--cta-hover)] transition-colors shadow-[0_0_40px_rgba(0,0,0,0.1)]">
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
          
          <Link href="/play/computer" className="w-full sm:w-auto flex items-center justify-center px-10 py-5 bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] rounded-full font-bold text-xl hover:bg-[var(--surface-hover)] transition-colors shadow-lg">
            <Bot className="w-6 h-6 mr-3 text-[var(--text-muted)]" />
            Play Bots
          </Link>
        </div>

        {/* Video / 3D Chessboard container */}
        <div className="w-full max-w-[1000px] mt-24 relative mb-24 aspect-[16/10] overflow-hidden flex items-center justify-center group" style={{ maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", mixBlendMode: isDark ? "lighten" : "normal" }}>
          
          <video 
            src="/chessboard.mp4" 
            autoPlay 
            loop 
            muted 
            playsInline 
            className={`w-full h-full object-cover z-0 ${isDark ? "grayscale" : "grayscale-[30%]"}`}
          />

        </div>
      </main>
    </div>
  );
}
