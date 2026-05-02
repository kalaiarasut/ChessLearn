"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy, Target, Zap, Flame, Calendar, Play, LogIn } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";
import { KpiCard } from "./_components/KpiCard";
import { THEME_CATEGORIES } from "../theme-categories";
import { buildThemeDashboardRows, calculateThemePerformance } from "@/lib/puzzle-progress";
import { usePuzzleProgress } from "@/lib/use-puzzle-progress";
import { PuzzleLoginOverlay } from "../_components/PuzzleLoginOverlay";
import { PuzzleSyncBanner } from "../_components/PuzzleSyncBanner";

const RADAR_THEMES = [
  "advancedPawn",
  "mate",
  "deflection",
  "discoveredAttack",
  "endgame",
  "fork",
  "kingsideAttack",
  "middlegame",
  "rookEndgame",
  "pin",
];

function resolveThemeLabel(themeId: string) {
  for (const category of THEME_CATEGORIES) {
    const theme = category.themes.find((entry) => entry.id === themeId);
    if (theme) {
      return theme.label;
    }
  }
  return themeId;
}

export default function DashboardPage() {
  const router = useRouter();
  const { progress, authenticated, importNotice, syncStatus, dismissImportNotice, dismissSyncError, loading } = usePuzzleProgress();
  const [timeRange, setTimeRange] = useState(30);
  const [referenceTime] = useState(() => Date.now());
  const [showReplayOverlay, setShowReplayOverlay] = useState(false);

  const cutoffTime = timeRange === 0 ? 0 : referenceTime - timeRange * 24 * 60 * 60 * 1000;
  const filteredActivity = useMemo(
    () => progress.recentActivity.filter((entry) => new Date(entry.timestamp).getTime() >= cutoffTime),
    [cutoffTime, progress.recentActivity],
  );
  const filteredHistory = useMemo(
    () => progress.ratingHistory.filter((entry) => new Date(entry.date).getTime() >= cutoffTime),
    [cutoffTime, progress.ratingHistory],
  );

  const totalPlayed = filteredActivity.length;
  const totalSolved = filteredActivity.filter((entry) => entry.solved).length;
  const solvedPercent = totalPlayed > 0 ? (totalSolved / totalPlayed) * 100 : 0;
  const stormActivityCount = filteredActivity.filter((entry) => entry.mode === "storm").length;
  const streakActivityCount = filteredActivity.filter((entry) => entry.mode === "streak").length;
  const reviewActivityCount = filteredActivity.filter((entry) => entry.mode === "review").length;
  const themeRows = useMemo(
    () =>
      buildThemeDashboardRows(progress.themeStats, progress.summary.currentRating, progress.reviewThemeCounts).sort(
        (left, right) => right.solved - left.solved,
      ),
    [progress.reviewThemeCounts, progress.summary.currentRating, progress.themeStats],
  );

  const radarData = RADAR_THEMES.map((themeId) => {
    const stats = progress.themeStats[themeId];
    const performance = stats
      ? calculateThemePerformance(progress.summary.currentRating, stats.solved, stats.failed)
      : "?";
    return {
      subject: resolveThemeLabel(themeId),
      rating: typeof performance === "number" ? performance : 1200,
      fullMark: 3000,
    };
  });

  const showNoHistory = !loading && progress.summary.puzzlesSolved + progress.summary.puzzlesFailed === 0;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[36px] md:text-[44px] font-serif text-[var(--text-primary)] font-[500] leading-tight mb-2">
            Puzzle Dashboard
          </h1>
          <p className="text-[16px] text-[var(--text-muted)] font-medium">
            {progress.dataSource === "server"
              ? "Server-backed puzzle analytics across your account."
              : authenticated
                ? "Signed in, but still showing local puzzle analytics until account sync completes."
                : "Local puzzle analytics. Sign in to auto-sync replay queues, daily completion, and cross-device history on first login."}
          </p>
        </div>

        <select
          value={timeRange}
          onChange={(event) => setTimeRange(Number(event.target.value))}
          className="bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-primary)] text-[14px] font-semibold rounded-xl px-4 py-2.5 outline-none hover:border-[var(--border-hover)] transition-colors appearance-none cursor-pointer pr-8 bg-no-repeat bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888888%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-12px)_center]"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={0}>All time</option>
        </select>
      </div>

      {!authenticated && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">Sync puzzle progress to your account</p>
            <p className="text-[13px] text-[var(--text-muted)] font-medium mt-1">
              Replay queues and daily completion become canonical once you sign in, and existing local puzzle progress auto-imports on first login.
            </p>
          </div>
          <Link
            href="/login?next=%2Fpuzzles%2Fdashboard"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--cta-bg)] text-[var(--cta-text)] text-[13px] font-bold"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Link>
        </div>
      )}

      <PuzzleSyncBanner
        status={syncStatus}
        notice={importNotice}
        onDismissNotice={dismissImportNotice}
        onDismissError={dismissSyncError}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Played" value={totalPlayed} colorType="neutral" />
        <KpiCard label="Performance" value={progress.summary.currentRating} colorType="performance" />
        <KpiCard label="Solved" value={`${Math.round(solvedPercent)}%`} colorType="solved" solvedPercent={solvedPercent} />
        <KpiCard
          label="To Replay"
          value={progress.replayCount}
          icon={Play}
          colorType="replay"
          onClick={() => {
            if (!authenticated) {
              setShowReplayOverlay(true);
              return;
            }
            router.push("/puzzles/dashboard/improvement-areas");
          }}
        />
      </div>

      {showNoHistory && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-10 text-center">
          <Target className="w-8 h-8 mx-auto mb-3 text-[var(--text-dimmed)] opacity-40" />
          <h2 className="text-[24px] font-serif text-[var(--text-primary)] mb-2">No puzzle history yet</h2>
          <p className="text-[14px] text-[var(--text-muted)] font-medium mb-5">
            Solve a few puzzles and this dashboard will start charting rating, weak themes, and replay pressure.
          </p>
          <Link
            href="/puzzles/solve?mode=standard"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--cta-bg)] text-[var(--cta-text)] text-[13px] font-bold"
          >
            Start Training
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-6 flex flex-col items-center">
          <h3 className="text-[16px] font-bold text-[var(--text-primary)] w-full text-center mb-6">Theme Profile</h3>
          <div className="w-full h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text-dimmed)", fontSize: 11, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 3000]} tick={false} axisLine={false} />
                <Radar name="Rating" dataKey="rating" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", borderRadius: "8px" }}
                  itemStyle={{ color: "#f59e0b", fontWeight: "bold" }}
                  formatter={(value: ValueType | undefined) => [value ?? "-", "Rating"]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-6">
          <h3 className="text-[16px] font-bold text-[var(--text-primary)] mb-6">Rating History</h3>
          <div className="w-full h-[350px]">
            {filteredHistory.length < 2 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
                <Target className="w-8 h-8 opacity-20" />
                <p className="text-[14px] font-medium">Solve more puzzles to see your rating history.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(tick) => new Date(tick).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    tick={{ fill: "var(--text-dimmed)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis
                    domain={["dataMin - 100", "dataMax + 100"]}
                    tick={{ fill: "var(--text-dimmed)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", borderRadius: "8px" }}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                    itemStyle={{ color: "#8b5cf6", fontWeight: "bold" }}
                  />
                  <Area type="monotone" dataKey="rating" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRating)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)]">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
            <Flame className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dimmed)]">Streak</p>
            <p className="text-[20px] font-bold text-[var(--text-primary)] tabular-nums">{progress.summary.currentStreak}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)]">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dimmed)]">Best Storm</p>
            <p className="text-[20px] font-bold text-[var(--text-primary)] tabular-nums">{progress.summary.bestStormScore}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)]">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dimmed)]">Best Streak</p>
            <p className="text-[20px] font-bold text-[var(--text-primary)] tabular-nums">{progress.summary.bestStreakScore}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)]">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dimmed)]">Daily</p>
            <p className="text-[15px] font-bold text-[var(--text-primary)] mt-1">
              {progress.dailyStatus.completed ? "Solved" : "Not yet"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/puzzles/solve?mode=storm"
          className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-amber-500/10 to-[var(--surface-alt)] p-5 hover:border-[var(--border-hover)] transition-colors"
        >
          <div className="mb-4 flex items-center justify-between">
            <Zap className="w-5 h-5 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-dimmed)]">Timed</span>
          </div>
          <p className="text-[18px] font-bold text-[var(--text-primary)]">Storm Record</p>
          <p className="mt-1 text-[28px] font-bold tabular-nums text-[var(--text-primary)]">{progress.summary.bestStormScore}</p>
          <p className="mt-2 text-[12px] font-medium text-[var(--text-muted)]">{stormActivityCount} storm attempts in this range</p>
        </Link>

        <Link
          href="/puzzles/solve?mode=streak"
          className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-rose-500/10 to-[var(--surface-alt)] p-5 hover:border-[var(--border-hover)] transition-colors"
        >
          <div className="mb-4 flex items-center justify-between">
            <Flame className="w-5 h-5 text-rose-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-dimmed)]">Perfect Run</span>
          </div>
          <p className="text-[18px] font-bold text-[var(--text-primary)]">Streak Record</p>
          <p className="mt-1 text-[28px] font-bold tabular-nums text-[var(--text-primary)]">{progress.summary.bestStreakScore}</p>
          <p className="mt-2 text-[12px] font-medium text-[var(--text-muted)]">{streakActivityCount} streak attempts in this range</p>
        </Link>

        <Link
          href="/puzzles/solve?mode=review"
          className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-sky-500/10 to-[var(--surface-alt)] p-5 hover:border-[var(--border-hover)] transition-colors"
        >
          <div className="mb-4 flex items-center justify-between">
            <Target className="w-5 h-5 text-sky-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-dimmed)]">Review</span>
          </div>
          <p className="text-[18px] font-bold text-[var(--text-primary)]">Replay Queue</p>
          <p className="mt-1 text-[28px] font-bold tabular-nums text-[var(--text-primary)]">{progress.replayCount}</p>
          <p className="mt-2 text-[12px] font-medium text-[var(--text-muted)]">{reviewActivityCount} review attempts in this range</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] overflow-hidden">
          <div className="p-6 border-b border-[var(--border)]">
            <h3 className="text-[16px] font-bold text-[var(--text-primary)]">Theme Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--surface)] text-[12px] font-bold uppercase tracking-wider text-[var(--text-dimmed)]">
                  <th className="p-4 border-b border-[var(--border)]">Theme</th>
                  <th className="p-4 border-b border-[var(--border)]">Played</th>
                  <th className="p-4 border-b border-[var(--border)]">Solved</th>
                  <th className="p-4 border-b border-[var(--border)]">Failed</th>
                  <th className="p-4 border-b border-[var(--border)] text-right">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {themeRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[var(--text-muted)] font-medium">
                      No themes played yet.
                    </td>
                  </tr>
                ) : (
                  themeRows.slice(0, 10).map((row) => (
                    <tr
                      key={row.themeId}
                      className="hover:bg-[var(--surface-hover)] transition-colors border-b border-[var(--border)] last:border-0 group cursor-pointer"
                      onClick={() => router.push(`/puzzles/solve?mode=standard&theme=${row.themeId}`)}
                    >
                      <td className="p-4 font-bold text-[var(--text-primary)] capitalize group-hover:text-violet-400 transition-colors">
                        {resolveThemeLabel(row.themeId)}
                      </td>
                      <td className="p-4 text-[var(--text-secondary)] font-medium">{row.played}</td>
                      <td className="p-4 text-emerald-500 font-medium">{row.solved}</td>
                      <td className="p-4 text-rose-500 font-medium">{row.failed}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="font-bold text-[var(--text-primary)] tabular-nums">{Math.round(row.solvedPercent)}%</span>
                          <div className="w-16 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${row.solvedPercent >= 67 ? "bg-emerald-500" : row.solvedPercent >= 34 ? "bg-amber-500" : "bg-rose-500"}`}
                              style={{ width: `${row.solvedPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] overflow-hidden flex flex-col h-[500px] lg:h-auto">
          <div className="p-6 border-b border-[var(--border)] flex-shrink-0">
            <h3 className="text-[16px] font-bold text-[var(--text-primary)]">Recent Activity</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {filteredActivity.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] font-medium">
                No recent activity.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredActivity.slice(0, 20).map((activity, index) => {
                  const themeName = resolveThemeLabel(activity.theme);
                  const minutesAgo = (referenceTime - new Date(activity.timestamp).getTime()) / 60000;
                  const timeLabel =
                    minutesAgo < 60
                      ? `${Math.floor(minutesAgo)}m ago`
                      : minutesAgo < 1440
                        ? `${Math.floor(minutesAgo / 60)}h ago`
                        : `${Math.floor(minutesAgo / 1440)}d ago`;

                  return (
                    <Link key={index} href={`/puzzles/solve?mode=standard&id=${activity.puzzleId}`}>
                      <div className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--surface)] transition-colors">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              activity.solved
                                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                            }`}
                          />
                          <div className="flex flex-col">
                            <span className="text-[13px] font-bold text-[var(--text-primary)] capitalize">{themeName}</span>
                            <span className="text-[11px] font-medium text-[var(--text-dimmed)]">{timeLabel}</span>
                          </div>
                        </div>
                        <div className="px-2.5 py-1 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)]">
                          {activity.rating}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <PuzzleLoginOverlay
        open={showReplayOverlay}
        title="Sign in for replay queues"
        description="Replay mode stores missed puzzles and improvement work against your account. Sign in to keep those records, or continue exploring your local dashboard without synced replay."
        nextHref="/login?next=%2Fpuzzles%2Fdashboard"
        onClose={() => setShowReplayOverlay(false)}
        onContinueLocal={() => setShowReplayOverlay(false)}
        continueLocalLabel="Stay on Dashboard"
      />
    </div>
  );
}
