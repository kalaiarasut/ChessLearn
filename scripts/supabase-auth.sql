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
