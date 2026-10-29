-- Brushy hardening. Run once in Supabase -> SQL Editor, after schema.sql, friends.sql and safety.sql.
-- Safe to run again.

-- 1. user_data: only the four row operations are needed, and signed-out visitors need none.
--    (Row Level Security already blocks anon, this removes the extra table privileges too.)
revoke all on public.user_data from anon, authenticated;
grant select, insert, update, delete on public.user_data to authenticated;

-- 2. user_data: cap what one account can store, so a modified app can't fill the database.
alter table public.user_data drop constraint if exists user_data_alarms_shape;
alter table public.user_data add constraint user_data_alarms_shape
  check (alarms is null or (jsonb_typeof(alarms) = 'array' and octet_length(alarms::text) <= 20000));

alter table public.user_data drop constraint if exists user_data_settings_shape;
alter table public.user_data add constraint user_data_settings_shape
  check (settings is null or (jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 5000));

alter table public.user_data drop constraint if exists user_data_completed_shape;
alter table public.user_data add constraint user_data_completed_shape
  check (jsonb_typeof(completed) = 'array'
         and jsonb_array_length(completed) <= 1000
         and octet_length(completed::text) <= 60000);
