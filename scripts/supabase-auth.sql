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
