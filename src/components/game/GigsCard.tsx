import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { GIGS } from '../../data/gigs'
import { Card, CardHeader } from '../ui/Card'
import { cn } from '../../utils/formatting'

export function GigsCard() {
  const game = useGameStore((s) => s.game)!
  const claimGig = useGameStore((s) => s.claimGig)
  const [flash, setFlash] = useState<Record<string, string>>({})

  const cooldowns = game.gigCooldowns || {}
  const now = new Date(game.gameDateISO).getTime()

  function handleClaim(id: string) {
    const res = claimGig(id)
    if (res.success && res.reward) {
      setFlash((f) => ({ ...f, [id]: `+${res.reward} €` }))
      setTimeout(() => setFlash((f) => {
        const next = { ...f }
        delete next[id]
        return next
      }), 1600)
    }
  }

  return (
    <Card className="p-5">
      <CardHeader
        title="Missions express"
        subtitle="Un petit coup de pouce pour ta trésorerie"
        icon={<Sparkles size={18} className="text-amber-500" />}
      />
      <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
        {GIGS.map((gig) => {
          const availableAt = cooldowns[gig.id] ? new Date(cooldowns[gig.id]).getTime() : 0
          const onCooldown = now < availableAt
          const daysLeft = onCooldown ? Math.ceil((availableAt - now) / 86400000) : 0
          const flashing = flash[gig.id]

          return (
            <button
              key={gig.id}
              onClick={() => handleClaim(gig.id)}
              disabled={onCooldown}
              className={cn(
                'relative text-left rounded-2xl border-2 p-3 transition-all overflow-hidden',
                onCooldown
                  ? 'border-slate-100 bg-slate-50 opacity-70 cursor-not-allowed'
                  : 'border-amber-100 bg-amber-50/50 hover:border-amber-300 hover:shadow-sm active:scale-[0.98]',
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-2xl shrink-0">{gig.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-slate-800 truncate">{gig.label}</div>
                  <div className="text-xs text-slate-500 truncate">{gig.description}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-semibold text-amber-700">
                  {gig.minReward}–{gig.maxReward} €
                </span>
                <span
                  className={cn(
                    'text-xs font-bold',
                    onCooldown ? 'text-slate-400' : 'text-emerald-600',
                  )}
                >
                  {onCooldown ? `⏳ ${daysLeft} j` : 'Encaisser →'}
                </span>
              </div>

              {flashing && (
                <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/90 text-white font-display font-extrabold text-lg animate-pop-in">
                  {flashing}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
