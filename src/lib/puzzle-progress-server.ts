import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDailyPuzzle, getPuzzles, type PuzzleEntry } from "@/lib/puzzle-service";
import {
  calculateNextPuzzleRating,
  createEmptyDailyPuzzleStatus,
  createEmptyPuzzleProgressSnapshot,
  DEFAULT_PUZZLE_PROGRESS_SUMMARY,
  getTodayUtcDate,
  normalizePuzzleMode,
  type DailyPuzzleStatus,
  type PuzzleAttemptInput,
  type PuzzleProgressImportInput,
  type PuzzleProgressSnapshot,
  type PuzzleReviewItem,
  type PuzzleThemeStat,
} from "@/lib/puzzle-progress";

type PuzzleSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type SummaryRow = {
  current_rating: number;
  puzzles_solved: number;
  puzzles_failed: number;
  current_streak: number;
  best_storm_score: number;
  best_streak_score: number;
  last_activity_at: string | null;
  imported_theme_stats: Record<string, { solved: number; failed: number }> | null;
};

type AttemptRow = {
  puzzle_id: string;
  outcome: "solved" | "failed";
  rating_after: number;
  theme_snapshot: string[] | null;
  attempted_at: string;
  solve_time_ms: number | null;
  mode: string;
  puzzle_rating: number;
};

type ReviewQueueRow = {
  id: number;
  puzzle_id: string;
  source_reason: string;
  next_review_at: string;
  review_state: "queued" | "done" | "snoozed";
  last_result: "solved" | "failed" | null;
  theme_snapshot: string[] | null;
  created_at: string;
  updated_at: string;
};

type DailyStatusRow = {
  utc_date: string;
  puzzle_id: string;
  completion_state: "pending" | "attempted" | "solved";
  solved_at: string | null;
};

function requireUser(user: User | null, error?: Error | null) {
  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return user;
}

function toSummary(row?: SummaryRow | null) {
  return {
    currentRating: row?.current_rating ?? DEFAULT_PUZZLE_PROGRESS_SUMMARY.currentRating,
    puzzlesSolved: row?.puzzles_solved ?? DEFAULT_PUZZLE_PROGRESS_SUMMARY.puzzlesSolved,
    puzzlesFailed: row?.puzzles_failed ?? DEFAULT_PUZZLE_PROGRESS_SUMMARY.puzzlesFailed,
    currentStreak: row?.current_streak ?? DEFAULT_PUZZLE_PROGRESS_SUMMARY.currentStreak,
    bestStormScore: row?.best_storm_score ?? DEFAULT_PUZZLE_PROGRESS_SUMMARY.bestStormScore,
    bestStreakScore: row?.best_streak_score ?? DEFAULT_PUZZLE_PROGRESS_SUMMARY.bestStreakScore,
    lastActivityAt: row?.last_activity_at ?? DEFAULT_PUZZLE_PROGRESS_SUMMARY.lastActivityAt,
  };
}

function toDailyStatus(row?: DailyStatusRow | null): DailyPuzzleStatus {
  if (!row) {
    return createEmptyDailyPuzzleStatus();
  }

  return {
    date: row.utc_date,
    puzzleId: row.puzzle_id,
    completed: row.completion_state === "solved",
    solvedAt: row.solved_at,
    completionState: row.completion_state,
  };
}

function toReviewItem(row: ReviewQueueRow): PuzzleReviewItem {
  return {
    id: row.id,
    puzzleId: row.puzzle_id,
    sourceReason: row.source_reason,
    nextReviewAt: row.next_review_at,
    reviewState: row.review_state,
    lastResult: row.last_result,
    themeSnapshot: row.theme_snapshot ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getPuzzleAuthContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user, error };
}

async function ensureUserPuzzleSummary(supabase: PuzzleSupabaseClient, userId: string) {
  const selectClause = "current_rating, puzzles_solved, puzzles_failed, current_streak, best_storm_score, best_streak_score, last_activity_at, imported_theme_stats";
  const { data, error } = await supabase
    .from("user_puzzle_summary")
    .select(selectClause)
    .eq("user_id", userId)
    .maybeSingle<SummaryRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("user_puzzle_summary")
    .upsert(
      {
        user_id: userId,
        current_rating: DEFAULT_PUZZLE_PROGRESS_SUMMARY.currentRating,
        puzzles_solved: 0,
        puzzles_failed: 0,
        current_streak: 0,
        best_storm_score: 0,
        best_streak_score: 0,
        last_activity_at: null,
        imported_theme_stats: {},
      },
      { onConflict: "user_id" },
    )
    .select(selectClause)
    .single<SummaryRow>();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return inserted;
}

