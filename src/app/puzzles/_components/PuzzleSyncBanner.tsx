"use client";

type PuzzleSyncStatus = {
  badgeState: "hidden" | "syncing" | "ready" | "error";
  isSyncing: boolean;
  progressPercent: number;
  text: string | null;
  error: string | null;
};

type PuzzleSyncBannerProps = {
  status: PuzzleSyncStatus;
  notice?: string | null;
  onDismissNotice?: () => void;
  onDismissError?: () => void;
};

export function PuzzleSyncBanner({
  status,
  notice,
  onDismissNotice,
  onDismissError,
}: PuzzleSyncBannerProps) {
  if (status.badgeState === "hidden" && !notice) {
    return null;
  }

  if (status.badgeState === "error") {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-red-300">
              {status.text ?? "Puzzle sync failed."}
            </p>
            {status.error && (
              <p className="mt-1 text-[12px] text-red-200/90">{status.error}</p>
            )}
          </div>
          {onDismissError && (
            <button
              onClick={onDismissError}
              className="text-[12px] font-semibold text-red-100 hover:text-white transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status.badgeState === "syncing" || status.badgeState === "ready") {
    const barColor =
      status.badgeState === "ready"
        ? "from-emerald-500 to-emerald-400"
        : "from-sky-500 to-cyan-400";
    const labelColor =
      status.badgeState === "ready" ? "text-emerald-300" : "text-sky-300";
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
        <div className="flex items-center justify-between gap-4 mb-2">
          <p className={`text-[13px] font-semibold ${labelColor}`}>
            {status.text ?? "Syncing puzzle progress..."}
          </p>
          <span className="text-[12px] font-bold tabular-nums text-[var(--text-primary)]">
            {status.progressPercent}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden border border-[var(--border)]">
          <div
            className={`h-full bg-gradient-to-r ${barColor} transition-[width] duration-300 ease-out`}
            style={{ width: `${status.progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center justify-between gap-4">
      <p className="text-[13px] font-medium text-emerald-300">{notice}</p>
      {onDismissNotice && (
        <button
          onClick={onDismissNotice}
          className="text-[12px] font-semibold text-emerald-200 hover:text-white transition-colors"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
