import React from "react";
import Navbar from "@/components/ui/Navbar";
import { getUserProfile } from "@/app/actions/user";
import { notFound } from "next/navigation";
import { Trophy, Swords, Medal, Calendar, ShieldCheck } from "lucide-react";
import GamesHistory from "@/components/ui/GamesHistory";

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  
  // URL decode the username to handle special characters or spaces
  const decodedUsername = decodeURIComponent(username);
  
  const profile = await getUserProfile(decodedUsername);

  if (!profile) {
    notFound();
  }

  const { stats } = profile;

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <Navbar />
      
      <main className="flex-1 w-full max-w-[1000px] mx-auto px-4 md:px-6 pt-32 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Profile Card & Stats */}
          <div className="md:col-span-1 space-y-6">
            
            {/* Profile Info */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center shadow-sm">
              <div className="relative inline-block">
                <img
                  src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}&background=random`}
                  alt={profile.username}
                  className="w-24 h-24 rounded-full object-cover border-4 border-[var(--surface-alt)] shadow-sm"
                />
                {profile.verified && (
                  <div className="absolute bottom-0 right-0 bg-blue-500 text-white p-1 rounded-full border-2 border-[var(--surface)]">
                    <ShieldCheck size={14} />
                  </div>
                )}
              </div>
              
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-4">{profile.username}</h1>
              <div className="flex items-center justify-center gap-1.5 text-[var(--text-secondary)] mt-1 font-mono text-lg">
                <Trophy size={18} className="text-yellow-500" />
                <span>{Math.round(profile.rating)}</span>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-muted)] mt-4 pt-4 border-t border-[var(--border)]">
                <Calendar size={14} />
                <span>Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
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
                  <div className="text-2xl font-bold text-[var(--brand)]">{stats.winRate}%</div>
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
      </main>
    </div>
  );
}