async function fetchPagedRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...data);
    if (data.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function fetchAllAttemptRows(supabase: PuzzleSupabaseClient, userId: string) {
  return fetchPagedRows<AttemptRow>((from, to) =>
    supabase
      .from("user_puzzle_attempts")
      .select("puzzle_id, outcome, rating_after, theme_snapshot, attempted_at, solve_time_ms, mode, puzzle_rating")
      .eq("user_id", userId)
      .order("attempted_at", { ascending: false })
      .range(from, to),
  );
}

async function fetchQueuedReviewRows(supabase: PuzzleSupabaseClient, userId: string) {
  return fetchPagedRows<ReviewQueueRow>((from, to) =>
    supabase
      .from("user_puzzle_review_queue")
      .select("id, puzzle_id, source_reason, next_review_at, review_state, last_result, theme_snapshot, created_at, updated_at")
      .eq("user_id", userId)
      .eq("review_state", "queued")
      .order("next_review_at", { ascending: true })
      .range(from, to),
  );
}

function buildThemeStatsFromAttempts(rows: AttemptRow[]) {
  const stats: Record<string, PuzzleThemeStat> = {};

  for (const row of rows) {
    const themes = row.theme_snapshot ?? [];
    for (const themeId of themes) {
      if (!stats[themeId]) {
        stats[themeId] = {
          solved: 0,
          failed: 0,
          played: 0,
          accuracy: 0,
          lastAttemptAt: row.attempted_at,
        };
      }

      const entry = stats[themeId];
      entry.played += 1;
      if (row.outcome === "solved") {
        entry.solved += 1;
      } else {
        entry.failed += 1;
      }
      if (!entry.lastAttemptAt) {
        entry.lastAttemptAt = row.attempted_at;
      }
    }
  }

  for (const entry of Object.values(stats)) {
    entry.accuracy = entry.played > 0 ? entry.solved / entry.played : 0;
  }

  return stats;
}

function normalizeImportedThemeStats(value: SummaryRow["imported_theme_stats"]) {
  const normalized: Record<string, { solved: number; failed: number }> = {};

  if (!value || typeof value !== "object") {
    return normalized;
  }

  for (const [themeId, stat] of Object.entries(value)) {
    if (!stat || typeof stat !== "object") {
      continue;
    }

    const solved = typeof stat.solved === "number" && Number.isFinite(stat.solved) ? Math.max(0, Math.round(stat.solved)) : 0;
    const failed = typeof stat.failed === "number" && Number.isFinite(stat.failed) ? Math.max(0, Math.round(stat.failed)) : 0;
    normalized[themeId] = { solved, failed };
  }

  return normalized;
}

function mergeImportedThemeStats(
  baseStats: Record<string, PuzzleThemeStat>,
  importedThemeStats: SummaryRow["imported_theme_stats"],
) {
  const nextStats = { ...baseStats };
  const normalizedImported = normalizeImportedThemeStats(importedThemeStats);

  for (const [themeId, imported] of Object.entries(normalizedImported)) {
    const existing = nextStats[themeId];
    const solved = (existing?.solved ?? 0) + imported.solved;
    const failed = (existing?.failed ?? 0) + imported.failed;
    const played = solved + failed;

    nextStats[themeId] = {
      solved,
      failed,
      played,
      accuracy: played > 0 ? solved / played : 0,
      lastAttemptAt: existing?.lastAttemptAt ?? null,
    };
  }

  return nextStats;
}

function buildReviewThemeCounts(rows: ReviewQueueRow[]) {
  const counts: Record<string, number> = {};

  for (const row of rows) {
    for (const themeId of row.theme_snapshot ?? []) {
      counts[themeId] = (counts[themeId] ?? 0) + 1;
    }
  }

  return counts;
}

function hasSummaryActivity(row: SummaryRow) {
  return (
    row.current_rating !== DEFAULT_PUZZLE_PROGRESS_SUMMARY.currentRating ||
    row.puzzles_solved > 0 ||
    row.puzzles_failed > 0 ||
    row.current_streak > 0 ||
    row.best_storm_score > 0 ||
    row.best_streak_score > 0 ||
    Boolean(row.last_activity_at) ||
    Object.keys(normalizeImportedThemeStats(row.imported_theme_stats)).length > 0
  );
}

async function hasUserPuzzleServerHistory(
  supabase: PuzzleSupabaseClient,
  userId: string,
  summaryRow?: SummaryRow,
) {
  if (summaryRow && hasSummaryActivity(summaryRow)) {
    return true;
  }

  const [attemptResult, reviewResult, dailyResult] = await Promise.all([
    supabase
      .from("user_puzzle_attempts")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle<{ id: number }>(),
    supabase
      .from("user_puzzle_review_queue")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle<{ id: number }>(),
    supabase
      .from("user_daily_puzzle_status")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle<{ id: number }>(),
  ]);

  if (attemptResult.error) {
    throw new Error(attemptResult.error.message);
  }
  if (reviewResult.error) {
    throw new Error(reviewResult.error.message);
  }
  if (dailyResult.error) {
    throw new Error(dailyResult.error.message);
  }

  return Boolean(attemptResult.data || reviewResult.data || dailyResult.data);
}

async function fetchTodayDailyStatus(supabase: PuzzleSupabaseClient, userId: string) {
  const today = getTodayUtcDate();
  const { data, error } = await supabase
    .from("user_daily_puzzle_status")
    .select("utc_date, puzzle_id, completion_state, solved_at")
    .eq("user_id", userId)
    .eq("utc_date", today)
    .maybeSingle<DailyStatusRow>();

  if (error) {
    throw new Error(error.message);
  }

  return toDailyStatus(data);
}

export async function getAuthenticatedPuzzleUserId() {
  const { user } = await getPuzzleAuthContext();
  return user?.id ?? null;
}

export async function getRecentPuzzleIdsForUser(userId: string, limit = 12) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_puzzle_attempts")
    .select("puzzle_id")
    .eq("user_id", userId)
    .order("attempted_at", { ascending: false })
    .range(0, 63);

  if (error) {
    throw new Error(error.message);
  }

  const ids = Array.from(new Set((data ?? []).map((row) => row.puzzle_id as string)));
  return ids.slice(0, limit);
}

