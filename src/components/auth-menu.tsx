"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";

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
      <>
        <div className="w-[38px] h-[38px] animate-pulse bg-[var(--skeleton)] rounded-full" />
        <div className="w-[45px] h-[20px] animate-pulse bg-[var(--skeleton)] rounded-md hidden sm:block" />
        <div className="w-[82px] h-[40px] animate-pulse bg-[var(--skeleton)] rounded-full" />
      </>
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
      <>
        <Link
          href="/settings"
          className="p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all duration-300 shadow-sm flex items-center justify-center"
          title="Settings"
        >
          <Settings className="w-[18px] h-[18px]" />
        </Link>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-medium text-[14px]"
        >
          <span>{displayName}</span>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-lg bg-[var(--surface)] border border-[var(--border)] overflow-hidden z-50">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 text-[14px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
        </div>
      </>
    );
  }

  return (
    <>
      <Link
        href="/settings"
        className="p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all duration-300 shadow-sm flex items-center justify-center"
        title="Settings"
      >
        <Settings className="w-[18px] h-[18px]" />
      </Link>
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
