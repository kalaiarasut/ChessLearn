"use client";
import Link from "next/link";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { AuthMenu } from "@/components/auth-menu";

export function DashboardHeader() {
  const { toggleTheme, isDark } = useTheme();

  return (
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
  );
}