export async function getPuzzleProgressSnapshotForUser(userId: string): Promise<PuzzleProgressSnapshot> {
  const supabase = await createSupabaseServerClient();
  await ensureUserPuzzleSummary(supabase, userId);

  const [summaryRow, attemptRows, queuedReviewRows, dailyStatus] = await Promise.all([
    ensureUserPuzzleSummary(supabase, userId),
    fetchAllAttemptRows(supabase, userId),
    fetchQueuedReviewRows(supabase, userId),
    fetchTodayDailyStatus(supabase, userId),
  ]);

  const snapshot = createEmptyPuzzleProgressSnapshot(true);
  const hasServerHistory =
    hasSummaryActivity(summaryRow) ||
    attemptRows.length > 0 ||
    queuedReviewRows.length > 0 ||
    dailyStatus.completionState !== "pending";
  const recentActivity = attemptRows.slice(0, 100).map((row) => ({
    puzzleId: row.puzzle_id,
    theme: row.theme_snapshot?.[0] ?? "mix",
    rating: row.puzzle_rating,
    solved: row.outcome === "solved",
    timestamp: row.attempted_at,
    timeTakenMs: row.solve_time_ms ?? undefined,
    mode: normalizePuzzleMode(row.mode as PuzzleAttemptInput["mode"]),
  }));
  const chronologicalAttempts = [...attemptRows].reverse();

  snapshot.summary = toSummary(summaryRow);
  snapshot.dataSource = "server";
  snapshot.hasServerHistory = hasServerHistory;
  snapshot.dailyStatus = dailyStatus;
  snapshot.replayCount = queuedReviewRows.length;
  snapshot.reviewThemeCounts = buildReviewThemeCounts(queuedReviewRows);
  snapshot.themeStats = mergeImportedThemeStats(buildThemeStatsFromAttempts(attemptRows), summaryRow.imported_theme_stats);
  snapshot.ratingHistory = chronologicalAttempts.slice(-1000).map((row) => ({
    date: row.attempted_at,
    rating: row.rating_after,
  }));
  snapshot.recentActivity = recentActivity;
  snapshot.recentPuzzleIds = Array.from(new Set(recentActivity.map((entry) => entry.puzzleId))).slice(0, 12);
  return snapshot;
}

