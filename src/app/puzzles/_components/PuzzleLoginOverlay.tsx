"use client";

import Link from "next/link";
import { X } from "lucide-react";

type PuzzleLoginOverlayProps = {
  open: boolean;
  title: string;
  description: string;
  nextHref: string;
  onClose: () => void;
  onContinueLocal?: () => void;
  continueLocalLabel?: string;
};

export function PuzzleLoginOverlay({
  open,
  title,
  description,
  nextHref,
  onClose,
  onContinueLocal,
  continueLocalLabel = "Continue Locally",
}: PuzzleLoginOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <button
        aria-label="Close login overlay"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-2xl">
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-[var(--text-dimmed)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-dimmed)] mb-3">
          Advanced Puzzle Feature
        </p>
        <h3 className="text-[28px] font-serif font-[500] text-[var(--text-primary)] leading-tight mb-3">
          {title}
        </h3>
        <p className="text-[14px] text-[var(--text-muted)] font-medium leading-relaxed mb-6">
          {description}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href={nextHref}
            className="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-[var(--cta-bg)] text-[var(--cta-text)] text-[13px] font-bold"
          >
            Sign In
          </Link>
          {onContinueLocal ? (
            <button
              onClick={onContinueLocal}
              className="px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
            >
              {continueLocalLabel}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
            >
              Maybe Later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
