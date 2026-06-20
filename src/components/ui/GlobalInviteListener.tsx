"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Play, X, User, Dices } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { joinFriendMatch } from "@/app/actions/match";

type InvitePayload = {
  inviterId: string;
  inviterUsername: string;
  inviterRating: number;
  matchId: string;
  timeControl: string;
  variant?: string;
};

export default function GlobalInviteListener() {
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupListener = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      channel = supabase.channel(`invites:${session.user.id}`);
      
      channel.on('broadcast', { event: 'game_invite' }, ({ payload }) => {
        setInvite(payload as InvitePayload);
        setTimeLeft(10);
      })
      .on('broadcast', { event: 'invite_rejected' }, () => {
        // Simple notification
        alert("Your match invitation was rejected.");
      }).subscribe();
    };

    setupListener();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!invite) return;
    
    if (timeLeft <= 0) {
      setInvite(null); // Auto-reject / clear on timeout
      return;
    }

    const timerId = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [invite, timeLeft]);

  const handleAccept = async () => {
    if (!invite) return;
    const matchId = invite.matchId;
    setInvite(null);
    try {
      await joinFriendMatch(matchId);
    } catch (e) {
      console.error("Failed to join friend match", e);
    }
    router.push(`/play/online?matchId=${matchId}&invite=1`);
  };

  const handleReject = async () => {
    if (!invite) return;
    try {
      const { rejectMatch } = await import('@/app/actions/match');
      await rejectMatch(invite.matchId);
      
      const channel = supabase.channel(`invites:${invite.inviterId}`);
      channel.subscribe((status: any) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'invite_rejected',
            payload: { matchId: invite.matchId }
          });
        }
      });
    } catch (e) {
      console.error("Failed to reject match", e);
    }
    setInvite(null);
  };

  return (
    <AnimatePresence>
      {invite && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4"
        >
          <div className="bg-[var(--surface-alt)] border-2 border-[var(--cta-bg)] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col relative">
            <div className="p-4 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-[var(--surface)] rounded-full flex items-center justify-center mb-3 border border-[var(--border)] shadow-inner">
                {invite.variant && invite.variant !== "standard" ? (
                  <Dices className="w-6 h-6 text-[var(--cta-bg)]" />
                ) : (
                  <User className="w-6 h-6 text-[var(--text-primary)]" />
                )}
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] leading-tight">
                {invite.variant && invite.variant !== "standard" ? "Custom Challenge from" : "Challenge from"} <span className="text-[var(--cta-bg)]">{invite.inviterUsername}</span>
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1 font-semibold">
                Rating: {invite.inviterRating} &bull; {invite.timeControl}
                {invite.variant && invite.variant !== "standard" && ` \u2022 ${invite.variant}`}
              </p>
              
              <div className="flex w-full gap-3 mt-5">
                <button 
                  onClick={handleReject}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] font-bold transition-colors"
                >
                  Decline
                </button>
                <button 
                  onClick={handleAccept}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--cta-bg)] hover:brightness-110 text-white font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Accept
                </button>
              </div>
            </div>
            {/* Progress bar line at the bottom */}
            <div className="h-1 w-full bg-[var(--surface)]">
              <motion.div 
                className="h-full bg-[var(--cta-bg)]"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 10, ease: "linear" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
