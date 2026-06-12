"use client";

import { useActionState, useState } from "react";
import { createProfile } from "@/app/actions/profile";
import { ArrowRight, Trophy, Target, Zap } from "lucide-react";

export default function OnboardingPage() {
  const [selectedExperience, setSelectedExperience] = useState<string>("intermediate");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    const formData = new FormData(e.currentTarget);
    formData.append("experience", selectedExperience);
    
    try {
      await createProfile(formData);
    } catch (error) {
      console.error(error);
      setIsPending(false);
      alert("Error creating profile. Please try another username.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[var(--bg)] text-[var(--text-primary)]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--glow-orb)] opacity-100 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-[32px] font-serif font-[800] tracking-normal mb-3">Welcome to ChessLearn</h1>
          <p className="text-[var(--text-secondary)] font-medium text-[15px]">Let&apos;s set up your profile and starting rating.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 shadow-[var(--shadow-card)] space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--gradient-line)] to-transparent opacity-50" />

          {/* Username Input */}
          <div className="space-y-3">
            <label htmlFor="username" className="text-[13px] font-semibold text-[var(--text-muted)] uppercase tracking-wider pl-1">
              Choose a Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="e.g. ChessMaster99"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-4 focus:outline-none focus:ring-1 focus:border-[var(--text-primary)] focus:ring-[var(--text-primary)] transition-all duration-300 placeholder:text-[var(--text-dimmed)] text-[15px]"
              required
              minLength={3}
            />
          </div>

          {/* Experience Selection */}
          <div className="space-y-4">
            <label className="text-[13px] font-semibold text-[var(--text-muted)] uppercase tracking-wider pl-1">
              Your Chess Experience
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Beginner */}
              <button
                type="button"
                onClick={() => setSelectedExperience("beginner")}
                className={`flex flex-col items-center p-6 rounded-2xl border transition-all duration-300 ${
                  selectedExperience === "beginner"
                    ? "bg-[var(--surface-hover)] border-[var(--text-primary)] shadow-sm"
                    : "bg-[var(--input-bg)] border-[var(--input-border)] hover:border-[var(--border-hover)]"
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${selectedExperience === "beginner" ? "bg-blue-500/20 text-blue-400" : "bg-[var(--surface-alt)] text-[var(--text-muted)]"}`}>
                  <Target className="w-6 h-6" />
                </div>
                <span className="font-bold text-[16px] mb-1">Beginner</span>
                <span className="text-[13px] text-[var(--text-secondary)] text-center">New to chess or still learning rules.</span>
                <span className="text-[12px] text-[var(--text-dimmed)] mt-3 font-medium">Starts at 800</span>
              </button>

              {/* Intermediate */}
              <button
                type="button"
                onClick={() => setSelectedExperience("intermediate")}
                className={`flex flex-col items-center p-6 rounded-2xl border transition-all duration-300 ${
                  selectedExperience === "intermediate"
                    ? "bg-[var(--surface-hover)] border-[var(--text-primary)] shadow-sm"
                    : "bg-[var(--input-bg)] border-[var(--input-border)] hover:border-[var(--border-hover)]"
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${selectedExperience === "intermediate" ? "bg-green-500/20 text-green-400" : "bg-[var(--surface-alt)] text-[var(--text-muted)]"}`}>
                  <Zap className="w-6 h-6" />
                </div>
                <span className="font-bold text-[16px] mb-1">Intermediate</span>
                <span className="text-[13px] text-[var(--text-secondary)] text-center">Knows basic tactics and strategies.</span>
                <span className="text-[12px] text-[var(--text-dimmed)] mt-3 font-medium">Starts at 1200</span>
              </button>

              {/* Advanced */}
              <button
                type="button"
                onClick={() => setSelectedExperience("advanced")}
                className={`flex flex-col items-center p-6 rounded-2xl border transition-all duration-300 ${
                  selectedExperience === "advanced"
                    ? "bg-[var(--surface-hover)] border-[var(--text-primary)] shadow-sm"
                    : "bg-[var(--input-bg)] border-[var(--input-border)] hover:border-[var(--border-hover)]"
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${selectedExperience === "advanced" ? "bg-purple-500/20 text-purple-400" : "bg-[var(--surface-alt)] text-[var(--text-muted)]"}`}>
                  <Trophy className="w-6 h-6" />
                </div>
                <span className="font-bold text-[16px] mb-1">Advanced</span>
                <span className="text-[13px] text-[var(--text-secondary)] text-center">Experienced tournament player.</span>
                <span className="text-[12px] text-[var(--text-dimmed)] mt-3 font-medium">Starts at 1600</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center space-x-2 bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-xl py-4 mt-8 font-bold text-[16px] hover:bg-[var(--cta-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 group/btn"
          >
            <span>{isPending ? "Creating Profile..." : "Start Playing"}</span>
            <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform duration-300" />
          </button>
        </form>
      </div>
    </div>
  );
}
