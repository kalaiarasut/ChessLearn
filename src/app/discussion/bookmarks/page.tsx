"use client";

import React, { useState, useEffect } from 'react';
import { PostCard } from '@/components/discussion/PostCard';
import { SkeletonPost } from '@/components/discussion/SkeletonPost';
import { Post } from '@/lib/mock-data';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchBookmarkedPostsAction } from '@/app/actions/discussion';
import { Bookmark, ArrowLeft } from "lucide-react";
import { useRouter } from 'next/navigation';

export default function BookmarksPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadBookmarks = async () => {
      setLoading(true);
      try {
        const fetched = await fetchBookmarkedPostsAction();
        setPosts(fetched || []);
      } catch (err) {
        console.error("Failed to fetch bookmarks:", err);
      } finally {
        setLoading(false);
      }
    };
    loadBookmarks();
  }, []);

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="border-b border-[var(--border)] pb-4 px-2">
        <button 
          onClick={() => router.push('/discussion')}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to feed
        </button>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] font-serif flex items-center gap-2">
          <Bookmark size={24} className="text-[var(--brand)]" />
          Bookmarks
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Saved posts and discussions for later reading.
        </p>
      </div>

      <div className="flex flex-col">
        {loading ? (
          <>
            <SkeletonPost />
            <SkeletonPost />
            <SkeletonPost />
          </>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center justify-center">
            <Bookmark className="w-16 h-16 text-[var(--text-muted)] opacity-20 mb-4" />
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No bookmarks yet</h3>
            <p className="text-[var(--text-secondary)]">
              When you bookmark a post, it will show up here.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {posts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <PostCard post={post} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
