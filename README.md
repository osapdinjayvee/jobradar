# JobRadar

A personal job-discovery pipeline over the **public, unauthenticated** job-board
APIs that Greenhouse, Lever and Ashby expose. It polls the companies you care
about, scores every posting against your profile, and tracks what you applied to.

React + Vite + TypeScript + Tailwind v4 + shadcn/ui on the front, Supabase
(Postgres + Edge Functions + pg_cron) on the back.

## Why this shape

Auto-apply services promise to submit for you. The measurable result is worse:
fully automated submission lands roughly **1–6%** callback rates versus **5–15%**
when a human reviews before sending, because tailoring to the posting is the
single biggest variable. They also put your accounts at risk — LinkedIn's user
agreement prohibits bots and enforces it, Indeed CAPTCHA-walls them, and
Greenhouse runs fraud detection that flags datacenter IPs.

So JobRadar automates the half that is pure toil and safe to automate —
**finding the postings** — and deliberately leaves the application itself to you.
Every endpoint it touches is a public JSON API the company publishes on purpose.
Nothing is scraped, no terms are violated, no account can be banned.

The side benefit: you see roles the hour they are posted, before the aggregators
index them.

## What it does

- **Polls** every active company board twice a day (07:00 / 19:00 Manila).
- **Normalises** three different provider payloads into one job shape.
- **Scores** each posting 0–100 against an editable keyword profile. Title hits
  count double; exclusion keywords carry negative weight, so an "Engineering
  Manager, requires security clearance" role scores itself out rather than
  needing a separate filter.
- **Tracks** applications through a pipeline board and computes your real
  response rate.
- **Validates** board tokens on demand, because companies migrate ATS and turn
  their own tokens into 404s.

## Setup

### 1. Create the Supabase project

```bash
npm install -g supabase
supabase link --project-ref <your-project-ref>
supabase db push          # runs migrations 0001 and 0002
```

Or paste `supabase/migrations/0001_init.sql` and `0002_seed.sql` into the SQL
editor in the dashboard, in that order.

### 2. Enable email auth

Dashboard → Authentication → Providers → Email. Magic links only; no password
needed. Then Authentication → Users → **Add user** with your own email, since
this is a single-user instance and RLS grants access to any authenticated user.

### 3. Deploy the poller

```bash
supabase functions deploy poll-boards
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 4. Schedule it

Fill in the two placeholders in `supabase/migrations/0003_cron.sql`
(`<PROJECT_REF>` and `<SERVICE_ROLE_KEY>`), then run it in the SQL editor.
**Do not commit that file once filled in.** If you would rather not put a
service-role key in a cron statement, skip this and hit “Poll now” manually, or
drive the function from GitHub Actions on a schedule.

### 5. Run the dashboard

```bash
cp .env.example .env.local     # fill in URL + anon key from Settings → API
npm install
npm run dev
```

Deploy it anywhere static — `npm run build` emits `dist/`. Vercel, Netlify and
Cloudflare Pages all work with zero config.

## First run

1. Sign in with the magic link.
2. **Companies → Validate all tokens.** The seed list is a starting point, not
   gospel — companies change ATS. Deactivate whatever comes back unreachable.
3. **Companies → Poll now.** First poll pulls everything currently open; it
   takes a minute or two.
4. **Matches.** Sorted best-first. Set a score floor of 40 to start and lower it
   if the feed is too thin.

## Tuning the match score

Everything lives in the `keywords` table — edit it in the Supabase table editor
and the next poll rescores. Positive weights are things you want; negative
weights screen out. Current profile is built from your resume: Laravel 10, PHP 9,
Filament 8, Vue 7, down through the infra and mobile stack, with exclusions for
management tracks, clearance-gated roles, and non-engineering functions.

Two knobs worth knowing:

- **Title hits count double.** A "Laravel Engineer" and a role that mentions
  Laravel once in a nice-to-have list should not score the same.
- **`remote` adds a flat +8**, because from Manila a role that isn't remote or
  relocation-backed is usually not a real option.

## Adding companies

The token is the last path segment of a company's public board:

| ATS | Board URL | Token |
| --- | --- | --- |
| Greenhouse | `boards.greenhouse.io/gitlab` | `gitlab` |
| Lever | `jobs.lever.co/palantir` | `palantir` |
| Ashby | `jobs.ashbyhq.com/openai` | `openai` |

Add it in the UI, or insert into `companies`. The highest-value thing you can do
with this tool is spend an hour adding the 100–200 companies you would actually
work for — the seed list is deliberately generic, and your own list will
out-perform it immediately.

## A note on the Philippines market

Coverage here is thin by nature, not by omission. Most PH employers post to
Kalibrr, JobStreet and LinkedIn rather than to Greenhouse/Lever/Ashby, and none
of those three offer a public JSON API of this kind. The PH seed entries are the
tech companies that do use these ATSes. For local roles, treat this tool as a
supplement rather than a replacement.

## Verifying changes

```bash
npm run verify      # fixture checks for the adapters and the scorer
npm run typecheck
npm run build
```

`scripts/verify.ts` covers all three provider payload shapes, malformed-payload
handling, entity-encoded HTML (Greenhouse double-encodes its `content` field),
scoring order, exclusion behaviour, and word-boundary matching — so `php` does
not fire on "GraphPad" and `react` does not fire on "Reactor".

## Layout

```
src/
  components/       Feed, Tracker, Companies, JobCard, ScoreDial, AuthGate
  components/ui/    shadcn primitives
  hooks/useData.ts  Supabase reads/writes, optimistic updates
  lib/ats.ts        re-export of the shared adapter (single source of truth)
supabase/
  functions/_shared/ats.ts    adapters + scorer, shared by browser and Deno
  functions/poll-boards/      the scheduled poller (also does token validation)
  migrations/                 schema, seed, cron
scripts/verify.ts   fixture checks
```

`_shared/ats.ts` is imported by both runtimes on purpose: the edge function and
the dashboard's validator must agree on what a working board looks like, and two
copies would drift.
