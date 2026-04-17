"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function AuthMenu() {
  const [session, setSession] = useState<Session | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    async function loadUsername(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle();

      setProfileUsername(data?.username ?? null);
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        await loadUsername(session.user.id);
      } else {
        setProfileUsername(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        loadUsername(session.user.id);
      } else {
        setProfileUsername(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setDropdownOpen(false);
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-5 text-[14px]">
        <div className="w-12 h-5 animate-pulse bg-[var(--surface-hover)] rounded" />
        <div className="w-20 h-10 animate-pulse bg-[var(--surface-hover)] rounded-full" />
      </div>
    );
  }

  if (session?.user) {
    const validProfileUsername = profileUsername && !/[@＠]/.test(profileUsername) ? profileUsername : null;
    const metadataUsername =
      typeof session.user.user_metadata?.username === "string"
        ? session.user.user_metadata.username.trim()
        : "";
    const validMetadataUsername = metadataUsername && !/[@＠]/.test(metadataUsername) ? metadataUsername : null;
    const baseDisplayName = validProfileUsername || validMetadataUsername || "User";
    const displayName = baseDisplayName.split(/[@＠]/)[0] || "User";
    
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-medium text-[14px]"
        >
          <span>{displayName}</span>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-lg bg-[var(--surface)] border border-[var(--border)] overflow-hidden z-50">
            <Link 
              href="/settings"
              onClick={() => setDropdownOpen(false)}
              className="block w-full text-left px-4 py-3 border-b border-[var(--border-subtle)] text-[14px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              Settings
            </Link>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 text-[14px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Link href="/login" className="relative text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-300 hidden sm:block after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1px] after:bg-[var(--text-primary)] hover:after:w-full after:transition-all after:duration-300">
        Login
      </Link>
      <Link href="/signup" className="px-6 py-[8px] border border-transparent bg-[var(--cta-bg)] text-[var(--cta-text)] font-bold rounded-full hover:bg-[var(--cta-hover)] hover:scale-105 transition-all duration-300 relative overflow-hidden group">
        <span className="relative z-10">Sign Up</span>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:animate-[shimmer_1.5s_infinite]" />
      </Link>
    </>
  );
}
