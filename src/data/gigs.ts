// ============================================================================
// "Missions express" — petites actions ponctuelles pour gagner un peu de cash.
// Récompenses volontairement modestes : un coup de pouce en début de partie,
// négligeable une fois riche. Le cooldown est en TEMPS RÉEL (horloge du joueur),
// indépendant de la vitesse de jeu — impossible de le contourner en passant en x50.
// ============================================================================

const HOUR = 3_600_000

export interface Gig {
  id: string
  emoji: string
  label: string
  description: string
  minReward: number
  maxReward: number
  cooldownHours: number // temps réel
}

export const GIGS: Gig[] = [
  {
    id: 'sondages',
    emoji: '📝',
    label: 'Sondages rémunérés',
    description: 'Quelques minutes pour un petit bonus.',
    minReward: 8,
    maxReward: 25,
    cooldownHours: 3,
  },
  {
    id: 'covoiturage',
    emoji: '🚗',
    label: 'Covoiturage',
    description: 'Rentabilise tes trajets du quotidien.',
    minReward: 15,
    maxReward: 50,
    cooldownHours: 8,
  },
  {
    id: 'vide_grenier',
    emoji: '📦',
    label: 'Vide-grenier',
    description: 'Vends des objets dont tu ne te sers plus.',
    minReward: 30,
    maxReward: 90,
    cooldownHours: 24,
  },
  {
    id: 'mission_freelance',
    emoji: '💻',
    label: 'Petite mission freelance',
    description: 'Une mission rapide le week-end.',
    minReward: 80,
    maxReward: 220,
    cooldownHours: 48,
  },
  {
    id: 'consulting_express',
    emoji: '💼',
    label: 'Consulting express',
    description: 'Une journée de conseil pour un client ponctuel. Nécessite de l\'expérience.',
    minReward: 200,
    maxReward: 450,
    cooldownHours: 96,
  },
]

export const GIG_BY_ID: Record<string, Gig> = GIGS.reduce(
  (acc, g) => {
    acc[g.id] = g
    return acc
  },
  {} as Record<string, Gig>,
)

export const GIG_COOLDOWN_MS: Record<string, number> = GIGS.reduce(
  (acc, g) => {
    acc[g.id] = g.cooldownHours * HOUR
    return acc
  },
  {} as Record<string, number>,
)
