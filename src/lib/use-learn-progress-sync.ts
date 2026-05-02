"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  loadClientPreferences,
  saveClientPreferences,
  type LearnClientPreferences,
} from "@/lib/client-preferences";
import { mergeLearnPreferences, normalizeLearnPreferences } from "@/lib/learn-progress-sync";

const READY_BADGE_TIMEOUT_MS = 1800;

export type LearnProgressSyncStatus = {
  badgeState: "hidden" | "syncing" | "ready" | "error";
  progressPercent: number;
  text: string | null;
  error: string | null;
};

const DEFAULT_SYNC_STATUS: LearnProgressSyncStatus = {
  badgeState: "hidden",
  progressPercent: 0,
  text: null,
  error: null,
};

export function useLearnProgressSync(
  localLearn: LearnClientPreferences,
  localReady: boolean,
  onSyncedLearn: (learn: LearnClientPreferences) => void,
) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<LearnProgressSyncStatus>(DEFAULT_SYNC_STATUS);
  const hydratedRef = useRef(false);
  const lastPayloadRef = useRef("");
  const syncTimerRef = useRef<number | null>(null);

  const saveLearnLocally = useCallback((learn: LearnClientPreferences) => {
    const current = loadClientPreferences();
    saveClientPreferences({
      ...current,
      learn,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!cancelled) {
        setUserId(session?.user?.id ?? null);
      }
    };

    void resolveSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      hydratedRef.current = false;
      lastPayloadRef.current = "";
      setUserId(session?.user?.id ?? null);
      if (!session?.user) {
        setSyncStatus(DEFAULT_SYNC_STATUS);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId || !localReady || hydratedRef.current) {
      return;
    }

    let cancelled = false;

    const hydrateAndUpload = async () => {
      try {
        setSyncStatus({
          badgeState: "syncing",
          progressPercent: 30,
          text: "Syncing openings...",
          error: null,
        });

        const response = await fetch("/api/learn-progress", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Opening sync failed with ${response.status}`);
        }

        const data = (await response.json()) as { learn?: unknown };
        const merged = mergeLearnPreferences(localLearn, normalizeLearnPreferences(data.learn));

        if (cancelled) {
          return;
        }

        setSyncStatus({
          badgeState: "syncing",
          progressPercent: 90,
          text: "Syncing openings...",
          error: null,
        });

        const payload = JSON.stringify(merged);
        const saveResponse = await fetch("/api/learn-progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ learn: merged }),
        });
        if (!saveResponse.ok) {
          throw new Error(`Opening save failed with ${saveResponse.status}`);
        }

        if (cancelled) {
          return;
        }

        hydratedRef.current = true;
        lastPayloadRef.current = payload;
        saveLearnLocally(merged);
        onSyncedLearn(merged);
        setSyncStatus({
          badgeState: "ready",
          progressPercent: 100,
          text: "Openings synced",
          error: null,
        });
        window.setTimeout(() => {
          setSyncStatus((current) => (current.badgeState === "ready" ? DEFAULT_SYNC_STATUS : current));
        }, READY_BADGE_TIMEOUT_MS);
      } catch (error) {
        if (!cancelled) {
          setSyncStatus({
            badgeState: "error",
            progressPercent: 0,
            text: "Opening sync failed",
            error: error instanceof Error ? error.message : "Opening sync failed.",
          });
        }
      }
    };

    void hydrateAndUpload();

    return () => {
      cancelled = true;
    };
  }, [localLearn, localReady, onSyncedLearn, saveLearnLocally, userId]);

  useEffect(() => {
    if (!userId || !localReady || !hydratedRef.current) {
      return;
    }

    const payload = JSON.stringify(localLearn);
    if (payload === lastPayloadRef.current) {
      return;
    }

    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
    }

    setSyncStatus({
      badgeState: "syncing",
      progressPercent: 90,
      text: "Syncing openings...",
      error: null,
    });

    syncTimerRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/learn-progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ learn: localLearn }),
        });
        if (!response.ok) {
          throw new Error(`Opening save failed with ${response.status}`);
        }

        lastPayloadRef.current = payload;
        setSyncStatus({
          badgeState: "ready",
          progressPercent: 100,
          text: "Openings synced",
          error: null,
        });
        window.setTimeout(() => {
          setSyncStatus((current) => (current.badgeState === "ready" ? DEFAULT_SYNC_STATUS : current));
        }, READY_BADGE_TIMEOUT_MS);
      } catch (error) {
        setSyncStatus({
          badgeState: "error",
          progressPercent: 0,
          text: "Opening sync failed",
          error: error instanceof Error ? error.message : "Opening sync failed.",
        });
      }
    }, 450);

    return () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [localLearn, localReady, userId]);

  return { syncStatus };
}
