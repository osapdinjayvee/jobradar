import { useMemo, useState } from 'react'
import { LogOut, Radar } from 'lucide-react'
import { Toaster } from 'sonner'
import { ApplyDialog } from '@/components/ApplyDialog'
import { AuthGate } from '@/components/AuthGate'
import { Companies } from '@/components/Companies'
import { Feed } from '@/components/Feed'
import { ProfilePanel } from '@/components/ProfilePanel'
import { Tracker, isFollowUpDue } from '@/components/Tracker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFeed, useProfile } from '@/hooks/useData'
import { supabase } from '@/lib/supabase'
import type { FeedJob } from '@/lib/types'

function Dashboard({ email }: { email: string | undefined }) {
  const feed = useFeed()
  const { profile } = useProfile()

  // One dialog for the whole dashboard rather than one per card — the feed can
  // hold 600 rows, and the apply flow is single-focus by nature.
  const [applyJob, setApplyJob] = useState<FeedJob | null>(null)

  // Re-read the row from the feed each render so the dialog reflects the latest
  // save rather than the snapshot taken when it was opened.
  const activeJob = useMemo(
    () => (applyJob ? (feed.jobs.find((j) => j.id === applyJob.id) ?? applyJob) : null),
    [applyJob, feed.jobs],
  )

  const counts = useMemo(() => {
    const fresh = feed.jobs.filter(
      (j) =>
        !j.application_status &&
        !j.dismissed &&
        j.score >= 20 &&
        Date.now() - new Date(j.first_seen_at).getTime() < 7 * 24 * 60 * 60 * 1000,
    ).length
    const tracked = feed.jobs.filter((j) => j.application_status).length
    const due = feed.jobs.filter(isFollowUpDue).length
    return { fresh, tracked, due }
  }, [feed.jobs])

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Radar className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">JobRadar</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            public ATS boards, polled twice a day
          </span>
          <div className="flex-1" />
          {email && <span className="hidden text-xs text-muted-foreground md:inline">{email}</span>}
          <Button
            variant="ghost"
            size="icon-sm"
            title="Sign out"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {feed.error && (
          <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {feed.error}
          </div>
        )}

        <Tabs defaultValue="matches">
          <TabsList>
            <TabsTrigger value="matches">
              Matches
              {counts.fresh > 0 && (
                <Badge className="tnum ml-1 bg-primary/20 text-primary">{counts.fresh}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tracker">
              Tracker
              {counts.due > 0 ? (
                <Badge className="tnum ml-1 bg-amber-500/20 text-amber-500">{counts.due} due</Badge>
              ) : (
                counts.tracked > 0 && (
                  <Badge variant="secondary" className="tnum ml-1">
                    {counts.tracked}
                  </Badge>
                )
              )}
            </TabsTrigger>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="matches">
            <Feed feed={feed} onApply={setApplyJob} />
          </TabsContent>
          <TabsContent value="tracker">
            <Tracker feed={feed} onApply={setApplyJob} />
          </TabsContent>
          <TabsContent value="companies">
            <Companies onPolled={feed.refetch} />
          </TabsContent>
          <TabsContent value="profile">
            <ProfilePanel />
          </TabsContent>
        </Tabs>
      </main>

      <ApplyDialog
        job={activeJob}
        profile={profile}
        open={applyJob !== null}
        onOpenChange={(next) => !next && setApplyJob(null)}
        onSave={feed.saveApplication}
      />
    </div>
  )
}

export default function App() {
  return (
    <>
      <Toaster theme="dark" position="bottom-right" richColors />
      <AuthGate>{(session) => <Dashboard email={session.user.email} />}</AuthGate>
    </>
  )
}
