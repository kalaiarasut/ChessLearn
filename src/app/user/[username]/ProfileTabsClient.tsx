"use client";

import { useState } from "react";
import { Swords, Bookmark, Clock, Eye } from "lucide-react";
import GamesHistory from "@/components/ui/GamesHistory";
import { PostCard } from "@/components/discussion/PostCard";
import { MiniBoardPreview } from "@/components/discussion/MiniBoardPreview";
import Link from "next/link";

function MatchBookmarkCard({ match }: { match: any }) {
  return (
    <Link href={`/spectate/${match.id}`} className="block group">
      <div className="bg-[var(--surface)] hover:bg-[var(--surface-alt)] border border-[var(--border)] hover:border-[var(--brand)] rounded-3xl overflow-hidden transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1">
        <div className="p-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--surface-alt)] to-[var(--surface)] flex justify-between items-center">
          <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-sm tracking-wide">
            <Bookmark className="w-4 h-4 text-[var(--brand)] fill-current" />
            BOOKMARKED MATCH
          </div>
          <div className="flex items-center gap-1 text-[var(--text-muted)] text-xs font-mono font-semibold bg-[var(--bg)] px-2 py-1 rounded-md" suppressHydrationWarning>
            <Clock size={12} />
            {new Date(match.created_at).toLocaleDateString()}
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="flex justify-between items-center px-2">
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <img src={match.white_player?.avatar_url || `https://ui-avatars.com/api/?name=${match.white_player?.username || 'W'}`} className="w-14 h-14 rounded-full border-4 border-white shadow-sm" alt="White" />
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-[var(--text-primary)] truncate max-w-[90px]">{match.white_player?.username || 'White'}</span>
              </div>
            </div>
            
            <div className="text-[var(--text-muted)] font-serif italic font-bold text-lg opacity-80 group-hover:scale-110 transition-transform">VS</div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <img src={match.black_player?.avatar_url || `https://ui-avatars.com/api/?name=${match.black_player?.username || 'B'}`} className="w-14 h-14 rounded-full border-4 border-[#2b2b2b] shadow-sm" alt="Black" />
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-[var(--text-primary)] truncate max-w-[90px]">{match.black_player?.username || 'Black'}</span>
              </div>
            </div>
          </div>

          <MiniBoardPreview 
            fenOrPgn={match.pgn || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"} 
            wrapperClassName="mt-2 relative p-1 bg-gradient-to-b from-[var(--surface-alt)] to-[var(--bg)] rounded-sm border border-[var(--border)] shadow-inner transition-opacity w-full max-w-none"
            overlayNode={
              <div className="absolute inset-0 bg-[var(--brand)]/0 group-hover:bg-[var(--brand)]/10 flex items-center justify-center transition-colors pointer-events-none rounded-sm z-20">
                <div className="bg-[var(--bg)]/90 backdrop-blur-sm text-[var(--text-primary)] font-bold px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 transform flex items-center gap-2 shadow-lg">
                  <Eye className="w-4 h-4" /> View Match
                </div>
              </div>
            }
          />
        </div>
      </div>
    </Link>
  );
}

export function ProfileTabsClient({ userId, isOwnProfile, bookmarkedMatches, bookmarkedPosts }: { userId: string, isOwnProfile: boolean, bookmarkedMatches: any[], bookmarkedPosts: any[] }) {
  const [activeTab, setActiveTab] = useState<'games' | 'bookmarks'>('games');

  // Interleave and sort by created_at descending
  const allBookmarks = [
    ...bookmarkedMatches.map(m => ({ type: 'match', data: m, date: new Date(m.created_at).getTime() })),
    ...bookmarkedPosts.map(p => ({ type: 'post', data: p, date: new Date(p.created_at).getTime() }))
  ].sort((a, b) => b.date - a.date);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm h-full min-h-[600px] flex flex-col">
      <div className="flex items-center gap-6 px-6 pt-6 border-b border-[var(--border)]">
        <button 
          onClick={() => setActiveTab('games')}
          className={`pb-4 flex items-center gap-2 text-sm font-bold transition-colors relative ${activeTab === 'games' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          <Swords size={18} /> Recent Games
          {activeTab === 'games' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--text-primary)]" />}
        </button>
        {isOwnProfile && (
          <button 
            onClick={() => setActiveTab('bookmarks')}
            className={`pb-4 flex items-center gap-2 text-sm font-bold transition-colors relative ${activeTab === 'bookmarks' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            <Bookmark size={18} /> Bookmarks
            {activeTab === 'bookmarks' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--text-primary)]" />}
          </button>
        )}
      </div>

      <div className="p-6 flex-1">
        {activeTab === 'games' && <GamesHistory userId={userId} />}
        
        {activeTab === 'bookmarks' && (
          <div className="flex flex-col gap-6">
            {allBookmarks.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-muted)] flex flex-col items-center">
                <Bookmark className="w-12 h-12 mb-4 opacity-50" />
                <p>No bookmarks yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                {allBookmarks.map((item, idx) => (
                  <div key={`${item.type}-${idx}`}>
                    {item.type === 'post' ? (
                      <PostCard post={item.data} />
                    ) : (
                      <MatchBookmarkCard match={item.data} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
