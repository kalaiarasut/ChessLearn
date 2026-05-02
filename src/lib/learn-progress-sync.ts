import {
  DEFAULT_CLIENT_PREFERENCES,
  normalizeOpeningProgressBySlug,
  type LearnClientPreferences,
  type LearnOpeningProgress,
  type LearnSortMode,
  type OpeningVariationSortMode,
} from "@/lib/client-preferences";

function isLearnSortMode(value: unknown): value is LearnSortMode {
  return value === "recommended" || value === "recent" || value === "mastery" || value === "new" || value === "white" || value === "black" || value === "popularity";
}

function isVariationSortMode(value: unknown): value is OpeningVariationSortMode {
  return value === "popularity" || value === "progress";
}

export function normalizeLearnPreferences(value: unknown): LearnClientPreferences {
  if (!value || typeof value !== "object") {
    return DEFAULT_CLIENT_PREFERENCES.learn;
  }

  const candidate = value as Partial<LearnClientPreferences>;
  return {
    ...DEFAULT_CLIENT_PREFERENCES.learn,
    ...candidate,
    learnSortMode: isLearnSortMode(candidate.learnSortMode) ? candidate.learnSortMode : DEFAULT_CLIENT_PREFERENCES.learn.learnSortMode,
    openingVariationSortMode: isVariationSortMode(candidate.openingVariationSortMode)
      ? candidate.openingVariationSortMode
      : DEFAULT_CLIENT_PREFERENCES.learn.openingVariationSortMode,
    openingProgressBySlug: normalizeOpeningProgressBySlug(candidate.openingProgressBySlug),
  };
}

function mergeOpeningProgress(local: LearnOpeningProgress | undefined, server: LearnOpeningProgress | undefined): LearnOpeningProgress | null {
  if (!local && !server) {
    return null;
  }

  const localTime = local?.lastPracticedAt ? new Date(local.lastPracticedAt).getTime() : 0;
  const serverTime = server?.lastPracticedAt ? new Date(server.lastPracticedAt).getTime() : 0;
  const latest = localTime >= serverTime ? local : server;
  const variationIds = new Set([
    ...Object.keys(local?.variations ?? {}),
    ...Object.keys(server?.variations ?? {}),
  ]);
  const variations: LearnOpeningProgress["variations"] = {};

  for (const variationId of variationIds) {
    const localVariation = local?.variations[variationId];
    const serverVariation = server?.variations[variationId];

    if (!localVariation && serverVariation) {
      variations[variationId] = serverVariation;
      continue;
    }
    if (localVariation && !serverVariation) {
      variations[variationId] = localVariation;
      continue;
    }
    if (!localVariation || !serverVariation) {
      continue;
    }

    const localVariationTime = localVariation.lastPracticedAt ? new Date(localVariation.lastPracticedAt).getTime() : 0;
    const serverVariationTime = serverVariation.lastPracticedAt ? new Date(serverVariation.lastPracticedAt).getTime() : 0;
    const latestVariation = localVariationTime >= serverVariationTime ? localVariation : serverVariation;

    variations[variationId] = {
      attempts: Math.max(localVariation.attempts, serverVariation.attempts),
      completions: Math.max(localVariation.completions, serverVariation.completions),
      bestAccuracy: Math.max(localVariation.bestAccuracy, serverVariation.bestAccuracy),
      lastAccuracy: latestVariation.lastAccuracy,
      lastPracticedAt: latestVariation.lastPracticedAt,
    };
  }

  return {
    lastPracticedLineId: latest?.lastPracticedLineId ?? null,
    lastPracticedAt: latest?.lastPracticedAt ?? "",
    variations,
  };
}

export function mergeLearnPreferences(localLearn: LearnClientPreferences, serverLearn: LearnClientPreferences): LearnClientPreferences {
  const slugs = new Set([
    ...Object.keys(localLearn.openingProgressBySlug),
    ...Object.keys(serverLearn.openingProgressBySlug),
  ]);
  const openingProgressBySlug: Record<string, LearnOpeningProgress> = {};

  for (const slug of slugs) {
    const merged = mergeOpeningProgress(localLearn.openingProgressBySlug[slug], serverLearn.openingProgressBySlug[slug]);
    if (merged) {
      openingProgressBySlug[slug] = merged;
    }
  }

  return {
    ...DEFAULT_CLIENT_PREFERENCES.learn,
    ...serverLearn,
    ...localLearn,
    openingProgressBySlug,
  };
}
