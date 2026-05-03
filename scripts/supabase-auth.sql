-- Create a public profile table linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) >= 3),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
using (auth.uid() = id);

-- Users can update their own profile
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id);

-- Create profile row automatically when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Used by signup to show a direct "account already exists" message.
create or replace function public.auth_email_exists(email_to_check text)
returns boolean
language sql
security definer
set search_path = auth, public
as $$
  select exists (
    select 1
    from auth.users
    where lower(email) = lower(email_to_check)
  );
$$;

grant execute on function public.auth_email_exists(text) to anon, authenticated;

-- Preferences table for board/piece/sound settings
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  board_theme text not null default 'burled_wood',
  piece_theme text not null default 'glass',
  sound_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "Users can read own preferences" on public.user_preferences;
create policy "Users can read own preferences"
on public.user_preferences
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own preferences" on public.user_preferences;
create policy "Users can insert own preferences"
on public.user_preferences
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own preferences" on public.user_preferences;
create policy "Users can update own preferences"
on public.user_preferences
for update
using (auth.uid() = user_id);

-- Keep updated_at current whenever preferences change
create or replace function public.touch_user_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;

create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute procedure public.touch_user_preferences_updated_at();

-- Puzzle progress summary for fast top-line reads
create table if not exists public.user_puzzle_summary (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_rating integer not null default 1200 check (current_rating >= 400),
  puzzles_solved integer not null default 0 check (puzzles_solved >= 0),
  puzzles_failed integer not null default 0 check (puzzles_failed >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  best_storm_score integer not null default 0 check (best_storm_score >= 0),
  best_streak_score integer not null default 0 check (best_streak_score >= 0),
  imported_theme_stats jsonb not null default '{}'::jsonb,
  last_activity_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_puzzle_summary
add column if not exists imported_theme_stats jsonb not null default '{}'::jsonb;

alter table public.user_puzzle_summary enable row level security;

drop policy if exists "Users can read own puzzle summary" on public.user_puzzle_summary;
create policy "Users can read own puzzle summary"
on public.user_puzzle_summary
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own puzzle summary" on public.user_puzzle_summary;
create policy "Users can insert own puzzle summary"
on public.user_puzzle_summary
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own puzzle summary" on public.user_puzzle_summary;
create policy "Users can update own puzzle summary"
on public.user_puzzle_summary
for update
using (auth.uid() = user_id);

-- Append-only attempt log used to derive analytics and history
create table if not exists public.user_puzzle_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id text not null,
  outcome text not null check (outcome in ('solved', 'failed')),
  rating_before integer not null check (rating_before >= 400),
  rating_after integer not null check (rating_after >= 400),
  puzzle_rating integer not null check (puzzle_rating >= 0),
  solve_time_ms integer check (solve_time_ms is null or solve_time_ms >= 0),
  mode text not null check (mode in ('random', 'daily', 'review', 'storm', 'streak')),
  theme_snapshot text[] not null default '{}',
  attempted_at timestamptz not null default now()
);

create index if not exists user_puzzle_attempts_user_attempted_at_idx
on public.user_puzzle_attempts (user_id, attempted_at desc);

create index if not exists user_puzzle_attempts_user_puzzle_idx
on public.user_puzzle_attempts (user_id, puzzle_id);

alter table public.user_puzzle_attempts enable row level security;

drop policy if exists "Users can read own puzzle attempts" on public.user_puzzle_attempts;
create policy "Users can read own puzzle attempts"
on public.user_puzzle_attempts
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own puzzle attempts" on public.user_puzzle_attempts;
create policy "Users can insert own puzzle attempts"
on public.user_puzzle_attempts
for insert
with check (auth.uid() = user_id);

-- Queue of puzzles that should be replayed after failures
create table if not exists public.user_puzzle_review_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id text not null,
  source_reason text not null check (source_reason in ('failed', 'manual_save', 'streak_break')),
  next_review_at timestamptz not null default now(),
  review_state text not null default 'queued' check (review_state in ('queued', 'done', 'snoozed')),
  last_result text check (last_result in ('solved', 'failed')),
  theme_snapshot text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, puzzle_id)
);

create index if not exists user_puzzle_review_queue_user_state_idx
on public.user_puzzle_review_queue (user_id, review_state, next_review_at asc);

alter table public.user_puzzle_review_queue enable row level security;

