import { useState } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import type { Screen } from '../../types'

const STEPS = [
  {
    emoji: '👋',
    title: 'Bienvenue dans Patrimoine !',
    text: 'Tu pars de zéro et tu vas devenir rentier. Le temps s\'écoule en accéléré — chaque seconde = 1 jour de jeu.',
    action: null as Screen | null,
  },
  {
    emoji: '🏦',
    title: 'Étape 1 : Livret A',
    text: 'Mets ton cash sur le Livret A dès maintenant. C\'est ton filet de sécurité à 1,5%/an. Va dans "Investissements" → Livret A.',
    action: 'marketplace' as Screen,
  },
  {
    emoji: '🎓',
    title: 'Étape 2 : Se former',
    text: 'Va dans "Carrière" et démarre "Investissement 101" (2 mois, 200€). Ça débloque la bourse et l\'assurance vie.',
    action: 'skills' as Screen,
  },
  {
    emoji: '📈',
    title: 'Étape 3 : Croissance',
    text: 'Une fois formé, investis en ETF pour ~8%/an. Ton Livret A reste pour les urgences. L\'objectif : revenus passifs > salaire.',
    action: null as Screen | null,
  },
]

export function OnboardingGuide() {
  const game = useGameStore((s) => s.game)!
  const dismissOnboarding = useGameStore((s) => s.dismissOnboarding)
  const setScreen = useGameStore((s) => s.setScreen)
  const [step, setStep] = useState(0)

  if (game.hasSeenOnboarding) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-700 text-white p-4 relative">
      <button
        onClick={dismissOnboarding}
        className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
        aria-label="Fermer le guide"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <span className="text-3xl shrink-0">{current.emoji}</span>
        <div className="flex-1 min-w-0 pr-4">
          <div className="font-display font-bold text-lg mb-0.5">{current.title}</div>
          <p className="text-sm text-white/80 leading-relaxed">{current.text}</p>
          <div className="flex items-center gap-3 mt-3">
            {current.action && (
              <button
                onClick={() => {
                  setScreen(current.action as Screen)
                  if (isLast) dismissOnboarding()
                }}
                className="text-sm bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                Y aller →
              </button>
            )}
            <button
              onClick={() => {
                if (isLast) dismissOnboarding()
                else setStep((s) => s + 1)
              }}
              className="text-sm text-white/70 hover:text-white flex items-center gap-1"
            >
              {isLast ? 'Commencer' : 'Suivant'} <ChevronRight size={14} />
            </button>
            <div className="ml-auto flex gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-white' : 'bg-white/30'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
