import React from 'react';
import Navbar from '@/components/ui/Navbar';
import { getSupabaseServerClient } from '@/lib/discussion-service';
import Link from 'next/link';
import { Users, Eye, Clock, Activity } from 'lucide-react';
import { MiniBoardPreview } from '@/components/discussion/MiniBoardPreview';

export default async function SpectatePage() {
  const supabase = await getSupabaseServerClient();
  
  // Fetch active matches
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id,
      white_player_id,
      black_player_id,
      pgn,
      created_at,
      status,
      white_player:profiles!matches_white_player_id_fkey(username, rating, avatar_url),
      black_player:profiles!matches_black_player_id_fkey(username, rating, avatar_url)
    `)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <Navbar />
      
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 md:px-6 pt-32 pb-16">
        <div className="flex flex-col gap-8">
          
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold font-serif text-[var(--text-primary)] flex items-center gap-3">
              <Activity className="w-8 h-8 text-[var(--brand)]" />
              Live Spectating
            </h1>
            <p className="text-[var(--text-secondary)]">
              Watch ongoing matches in real-time.
            </p>
          </div>

          {!matches || matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
              <Eye className="w-12 h-12 text-[var(--text-muted)] mb-4" />
              <h2 className="text-xl font-bold text-[var(--text-primary)]">No live games right now</h2>
              <p className="text-[var(--text-muted)] mt-2">Check back later or start a game yourself!</p>
              <Link href="/play/online" className="mt-6 bg-[var(--cta-bg)] hover:bg-[var(--cta-bg-hover)] text-white font-bold py-2 px-6 rounded-full transition-colors">
                Play Online
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.map((match: any) => (
                <Link key={match.id} href={`/spectate/${match.id}`} className="block group">
                  <div className="bg-[var(--surface)] hover:bg-[var(--surface-alt)] border border-[var(--border)] hover:border-[var(--brand)] rounded-2xl overflow-hidden transition-all duration-300">
                    
                    <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-alt)] flex justify-between items-center">
                      <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        LIVE
                      </div>
                      <div className="flex items-center gap-1 text-[var(--text-muted)] text-sm font-mono">
                        <Clock size={14} />
                        {new Date(match.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="p-6 flex flex-col gap-6">
                      {/* Players */}
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col items-center gap-2">
                          <img src={match.white_player?.avatar_url || `https://ui-avatars.com/api/?name=${match.white_player?.username || 'W'}`} className="w-12 h-12 rounded-full border-2 border-white" alt="White" />
                          <span className="font-bold text-[var(--text-primary)]">{match.white_player?.username || 'White'}</span>
                          <span className="text-sm font-mono text-[var(--text-muted)]">{Math.round(match.white_player?.rating || 1200)}</span>
                        </div>
                        
                        <div className="text-[var(--text-muted)] font-serif italic font-bold">VS</div>
                        
                        <div className="flex flex-col items-center gap-2">
                          <img src={match.black_player?.avatar_url || `https://ui-avatars.com/api/?name=${match.black_player?.username || 'B'}`} className="w-12 h-12 rounded-full border-2 border-black" alt="Black" />
                          <span className="font-bold text-[var(--text-primary)]">{match.black_player?.username || 'Black'}</span>
                          <span className="text-sm font-mono text-[var(--text-muted)]">{Math.round(match.black_player?.rating || 1200)}</span>
                        </div>
                      </div>

                      {/* Mini Board */}
                      <div className="mt-2 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                        <MiniBoardPreview fenOrPgn={match.pgn || "start"} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
