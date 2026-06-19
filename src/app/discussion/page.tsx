"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PostComposer } from '@/components/discussion/PostComposer';
import { PostCard } from '@/components/discussion/PostCard';
import { ReplyThread } from '@/components/discussion/ReplyThread';
import { SkeletonPost } from '@/components/discussion/SkeletonPost';
import { Post } from '@/lib/mock-data';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchPostsAction } from '@/app/actions/discussion';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Loader2 } from "lucide-react";
import { useInView } from 'react-intersection-observer';

export default function DiscussionPage() {
  const [feedType, setFeedType] = useState<'all' | 'following'>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { ref: observerTarget, inView } = useInView({
    threshold: 0,
    rootMargin: '400px',
  });
  const supabase = createSupabaseBrowserClient();

  const loadInitialPosts = async () => {
    setLoading(true);
    const fetched = await fetchPostsAction(null, 20, undefined, feedType);
    setPosts(fetched);
    setLoading(false);
    if (fetched.length < 20) setHasMore(false);
    else setHasMore(true);
  };

  useEffect(() => {
    loadInitialPosts();
  }, [feedType]); // Reload when feedType changes

  useEffect(() => {
    loadInitialPosts();

    // Subscribe to real-time inserts
    const channel = supabase.channel('realtime_posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'discussion_posts' }, (payload) => {
        // Only prepend top-level posts
        if (!payload.new.reply_to_id) {
          // Re-fetch or add directly (re-fetch is safer for getting author profile)
          fetchPostsAction(null, 1).then((newPosts) => {
            if (newPosts.length > 0) {
              setPosts((prev) => [newPosts[0], ...prev.filter(p => p.id !== newPosts[0].id)]);
            }
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore || posts.length === 0) return;
    setLoadingMore(true);
    const lastPost = posts[posts.length - 1];
    const morePosts = await fetchPostsAction(null, 20, lastPost.createdAt, feedType);
    if (morePosts.length > 0) {
      setPosts((prev) => [...prev, ...morePosts]);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [posts, loadingMore, hasMore]);

  useEffect(() => {
    if (inView && hasMore && !loadingMore) {
      loadMorePosts();
    }
  }, [inView, hasMore, loadingMore, loadMorePosts]);

  const handleCreatePost = async (content: string, images: string[]) => {
    // Optimistic UI could go here
    const { createPost } = await import('@/app/actions/discussion');
    await createPost(content, images);
    // Realtime subscription will fetch it, or we can fetch manually to be safe
    const fetched = await fetchPostsAction(null, 1, undefined, feedType);
    if (fetched.length > 0) {
      setPosts((prev) => [fetched[0], ...prev.filter(p => p.id !== fetched[0].id)]);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="border-b border-[var(--border)] pb-0">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4 font-serif px-2">Home</h1>
        
        {/* Tabs */}
        <div className="flex w-full border-b border-[var(--border)]">
          <button
            onClick={() => setFeedType('all')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors relative hover:bg-[var(--surface-alt)]/50 ${feedType === 'all' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
          >
            For You
            {feedType === 'all' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[var(--brand)] rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setFeedType('following')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors relative hover:bg-[var(--surface-alt)]/50 ${feedType === 'following' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
          >
            Following
            {feedType === 'following' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[var(--brand)] rounded-t-full" />
            )}
          </button>
        </div>
        
        <div className="pt-4">
          <PostComposer onSubmit={handleCreatePost} />
        </div>
      </div>

      <div className="flex flex-col">
        {posts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (index % 10) * 0.1 }}
            className="border-b border-[var(--border)]"
          >
            <ReplyThread post={post} />
          </motion.div>
        ))}
        
        {loadingMore && (
          <div className="flex flex-col">
            <SkeletonPost />
            <SkeletonPost />
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-[var(--brand)]" size={24} />
            </div>
          </div>
        )}
        
        <div ref={observerTarget} className="h-10 w-full" />
        
        {!hasMore && (
          <div className="text-center py-8 text-[var(--text-muted)]">
            You&apos;ve caught up on all the discussions!
          </div>
        )}
      </div>
    </div>
  );
}
