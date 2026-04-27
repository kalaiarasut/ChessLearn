"use client";
import { useEffect, useState } from "react";
import { loadClientPreferences, PuzzleClientPreferences } from "@/lib/client-preferences";
import { ThemeStatRow } from "../_components/ThemeStatRow";
import { THEME_CATEGORIES } from "../../page";

export default function ImprovementAreasPage() {
  const [prefs, setPrefs] = useState<PuzzleClientPreferences | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPrefs(loadClientPreferences().puzzle);
  }, []);

  if (!mounted || !prefs) return null;

  // Calculate stats per theme
  const themesData = Object.entries(prefs.puzzleThemeStats)
    .map(([themeId, stats]) => {
      const played = stats.solved + stats.failed;
      const solvedPercent = played > 0 ? (stats.solved / played) * 100 : 0;
      
      // Calculate pseudo-rating for this theme
      const expectedScore = stats.solved / played;
      const ratingDiff = -400 * Math.log10(1 / expectedScore - 1);
      const performance = played >= 3 && expectedScore > 0 && expectedScore < 1 
        ? Math.round(prefs.puzzleRating + ratingDiff) 
        : "?";

      // Find theme name and description
      let themeName = themeId;
      let description = "";
      for (const cat of THEME_CATEGORIES) {
        const t = cat.themes.find((t) => t.id === themeId);
        if (t) {
          themeName = t.label;
          description = t.description;
          break;
        }
      }

      return { themeId, themeName, description, played, solvedPercent, toReplay: stats.failed, performance };
    })
    .filter((t) => t.played >= 3) // Minimum attempts to qualify
    .sort((a, b) => a.solvedPercent - b.solvedPercent); // Sort lowest first (improvement areas)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[36px] md:text-[44px] font-serif text-[var(--text-primary)] font-[500] leading-tight mb-2">
          Improvement areas
        </h1>
        <p className="text-[16px] text-[var(--text-muted)] font-medium">
          Train these to optimise your progress!
        </p>
      </div>

      {themesData.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-12 text-center">
          <p className="text-[16px] text-[var(--text-muted)] font-medium">
            No weak spots found yet — keep solving puzzles!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {themesData.map((t) => (
            <ThemeStatRow key={t.themeId} {...t} />
          ))}
        </div>
      )}
    </div>
  );
}
