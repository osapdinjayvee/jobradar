import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { JobCard } from '@/components/JobCard'
import { MARKETS, type FeedJob, type Market } from '@/lib/types'
import type { useFeed } from '@/hooks/useData'

type FeedApi = ReturnType<typeof useFeed>

const SCORE_STEPS = [
  { value: '0', label: 'Any score' },
  { value: '20', label: '20+' },
  { value: '40', label: '40+ · worth a look' },
  { value: '60', label: '60+ · strong match' },
]

export function Feed({ feed }: { feed: FeedApi }) {
  const { jobs, loading, setStatus, untrack, dismiss, setNotes } = feed

  const [query, setQuery] = useState('')
  const [market, setMarket] = useState<Market | 'all'>('all')
  const [minScore, setMinScore] = useState('20')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [showDismissed, setShowDismissed] = useState(false)
  const [showTracked, setShowTracked] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const floor = Number(minScore)

    return jobs.filter((job: FeedJob) => {
      if (!showDismissed && job.dismissed) return false
      if (!showTracked && job.application_status) return false
      if (job.score < floor) return false
      if (market !== 'all' && job.market !== market) return false
      if (remoteOnly && !job.remote) return false
      if (q) {
        const haystack = `${job.title} ${job.company_name} ${job.location ?? ''} ${job.department ?? ''}`
        if (!haystack.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [jobs, query, market, minScore, remoteOnly, showDismissed, showTracked])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title, company, location…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={market} onValueChange={(v) => setMarket(v as Market | 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All markets</SelectItem>
              {MARKETS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={minScore} onValueChange={setMinScore}>
            <SelectTrigger className="w-[172px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCORE_STEPS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={remoteOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRemoteOnly((v) => !v)}
          >
            Remote only
          </Button>
          <Button
            variant={showTracked ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowTracked((v) => !v)}
          >
            <SlidersHorizontal />
            Include tracked
          </Button>
          <Button
            variant={showDismissed ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowDismissed((v) => !v)}
          >
            Include dismissed
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary" className="tnum">
          {visible.length}
        </Badge>
        <span>
          {visible.length === 1 ? 'posting' : 'postings'} matching your filters, best match first
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="font-medium">Nothing matches yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Loosen the score floor, or run a poll from the Companies tab to pull fresh postings.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onStatus={setStatus}
              onUntrack={untrack}
              onDismiss={dismiss}
              onNotes={setNotes}
            />
          ))}
        </div>
      )}
    </div>
  )
}
