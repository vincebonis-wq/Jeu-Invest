import { useState, useEffect } from 'react'
import { useGameStore, selectCompletedChallenges } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { formatEuroCompact } from '../../utils/formatting'
import { getSimulatedLeaderboard, getCurrentWeekISO } from '../../data/weeklyChallenges'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Trophy } from 'lucide-react'

export function WeeklyChallenges() {
  const game = useGameStore((s) => s.game)!
  const claimChallengeReward = useGameStore((s) => s.claimChallengeReward)
  useGameStore(selectCompletedChallenges) // subscribe for updates
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const wc = game.weeklyChallenges
  const netWorth = calcNetWorth(game)
  const weekISO = getCurrentWeekISO()
  const leaderboard = getSimulatedLeaderboard(netWorth, weekISO)

  const bonusActive = wc?.bonusActiveUntilReal ? wc.bonusActiveUntilReal > now : false
  const bonusSecsLeft = bonusActive ? Math.max(0, Math.round(((wc?.bonusActiveUntilReal ?? 0) - now) / 1000)) : 0

  if (!wc) {
    return (
      <div className="text-center text-slate-400 py-12">
        Chargement des défis...
      </div>
    )
  }

  const allCompleted = wc.challenges.every(c => c.completed)
  const claimedIds = new Set(wc.claimedChallengeIds)

  function formatBonusTime(secs: number) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-4 animate-screen-in">
      {/* Header */}
      <div>
        <h1 className="font-display font-extrabold text-2xl text-slate-800">Défis de la semaine</h1>
        <p className="text-slate-500 text-sm">Réinitialisés chaque lundi</p>
      </div>

      {/* Bonus actif */}
      {bonusActive && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-300 flex items-center gap-3">
          <div className="text-2xl">⚡</div>
          <div>
            <div className="font-bold text-violet-800">Bonus de rendement actif !</div>
            <div className="text-sm text-violet-600">Expire dans {formatBonusTime(bonusSecsLeft)}</div>
          </div>
        </div>
      )}

      {/* 3 challenges */}
      <div className="space-y-3">
        {wc.challenges.map((ch) => {
          const pct = Math.min(100, ch.target > 0 ? (ch.progress / ch.target) * 100 : 0)
          const claimed = claimedIds.has(ch.id)
          return (
            <Card key={ch.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-display font-bold text-slate-800">{ch.label}</span>
                    {ch.completed && (
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        ✓ Complété
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mb-3">{ch.description}</p>
                  {/* Progress bar */}
                  <div className="h-2 rounded-full bg-slate-100 mb-1">
                    <div
                      className={`h-2 rounded-full transition-all ${ch.completed ? 'bg-green-500' : 'bg-brand-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>
                      {ch.target <= 10
                        ? `${Math.min(ch.progress, ch.target)} / ${ch.target}`
                        : `${formatEuroCompact(Math.min(ch.progress, ch.target))} / ${formatEuroCompact(ch.target)}`
                      }
                    </span>
                    <span className="font-semibold text-violet-600">{ch.rewardLabel}</span>
                  </div>
                </div>
                {ch.completed && !claimed && (
                  <Button
                    variant="primary"
                    onClick={() => claimChallengeReward(ch.id)}
                  >
                    Réclamer
                  </Button>
                )}
                {claimed && (
                  <span className="text-green-500 font-bold text-sm shrink-0">Réclamé ✓</span>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Bonus 3/3 */}
      {allCompleted && (
        <Card className="p-5 bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300">
          <div className="flex items-center gap-3">
            <Trophy size={24} className="text-yellow-500" />
            <div>
              <div className="font-display font-bold text-slate-800">3/3 Complétés — Bonus spécial !</div>
              <div className="text-sm text-slate-600">Tu as relevé tous les défis de la semaine. Champion !</div>
            </div>
          </div>
        </Card>
      )}

      {/* Leaderboard */}
      <Card className="p-5">
        <CardHeader title="Classement cette semaine" subtitle="Joueurs simulés basés sur ton patrimoine" icon={<Trophy size={18} />} />
        <div className="space-y-2 mt-3">
          {leaderboard.map((entry, idx) => (
            <div
              key={entry.name}
              className={`flex items-center gap-3 p-3 rounded-xl ${
                entry.isPlayer
                  ? 'bg-brand-50 border border-brand-200'
                  : 'bg-slate-50'
              }`}
            >
              <div className="w-6 text-center font-bold text-sm">
                {idx < 3 ? medals[idx] : `#${idx + 1}`}
              </div>
              <div className={`flex-1 font-semibold text-sm ${entry.isPlayer ? 'text-brand-700' : 'text-slate-700'}`}>
                {entry.name}
                {entry.isPlayer && <span className="ml-2 text-xs text-brand-500">(toi)</span>}
              </div>
              <div className={`font-bold text-sm ${entry.isPlayer ? 'text-brand-700' : 'text-slate-600'}`}>
                {formatEuroCompact(entry.netWorth)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
