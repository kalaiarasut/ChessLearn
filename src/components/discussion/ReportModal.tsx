"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { reportPostAction } from "@/app/actions/discussion";
import { toast } from "sonner";

interface ReportModalProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
}

const REPORT_REASONS = [
  "Spam or misleading",
  "Harassment or hate speech",
  "Inappropriate content",
  "Violence or physical harm",
  "Other"
];

export function ReportModal({ postId, isOpen, onClose }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setIsSubmitting(true);
    try {
      await reportPostAction(postId, selectedReason);
      toast.success("Report submitted successfully. Thank you for keeping our community safe.");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <AlertTriangle size={20} className="text-red-500" />
                <h2 className="font-bold text-lg">Report Post</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-[var(--surface-alt)] rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 flex flex-col gap-3">
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                Why are you reporting this post? Your report will remain anonymous.
              </p>
              
              {REPORT_REASONS.map(reason => (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full p-3 text-left border rounded-xl transition-all ${
                    selectedReason === reason 
                      ? "border-red-500 bg-red-500/10 text-red-500 font-medium" 
                      : "border-[var(--border)] hover:border-red-500/50 hover:bg-red-500/5 text-[var(--text-primary)]"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--surface-alt)]">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 font-medium text-[var(--text-secondary)] hover:bg-[var(--border)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedReason || isSubmitting}
                className="px-4 py-2 font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center min-w-[100px]"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Submit Report"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
