import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ArrowRight, ExternalLink, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PIPELINE, type ApplicationStatus, type FeedJob } from '@/lib/types'
import type { useFeed } from '@/hooks/useData'

type FeedApi = ReturnType<typeof useFeed>

const COLUMN_LABEL: Record<ApplicationStatus, string> = {
  interested: 'Interested',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export function Tracker({ feed }: { feed: FeedApi }) {
  const { jobs, setStatus, untrack } = feed

  const tracked = useMemo(() => jobs.filter((j) => j.application_status), [jobs])

  const columns = useMemo(
    () =>
      PIPELINE.map((status) => ({
        status,
        jobs: tracked.filter((j) => j.application_status === status),
      })),
    [tracked],
  )

  const closed = useMemo(
    () => tracked.filter((j) => j.application_status === 'rejected' || j.application_status === 'withdrawn'),
    [tracked],
  )

  const appliedCount = tracked.filter((j) =>
    (['applied', 'screening', 'interview', 'offer'] as ApplicationStatus[]).includes(
      j.application_status!,
    ),
  ).length
  const respondedCount = tracked.filter((j) =>
    (['screening', 'interview', 'offer'] as ApplicationStatus[]).includes(j.application_status!),
  ).length
  const responseRate = appliedCount ? Math.round((respondedCount / appliedCount) * 100) : 0

  if (tracked.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <p className="font-medium">No applications tracked yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Set a status on any posting in the Matches tab and it lands here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tracked" value={tracked.length} />
        <Stat label="Applied" value={appliedCount} />
        <Stat label="In conversation" value={respondedCount} />
        <Stat
          label="Response rate"
          value={`${responseRate}%`}
          hint={appliedCount ? undefined : 'no applications yet'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {columns.map(({ status, jobs: columnJobs }) => {
          const next = PIPELINE[PIPELINE.indexOf(status) + 1]
          return (
            <div key={status} className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{COLUMN_LABEL[status]}</h3>
                <Badge variant="secondary" className="tnum">
                  {columnJobs.length}
                </Badge>
              </div>

              {columnJobs.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  empty
                </div>
              ) : (
                columnJobs.map((job) => (
                  <TrackerCard
                    key={job.id}
                    job={job}
                    next={next}
                    onAdvance={setStatus}
                    onUntrack={untrack}
                  />
                ))
              )}
            </div>
          )
        })}
      </div>

      {closed.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Closed · {closed.length}
          </h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {closed.map((job) => (
              <Card key={job.id} className="flex items-center justify-between gap-2 p-3 opacity-60">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{job.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{job.company_name}</p>
                </div>
                <Badge variant="outline">{COLUMN_LABEL[job.application_status!]}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tnum mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}

function TrackerCard({
  job,
  next,
  onAdvance,
  onUntrack,
}: {
  job: FeedJob
  next: ApplicationStatus | undefined
  onAdvance: (job: FeedJob, status: ApplicationStatus) => void
  onUntrack: (job: FeedJob) => void
}) {
  return (
    <Card className="group space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium leading-snug hover:text-primary hover:underline"
        >
          {job.title}
        </a>
        <Button
          variant="ghost"
          size="icon-sm"
          className="opacity-0 transition-opacity group-hover:opacity-100"
          title="Stop tracking"
          onClick={() => onUntrack(job)}
        >
          <X />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{job.company_name}</p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {job.applied_at
            ? formatDistanceToNow(new Date(job.applied_at), { addSuffix: true })
            : `score ${job.score}`}
        </span>
        <div className="flex gap-1">
          {next && (
            <Button variant="ghost" size="icon-sm" title={`Move to ${next}`} onClick={() => onAdvance(job, next)}>
              <ArrowRight />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            title="Mark rejected"
            onClick={() => onAdvance(job, 'rejected')}
          >
            <X />
          </Button>
          <Button asChild variant="ghost" size="icon-sm" title="Open posting">
            <a href={job.url} target="_blank" rel="noreferrer">
              <ExternalLink />
            </a>
          </Button>
        </div>
      </div>
    </Card>
  )
}
