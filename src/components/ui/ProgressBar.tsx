import { cn } from '../../utils/formatting'

interface ProgressBarProps {
  value: number // 0-100
  className?: string
  barClassName?: string
  height?: string
  shimmer?: boolean
}

export function ProgressBar({
  value,
  className,
  barClassName,
  height = 'h-2.5',
  shimmer = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('w-full bg-slate-100 rounded-full overflow-hidden', height, className)}>
      <div
        className={cn(
          'h-full rounded-full transition-all duration-700 ease-out',
          shimmer && 'progress-shimmer',
          barClassName ?? 'bg-gradient-to-r from-brand-400 to-brand-600',
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
