import { getSupabaseServerClient } from "@/lib/discussion-service";
import Navbar from "@/components/ui/Navbar";
import { SpectatorRoom } from "@/components/spectate/SpectatorRoom";
import { notFound } from "next/navigation";

export default async function SpectateMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: match } = await supabase
    .from('matches')
    .select(`
      id,
      white_player_id,
      black_player_id,
      pgn,
      status,
      time_control,
      created_at,
      white_player:profiles!matches_white_player_id_fkey(id, username, rating, avatar_url),
      black_player:profiles!matches_black_player_id_fkey(id, username, rating, avatar_url)
    `)
    .eq('id', id)
    .single();

  if (!match) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-[1536px] mx-auto pt-[80px] pb-0">
        <SpectatorRoom match={match} />
      </main>
    </div>
  );
}
