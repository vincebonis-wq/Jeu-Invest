import type { ReactNode } from 'react'
import { cn } from '../../utils/formatting'

type Tone = 'slate' | 'brand' | 'success' | 'warning' | 'danger' | 'gold' | 'purple'

const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-orange-100 text-orange-700',
  danger: 'bg-red-100 text-red-700',
  gold: 'bg-amber-100 text-amber-700',
  purple: 'bg-purple-100 text-purple-700',
}

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  className?: string
}

export function Badge({ children, tone = 'slate', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Affiche un niveau de risque sous forme d'étoiles/points. */
export function RiskBadge({ level }: { level: number }) {
  const tone: Tone =
    level <= 1 ? 'success' : level <= 2 ? 'brand' : level <= 3 ? 'warning' : 'danger'
  const label = ['', 'Très faible', 'Faible', 'Modéré', 'Élevé', 'Très élevé'][level]
  return (
    <Badge tone={tone}>
      <span className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'w-1 h-2.5 rounded-full',
              i < level ? 'bg-current opacity-90' : 'bg-current opacity-20',
            )}
          />
        ))}
      </span>
      {label}
    </Badge>
  )
}
