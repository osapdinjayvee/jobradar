import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, EyeOff, FileText, MapPin, RotateCcw, StickyNote } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScoreDial } from '@/components/ScoreDial'
import { STATUSES, type ApplicationStatus, type FeedJob } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  job: FeedJob
  onStatus: (job: FeedJob, status: ApplicationStatus) => void
  onUntrack: (job: FeedJob) => void
  onDismiss: (job: FeedJob, dismissed: boolean) => void
  onApply: (job: FeedJob) => void
}

function age(iso: string | null): string | null {
  if (!iso) return null
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return null
  }
}

export function JobCard({ job, onStatus, onUntrack, onDismiss, onApply }: Props) {
  const posted = age(job.posted_at)
  const isNew = Date.now() - new Date(job.first_seen_at).getTime() < 3 * 24 * 60 * 60 * 1000
  const hasDraft = Boolean(job.cover_letter)

  return (
    <Card
      className={cn(
        'group flex gap-4 p-4 transition-colors hover:border-primary/40',
        job.dismissed && 'opacity-45',
      )}
    >
      <ScoreDial score={job.score} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium leading-snug hover:text-primary hover:underline"
          >
            {job.title}
          </a>
          {isNew && !job.application_status && (
            <Badge className="bg-primary/20 text-primary">new</Badge>
          )}
          {hasDraft && (
            <Badge variant="outline" className="gap-1 border-border/70 text-muted-foreground">
              <FileText className="h-3 w-3" />
              draft
            </Badge>
          )}
          {job.notes && <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">{job.company_name}</span>
          {job.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>
          )}
          {job.remote && <Badge variant="secondary">remote</Badge>}
          {posted && <span className="text-xs">posted {posted}</span>}
        </div>

        {job.matched_keywords.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {job.matched_keywords.map((kw) => (
              <Badge key={kw} variant="outline" className="border-border/70">
                {kw}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon-sm" title="Open posting">
            <a href={job.url} target="_blank" rel="noreferrer">
              <ExternalLink />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={hasDraft ? 'Edit application' : 'Prepare application'}
            onClick={() => onApply(job)}
          >
            <FileText />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={job.dismissed ? 'Restore' : 'Not interested'}
            onClick={() => onDismiss(job, !job.dismissed)}
          >
            {job.dismissed ? <RotateCcw /> : <EyeOff />}
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" className="h-8" onClick={() => onApply(job)}>
            {hasDraft ? 'Resume' : 'Prepare'}
          </Button>

          <Select
            value={job.application_status ?? 'none'}
            onValueChange={(value) => {
              if (value === 'none') onUntrack(job)
              else onStatus(job, value as ApplicationStatus)
            }}
          >
            <SelectTrigger className="h-8 w-[132px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not tracked</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  )
}
