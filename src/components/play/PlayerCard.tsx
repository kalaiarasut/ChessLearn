import React from "react";
import Link from "next/link";
import { User, SignalHigh } from "lucide-react";

interface PlayerCardProps {
  player: {
    username: string;
    rating: number;
    avatar_url?: string | null;
  } | null;
  isWhite: boolean;
  clockMs?: number;
  isActiveTurn?: boolean;
  materialAdvantage?: number;
  position?: "top" | "bottom";
}

export function PlayerCard({
  player,
  isWhite,
  clockMs,
  isActiveTurn,
  materialAdvantage,
  position = "top"
}: PlayerCardProps) {
  
  const roundedClass = position === "top" 
    ? "rounded-t-xl rounded-b-none border-b-0" 
    : "rounded-b-xl rounded-t-none border-t-0";

  return (
    <div className={`w-full flex items-center justify-between bg-[var(--surface)] px-2.5 py-1.5 ${roundedClass} border border-[var(--border)] z-10 relative`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[var(--skeleton)] border border-[var(--border)] flex items-center justify-center shrink-0 overflow-hidden relative">
          {player?.avatar_url ? (
            <img src={player.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
          ) : (
            <User className="w-4 h-4 text-[var(--text-secondary)]" />
          )}
          {/* Color Indicator dot in corner of avatar */}
          <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white/50 ${isWhite ? 'bg-white' : 'bg-[#2b2b2b]'}`} />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <Link href={`/user/${player?.username || '#'}`} className="font-bold text-[13px] text-[var(--text-primary)] tracking-wide hover:underline">
              {player?.username || (isWhite ? 'White' : 'Black')}
            </Link>
            <span className="text-[11px] text-[var(--text-muted)] font-semibold">
              ({player?.rating ? Math.round(player.rating) : 1200})
            </span>
            <SignalHigh className="w-3.5 h-3.5 text-green-500" />
            
            {materialAdvantage && materialAdvantage > 0 ? (
              <span className="text-xs text-[var(--text-muted)] font-mono ml-1">+{materialAdvantage}</span>
            ) : null}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {clockMs !== undefined && (
          <div className={`px-3 py-0.5 border rounded-lg font-mono font-bold text-[14px] shadow-inner w-[72px] text-center transition-colors ${
            isActiveTurn
              ? "bg-[var(--text-primary)] text-[var(--bg)] border-[var(--text-primary)]"
              : "bg-[var(--bg-alt)] text-[var(--text-primary)] border-[var(--border-subtle)]"
          }`}>
            {formatClockStr(clockMs)}
          </div>
        )}
      </div>
    </div>
  );
}

function formatClockStr(ms: number) {
  if (ms <= 0) return "0:00";
  if (ms < 20000) {
    return (ms / 1000).toFixed(1) + "s";
  }
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds >= 3600) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h}:${m.toString().padStart(2, "0")}:00`;
  }
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
