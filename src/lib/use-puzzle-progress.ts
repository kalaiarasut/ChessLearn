"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadClientPreferences } from "@/lib/client-preferences";
import {
  buildLocalPuzzleProgressSnapshot,
  createPuzzleProgressImportInput,
  hasMeaningfulLocalPuzzleProgress,
  type PuzzleProgressSnapshot,
} from "@/lib/puzzle-progress";

const PUZZLE_IMPORT_MARKER_PREFIX = "ChessLearn-puzzle-import:v1:";
const READY_BADGE_TIMEOUT_MS = 1800;

export type PuzzleSyncStatus = {
  badgeState: "hidden" | "syncing" | "ready" | "error";
  isSyncing: boolean;
  progressPercent: number;
  text: string | null;
  error: string | null;
};

const DEFAULT_SYNC_STATUS: PuzzleSyncStatus = {
  badgeState: "hidden",
  isSyncing: false,
  progressPercent: 0,
  text: null,
  error: null,
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function loadLocalPreferences() {
  return loadClientPreferences().puzzle;
}

function loadLocalSnapshot(authenticated = false) {
  return buildLocalPuzzleProgressSnapshot(loadLocalPreferences(), authenticated);
}

function getImportMarkerKey(userId: string) {
  return `${PUZZLE_IMPORT_MARKER_PREFIX}${userId}`;
}

function hasSuccessfulImportMarker(userId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(getImportMarkerKey(userId)) === "1";
}

function setSuccessfulImportMarker(userId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getImportMarkerKey(userId), "1");
}

export function usePuzzleProgress() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [progress, setProgress] = useState<PuzzleProgressSnapshot>(() => loadLocalSnapshot());
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<PuzzleSyncStatus>(DEFAULT_SYNC_STATUS);

  const dismissImportNotice = useCallback(() => {
    setImportNotice(null);
  }, []);

  const dismissSyncError = useCallback(() => {
    setSyncStatus((current) =>
      current.badgeState === "error" ? DEFAULT_SYNC_STATUS : current,
    );
  }, []);

  const setSyncProgress = useCallback((progressPercent: number, text: string) => {
    setSyncStatus({
      badgeState: "syncing",
      isSyncing: true,
      progressPercent,
      text,
      error: null,
    });
  }, []);

  const refresh = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setAuthenticated(false);
      setProgress(loadLocalSnapshot());
      setImportNotice(null);
      setSyncStatus(DEFAULT_SYNC_STATUS);
      setLoading(false);
      return;
    }

    setAuthenticated(true);
    const userId = session.user.id;
    const localPreferences = loadLocalPreferences();
    const localSnapshot = buildLocalPuzzleProgressSnapshot(localPreferences, true);

    try {
      const response = await fetch("/api/puzzle-progress", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Progress request failed with ${response.status}`);
      }

      const serverSnapshot = (await response.json()) as PuzzleProgressSnapshot;
      const shouldAutoImport =
        !serverSnapshot.hasServerHistory &&
        hasMeaningfulLocalPuzzleProgress(localPreferences) &&
        !hasSuccessfulImportMarker(userId);

      if (!shouldAutoImport) {
        setProgress(serverSnapshot);
        setSyncStatus(DEFAULT_SYNC_STATUS);
        setLoading(false);
        return;
      }

      try {
        setSyncProgress(8, "Preparing puzzle sync...");
        await wait(90);
        setSyncProgress(22, "Checking local puzzle progress...");
        await wait(90);
        setSyncProgress(41, "Starting account sync...");
        const importResponse = await fetch("/api/puzzle-progress/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPuzzleProgressImportInput(localPreferences)),
        });

        if (!importResponse.ok) {
          let errorMessage = `Import request failed with ${importResponse.status}`;
          try {
            const errorData = (await importResponse.json()) as { error?: string };
            if (typeof errorData.error === "string" && errorData.error.length > 0) {
              errorMessage = errorData.error;
            }
          } catch {
            // Ignore JSON parsing failures for error payloads.
          }
          throw new Error(errorMessage);
        }

        setSyncProgress(73, "Applying synced puzzle progress...");
        await wait(90);
        const result = (await importResponse.json()) as {
          imported: boolean;
          snapshot: PuzzleProgressSnapshot;
        };

        setProgress(result.snapshot);
        if (result.imported) {
          setSuccessfulImportMarker(userId);
          setSyncStatus({
            badgeState: "ready",
            isSyncing: false,
            progressPercent: 100,
            text: "Puzzle sync complete.",
            error: null,
          });
          setImportNotice("Local puzzle progress synced to your account.");
          window.setTimeout(() => {
            setSyncStatus((current) => (current.badgeState === "ready" ? DEFAULT_SYNC_STATUS : current));
          }, READY_BADGE_TIMEOUT_MS);
        } else {
          setSyncStatus(DEFAULT_SYNC_STATUS);
        }
      } catch (error) {
        setProgress(localSnapshot);
        setSyncStatus({
          badgeState: "error",
          isSyncing: false,
          progressPercent: 0,
          text: "Puzzle sync failed. Using local progress for now.",
          error: error instanceof Error ? error.message : "Puzzle sync failed.",
        });
      }
    } catch {
      setProgress(localSnapshot);
    } finally {
      setLoading(false);
    }
  }, [setSyncProgress, supabase]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled) {
        return;
      }
      setLoading(true);
      await refresh();
    };

    void run();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void run();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [refresh, supabase]);

  return {
    progress,
    authenticated,
    loading,
    importNotice,
    syncStatus,
    dismissImportNotice,
    dismissSyncError,
    refresh,
    setProgress,
  };
}
