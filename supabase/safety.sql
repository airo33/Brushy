-- Brushy report + block.
-- Run this once in Supabase -> SQL Editor, AFTER schema.sql and friends.sql.
--
--  * Block: hides two people from each other for good. The blocked person is never told:
--    their friend requests to the blocker just say "no one has that code".
--  * Report: stored in the `reports` table. You review reports in the dashboard
--    (Table Editor -> reports). Nothing is sent to the reported person.

create table if not exists public.blocks (
  blocker    uuid not null references auth.users (id) on delete cascade,
  blocked    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;   -- no policies: no direct access
revoke all on public.blocks from anon, authenticated;

create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter      uuid not null references auth.users (id) on delete cascade,
  reported      uuid references auth.users (id) on delete set null,  -- kept even if they delete their account
  reported_name text,                                                -- their display name at report time
  reason        text not null check (reason in ('inappropriate_name', 'harassment', 'spam', 'other')),
  details       text check (char_length(details) <= 500),
  created_at    timestamptz not null default now()
);
alter table public.reports enable row level security;  -- no policies: only you, in the dashboard
revoke all on public.reports from anon, authenticated;

-- ---------------------------------------------------------------- functions

-- Blocks the other person in a friendship or request, and removes the friendship.
create or replace function public.block_user(p_friendship_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid   uuid := auth.uid();
  f     public.friendships%rowtype;
  other uuid;
begin
  select * into f from public.friendships where id = p_friendship_id and uid in (requester, addressee);
  if not found then return; end if;
  other := case when f.requester = uid then f.addressee else f.requester end;

  insert into public.blocks (blocker, blocked) values (uid, other) on conflict do nothing;
  delete from public.friendships where id = f.id;
end;
$$;

create or replace function public.unblock_user(p_user uuid)
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from public.blocks where blocker = auth.uid() and blocked = p_user;
$$;

create or replace function public.get_blocked()
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select b.blocked, coalesce(p.display_name, 'Unknown')
    from public.blocks b
    left join public.profiles p on p.user_id = b.blocked
   where b.blocker = auth.uid()
   order by b.created_at desc;
$$;

-- Records a report about the other person in a friendship or request.
create or replace function public.report_user(p_friendship_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid   uuid := auth.uid();
  f     public.friendships%rowtype;
  other uuid;
  nm    text;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_reason not in ('inappropriate_name', 'harassment', 'spam', 'other') then raise exception 'bad_reason'; end if;
  if (select count(*) from public.reports where reporter = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too_many_reports';
  end if;

  select * into f from public.friendships where id = p_friendship_id and uid in (requester, addressee);
  if not found then raise exception 'not_found'; end if;
  other := case when f.requester = uid then f.addressee else f.requester end;

  select display_name into nm from public.profiles where user_id = other;
  insert into public.reports (reporter, reported, reported_name, reason, details)
  values (uid, other, nm, p_reason, nullif(left(btrim(coalesce(p_details, '')), 500), ''));
end;
$$;

-- Friend requests respect blocks. Replaces the version from friends.sql.
-- Returns one of: sent, accepted, already_friends, already_pending, not_found, self, you_blocked, no_profile, not_signed_in
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

  if exists (select 1 from public.blocks where blocker = uid and blocked = target) then return 'you_blocked'; end if;
  -- If they blocked me, look exactly like a code that doesn't exist.
  if exists (select 1 from public.blocks where blocker = target and blocked = uid) then return 'not_found'; end if;

  select * into f from public.friendships
   where least(requester, addressee) = least(uid, target)
     and greatest(requester, addressee) = greatest(uid, target);

  if found then
    if f.status = 'accepted' then return 'already_friends'; end if;
    if f.status = 'pending' then
      if f.requester = target then
        update public.friendships set status = 'accepted' where id = f.id;
        return 'accepted';
      end if;
      return 'already_pending';
    end if;
    -- declined
    if f.addressee = uid then
      update public.friendships set requester = uid, addressee = target, status = 'pending' where id = f.id;
    end if;
    return 'sent';
  end if;

  insert into public.friendships (requester, addressee) values (uid, target);
  return 'sent';
end;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'block_user(uuid)',
    'unblock_user(uuid)',
    'get_blocked()',
    'report_user(uuid, text, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
