"use client";

import { useState, useRef, useEffect } from "react";
import { Image as ImageIcon, X, Loader2, Smile } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { currentUser, Post } from "@/lib/mock-data";
import { fetchUsersAction } from "@/app/actions/discussion";
import { QuotedPostPreview } from "./QuotedPostPreview";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import EmojiPicker, { Theme } from "emoji-picker-react";

interface PostComposerProps {
  onSubmit: (content: string, images: string[], pollOptions?: string[]) => Promise<void>;
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
  const [showPoll, setShowPoll] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [dynamicPlaceholder, setDynamicPlaceholder] = useState(placeholder);
  const [hasUsedBoardFeature, setHasUsedBoardFeature] = useState(true); // default true to avoid flash
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    const used = localStorage.getItem('chessify_has_used_board') === 'true';
    setHasUsedBoardFeature(used);
  }, []);

  useEffect(() => {
    if (hasUsedBoardFeature) {
      setDynamicPlaceholder(placeholder);
      return;
    }

    const example = "[fen]rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1[/fen]";
    let i = 0;
    let isDeleting = false;
    let timeout: NodeJS.Timeout;
    let isMounted = true;
    
    const typeWriter = () => {
      if (!isMounted) return;
      if (!isDeleting) {
        setDynamicPlaceholder(example.substring(0, i));
        i++;
        if (i > example.length) {
          isDeleting = true;
          timeout = setTimeout(typeWriter, 2500); // pause at end
        } else {
          timeout = setTimeout(typeWriter, 40); // typing speed
        }
      } else {
        setDynamicPlaceholder(example.substring(0, i));
        i--;
        if (i === 0) {
          isDeleting = false;
          setDynamicPlaceholder(placeholder);
          timeout = setTimeout(typeWriter, 4000); // pause at beginning showing normal placeholder
        } else {
          timeout = setTimeout(typeWriter, 20); // deleting speed
        }
      }
    };
    
    // Start after initial delay showing normal placeholder
    timeout = setTimeout(typeWriter, 2000);
    
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [hasUsedBoardFeature, placeholder]);

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
      
      await onSubmit(content, [...initialImages.filter(img => images.includes(img)), ...uploadedUrls], showPoll ? pollOptions.filter(o => o.trim()) : undefined);
      
      // Check if user just used the board feature
      if (content.includes('[fen]') || content.includes('[pgn]')) {
        localStorage.setItem('chessify_has_used_board', 'true');
        setHasUsedBoardFeature(true);
      }

      if (!onCancel) { // Don't clear if it's editing, parent handles unmount
        setContent("");
        setImages([]);
        setImageFiles([]);
        setShowPoll(false);
        setPollOptions(['', '']);
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
  const isPollValid = !showPoll || pollOptions.filter(o => o.trim()).length >= 2;
  const isDisabled = (!content.trim() && images.length === 0 && (!showPoll || !isPollValid)) || isOverLimit || isSubmitting || (showPoll && !isPollValid);

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
            placeholder={dynamicPlaceholder}
            className="w-full bg-transparent text-[var(--text-primary)] text-lg placeholder:text-[var(--text-muted)] resize-none outline-none min-h-[52px] py-2 overflow-hidden transition-all duration-75"
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

        {showPoll && (
          <div className="mt-2 p-3 border border-[var(--border)] rounded-xl flex flex-col gap-2 relative">
            <button 
              onClick={() => { setShowPoll(false); setPollOptions(['', '']); }}
              className="absolute top-2 right-2 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-full transition-colors"
            >
              <X size={16} />
            </button>
            <span className="text-sm font-bold text-[var(--text-primary)] mb-1">Poll</span>
            {pollOptions.map((opt, idx) => (
              <input
                key={idx}
                type="text"
                placeholder={`Option ${idx + 1}${idx >= 2 ? ' (optional)' : ''}`}
                value={opt}
                maxLength={25}
                onChange={(e) => {
                  const newOpts = [...pollOptions];
                  newOpts[idx] = e.target.value;
                  setPollOptions(newOpts);
                }}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand)] transition-colors"
              />
            ))}
            {pollOptions.length < 4 && (
              <button 
                onClick={() => setPollOptions([...pollOptions, ''])}
                className="text-sm text-[var(--cta-bg)] hover:underline self-start mt-1"
              >
                + Add option
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-1 relative">
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
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <ImageIcon size={20} />
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-full transition-colors hidden sm:block"
              >
                <Smile size={20} />
              </button>
              {showEmojiPicker && (
                <div className="absolute top-full left-0 z-50 mt-2 shadow-2xl">
                  <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                  <div className="relative z-50">
                    <EmojiPicker 
                      theme={Theme.DARK}
                      onEmojiClick={(emojiData) => {
                        setContent(prev => prev + emojiData.emoji);
                        setShowEmojiPicker(false);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={() => setShowPoll(!showPoll)}
              disabled={showPoll || images.length > 0}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
              title="Add poll"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 4v16"/><path d="M6 8v12"/><path d="M12 12v8"/><path d="M6 8H4"/><path d="M18 4h-2"/><path d="M12 12h-2"/></svg>
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
                      className={isOverLimit ? "text-red-500" : (percentage > 90 ? "text-yellow-500" : "text-[var(--cta-bg)]")}
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
              className="bg-[var(--cta-bg)] text-[var(--cta-text)] font-bold py-1.5 px-4 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--cta-hover)] transition-colors min-w-[80px] flex justify-center items-center h-9"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (onCancel ? "Save" : "Post")}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
