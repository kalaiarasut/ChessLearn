"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DownloadableEngineVariant = "stockfish-18" | "stockfish-18-lite";

export type EngineDownloadStatus = {
  ready: boolean;
  isDownloading: boolean;
  progressPercent: number;
  error: string | null;
  badgeState: "hidden" | "downloading" | "ready" | "error";
};

type EngineAsset = {
  url: string;
  bytes: number;
};

type EngineManifest = {
  label: string;
  assets: EngineAsset[];
  totalBytes: number;
};

const ENGINE_READY_STORAGE_KEY_PREFIX = "ChessLearn.bot.engine-ready.v1.";
const READY_BADGE_TIMEOUT_MS = 1800;

const ENGINE_MANIFESTS: Record<DownloadableEngineVariant, EngineManifest> = {
  "stockfish-18": {
    label: "Full",
    assets: [
      { url: "/engines/stockfish/stockfish-18-single.js", bytes: 20_569 },
      { url: "/engines/stockfish/stockfish-18-single.wasm", bytes: 112_992_459 },
    ],
    totalBytes: 113_013_028,
  },
  "stockfish-18-lite": {
    label: "Lite",
    assets: [
      { url: "/engines/stockfish/stockfish-18-lite-single.js", bytes: 20_670 },
      { url: "/engines/stockfish/stockfish-18-lite-single.wasm", bytes: 7_295_411 },
    ],
    totalBytes: 7_316_081,
  },
};

const DEFAULT_STATUS: EngineDownloadStatus = {
  ready: false,
  isDownloading: false,
  progressPercent: 0,
  error: null,
  badgeState: "hidden",
};

const readStoredReadyFlag = (variant: DownloadableEngineVariant) => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(`${ENGINE_READY_STORAGE_KEY_PREFIX}${variant}`) === "1";
};

const writeStoredReadyFlag = (variant: DownloadableEngineVariant, ready: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  if (ready) {
    window.localStorage.setItem(`${ENGINE_READY_STORAGE_KEY_PREFIX}${variant}`, "1");
    return;
  }

  window.localStorage.removeItem(`${ENGINE_READY_STORAGE_KEY_PREFIX}${variant}`);
};

const toProgressPercent = (loadedBytes: number, totalBytes: number) => {
  if (totalBytes <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((loadedBytes / totalBytes) * 100)));
};

const warmAsset = async (
  asset: EngineAsset,
  totalBytes: number,
  completedBytes: number,
  onProgress: (loadedBytes: number) => void,
) => {
  const response = await fetch(asset.url, {
    method: "GET",
    cache: "force-cache",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Failed to download engine asset: ${asset.url}`);
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress(completedBytes + Math.max(buffer.byteLength, asset.bytes));
    return;
  }

  const reader = response.body.getReader();
  let assetLoadedBytes = 0;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    assetLoadedBytes += chunk.value?.byteLength ?? 0;
    onProgress(Math.min(totalBytes, completedBytes + assetLoadedBytes));
  }

  onProgress(Math.min(totalBytes, completedBytes + Math.max(assetLoadedBytes, asset.bytes)));
};

export function useStockfishEngineDownload(fullEngineAvailable: boolean) {
  const [statuses, setStatuses] = useState<Record<DownloadableEngineVariant, EngineDownloadStatus>>({
    "stockfish-18": DEFAULT_STATUS,
    "stockfish-18-lite": DEFAULT_STATUS,
  });
  const downloadPromisesRef = useRef<Partial<Record<DownloadableEngineVariant, Promise<boolean>>>>({});
  const readyBadgeTimeoutsRef = useRef<Partial<Record<DownloadableEngineVariant, number>>>({});

  useEffect(() => {
    const fullReady = fullEngineAvailable && readStoredReadyFlag("stockfish-18");
    const liteReady = readStoredReadyFlag("stockfish-18-lite");

    setStatuses({
      "stockfish-18": {
        ready: fullReady,
        isDownloading: false,
        progressPercent: fullReady ? 100 : 0,
        error: null,
        badgeState: "hidden",
      },
      "stockfish-18-lite": {
        ready: liteReady,
        isDownloading: false,
        progressPercent: liteReady ? 100 : 0,
        error: null,
        badgeState: "hidden",
      },
    });
  }, [fullEngineAvailable]);

  useEffect(() => {
    const readyBadgeTimeouts = readyBadgeTimeoutsRef.current;

    return () => {
      for (const timeoutId of Object.values(readyBadgeTimeouts)) {
        if (typeof timeoutId === "number") {
          window.clearTimeout(timeoutId);
        }
      }
    };
  }, []);

  const ensureEngineReady = useCallback(async (variant: DownloadableEngineVariant) => {
    if (variant === "stockfish-18" && !fullEngineAvailable) {
      setStatuses((current) => ({
        ...current,
        [variant]: {
          ...current[variant],
          ready: false,
          isDownloading: false,
          progressPercent: 0,
          error: "Full engine unavailable on this deploy.",
          badgeState: "error",
        },
      }));
      return false;
    }

    if (readStoredReadyFlag(variant)) {
      setStatuses((current) => ({
        ...current,
        [variant]: {
          ready: true,
          isDownloading: false,
          progressPercent: 100,
          error: null,
          badgeState: current[variant].badgeState === "ready" ? "ready" : "hidden",
        },
      }));
      return true;
    }

    const existingPromise = downloadPromisesRef.current[variant];
    if (existingPromise) {
      return existingPromise;
    }

    const manifest = ENGINE_MANIFESTS[variant];
    const downloadPromise = (async () => {
      setStatuses((current) => ({
        ...current,
        [variant]: {
          ready: false,
          isDownloading: true,
          progressPercent: 0,
          error: null,
          badgeState: "downloading",
        },
      }));

      let completedBytes = 0;

      try {
        for (const asset of manifest.assets) {
          await warmAsset(asset, manifest.totalBytes, completedBytes, (loadedBytes) => {
            setStatuses((current) => ({
              ...current,
              [variant]: {
                ...current[variant],
                ready: false,
                isDownloading: true,
                progressPercent: toProgressPercent(loadedBytes, manifest.totalBytes),
                error: null,
                badgeState: "downloading",
              },
            }));
          });
          completedBytes += asset.bytes;
        }

        writeStoredReadyFlag(variant, true);
        setStatuses((current) => ({
          ...current,
          [variant]: {
            ready: true,
            isDownloading: false,
            progressPercent: 100,
            error: null,
            badgeState: "ready",
          },
        }));

        const existingTimeout = readyBadgeTimeoutsRef.current[variant];
        if (typeof existingTimeout === "number") {
          window.clearTimeout(existingTimeout);
        }

        readyBadgeTimeoutsRef.current[variant] = window.setTimeout(() => {
          setStatuses((current) => ({
            ...current,
            [variant]: {
              ...current[variant],
              badgeState: current[variant].ready ? "hidden" : current[variant].badgeState,
            },
          }));
        }, READY_BADGE_TIMEOUT_MS);

        return true;
      } catch (error) {
        writeStoredReadyFlag(variant, false);
        setStatuses((current) => ({
          ...current,
          [variant]: {
            ready: false,
            isDownloading: false,
            progressPercent: 0,
            error: error instanceof Error ? error.message : "Engine download failed.",
            badgeState: "error",
          },
        }));
        return false;
      } finally {
        delete downloadPromisesRef.current[variant];
      }
    })();

    downloadPromisesRef.current[variant] = downloadPromise;
    return downloadPromise;
  }, [fullEngineAvailable]);

  return {
    statuses,
    ensureEngineReady,
  };
}
