import { useState, useEffect } from 'react'
import { useGameStore, selectCompletedChallenges } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { formatEuro, formatEuroCompact } from '../../utils/formatting'
import { getSimulatedLeaderboard, getCurrentWeekISO } from '../../data/weeklyChallenges'
import { QUEST_CHAINS } from '../../data/questChains'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Trophy, ChevronRight, CheckCircle2, Lock, Zap } from 'lucide-react'
import { cn } from '../../utils/formatting'
import type { ChallengeDifficulty } from '../../types'

function DifficultyBadge({ difficulty }: { difficulty?: ChallengeDifficulty }) {
  if (!difficulty) return null
  const map = {
    easy: { label: 'Facile', cls: 'bg-emerald-50 text-emerald-600' },
    medium: { label: 'Moyen', cls: 'bg-amber-50 text-amber-600' },
    hard: { label: 'Difficile', cls: 'bg-red-50 text-red-600' },
  }
  const { label, cls } = map[difficulty]
  return (
    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide', cls)}>
      {label}
    </span>
  )
}

function formatBonusTime(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function WeeklyChallenges() {
  const game = useGameStore((s) => s.game)!
  const claimChallengeReward = useGameStore((s) => s.claimChallengeReward)
  const claimComboBonus = useGameStore((s) => s.claimComboBonus)
  const claimQuestStepReward = useGameStore((s) => s.claimQuestStepReward)
  useGameStore(selectCompletedChallenges)
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
  const bonusSecsLeft = bonusActive
    ? Math.max(0, Math.round(((wc?.bonusActiveUntilReal ?? 0) - now) / 1000))
    : 0

  if (!wc) {
    return (
      <div className="text-center text-slate-400 py-12">
        Chargement des défis...
      </div>
    )
  }

  const allCompleted = wc.challenges.every((c) => c.completed)
  const claimedIds = new Set(wc.claimedChallengeIds)
  const comboBonus = Math.round(Math.max(2000, netWorth * 0.005))
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-6 animate-screen-in">
      {/* Header */}
      <div>
        <h1 className="font-display font-extrabold text-2xl text-slate-800">Défis & Campagnes</h1>
        <p className="text-slate-500 text-sm">Défis réinitialisés chaque jour · Campagnes permanentes</p>
      </div>

      {/* Bonus actif */}
      {bonusActive && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-300 flex items-center gap-3">
          <Zap size={22} className="text-violet-500 shrink-0" />
          <div>
            <div className="font-bold text-violet-800">Bonus de rendement actif !</div>
            <div className="text-sm text-violet-600">Expire dans {formatBonusTime(bonusSecsLeft)}</div>
          </div>
        </div>
      )}

      {/* ── Défis du jour ── */}
      <section>
        <h2 className="font-display font-bold text-lg text-slate-700 mb-3">⚡ Défis du jour</h2>
        <div className="space-y-3">
          {wc.challenges.map((ch) => {
            const pct = Math.min(100, ch.target > 0 ? (ch.progress / ch.target) * 100 : 0)
            const claimed = claimedIds.has(ch.id)
            return (
              <Card key={ch.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-display font-bold text-slate-800">{ch.label}</span>
                      <DifficultyBadge difficulty={ch.difficulty} />
                      {ch.completed && (
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          ✓ Complété
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mb-3">{ch.description}</p>
                    <div className="h-2 rounded-full bg-slate-100 mb-1">
                      <div
                        className={cn(
                          'h-2 rounded-full transition-all',
                          ch.completed ? 'bg-green-500' : 'bg-brand-500',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>
                        {ch.target <= 10
                          ? `${Math.min(ch.progress, ch.target)} / ${ch.target}`
                          : `${formatEuroCompact(Math.min(ch.progress, ch.target))} / ${formatEuroCompact(ch.target)}`}
                      </span>
                      <span className="font-semibold text-violet-600">{ch.rewardLabel}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {ch.completed && !claimed && (
                      <Button variant="primary" onClick={() => claimChallengeReward(ch.id)}>
                        Réclamer
                      </Button>
                    )}
                    {claimed && <span className="text-green-500 font-bold text-sm">Réclamé ✓</span>}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Bonus 3/3 */}
      {allCompleted && (
        <Card className={cn(
          'p-5 border-2',
          wc.comboClaimed
            ? 'bg-slate-50 border-slate-200'
            : 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300',
        )}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Trophy size={24} className={wc.comboClaimed ? 'text-slate-400' : 'text-yellow-500'} />
              <div>
                <div className="font-display font-bold text-slate-800">
                  Champion 3/3 !
                </div>
                <div className="text-sm text-slate-600">
                  {wc.comboClaimed
                    ? 'Bonus déjà réclamé aujourd\'hui'
                    : `+${formatEuro(comboBonus)} cash + 8h de bonus rendements`}
                </div>
              </div>
            </div>
            {!wc.comboClaimed && (
              <Button variant="primary" onClick={claimComboBonus}>
                Réclamer
              </Button>
            )}
            {wc.comboClaimed && (
              <CheckCircle2 size={22} className="text-slate-400 shrink-0" />
            )}
          </div>
        </Card>
      )}

      {/* ── Campagnes ── */}
      <section>
        <h2 className="font-display font-bold text-lg text-slate-700 mb-3">🗺️ Campagnes</h2>
        <div className="space-y-4">
          {QUEST_CHAINS.map((chain) => {
            const progress = (game.questProgress ?? []).find((p) => p.chainId === chain.id)
            if (!progress) return null
            const completedCount = progress.claimedStepIndices.length
            const totalSteps = chain.steps.length
            const isFullyDone = completedCount >= totalSteps
            const pct = (completedCount / totalSteps) * 100

            return (
              <Card key={chain.id} className="p-5">
                {/* Chain header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{chain.emoji}</span>
                      <span className="font-display font-bold text-slate-800">{chain.title}</span>
                      {isFullyDone && (
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          ✓ Complété
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 ml-7">{chain.description}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-500 shrink-0">
                    {completedCount}/{totalSteps}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-slate-100 mb-4">
                  <div
                    className="h-1.5 rounded-full bg-brand-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  {chain.steps.map((step, idx) => {
                    const isClaimed = progress.claimedStepIndices.includes(idx)
                    const isClaimable = progress.claimableStepIndex === idx
                    const isActive = progress.nextStepIndex === idx && !isClaimable
                    const isLocked = idx > (progress.nextStepIndex ?? 0) && !isClaimed && !isClaimable

                    return (
                      <div
                        key={step.id}
                        className={cn(
                          'rounded-xl p-3 flex items-start gap-3',
                          isClaimed && 'bg-green-50',
                          isClaimable && 'bg-amber-50 border border-amber-200',
                          isActive && 'bg-slate-50 border border-slate-200',
                          isLocked && 'opacity-50',
                        )}
                      >
                        <div className="shrink-0 mt-0.5">
                          {isClaimed ? (
                            <CheckCircle2 size={18} className="text-green-500" />
                          ) : isClaimable ? (
                            <span className="text-lg leading-none">🎁</span>
                          ) : isActive ? (
                            <ChevronRight size={18} className="text-brand-500" />
                          ) : (
                            <Lock size={16} className="text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-slate-800">{step.label}</div>
                          {(isActive || isClaimable) && (
                            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{step.narrative}</p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className={cn(
                            'text-xs font-bold',
                            isClaimed ? 'text-green-600' : 'text-emerald-600',
                          )}>
                            +{formatEuroCompact(step.rewardCash)}
                          </span>
                          {isClaimable && (
                            <Button
                              variant="primary"
                              onClick={() => claimQuestStepReward(chain.id, idx)}
                            >
                              Réclamer
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Leaderboard */}
      <Card className="p-5">
        <CardHeader
          title="Classement du jour"
          subtitle="Joueurs simulés basés sur ton patrimoine"
          icon={<Trophy size={18} />}
        />
        <div className="space-y-2 mt-3">
          {leaderboard.map((entry, idx) => (
            <div
              key={entry.name}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl',
                entry.isPlayer ? 'bg-brand-50 border border-brand-200' : 'bg-slate-50',
              )}
            >
              <div className="w-6 text-center font-bold text-sm">
                {idx < 3 ? medals[idx] : `#${idx + 1}`}
              </div>
              <div className={cn('flex-1 font-semibold text-sm', entry.isPlayer ? 'text-brand-700' : 'text-slate-700')}>
                {entry.name}
                {entry.isPlayer && <span className="ml-2 text-xs text-brand-500">(toi)</span>}
              </div>
              <div className={cn('font-bold text-sm', entry.isPlayer ? 'text-brand-700' : 'text-slate-600')}>
                {formatEuroCompact(entry.netWorth)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
