import { X, Check, Lock, ChevronRight, Sparkles } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { milestoneRank } from '../../utils/calculations'
import type { GameState, Screen } from '../../types'

interface QuestStep {
  id: string
  emoji: string
  title: string
  text: string
  screen: Screen | null
  ctaLabel: string
  isDone: (game: GameState) => boolean
}

const STEPS: QuestStep[] = [
  {
    id: 'livret',
    emoji: '🏦',
    title: 'Sécurise ton épargne',
    text: 'Place ton cash sur le Livret A : 1,5 %/an, disponible à tout moment, zéro impôt.',
    screen: 'marketplace',
    ctaLabel: 'Investir',
    isDone: (g) => g.investments.some((i) => i.catalogId === 'livret'),
  },
  {
    id: 'formation',
    emoji: '🎓',
    title: 'Lance ta première formation',
    text: 'Va dans "Carrière" et démarre une formation pour débloquer de meilleurs placements et booster ton salaire.',
    screen: 'skills',
    ctaLabel: 'Se former',
    isDone: (g) => Boolean(g.player.activeTraining) || g.player.learnedSkillIds.length > 0,
  },
  {
    id: 'diversifier',
    emoji: '📊',
    title: 'Diversifie ton portefeuille',
    text: 'Ajoute un deuxième type de placement (assurance vie, ETF...) pour répartir le risque.',
    screen: 'marketplace',
    ctaLabel: 'Investir',
    isDone: (g) => new Set(g.investments.map((i) => i.catalogId)).size >= 2,
  },
  {
    id: 'mission',
    emoji: '💼',
    title: 'Tente une mission express',
    text: "Sur le tableau de bord, lance une mission rapide pour gagner un peu d'argent en plus.",
    screen: 'dashboard',
    ctaLabel: 'Voir les missions',
    isDone: (g) => Object.keys(g.gigCooldowns ?? {}).length > 0,
  },
  {
    id: 'palier',
    emoji: '🚀',
    title: 'Atteins ton premier palier',
    text: 'Fais grandir ton patrimoine net jusqu\'à 10 000 € pour devenir "Épargnant".',
    screen: null,
    ctaLabel: '',
    isDone: (g) => milestoneRank(g.player.milestone) >= milestoneRank('epargnant'),
  },
]

export function OnboardingGuide() {
  const game = useGameStore((s) => s.game)!
  const dismissOnboarding = useGameStore((s) => s.dismissOnboarding)
  const setScreen = useGameStore((s) => s.setScreen)

  if (game.hasSeenOnboarding) return null

  const doneFlags = STEPS.map((step) => step.isDone(game))
  const doneCount = doneFlags.filter(Boolean).length
  const allDone = doneCount === STEPS.length
  const currentIndex = doneFlags.findIndex((d) => !d)

  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white p-4 relative">
      <button
        onClick={dismissOnboarding}
        className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
        aria-label="Fermer le guide"
      >
        <X size={16} />
      </button>

      <div className="flex items-center justify-between mb-3 pr-6">
        <div className="font-display font-bold text-base flex items-center gap-1.5">
          <Sparkles size={16} className="text-amber-300" /> Guide de démarrage
        </div>
        <span className="text-xs font-semibold text-white/70">
          {doneCount} / {STEPS.length}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mb-3">
        <div
          className="h-full bg-amber-300 rounded-full transition-all duration-500"
          style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
        />
      </div>

      {allDone ? (
        <div className="flex items-center justify-between gap-3 bg-white/10 rounded-xl px-3 py-2.5">
          <p className="text-sm text-white/90">
            🎉 Bravo, tu maîtrises les bases ! Continue à faire grandir ton patrimoine.
          </p>
          <button
            onClick={dismissOnboarding}
            className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            Terminé
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {STEPS.map((step, i) => {
            const done = doneFlags[i]
            const isCurrent = i === currentIndex
            const locked = !done && !isCurrent

            if (done) {
              return (
                <div key={step.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-white/60">
                  <span className="w-5 h-5 rounded-full bg-emerald-400/90 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-emerald-900" />
                  </span>
                  <span className="line-through">{step.title}</span>
                </div>
              )
            }

            if (locked) {
              return (
                <div key={step.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-white/40">
                  <Lock size={13} className="shrink-0" />
                  <span>{step.title}</span>
                </div>
              )
            }

            return (
              <div key={step.id} className="bg-white/10 rounded-xl p-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-2xl shrink-0">{step.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-sm mb-0.5">{step.title}</div>
                    <p className="text-xs text-white/80 leading-relaxed">{step.text}</p>
                    {step.screen && (
                      <button
                        onClick={() => setScreen(step.screen as Screen)}
                        className="mt-2 text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                      >
                        {step.ctaLabel} <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
