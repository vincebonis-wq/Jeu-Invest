import { Brain, AlertTriangle } from 'lucide-react'
import type { GameState } from '../../types'
import { Card } from '../ui/Card'
import { ProgressBar } from '../ui/ProgressBar'
import {
  calcGoalProgress,
  buildBehaviorInsights,
} from '../../utils/strategy'
import { formatEuroCompact, cn } from '../../utils/formatting'

// ============================================================================
// Cartes stratégiques du Dashboard : objectif de vie + miroir comportemental.
// ============================================================================

export function LifeGoalCard({ game }: { game: GameState }) {
  const goal = calcGoalProgress(game)
  if (!goal.hasGoal) return null

  const yearsLeft = Math.floor(goal.monthsRemaining / 12)
  const monthsLeftRem = goal.monthsRemaining % 12
  const deadlinePassed = goal.monthsRemaining <= 0
  const achieved = goal.progressPct >= 100

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl shrink-0">{goal.emoji}</span>
          <div className="min-w-0">
            <div className="font-display font-bold text-slate-800 text-sm truncate">
              Objectif : {goal.title}
            </div>
            <div className="text-xs text-slate-400 truncate">{goal.tagline}</div>
          </div>
        </div>
        <span className="font-display font-bold text-brand-600 shrink-0">
          {Math.round(goal.progressPct)}%
        </span>
      </div>

      <ProgressBar
        value={goal.progressPct}
        shimmer={!achieved}
        barClassName={cn(
          achieved
            ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
            : goal.onTrack
              ? 'bg-gradient-to-r from-brand-400 to-brand-600'
              : 'bg-gradient-to-r from-amber-400 to-orange-500',
        )}
      />

      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-slate-500">
          {formatEuroCompact(goal.currentNetWorth)} / {formatEuroCompact(goal.targetNetWorth)}
        </span>
        {achieved ? (
          <span className="font-semibold text-emerald-600">🎉 Objectif atteint !</span>
        ) : deadlinePassed ? (
          <span className="font-semibold text-red-500">Échéance dépassée</span>
        ) : (
          <span className={cn('font-semibold', goal.onTrack ? 'text-emerald-600' : 'text-amber-600')}>
            {goal.onTrack ? '✓ Dans les temps' : '⚠ En retard'} ·{' '}
            {yearsLeft > 0 ? `${yearsLeft} an${yearsLeft > 1 ? 's' : ''} ` : ''}
            {monthsLeftRem > 0 || yearsLeft === 0 ? `${monthsLeftRem} mois` : ''} restants
          </span>
        )}
      </div>

      {goal.coachTip && !achieved && (
        <div className={cn(
          'mt-3 p-2.5 rounded-xl text-xs leading-snug',
          goal.onTrack ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
        )}>
          {goal.coachTip}
        </div>
      )}
    </Card>
  )
}

export function BehaviorMirrorCard({ game }: { game: GameState }) {
  const insights = buildBehaviorInsights(game)
  if (insights.length === 0) return null

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
          <Brain size={18} />
        </div>
        <div>
          <div className="font-display font-bold text-slate-800 text-sm">Ton miroir</div>
          <div className="text-xs text-slate-400">Ce que tes décisions révèlent</div>
        </div>
      </div>

      <div className="space-y-2.5">
        {insights.map((ins) => (
          <div
            key={ins.id}
            className={cn(
              'flex items-start gap-2.5 p-3 rounded-2xl text-sm',
              ins.tone === 'warning' && 'bg-amber-50 text-amber-800',
              ins.tone === 'positive' && 'bg-emerald-50 text-emerald-800',
              ins.tone === 'neutral' && 'bg-slate-50 text-slate-600',
            )}
          >
            <span className="text-base shrink-0 leading-tight mt-0.5">
              {ins.tone === 'warning' ? <AlertTriangle size={16} /> : ins.emoji}
            </span>
            <span className="leading-snug">{ins.text}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
