-- Brushy security checks. Run each query separately in Supabase -> SQL Editor and compare with "Expect".
-- They only read information; nothing here changes your database.

-- 1. Row Level Security must be ON for every table.
-- Expect: every row shows rowsecurity = true (blocks, friendships, profiles, reports, user_data).
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- 2. Policies. The app reads and writes only its own rows.
-- Expect: policies on profiles (select, update) and user_data (4 own-row policies).
--         NO policies at all on blocks, friendships or reports (they are reachable only through functions).
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3. Signed-out visitors (the "anon" role) must have no table access.
-- Expect: no rows.
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public';

-- 4. Signed-in users may not write the sensitive tables directly.
-- Expect: only profiles (SELECT, plus UPDATE on stats columns) and user_data (SELECT/INSERT/UPDATE/DELETE).
--         No rows for blocks, friendships or reports.
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'authenticated' and table_schema = 'public'
order by table_name, privilege_type;

-- 5. Nobody signed out may call any function.
-- Expect: no rows.
select routine_name, grantee
from information_schema.routine_privileges
where routine_schema = 'public' and grantee in ('anon', 'PUBLIC');

-- 6. The friend-code column must not be writable from the app.
-- Expect: only these columns listed: current_streak, best_streak, week_count, last_brush_day, last_met_day, stats_at.
select column_name
from information_schema.column_privileges
where grantee = 'authenticated' and table_name = 'profiles' and privilege_type = 'UPDATE'
order by column_name;

-- 7. Reports waiting for you to review (newest first).
select created_at, reported_name, reason, details
from public.reports
order by created_at desc
limit 50;
