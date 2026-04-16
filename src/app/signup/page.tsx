"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, ChevronLeft, Sun, Moon } from "lucide-react";
import { signup } from "@/app/actions/auth";
import { useTheme } from "@/lib/theme-context";

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, formAction, pending] = useActionState(signup, {});
  const hasPasswordInput = password.length > 0;
  const isPasswordValid = password.length >= 8;
  const { toggleTheme, isDark } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[var(--bg)]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[var(--glow-orb)] opacity-100 blur-[140px] rounded-full mix-blend-screen pointer-events-none" />

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

      <div className="w-full max-w-md relative z-10 pt-8 pb-12">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-[32px] font-serif font-[800] text-[var(--text-primary)] tracking-normal hover:scale-105 transition-transform duration-300">
            CHESS
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-4 tracking-tight">Create your account</h1>
          <p className="text-[var(--text-muted)] mt-2 font-medium text-[15px]">Join the world&apos;s #1 chess community.</p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 shadow-[var(--shadow-card)] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--gradient-line)] to-transparent opacity-50" />

          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label htmlFor="username" className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider pl-1">
                Username
              </label>
              <div className="relative flex items-center">
                <div className="pointer-events-none absolute left-3 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--input-bg)]">
                  <User className="w-5 h-5" strokeWidth={2} />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="MagnusCarlsen1"
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-12 py-3.5 focus:outline-none focus:border-[var(--text-primary)] focus:ring-1 focus:ring-[var(--text-primary)] transition-all duration-300 placeholder:text-[var(--text-dimmed)] text-[15px]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="email" className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider pl-1">
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
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="grandmaster@chess.com"
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-12 py-3.5 focus:outline-none focus:border-[var(--text-primary)] focus:ring-1 focus:ring-[var(--text-primary)] transition-all duration-300 placeholder:text-[var(--text-dimmed)] text-[15px]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="password" className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider pl-1">
                Password
              </label>
              <div className="relative flex items-center">
                <div className="pointer-events-none absolute left-3 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--input-bg)]">
                  <Lock className="w-5 h-5" strokeWidth={2} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl pl-12 pr-12 py-3.5 focus:outline-none focus:border-[var(--text-primary)] focus:ring-1 focus:ring-[var(--text-primary)] transition-all duration-300 placeholder:text-[var(--text-dimmed)] text-[15px] tracking-widest"
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
              {hasPasswordInput && (
                <p className={`text-[12px] pl-1 ${isPasswordValid ? "text-[var(--success-text)]" : "text-[var(--error-text)]"}`}>
                  {isPasswordValid
                    ? `Password looks good (${password.length} characters).`
                    : `Password must be at least 8 characters (${password.length}/8).`}
                </p>
              )}
            </div>

            <div className="pt-2">
              <p className="text-[12px] text-[var(--text-dimmed)] leading-relaxed">
                By signing up, you agree to our <a href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-2 transition-colors">Terms of Service</a> and <a href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-2 transition-colors">Privacy Policy</a>.
              </p>
            </div>

            {state.error && <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-text)]">{state.error}</p>}
            {state.success && <p className="rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success-text)]">{state.success}</p>}

            <button
              type="submit"
              disabled={pending || !isPasswordValid}
              className="w-full flex items-center justify-center space-x-2 bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-xl py-4 mt-8 font-bold text-[16px] hover:bg-[var(--cta-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 group/btn"
            >
              <span>{pending ? "Creating Account..." : "Create Account"}</span>
              <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform duration-300" />
            </button>
          </form>

          <div className="flex items-center space-x-4 my-6">
            <div className="flex-1 h-[1px] bg-[var(--divider)]"></div>
            <span className="text-[11px] font-semibold text-[var(--text-dimmed)] uppercase tracking-wider">Or sign up with</span>
            <div className="flex-1 h-[1px] bg-[var(--divider)]"></div>
          </div>

          <div className="flex space-x-4">
            <button className="flex-1 flex items-center justify-center space-x-2 bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--border-hover)] text-[var(--text-primary)] rounded-xl py-3 transition-colors duration-300" type="button">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
              </svg>
              <span className="font-semibold text-[13px]">Google</span>
            </button>
            <button className="flex-1 flex items-center justify-center space-x-2 bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--border-hover)] text-[var(--text-primary)] rounded-xl py-3 transition-colors duration-300" type="button">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M16 11c0-2.34 1.6-3.6 1.74-3.72-1-1.63-2.73-1.85-3.36-1.9-1.43-.16-2.78.89-3.51.89s-1.83-.88-3.02-.85c-1.54.03-2.96.95-3.75 2.43-1.62 3.02-.41 7.48 1.17 9.87.77 1.18 1.68 2.5 2.87 2.45 1.15-.05 1.62-.78 3.02-.78 1.38 0 1.81.78 3.03.75 1.25-.03 2.04-1.21 2.81-2.4 1.01-1.56 1.43-3.08 1.45-3.15-.03-.02-2.45-1-2.45-3.59zM12.98 5c.67-.84 1.13-2 1-3.16-1.02.04-2.22.71-2.9 1.54-.6.76-1.12 1.95-.98 3.1 1.13.1 2.21-.63 2.88-1.48z" />
              </svg>
              <span className="font-semibold text-[13px]">Apple</span>
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-[var(--text-muted)] text-[14px] font-medium">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--text-primary)] hover:underline underline-offset-4 transition-all">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
