import { useEffect, useRef, useState } from 'react'
import { Flame, TrendingUp, Star } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { BADGE_BY_ID } from '../../data/badges'
import { Confetti } from '../ui/Confetti'
import { playCashRegister } from '../../utils/sounds'
import { formatEuroCompact, formatEuroSigned, cn } from '../../utils/formatting'

// Modal "Bon retour" — révèle les gains faits pendant l'absence du joueur.
export function ReturnModal() {
  const gains = useGameStore((s) => s.game?.pendingOfflineGains)
  const collectOfflineGains = useGameStore((s) => s.collectOfflineGains)
  const [animating, setAnimating] = useState(false)
  const [displayedGain, setDisplayedGain] = useState(0)
  const rafRef = useRef<number | null>(null)

  const open = !!gains && gains.daysElapsed >= 1

  // Compte à rebours animé quand le modal s'ouvre
  useEffect(() => {
    if (!open || !gains) { setDisplayedGain(0); return }
    setAnimating(true)
    const target = gains.netWorthGain
    const startTime = performance.now()
    const duration = 1400

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Easing out-expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setDisplayedGain(Math.round(target * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setAnimating(false)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [open, gains])

  if (!open || !gains) return null

  const hasBonus = gains.returnBonusPct > 0
  const daysLabel = gains.daysElapsed === 1 ? '1 jour' : `${gains.daysElapsed} jours`

  return (
    <>
      <Confetti active={open && !animating && gains.netWorthGain > 0} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Header dégradé */}
          <div className="bg-gradient-to-br from-brand-500 to-indigo-600 p-6 text-white text-center">
            <div className="text-4xl mb-1">👋</div>
            <div className="font-display font-extrabold text-xl">Bon retour !</div>
            <div className="text-sm text-white/70 mt-1">
              Pendant ton absence de {daysLabel}, ton argent a travaillé.
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Gain principal animé */}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-4 text-center">
              <div className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-1">
                Évolution du patrimoine
              </div>
              <div
                className={cn(
                  'font-display font-extrabold text-3xl transition-colors',
                  gains.netWorthGain >= 0 ? 'text-emerald-600' : 'text-red-500',
                )}
              >
                {formatEuroSigned(displayedGain)}
              </div>
              {gains.cashGain !== 0 && (
                <div className="text-xs text-slate-500 mt-1">
                  dont {formatEuroCompact(gains.cashGain)} en cash perçu
                </div>
              )}
            </div>

            {/* Streak */}
            <div className={cn(
              'flex items-center gap-3 rounded-2xl p-3',
              gains.streakBroken ? 'bg-red-50' : 'bg-amber-50',
            )}>
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                gains.streakBroken ? 'bg-red-100' : 'bg-amber-100',
              )}>
                <Flame size={18} className={gains.streakBroken ? 'text-red-500' : 'text-amber-500'} />
              </div>
              <div className="min-w-0">
                {gains.streakBroken ? (
                  <>
                    <div className="text-sm font-bold text-red-700">Série interrompue</div>
                    <div className="text-xs text-red-500">Nouvelle série : {gains.newStreakCount} jour</div>
                  </>
                ) : gains.streakContinued ? (
                  <>
                    <div className="text-sm font-bold text-amber-700">
                      Série : {gains.newStreakCount} jour{gains.newStreakCount > 1 ? 's' : ''} 🔥
                    </div>
                    <div className="text-xs text-amber-600">Continue comme ça !</div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-bold text-amber-700">Connexion du jour</div>
                    <div className="text-xs text-amber-600">Série : {gains.newStreakCount} jour{gains.newStreakCount > 1 ? 's' : ''}</div>
                  </>
                )}
              </div>
              {hasBonus && (
                <div className="shrink-0 text-xs font-bold bg-amber-400 text-white px-2 py-1 rounded-full">
                  +{Math.round(gains.returnBonusPct * 100)}% 4h
                </div>
              )}
            </div>

            {/* Nouveaux badges */}
            {gains.newBadges.length > 0 && (
              <div className="rounded-2xl bg-violet-50 border border-violet-100 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Star size={14} className="text-violet-500" />
                  <span className="text-xs font-bold text-violet-700">
                    {gains.newBadges.length} trophée{gains.newBadges.length > 1 ? 's' : ''} débloqué{gains.newBadges.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {gains.newBadges.map((id) => {
                    const badge = BADGE_BY_ID[id]
                    if (!badge) return null
                    return (
                      <div key={id} className="flex items-center gap-1.5 bg-white rounded-xl px-2.5 py-1.5 shadow-sm border border-violet-100">
                        <span className="text-base">{badge.emoji}</span>
                        <span className="text-xs font-semibold text-violet-800">{badge.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Revenus passifs info */}
            {gains.passiveIncomeEarned > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
                <TrendingUp size={13} className="text-brand-500 shrink-0" />
                <span>
                  Tes actifs t'ont versé <strong className="text-slate-700">{formatEuroCompact(gains.passiveIncomeEarned)}</strong> en revenus pendant ton absence.
                </span>
              </div>
            )}
          </div>

          {/* CTA Encaisser */}
          <div className="px-5 pb-5">
            <button
              onClick={() => { playCashRegister(); collectOfflineGains() }}
              className="w-full py-3.5 bg-gradient-to-r from-brand-500 to-indigo-600 text-white font-display font-bold rounded-2xl text-base hover:from-brand-600 hover:to-indigo-700 transition-all active:scale-95 shadow-lg shadow-brand-200"
            >
              Encaisser {gains.netWorthGain > 0 ? formatEuroCompact(gains.netWorthGain) : ''}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
