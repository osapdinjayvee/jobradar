-- JobRadar — schema
-- Personal job-discovery pipeline over public ATS job boards.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- companies: the boards we poll
-- ─────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  ats            text not null check (ats in ('greenhouse', 'lever', 'ashby')),
  board_token    text not null,
  market         text not null default 'remote-global'
                 check (market in ('remote-global', 'au-nz', 'ph', 'us-eu')),
  careers_url    text,
  active         boolean not null default true,
  last_polled_at timestamptz,
  last_status    text,
  last_count     integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (ats, board_token)
);

-- ─────────────────────────────────────────────────────────────
-- jobs: normalised postings from every provider
-- ─────────────────────────────────────────────────────────────
create table if not exists public.jobs (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  external_id       text not null,
  title             text not null,
  location          text,
  department        text,
  remote            boolean not null default false,
  url               text not null,
  description       text,
  posted_at         timestamptz,
  score             integer not null default 0,
  matched_keywords  text[] not null default '{}',
  dismissed         boolean not null default false,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  unique (company_id, external_id)
);

create index if not exists jobs_score_idx      on public.jobs (score desc);
create index if not exists jobs_first_seen_idx on public.jobs (first_seen_at desc);
create index if not exists jobs_company_idx    on public.jobs (company_id);

-- ─────────────────────────────────────────────────────────────
-- applications: the tracker
-- ─────────────────────────────────────────────────────────────
create table if not exists public.applications (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null unique references public.jobs (id) on delete cascade,
  status         text not null default 'interested'
                 check (status in ('interested', 'applied', 'screening',
                                   'interview', 'offer', 'rejected', 'withdrawn')),
  applied_at     timestamptz,
  resume_variant text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists applications_status_idx on public.applications (status);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists applications_touch on public.applications;
create trigger applications_touch
  before update on public.applications
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- keywords: what "a good match" means, editable from the UI
-- ─────────────────────────────────────────────────────────────
create table if not exists public.keywords (
  id       uuid primary key default gen_random_uuid(),
  term     text not null unique,
  weight   integer not null default 1,
  category text not null default 'skill'
);

-- ─────────────────────────────────────────────────────────────
-- feed view
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
  a.applied_at
from public.jobs j
join public.companies c on c.id = j.company_id
left join public.applications a on a.job_id = j.id;

-- ─────────────────────────────────────────────────────────────
-- RLS — single-user instance: any signed-in user has full access
-- ─────────────────────────────────────────────────────────────
alter table public.companies    enable row level security;
alter table public.jobs         enable row level security;
alter table public.applications enable row level security;
alter table public.keywords     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['companies', 'jobs', 'applications', 'keywords'] loop
    execute format('drop policy if exists %I on public.%I', t || '_authed', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authed', t
    );
  end loop;
end $$;

-- The view runs with the querying user's privileges (PG15+ default is
-- security_definer, which would bypass the policies above).
alter view public.job_feed set (security_invoker = on);
