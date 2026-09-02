import { useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, RefreshCw, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  buildCoverLetter,
  isUneditedDraft,
  type CoverLetterJob,
  type CoverLetterProfile,
} from '@/lib/coverLetter'
import { FOLLOW_UP_DAYS, type ApplicationPatch, type FeedJob, type Profile } from '@/lib/types'

interface Props {
  job: FeedJob | null
  profile: Profile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (job: FeedJob, changes: ApplicationPatch) => Promise<void>
}

const NO_VARIANT = '__none__'

function toLetterJob(job: FeedJob): CoverLetterJob {
  return {
    title: job.title,
    companyName: job.company_name,
    matchedKeywords: job.matched_keywords,
    remote: job.remote,
    location: job.location,
  }
}

function toLetterProfile(p: Profile | null): CoverLetterProfile {
  return {
    fullName: p?.full_name ?? '',
    headline: p?.headline ?? '',
    summary: p?.summary ?? '',
    location: p?.location ?? '',
    portfolioUrl: p?.portfolio_url ?? null,
  }
}

/** timestamptz ↔ the yyyy-mm-dd that <input type="date"> wants. */
function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function fromDateInput(value: string): string | null {
  if (!value) return null
  const d = new Date(`${value}T09:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export function ApplyDialog({ job, profile, open, onOpenChange, onSave }: Props) {
  const [letter, setLetter] = useState('')
  const [notes, setNotes] = useState('')
  const [variant, setVariant] = useState<string>(NO_VARIANT)
  const [followUp, setFollowUp] = useState('')
  const [saving, setSaving] = useState(false)

  const variants = profile?.resume_variants ?? []

  const generated = useMemo(
    () => (job ? buildCoverLetter(toLetterJob(job), toLetterProfile(profile)) : ''),
    [job, profile],
  )

  // Reload from the record every time the dialog opens. The previous notes
  // editor reset to an empty string here, which meant every save overwrote
  // whatever was already stored.
  useEffect(() => {
    if (!open || !job) return
    setLetter(job.cover_letter ?? generated)
    setNotes(job.notes ?? '')
    setVariant(job.resume_variant ?? variants[0] ?? NO_VARIANT)
    setFollowUp(toDateInput(job.follow_up_at))
    // `generated` is derived from `job`; re-running on its identity alone would
    // clobber in-progress edits whenever the feed refetches underneath us.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job?.id])

  if (!job) return null

  const untouched = letter.trim().length > 0 && isUneditedDraft(letter, toLetterJob(job), toLetterProfile(profile))

  const patch = (): ApplicationPatch => ({
    cover_letter: letter.trim() || null,
    notes: notes.trim() || null,
    resume_variant: variant === NO_VARIANT ? null : variant,
    follow_up_at: fromDateInput(followUp),
  })

  async function persist(changes: ApplicationPatch, message: string) {
    if (!job) return
    setSaving(true)
    try {
      await onSave(job, changes)
      toast.success(message)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  function regenerate() {
    if (letter.trim() && !untouched && !confirm('Replace your edits with a fresh draft?')) return
    setLetter(generated)
  }

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(letter)
      toast.success('Cover letter copied')
    } catch {
      toast.error('Clipboard blocked — select the text and copy manually')
    }
  }

  function submitAndMarkApplied() {
    // Opened synchronously inside the click handler; awaiting the save first
    // would put the popup blocker between you and the posting.
    window.open(job!.url, '_blank', 'noopener,noreferrer')
    void persist(
      {
        ...patch(),
        status: 'applied',
        follow_up_at: fromDateInput(followUp) ?? daysFromNow(FOLLOW_UP_DAYS),
      },
      'Marked as applied',
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="leading-snug">{job.title}</DialogTitle>
          <DialogDescription>
            {job.company_name}
            {job.location ? ` · ${job.location}` : ''} · score {job.score}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="resume-variant">Resume sent</Label>
              <Select value={variant} onValueChange={setVariant}>
                <SelectTrigger id="resume-variant">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VARIANT}>Not recorded</SelectItem>
                  {variants.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {variants.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Add variants on the Profile tab to track which one you sent.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="follow-up">Follow up on</Label>
              <Input
                id="follow-up"
                type="date"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Defaults to {FOLLOW_UP_DAYS} days out when you mark it applied.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="cover-letter">Cover letter</Label>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={copyLetter} disabled={!letter.trim()}>
                  <Copy /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={regenerate}>
                  <RefreshCw /> Redraft
                </Button>
              </div>
            </div>
            <Textarea
              id="cover-letter"
              rows={14}
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              className="font-normal leading-relaxed"
            />
            {untouched && (
              <p className="flex items-start gap-1.5 text-xs text-amber-500">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                Still the generated draft. Tailoring this is the single biggest lever on whether
                you hear back — worth two minutes before you send it.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apply-notes">Notes</Label>
            <Textarea
              id="apply-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Referral contact, salary band, who to chase…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => void persist(patch(), 'Draft saved')}
          >
            Save draft
          </Button>
          <Button disabled={saving} onClick={submitAndMarkApplied}>
            <ExternalLink /> Open posting &amp; mark applied
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
