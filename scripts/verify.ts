/**
 * Fixture check for the ATS adapters and the scorer.
 *
 * The fixtures mirror the real response shapes of the three public board APIs.
 * Run with:  npm run verify
 */
import { htmlToText, normalize, scoreJob, type Keyword } from '../supabase/functions/_shared/ats.ts'

let failures = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`)
  } else {
    failures++
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── Greenhouse ────────────────────────────────────────────────
console.log('\ngreenhouse')
const greenhouse = normalize('greenhouse', {
  jobs: [
    {
      id: 4567890,
      title: 'Senior Backend Engineer, PHP',
      location: { name: 'Remote, Asia Pacific' },
      absolute_url: 'https://boards.greenhouse.io/acme/jobs/4567890',
      updated_at: '2026-08-30T10:00:00-04:00',
      first_published: '2026-08-25T10:00:00-04:00',
      departments: [{ id: 1, name: 'Engineering' }],
      content: '&lt;p&gt;We run &lt;strong&gt;Laravel&lt;/strong&gt; and PostgreSQL.&lt;/p&gt;',
    },
  ],
})
check('parses one job', greenhouse.length === 1)
check('external id is a string', greenhouse[0].externalId === '4567890')
check('detects remote from location', greenhouse[0].remote === true)
check('reads department', greenhouse[0].department === 'Engineering')
check('prefers first_published', greenhouse[0].postedAt?.startsWith('2026-08-25') === true)
check(
  'decodes double-escaped html to text',
  greenhouse[0].description.includes('Laravel') && !greenhouse[0].description.includes('<strong>'),
  greenhouse[0].description,
)

// ── Lever ─────────────────────────────────────────────────────
console.log('\nlever')
const lever = normalize('lever', [
  {
    id: 'a1b2c3',
    text: 'Full-Stack Developer',
    categories: { location: 'Sydney', department: 'Product', commitment: 'Full-time' },
    workplaceType: 'remote',
    hostedUrl: 'https://jobs.lever.co/acme/a1b2c3',
    applyUrl: 'https://jobs.lever.co/acme/a1b2c3/apply',
    createdAt: 1756000000000,
    descriptionPlain: 'Vue.js on the front, Laravel on the back.',
  },
])
check('parses one posting', lever.length === 1)
check('reads title from text', lever[0].title === 'Full-Stack Developer')
check('remote from workplaceType', lever[0].remote === true)
check('epoch ms → iso', lever[0].postedAt === new Date(1756000000000).toISOString())
check('prefers hostedUrl', lever[0].url.endsWith('/a1b2c3'))

// ── Ashby ─────────────────────────────────────────────────────
console.log('\nashby')
const ashby = normalize('ashby', {
  jobs: [
    {
      id: 'uuid-1',
      title: 'Software Engineer',
      department: 'Engineering',
      location: 'Manila, Philippines',
      isRemote: false,
      isListed: true,
      jobUrl: 'https://jobs.ashbyhq.com/acme/uuid-1',
      publishedAt: '2026-08-28T00:00:00.000Z',
      descriptionPlain: 'PHP, MySQL, Redis.',
    },
    { id: 'uuid-2', title: 'Hidden role', isListed: false, jobUrl: 'x' },
  ],
})
check('filters unlisted jobs', ashby.length === 1)
check('keeps non-remote as false', ashby[0].remote === false)
check('reads publishedAt', ashby[0].postedAt?.startsWith('2026-08-28') === true)

// ── Bad payloads must throw, not silently yield zero jobs ──────
console.log('\nerror handling')
for (const [provider, payload] of [
  ['greenhouse', { error: 'not found' }],
  ['lever', { error: 'not found' }],
  ['ashby', 'nope'],
] as const) {
  let threw = false
  try {
    normalize(provider, payload)
  } catch {
    threw = true
  }
  check(`${provider} throws on a non-board payload`, threw)
}

// ── Scoring ───────────────────────────────────────────────────
console.log('\nscoring')
const keywords: Keyword[] = [
  { term: 'laravel', weight: 10 },
  { term: 'php', weight: 9 },
  { term: 'vue.js', weight: 7 },
  { term: 'react', weight: 3 },
  { term: 'engineering manager', weight: -12 },
  { term: 'security clearance', weight: -25 },
]

const strong = scoreJob(
  {
    title: 'Senior Laravel Engineer',
    description: 'PHP, Vue.js, and a lot of API work.',
    location: 'Remote',
    department: 'Engineering',
    remote: true,
  },
  keywords,
)
const weak = scoreJob(
  {
    title: 'React Developer',
    description: 'Frontend only.',
    location: 'Austin, TX',
    department: null,
    remote: false,
  },
  keywords,
)
const excluded = scoreJob(
  {
    title: 'Engineering Manager',
    description: 'Requires an active security clearance. Some PHP background helpful.',
    location: 'Virginia',
    department: null,
    remote: false,
  },
  keywords,
)

check('strong match outranks weak match', strong.score > weak.score, `${strong.score} vs ${weak.score}`)
check('title hits count double', strong.score >= 40, `got ${strong.score}`)
check('exclusions push the score negative', excluded.score < 0, `got ${excluded.score}`)
check('matched keywords exclude negatives', !excluded.matched.includes('security clearance'))
check('matched keywords are deduped', new Set(strong.matched).size === strong.matched.length)
check('score is clamped to 100', scoreJob(
  { title: 'Laravel PHP Vue.js Laravel', description: 'laravel php vue.js '.repeat(50), location: 'Remote', department: null, remote: true },
  keywords,
).score <= 100)

// Word-boundary correctness: "php" must not match inside "phpstorm-adjacent"
// prose like "graphpad", and "react" must not fire on "reactor".
const boundary = scoreJob(
  { title: 'Reactor Systems Analyst', description: 'We use GraphPad daily.', location: '', department: null, remote: false },
  keywords,
)
check('does not match substrings inside other words', boundary.score === 0, `got ${boundary.score}`)

// ── htmlToText ────────────────────────────────────────────────
console.log('\nhtmlToText')
check('strips script tags', !htmlToText('<script>bad()</script><p>ok</p>').includes('bad'))
check('numeric entities decode', htmlToText('&#8217;') === '’')
check('block tags become newlines', htmlToText('<p>a</p><p>b</p>').includes('\n'))

console.log(
  failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`,
)
process.exit(failures === 0 ? 0 : 1)
