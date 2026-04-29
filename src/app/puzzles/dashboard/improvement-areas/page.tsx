"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, RotateCcw } from "lucide-react";
import { ThemeStatRow } from "../_components/ThemeStatRow";
import { THEME_CATEGORIES } from "../../theme-categories";
import { buildThemeDashboardRows } from "@/lib/puzzle-progress";
import { usePuzzleProgress } from "@/lib/use-puzzle-progress";
import { PuzzleLoginOverlay } from "../../_components/PuzzleLoginOverlay";
import { PuzzleSyncBanner } from "../../_components/PuzzleSyncBanner";

function resolveThemeMeta(themeId: string) {
  for (const category of THEME_CATEGORIES) {
    const theme = category.themes.find((entry) => entry.id === themeId);
    if (theme) {
      return {
        label: theme.label,
        description: theme.description,
      };
    }
  }

  return {
    label: themeId,
    description: "",
  };
}

export default function ImprovementAreasPage() {
  const router = useRouter();
  const { progress, authenticated, importNotice, syncStatus, dismissImportNotice, dismissSyncError } = usePuzzleProgress();
  const [showReplayOverlay, setShowReplayOverlay] = useState(false);
  const [pendingReplayThemeId, setPendingReplayThemeId] = useState<string | null>(null);
  const themesData = buildThemeDashboardRows(
    progress.themeStats,
    progress.summary.currentRating,
    progress.reviewThemeCounts,
  )
    .filter((entry) => entry.played >= 3)
    .sort((left, right) => {
      if (right.toReplay !== left.toReplay) {
        return right.toReplay - left.toReplay;
      }
      return left.solvedPercent - right.solvedPercent;
    })
    .map((entry) => {
      const meta = resolveThemeMeta(entry.themeId);
      return {
        themeId: entry.themeId,
        themeName: meta.label,
        description: meta.description,
        played: entry.played,
        solvedPercent: entry.solvedPercent,
        toReplay: entry.toReplay,
        performance: entry.performance,
      };
    });

  return (
    <div>
      <div className="mb-6">
        <PuzzleSyncBanner
          status={syncStatus}
          notice={importNotice}
          onDismissNotice={dismissImportNotice}
          onDismissError={dismissSyncError}
        />
      </div>

      <div className="mb-8">
        <h1 className="text-[36px] md:text-[44px] font-serif text-[var(--text-primary)] font-[500] leading-tight mb-2">
          Improvement areas
        </h1>
        <p className="text-[16px] text-[var(--text-muted)] font-medium">
          Replay pressure and lower-conversion themes rise to the top here.
        </p>
      </div>

      {!authenticated && (
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">Sign in for canonical replay queues</p>
            <p className="text-[13px] text-[var(--text-muted)] font-medium mt-1">
              Anonymous mode still shows local weak-theme stats, but review queues only sync for signed-in users and local puzzle progress auto-imports on first login.
            </p>
          </div>
          <Link
            href="/login?next=%2Fpuzzles%2Fdashboard%2Fimprovement-areas"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--cta-bg)] text-[var(--cta-text)] text-[13px] font-bold"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Link>
        </div>
      )}

      {themesData.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-12 text-center">
          <RotateCcw className="w-8 h-8 mx-auto mb-3 text-[var(--text-dimmed)] opacity-40" />
          <p className="text-[16px] text-[var(--text-muted)] font-medium">
            {authenticated
              ? "No replay-heavy weak spots right now. Keep training and missed themes will appear here."
              : "No weak spots found yet - keep solving puzzles."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {themesData.map((theme) => (
            <ThemeStatRow
              key={theme.themeId}
              {...theme}
              onReplayClick={(themeId) => {
                if (!authenticated) {
                  setPendingReplayThemeId(themeId);
                  setShowReplayOverlay(true);
                  return;
                }
                router.push(`/puzzles/solve?mode=review&theme=${themeId}`);
              }}
            />
          ))}
        </div>
      )}

      <PuzzleLoginOverlay
        open={showReplayOverlay}
        title="Sign in to save replay work"
        description="Replay drills are an account-backed feature. Sign in to save missed puzzles, sync your review queue, and keep your puzzle records across sessions."
        nextHref={
          pendingReplayThemeId
            ? `/login?next=${encodeURIComponent(`/puzzles/solve?mode=review&theme=${pendingReplayThemeId}`)}`
            : "/login?next=%2Fpuzzles%2Fdashboard%2Fimprovement-areas"
        }
        onClose={() => {
          setShowReplayOverlay(false);
          setPendingReplayThemeId(null);
        }}
        onContinueLocal={() => {
          setShowReplayOverlay(false);
          setPendingReplayThemeId(null);
        }}
        continueLocalLabel="Stay on This Page"
      />
    </div>
  );
}
