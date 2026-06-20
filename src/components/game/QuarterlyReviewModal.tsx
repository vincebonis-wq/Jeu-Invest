import { useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, Coins, AlertTriangle, Lightbulb } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { STANCE_INFO } from '../../utils/strategy'
import type { StrategicStance, QuarterlyVerdict } from '../../types'
import { formatEuro, formatEuroSigned, cn } from '../../utils/formatting'

const STANCES: StrategicStance[] = ['secure', 'growth', 'income']

const VERDICT_CONFIG: Record<QuarterlyVerdict, { label: string; emoji: string; bg: string; text: string }> = {
  excellent: { label: 'Excellent trimestre',  emoji: '🌟', bg: 'bg-emerald-400/20', text: 'text-emerald-300' },
  good:      { label: 'Bon trimestre',        emoji: '✅', bg: 'bg-sky-400/20',     text: 'text-sky-300' },
  neutral:   { label: 'Trimestre stable',     emoji: '➡️', bg: 'bg-slate-400/20',   text: 'text-slate-300' },
  bad:       { label: 'Trimestre difficile',  emoji: '⚠️', bg: 'bg-red-400/20',     text: 'text-red-300' },
}

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
  const verdict = review.verdict ?? (nwUp ? 'good' : 'neutral')
  const vc = VERDICT_CONFIG[verdict]

  // Compat: si ancien save sans highlights[], construit depuis highlight
  const highlights: string[] = review.highlights?.length
    ? review.highlights
    : [review.highlight ?? 'Un trimestre calme, sans événement majeur.']

  const passiveRatio = review.passiveRatio ?? (review.salary > 0 ? review.passiveIncome / review.salary : 0)
  const autonomyPct = Math.min(100, Math.round(passiveRatio * 100))

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-400">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

        {/* ── Header sombre ─────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 px-6 pt-6 pb-5 text-white">
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300 mb-1">
                Bulletin trimestriel
              </div>
              <div className="font-display font-extrabold text-4xl leading-none">
                T{review.quarter}
                <span className="text-indigo-400 text-2xl ml-2">{review.year}</span>
              </div>
            </div>
            {/* Verdict badge */}
            <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mt-1', vc.bg, vc.text)}>
              <span>{vc.emoji}</span>
              {vc.label}
            </div>
          </div>

          {/* Patrimoine delta */}
          <div className="flex items-center gap-2 mt-3 mb-4">
            {nwUp
              ? <TrendingUp size={15} className="text-emerald-400 shrink-0" />
              : <TrendingDown size={15} className="text-red-400 shrink-0" />}
            <span className={cn('font-display font-bold text-lg', nwUp ? 'text-emerald-300' : 'text-red-300')}>
              {formatEuroSigned(review.netWorthDelta)}
            </span>
            <span className="text-white/40 text-sm">
              ({review.netWorthDeltaPct > 0 ? '+' : ''}{(review.netWorthDeltaPct * 100).toFixed(1)}%)
            </span>
            <span className="text-white/30 text-xs ml-auto">sur 3 mois</span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white/10 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-white/50 text-[11px] uppercase tracking-wide mb-1.5">
                <Wallet size={11} /> Cashflow mensuel
              </div>
              <div className={cn('font-display font-bold text-lg', review.cashflow >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                {formatEuroSigned(review.cashflow)}<span className="text-sm font-normal opacity-70">/m</span>
              </div>
            </div>
            <div className="bg-white/10 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-white/50 text-[11px] uppercase tracking-wide mb-1.5">
                <Coins size={11} /> Revenus passifs
              </div>
              <div className="font-display font-bold text-lg text-amber-300">
                {formatEuro(review.passiveIncome)}<span className="text-sm font-normal opacity-70">/m</span>
              </div>
            </div>
          </div>

          {/* Autonomy bar */}
          {review.salary > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-white/50 mb-1">
                <span>Autonomie financière</span>
                <span className={cn('font-bold', autonomyPct >= 100 ? 'text-emerald-300' : 'text-white/70')}>
                  {autonomyPct}%{autonomyPct >= 100 ? ' 🎯' : ''}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', autonomyPct >= 100 ? 'bg-emerald-400' : 'bg-indigo-400')}
                  style={{ width: `${autonomyPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Corps scrollable ───────────────────────────────────── */}
        <div className="p-5 space-y-4 max-h-[55vh] overflow-y-auto">

          {/* Observations */}
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Faits du trimestre</div>
            {highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="shrink-0 text-slate-300 mt-0.5">•</span>
                <span className="text-slate-600 leading-snug">{h}</span>
              </div>
            ))}
            {review.inflationLost > 100 && (
              <div className="flex items-start gap-2 text-amber-600 border-t border-amber-100 pt-2 mt-1">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <span className="text-xs leading-snug">
                  L'inflation a grignoté ~{formatEuro(review.inflationLost)} de pouvoir d'achat sur ton cash idle.
                </span>
              </div>
            )}
          </div>

          {/* Coach tip */}
          {review.coachTip && (
            <div className="flex items-start gap-3 rounded-2xl bg-indigo-50 border border-indigo-100 p-3.5">
              <div className="shrink-0 w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Lightbulb size={15} className="text-indigo-600" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-400 mb-0.5">Conseil</div>
                <p className="text-sm text-indigo-800 leading-snug">{review.coachTip}</p>
              </div>
            </div>
          )}

          {/* Posture stratégique */}
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
                      <div className={cn('font-display font-bold text-sm', active ? 'text-indigo-700' : 'text-slate-700')}>
                        {info.label}
                      </div>
                      <div className="text-xs text-slate-500 leading-snug">{info.description}</div>
                    </div>
                    <div className={cn('shrink-0 w-5 h-5 rounded-full border-2 transition-all', active ? 'border-indigo-500 bg-indigo-500' : 'border-slate-200 bg-white')}>
                      {active && (
                        <svg className="w-full h-full text-white p-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── CTA ───────────────────────────────────────────────── */}
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
