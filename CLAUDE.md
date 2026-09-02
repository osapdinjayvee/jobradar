# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev         # Vite dev server
npm run typecheck   # tsc --noEmit (covers src/ AND supabase/functions/_shared)
npm run verify      # fixture checks for the ATS adapters + scorer
npm run build       # typecheck, then emit dist/
```

`npm run verify` runs `scripts/verify.ts` through `node --experimental-strip-types`, so it needs Node ≥ 22.6. There is no test framework and no per-test filter — every check lives in that one script; add new cases by appending `check(...)` calls to the relevant section.

Supabase side (requires the `supabase` CLI and a linked project):

```bash
supabase db push                        # apply migrations 0001 and 0002
supabase functions deploy poll-boards   # SUPABASE_URL / SERVICE_ROLE_KEY are injected
```

`supabase/migrations/0003_cron.sql` is **not** part of `db push` in practice — it carries `<PROJECT_REF>` and `<SERVICE_ROLE_KEY>` placeholders that must be filled in and run manually in the SQL editor. Never commit a filled-in copy.

The frontend needs `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; [src/lib/supabase.ts](src/lib/supabase.ts) throws at module load if either is missing, so the app is blank-screen-on-boot without them.

This directory is not a git repository.

## Architecture

Data flows in one direction: **pg_cron → `poll-boards` edge function → `jobs` table → `job_feed` view → React hooks**. The dashboard never talks to an ATS directly.

### The dual-runtime module

[supabase/functions/_shared/ats.ts](supabase/functions/_shared/ats.ts) holds the board URLs, the three provider normalisers, the HTML-to-text flattener, and `scoreJob`. It is imported by **both** the Deno edge function and the browser (via a re-export in [src/lib/ats.ts](src/lib/ats.ts), using a relative path because the file sits outside `src/` and the `@/` alias does not reach it). The edge function and the dashboard's "Validate" button must agree on what a working board looks like, so there is deliberately one copy.

Consequences when editing that file:

- No npm imports, no `Deno.*`, nothing from `src/`. It must stay platform-neutral.
- It is inside `tsconfig.json`'s `include`, so `npm run typecheck` covers it — but the edge function itself (`poll-boards/index.ts`, which imports from `esm.sh` and uses `Deno.serve`) is **not** type-checked by that command. Verify edge-function changes by deploying.
- Relative imports carry the `.ts` extension (`allowImportingTsExtensions`), as Deno requires.

### poll-boards has two modes

The same function serves both, switched on the POST body:

- `{}` (or no body) — poll: fetch each active company's board, normalise, score, upsert into `jobs` with `onConflict: 'company_id,external_id'`. Re-seeing a posting refreshes `score` and `last_seen_at` but leaves `first_seen_at` alone, which is what keeps the "new this week" count honest. Per-company outcome is written back to `companies.last_status` / `last_polled_at` / `last_count`.
- `{"mode":"validate"}` — ping every board and report reachability without writing any jobs. It runs server-side specifically so the browser never has to care whether a given ATS sends permissive CORS headers.

Both fan out through a hand-rolled `pooled()` at concurrency 5 with a 20s per-fetch timeout. A stale board token surfaces as `normalize()` throwing — the normalisers assert payload shape on purpose rather than returning `[]`.

### Scoring

Weights live in the `keywords` table, not in code, so tuning the profile is a SQL edit. Rules encoded in `scoreJob`: title hits count double, `remote` adds a flat +8, exclusions are just negative weights (screening-out is the same mechanism as matching, not a separate filter), result clamped to ±100, matching is word-boundary-aware so `php` does not fire on "GraphPad".

Scores are computed **at poll time and stored on the row**. Editing `keywords` does not retroactively rescore anything — the next poll does.

### Database shape

- `job_feed` is a read-only view joining `jobs` + `companies` + `applications`; every read in [src/hooks/useData.ts](src/hooks/useData.ts) goes through it, every write targets the underlying tables. It is set `security_invoker = on` so RLS actually applies.
- `applications.job_id` is unique — one application per job — so status/notes writes are `upsert(..., { onConflict: 'job_id' })`.
- RLS grants full access to any `authenticated` user. This is a single-user instance by design; there is no per-user ownership column anywhere.

### Frontend

`useFeed` / `useCompanies` are the only data layer — plain `useState` + refetch, no query library. Mutations patch local state optimistically and refetch; a failed write refetches to restore truth.

Edge functions are called from `callFunction()` in `useData.ts`, which attaches the signed-in user's JWT.

Tailwind v4 through the `@tailwindcss/vite` plugin — there is no `tailwind.config`. All theme tokens are oklch CSS variables in [src/index.css](src/index.css), with dark mode via `@custom-variant dark (&:is(.dark *))`. `src/components/ui/` holds vendored shadcn primitives that have been edited locally (e.g. `button` gained an `icon-sm` size), so re-adding a component with the shadcn CLI would overwrite those changes.

## Scope boundary

The project automates *finding* postings only. Application submission is left to the user on purpose, and every endpoint touched is a public unauthenticated JSON API the company publishes deliberately. Don't add scraping, headless-browser automation, authenticated aggregator access (LinkedIn/Indeed), or auto-submission — the README explains why at length, and it is a product decision rather than a missing feature.
