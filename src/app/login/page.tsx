"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useMemo, useState } from "react";
import { Mail, Lock, ArrowRight, Eye, EyeOff, ChevronLeft, Sun, Moon } from "lucide-react";
import { login } from "@/app/actions/auth";
import { useTheme } from "@/lib/theme-context";

function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState(login, {});
  const { toggleTheme, isDark } = useTheme();

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    return next && next.startsWith("/") ? next : "/";
  }, [searchParams]);

  const callbackError = searchParams.get("error");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[var(--bg)]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--glow-orb)] opacity-100 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />

      <Link href="/" className="absolute top-8 left-8 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center space-x-2 group z-20">
        <div className="w-10 h-10 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-alt)] flex items-center justify-center group-hover:bg-[var(--surface-hover)] group-hover:border-[var(--border-hover)] transition-all duration-300">
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </div>
        <span className="font-semibold text-[14px]">Back</span>
      </Link>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        data-theme-toggle
        className="absolute top-8 right-8 p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all duration-300 z-20 shadow-sm"
      >
        {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
      </button>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <Link href="/" className="inline-block text-[32px] font-serif font-[800] text-[var(--text-primary)] tracking-normal hover:scale-105 transition-transform duration-300">
            CHESS
          </Link>
          <p className="text-[var(--text-secondary)] mt-3 font-medium text-[15px]">Welcome back. Ready for your next move?</p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 shadow-[var(--shadow-card)] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--gradient-line)] to-transparent opacity-50" />

          <form action={formAction} className="space-y-5">
            <input type="hidden" name="next" value={nextPath} />

            <div className="space-y-2 text-left">
              <label htmlFor="email" className="text-[13px] font-semibold text-[var(--text-muted)] uppercase tracking-wider pl-1">
                Email
              </label>
              <div className="relative flex items-center">
                <div className="pointer-events-none absolute left-3 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--input-bg)]">
                  <Mail className="w-5 h-5" strokeWidth={2} />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="grandmaster@chess.com"
                  className={`w-full bg-[var(--input-bg)] border text-[var(--text-primary)] rounded-xl px-12 py-4 focus:outline-none focus:ring-1 transition-all duration-300 placeholder:text-[var(--text-dimmed)] text-[15px] ${
                    state.field === "email"
                      ? "border-[var(--error-border)] focus:border-[var(--error-text)] focus:ring-[var(--error-text)]"
                      : "border-[var(--input-border)] focus:border-[var(--text-primary)] focus:ring-[var(--text-primary)]"
                  }`}
                  required
                />
              </div>
            </div>

            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between pl-1">
                <label htmlFor="password" className="text-[13px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Password
                </label>
                <a href="#" className="text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  Forgot?
                </a>
              </div>
              <div className="relative flex items-center">
                <div className="pointer-events-none absolute left-3 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--input-bg)]">
                  <Lock className="w-5 h-5" strokeWidth={2} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="********"
                  className={`w-full bg-[var(--input-bg)] border text-[var(--text-primary)] rounded-xl pl-12 pr-12 py-4 focus:outline-none focus:ring-1 transition-all duration-300 placeholder:text-[var(--text-dimmed)] text-[15px] tracking-widest ${
                    state.field === "password"
                      ? "border-[var(--error-border)] focus:border-[var(--error-text)] focus:ring-[var(--error-text)]"
                      : "border-[var(--input-border)] focus:border-[var(--text-primary)] focus:ring-[var(--text-primary)]"
                  }`}
                  required
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

            {(state.error || callbackError) && (
              <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-text)]">
                {state.error ?? "Email confirmation link is invalid or expired. Please sign in again."}
              </p>
            )}

            {state.success && (
              <p className="rounded-lg border border-[var(--notice-border)] bg-[var(--notice-bg)] px-3 py-2 text-sm text-[var(--notice-text)]">{state.success}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full flex items-center justify-center space-x-2 bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-xl py-4 mt-6 font-bold text-[16px] hover:bg-[var(--cta-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 group/btn"
            >
              <span>{pending ? "Signing In..." : "Sign In"}</span>
              <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform duration-300" />
            </button>
          </form>

          <div className="flex items-center space-x-4 my-8">
            <div className="flex-1 h-[1px] bg-[var(--divider)]"></div>
            <span className="text-[12px] font-semibold text-[var(--text-dimmed)] uppercase tracking-wider">Or continue with</span>
            <div className="flex-1 h-[1px] bg-[var(--divider)]"></div>
          </div>

          <div className="flex space-x-4">
            <button className="flex-1 flex items-center justify-center space-x-2 bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--border-hover)] text-[var(--text-primary)] rounded-xl py-3.5 transition-colors duration-300" type="button">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
              </svg>
              <span className="font-semibold text-[14px]">Google</span>
            </button>
            <button className="flex-1 flex items-center justify-center space-x-2 bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--border-hover)] text-[var(--text-primary)] rounded-xl py-3.5 transition-colors duration-300" type="button">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M16 11c0-2.34 1.6-3.6 1.74-3.72-1-1.63-2.73-1.85-3.36-1.9-1.43-.16-2.78.89-3.51.89s-1.83-.88-3.02-.85c-1.54.03-2.96.95-3.75 2.43-1.62 3.02-.41 7.48 1.17 9.87.77 1.18 1.68 2.5 2.87 2.45 1.15-.05 1.62-.78 3.02-.78 1.38 0 1.81.78 3.03.75 1.25-.03 2.04-1.21 2.81-2.4 1.01-1.56 1.43-3.08 1.45-3.15-.03-.02-2.45-1-2.45-3.59zM12.98 5c.67-.84 1.13-2 1-3.16-1.02.04-2.22.71-2.9 1.54-.6.76-1.12 1.95-.98 3.1 1.13.1 2.21-.63 2.88-1.48z" />
              </svg>
              <span className="font-semibold text-[14px]">Apple</span>
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-[var(--text-muted)] text-[14px] font-medium">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[var(--text-primary)] hover:underline underline-offset-4 transition-all">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
          Loading login...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
