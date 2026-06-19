"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, Clock, Search, Filter } from 'lucide-react';
import { MiniBoardPreview } from '@/components/discussion/MiniBoardPreview';

interface Match {
  id: string;
  white_player_id: string;
  black_player_id: string;
  pgn: string;
  created_at: string;
  status: string;
  white_player: { username: string, rating: number, avatar_url: string };
  black_player: { username: string, rating: number, avatar_url: string };
}

interface SpectateListClientProps {
  initialMatches: Match[];
  initialBookmarkedMatchIds?: string[];
}

import { toggleMatchBookmarkAction } from '@/app/actions/discussion';
import { toast } from 'sonner';

export function SpectateListClient({ initialMatches, initialBookmarkedMatchIds = [] }: SpectateListClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [bookmarkedMatchIds, setBookmarkedMatchIds] = useState<Set<string>>(new Set(initialBookmarkedMatchIds));

  const handleToggleBookmark = async (e: React.MouseEvent, matchId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isBookmarked = bookmarkedMatchIds.has(matchId);
    
    // Optimistic update
    setBookmarkedMatchIds(prev => {
      const next = new Set(prev);
      if (isBookmarked) next.delete(matchId);
      else next.add(matchId);
      return next;
    });

    try {
      await toggleMatchBookmarkAction(matchId);
      toast.success(isBookmarked ? "Match removed from bookmarks" : "Match bookmarked");
    } catch (err) {
      // Revert on failure
      setBookmarkedMatchIds(prev => {
        const next = new Set(prev);
        if (isBookmarked) next.add(matchId);
        else next.delete(matchId);
        return next;
      });
      toast.error("Failed to bookmark match");
    }
  };
  
  const filteredMatches = initialMatches.filter(match => {
    const term = searchTerm.toLowerCase();
    const w = match.white_player?.username?.toLowerCase() || '';
    const b = match.black_player?.username?.toLowerCase() || '';
    const matchesSearch = w.includes(term) || b.includes(term);

    if (!matchesSearch) return false;
    if (ratingFilter === 'all') return true;

    const wRating = match.white_player?.rating || 1200;
    const bRating = match.black_player?.rating || 1200;
    const avgRating = (wRating + bRating) / 2;

    if (ratingFilter === '0-1000') return avgRating <= 1000;
    if (ratingFilter === '1000-1500') return avgRating > 1000 && avgRating <= 1500;
    if (ratingFilter === '1500-2000') return avgRating > 1500 && avgRating <= 2000;
    if (ratingFilter === '2000+') return avgRating > 2000;

    return true;
  });

  return (
    <div className="flex flex-col gap-8">
      
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="relative w-full sm:flex-1 sm:max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Search players..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-full py-2 pl-10 pr-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-muted)] transition-colors text-sm"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <select 
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="appearance-none flex items-center gap-2 px-4 py-2 pr-8 bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-full text-sm font-semibold transition-colors focus:outline-none cursor-pointer text-[var(--text-primary)]"
            >
              <option value="all">All Ratings</option>
              <option value="0-1000">0 - 1000</option>
              <option value="1000-1500">1000 - 1500</option>
              <option value="1500-2000">1500 - 2000</option>
              <option value="2000+">2000+</option>
            </select>
            <Filter className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>
        </div>
      </div>

      {!filteredMatches || filteredMatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-sm">
          <Eye className="w-16 h-16 text-[var(--text-muted)] mb-6 opacity-50" />
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">No games found</h2>
          <p className="text-[var(--text-muted)] mt-2">Try adjusting your search filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMatches.map((match: any) => (
            <Link key={match.id} href={`/spectate/${match.id}`} className="block group">
              <div className="bg-[var(--surface)] hover:bg-[var(--surface-alt)] border border-[var(--border)] hover:border-[var(--brand)] rounded-3xl overflow-hidden transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1">
                
                {/* Header */}
                <div className="p-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--surface-alt)] to-[var(--surface)] flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-sm tracking-wide">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                      </span>
                      LIVE MATCH
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => handleToggleBookmark(e, match.id)}
                      className="p-1 hover:bg-[var(--surface-hover)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <svg 
                        className={`w-4 h-4 transition-colors ${bookmarkedMatchIds.has(match.id) ? 'fill-[var(--brand)] text-[var(--brand)]' : 'fill-transparent'}`} 
                        xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
                      </svg>
                    </button>
                    <div className="flex items-center gap-1 text-[var(--text-muted)] text-xs font-mono font-semibold bg-[var(--bg)] px-2 py-1 rounded-md" suppressHydrationWarning>
                      <Clock size={12} />
                      {new Date(match.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="p-6 flex flex-col gap-6">
                  {/* Players */}
                  <div className="flex justify-between items-center px-2">
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative">
                        <img src={match.white_player?.avatar_url || `https://ui-avatars.com/api/?name=${match.white_player?.username || 'W'}`} className="w-14 h-14 rounded-full border-4 border-white shadow-sm" alt="White" />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-[var(--border)]" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-[var(--text-primary)] truncate max-w-[90px]">{match.white_player?.username || 'White'}</span>
                        <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-alt)] px-1.5 py-0.5 rounded">{Math.round(match.white_player?.rating || 1200)}</span>
                      </div>
                    </div>
                    
                    <div className="text-[var(--text-muted)] font-serif italic font-bold text-lg opacity-80 group-hover:scale-110 transition-transform">VS</div>
                    
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative">
                        <img src={match.black_player?.avatar_url || `https://ui-avatars.com/api/?name=${match.black_player?.username || 'B'}`} className="w-14 h-14 rounded-full border-4 border-[#2b2b2b] shadow-sm" alt="Black" />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-black rounded-full border-2 border-[var(--border)]" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-[var(--text-primary)] truncate max-w-[90px]">{match.black_player?.username || 'Black'}</span>
                        <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-alt)] px-1.5 py-0.5 rounded">{Math.round(match.black_player?.rating || 1200)}</span>
                      </div>
                    </div>
                  </div>

                  <MiniBoardPreview 
                    fenOrPgn={match.pgn || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"} 
                    wrapperClassName="mt-2 relative p-1 bg-gradient-to-b from-[var(--surface-alt)] to-[var(--bg)] rounded-sm border border-[var(--border)] shadow-inner transition-opacity w-full max-w-none"
                    showAnalyzeButton={bookmarkedMatchIds.has(match.id) && match.status === 'finished'}
                    overlayNode={
                      <div className="absolute inset-0 bg-[var(--brand)]/0 group-hover:bg-[var(--brand)]/10 flex items-center justify-center transition-colors pointer-events-none rounded-sm z-20">
                        <div className="bg-[var(--bg)]/90 backdrop-blur-sm text-[var(--text-primary)] font-bold px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 transform flex items-center gap-2 shadow-lg">
                          <Eye className="w-4 h-4" /> Spectate
                        </div>
                      </div>
                    }
                  />

                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
