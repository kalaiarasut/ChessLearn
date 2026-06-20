"use client";
import { useState } from "react";
import Link from "next/link";
import { Lock, ArrowRight, Eye, EyeOff, CheckCircle, Sun, Moon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme-context";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const { toggleTheme, isDark } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setErrorMessage(error.message);
      setStatus("error");
    } else {
      setStatus("success");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[var(--bg)]">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--glow-orb)] opacity-100 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        data-theme-toggle
        className="absolute top-8 right-8 p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all duration-300 z-20 shadow-sm"
      >
        {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
      </button>

      {/* Auth Card */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo/Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block text-[32px] font-serif font-[800] text-[var(--text-primary)] tracking-normal hover:scale-105 transition-transform duration-300">
            CHESS
          </Link>
          <p className="text-[var(--text-secondary)] mt-3 font-medium text-[15px]">Create new password</p>
        </div>

        {/* Form Container */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 shadow-[var(--shadow-card)] relative overflow-hidden group">
          {/* Subtle top highlight */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--gradient-line)] to-transparent opacity-50" />

          {status === "success" ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-[var(--surface-alt)] rounded-full flex items-center justify-center mx-auto mb-6 border border-[var(--border-subtle)]">
                <CheckCircle className="w-8 h-8 text-[var(--text-primary)]" />
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Password Updated!</h2>
              <p className="text-[var(--text-secondary)] text-[15px] leading-relaxed mb-8">
                Your password has been successfully reset.
              </p>
              <Link href="/learn" className="inline-flex items-center justify-center space-x-2 bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-xl py-3 px-8 font-bold text-[15px] hover:bg-[var(--cta-hover)] transition-all duration-300">
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Password Input */}
              <div className="space-y-2 text-left">
                <label className="text-[13px] font-semibold text-[var(--text-muted)] uppercase tracking-wider pl-1">
                  New Password
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute left-3 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--input-bg)]">
                    <Lock className="w-5 h-5 text-[var(--text-dimmed)]" strokeWidth={2} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl pl-12 pr-12 py-4 focus:outline-none focus:border-[var(--text-primary)] focus:ring-1 focus:ring-[var(--text-primary)] transition-all duration-300 placeholder:text-[var(--text-dimmed)] text-[15px] tracking-widest"
                    required
                    disabled={status === "loading"}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 text-[var(--text-dimmed)] hover:text-[var(--text-primary)] transition-colors duration-300 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {status === "error" && (
                <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-text)]">
                  {errorMessage}
                </p>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full flex items-center justify-center space-x-2 bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-xl py-4 mt-6 font-bold text-[16px] hover:bg-[var(--cta-hover)] transition-all duration-300 group/btn disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{status === "loading" ? "Updating..." : "Update Password"}</span>
                {status !== "loading" && <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform duration-300" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
