"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Gamepad2, GraduationCap, Moon, Sun, Volume2 } from "lucide-react";
import { AuthMenu } from "@/components/auth-menu";
import { useTheme } from "@/lib/theme-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DEFAULT_CLIENT_PREFERENCES,
  type BotClientPreferences,
  type LearnClientPreferences,
  loadClientPreferences,
  saveClientPreferences,
} from "@/lib/client-preferences";

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[var(--border-subtle)] last:border-0 gap-4">
      <div>
        <p className="text-[15px] font-semibold text-[var(--text-primary)]">{label}</p>
        {description ? <p className="text-[13px] text-[var(--text-muted)] mt-1">{description}</p> : null}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${checked ? "bg-[var(--cta-bg)]" : "bg-[var(--border)]"}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform mt-[2px] ${checked ? "translate-x-5" : "translate-x-[2px]"}`} />
      </button>
    </div>
  );
}

function Select({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)] last:border-0 gap-4">
      <p className="text-[15px] font-semibold text-[var(--text-primary)]">{label}</p>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] text-sm rounded-lg p-2 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Slider({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  return (
    <div className="py-3 border-b border-[var(--border-subtle)] last:border-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[15px] font-semibold text-[var(--text-primary)]">{label}</p>
        <span className="text-[13px] font-mono bg-[var(--surface-hover)] px-2 py-1 rounded">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[var(--cta-bg)]"
      />
    </div>
  );
}

export default function SettingsPage() {
  const { toggleTheme, isDark } = useTheme();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [activeScope, setActiveScope] = useState<"learn" | "bot">("learn");
  const [learnPrefs, setLearnPrefs] = useState<LearnClientPreferences>(DEFAULT_CLIENT_PREFERENCES.learn);
  const [botPrefs, setBotPrefs] = useState<BotClientPreferences>(DEFAULT_CLIENT_PREFERENCES.bot);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const loaded = loadClientPreferences();
    setLearnPrefs(loaded.learn);
    setBotPrefs(loaded.bot);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled || !session?.user?.id) return;
      setCurrentUserId(session.user.id);
      const { data } = await supabase.from("profiles").select("username").eq("id", session.user.id).maybeSingle();
      if (!cancelled && typeof data?.username === "string") {
        setUsername(data.username);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const resolvePersistenceMode = async (): Promise<"persist" | "session" | "redirect"> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.id) {
      return "persist";
    }

    const wantsLogin = window.confirm(
      "Sign in to save settings across sessions? Click Cancel to apply changes for this session only.",
    );

    if (wantsLogin) {
      window.location.href = "/login?next=%2Fsettings";
      return "redirect";
    }

    return "session";
  };

  const saveAll = async () => {
    const mode = await resolvePersistenceMode();
    if (mode === "redirect") {
      return;
    }

    if (mode === "persist") {
      saveClientPreferences({ learn: learnPrefs, bot: botPrefs });
      setSaveMessage(activeScope === "learn" ? "Learn settings saved." : "Bot settings saved.");
      return;
    }

    setSaveMessage("Settings applied for this session only. Sign in to keep them after refresh.");
  };

  const resetScope = async () => {
    if (activeScope === "learn") {
      const nextLearnPrefs = {
        ...DEFAULT_CLIENT_PREFERENCES.learn,
        openingProgressBySlug: learnPrefs.openingProgressBySlug,
      };

      const mode = await resolvePersistenceMode();
      if (mode === "redirect") {
        return;
      }

      setLearnPrefs(nextLearnPrefs);

      if (mode === "persist") {
        saveClientPreferences({ learn: nextLearnPrefs, bot: botPrefs });
        setSaveMessage("Learn settings reset.");
      } else {
        setSaveMessage("Learn settings reset for this session only.");
      }
      return;
    }

    const mode = await resolvePersistenceMode();
    if (mode === "redirect") {
      return;
    }

    setBotPrefs(DEFAULT_CLIENT_PREFERENCES.bot);

    if (mode === "persist") {
      saveClientPreferences({ learn: learnPrefs, bot: DEFAULT_CLIENT_PREFERENCES.bot });
      setSaveMessage("Bot settings reset.");
    } else {
      setSaveMessage("Bot settings reset for this session only.");
    }
  };

  const saveUsername = async () => {
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setUsernameMessage("Username must be at least 3 characters.");
      return;
    }
    if (!currentUserId) {
      setUsernameMessage("Sign in to update username.");
      return;
    }

    setUsernameSaving(true);
    setUsernameMessage(null);

    const { error } = await supabase.from("profiles").update({ username: trimmed }).eq("id", currentUserId);
    if (error) {
      setUsernameMessage(error.message);
    } else {
      await supabase.auth.updateUser({ data: { username: trimmed } });
      setUsernameMessage("Username updated.");
    }

    setUsernameSaving(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="w-full max-w-[1400px] mx-auto px-6 py-8 flex items-center justify-between">
        <Link href="/" className="text-[26px] font-serif font-[800] text-[var(--text-primary)]">CHESS</Link>
        <nav className="hidden lg:flex items-center space-x-10 text-[14px] font-medium text-[var(--text-secondary)]">
          <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Puzzles</a>
          <Link href="/learn" className="hover:text-[var(--text-primary)] transition-colors">Learn</Link>
          <Link href="/play/computer" className="hover:text-[var(--text-primary)] transition-colors">Play Bot</Link>
          <div className="flex items-center space-x-1 cursor-pointer hover:text-[var(--text-primary)] transition-colors">
            <span>More</span>
            <ChevronDown className="w-4 h-4 ml-[2px]" strokeWidth={2.5} />
          </div>
        </nav>
        <div className="flex items-center space-x-5 text-[14px] font-medium">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <AuthMenu />
        </div>
      </header>

      <main className="w-full max-w-[1200px] mx-auto px-6 pb-14">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-[var(--text-dimmed)] hover:text-[var(--text-primary)] text-[14px] font-medium group">
            <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" />
            Back
          </Link>
          <h1 className="mt-3 text-4xl font-serif text-[var(--text-primary)]">Settings</h1>
          <p className="text-[var(--text-muted)] mt-1 text-[14px]">Separate practical controls for Learn and Bot gameplay.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <aside className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 h-fit">
            <button
              onClick={() => setActiveScope("learn")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-2 text-left ${
                activeScope === "learn" ? "bg-[var(--surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
              }`}
            >
              <GraduationCap className="w-5 h-5" />
              Learn Settings
            </button>
            <button
              onClick={() => setActiveScope("bot")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-2 text-left ${
                activeScope === "bot" ? "bg-[var(--surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
              }`}
            >
              <Gamepad2 className="w-5 h-5" />
              Bot Settings
            </button>
          </aside>

          <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 md:p-8">
            {activeScope === "learn" && (
              <div>
                <h2 className="text-2xl font-serif text-[var(--text-primary)] mb-4">Learn</h2>
                <Select
                  label="Move Method"
                  value={learnPrefs.moveMethod}
                  onChange={(value) => setLearnPrefs((prev) => ({ ...prev, moveMethod: value as LearnClientPreferences["moveMethod"] }))}
                  options={[
                    { value: "drag", label: "Drag only" },
                    { value: "click", label: "Click only" },
                    { value: "both", label: "Both" },
                  ]}
                />
                <Select
                  label="Board Orientation"
                  value={learnPrefs.boardOrientation}
                  onChange={(value) => setLearnPrefs((prev) => ({ ...prev, boardOrientation: value as LearnClientPreferences["boardOrientation"] }))}
                  options={[
                    { value: "auto", label: "Auto" },
                    { value: "white", label: "White bottom" },
                    { value: "black", label: "Black bottom" },
                  ]}
                />
                <Toggle checked={learnPrefs.showLegalMoves} onChange={(value) => setLearnPrefs((prev) => ({ ...prev, showLegalMoves: value }))} label="Show Legal Moves" />
                <Toggle checked={learnPrefs.moveConfirmation} onChange={(value) => setLearnPrefs((prev) => ({ ...prev, moveConfirmation: value }))} label="Move Confirmation" />
                <Toggle checked={learnPrefs.autoQueen} onChange={(value) => setLearnPrefs((prev) => ({ ...prev, autoQueen: value }))} label="Auto Queen" />
                <Toggle checked={learnPrefs.showOpeningNames} onChange={(value) => setLearnPrefs((prev) => ({ ...prev, showOpeningNames: value }))} label="Show Opening Name" />
                <Slider value={learnPrefs.engineDepth} onChange={(value) => setLearnPrefs((prev) => ({ ...prev, engineDepth: value }))} min={10} max={24} label="Engine Depth" />
                <Slider value={learnPrefs.masterVolume} onChange={(value) => setLearnPrefs((prev) => ({ ...prev, masterVolume: value }))} min={0} max={100} label="Sound Volume" />
              </div>
            )}

            {activeScope === "bot" && (
              <div>
                <h2 className="text-2xl font-serif text-[var(--text-primary)] mb-4">Bot</h2>
                <Select
                  label="Move Method"
                  value={botPrefs.moveMethod}
                  onChange={(value) => setBotPrefs((prev) => ({ ...prev, moveMethod: value as BotClientPreferences["moveMethod"] }))}
                  options={[
                    { value: "drag", label: "Drag only" },
                    { value: "click", label: "Click only" },
                    { value: "both", label: "Both" },
                  ]}
                />
                <Select
                  label="Board Orientation"
                  value={botPrefs.boardOrientation}
                  onChange={(value) => setBotPrefs((prev) => ({ ...prev, boardOrientation: value as BotClientPreferences["boardOrientation"] }))}
                  options={[
                    { value: "auto", label: "Auto" },
                    { value: "white", label: "White bottom" },
                    { value: "black", label: "Black bottom" },
                  ]}
                />
                <Toggle checked={botPrefs.showLegalMoves} onChange={(value) => setBotPrefs((prev) => ({ ...prev, showLegalMoves: value }))} label="Show Legal Moves" />
                <Toggle checked={botPrefs.moveConfirmation} onChange={(value) => setBotPrefs((prev) => ({ ...prev, moveConfirmation: value }))} label="Move Confirmation" />
                <Toggle checked={botPrefs.autoQueen} onChange={(value) => setBotPrefs((prev) => ({ ...prev, autoQueen: value }))} label="Auto Queen" />
                <Toggle checked={botPrefs.boardLock} onChange={(value) => setBotPrefs((prev) => ({ ...prev, boardLock: value }))} label="Lock Board On Bot Turn" />
                <Toggle checked={botPrefs.lowTimeWarning} onChange={(value) => setBotPrefs((prev) => ({ ...prev, lowTimeWarning: value }))} label="Low Time Warning" />
                <Slider value={botPrefs.masterVolume} onChange={(value) => setBotPrefs((prev) => ({ ...prev, masterVolume: value }))} min={0} max={100} label="Sound Volume" />
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-[var(--border)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2"><Volume2 className="w-4 h-4" />Account</h3>
              <div className="flex gap-3">
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="flex-1 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] text-sm rounded-lg p-2.5 outline-none"
                  placeholder="Username"
                />
                <button
                  onClick={saveUsername}
                  disabled={usernameSaving}
                  className="px-4 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {usernameSaving ? "Saving..." : "Change"}
                </button>
              </div>
              {usernameMessage ? <p className="text-[12px] text-[var(--text-muted)] mt-2">{usernameMessage}</p> : null}
            </div>

            <div className="mt-8 pt-6 border-t border-[var(--border)] flex items-center justify-between">
              <p className="text-[12px] text-[var(--text-muted)]">{saveMessage ?? "Local settings are scoped by mode."}</p>
              <div className="flex gap-3">
                <button onClick={() => resetScope().catch(() => {})} className="px-5 py-2.5 rounded-xl text-[14px] bg-[var(--surface-alt)] border border-[var(--border)]">
                  Reset Scope
                </button>
                <button onClick={() => saveAll().catch(() => {})} className="px-5 py-2.5 rounded-xl text-[14px] bg-[var(--cta-bg)] text-[var(--cta-text)] font-bold">
                  Save Changes
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
