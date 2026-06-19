import { useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, Coins, AlertTriangle } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { STANCE_INFO } from '../../utils/strategy'
import type { StrategicStance } from '../../types'
import { formatEuro, formatEuroSigned, cn } from '../../utils/formatting'

// ============================================================================
// Bilan trimestriel : moment de stillness imposé. Le jeu se met en pause et
// demande au joueur d'articuler sa posture stratégique pour le trimestre.
// ============================================================================

const STANCES: StrategicStance[] = ['secure', 'growth', 'income']

export function QuarterlyReviewModal() {
  const review = useGameStore((s) => s.game?.pendingReview)
  const currentStance = useGameStore((s) => s.game?.strategicStance)
  const resolveReview = useGameStore((s) => s.resolveQuarterlyReview)
  const [selected, setSelected] = useState<StrategicStance | null>(currentStance ?? null)

  if (!review) return null

  const nwUp = review.netWorthDelta >= 0

  return (
    <Modal open onClose={() => {}} closable={false} size="md">
      <div className="space-y-5">
        {/* En-tête */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold uppercase tracking-wide mb-2">
            Bilan · T{review.quarter} {review.year}
          </div>
          <h2 className="font-display font-extrabold text-2xl text-slate-800">
            Le point du trimestre
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Prends un instant. Où en es-tu, et où veux-tu aller ?
          </p>
        </div>

        {/* Stats du trimestre */}
        <div className="grid grid-cols-3 gap-2.5">
          <ReviewStat
            icon={nwUp ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            label="Patrimoine"
            value={formatEuroSigned(review.netWorthDelta)}
            tone={nwUp ? 'up' : 'down'}
          />
          <ReviewStat
            icon={<Wallet size={15} />}
            label="Cashflow"
            value={`${formatEuroSigned(review.cashflow)}/m`}
            tone={review.cashflow >= 0 ? 'up' : 'down'}
          />
          <ReviewStat
            icon={<Coins size={15} />}
            label="Revenus passifs"
            value={`${formatEuro(review.passiveIncome)}/m`}
            tone="neutral"
          />
        </div>

        {/* Fait marquant + inflation */}
        <div className="rounded-2xl bg-slate-50 p-3.5 space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-base">📌</span>
            <span className="text-slate-600">{review.highlight}</span>
          </div>
          {review.inflationLost > 0 && (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle size={14} />
              <span className="text-xs">
                Ton cash a perdu ~{formatEuro(review.inflationLost)} de pouvoir d'achat
                (inflation silencieuse).
              </span>
            </div>
          )}
        </div>

        {/* Choix de posture */}
        <div>
          <div className="text-sm font-bold text-slate-700 mb-2">
            Quelle est ta priorité pour le prochain trimestre ?
          </div>
          <div className="space-y-2">
            {STANCES.map((id) => {
              const info = STANCE_INFO[id]
              const active = selected === id
              return (
                <button
                  key={id}
                  onClick={() => setSelected(id)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-2xl border-2 text-left transition-all',
                    active
                      ? 'border-brand-400 bg-brand-50'
                      : 'border-slate-100 hover:border-slate-200',
                  )}
                >
                  <span className="text-2xl shrink-0">{info.emoji}</span>
                  <div>
                    <div className={cn('font-display font-bold', active ? 'text-brand-700' : 'text-slate-700')}>
                      {info.label}
                    </div>
                    <div className="text-xs text-slate-500 leading-snug">{info.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            Les actifs alignés sur ta posture rendent légèrement mieux (+4%).
          </p>
        </div>

        <Button
          fullWidth
          size="lg"
          disabled={!selected}
          onClick={() => selected && resolveReview(selected)}
        >
          Reprendre le jeu
        </Button>
      </div>
    </Modal>
  )
}

function ReviewStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 text-center">
      <div
        className={cn(
          'inline-flex items-center justify-center mb-1',
          tone === 'up' && 'text-emerald-600',
          tone === 'down' && 'text-red-500',
          tone === 'neutral' && 'text-slate-500',
        )}
      >
        {icon}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</div>
      <div
        className={cn(
          'font-display font-bold text-sm',
          tone === 'up' && 'text-emerald-600',
          tone === 'down' && 'text-red-500',
          tone === 'neutral' && 'text-slate-700',
        )}
      >
        {value}
      </div>
    </div>
  )
}
