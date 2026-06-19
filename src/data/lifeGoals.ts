import type { LifeGoal, LifeGoalId } from '../types'

// ============================================================================
// Objectifs de vie — choisis à la création du personnage.
// Ils donnent un sens aux nombres et créent une deadline émotionnelle :
// une cible de patrimoine à atteindre AVANT un certain nombre de mois de jeu.
// ============================================================================

export const LIFE_GOALS: LifeGoal[] = [
  {
    id: 'early_retirement',
    title: 'Retraite anticipée',
    emoji: '🏝️',
    tagline: 'Arrêter de travailler à 45 ans',
    description:
      'Tu veux la liberté totale : ne plus jamais dépendre d\'un salaire. Atteins un patrimoine qui génère assez de revenus passifs pour vivre, avant qu\'il ne soit trop tard.',
    targetNetWorth: 500_000,
    deadlineMonths: 240, // 20 ans de jeu
    successMessage:
      'Tu as atteint l\'indépendance financière avant 45 ans. Le réveil ne sonnera plus jamais pour le travail.',
  },
  {
    id: 'kids_education',
    title: 'Études des enfants',
    emoji: '🎓',
    tagline: 'Offrir le meilleur avenir à tes enfants',
    description:
      'Tu veux financer les études supérieures de tes enfants sans qu\'ils s\'endettent. Constitue un capital solide en 15 ans, le temps qu\'ils grandissent.',
    targetNetWorth: 250_000,
    deadlineMonths: 180, // 15 ans de jeu
    successMessage:
      'Le capital études est sécurisé. Tes enfants pourront étudier l\'esprit libre, sans dette.',
  },
  {
    id: 'beach_house',
    title: 'Maison au bord de mer',
    emoji: '🏖️',
    tagline: 'La résidence de tes rêves',
    description:
      'Une grande maison face à l\'océan, payée comptant. Un symbole de réussite tangible. Vise un patrimoine confortable en 12 ans.',
    targetNetWorth: 400_000,
    deadlineMonths: 144, // 12 ans de jeu
    successMessage:
      'Les clés de la maison au bord de mer sont à toi. Le bruit des vagues, tous les matins.',
  },
  {
    id: 'family_legacy',
    title: 'Transmettre un héritage',
    emoji: '👑',
    tagline: 'Bâtir une fortune qui traverse les générations',
    description:
      'Ton ambition dépasse ta propre vie : construire un patrimoine d\'un million d\'euros à transmettre. Un projet de long terme, exigeant mais inoubliable.',
    targetNetWorth: 1_000_000,
    deadlineMonths: 300, // 25 ans de jeu
    successMessage:
      'Un million d\'euros bâti de tes mains. Ton nom restera associé à la réussite, pour les générations suivantes.',
  },
]

export const LIFE_GOAL_BY_ID: Record<LifeGoalId, LifeGoal> = LIFE_GOALS.reduce(
  (acc, g) => {
    acc[g.id] = g
    return acc
  },
  {} as Record<LifeGoalId, LifeGoal>,
)

export function getLifeGoal(id: LifeGoalId | undefined): LifeGoal | null {
  if (!id) return null
  return LIFE_GOAL_BY_ID[id] ?? null
}
