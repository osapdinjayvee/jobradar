import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, ExternalLink, Loader2, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { callFunction, useCompanies } from '@/hooks/useData'
import { ATS_PROVIDERS, humanBoardUrl, type Ats } from '@/lib/ats'
import { MARKETS, type Market } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ValidateCheck {
  id: string
  company: string
  ok: boolean
  found: number
  error?: string
}

export function Companies({ onPolled }: { onPolled: () => void }) {
  const { companies, toggleActive, deactivateMany, addCompany, removeCompany, refetch } = useCompanies()
  const [busy, setBusy] = useState<'poll' | 'validate' | null>(null)
  const [checks, setChecks] = useState<Record<string, ValidateCheck>>({})

  const failing = Object.values(checks).filter((c) => !c.ok)

  async function poll() {
    setBusy('poll')
    try {
      const result = await callFunction<{ ok: number; failed: number; jobs: number }>('poll-boards')
      toast.success(`Polled ${result.ok + result.failed} boards`, {
        description: `${result.jobs} postings seen · ${result.failed} board${result.failed === 1 ? '' : 's'} failed`,
      })
      await refetch()
      onPolled()
    } catch (err) {
      toast.error('Poll failed', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(null)
    }
  }

  async function validate() {
    setBusy('validate')
    try {
      const result = await callFunction<{ checks: ValidateCheck[] }>('poll-boards', { mode: 'validate' })
      setChecks(Object.fromEntries(result.checks.map((c) => [c.id, c])))
      const bad = result.checks.filter((c) => !c.ok).length
      if (bad === 0) toast.success('Every board token resolves')
      else toast.warning(`${bad} board${bad === 1 ? '' : 's'} did not resolve`)
    } catch (err) {
      toast.error('Validation failed', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={poll} disabled={busy !== null}>
          {busy === 'poll' ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Poll now
        </Button>
        <Button variant="outline" onClick={validate} disabled={busy !== null}>
          {busy === 'validate' ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Validate all tokens
        </Button>
        {failing.length > 0 && (
          <Button
            variant="outline"
            onClick={async () => {
              await deactivateMany(failing.map((c) => c.id))
              toast.success(`Deactivated ${failing.length} dead board${failing.length === 1 ? '' : 's'}`)
            }}
          >
            <XCircle />
            Deactivate {failing.length} failing
          </Button>
        )}
        <div className="flex-1" />
        <AddCompanyDialog onAdd={addCompany} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Board</th>
                <th className="px-4 py-2.5 font-medium">Market</th>
                <th className="px-4 py-2.5 font-medium">Last poll</th>
                <th className="px-4 py-2.5 text-right font-medium">Jobs</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const check = checks[company.id]
                const failed = company.last_status?.startsWith('error') || check?.ok === false
                return (
                  <tr
                    key={company.id}
                    className={cn(
                      'border-b transition-colors last:border-0 hover:bg-secondary/30',
                      !company.active && 'opacity-45',
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(company)}
                          className={cn(
                            'h-2 w-2 shrink-0 rounded-full transition-colors',
                            company.active ? 'bg-primary' : 'bg-muted-foreground/40',
                          )}
                          title={company.active ? 'Active — click to pause' : 'Paused — click to resume'}
                        />
                        <span className="font-medium">{company.name}</span>
                        {failed && (
                          <Badge variant="destructive" title={check?.error ?? company.last_status ?? ''}>
                            unreachable
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <a
                        href={humanBoardUrl(company.ats, company.board_token)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary"
                      >
                        {company.ats}/{company.board_token}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {MARKETS.find((m) => m.value === company.market)?.label ?? company.market}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {company.last_polled_at
                        ? formatDistanceToNow(new Date(company.last_polled_at), { addSuffix: true })
                        : 'never'}
                    </td>
                    <td className="tnum px-4 py-2.5 text-right text-muted-foreground">
                      {check?.found ?? company.last_count}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Remove board"
                        onClick={() => removeCompany(company.id)}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Board tokens go stale when a company changes ATS. Run “Validate all tokens” every month or so
        and deactivate whatever stopped resolving.
      </p>
    </div>
  )
}

function AddCompanyDialog({
  onAdd,
}: {
  onAdd: (c: {
    name: string
    ats: Ats
    board_token: string
    market: Market
    careers_url: string | null
  }) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [ats, setAts] = useState<Ats>('greenhouse')
  const [token, setToken] = useState('')
  const [market, setMarket] = useState<Market>('remote-global')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!name.trim() || !token.trim()) return
    setSaving(true)
    try {
      await onAdd({
        name: name.trim(),
        ats,
        board_token: token.trim(),
        market,
        careers_url: null,
      })
      toast.success(`Added ${name.trim()}`)
      setName('')
      setToken('')
      setOpen(false)
    } catch (err) {
      toast.error('Could not add board', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus />
          Add board
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a company board</DialogTitle>
          <DialogDescription>
            The token is the last path segment of the company’s public job board — e.g.
            <span className="font-mono"> jobs.lever.co/</span>
            <span className="font-mono font-semibold">canva</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="c-name">Company</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>ATS</Label>
              <Select value={ats} onValueChange={(v) => setAts(v as Ats)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATS_PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Market</Label>
              <Select value={market} onValueChange={(v) => setMarket(v as Market)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKETS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="c-token">Board token</Label>
            <Input
              id="c-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="acme"
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !name.trim() || !token.trim()}>
            {saving && <Loader2 className="animate-spin" />}
            Add board
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
