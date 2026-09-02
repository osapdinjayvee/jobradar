import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Loader2, Radar } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Single-user gate. The tracker holds your application history and private
 * notes, so RLS requires an authenticated role rather than leaving the tables
 * open to the anon key.
 */
export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (session) return <>{children(session)}</>

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setSending(false)
    if (error) toast.error('Could not send link', { description: error.message })
    else toast.success('Check your inbox for the sign-in link')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2">
          <Radar className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">JobRadar</span>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Sign in with a magic link to reach your feed and application history.
        </p>
        <form onSubmit={sendLink} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <Button type="submit" disabled={sending || !email.trim()}>
            {sending && <Loader2 className="animate-spin" />}
            Send sign-in link
          </Button>
        </form>
      </Card>
    </div>
  )
}
