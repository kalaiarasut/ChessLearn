import React from "react";
import Navbar from "@/components/ui/Navbar";
import { getUserProfile } from "@/app/actions/user";
import { notFound } from "next/navigation";
import { Trophy, Swords, Medal, Calendar, Shield, ShieldCheck, Crosshair, Crown, Milestone, CheckCircle, Award, ChevronRight, Edit2, Zap, Target, Activity, Clock, Flag, Star, Ghost, RefreshCcw, Castle, BookOpen, Skull, TrendingUp, Axe, Split, Box, PanelBottom, CloudRain, Wand2, Diamond, Coins, ArrowUp } from "lucide-react";
import GamesHistory from "@/components/ui/GamesHistory";
import { MiniBoardPreview } from "@/components/discussion/MiniBoardPreview";
import { ACHIEVEMENTS, OPENINGS } from "@/lib/data/gamification";
import EloGraph from "@/components/ui/EloGraph";
import EditableAvatar from "@/components/ui/EditableAvatar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const iconMap: Record<string, any> = {
  Crown, ArrowUp, RefreshCcw, Zap, Shield, ShieldCheck, Crosshair, Ghost, Target, Castle, BookOpen, Skull, TrendingUp, Activity, Clock, Flag, Star, Swords, Axe, Split, Box, PanelBottom, CloudRain, Wand2, Diamond, Coins, Milestone, CheckCircle, Award
};

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const decodedUsername = decodeURIComponent(username);
  const profile = await getUserProfile(decodedUsername);

  if (!profile) {
    notFound();
  }

  const { stats } = profile;

  const supabase = await createSupabaseServerClient();
  const { data: userAch } = await supabase
    .from('user_achievements')
    .select('progress, unlocked_at, achievements(title)')
    .eq('user_id', profile.id);

  const { data: matches } = await supabase
    .from('matches')
    .select('created_at, winner_id, status')
    .or(`white_player_id.eq.${profile.id},black_player_id.eq.${profile.id}`)
    .eq('status', 'finished')
    .order('created_at', { ascending: true });

  const progressMap: Record<string, { current: number, unlocked: boolean }> = {};
  if (userAch) {
    for (const record of userAch as any[]) {
      if (record.achievements?.title) {
        progressMap[record.achievements.title] = {
          current: record.progress,
          unlocked: !!record.unlocked_at
        };
      }
    }
  }

  // Generate real graph data from matches
  let currentSimulatedRating = 1200;
  let netEloDelta = 0;
  const matchHistoryData = (matches || []).map(match => {
    if (match.winner_id === profile.id) {
      currentSimulatedRating += 8;
      netEloDelta += 8;
    } else if (match.winner_id && match.winner_id !== profile.id) {
      currentSimulatedRating -= 8;
      netEloDelta -= 8;
    }
    return {
      date: new Date(match.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      rating: currentSimulatedRating
    };
  });

  // Adjust to anchor at their ACTUAL current rating
  const ratingOffset = Math.round(profile.rating) - currentSimulatedRating;
  const graphData = matchHistoryData.map(d => ({
    date: d.date,
    rating: d.rating + ratingOffset
  }));
  
  if (graphData.length === 0) {
    graphData.push({ date: 'Today', rating: Math.round(profile.rating) });
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <Navbar />
      
      <main className="flex-1 w-full max-w-[1000px] mx-auto px-4 md:px-6 pt-32 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Profile Card & Stats */}
          <div className="md:col-span-1 space-y-6">
            
            {/* Profile Info */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center shadow-sm">
              <EditableAvatar 
                userId={profile.id}
                initialAvatarUrl={profile.avatar_url}
                username={profile.username}
                verified={profile.verified}
              />
              
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-4">{profile.username}</h1>
              <div className="flex items-center justify-center gap-1.5 text-[var(--text-secondary)] mt-1 font-mono text-lg">
                <Trophy size={18} className="text-[var(--text-primary)]" />
                <span>{Math.round(profile.rating)}</span>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-muted)] mt-4 pt-4 border-t border-[var(--border)]">
                <Calendar size={14} />
                <span>Joined {new Date(profile.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Medal size={16} /> Overview
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[var(--surface-alt)] p-3 rounded-xl border border-[var(--border)]">
                  <div className="text-[var(--text-muted)] text-xs font-semibold mb-1">Win Rate</div>
                  <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.winRate}%</div>
                </div>
                <div className="bg-[var(--surface-alt)] p-3 rounded-xl border border-[var(--border)]">
                  <div className="text-[var(--text-muted)] text-xs font-semibold mb-1">Games</div>
                  <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalGames}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">Wins</span>
                  <span className="font-bold text-green-500">{stats.wins}</span>
                </div>
                {/* Visual bar for wins */}
                <div className="w-full h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${stats.totalGames ? (stats.wins / stats.totalGames) * 100 : 0}%` }} />
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">Draws</span>
                  <span className="font-bold text-amber-500">{stats.draws}</span>
                </div>
                <div className="w-full h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${stats.totalGames ? (stats.draws / stats.totalGames) * 100 : 0}%` }} />
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">Losses</span>
                  <span className="font-bold text-red-500">{stats.losses}</span>
                </div>
                <div className="w-full h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${stats.totalGames ? (stats.losses / stats.totalGames) * 100 : 0}%` }} />
                </div>
              </div>
            </div>

            {/* Elo Graph */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-2">
                <TrendingUp size={16} /> Rating Progression
              </h2>
              <EloGraph data={graphData} />
            </div>

          </div>

          {/* Right Column: Match History */}
          <div className="md:col-span-2">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm h-full min-h-[600px]">
              <div className="flex items-center gap-2 mb-6 border-b border-[var(--border)] pb-4">
                <Swords size={20} className="text-[var(--text-secondary)]" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Recent Games</h2>
              </div>
              
              <GamesHistory userId={profile.id} />
            </div>
          </div>
          
        </div>

        {/* Awards & Mastery Full Width Section */}
        <div className="mt-6 flex flex-col gap-6">
          {/* Awards */}
          <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Award className="text-[var(--text-primary)] w-5 h-5" /> Honors & Achievements
              </h2>
              <button className="text-[var(--text-primary)] hover:underline text-sm font-bold transition-colors flex items-center">
                View All <ChevronRight size={16} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ACHIEVEMENTS.map((award, i) => {
                const Icon = iconMap[award.icon] || Award;
                const isLegendary = award.rarity === "Legendary";
                const isEpic = award.rarity === "Epic";
                
                const max = award.maxProgress || 1;
                const state = progressMap[award.title] || { current: 0, unlocked: false };
                const current = state.current;
                const isUnlocked = state.unlocked;
                const progressPercent = max > 0 ? (current / max) * 100 : 0;
                
                // Styling based on unlock state
                const borderStyle = isUnlocked 
                  ? (isLegendary ? 'border-yellow-500/50 hover:border-yellow-500' : isEpic ? 'border-purple-500/50 hover:border-purple-500' : 'border-[var(--border)] hover:border-[var(--text-primary)]')
                  : 'border-[var(--border)] border-dashed opacity-70';
                  
                const iconStyle = isUnlocked
                  ? (isLegendary ? 'bg-yellow-500/20 text-yellow-500' : isEpic ? 'bg-purple-500/20 text-purple-500' : 'bg-[var(--text-primary)] text-[var(--bg)]')
                  : 'bg-[var(--surface)] text-[var(--text-muted)] grayscale';
                
                return (
                  <div key={i} className={`bg-[var(--surface-alt)] border p-4 rounded-xl flex flex-col justify-between gap-3 hover:bg-[var(--surface-hover)] transition-all cursor-pointer group ${borderStyle}`}>
                    <div className="flex items-start gap-3 w-full">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-all shadow-sm ${iconStyle}`}>
                        <Icon size={20} />
                      </div>
                      <div className="flex flex-col flex-1 min-h-[40px]">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className={`font-bold text-[15px] leading-tight ${isUnlocked ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                            {award.title}
                          </h3>
                        </div>
                        <p className={`text-[13px] mt-1 leading-snug line-clamp-2 ${isUnlocked ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
                          {award.desc}
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress Bar Container */}
                    <div className="w-full mt-2">
                      <div className="flex justify-between text-xs font-mono mb-1.5">
                        <span className={isUnlocked ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
                          {isUnlocked ? 'UNLOCKED' : 'IN PROGRESS'}
                        </span>
                        <span className={isUnlocked ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-muted)]'}>
                          {current} / {max}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${isUnlocked ? (isLegendary ? 'bg-yellow-500' : isEpic ? 'bg-purple-500' : 'bg-[var(--text-primary)]') : 'bg-[var(--text-muted)]'}`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Opening Books Mastery */}
          <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Medal className="text-[var(--text-primary)] w-5 h-5" /> Mastered Openings Vault
              </h2>
              <button className="text-[var(--text-primary)] hover:underline text-sm font-bold transition-colors flex items-center">
                View All <ChevronRight size={16} />
              </button>
            </div>
            
            <div className="flex overflow-x-auto gap-4 pb-2 snap-x hide-scrollbar">
              {OPENINGS.map((opening, i) => (
                <div key={i} className="min-w-[240px] w-[240px] shrink-0 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl overflow-hidden snap-center flex flex-col hover:border-[var(--text-primary)] transition-colors cursor-pointer group shadow-sm">
                  <div className="p-3 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface)]">
                    <span className="font-bold text-[14px] text-[var(--text-primary)] truncate pr-2">{opening.name}</span>
                    <CheckCircle size={16} className="text-[var(--text-primary)] shrink-0" />
                  </div>
                  <div className="p-3 flex justify-center bg-[var(--surface-alt)] relative">
                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none" />
                    <div className="w-[200px]">
                      <MiniBoardPreview fenOrPgn={opening.fen} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

      </main>
    </div>
  );
}
