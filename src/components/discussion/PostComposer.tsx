"use client";

import { useState, useRef, useEffect } from "react";
import { Image as ImageIcon, X, Loader2, Smile } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { currentUser, Post } from "@/lib/mock-data";
import { fetchUsersAction } from "@/app/actions/discussion";
import { QuotedPostPreview } from "./QuotedPostPreview";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface PostComposerProps {
  onSubmit: (content: string, images: string[]) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  initialContent?: string;
  initialImages?: string[];
  quotedPost?: Post;
  onCancel?: () => void;
}

const MAX_CHARS = 280;
const MAX_IMAGES = 4;

export function PostComposer({ 
  onSubmit, 
  placeholder = "What's happening?!", 
  autoFocus = false,
  initialContent = "",
  initialImages = [],
  quotedPost,
  onCancel
}: PostComposerProps) {
  const [content, setContent] = useState(initialContent);
  const [images, setImages] = useState<string[]>(initialImages);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
    // Load draft
    if (!onCancel) {
      const draft = localStorage.getItem('chessify_post_draft');
      if (draft && !initialContent) {
        setContent(draft);
      }
    }
  }, [autoFocus, onCancel, initialContent]);

  useEffect(() => {
    // Save draft
    if (!onCancel) {
      const timer = setTimeout(() => {
        if (content.trim()) {
          localStorage.setItem('chessify_post_draft', content);
        } else {
          localStorage.removeItem('chessify_post_draft');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [content, onCancel]);

  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [mentionUsers, setMentionUsers] = useState<any[]>([]);

  useEffect(() => {
    if (mentionQuery) {
      const timer = setTimeout(async () => {
        const users = await fetchUsersAction(mentionQuery);
        setMentionUsers(users);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setMentionUsers([]);
    }
  }, [mentionQuery]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }

    // Mention detection
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const words = textBeforeCursor.split(/\s/);
    const currentWord = words[words.length - 1];

    if (currentWord.startsWith('@') && currentWord.length > 0) {
      setMentionQuery(currentWord.slice(1).toLowerCase());
      setShowMentions(true);
      setMentionCursorPos(cursorPos);
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (handle: string) => {
    const textBeforeCursor = content.slice(0, mentionCursorPos);
    const textAfterCursor = content.slice(mentionCursorPos);
    const words = textBeforeCursor.split(/\s/);
    words.pop(); // Remove the partial @mention
    
    const newTextBefore = words.length > 0 ? words.join(' ') + ' ' : '';
    const newContent = `${newTextBefore}@${handle} ${textAfterCursor}`;
    
    setContent(newContent);
    setShowMentions(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newImages = files.map(file => URL.createObjectURL(file));
      setImageFiles(prev => [...prev, ...files].slice(0, MAX_IMAGES));
      setImages(prev => [...prev, ...newImages].slice(0, MAX_IMAGES));
    }
  };

  const removeImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, index) => index !== indexToRemove));
    setImageFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async () => {
    if (!content.trim() && images.length === 0) return;
    
    setIsSubmitting(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of imageFiles) {
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-]/g, '')}`;
        const { data, error } = await supabase.storage.from('discussion-images').upload(fileName, file);
        if (error) {
          throw new Error(`Image upload failed: ${error.message}`);
        }
        if (data) {
          const { data: publicUrlData } = supabase.storage.from('discussion-images').getPublicUrl(data.path);
          uploadedUrls.push(publicUrlData.publicUrl);
        }
      }
      
      await onSubmit(content, [...initialImages.filter(img => images.includes(img)), ...uploadedUrls]);
      if (!onCancel) { // Don't clear if it's editing, parent handles unmount
        setContent("");
        setImages([]);
        setImageFiles([]);
        localStorage.removeItem('chessify_post_draft');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    } catch (err: any) {
      console.error("Failed to post:", err);
      toast.error(err.message || "Failed to create post. Are you logged in?");
    } finally {
      setIsSubmitting(false);
    }
  };

  const charsLeft = MAX_CHARS - content.length;
  const percentage = (content.length / MAX_CHARS) * 100;
  const isOverLimit = content.length > MAX_CHARS;
  const isDisabled = (!content.trim() && images.length === 0) || isOverLimit || isSubmitting;

  // Circle properties
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex gap-4 w-full">
      <div className="flex-shrink-0">
        <img
          src={currentUser.avatar}
          alt={currentUser.name}
          className="w-10 h-10 rounded-full object-cover"
        />
      </div>
      
      <div className="flex-1 flex flex-col gap-3">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            placeholder={placeholder}
            className="w-full bg-transparent text-[var(--text-primary)] text-lg placeholder:text-[var(--text-muted)] resize-none outline-none min-h-[52px] py-2 overflow-hidden"
            rows={1}
          />
          
          <AnimatePresence>
            {showMentions && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 w-64 max-h-64 overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl z-50 mt-1"
              >
                {mentionUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleMentionSelect(user.handle)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--surface-alt)] transition-colors text-left"
                    >
                      <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-semibold text-sm text-[var(--text-primary)] truncate">{user.name}</span>
                        <span className="text-xs text-[var(--text-secondary)] truncate">@{user.handle}</span>
                      </div>
                    </button>
                  ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {images.length > 0 && (
          <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <AnimatePresence>
              {images.map((img, idx) => (
                <motion.div
                  key={img + idx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative rounded-2xl overflow-hidden aspect-[4/3] group"
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-1">
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageUpload}
              disabled={images.length >= MAX_IMAGES}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= MAX_IMAGES}
              className="p-2 text-[var(--brand)] hover:bg-[var(--brand-muted)] rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <ImageIcon size={20} />
            </button>
            <button className="p-2 text-[var(--brand)] hover:bg-[var(--brand-muted)] rounded-full transition-colors hidden sm:block">
              <Smile size={20} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {content.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="relative w-6 h-6 flex items-center justify-center">
                  <svg className="w-6 h-6 transform -rotate-90">
                    <circle
                      className="text-[var(--border)]"
                      strokeWidth="2"
                      stroke="currentColor"
                      fill="transparent"
                      r={radius}
                      cx="12"
                      cy="12"
                    />
                    <motion.circle
                      className={isOverLimit ? "text-red-500" : (percentage > 90 ? "text-yellow-500" : "text-[var(--brand)]")}
                      strokeWidth="2"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset < 0 ? 0 : strokeDashoffset}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r={radius}
                      cx="12"
                      cy="12"
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: strokeDashoffset < 0 ? 0 : strokeDashoffset }}
                      transition={{ duration: 0.3 }}
                    />
                  </svg>
                  {percentage > 90 && (
                    <span className={`absolute text-[10px] ${isOverLimit ? 'text-red-500' : 'text-[var(--text-secondary)]'}`}>
                      {charsLeft}
                    </span>
                  )}
                </div>
                <div className="h-6 w-px bg-[var(--border)]" />
              </div>
            )}
            
            {onCancel && (
              <button
                onClick={onCancel}
                disabled={isSubmitting}
                className="text-[var(--text-secondary)] font-bold py-1.5 px-4 rounded-full hover:bg-[var(--surface-alt)] transition-colors min-w-[80px] flex justify-center items-center h-9 mr-2"
              >
                Cancel
              </button>
            )}
            <motion.button
              whileTap={isDisabled ? undefined : { scale: 0.95 }}
              disabled={isDisabled}
              onClick={handleSubmit}
              className="bg-[var(--brand)] text-white font-bold py-1.5 px-4 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--brand-hover)] transition-colors min-w-[80px] flex justify-center items-center h-9"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (onCancel ? "Save" : "Post")}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
