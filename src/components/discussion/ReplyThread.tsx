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
      <PostCard 
        post={{ ...post, replies }} 
        onCommentClick={() => {
          setShowReplies(true);
          setFocusReply(true);
        }} 
      />
      
      {(replies.length > 0 || showReplies) && (
        <div className="flex">
          {/* Thread vertical line connecting to the last reply */}
          <div className="w-[56px] flex flex-col items-center shrink-0">
            {/* The line is handled inside PostCard for the parent, but we can add a connecting line here if needed. 
                Actually, the PostCard already renders a line if it has replies. */}
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
    </div>
  );
}
