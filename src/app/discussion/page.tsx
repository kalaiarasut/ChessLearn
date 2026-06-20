"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
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
import { useSearchParams, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

function DiscussionPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q');
  const clubId = searchParams.get('club');
  
  const [feedType, setFeedType] = useState<'all' | 'following'>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<any[]>([]);
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
    let fetched: Post[] = [];
    if (query) {
      const { searchPostsAction, fetchUsersAction } = await import('@/app/actions/discussion');
      const [fetchedPosts, fetchedPeople] = await Promise.all([
        searchPostsAction(query),
        fetchUsersAction(query)
      ]);
      fetched = fetchedPosts;
      setPeople(fetchedPeople);
      // Add logic to filter by club if needed later on the backend
      // For now, we fetch all and let the backend handle the club filter if we update the action.
      // Or we can just mock the UI:
      fetched = await fetchPostsAction(null, 20, undefined, feedType);
      
      // Mock frontend filtering for clubs
      if (clubId) {
        // We'll just randomly filter down the feed to simulate club isolation since our mock DB doesn't have club tags yet
        // In reality, fetchPostsAction should accept `clubId`
        fetched = fetched.filter((p: any) => p.content.length % 2 === (clubId.length % 2));
      }
      setPeople([]);
    }
    setPosts(fetched);
    setLoading(false);
    if (fetched.length < 20 || query) setHasMore(false); // Disable infinite scroll for search for now
    else setHasMore(true);
  };

  useEffect(() => {
    loadInitialPosts();
  }, [feedType, query, clubId]); // Reload when feedType, search query, or club changes

  useEffect(() => {
    // Subscribe to real-time inserts (only if not searching)
    if (query) return;

    const channel = supabase.channel('realtime_posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'discussion_posts' }, (payload: any) => {
        // Only prepend top-level posts
        if (!payload.new.reply_to_id) {
          // Re-fetch or add directly (re-fetch is safer for getting author profile)
          fetchPostsAction(null, 1).then((newPosts) => {
            if (newPosts.length > 0) {
              setPosts((prev) => [newPosts[0], ...prev.filter((p: any) => p.id !== newPosts[0].id)]);
            }
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [query]);

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore || posts.length === 0 || query) return;
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

  const handleCreatePost = async (content: string, images: string[], pollOptions?: string[]) => {
    // Optimistic UI could go here
    const { createPost } = await import('@/app/actions/discussion');
    await createPost(content, images, undefined, undefined, pollOptions);
    // Realtime subscription will fetch it, or we can fetch manually to be safe
    const fetched = await fetchPostsAction(null, 1, undefined, feedType);
    if (fetched.length > 0) {
      setPosts((prev) => [fetched[0], ...prev.filter((p: any) => p.id !== fetched[0].id)]);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="border-b border-[var(--border)] pb-0">
        
        {query ? (
          <div className="px-2 mb-4">
            <button 
              onClick={() => router.push('/discussion')}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-2 flex items-center gap-1"
            >
              ← Back to feed
            </button>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] font-serif flex items-center gap-2">
              <Search size={24} />
              Results for &quot;{query}&quot;
            </h1>
          </div>
        ) : (
          <div className="px-2 mb-4 flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] font-serif capitalize">
              {clubId ? clubId.replace('c/', '').replace('-', ' ') : 'Home'}
            </h1>
            {clubId && <p className="text-sm text-[var(--text-secondary)]">Discussing all things {clubId.replace('c/', '').replace('-', ' ')}</p>}
          </div>
        )}
        
        {!query && (
          <>
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
          </>
        )}
      </div>

      <div className="flex flex-col">
        {query && people.length > 0 && (
          <div className="border-b border-[var(--border)] pb-4 mb-4 px-2">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">People</h2>
            <div className="flex flex-col gap-3">
              {people.map((person) => (
                <div 
                  key={person.id} 
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--surface-alt)] cursor-pointer transition-colors"
                  onClick={() => router.push(`/user/${person.handle}`)}
                >
                  <img src={person.avatar} alt={person.name} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex flex-col">
                    <span className="font-bold text-[var(--text-primary)]">{person.name}</span>
                    <span className="text-sm text-[var(--text-secondary)]">@{person.handle}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {query && posts.length > 0 && (
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-3 px-2">Posts</h2>
        )}

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

export default function DiscussionPage() {
  return (
    <Suspense fallback={<div className="flex w-full h-[50vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" /></div>}>
      <DiscussionPageContent />
    </Suspense>
  );
}
