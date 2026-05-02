"use client";

import { useState } from "react";
import { ChevronDown, Menu, X, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/lib/theme-context";
import { AuthMenu } from "@/components/auth-menu";

export default function Navbar() {
  const { theme, toggleTheme, isDark } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 z-50 w-full max-w-[1400px] left-1/2 -translate-x-1/2 px-6 py-6 max-[1024px]:px-4 max-[480px]:py-4 flex items-center justify-between backdrop-blur-md transition-colors duration-300">
        <Link href="/" className="text-[26px] font-serif tracking-normal font-[800] text-[var(--text-primary)] cursor-pointer select-none">
          CHESS
        </Link>

        <nav className="hidden lg:flex items-center space-x-10 text-[14px] font-medium text-[var(--text-secondary)]">
          <Link href="/puzzles" className="hover:text-[var(--text-primary)] transition-colors">Puzzles</Link>
          <Link href="/learn" className="hover:text-[var(--text-primary)] transition-colors">Learn</Link>
          <Link href="/play/computer" className="hover:text-[var(--text-primary)] transition-colors">Play Bot</Link>
          <Link href="/leaderboard" className="hover:text-[var(--text-primary)] transition-colors">Leaderboard</Link>
          <Link href="/whats-new" className="hover:text-[var(--text-primary)] transition-colors">What&apos;s New</Link>
          <div className="flex items-center space-x-1 cursor-pointer hover:text-[var(--text-primary)] transition-colors">
            <span>More</span>
            <ChevronDown className="w-4 h-4 ml-[2px]" strokeWidth={2.5} />
          </div>
        </nav>

        <div className="flex items-center space-x-5 text-[14px] font-medium max-[1024px]:space-x-3">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all duration-300 shadow-sm"
          >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <div className="flex items-center space-x-5 max-[1024px]:hidden">
            <AuthMenu />
          </div>
          <button
            className="hidden max-[1024px]:flex p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all duration-300"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[var(--bg)] pt-24 px-6 flex flex-col lg:hidden overflow-y-auto">
          <nav className="flex flex-col space-y-6 text-xl font-medium text-[var(--text-primary)]">
            <Link href="/puzzles" onClick={() => setIsMobileMenuOpen(false)}>Puzzles</Link>
            <Link href="/learn" onClick={() => setIsMobileMenuOpen(false)}>Learn</Link>
            <Link href="/play/computer" onClick={() => setIsMobileMenuOpen(false)}>Play Bot</Link>
            <Link href="/leaderboard" onClick={() => setIsMobileMenuOpen(false)}>Leaderboard</Link>
            <Link href="/whats-new" onClick={() => setIsMobileMenuOpen(false)}>What&apos;s New</Link>
          </nav>
          <div className="mt-auto pb-10 pt-6 flex items-center space-x-6">
            <AuthMenu />
          </div>
        </div>
      )}
    </>
  );
}
