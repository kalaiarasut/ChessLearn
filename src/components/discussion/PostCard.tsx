"use client";

import { useState, useEffect } from "react";
import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Post } from "@/lib/mock-data";
import { ImageGrid } from "./ImageGrid";
import { ReactionBar } from "./ReactionBar";
import { ThreeDotMenu } from "./ThreeDotMenu";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { deletePost, editPost } from "@/app/actions/discussion";
import { PostComposer } from "./PostComposer";
import { MiniBoardPreview } from "./MiniBoardPreview";
import { LinkPreview } from "./LinkPreview";
import { ImageLightbox } from "./ImageLightbox";
import { ReportModal } from "./ReportModal";
import { QuotedPostPreview } from "./QuotedPostPreview";
import { PollViewer } from "./PollViewer";
import { PuzzleBoardPreview } from "./PuzzleBoardPreview";

interface PostCardProps {
  post: Post;
  isReply?: boolean;
  onCommentClick?: () => void;
}

export function PostCard({ post, isReply = false, onCommentClick }: PostCardProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);
  const [editedImages, setEditedImages] = useState(post.images || []);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      setCurrentUserId(user?.id || null);
    });
  }, [supabase.auth]);

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      await deletePost(post.id);
      setIsDeleted(true);
    }
  };

  const handleEditSubmit = async (content: string, images: string[]) => {
    await editPost(post.id, content, images);
    setEditedContent(content);
    setEditedImages(images);
    setIsEditing(false);
  };

  if (isDeleted) return null;
  // Format relative time (e.g., "2h", "15m", "Jun 16")
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Parser for mentions and hashtags
  const renderContent = (content: string = "") => {
    if (!content) return null;
    // Basic URL extraction
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlMatch = content.match(urlRegex);
    const firstUrl = urlMatch ? urlMatch[0] : null;

    // Regex for matching @mentions, #hashtags, links, and board tags
    const parts = content.split(/(@\w+|#\w+|https?:\/\/[^\s]+|\[fen\][\s\S]*?\[\/fen\]|\[pgn\][\s\S]*?\[\/pgn\]|\[livegame:[\w-]+\]|\[puzzle:[^\]]+\])/ig);

    return (
      <div className="text-[15px] leading-normal text-[var(--text-primary)] mt-1 whitespace-pre-wrap word-break">
        {parts.map((part, i) => {
          if (!part) return null;
          if (part.toLowerCase().startsWith('[fen]') || part.toLowerCase().startsWith('[pgn]') || part.toLowerCase().startsWith('[livegame:') || part.toLowerCase().startsWith('[puzzle:')) {
            return null; // hide tags from text
          }
          if (part.startsWith('@')) {
            const handle = part.slice(1);
            return (
              <Link key={i} href={`/user/${handle}`} onClick={(e) => e.stopPropagation()}>
                <span className="text-[var(--brand)] hover:underline cursor-pointer">
                  {part}
                </span>
              </Link>
            );
          }
          if (part.startsWith('#')) {
            const tag = part.slice(1);
            return (
              <Link key={i} href={`/discussion?q=%23${tag}`} onClick={(e) => e.stopPropagation()}>
                <span className="text-[var(--brand)] hover:underline cursor-pointer">
                  {part}
                </span>
              </Link>
            );
          }
          if (part.startsWith('http')) {
            return (
              <a key={i} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[var(--brand)] hover:underline break-all">
                {part}
              </a>
            );
          }
          return <span key={i}>{part}</span>;
        })}
        
        {(() => {
          const fenMatch = content.match(/\[fen\]([\s\S]*?)\[\/fen\]/i);
          const pgnMatch = content.match(/\[pgn\]([\s\S]*?)\[\/pgn\]/i);
          const liveGameMatch = content.match(/\[livegame:([\w-]+)\]/i);
          const puzzleMatch = content.match(/\[puzzle:([^:]+):([^\]]+)\]/i);

          const boardData = fenMatch ? fenMatch[1].trim() : (pgnMatch ? pgnMatch[1].trim() : null);
          const liveGameId = liveGameMatch ? liveGameMatch[1] : null;

          if (puzzleMatch) {
            const initialFen = puzzleMatch[1].trim();
            const solutionMoves = puzzleMatch[2].trim().split(',');
            return (
              <div className="mt-3">
                <PuzzleBoardPreview initialFen={initialFen} solutionMoves={solutionMoves} />
              </div>
            );
          }
          
          if (boardData || liveGameId) {
            return (
              <div className="mt-3">
                <MiniBoardPreview fenOrPgn={boardData || undefined} liveGameId={liveGameId || undefined} />
              </div>
            );
          }
          return null;
        })()}

        {firstUrl && !post.quotedPost && (
          <LinkPreview url={firstUrl} />
        )}
        
        {post.quotedPost && (
          <QuotedPostPreview post={post.quotedPost} />
        )}
      </div>
    );
  };

  return (
    <article className={`group/post flex gap-4 p-4 hover:bg-[var(--surface-alt)]/30 transition-colors border-b border-[var(--border)] cursor-pointer ${isReply ? 'pt-2 pb-0 border-none' : ''}`}>
      {/* Avatar column */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0">
        <div className="relative">
          <img
            src={post.author.avatar}
            alt={post.author.name}
            onClick={(e) => { e.stopPropagation(); router.push(`/user/${post.author.handle}`); }}
            className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
          />
          <div 
            title={post.author.isOnline ? "Online" : "Offline"}
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-[var(--bg)] rounded-full ${post.author.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} 
          />
        </div>
        {post.replies && post.replies.length > 0 && (
          <div className="w-0.5 grow bg-[var(--border)] group-hover/post:bg-[var(--border-hover)] transition-colors" />
        )}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-hidden text-[15px]">
            <span 
              className="font-bold text-[var(--text-primary)] hover:underline cursor-pointer truncate"
              onClick={(e) => { e.stopPropagation(); router.push(`/user/${post.author.handle}`); }}
            >
              {post.author.name}
            </span>
            {post.author.verified && (
              <BadgeCheck className="w-4 h-4 text-[#1DA1F2] shrink-0" />
            )}
            <span className="text-[var(--text-secondary)] truncate">@{post.author.handle}</span>
            <span className="text-[var(--text-secondary)]">·</span>
            <span className="text-[var(--text-secondary)] hover:underline" title={new Date(post.createdAt).toLocaleString()}>
              {formatTime(post.createdAt)}
            </span>
          </div>
          <ThreeDotMenu 
            onDelete={currentUserId === post.author.id ? handleDelete : undefined}
            onEdit={currentUserId === post.author.id ? () => setIsEditing(true) : undefined} 
            onReport={() => setIsReportModalOpen(true)}
          />
        </div>

        {isEditing ? (
          <div className="mt-2 mb-4 pr-4">
            <PostComposer 
              onSubmit={handleEditSubmit} 
              initialContent={editedContent}
              initialImages={editedImages}
              onCancel={() => setIsEditing(false)}
              autoFocus
            />
          </div>
        ) : (
          <>
            <div className="mt-1">
              {renderContent(editedContent)}
            </div>

            {editedImages && editedImages.length > 0 && (
              <div className="mt-3">
                <ImageGrid 
                  images={editedImages} 
                  onImageClick={(index) => setLightboxIndex(index)}
                />
              </div>
            )}

            {post.poll && (
              <PollViewer poll={post.poll} currentUserId={currentUserId} />
            )}
          </>
        )}

        <div className="mt-2">
          <ReactionBar 
            postId={post.id} 
            initialReactions={{
              likes: post.reactions?.likes || 0,
              comments: post.reactions?.comments || 0,
              reposts: post.reactions?.reposts || 0,
              hasLiked: post.reactions?.hasLiked,
              hasReposted: post.reactions?.hasReposted,
            }}
            onCommentClick={onCommentClick}
            onQuoteClick={() => setIsQuoteModalOpen(true)}
          />
        </div>
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={editedImages || []}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNext={() => setLightboxIndex((prev) => (prev !== null && editedImages ? (prev + 1) % editedImages.length : null))}
          onPrev={() => setLightboxIndex((prev) => (prev !== null && editedImages ? (prev - 1 + editedImages.length) % editedImages.length : null))}
        />
      )}

      <ReportModal 
        postId={post.id}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />

      {isQuoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setIsQuoteModalOpen(false); }} />
          <div className="bg-[var(--surface)] w-full max-w-[600px] rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Quote this post</h2>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsQuoteModalOpen(false); }}
                className="p-2 hover:bg-[var(--surface-hover)] rounded-full transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <PostComposer
                onSubmit={async (content, images) => {
                  const { createPost } = await import('@/app/actions/discussion');
                  await createPost(content, images, undefined, post.id);
                  setIsQuoteModalOpen(false);
                }}
                quotedPost={post}
                autoFocus
                onCancel={() => setIsQuoteModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
