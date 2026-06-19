"use client";

import { formatDistanceToNow } from "date-fns";
import { BadgeCheck } from "lucide-react";
import { Post } from "@/lib/mock-data";
import { MiniBoardPreview } from "./MiniBoardPreview";

export function QuotedPostPreview({ post }: { post: Post }) {
  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return formatDistanceToNow(date, { addSuffix: false }).replace('about ', '').replace(' minutes', 'm').replace(' hours', 'h').replace(' days', 'd');
    } catch {
      return '';
    }
  };

  // Basic content formatting for quote (similar to PostCard but stripped down)
  const renderContent = (content: string = "") => {
    if (!content) return null;
    const parts = content.split(/(@\w+|#\w+|https?:\/\/[^\s]+|\[fen\][\s\S]*?\[\/fen\]|\[pgn\][\s\S]*?\[\/pgn\]|\[livegame:[\w-]+\])/ig);
    
    return (
      <div className="text-[15px] leading-normal text-[var(--text-primary)] mt-1 whitespace-pre-wrap word-break">
        {parts.map((part, i) => {
          if (!part) return null;
          if (part.toLowerCase().startsWith('[fen]') || part.toLowerCase().startsWith('[pgn]') || part.toLowerCase().startsWith('[livegame:')) {
            return null;
          }
          if (part.startsWith('@')) return <span key={i} className="text-[var(--brand)]">{part}</span>;
          if (part.startsWith('#')) return <span key={i} className="text-[var(--brand)]">{part}</span>;
          if (part.startsWith('http')) return <span key={i} className="text-[var(--brand)]">{part}</span>;
          return <span key={i}>{part}</span>;
        })}
        
        {(() => {
          const fenMatch = content.match(/\[fen\]([\s\S]*?)\[\/fen\]/i);
          const pgnMatch = content.match(/\[pgn\]([\s\S]*?)\[\/pgn\]/i);
          const liveGameMatch = content.match(/\[livegame:([\w-]+)\]/i);
          const boardData = fenMatch ? fenMatch[1].trim() : (pgnMatch ? pgnMatch[1].trim() : null);
          const liveGameId = liveGameMatch ? liveGameMatch[1] : null;
          
          if (boardData || liveGameId) {
            return (
              <div className="mt-2">
                <MiniBoardPreview fenOrPgn={boardData || undefined} liveGameId={liveGameId || undefined} />
              </div>
            );
          }
          return null;
        })()}
      </div>
    );
  };

  return (
    <div className="mt-3 border border-[var(--border)] rounded-2xl p-3 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer overflow-hidden">
      <div className="flex items-center gap-1.5 overflow-hidden text-[15px]">
        <img
          src={post.author.avatar}
          alt={post.author.name}
          className="w-5 h-5 rounded-full object-cover"
        />
        <span className="font-bold text-[var(--text-primary)] truncate ml-1">
          {post.author.name}
        </span>
        {post.author.verified && (
          <BadgeCheck className="w-4 h-4 text-[#1DA1F2] shrink-0" />
        )}
        <span className="text-[var(--text-secondary)] truncate">@{post.author.handle}</span>
        <span className="text-[var(--text-secondary)]">·</span>
        <span className="text-[var(--text-secondary)] shrink-0">
          {formatTime(post.createdAt)}
        </span>
      </div>

      {renderContent(post.content)}

      {post.images && post.images.length > 0 && (
        <div className="mt-3 rounded-xl overflow-hidden max-h-40">
          <img src={post.images[0]} alt="Quoted image" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}
