-- Brushy friends + streak competition.
-- Run this once in Supabase -> SQL Editor, AFTER schema.sql.
--
-- Privacy model:
--  * Nothing is shared until a user creates a profile (opt-in).
--  * People are added by a random friend code, never by email.
--  * Tables can't be read or written directly by the app, only through the functions below,
--    which check who is asking. A user sees another user's numbers only if both accepted.
--  * Photos and email addresses are never part of this.

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  display_name   text not null check (char_length(btrim(display_name)) between 2 and 20),
  friend_code    text not null unique,
  current_streak int  not null default 0 check (current_streak between 0 and 3650),
  best_streak    int  not null default 0 check (best_streak    between 0 and 3650),
  week_count     int  not null default 0 check (week_count     between 0 and 28),
  last_brush_day date,   -- most recent day with any brush
  last_met_day   date,   -- most recent day the daily goal was met (tells whether a streak is still alive)
  stats_at       timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "read own profile"   on public.profiles for select using (auth.uid() = user_id);
create policy "update own profile" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The app may only change its own stats columns directly. Name and code change only via functions.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (current_streak, best_streak, week_count, last_brush_day, last_met_day, stats_at)
  on public.profiles to authenticated;

-- -------------------------------------------------------------- friendships

create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  requester  uuid not null references auth.users (id) on delete cascade,
  addressee  uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);

-- One row per pair of people, whoever asked first.
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;   -- no policies: no direct access
revoke all on public.friendships from anon, authenticated;

-- ---------------------------------------------------------------- functions

-- Creates the caller's profile and returns their new friend code.
create or replace function public.create_profile(p_name text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid      uuid := auth.uid();
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- no 0/O/1/I to avoid mix-ups
  code     text;
  tries    int := 0;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.profiles where user_id = uid) then raise exception 'profile_exists'; end if;
  p_name := btrim(p_name);
  if char_length(p_name) not between 2 and 20 then raise exception 'bad_name'; end if;

  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    begin
      insert into public.profiles (user_id, display_name, friend_code) values (uid, p_name, code);
      return code;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 10 then raise; end if;
    end;
  end loop;
end;
$$;

create or replace function public.update_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.profiles set display_name = btrim(p_name) where user_id = auth.uid();
end;
$$;

-- Returns one of: sent, accepted, already_friends, already_pending, not_found, self, no_profile, not_signed_in
create or replace function public.send_friend_request(p_code text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid    uuid := auth.uid();
  target uuid;
  f      public.friendships%rowtype;
begin
  if uid is null then return 'not_signed_in'; end if;
  if not exists (select 1 from public.profiles where user_id = uid) then return 'no_profile'; end if;

  select user_id into target from public.profiles where friend_code = upper(btrim(p_code));
  if target is null then return 'not_found'; end if;
  if target = uid then return 'self'; end if;

  select * into f from public.friendships
   where least(requester, addressee) = least(uid, target)
     and greatest(requester, addressee) = greatest(uid, target);

  if found then
    if f.status = 'accepted' then return 'already_friends'; end if;
    if f.status = 'pending' then
      if f.requester = target then            -- they already asked me: that's a yes
        update public.friendships set status = 'accepted' where id = f.id;
        return 'accepted';
      end if;
      return 'already_pending';
    end if;
    -- declined
    if f.addressee = uid then                 -- I declined them before, and now I'm the one asking
      update public.friendships set requester = uid, addressee = target, status = 'pending' where id = f.id;
    end if;
    return 'sent';                            -- if they declined me, stay silent
  end if;

  insert into public.friendships (requester, addressee) values (uid, target);
  return 'sent';
end;
$$;

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns void
language sql
security definer
set search_path = public, auth
as $$
  update public.friendships
     set status = case when p_accept then 'accepted' else 'declined' end
   where id = p_id and addressee = auth.uid() and status = 'pending';
$$;

-- Unfriend, or cancel a request you sent.
create or replace function public.remove_friendship(p_id uuid)
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from public.friendships
   where id = p_id and auth.uid() in (requester, addressee) and status <> 'declined';
$$;

-- The caller, plus everyone they are friends with or have a pending request with.
-- Numbers are only included for accepted friends.
create or replace function public.get_friends()
returns table (
  friendship_id  uuid,
  status         text,
  incoming       boolean,
  display_name   text,
  current_streak int,
  best_streak    int,
  week_count     int,
  last_brush_day date,
  last_met_day   date,
  is_me          boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select null::uuid, 'me'::text, false, p.display_name, p.current_streak, p.best_streak,
         p.week_count, p.last_brush_day, p.last_met_day, true
    from public.profiles p
   where p.user_id = auth.uid()
  union all
  select f.id, f.status, (f.addressee = auth.uid()), p.display_name,
         case when f.status = 'accepted' then p.current_streak end,
         case when f.status = 'accepted' then p.best_streak end,
         case when f.status = 'accepted' then p.week_count end,
         case when f.status = 'accepted' then p.last_brush_day end,
         case when f.status = 'accepted' then p.last_met_day end,
         false
    from public.friendships f
    join public.profiles p
      on p.user_id = case when f.requester = auth.uid() then f.addressee else f.requester end
   where auth.uid() in (f.requester, f.addressee)
     and f.status in ('pending', 'accepted');
$$;

-- Stop sharing: removes the profile and every friendship.
create or replace function public.delete_my_profile()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from public.friendships where auth.uid() in (requester, addressee);
  delete from public.profiles where user_id = auth.uid();
end;
$$;

-- Only signed-in users may call any of these.
do $$
declare fn text;
begin
  foreach fn in array array[
    'create_profile(text)',
    'update_display_name(text)',
    'send_friend_request(text)',
    'respond_friend_request(uuid, boolean)',
    'remove_friendship(uuid)',
    'get_friends()',
    'delete_my_profile()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
