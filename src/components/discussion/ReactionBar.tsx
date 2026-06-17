"use client";

import React, { useState } from 'react';
import { Heart, MessageCircle, Repeat } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { PostReaction } from '@/lib/mock-data';
import { toggleReaction } from '@/app/actions/discussion';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useEffect } from 'react';
import { ShareMenu } from './ShareMenu';

export interface ReactionBarProps {
  postId: string;
  initialReactions: {
    likes: number;
    comments: number;
    reposts: number;
    hasLiked?: boolean;
    hasReposted?: boolean;
  };
  onCommentClick?: () => void;
  onQuoteClick?: () => void;
}

export function ReactionBar({ postId, initialReactions, onCommentClick }: ReactionBarProps) {
  const [reactions, setReactions] = useState({
    ...initialReactions,
    hasLiked: initialReactions.hasLiked ?? false,
    hasReposted: initialReactions.hasReposted ?? false
  });
  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    let currentUserId: string | null = null;
    supabase.auth.getUser().then(({ data }) => currentUserId = data.user?.id || null);

    const channel = supabase.channel(`realtime:reactions:${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussion_reactions', filter: `post_id=eq.${postId}` }, payload => {
        if (payload.eventType === 'INSERT') {
          if (payload.new.user_id === currentUserId) return; // Handled optimistically
          if (payload.new.type === 'like') {
            setReactions(prev => ({ ...prev, likes: prev.likes + 1 }));
          } else if (payload.new.type === 'repost') {
            setReactions(prev => ({ ...prev, reposts: prev.reposts + 1 }));
          }
        } else if (payload.eventType === 'DELETE') {
          if (payload.old.user_id === currentUserId) return; // Handled optimistically
          if (payload.old.type === 'like') {
            setReactions(prev => ({ ...prev, likes: Math.max(0, prev.likes - 1) }));
          } else if (payload.old.type === 'repost') {
            setReactions(prev => ({ ...prev, reposts: Math.max(0, prev.reposts - 1) }));
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, supabase]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLiking) return;
    setIsLiking(true);

    const newHasLiked = !reactions.hasLiked;
    
    setReactions(prev => ({
      ...prev,
      hasLiked: newHasLiked,
      likes: prev.likes + (newHasLiked ? 1 : -1)
    }));

    if (newHasLiked) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;

      confetti({
        particleCount: 30,
        spread: 60,
        colors: ['#ef4444', '#f87171', '#fca5a5'],
        origin: { x, y },
        ticks: 100,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 20,
        shapes: ['circle']
      });
    }

    try {
      await toggleReaction(postId, 'like');
    } catch (err) {
      setReactions(prev => ({
        ...prev,
        hasLiked: !newHasLiked,
        likes: prev.likes + (!newHasLiked ? 1 : -1)
      }));
    } finally {
      setIsLiking(false);
    }
  };

  const handleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRepostMenu(false);
    if (isReposting) return;
    setIsReposting(true);
    const willRepost = !reactions.hasReposted;
    
    setReactions(prev => ({
      ...prev,
      hasReposted: willRepost,
      reposts: prev.reposts + (willRepost ? 1 : -1)
    }));

    try {
      await toggleReaction(postId, 'repost');
    } catch (err) {
      setReactions(prev => ({
        ...prev,
        hasReposted: !willRepost,
        reposts: prev.reposts + (!willRepost ? 1 : -1)
      }));
    } finally {
      setIsReposting(false);
    }
  };

  const formatCount = (count: number) => {
    if (count === 0) return "";
    if (count >= 10000) return (count / 1000).toFixed(1) + "K";
    return count.toString();
  };

  return (
    <div className="flex items-center justify-between mt-3 max-w-[425px]">
      <button 
        className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-blue-500 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onCommentClick?.();
        }}
      >
        <motion.div whileTap={{ scale: 0.8 }} className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
          <MessageCircle size={18} className="group-hover:fill-blue-500/20" />
        </motion.div>
        <span className="text-sm font-medium">{formatCount(reactions.comments)}</span>
      </button>

      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (reactions.hasReposted) {
              handleRepost(e);
            } else {
              setShowRepostMenu(!showRepostMenu);
            }
          }}
          className={`group flex items-center gap-2 transition-colors ${reactions.hasReposted ? 'text-green-500' : 'text-[var(--text-secondary)] hover:text-green-500'}`}
        >
          <motion.div
            animate={reactions.hasReposted ? { rotate: 180 } : { rotate: 0 }}
            whileTap={{ scale: 0.8 }}
            className="p-2 rounded-full group-hover:bg-green-500/10 transition-colors"
          >
            <Repeat size={18} />
          </motion.div>
          <span className="text-sm font-medium">{formatCount(reactions.reposts)}</span>
        </button>

        {showRepostMenu && (
          <div className="absolute top-full left-0 mt-1 w-32 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-50">
            <button
              className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2 font-bold"
              onClick={(e) => {
                e.stopPropagation();
                handleRepost(e);
              }}
            >
              <Repeat size={16} /> Repost
            </button>
            <button
              className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2 font-bold"
              onClick={(e) => {
                e.stopPropagation();
                setShowRepostMenu(false);
                onQuoteClick?.();
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg> 
              Quote
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleLike}
        className={`group flex items-center gap-2 transition-colors ${reactions.hasLiked ? 'text-red-500' : 'text-[var(--text-secondary)] hover:text-red-500'}`}
      >
        <motion.div
          whileTap={{ scale: 0.8 }}
          className="p-2 rounded-full group-hover:bg-red-500/10 transition-colors"
        >
          <Heart size={18} className={reactions.hasLiked ? 'fill-current' : 'group-hover:fill-red-500/20'} />
        </motion.div>
        <span className="text-sm font-medium">{formatCount(reactions.likes)}</span>
      </button>

      <ShareMenu />
    </div>
  );
}
