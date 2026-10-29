-- Brushy: run this once in Supabase -> SQL Editor.
-- Stores one row per user. Row Level Security means a user can only ever touch their own row.

create table if not exists public.user_data (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  alarms       jsonb,
  alarms_at    bigint not null default 0,   -- ms timestamp of the last local edit (last write wins)
  settings     jsonb,
  settings_at  bigint not null default 0,
  completed    jsonb  not null default '[]'::jsonb,  -- brushing history, merged as a set union
  updated_at   timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "read own row"   on public.user_data for select using (auth.uid() = user_id);
create policy "insert own row" on public.user_data for insert with check (auth.uid() = user_id);
create policy "update own row" on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own row" on public.user_data for delete using (auth.uid() = user_id);

-- Lets a signed-in user delete their own account (required by the App Store).
-- The row in user_data goes with it (on delete cascade).
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
