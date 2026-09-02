-- JobRadar — application flow
--
-- Adds the "prepare an application" step that sat between finding a posting and
-- marking it applied: a profile to draft from, a stored cover letter draft, the
-- resume variant actually sent, and a follow-up date.
--
-- Depends on 0001_init.sql. Run after it.

-- ─────────────────────────────────────────────────────────────
-- profile: the "about you" half of a cover letter
--
-- Single-row table. The `id boolean primary key check (id)` trick means only
-- `true` is ever a valid key, so a second row is a constraint violation rather
-- than a thing the UI has to guard against.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profile (
  id              boolean primary key default true check (id),
  full_name       text not null default '',
  headline        text not null default '',
  summary         text not null default '',
  location        text not null default '',
  portfolio_url   text,
  -- Labels only ("Backend-heavy", "Full-stack"). The files live in whatever
  -- drive you already keep them in; JobRadar records which one you sent.
  resume_variants text[] not null default '{}',
  updated_at      timestamptz not null default now()
);

insert into public.profile (id) values (true) on conflict (id) do nothing;

drop trigger if exists profile_touch on public.profile;
create trigger profile_touch
  before update on public.profile
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- applications: what was actually sent, and when to chase it
-- ─────────────────────────────────────────────────────────────
alter table public.applications
  add column if not exists cover_letter text,
  add column if not exists follow_up_at timestamptz;

create index if not exists applications_follow_up_idx
  on public.applications (follow_up_at)
  where follow_up_at is not null;

-- ─────────────────────────────────────────────────────────────
-- job_feed: surface the application fields the UI could not read
--
-- `notes` and `resume_variant` existed on the table from 0001 but were never
-- exposed here, which made notes write-only — the editor had nothing to load,
-- so every save overwrote the previous one. New columns are appended at the
-- end so `create or replace view` accepts the change.
-- ─────────────────────────────────────────────────────────────
create or replace view public.job_feed as
select
  j.id, j.title, j.location, j.department, j.remote, j.url, j.description,
  j.posted_at, j.score, j.matched_keywords, j.dismissed, j.first_seen_at,
  c.id   as company_id,
  c.name as company_name,
  c.ats,
  c.market,
  a.id     as application_id,
  a.status as application_status,
  a.applied_at,
  a.notes,
  a.resume_variant,
  a.cover_letter,
  a.follow_up_at
from public.jobs j
join public.companies c on c.id = j.company_id
left join public.applications a on a.job_id = j.id;

alter view public.job_feed set (security_invoker = on);

-- ─────────────────────────────────────────────────────────────
-- RLS — same single-user posture as 0001
-- ─────────────────────────────────────────────────────────────
alter table public.profile enable row level security;

drop policy if exists profile_authed on public.profile;
create policy profile_authed on public.profile
  for all to authenticated using (true) with check (true);
