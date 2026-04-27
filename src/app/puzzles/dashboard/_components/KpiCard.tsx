import React from "react";
import { LucideIcon } from "lucide-react";

type KpiCardProps = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  colorType?: "neutral" | "performance" | "solved" | "replay";
  solvedPercent?: number; // Only for "solved" to determine gradient
  onClick?: () => void;
};

export function KpiCard({ label, value, icon: Icon, colorType = "neutral", solvedPercent, onClick }: KpiCardProps) {
  let colorStyles = "bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--border-hover)]";
  
  if (colorType === "performance") {
    colorStyles = "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:border-amber-500/50";
  } else if (colorType === "solved") {
    if (solvedPercent !== undefined) {
      if (solvedPercent >= 67) {
        colorStyles = "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:border-emerald-500/50";
      } else if (solvedPercent >= 34) {
        colorStyles = "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:border-amber-500/50";
      } else {
        colorStyles = "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:border-rose-500/50";
      }
    }
  } else if (colorType === "replay") {
    colorStyles = "bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20 hover:border-blue-500/50 cursor-pointer";
  }

  return (
    <div 
      className={`flex flex-col items-center justify-center gap-1.5 px-4 py-4 rounded-xl border transition-all duration-300 min-w-[100px] h-full ${colorStyles} ${onClick ? "hover:-translate-y-0.5" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 opacity-80" />}
        <span className="text-[24px] font-bold tabular-nums">{value}</span>
      </div>
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">
        {label}
      </span>
    </div>
  );
}