drop policy if exists "Users can read own review queue" on public.user_puzzle_review_queue;
create policy "Users can read own review queue"
on public.user_puzzle_review_queue
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own review queue" on public.user_puzzle_review_queue;
create policy "Users can insert own review queue"
on public.user_puzzle_review_queue
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own review queue" on public.user_puzzle_review_queue;
create policy "Users can update own review queue"
on public.user_puzzle_review_queue
for update
using (auth.uid() = user_id);

-- Tracks whether a user completed the UTC daily puzzle
create table if not exists public.user_daily_puzzle_status (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  utc_date date not null,
  puzzle_id text not null,
  completion_state text not null default 'pending' check (completion_state in ('pending', 'attempted', 'solved')),
  solved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, utc_date)
);

create index if not exists user_daily_puzzle_status_user_date_idx
on public.user_daily_puzzle_status (user_id, utc_date desc);

alter table public.user_daily_puzzle_status enable row level security;

drop policy if exists "Users can read own daily puzzle status" on public.user_daily_puzzle_status;
create policy "Users can read own daily puzzle status"
on public.user_daily_puzzle_status
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily puzzle status" on public.user_daily_puzzle_status;
create policy "Users can insert own daily puzzle status"
on public.user_daily_puzzle_status
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily puzzle status" on public.user_daily_puzzle_status;
create policy "Users can update own daily puzzle status"
on public.user_daily_puzzle_status
for update
using (auth.uid() = user_id);

create or replace function public.touch_user_puzzle_summary_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.touch_user_puzzle_review_queue_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.touch_user_daily_puzzle_status_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_puzzle_summary_set_updated_at on public.user_puzzle_summary;
create trigger user_puzzle_summary_set_updated_at
before update on public.user_puzzle_summary
for each row execute procedure public.touch_user_puzzle_summary_updated_at();

drop trigger if exists user_puzzle_review_queue_set_updated_at on public.user_puzzle_review_queue;
create trigger user_puzzle_review_queue_set_updated_at
before update on public.user_puzzle_review_queue
for each row execute procedure public.touch_user_puzzle_review_queue_updated_at();

drop trigger if exists user_daily_puzzle_status_set_updated_at on public.user_daily_puzzle_status;
create trigger user_daily_puzzle_status_set_updated_at
before update on public.user_daily_puzzle_status
for each row execute procedure public.touch_user_daily_puzzle_status_updated_at();

-- Bot game replay archive synced after login
create table if not exists public.user_bot_replays (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  replay_id text not null,
  created_at timestamptz not null,
  payload jsonb not null,
  synced_at timestamptz not null default now(),
  unique (user_id, replay_id)
);

create index if not exists user_bot_replays_user_created_idx
on public.user_bot_replays (user_id, created_at desc);

alter table public.user_bot_replays enable row level security;

drop policy if exists "Users can read own bot replays" on public.user_bot_replays;
create policy "Users can read own bot replays"
on public.user_bot_replays
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own bot replays" on public.user_bot_replays;
create policy "Users can insert own bot replays"
on public.user_bot_replays
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own bot replays" on public.user_bot_replays;
create policy "Users can update own bot replays"
on public.user_bot_replays
for update
using (auth.uid() = user_id);

drop policy if exists "Users can delete own bot replays" on public.user_bot_replays;
create policy "Users can delete own bot replays"
on public.user_bot_replays
for delete
using (auth.uid() = user_id);

-- Opening trainer progress synced after login
create table if not exists public.user_learn_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_learn_progress enable row level security;

drop policy if exists "Users can read own learn progress" on public.user_learn_progress;
create policy "Users can read own learn progress"
on public.user_learn_progress
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own learn progress" on public.user_learn_progress;
create policy "Users can insert own learn progress"
on public.user_learn_progress
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own learn progress" on public.user_learn_progress;
create policy "Users can update own learn progress"
on public.user_learn_progress
for update
using (auth.uid() = user_id);

create or replace function public.touch_user_learn_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_learn_progress_set_updated_at on public.user_learn_progress;
create trigger user_learn_progress_set_updated_at
before update on public.user_learn_progress
for each row execute procedure public.touch_user_learn_progress_updated_at();

-- Daily login streaks for signed-in users.
create table if not exists public.user_login_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  last_login_date date,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_login_streaks enable row level security;

