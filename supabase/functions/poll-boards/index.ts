/**
 * poll-boards — fetches every active company board, normalises the postings,
 * scores them against the keyword profile, and upserts them into `jobs`.
 *
 * Invoked on a schedule by pg_cron (see 0003_cron.sql) or manually from the
 * dashboard's "Poll now" button.
 *
 * Deploy:  supabase functions deploy poll-boards
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { boardUrl, normalize, scoreJob, type Ats, type Keyword } from '../_shared/ats.ts'

/**
 * Two at a time, not five.
 *
 * A Greenhouse board with `content=true` is measured in megabytes (gitlab
 * 3.5 MB, stripe 4.6 MB). Each in-flight board costs the raw JSON string, its
 * parsed object graph, and the normalised output at once, so concurrency is a
 * direct multiplier on peak memory — five boards is what produced
 * WORKER_RESOURCE_LIMIT.
 */
const CONCURRENCY = 2

const FETCH_TIMEOUT_MS = 20_000

/**
 * Cap on the description text kept per posting while scoring.
 *
 * `scoreJob` only reads the first 20k characters anyway, and the stored copy is
 * trimmed to 8k. Truncating during normalisation keeps the long tail from ever
 * being retained.
 */
const DESCRIPTION_LIMIT = 12_000

/** Rows per upsert request. A single 500-row batch is a multi-MB body. */
const UPSERT_CHUNK = 200

interface CompanyRow {
  id: string
  name: string
  ats: Ats
  board_token: string
}

interface PollResult {
  company: string
  ok: boolean
  found: number
  error?: string
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function fetchBoard(ats: Ats, token: string, content = true): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(boardUrl(ats, token, { content }), {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'JobRadar/1.0' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Run `worker` over `items`, at most `limit` in flight. */
async function pooled<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await worker(items[i])
    }
  })
  await Promise.all(runners)
  return results
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const [{ data: companies, error: cErr }, { data: keywordRows, error: kErr }] = await Promise.all([
    supabase.from('companies').select('id, name, ats, board_token').eq('active', true),
    supabase.from('keywords').select('term, weight'),
  ])

  if (cErr || kErr) {
    return new Response(JSON.stringify({ error: (cErr ?? kErr)!.message }), {
      status: 500,
      headers: { ...cors, 'content-type': 'application/json' },
    })
  }

  const keywords = (keywordRows ?? []) as Keyword[]
  const rows = (companies ?? []) as CompanyRow[]
  const startedAt = new Date().toISOString()

  // `{"mode":"validate"}` checks every board token without writing any jobs.
  // Runs server-side so the dashboard never has to care whether a given ATS
  // sends permissive CORS headers.
  let mode = 'poll'
  try {
    if (req.method === 'POST') {
      const body = await req.json()
      if (body && typeof body.mode === 'string') mode = body.mode
    }
  } catch {
    // empty or non-JSON body — treat as a normal poll
  }

  if (mode === 'validate') {
    const checks = await pooled(rows, CONCURRENCY, async (company) => {
      try {
        // `content: false` — validation only needs to know the board resolves
        // and parses. Skipping descriptions turns a 4 MB fetch into a ~40 KB one.
        const payload = await fetchBoard(company.ats, company.board_token, false)
        const jobs = normalize(company.ats, payload, { descriptionLimit: 0 })
        return { id: company.id, company: company.name, ok: true, found: jobs.length }
      } catch (err) {
        return {
          id: company.id,
          company: company.name,
          ok: false,
          found: 0,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    })
    return new Response(JSON.stringify({ mode: 'validate', checks }, null, 2), {
      headers: { ...cors, 'content-type': 'application/json' },
    })
  }

  const results = await pooled<CompanyRow, PollResult>(rows, CONCURRENCY, async (company) => {
    try {
      const payload = await fetchBoard(company.ats, company.board_token)
      const jobs = normalize(company.ats, payload, {
        descriptionLimit: DESCRIPTION_LIMIT,
      }).filter((j) => j.title && j.url)

      if (jobs.length) {
        const scored = jobs.map((job) => {
          const { score, matched } = scoreJob(job, keywords)
          return {
            company_id: company.id,
            external_id: job.externalId,
            title: job.title,
            location: job.location,
            department: job.department,
            remote: job.remote,
            url: job.url,
            // Keep enough text to be useful in the UI without bloating the row.
            description: job.description.slice(0, 8_000),
            posted_at: job.postedAt,
            score,
            matched_keywords: matched,
            last_seen_at: startedAt,
          }
        })

        // onConflict on (company_id, external_id): re-seeing a posting refreshes
        // its score and last_seen_at but never resets first_seen_at, so the
        // "new since yesterday" feed stays honest.
        //
        // Chunked so a board with hundreds of openings does not build one
        // multi-megabyte request body.
        for (let i = 0; i < scored.length; i += UPSERT_CHUNK) {
          const { error } = await supabase
            .from('jobs')
            .upsert(scored.slice(i, i + UPSERT_CHUNK), {
              onConflict: 'company_id,external_id',
              ignoreDuplicates: false,
            })
          if (error) throw new Error(error.message)
        }
      }

      await supabase
        .from('companies')
        .update({ last_polled_at: startedAt, last_status: 'ok', last_count: jobs.length })
        .eq('id', company.id)

      return { company: company.name, ok: true, found: jobs.length }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await supabase
        .from('companies')
        .update({ last_polled_at: startedAt, last_status: `error: ${message}`.slice(0, 200) })
        .eq('id', company.id)
      return { company: company.name, ok: false, found: 0, error: message }
    }
  })

  const summary = {
    polled: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    jobs: results.reduce((n, r) => n + r.found, 0),
    failures: results.filter((r) => !r.ok).map((r) => ({ company: r.company, error: r.error })),
  }

  return new Response(JSON.stringify(summary, null, 2), {
    headers: { ...cors, 'content-type': 'application/json' },
  })
})
