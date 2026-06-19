import React from 'react';
import Navbar from '@/components/ui/Navbar';
import { getSupabaseServerClient } from '@/lib/discussion-service';
import { Activity } from 'lucide-react';
import { SpectateListClient } from './SpectateListClient';

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
      time_control,
      white_player:profiles!matches_white_player_id_fkey(username, rating, avatar_url),
      black_player:profiles!matches_black_player_id_fkey(username, rating, avatar_url)
    `)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(30);

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <Navbar />
      
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 md:px-6 pt-32 pb-16">
        <div className="flex flex-col gap-10">
          
          {/* Removed Heading per user request */}
          <SpectateListClient initialMatches={matches || []} />

        </div>
      </main>
    </div>
  );
}
