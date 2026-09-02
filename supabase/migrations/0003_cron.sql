-- Schedule poll-boards.
--
-- Run this AFTER `supabase functions deploy poll-boards`, and after replacing
-- the two placeholders below. Both are found in your Supabase dashboard:
--   <PROJECT_REF>        Settings → General
--   <SERVICE_ROLE_KEY>   Settings → API   (never commit this file once filled in)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Twice a day, 07:00 and 19:00 Manila (UTC+8) = 23:00 and 11:00 UTC.
-- Boards do not turn over fast enough to justify hourly polling, and a light
-- footprint keeps you well clear of anyone's rate limits.
select cron.unschedule('jobradar-poll')
where exists (select 1 from cron.job where jobname = 'jobradar-poll');

select cron.schedule(
  'jobradar-poll',
  '0 23,11 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/poll-boards',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Housekeeping: drop untracked postings that have not been seen on a board for
-- 45 days. Anything you have applied to is kept regardless.
select cron.schedule(
  'jobradar-prune',
  '0 16 * * 0',
  $$
  delete from public.jobs j
  where j.last_seen_at < now() - interval '45 days'
    and not exists (select 1 from public.applications a where a.job_id = j.id);
  $$
);
