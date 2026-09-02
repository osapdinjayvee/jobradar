import { useCallback, useEffect, useState } from 'react'
import { supabase, FUNCTIONS_URL } from '@/lib/supabase'
import type { ApplicationStatus, Company, FeedJob } from '@/lib/types'

const FEED_LIMIT = 600

/** POST to an edge function with the signed-in user's JWT. */
export async function callFunction<T>(name: string, body: unknown = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')

  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`)
  return JSON.parse(text) as T
}

export function useFeed() {
  const [jobs, setJobs] = useState<FeedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setError(null)
    const { data, error } = await supabase
      .from('job_feed')
      .select('*')
      .order('score', { ascending: false })
      .order('first_seen_at', { ascending: false })
      .limit(FEED_LIMIT)

    if (error) setError(error.message)
    else setJobs((data ?? []) as FeedJob[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  /**
   * Optimistic local patch so the board and the feed do not flash while the
   * round-trip completes; a failed write refetches to put the truth back.
   */
  const patch = useCallback((id: string, changes: Partial<FeedJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...changes } : j)))
  }, [])

  const setStatus = useCallback(
    async (job: FeedJob, status: ApplicationStatus) => {
      patch(job.id, {
        application_status: status,
        applied_at: status === 'applied' ? new Date().toISOString() : job.applied_at,
      })
      const { error } = await supabase.from('applications').upsert(
        {
          job_id: job.id,
          status,
          applied_at: status === 'applied' ? (job.applied_at ?? new Date().toISOString()) : job.applied_at,
        },
        { onConflict: 'job_id' },
      )
      if (error) {
        setError(error.message)
        await refetch()
      } else {
        await refetch()
      }
    },
    [patch, refetch],
  )

  const untrack = useCallback(
    async (job: FeedJob) => {
      patch(job.id, { application_status: null, application_id: null, applied_at: null })
      const { error } = await supabase.from('applications').delete().eq('job_id', job.id)
      if (error) setError(error.message)
      await refetch()
    },
    [patch, refetch],
  )

  const setNotes = useCallback(
    async (job: FeedJob, notes: string) => {
      const { error } = await supabase.from('applications').upsert(
        { job_id: job.id, notes, status: job.application_status ?? 'interested' },
        { onConflict: 'job_id' },
      )
      if (error) setError(error.message)
      await refetch()
    },
    [refetch],
  )

  const dismiss = useCallback(
    async (job: FeedJob, dismissed = true) => {
      patch(job.id, { dismissed })
      const { error } = await supabase.from('jobs').update({ dismissed }).eq('id', job.id)
      if (error) {
        setError(error.message)
        await refetch()
      }
    },
    [patch, refetch],
  )

  return { jobs, loading, error, refetch, setStatus, untrack, setNotes, dismiss }
}

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from('companies').select('*').order('name')
    if (error) setError(error.message)
    else setCompanies((data ?? []) as Company[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const toggleActive = useCallback(
    async (company: Company) => {
      await supabase.from('companies').update({ active: !company.active }).eq('id', company.id)
      await refetch()
    },
    [refetch],
  )

  const deactivateMany = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return
      await supabase.from('companies').update({ active: false }).in('id', ids)
      await refetch()
    },
    [refetch],
  )

  const addCompany = useCallback(
    async (company: Pick<Company, 'name' | 'ats' | 'board_token' | 'market' | 'careers_url'>) => {
      const { error } = await supabase.from('companies').insert(company)
      if (error) throw new Error(error.message)
      await refetch()
    },
    [refetch],
  )

  const removeCompany = useCallback(
    async (id: string) => {
      await supabase.from('companies').delete().eq('id', id)
      await refetch()
    },
    [refetch],
  )

  return { companies, loading, error, refetch, toggleActive, deactivateMany, addCompany, removeCompany }
}
