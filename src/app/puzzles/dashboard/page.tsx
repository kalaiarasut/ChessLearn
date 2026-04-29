"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadClientPreferences, PuzzleClientPreferences } from "@/lib/client-preferences";
import { KpiCard } from "./_components/KpiCard";
import { THEME_CATEGORIES } from "../theme-categories";
import { Trophy, Target, Zap, Flame, Calendar, Play } from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from "recharts";
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";

const RADAR_THEMES = [
  "advancedPawn", "mate", "deflection", "discoveredAttack", "endgame",
  "fork", "kingsideAttack", "middlegame", "rookEndgame", "pin"
];

export default function DashboardPage() {
  const router = useRouter();
  const [prefs] = useState<PuzzleClientPreferences>(() => loadClientPreferences().puzzle);
  const [timeRange, setTimeRange] = useState<number>(30); // days

  // Filter functions based on time range
  const now = new Date().getTime();
  const cutoffTime = timeRange === 0 ? 0 : now - timeRange * 24 * 60 * 60 * 1000;

  const filteredActivity = prefs.recentActivity.filter(a => new Date(a.timestamp).getTime() >= cutoffTime);
  const filteredHistory = prefs.ratingHistory.filter(h => new Date(h.date).getTime() >= cutoffTime);

  // Stats calculations
  const totalPlayed = filteredActivity.length;
  const totalSolved = filteredActivity.filter(a => a.solved).length;
  const totalFailed = totalPlayed - totalSolved;
  const solvedPercent = totalPlayed > 0 ? (totalSolved / totalPlayed) * 100 : 0;

  // Radar Data
  const radarData = RADAR_THEMES.map(themeId => {
    let label = themeId;
    for (const cat of THEME_CATEGORIES) {
      const t = cat.themes.find((t) => t.id === themeId);
      if (t) { label = t.label; break; }
    }

    const stats = prefs.puzzleThemeStats[themeId];
    let rating = 1200; // Default base
    
    if (stats) {
      const played = stats.solved + stats.failed;
      if (played >= 3) {
        const expectedScore = stats.solved / played;
        if (expectedScore > 0 && expectedScore < 1) {
          const ratingDiff = -400 * Math.log10(1 / expectedScore - 1);
          rating = Math.round(prefs.puzzleRating + ratingDiff);
        } else if (expectedScore === 1) {
          rating = prefs.puzzleRating + 200;
        } else {
          rating = Math.max(400, prefs.puzzleRating - 200);
        }
      }
    }
    
    return { subject: label, rating, fullMark: 3000 };
  });

  // Theme Breakdown Table Data
  const tableData = Object.entries(prefs.puzzleThemeStats)
    .map(([themeId, stats]) => {
      let themeName = themeId;
      for (const cat of THEME_CATEGORIES) {
        const t = cat.themes.find((t) => t.id === themeId);
        if (t) { themeName = t.label; break; }
      }
      const played = stats.solved + stats.failed;
      const accuracy = played > 0 ? (stats.solved / played) * 100 : 0;
      return { themeId, themeName, played, solved: stats.solved, failed: stats.failed, accuracy };
    })
    .sort((a, b) => b.solved - a.solved);

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[36px] md:text-[44px] font-serif text-[var(--text-primary)] font-[500] leading-tight mb-2">
            Puzzle Dashboard
          </h1>
          <p className="text-[16px] text-[var(--text-muted)] font-medium">
            Train, analyse, improve
          </p>
        </div>
        
        <select 
          value={timeRange} 
          onChange={(e) => setTimeRange(Number(e.target.value))}
          className="bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-primary)] text-[14px] font-semibold rounded-xl px-4 py-2.5 outline-none hover:border-[var(--border-hover)] transition-colors appearance-none cursor-pointer pr-8 bg-no-repeat bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888888%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-12px)_center]"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={0}>All time</option>
        </select>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Played" value={totalPlayed} colorType="neutral" />
        <KpiCard label="Performance" value={prefs.puzzleRating} colorType="performance" />
        <KpiCard label="Solved" value={`${Math.round(solvedPercent)}%`} colorType="solved" solvedPercent={solvedPercent} />
        <KpiCard 
          label="To Replay" 
          value={totalFailed} 
          icon={Play} 
          colorType="replay" 
          onClick={() => router.push("/puzzles/dashboard/improvement-areas")} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Radar Chart */}
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

        {/* Line Chart */}
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
                    tickFormatter={(tick) => new Date(tick).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    tick={{ fill: "var(--text-dimmed)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis 
                    domain={['dataMin - 100', 'dataMax + 100']} 
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

      {/* Streak & Mode Bests */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)]">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
            <Flame className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dimmed)]">Streak</p>
            <p className="text-[20px] font-bold text-[var(--text-primary)] tabular-nums">{prefs.currentStreak}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)]">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dimmed)]">Best Storm</p>
            <p className="text-[20px] font-bold text-[var(--text-primary)] tabular-nums">{prefs.bestStormScore}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)]">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dimmed)]">Best Streak</p>
            <p className="text-[20px] font-bold text-[var(--text-primary)] tabular-nums">{prefs.bestStreakScore}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)]">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dimmed)]">Daily</p>
            <p className="text-[15px] font-bold text-[var(--text-primary)] mt-1">{prefs.dailyPuzzleSolved ? "Solved" : "Not yet"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Table */}
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
                {tableData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[var(--text-muted)] font-medium">No themes played yet.</td>
                  </tr>
                ) : (
                  tableData.slice(0, 10).map(row => (
                    <tr key={row.themeId} className="hover:bg-[var(--surface-hover)] transition-colors border-b border-[var(--border)] last:border-0 group cursor-pointer" onClick={() => router.push(`/puzzles/solve?mode=standard&theme=${row.themeId}`)}>
                      <td className="p-4 font-bold text-[var(--text-primary)] capitalize group-hover:text-violet-400 transition-colors">{row.themeName}</td>
                      <td className="p-4 text-[var(--text-secondary)] font-medium">{row.played}</td>
                      <td className="p-4 text-emerald-500 font-medium">{row.solved}</td>
                      <td className="p-4 text-rose-500 font-medium">{row.failed}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="font-bold text-[var(--text-primary)] tabular-nums">{Math.round(row.accuracy)}%</span>
                          <div className="w-16 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${row.accuracy >= 67 ? 'bg-emerald-500' : row.accuracy >= 34 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                              style={{ width: `${row.accuracy}%` }}
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

        {/* Recent Activity */}
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
                {filteredActivity.slice(0, 20).map((act, i) => {
                  let themeName = act.theme;
                  for (const cat of THEME_CATEGORIES) {
                    const t = cat.themes.find((t) => t.id === act.theme);
                    if (t) { themeName = t.label; break; }
                  }

                  const timeAgo = (new Date().getTime() - new Date(act.timestamp).getTime()) / 60000;
                  const timeStr = timeAgo < 60 ? `${Math.floor(timeAgo)}m ago` : timeAgo < 1440 ? `${Math.floor(timeAgo/60)}h ago` : `${Math.floor(timeAgo/1440)}d ago`;

                  return (
                    <Link key={i} href={`/puzzles/solve?mode=standard&id=${act.puzzleId}`}>
                      <div className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--surface)] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${act.solved ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                          <div className="flex flex-col">
                            <span className="text-[13px] font-bold text-[var(--text-primary)] capitalize">{themeName}</span>
                            <span className="text-[11px] font-medium text-[var(--text-dimmed)]">{timeStr}</span>
                          </div>
                        </div>
                        <div className="px-2.5 py-1 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)]">
                          {act.rating}
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
    </div>
  );
}