export async function getPuzzleProgressSnapshotForCurrentUser() {
  const { user, error } = await getPuzzleAuthContext();
  const authedUser = requireUser(user, error);
  return getPuzzleProgressSnapshotForUser(authedUser.id);
}

function normalizeImportThemeStats(
  themeStats: PuzzleProgressImportInput["themeStats"],
) {
  const normalized: Record<string, { solved: number; failed: number }> = {};

  for (const [themeId, stats] of Object.entries(themeStats)) {
    const solved = typeof stats?.solved === "number" && Number.isFinite(stats.solved) ? Math.max(0, Math.round(stats.solved)) : 0;
    const failed = typeof stats?.failed === "number" && Number.isFinite(stats.failed) ? Math.max(0, Math.round(stats.failed)) : 0;
    if (solved > 0 || failed > 0) {
      normalized[themeId] = { solved, failed };
    }
  }

  return normalized;
}

function buildImportReplaySeeds(recentActivity: PuzzleProgressImportInput["recentActivity"]) {
  const latestByPuzzleId = new Map<string, PuzzleProgressImportInput["recentActivity"][number]>();

  for (const entry of recentActivity) {
    if (!entry?.puzzleId || !entry.timestamp) {
      continue;
    }

    const existing = latestByPuzzleId.get(entry.puzzleId);
    if (!existing || new Date(entry.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
      latestByPuzzleId.set(entry.puzzleId, entry);
    }
  }

  return Array.from(latestByPuzzleId.values()).filter((entry) => entry.solved === false);
}

export async function importLocalPuzzleProgressForCurrentUser(input: PuzzleProgressImportInput) {
  const { supabase, user, error } = await getPuzzleAuthContext();
  const authedUser = requireUser(user, error);
  const summaryRow = await ensureUserPuzzleSummary(supabase, authedUser.id);
  const alreadyHasHistory = await hasUserPuzzleServerHistory(supabase, authedUser.id, summaryRow);

  if (alreadyHasHistory) {
    return {
      imported: false,
      snapshot: await getPuzzleProgressSnapshotForUser(authedUser.id),
    };
  }

  const importedThemeStats = normalizeImportThemeStats(input.themeStats);
  const latestActivityTimestamp = input.recentActivity
    .map((entry) => entry.timestamp)
    .filter((timestamp): timestamp is string => typeof timestamp === "string" && timestamp.length > 0)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

  const nextSummary = {
    user_id: authedUser.id,
    current_rating: Math.max(400, Math.round(input.summary.currentRating)),
    puzzles_solved: Math.max(0, Math.round(input.summary.puzzlesSolved)),
    puzzles_failed: Math.max(0, Math.round(input.summary.puzzlesFailed)),
    current_streak: Math.max(0, Math.round(input.summary.currentStreak)),
    best_storm_score: Math.max(0, Math.round(input.summary.bestStormScore)),
    best_streak_score: Math.max(0, Math.round(input.summary.bestStreakScore)),
    last_activity_at: latestActivityTimestamp,
    imported_theme_stats: importedThemeStats,
  };

  const { error: summaryError } = await supabase
    .from("user_puzzle_summary")
    .upsert(nextSummary, { onConflict: "user_id" });

  if (summaryError) {
    throw new Error(summaryError.message);
  }

  const replaySeeds = buildImportReplaySeeds(input.recentActivity);
  if (replaySeeds.length > 0) {
    const rows = replaySeeds.map((entry) => ({
      user_id: authedUser.id,
      puzzle_id: entry.puzzleId,
      source_reason: "failed",
      next_review_at: entry.timestamp,
      review_state: "queued",
      last_result: "failed",
      theme_snapshot: entry.theme ? [entry.theme] : [],
    }));

    const { error: queueError } = await supabase
      .from("user_puzzle_review_queue")
      .upsert(rows, { onConflict: "user_id,puzzle_id" });

    if (queueError) {
      throw new Error(queueError.message);
    }
  }

  const today = getTodayUtcDate();
  if (input.dailyStatus.completed && input.dailyStatus.date === today) {
    const dailyPuzzle = await getDailyPuzzle();
    if (dailyPuzzle) {
      const { error: dailyError } = await supabase
        .from("user_daily_puzzle_status")
        .upsert(
          {
            user_id: authedUser.id,
            utc_date: today,
            puzzle_id: dailyPuzzle.id,
            completion_state: "solved",
            solved_at: new Date().toISOString(),
          },
          { onConflict: "user_id,utc_date" },
        );

      if (dailyError) {
        throw new Error(dailyError.message);
      }
    }
  }

  return {
    imported: true,
    snapshot: await getPuzzleProgressSnapshotForUser(authedUser.id),
  };
}

function shouldQueueFailure(mode: ReturnType<typeof normalizePuzzleMode>) {
  return mode === "random" || mode === "daily" || mode === "streak";
}

async function upsertDailyStatus(
  supabase: PuzzleSupabaseClient,
  userId: string,
  input: PuzzleAttemptInput,
  attemptedAt: string,
) {
  const today = input.dailyDate ?? getTodayUtcDate();
  const { data: existing, error: existingError } = await supabase
    .from("user_daily_puzzle_status")
    .select("completion_state")
    .eq("user_id", userId)
    .eq("utc_date", today)
    .maybeSingle<{ completion_state: "pending" | "attempted" | "solved" }>();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.completion_state === "solved" && input.outcome !== "solved") {
    return;
  }

  const { error } = await supabase.from("user_daily_puzzle_status").upsert(
    {
      user_id: userId,
      utc_date: today,
      puzzle_id: input.puzzleId,
      completion_state: input.outcome === "solved" ? "solved" : "attempted",
      solved_at: input.outcome === "solved" ? attemptedAt : null,
    },
    { onConflict: "user_id,utc_date" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function clearReviewQueueForPuzzle(
  supabase: PuzzleSupabaseClient,
  userId: string,
  puzzleId: string,
) {
  const { error } = await supabase
    .from("user_puzzle_review_queue")
    .update({
      review_state: "done",
      last_result: "solved",
      next_review_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("puzzle_id", puzzleId);

  if (error) {
    throw new Error(error.message);
  }
}

async function queueReviewPuzzle(
  supabase: PuzzleSupabaseClient,
  userId: string,
  input: PuzzleAttemptInput,
  attemptedAt: string,
) {
  const sourceReason = normalizePuzzleMode(input.mode) === "streak" ? "streak_break" : "failed";
  const { error } = await supabase.from("user_puzzle_review_queue").upsert(
    {
      user_id: userId,
      puzzle_id: input.puzzleId,
      source_reason: sourceReason,
      next_review_at: attemptedAt,
      review_state: "queued",
      last_result: "failed",
      theme_snapshot: input.themes,
    },
    { onConflict: "user_id,puzzle_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function recordPuzzleAttemptForCurrentUser(input: PuzzleAttemptInput) {
  const { supabase, user, error } = await getPuzzleAuthContext();
  const authedUser = requireUser(user, error);
  const summary = await ensureUserPuzzleSummary(supabase, authedUser.id);
  const attemptedAt = new Date().toISOString();
  const mode = normalizePuzzleMode(input.mode);
  const ratingBefore = summary.current_rating ?? DEFAULT_PUZZLE_PROGRESS_SUMMARY.currentRating;
  const ratingAfter = calculateNextPuzzleRating(ratingBefore, input.puzzleRating, input.outcome);
  const nextSummary = {
    user_id: authedUser.id,
    current_rating: ratingAfter,
    puzzles_solved: summary.puzzles_solved + (input.outcome === "solved" ? 1 : 0),
    puzzles_failed: summary.puzzles_failed + (input.outcome === "failed" ? 1 : 0),
    current_streak:
      mode === "random" || mode === "daily" || mode === "review"
        ? input.outcome === "solved"
          ? summary.current_streak + 1
          : 0
        : summary.current_streak,
    best_storm_score:
      mode === "storm" && typeof input.modeScore === "number"
        ? Math.max(summary.best_storm_score, input.modeScore)
        : summary.best_storm_score,
    best_streak_score:
      mode === "streak" && typeof input.modeScore === "number"
        ? Math.max(summary.best_streak_score, input.modeScore)
        : summary.best_streak_score,
    last_activity_at: attemptedAt,
  };

  const { error: summaryError } = await supabase
    .from("user_puzzle_summary")
    .upsert(nextSummary, { onConflict: "user_id" });

  if (summaryError) {
    throw new Error(summaryError.message);
  }

  const { error: attemptError } = await supabase.from("user_puzzle_attempts").insert({
    user_id: authedUser.id,
    puzzle_id: input.puzzleId,
    outcome: input.outcome,
    rating_before: ratingBefore,
    rating_after: ratingAfter,
    puzzle_rating: input.puzzleRating,
    solve_time_ms: input.timeTakenMs ?? null,
    mode,
    theme_snapshot: input.themes,
    attempted_at: attemptedAt,
  });

  if (attemptError) {
    throw new Error(attemptError.message);
  }

  if (mode === "daily") {
    await upsertDailyStatus(supabase, authedUser.id, input, attemptedAt);
  }

  if (mode !== "review" && input.outcome === "solved") {
    await clearReviewQueueForPuzzle(supabase, authedUser.id, input.puzzleId);
  }

  if (input.outcome === "failed" && shouldQueueFailure(mode)) {
    await queueReviewPuzzle(supabase, authedUser.id, input, attemptedAt);
  }

  return getPuzzleProgressSnapshotForUser(authedUser.id);
}

async function findNextReviewRow(
  supabase: PuzzleSupabaseClient,
  userId: string,
  theme?: string | null,
) {
  const selectClause = "id, puzzle_id, source_reason, next_review_at, review_state, last_result, theme_snapshot, created_at, updated_at";
  const now = new Date().toISOString();

  const buildQuery = (dueOnly: boolean) => {
    let query = supabase
      .from("user_puzzle_review_queue")
      .select(selectClause)
      .eq("user_id", userId)
      .eq("review_state", "queued")
      .order("next_review_at", { ascending: true })
      .limit(1);

    if (theme) {
      query = query.contains("theme_snapshot", [theme]);
    }

    if (dueOnly) {
      query = query.lte("next_review_at", now);
    }

    return query.maybeSingle<ReviewQueueRow>();
  };

  const dueResult = await buildQuery(true);
  if (dueResult.error) {
    throw new Error(dueResult.error.message);
  }

  if (dueResult.data) {
    return dueResult.data;
  }

  const fallbackResult = await buildQuery(false);
  if (fallbackResult.error) {
    throw new Error(fallbackResult.error.message);
  }

  return fallbackResult.data ?? null;
}

export async function getNextReviewPuzzleForCurrentUser(theme?: string | null) {
  const { supabase, user, error } = await getPuzzleAuthContext();
  const authedUser = requireUser(user, error);
  const row = await findNextReviewRow(supabase, authedUser.id, theme);
  if (!row) {
    return { item: null, puzzle: null as PuzzleEntry | null };
  }

  const puzzles = await getPuzzles({ id: row.puzzle_id });
  return {
    item: toReviewItem(row),
    puzzle: puzzles[0] ?? null,
  };
}

export async function updateReviewQueueItemForCurrentUser(
  id: number,
  outcome: "solved" | "failed",
) {
  const { supabase, user, error } = await getPuzzleAuthContext();
  const authedUser = requireUser(user, error);
  const { data, error: selectError } = await supabase
    .from("user_puzzle_review_queue")
    .select("id, puzzle_id, source_reason, next_review_at, review_state, last_result, theme_snapshot, created_at, updated_at")
    .eq("user_id", authedUser.id)
    .eq("id", id)
    .maybeSingle<ReviewQueueRow>();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (!data) {
    return null;
  }

  const nextReviewAt =
    outcome === "solved"
      ? new Date().toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("user_puzzle_review_queue")
    .update({
      review_state: outcome === "solved" ? "done" : "queued",
      last_result: outcome,
      next_review_at: nextReviewAt,
    })
    .eq("user_id", authedUser.id)
    .eq("id", id)
    .select("id, puzzle_id, source_reason, next_review_at, review_state, last_result, theme_snapshot, created_at, updated_at")
    .single<ReviewQueueRow>();

  if (updateError) {
    throw new Error(updateError.message);
  }

  return toReviewItem(updated);
}