drop policy if exists "Users can read own login streak" on public.user_login_streaks;
create policy "Users can read own login streak"
on public.user_login_streaks
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own login streak" on public.user_login_streaks;
create policy "Users can insert own login streak"
on public.user_login_streaks
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own login streak" on public.user_login_streaks;
create policy "Users can update own login streak"
on public.user_login_streaks
for update
using (auth.uid() = user_id);

create or replace function public.touch_user_login_streaks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_login_streaks_set_updated_at on public.user_login_streaks;
create trigger user_login_streaks_set_updated_at
before update on public.user_login_streaks
for each row execute procedure public.touch_user_login_streaks_updated_at();

-- Public aggregate reads used by the site leaderboard and homepage counters.
-- These return only display names and aggregate progress, not raw attempts or private payloads.
create or replace function public.get_public_leaderboard(
  board_type text default 'puzzle',
  result_limit integer default 20
)
returns table (
  user_id uuid,
  username text,
  score integer,
  stat_text text,
  last_activity_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with normalized_limit as (
    select least(50, greatest(3, coalesce(result_limit, 20))) as limit_value
  ),
  opening_scores as (
    select
      user_learn_progress.user_id,
      coalesce(sum(
        case
          when variation.value ->> 'completions' ~ '^[0-9]+$'
            then (variation.value ->> 'completions')::integer
          else 0
        end
      ), 0)::integer as completed_variations,
      coalesce(sum(
        case
          when variation.value ->> 'attempts' ~ '^[0-9]+$'
            then (variation.value ->> 'attempts')::integer
          else 0
        end
      ), 0)::integer as total_attempts,
      max(nullif(opening.value ->> 'lastPracticedAt', '')::timestamptz) as last_practiced_at
    from public.user_learn_progress
    cross join lateral jsonb_each(
      case
        when jsonb_typeof(user_learn_progress.payload -> 'openingProgressBySlug') = 'object'
          then user_learn_progress.payload -> 'openingProgressBySlug'
        else '{}'::jsonb
      end
    ) as opening(slug, value)
    cross join lateral jsonb_each(
      case
        when jsonb_typeof(opening.value -> 'variations') = 'object'
          then opening.value -> 'variations'
        else '{}'::jsonb
      end
    ) as variation(id, value)
    group by user_learn_progress.user_id
  ),
  ranked as (
    select
      profiles.id as user_id,
      profiles.username,
      case
        when board_type = 'opening' then coalesce(opening_scores.completed_variations, 0)
        when board_type = 'activity' then greatest(
          coalesce(user_puzzle_summary.current_streak, 0),
          coalesce(user_puzzle_summary.best_streak_score, 0)
        )
        else coalesce(user_puzzle_summary.current_rating, 0)
      end::integer as score,
      case
        when board_type = 'opening' then concat(
          coalesce(opening_scores.completed_variations, 0),
          ' mastered'
        )
        when board_type = 'activity' then concat(
          coalesce(user_puzzle_summary.current_streak, 0),
          ' current streak'
        )
        else concat(coalesce(user_puzzle_summary.puzzles_solved, 0), ' solved')
      end as stat_text,
      greatest(
        user_puzzle_summary.last_activity_at,
        opening_scores.last_practiced_at
      ) as last_activity_at
    from public.profiles
    left join public.user_puzzle_summary
      on user_puzzle_summary.user_id = profiles.id
    left join opening_scores
      on opening_scores.user_id = profiles.id
  )
  select
    ranked.user_id,
    ranked.username,
    ranked.score,
    ranked.stat_text,
    ranked.last_activity_at
  from ranked
  where ranked.score > 0
  order by ranked.score desc, ranked.last_activity_at desc nulls last, ranked.username asc
  limit (select limit_value from normalized_limit);
$$;

grant execute on function public.get_public_leaderboard(text, integer) to anon, authenticated;

create or replace function public.get_public_site_stats()
returns table (
  puzzles_today bigint,
  active_players bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (
      select count(*)
      from public.user_puzzle_attempts
      where attempted_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')
    ) as puzzles_today,
    (
      select count(*)
      from public.user_puzzle_summary
      where last_activity_at >= now() - interval '15 minutes'
    ) as active_players;
$$;

grant execute on function public.get_public_site_stats() to anon, authenticated;
