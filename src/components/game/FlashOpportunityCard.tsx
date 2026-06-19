import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { getCatalogItem } from '../../data/investments'
import { formatEuroCompact, cn } from '../../utils/formatting'
import { calcNetWorth } from '../../utils/calculations'
import { playPop } from '../../utils/sounds'

// Carte "Opportunité flash" — affichée sur le Dashboard, expire en temps réel.
export function FlashOpportunityCard() {
  const game = useGameStore((s) => s.game)
  const claimFlash = useGameStore((s) => s.claimFlashOpportunity)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!game) return null
  const opps = (game.flashOpportunities ?? []).filter(
    (o) => !o.claimed && o.expiresAtReal > now,
  )
  const opp = opps[0]
  if (!opp) return null

  const secondsLeft = Math.max(0, Math.round((opp.expiresAtReal - now) / 1000))
  const minutesLeft = Math.floor(secondsLeft / 60)
  const secsLeft = secondsLeft % 60
  const timeLabel = minutesLeft > 0
    ? `${minutesLeft}:${String(secsLeft).padStart(2, '0')}`
    : `${secsLeft}s`
  const urgency = secondsLeft < 60

  const catalog = getCatalogItem(opp.catalogId)
  const netWorth = calcNetWorth(game)
  const canAfford = game.cashBalance >= opp.minAmount
  const isUnlocked = netWorth >= catalog.unlockThreshold
  const hasSkill = !catalog.skillRequired || (game.player.learnedSkillIds ?? []).includes(catalog.skillRequired)
  const canUse = canAfford && isUnlocked && hasSkill

  return (
    <div
      className={cn(
        'rounded-2xl border-2 p-4 transition-all',
        urgency
          ? 'border-red-300 bg-red-50 animate-pulse'
          : 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
            urgency ? 'bg-red-100' : 'bg-amber-100',
          )}>
            <Zap size={16} className={urgency ? 'text-red-500' : 'text-amber-600'} />
          </div>
          <div>
            <div className="font-display font-bold text-slate-800 text-sm">{opp.label}</div>
            <div className="text-xs text-slate-500">{catalog.shortName}</div>
          </div>
        </div>
        <div className={cn(
          'font-display font-bold text-lg tabular-nums shrink-0',
          urgency ? 'text-red-600' : 'text-amber-700',
        )}>
          {timeLabel}
        </div>
      </div>

      <p className="text-xs text-slate-600 mb-3 leading-relaxed">{opp.description}</p>

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-slate-500">
          Min. {formatEuroCompact(opp.minAmount)} · <span className="font-semibold text-emerald-600">+{Math.round(opp.bonusPct * 100)}% rendement</span>
        </div>
        {canUse ? (
          <button
            onClick={() => { playPop(); claimFlash(opp.id) }}
            className="shrink-0 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-xl hover:from-amber-500 hover:to-orange-600 transition-all active:scale-95 shadow-sm"
          >
            Saisir →
          </button>
        ) : (
          <span className="shrink-0 text-xs text-slate-400 italic">
            {!isUnlocked || !hasSkill ? 'Verrouillé' : `Cash insuffisant (${formatEuroCompact(opp.minAmount)} requis)`}
          </span>
        )}
      </div>
    </div>
  )
}
