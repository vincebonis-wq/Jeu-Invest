// ============================================================================
// "Missions express" — petites actions ponctuelles pour gagner un peu de cash.
// Récompenses volontairement modestes : un coup de pouce en début de partie,
// négligeable une fois riche. Chaque mission a un cooldown en jours de jeu.
// ============================================================================

export interface Gig {
  id: string
  emoji: string
  label: string
  description: string
  minReward: number
  maxReward: number
  cooldownDays: number
}

export const GIGS: Gig[] = [
  {
    id: 'vide_grenier',
    emoji: '📦',
    label: 'Vide-grenier',
    description: 'Vends des objets dont tu ne te sers plus.',
    minReward: 40,
    maxReward: 120,
    cooldownDays: 7,
  },
  {
    id: 'mission_freelance',
    emoji: '💻',
    label: 'Petite mission freelance',
    description: 'Une mission rapide le week-end.',
    minReward: 120,
    maxReward: 350,
    cooldownDays: 14,
  },
  {
    id: 'covoiturage',
    emoji: '🚗',
    label: 'Covoiturage',
    description: 'Rentabilise tes trajets.',
    minReward: 20,
    maxReward: 70,
    cooldownDays: 4,
  },
  {
    id: 'sondages',
    emoji: '📝',
    label: 'Sondages rémunérés',
    description: 'Quelques minutes pour un petit bonus.',
    minReward: 10,
    maxReward: 35,
    cooldownDays: 2,
  },
]

export const GIG_BY_ID: Record<string, Gig> = GIGS.reduce(
  (acc, g) => {
    acc[g.id] = g
    return acc
  },
  {} as Record<string, Gig>,
)
