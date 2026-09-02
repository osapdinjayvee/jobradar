import { cn } from '@/lib/utils'

/**
 * Match score as a filled ring rather than a bare number — at a glance you are
 * comparing arc lengths, which is far faster than reading two-digit integers
 * down a long list. Negative scores mean the exclusion keywords fired.
 */
export function ScoreDial({ score, className }: { score: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, score))
  const circumference = 2 * Math.PI * 15.5

  const tone =
    score >= 55 ? 'text-primary' : score >= 25 ? 'text-amber-500' : 'text-muted-foreground'

  return (
    <div className={cn('relative h-11 w-11 shrink-0', className)} title={`Match score ${score}`}>
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth="3"
          className="stroke-secondary"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className={cn('stroke-current transition-[stroke-dashoffset] duration-500', tone)}
        />
      </svg>
      <span
        className={cn(
          'tnum absolute inset-0 flex items-center justify-center text-xs font-semibold',
          tone,
        )}
      >
        {score}
      </span>
    </div>
  )
}
