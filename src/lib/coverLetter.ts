/**
 * Cover letter drafting.
 *
 * Deterministic and dependency-free on purpose: no API key to configure, no
 * per-draft cost, no network call in the middle of the apply flow, and the
 * output is stable enough to fixture-test. It assembles the letter from the
 * facts JobRadar already knows — the scorer's matched keywords are exactly the
 * overlap between the posting and your profile, which is the paragraph that
 * would otherwise take the longest to write.
 *
 * This is a starting draft, not a finished letter. The apply dialog opens it in
 * an editor for that reason; tailoring is the single biggest variable in whether
 * an application lands, so the human edit is the point rather than an oversight.
 */

export interface CoverLetterProfile {
  fullName: string
  /** Signature line — "Full-stack developer · Laravel, Vue, AWS". */
  headline: string
  /** One or two paragraphs in your own voice. Carries the letter. */
  summary: string
  location: string
  portfolioUrl?: string | null
}

export interface CoverLetterJob {
  title: string
  companyName: string
  matchedKeywords: string[]
  remote: boolean
  location: string | null
}

/** Keep the overlap sentence readable — past six it reads like a tag dump. */
const MAX_KEYWORDS = 6

/** "a, b and c" — no Oxford comma, matching the prose style of the rest. */
export function humanList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * Build the draft. Every clause is skipped when the field behind it is empty,
 * so a half-filled profile yields a shorter letter rather than one with holes
 * or "[your name here]" placeholders in it.
 */
export function buildCoverLetter(job: CoverLetterJob, profile: CoverLetterProfile): string {
  const company = job.companyName.trim() || 'there'
  const paragraphs: string[] = []

  paragraphs.push(`Hi ${company} team,`)

  const opener = `I'd like to apply for the ${job.title.trim()} role at ${company}.`
  const summary = profile.summary.trim()
  paragraphs.push(summary ? `${opener} ${summary}` : opener)

  const keywords = job.matchedKeywords
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS)

  if (keywords.length) {
    paragraphs.push(
      `The posting lines up closely with what I work in day to day — ` +
        `${humanList(keywords)}. Happy to go into specifics on any of those.`,
    )
  }

  // Only worth a sentence when it is genuinely a question the reader would
  // have: a remote role read from a different country.
  const where = profile.location.trim()
  if (job.remote && where) {
    paragraphs.push(
      `I'm based in ${where} and set up for remote work, so the timezone and ` +
        `logistics side is already solved on my end.`,
    )
  }

  paragraphs.push('Thanks for your time — happy to walk through any of this in more detail.')

  const signature = [profile.fullName.trim(), profile.headline.trim(), profile.portfolioUrl?.trim()]
    .filter(Boolean)
    .join('\n')

  paragraphs.push(signature ? `Best,\n${signature}` : 'Best,')

  return paragraphs.join('\n\n')
}

/**
 * Whether a draft is still byte-identical to what `buildCoverLetter` produces.
 *
 * The apply dialog uses this to decide if regenerating would throw away real
 * edits, and to warn before sending something untouched.
 */
export function isUneditedDraft(
  draft: string,
  job: CoverLetterJob,
  profile: CoverLetterProfile,
): boolean {
  return draft.trim() === buildCoverLetter(job, profile).trim()
}
