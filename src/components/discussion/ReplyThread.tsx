"use client";

import { useState, useEffect } from "react";
import { Post } from "@/lib/mock-data";
import { PostCard } from "./PostCard";
import { PostComposer } from "./PostComposer";
import { createPost, fetchPostsAction } from "@/app/actions/discussion";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface ReplyThreadProps {
  post: Post;
}

export function ReplyThread({ post }: ReplyThreadProps) {
  const [showReplies, setShowReplies] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [focusReply, setFocusReply] = useState(false);
  const [replies, setReplies] = useState<Post[]>(post.replies || []);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    setReplies(post.replies || []);
  }, [post.replies]);

  useEffect(() => {
    const channel = supabase.channel(`realtime_replies_${post.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'discussion_posts', filter: `reply_to_id=eq.${post.id}` }, () => {
         fetchPostsAction(post.id, 50).then(fetched => {
           if (fetched) {
             setReplies(fetched.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
           }
         });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id, supabase]);

  const handleReplySubmit = async (content: string, images: string[]): Promise<void> => {
    await createPost(content, images, post.id);
    
    // Re-fetch only this thread's replies
    const fetched = await fetchPostsAction(post.id, 50);
    if (fetched) {
      // Sort replies by oldest first
      setReplies(fetched.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    }
  };

  return (
    <div className="flex flex-col">
      {isCollapsed ? (
        <div className="flex items-center gap-2 p-3 bg-[var(--surface-alt)]/30 rounded-xl cursor-pointer hover:bg-[var(--surface-alt)] transition-colors" onClick={() => setIsCollapsed(false)}>
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <img src={post.author.avatar} className="w-5 h-5 rounded-full" alt="" />
            <span className="font-bold">{post.author.name}</span>
            <span>·</span>
            <span>{post.replies?.length || 0} replies</span>
            <span className="text-[var(--brand)] ml-2">+ Expand thread</span>
          </div>
        </div>
      ) : (
        <>
          <div className="relative group/thread">
            <PostCard 
              post={{ ...post, replies }} 
              onCommentClick={() => {
                setShowReplies(true);
                setFocusReply(true);
              }} 
            />
            {/* Clickable vertical line for collapsing */}
            <div 
              className="absolute left-5 top-12 bottom-0 w-4 -translate-x-1/2 cursor-pointer group/line z-10"
              onClick={() => setIsCollapsed(true)}
              title="Collapse thread"
            >
              <div className="w-0.5 h-full bg-transparent group-hover/line:bg-[var(--brand)] transition-colors mx-auto" />
            </div>
          </div>
          
          {(replies.length > 0 || showReplies) && (
            <div className="flex relative">
              <div className="w-[56px] flex flex-col items-center shrink-0">
              </div>
              
              <div className="flex-1 w-full min-w-0 pb-4">
                {!showReplies && replies.length > 0 && (
              <button 
                onClick={() => {
                  setShowReplies(true);
                  setFocusReply(false);
                }}
                className="mt-2 text-[var(--brand)] text-sm font-medium hover:underline flex items-center gap-2"
              >
                <div className="w-8 h-px bg-[var(--border)] inline-block" />
                Show {replies.length} replies
              </button>
            )}

            <AnimatePresence>
              {showReplies && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col border-l-2 border-l-transparent" // to align
                >
                  {replies.map((reply, idx) => (
                    <div key={reply.id} className="relative">
                      {/* Vertical line connecting replies */}
                      {idx !== replies.length - 1 && (
                        <div className="absolute left-[20px] top-10 bottom-0 w-0.5 bg-[var(--border)] -ml-[36px]" />
                      )}
                      <PostCard 
                        post={reply} 
                        isReply 
                        onCommentClick={() => {
                          setShowReplies(true);
                          setFocusReply(true);
                        }} 
                      />
                    </div>
                  ))}
                  
                  {/* Inline Composer for replies */}
                  <div className="pt-4 mt-2 border-t border-[var(--border)]">
                    <PostComposer 
                      onSubmit={handleReplySubmit} 
                      placeholder="Post your reply" 
                      autoFocus={focusReply}
                    />
                  </div>
                </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}
