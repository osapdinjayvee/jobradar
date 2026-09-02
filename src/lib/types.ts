import type { Ats } from './ats.ts'

export type Market = 'remote-global' | 'au-nz' | 'ph' | 'us-eu'

export const MARKETS: { value: Market; label: string }[] = [
  { value: 'remote-global', label: 'Remote-global' },
  { value: 'au-nz', label: 'Australia / NZ' },
  { value: 'ph', label: 'Philippines' },
  { value: 'us-eu', label: 'US / Europe' },
]

export type ApplicationStatus =
  | 'interested'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn'

export const STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: 'interested', label: 'Interested' },
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

/** Board pipeline order — terminal states live outside the board. */
export const PIPELINE: ApplicationStatus[] = [
  'interested',
  'applied',
  'screening',
  'interview',
  'offer',
]

export interface Company {
  id: string
  name: string
  ats: Ats
  board_token: string
  market: Market
  careers_url: string | null
  active: boolean
  last_polled_at: string | null
  last_status: string | null
  last_count: number
}

export interface FeedJob {
  id: string
  title: string
  location: string | null
  department: string | null
  remote: boolean
  url: string
  description: string | null
  posted_at: string | null
  score: number
  matched_keywords: string[]
  dismissed: boolean
  first_seen_at: string
  company_id: string
  company_name: string
  ats: Ats
  market: Market
  application_id: string | null
  application_status: ApplicationStatus | null
  applied_at: string | null
  notes: string | null
  resume_variant: string | null
  cover_letter: string | null
  follow_up_at: string | null
}

export interface Profile {
  id: boolean
  full_name: string
  headline: string
  summary: string
  location: string
  portfolio_url: string | null
  resume_variants: string[]
}

/** Fields the apply dialog writes back; everything is optional per save. */
export interface ApplicationPatch {
  status?: ApplicationStatus
  notes?: string | null
  resume_variant?: string | null
  cover_letter?: string | null
  follow_up_at?: string | null
  applied_at?: string | null
}

/** Default chase-up window. Two weeks of silence is a non-answer. */
export const FOLLOW_UP_DAYS = 10
