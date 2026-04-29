"use client";

import { ThemeStatRow } from "../_components/ThemeStatRow";
import { PuzzleSyncBanner } from "../../_components/PuzzleSyncBanner";
import { THEME_CATEGORIES } from "../../theme-categories";
import { buildThemeDashboardRows } from "@/lib/puzzle-progress";
import { usePuzzleProgress } from "@/lib/use-puzzle-progress";

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

export default function StrengthsPage() {
  const { progress, importNotice, syncStatus, dismissImportNotice, dismissSyncError } = usePuzzleProgress();
  const themesData = buildThemeDashboardRows(
    progress.themeStats,
    progress.summary.currentRating,
    progress.reviewThemeCounts,
  )
    .filter((entry) => entry.played >= 3)
    .sort((left, right) => right.solvedPercent - left.solvedPercent)
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
          Strengths
        </h1>
        <p className="text-[16px] text-[var(--text-muted)] font-medium">
          These are the motifs where your conversion rate currently holds up best.
        </p>
      </div>

      {themesData.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-12 text-center">
          <p className="text-[16px] text-[var(--text-muted)] font-medium">
            Solve more puzzles across different themes to discover your strengths.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {themesData.map((theme) => (
            <ThemeStatRow key={theme.themeId} {...theme} />
          ))}
        </div>
      )}
    </div>
  );
}
