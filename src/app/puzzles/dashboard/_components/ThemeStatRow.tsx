"use client";
import Link from "next/link";
import { Play } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { useRouter } from "next/navigation";

type ThemeStatRowProps = {
  themeId: string;
  themeName: string;
  description: string;
  played: number;
  performance: number | string;
  solvedPercent: number;
  toReplay: number;
};

export function ThemeStatRow({
  themeId,
  themeName,
  description,
  played,
  performance,
  solvedPercent,
  toReplay,
}: ThemeStatRowProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] hover:border-[var(--border-hover)] transition-colors">
      <div className="flex-1">
        <Link href={`/puzzles/solve?mode=standard&theme=${themeId}`} className="group inline-flex flex-col">
          <h3 className="text-[18px] font-bold text-[var(--text-primary)] uppercase tracking-[0.08em] group-hover:text-violet-400 transition-colors mb-1">
            {themeName}
          </h3>
          <p className="text-[13px] text-[var(--text-dimmed)] font-medium leading-relaxed max-w-md">
            {description}
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
        <KpiCard label="Played" value={played} colorType="neutral" />
        <KpiCard label="Performance" value={performance} colorType="performance" />
        <KpiCard label="Solved" value={`${Math.round(solvedPercent)}%`} colorType="solved" solvedPercent={solvedPercent} />
        <KpiCard
          label="To Replay"
          value={toReplay}
          icon={Play}
          colorType="replay"
          onClick={() => router.push(`/puzzles/solve?mode=standard&theme=${themeId}`)}
        />
      </div>
    </div>
  );
}
