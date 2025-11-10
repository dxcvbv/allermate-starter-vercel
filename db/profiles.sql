-- db/profiles.sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  description text,
  survey jsonb,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

do $$ begin
  create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);
exception when duplicate_object then null; end $$;
