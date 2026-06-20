"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toggleFollow, checkIsFollowing } from "@/app/actions/follows";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface FollowButtonProps {
  targetUserId: string;
  initialIsFollowing?: boolean;
}

export function FollowButton({ targetUserId, initialIsFollowing = false }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(initialIsFollowing !== undefined);

  useEffect(() => {
    if (!initialized) {
      checkIsFollowing(targetUserId).then(status => {
        setIsFollowing(status);
        setInitialized(true);
      });
    }
  }, [targetUserId, initialized]);

  const handleToggle = async () => {
    try {
      setLoading(true);
      await toggleFollow(targetUserId);
      setIsFollowing(!isFollowing);
      toast.success(isFollowing ? "Unfollowed" : "Following");
    } catch (error: any) {
      toast.error(error.message || "Failed to toggle follow status");
    } finally {
      setLoading(false);
    }
  };

  if (!initialized) {
    return <div className="w-20 h-8 bg-[var(--surface-alt)] rounded animate-pulse" />;
  }

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      onClick={handleToggle}
      disabled={loading}
      className={`px-4 py-1.5 rounded-full font-bold text-sm transition-colors flex items-center justify-center min-w-[6rem] ${
        isFollowing 
          ? "bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 hover:after:content-['Unfollow'] after:content-['Following']" 
          : "bg-[var(--text-primary)] text-[var(--bg)] hover:bg-[var(--text-secondary)] after:content-['Follow']"
      }`}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin absolute" />}
      <span className={loading ? "opacity-0" : ""}></span>
    </motion.button>
  );
}
