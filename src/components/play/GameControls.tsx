import React from "react";
import { SkipBack, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";

interface GameControlsProps {
  onFirstMove?: () => void;
  onPrevMove?: () => void;
  onNextMove?: () => void;
  onLastMove?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
}

export function GameControls({
  onFirstMove,
  onPrevMove,
  onNextMove,
  onLastMove,
  canGoBack = false,
  canGoForward = false,
}: GameControlsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button 
        onClick={onFirstMove}
        disabled={!canGoBack}
        className={`p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] transition-colors ${
          canGoBack 
            ? "text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:border-[var(--brand)]" 
            : "text-[var(--text-muted)] opacity-50 cursor-not-allowed"
        }`}
      >
        <SkipBack className="w-4 h-4" />
      </button>
      <button 
        onClick={onPrevMove}
        disabled={!canGoBack}
        className={`p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] transition-colors ${
          canGoBack 
            ? "text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:border-[var(--brand)]" 
            : "text-[var(--text-muted)] opacity-50 cursor-not-allowed"
        }`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button 
        onClick={onNextMove}
        disabled={!canGoForward}
        className={`p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] transition-colors ${
          canGoForward 
            ? "text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:border-[var(--brand)]" 
            : "text-[var(--text-muted)] opacity-50 cursor-not-allowed"
        }`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <button 
        onClick={onLastMove}
        disabled={!canGoForward}
        className={`p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] transition-colors ${
          canGoForward 
            ? "text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:border-[var(--brand)]" 
            : "text-[var(--text-muted)] opacity-50 cursor-not-allowed"
        }`}
      >
        <SkipForward className="w-4 h-4" />
      </button>
    </div>
  );
}
