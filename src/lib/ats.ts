/**
 * Browser-side re-export of the shared ATS adapters.
 *
 * One implementation, two runtimes — the edge function and the dashboard's
 * "Validate" button must agree about what a working board looks like, so they
 * import the same module rather than two drifting copies.
 */
export * from '../../supabase/functions/_shared/ats.ts'
