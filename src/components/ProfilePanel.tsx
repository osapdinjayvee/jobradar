import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { buildCoverLetter } from '@/lib/coverLetter'
import { useProfile } from '@/hooks/useData'

/** Stand-in posting for the live preview — never saved, never sent. */
const SAMPLE = {
  title: 'Senior Backend Engineer',
  companyName: 'Northwind',
  matchedKeywords: ['laravel', 'php', 'postgresql', 'aws'],
  remote: true,
  location: 'Remote',
}

export function ProfilePanel() {
  const { profile, loading, error, save } = useProfile()

  const [fullName, setFullName] = useState('')
  const [headline, setHeadline] = useState('')
  const [summary, setSummary] = useState('')
  const [location, setLocation] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const [variants, setVariants] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name)
    setHeadline(profile.headline)
    setSummary(profile.summary)
    setLocation(profile.location)
    setPortfolio(profile.portfolio_url ?? '')
    setVariants(profile.resume_variants.join('\n'))
  }, [profile])

  const preview = useMemo(
    () =>
      buildCoverLetter(SAMPLE, {
        fullName,
        headline,
        summary,
        location,
        portfolioUrl: portfolio || null,
      }),
    [fullName, headline, summary, location, portfolio],
  )

  async function onSave() {
    setSaving(true)
    try {
      await save({
        full_name: fullName.trim(),
        headline: headline.trim(),
        summary: summary.trim(),
        location: location.trim(),
        portfolio_url: portfolio.trim() || null,
        resume_variants: variants
          .split('\n')
          .map((v) => v.trim())
          .filter(Boolean),
      })
      toast.success('Profile saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton className="h-[420px] w-full rounded-xl" />

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <p className="font-medium">No profile row</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Run <code className="font-mono">0004_application_flow.sql</code> — it creates the table
          and seeds the single row this tab edits.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="full-name" label="Name" value={fullName} onChange={setFullName} />
          <Field
            id="location"
            label="Based in"
            value={location}
            onChange={setLocation}
            hint="Used only when a role is remote."
          />
        </div>

        <Field
          id="headline"
          label="Signature line"
          value={headline}
          onChange={setHeadline}
          placeholder="Full-stack developer · Laravel, Vue, AWS"
          hint="Sits under your name at the bottom of the letter."
        />

        <Field
          id="portfolio"
          label="Portfolio or GitHub"
          value={portfolio}
          onChange={setPortfolio}
          placeholder="https://github.com/you"
        />

        <div className="space-y-1.5">
          <Label htmlFor="summary">Summary</Label>
          <Textarea
            id="summary"
            rows={5}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Two or three sentences in your own voice — this carries the letter."
          />
          <p className="text-xs text-muted-foreground">
            Written once, reused in every draft. Keep it role-agnostic; the posting-specific part
            is generated per job from the matched keywords.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="variants">Resume variants</Label>
          <Textarea
            id="variants"
            rows={3}
            value={variants}
            onChange={(e) => setVariants(e.target.value)}
            placeholder={'Backend-heavy\nFull-stack\nMobile'}
          />
          <p className="text-xs text-muted-foreground">
            One per line. Labels only — JobRadar records which you sent, it does not store files.
          </p>
        </div>

        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Save profile
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Preview</p>
        <Card className="p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Against a sample posting for a {SAMPLE.title} at {SAMPLE.companyName}. Every real draft
            swaps in that job's own matched keywords.
          </p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
            {preview}
          </pre>
        </Card>
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
