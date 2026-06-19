"use client";

import { useState } from "react";
import { voteOnPollAction } from "@/app/actions/discussion";
import { toast } from "sonner";
import { Check } from "lucide-react";

interface PollViewerProps {
  poll: {
    id: string;
    options: string[];
    votes: { userId: string; optionIndex: number }[];
  };
  currentUserId: string | null;
}

export function PollViewer({ poll, currentUserId }: PollViewerProps) {
  const [isVoting, setIsVoting] = useState(false);
  const [optimisticVotes, setOptimisticVotes] = useState(poll.votes);

  const hasVoted = currentUserId ? optimisticVotes.some(v => v.userId === currentUserId) : false;
  const userVoteIndex = currentUserId ? optimisticVotes.find(v => v.userId === currentUserId)?.optionIndex : undefined;
  
  const totalVotes = optimisticVotes.length;

  const handleVote = async (index: number) => {
    if (!currentUserId) {
      toast.error("You must be logged in to vote");
      return;
    }
    if (hasVoted) return;

    setIsVoting(true);
    // Optimistic update
    setOptimisticVotes(prev => [...prev, { userId: currentUserId, optionIndex: index }]);

    try {
      await voteOnPollAction(poll.id, index);
    } catch (err: any) {
      // Revert on error
      setOptimisticVotes(poll.votes);
      toast.error(err.message || "Failed to vote on poll");
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3">
      {poll.options.map((option, idx) => {
        const optionVotes = optimisticVotes.filter(v => v.optionIndex === idx).length;
        const percentage = totalVotes === 0 ? 0 : Math.round((optionVotes / totalVotes) * 100);
        const isUserChoice = userVoteIndex === idx;

        return (
          <div key={idx} className="relative w-full h-8 flex items-center group">
            {hasVoted ? (
              <>
                <div 
                  className={`absolute left-0 top-0 bottom-0 rounded-md transition-all duration-500 ease-out ${isUserChoice ? 'bg-[var(--brand)]/30' : 'bg-[var(--surface-alt)]'}`} 
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative z-10 flex w-full justify-between px-3 text-sm font-medium text-[var(--text-primary)]">
                  <span className="flex items-center gap-1.5 truncate">
                    {option}
                    {isUserChoice && <Check size={14} className="text-[var(--brand)]" />}
                  </span>
                  <span className="shrink-0">{percentage}%</span>
                </div>
              </>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleVote(idx);
                }}
                disabled={isVoting}
                className="w-full h-full text-left px-3 rounded-md border border-[var(--brand)]/40 text-[var(--brand)] font-semibold text-sm hover:bg-[var(--brand)]/10 transition-colors"
              >
                {option}
              </button>
            )}
          </div>
        );
      })}
      <div className="text-xs text-[var(--text-secondary)] mt-1">
        {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
      </div>
    </div>
  );
}
