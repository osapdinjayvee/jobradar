/**
 * Shared ATS adapters + match scoring.
 *
 * This file is the single source of truth for both runtimes:
 *   - the Deno edge function (`supabase/functions/poll-boards`)
 *   - the browser (re-exported from `src/lib/ats.ts` for live token validation)
 *
 * Keep it dependency-free and platform-neutral: no npm imports, no Deno
 * globals, nothing from `src/`.
 */

export type Ats = 'greenhouse' | 'lever' | 'ashby'

export const ATS_PROVIDERS: Ats[] = ['greenhouse', 'lever', 'ashby']

export interface NormalizedJob {
  externalId: string
  title: string
  location: string | null
  department: string | null
  remote: boolean
  url: string
  description: string
  postedAt: string | null
}

export interface Keyword {
  term: string
  weight: number
}

/** Public, unauthenticated board endpoint for a given provider + token. */
export function boardUrl(ats: Ats, token: string): string {
  const t = encodeURIComponent(token.trim())
  switch (ats) {
    case 'greenhouse':
      return `https://boards-api.greenhouse.io/v1/boards/${t}/jobs?content=true`
    case 'lever':
      return `https://api.lever.co/v0/postings/${t}?mode=json`
    case 'ashby':
      return `https://api.ashbyhq.com/posting-api/job-board/${t}?includeCompensation=false`
  }
}

/** Where a human would go to read the same board. */
export function humanBoardUrl(ats: Ats, token: string): string {
  switch (ats) {
    case 'greenhouse':
      return `https://boards.greenhouse.io/${token}`
    case 'lever':
      return `https://jobs.lever.co/${token}`
    case 'ashby':
      return `https://jobs.ashbyhq.com/${token}`
  }
}

// ─────────────────────────────────────────────────────────────
// HTML → text
// ─────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '"', rdquo: '"', lsquo: '‘', rsquo: '’',
  mdash: '—', ndash: '–', hellip: '…', bull: '•',
}

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[body.toLowerCase()] ?? whole
  })
}

function stripTags(markup: string): string {
  return markup
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
}

/**
 * Flatten a job description to plain text.
 *
 * Order matters: Greenhouse returns its `content` as entity-ENCODED html
 * (`&lt;p&gt;…`), while Ashby returns real markup. Decoding before stripping
 * handles both — otherwise the Greenhouse case strips nothing (there are no
 * literal tags to find yet) and leaves bare `<p>` in the text once decoded.
 */
export function htmlToText(html: string): string {
  return decodeEntities(stripTags(decodeEntities(html)))
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─────────────────────────────────────────────────────────────
// Normalisers
// ─────────────────────────────────────────────────────────────

const REMOTE_RE = /\b(remote|anywhere|distributed|work from home)\b/i

function toIso(value: unknown): string | null {
  if (value == null) return null
  const d = typeof value === 'number' ? new Date(value) : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Turn a raw board payload into normalised jobs.
 * Throws if the payload is not the shape this provider is supposed to return —
 * that is how a stale board token surfaces.
 */
export function normalize(ats: Ats, payload: unknown): NormalizedJob[] {
  switch (ats) {
    case 'greenhouse': {
      const jobs = (payload as { jobs?: unknown[] })?.jobs
      if (!Array.isArray(jobs)) throw new Error('greenhouse: no "jobs" array in payload')
      return jobs.map((raw) => {
        const j = raw as Record<string, any>
        const location: string | null = j.location?.name ?? null
        const content: string = typeof j.content === 'string' ? htmlToText(j.content) : ''
        const departments: any[] = Array.isArray(j.departments) ? j.departments : []
        return {
          externalId: String(j.id),
          title: String(j.title ?? '').trim(),
          location,
          department: departments[0]?.name ?? null,
          remote: REMOTE_RE.test(location ?? '') || REMOTE_RE.test(String(j.title ?? '')),
          url: String(j.absolute_url ?? ''),
          description: content,
          postedAt: toIso(j.first_published ?? j.updated_at),
        }
      })
    }

    case 'lever': {
      if (!Array.isArray(payload)) throw new Error('lever: payload is not an array')
      return payload.map((raw) => {
        const j = raw as Record<string, any>
        const cats = (j.categories ?? {}) as Record<string, any>
        const location: string | null = cats.location ?? null
        const workplace = String(j.workplaceType ?? '')
        return {
          externalId: String(j.id),
          title: String(j.text ?? '').trim(),
          location,
          department: cats.department ?? cats.team ?? null,
          remote: workplace.toLowerCase() === 'remote' || REMOTE_RE.test(location ?? ''),
          url: String(j.hostedUrl ?? j.applyUrl ?? ''),
          description: String(j.descriptionPlain ?? j.description ?? ''),
          postedAt: toIso(j.createdAt),
        }
      })
    }

    case 'ashby': {
      const jobs = (payload as { jobs?: unknown[] })?.jobs
      if (!Array.isArray(jobs)) throw new Error('ashby: no "jobs" array in payload')
      return jobs
        .filter((raw) => (raw as Record<string, any>).isListed !== false)
        .map((raw) => {
          const j = raw as Record<string, any>
          const location: string | null = j.location ?? null
          return {
            externalId: String(j.id),
            title: String(j.title ?? '').trim(),
            location,
            department: j.department ?? j.team ?? null,
            remote: j.isRemote === true || REMOTE_RE.test(location ?? ''),
            url: String(j.jobUrl ?? j.applyUrl ?? ''),
            description: String(
              j.descriptionPlain ?? (j.descriptionHtml ? htmlToText(j.descriptionHtml) : ''),
            ),
            postedAt: toIso(j.publishedAt),
          }
        })
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────

/** Word-boundary match that tolerates the dots and hyphens in "vue.js", "offline-first". */
function mentions(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9+#])${escaped}([^a-z0-9+#]|$)`, 'i').test(haystack)
}

export interface ScoreResult {
  score: number
  matched: string[]
}

/**
 * Score a posting against the keyword profile.
 *
 * Title hits count double — a Laravel role called "Laravel Engineer" is a very
 * different thing from one that mentions Laravel once in a nice-to-have list.
 * Exclusions carry negative weight so screening-out is the same mechanism as
 * matching, not a separate filter. Result is clamped to [-100, 100].
 */
export function scoreJob(
  job: Pick<NormalizedJob, 'title' | 'description' | 'location' | 'department' | 'remote'>,
  keywords: Keyword[],
): ScoreResult {
  const title = job.title.toLowerCase()
  const body = [job.description, job.location ?? '', job.department ?? '']
    .join('\n')
    .toLowerCase()
    .slice(0, 20_000)

  let raw = 0
  const matched: string[] = []

  for (const { term, weight } of keywords) {
    const t = term.toLowerCase()
    const inTitle = mentions(title, t)
    const inBody = mentions(body, t)
    if (!inTitle && !inBody) continue

    raw += inTitle ? weight * 2 : weight
    if (weight > 0) matched.push(term)
  }

  if (job.remote) raw += 8

  return {
    score: Math.max(-100, Math.min(100, Math.round(raw))),
    matched: [...new Set(matched)].slice(0, 12),
  }
}
