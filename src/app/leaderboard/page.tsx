"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Trophy, Swords, BookOpen, Flame, Medal, User } from "lucide-react";
import LightRays from "@/components/ui/LightRays";
import Navbar from "@/components/ui/Navbar";

type LeaderboardCategory = "puzzle" | "opening" | "activity";

type LeaderboardPlayer = {
  rank: number;
  userId: string;
  name: string;
  rating: number;
  score: number;
  stat: string;
  avatar: string;
  lastActivityAt: string | null;
};

const podiumStyleByRank: Record<number, { height: string }> = {
  1: { height: "h-64" },
  2: { height: "h-48" },
  3: { height: "h-40" },
};

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<LeaderboardCategory>("puzzle");
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tabs = [
    { id: "puzzle", label: "Puzzle Rating", icon: <Swords size={18} /> },
    { id: "opening", label: "Opening Mastery", icon: <BookOpen size={18} /> },
    { id: "activity", label: "Streaks & Activity", icon: <Flame size={18} /> },
  ] satisfies { id: LeaderboardCategory; label: string; icon: React.ReactNode }[];

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/leaderboard?category=${activeTab}&limit=20`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          entries?: LeaderboardPlayer[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Leaderboard is unavailable.");
        }

        if (!cancelled) {
          setPlayers(Array.isArray(payload.entries) ? payload.entries : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setPlayers([]);
          setError(loadError instanceof Error ? loadError.message : "Leaderboard is unavailable.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLeaderboard().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const podiumPlayers = useMemo(() => {
    const byRank = new Map(players.slice(0, 3).map((player) => [player.rank, player]));
    return [2, 1, 3]
      .map((rank) => byRank.get(rank))
      .filter((player): player is LeaderboardPlayer => Boolean(player));
  }, [players]);

  const remainingPlayers = players.slice(3);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] font-sans overflow-x-hidden">
      <Navbar />
      <div className="max-w-5xl mx-auto space-y-12 relative p-8 pt-32">
        
        {/* Header */}
        <div className="text-center space-y-4 pt-10">
          <h1 className="text-5xl font-extrabold tracking-tight flex items-center justify-center gap-4 text-[var(--text-primary)]">
            <Trophy className="text-yellow-400" size={48} />
            Leaderboard
          </h1>
          <p className="text-[var(--text-muted)] text-lg">Top players from around the globe</p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-[var(--text-primary)] text-[var(--bg)] shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                  : "bg-[var(--surface-alt)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Top 3 Stadium */}
        <div className="relative mt-32 pt-56 pb-16 flex items-end justify-center gap-4 sm:gap-8 min-h-[600px]">
          {/* Light Rays for 1st Place */}
          <div 
            className="fixed inset-0 pointer-events-none z-[100]"
            style={{ filter: "brightness(2) contrast(1.5)" }}
          >
            <LightRays
              raysOrigin="top-center"
              raysColor="#ffffff"
              raysSpeed={1.5}
              lightSpread={0.25}
              rayLength={6}
              followMouse={true}
              mouseInfluence={0.05}
              noiseAmount={0}
              distortion={0}
              className="w-full h-full opacity-80"
              pulsating={true}
              fadeDistance={0.6}
              saturation={2}
            />
          </div>

          {podiumPlayers.map((player) => (
            <div key={player.rank} className="relative flex flex-col items-center group z-10 w-28 sm:w-40">
              
              {/* Avatar & Info */}
              <div 
                className="absolute flex flex-col items-center transition-transform duration-500 group-hover:-translate-y-4"
                style={{ bottom: "100%", marginBottom: "0.5rem" }}
              >
                {player.rank === 1 && (
                  <div className="absolute -top-12 animate-bounce">
                    <Trophy className="text-yellow-400" size={32} />
                  </div>
                )}
                
                <img 
                  src={player.avatar}
                  alt={player.name}
                  className={`rounded-full border-4 shadow-2xl object-cover ${
                    player.rank === 1 ? "w-24 h-24 border-yellow-400" : "w-16 h-16 border-zinc-500"
                  }`}
                />
                
                <div className="mt-3 text-center bg-[var(--surface-alt)]/90 backdrop-blur-sm px-4 py-2 rounded-xl border border-[var(--border)]">
                  <div className="font-bold text-[var(--text-primary)] whitespace-nowrap">{player.name}</div>
                  <div className={`text-sm font-black ${
                    player.rank === 1 ? "text-yellow-500" : player.rank === 2 ? "text-slate-400" : "text-amber-600"
                  }`}>
                    {player.rating}
                  </div>
                </div>
              </div>

              {/* Pillar */}
              <div 
                className={`w-full ${podiumStyleByRank[player.rank]?.height ?? "h-40"} rounded-t-2xl relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border-t border-l border-r border-[var(--border)]`}
                style={{
                  background: `linear-gradient(to bottom, var(--tw-gradient-stops))`,
                }}
              >
                <div className={`absolute inset-0 bg-gradient-to-b from-[var(--surface-alt)] to-[var(--bg)]`} />
                
                {/* 3D top edge effect */}
                <div className={`absolute top-0 inset-x-0 h-4 bg-gradient-to-r from-transparent via-white/20 to-transparent`} />
                <div className={`absolute top-0 inset-x-0 h-[1px] ${
                  player.rank === 1 ? "bg-yellow-400/50 shadow-[0_0_10px_#eab308]" : "bg-white/20"
                }`} />

                {/* Rank Number */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-7xl font-black ${
                     player.rank === 1 ? "text-yellow-500/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" : player.rank === 2 ? "text-slate-400/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" : "text-amber-600/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                  }`}>
                    {player.rank}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* List Section */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl overflow-hidden backdrop-blur-md relative z-[110]">
          <div className="p-6 md:p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-[var(--text-primary)]">
              <Medal className="text-[var(--text-muted)]" />
              The Contenders
            </h2>
            
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[74px] animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)]"
                  />
                ))
              ) : error ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-5 text-[var(--text-secondary)]">
                  {error}
                </div>
              ) : players.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-5 text-[var(--text-secondary)]">
                  No leaderboard data yet.
                </div>
              ) : (
              remainingPlayers.map((player) => (
                <div 
                  key={player.rank}
                  className="group flex gap-4 items-center bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] transition-colors p-4 rounded-2xl border border-[var(--border)]"
                >
                  <div className="w-8 font-black text-[var(--text-muted)] text-lg">{player.rank}</div>
                  
                  <div className="w-10 h-10 bg-[var(--surface)] rounded-full flex items-center justify-center border border-[var(--border)] overflow-hidden">
                    <User size={20} className="text-[var(--text-muted)]" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-bold text-lg group-hover:text-[var(--text-primary)] text-[var(--text-secondary)] transition-colors">{player.name}</div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-mono font-bold text-xl text-[var(--text-primary)]">{player.rating}</div>
                    <div className="text-xs text-[var(--text-muted)] font-medium tracking-wider uppercase">
                      {activeTab === 'puzzle' ? 'Elo' : activeTab === 'opening' ? 'Mastered' : 'Streak'}
                    </div>
                  </div>
                </div>
              ))
              )}
            </div>
            
            <button className="w-full mt-6 py-4 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] font-semibold hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-all">
              Load More Players
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
