import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { BADGE_BY_ID } from '../../data/badges'
import { Confetti } from '../ui/Confetti'
import { playDing, playMajorDing } from '../../utils/sounds'
import type { BadgeId } from '../../types'

// Pop-up empilé en bas-gauche pour les badges gagnés en cours de jeu.
export function BadgeNotification() {
  const pendingBadges = useGameStore((s) => s.game?.pendingBadges ?? [])
  const dismissBadge = useGameStore((s) => s.dismissBadge)
  const [current, setCurrent] = useState<BadgeId | null>(null)
  const [confetti, setConfetti] = useState(false)

  useEffect(() => {
    if (current) return // on attend que le joueur ferme
    const next = pendingBadges[0]
    if (!next) return
    setCurrent(next)

    const badge = BADGE_BY_ID[next]
    const deserveConfetti = badge?.category === 'special' ||
      ['net_worth_50k', 'net_worth_100k', 'net_worth_500k', 'passive_income_500'].includes(next)
    if (deserveConfetti) {
      setConfetti(true)
      setTimeout(() => setConfetti(false), 3000)
      playMajorDing()
    } else {
      playDing()
    }

    // Auto-fermeture après 6 secondes si le joueur ne ferme pas
    const t = setTimeout(() => {
      setCurrent(null)
      dismissBadge(next)
    }, 6000)
    return () => clearTimeout(t)
  }, [pendingBadges, current, dismissBadge])

  if (!current) return null
  const badge = BADGE_BY_ID[current]
  if (!badge) return null

  function close() {
    if (!current) return
    dismissBadge(current)
    setCurrent(null)
  }

  const isSpecial = badge.category === 'special'

  return (
    <>
      <Confetti active={confetti} />
      <div
        className="fixed bottom-24 lg:bottom-6 left-4 lg:left-6 z-[100] animate-in slide-in-from-bottom-4 duration-500"
        role="alert"
      >
        <div
          className={`
            flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-xl
            ${isSpecial
              ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white'
              : 'bg-white border border-slate-200 text-slate-800'}
            max-w-xs
          `}
        >
          <span className="text-3xl leading-none shrink-0 mt-0.5">{badge.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${isSpecial ? 'text-white/70' : 'text-violet-600'}`}>
              Trophée débloqué !
            </div>
            <div className="font-display font-bold text-sm">{badge.name}</div>
            <div className={`text-xs mt-0.5 ${isSpecial ? 'text-white/80' : 'text-slate-500'}`}>
              {badge.description}
            </div>
          </div>
          <button
            onClick={close}
            className={`shrink-0 p-1 rounded-lg transition-colors ${isSpecial ? 'hover:bg-white/20 text-white/70' : 'hover:bg-slate-100 text-slate-400'}`}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </>
  )
}
