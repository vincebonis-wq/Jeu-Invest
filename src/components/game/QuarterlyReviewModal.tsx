import { useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, Coins, AlertTriangle } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { STANCE_INFO } from '../../utils/strategy'
import type { StrategicStance } from '../../types'
import { formatEuro, formatEuroSigned, cn } from '../../utils/formatting'

const STANCES: StrategicStance[] = ['secure', 'growth', 'income']

export function QuarterlyReviewModal() {
  const review = useGameStore((s) => s.game?.pendingReview)
  const currentStance = useGameStore((s) => s.game?.strategicStance)
  const hasOfflineGains = useGameStore(
    (s) => !!s.game?.pendingOfflineGains && s.game.pendingOfflineGains.daysElapsed >= 1,
  )
  const resolveReview = useGameStore((s) => s.resolveQuarterlyReview)
  const [selected, setSelected] = useState<StrategicStance | null>(currentStance ?? null)

  // ReturnModal passe en premier — on attend qu'il soit fermé
  if (!review || hasOfflineGains) return null

  const nwUp = review.netWorthDelta >= 0
  const nextQ = review.quarter === 4 ? 1 : review.quarter + 1

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-400">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

        {/* Header sombre — contraste fort */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 px-6 pt-6 pb-5 text-white">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300 mb-1">
                Bulletin trimestriel
              </div>
              <div className="font-display font-extrabold text-4xl leading-none">
                T{review.quarter}
                <span className="text-indigo-400 text-2xl ml-2">{review.year}</span>
              </div>
            </div>
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold mt-1',
                nwUp ? 'bg-emerald-400/20 text-emerald-300' : 'bg-red-400/20 text-red-300',
              )}
            >
              {nwUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {formatEuroSigned(review.netWorthDelta)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white/10 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-white/50 text-[11px] uppercase tracking-wide mb-1.5">
                <Wallet size={11} /> Cashflow
              </div>
              <div
                className={cn(
                  'font-display font-bold text-lg',
                  review.cashflow >= 0 ? 'text-emerald-300' : 'text-red-300',
                )}
              >
                {formatEuroSigned(review.cashflow)}<span className="text-sm font-normal opacity-70">/m</span>
              </div>
            </div>
            <div className="bg-white/10 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-white/50 text-[11px] uppercase tracking-wide mb-1.5">
                <Coins size={11} /> Passifs
              </div>
              <div className="font-display font-bold text-lg text-amber-300">
                {formatEuro(review.passiveIncome)}<span className="text-sm font-normal opacity-70">/m</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Fait marquant + inflation */}
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-base shrink-0">📌</span>
              <span className="text-slate-600 leading-snug">{review.highlight}</span>
            </div>
            {review.inflationLost > 0 && (
              <div className="flex items-start gap-2 text-amber-600 border-t border-amber-100 pt-2">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <span className="text-xs leading-snug">
                  Ton cash a perdu ~{formatEuro(review.inflationLost)} de pouvoir d'achat — l'inflation silencieuse ronge l'inactif.
                </span>
              </div>
            )}
          </div>

          {/* Choix de posture */}
          <div>
            <div className="text-sm font-bold text-slate-800 mb-1">
              Priorité pour T{nextQ} ?
            </div>
            <p className="text-xs text-slate-400 mb-2.5">
              Les actifs alignés sur ta posture génèrent +4% de rendement.
            </p>
            <div className="space-y-2">
              {STANCES.map((id) => {
                const info = STANCE_INFO[id]
                const active = selected === id
                return (
                  <button
                    key={id}
                    onClick={() => setSelected(id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all',
                      active
                        ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                        : 'border-slate-100 hover:border-slate-200 bg-white',
                    )}
                  >
                    <span className="text-2xl shrink-0">{info.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          'font-display font-bold text-sm',
                          active ? 'text-indigo-700' : 'text-slate-700',
                        )}
                      >
                        {info.label}
                      </div>
                      <div className="text-xs text-slate-500 leading-snug">{info.description}</div>
                    </div>
                    <div
                      className={cn(
                        'shrink-0 w-5 h-5 rounded-full border-2 transition-all',
                        active
                          ? 'border-indigo-500 bg-indigo-500'
                          : 'border-slate-200 bg-white',
                      )}
                    >
                      {active && (
                        <svg className="w-full h-full text-white p-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pb-5 pt-1">
          <button
            disabled={!selected}
            onClick={() => selected && resolveReview(selected)}
            className={cn(
              'w-full py-3.5 font-display font-bold rounded-2xl text-base transition-all',
              selected
                ? 'bg-gradient-to-r from-slate-900 to-indigo-700 text-white hover:from-slate-800 hover:to-indigo-600 active:scale-95 shadow-lg shadow-indigo-200/50'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            )}
          >
            Valider ma stratégie pour T{nextQ} →
          </button>
        </div>
      </div>
    </div>
  )
}
