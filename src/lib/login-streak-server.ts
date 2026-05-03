import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginStreakSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type LoginStreakRow = {
  current_streak: number;
  best_streak: number;
  last_login_date: string | null;
  last_seen_at: string | null;
};

export type LoginStreakSnapshot = {
  currentStreak: number;
  bestStreak: number;
  lastLoginDate: string | null;
  lastSeenAt: string | null;
};

export type LoginStreakUpdate = LoginStreakSnapshot & {
  didUpdateToday: boolean;
};

function requireUser(user: User | null, error?: Error | null) {
  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return user;
}

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function dayNumber(dateValue: string) {
  const timestamp = Date.parse(`${dateValue}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 86_400_000) : null;
}

function toSnapshot(row: LoginStreakRow | null): LoginStreakSnapshot {
  return {
    currentStreak: row?.current_streak ?? 0,
    bestStreak: row?.best_streak ?? 0,
    lastLoginDate: row?.last_login_date ?? null,
    lastSeenAt: row?.last_seen_at ?? null,
  };
}

async function getAuthenticatedContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user, error };
}

async function fetchLoginStreakRow(supabase: LoginStreakSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_login_streaks")
    .select("current_streak, best_streak, last_login_date, last_seen_at")
    .eq("user_id", userId)
    .maybeSingle<LoginStreakRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function getLoginStreakForCurrentUser() {
  const { supabase, user, error } = await getAuthenticatedContext();
  const authedUser = requireUser(user, error);
  return toSnapshot(await fetchLoginStreakRow(supabase, authedUser.id));
}

export async function recordLoginStreakForCurrentUser(): Promise<LoginStreakUpdate> {
  const { supabase, user, error } = await getAuthenticatedContext();
  const authedUser = requireUser(user, error);
  const today = todayUtcDate();
  const now = new Date().toISOString();
  const existing = await fetchLoginStreakRow(supabase, authedUser.id);

  if (existing?.last_login_date === today) {
    const { data, error: updateError } = await supabase
      .from("user_login_streaks")
      .update({ last_seen_at: now })
      .eq("user_id", authedUser.id)
      .select("current_streak, best_streak, last_login_date, last_seen_at")
      .single<LoginStreakRow>();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      ...toSnapshot(data),
      didUpdateToday: false,
    };
  }

  const lastDay = existing?.last_login_date ? dayNumber(existing.last_login_date) : null;
  const currentDay = dayNumber(today);
  const nextCurrentStreak =
    existing && lastDay !== null && currentDay !== null && currentDay - lastDay === 1
      ? existing.current_streak + 1
      : 1;
  const nextBestStreak = Math.max(existing?.best_streak ?? 0, nextCurrentStreak);

  const { data, error: upsertError } = await supabase
    .from("user_login_streaks")
    .upsert(
      {
        user_id: authedUser.id,
        current_streak: nextCurrentStreak,
        best_streak: nextBestStreak,
        last_login_date: today,
        last_seen_at: now,
      },
      { onConflict: "user_id" },
    )
    .select("current_streak, best_streak, last_login_date, last_seen_at")
    .single<LoginStreakRow>();

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  return {
    ...toSnapshot(data),
    didUpdateToday: true,
  };
}
