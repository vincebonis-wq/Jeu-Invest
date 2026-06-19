import type { WeeklyChallenge, WeeklyChallengesState } from '../types'

// Seeded random for consistent leaderboard per week
function seededRand(seed: number): () => number {
  let s = seed
  return function () {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function getWeekISO(): string {
  const d = new Date()
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diff)
  return monday.toISOString().split('T')[0]
}

function weekSeed(weekISO: string): number {
  return weekISO.split('-').reduce((acc, n) => acc * 100 + parseInt(n), 0)
}

const CHALLENGE_TEMPLATES = [
  {
    id: 'invest_week_1',
    label: 'Investisseur actif',
    description: 'Investis {target}€ de nouveau capital cette semaine',
    baseTarget: 1000,
    targetScale: 'net_worth',
    rewardType: 'cash_bonus' as const,
    rewardValue: 500,
    rewardLabel: '+500€ cash',
  },
  {
    id: 'invest_week_2',
    label: 'Grand investissement',
    description: 'Investis {target}€ de nouveau capital cette semaine',
    baseTarget: 5000,
    targetScale: 'net_worth',
    rewardType: 'cash_bonus' as const,
    rewardValue: 2000,
    rewardLabel: '+2 000€ cash',
  },
  {
    id: 'earn_passive_week',
    label: 'Machine à cash',
    description: 'Génère {target}€ de revenus passifs ce mois de jeu',
    baseTarget: 200,
    targetScale: 'passive',
    rewardType: 'return_bonus' as const,
    rewardValue: 0.1,
    rewardLabel: '+10% rendements 4h',
  },
  {
    id: 'reach_net_worth_1',
    label: 'Cap patrimoine',
    description: 'Atteins {target}€ de patrimoine net total',
    baseTarget: 10000,
    targetScale: 'milestone',
    rewardType: 'cash_bonus' as const,
    rewardValue: 1000,
    rewardLabel: '+1 000€ cash',
  },
  {
    id: 'buy_3_investments',
    label: 'Collectionneur',
    description: 'Réalise 3 achats d\'investissements cette semaine',
    baseTarget: 3,
    targetScale: 'none',
    rewardType: 'return_bonus' as const,
    rewardValue: 0.05,
    rewardLabel: '+5% rendements 4h',
  },
  {
    id: 'diversify_challenge',
    label: 'Diversification',
    description: 'Possède des actifs dans {target} classes différentes',
    baseTarget: 3,
    targetScale: 'none',
    rewardType: 'cash_bonus' as const,
    rewardValue: 800,
    rewardLabel: '+800€ cash',
  },
  {
    id: 'hold_week',
    label: 'Investisseur serein',
    description: 'Ne vends aucun actif pendant 7 jours de jeu',
    baseTarget: 7,
    targetScale: 'none',
    rewardType: 'cash_bonus' as const,
    rewardValue: 300,
    rewardLabel: '+300€ cash',
  },
  {
    id: 'passive_500',
    label: 'Rentier junior',
    description: 'Atteins 500€/mois de revenus passifs',
    baseTarget: 500,
    targetScale: 'none',
    rewardType: 'return_bonus' as const,
    rewardValue: 0.08,
    rewardLabel: '+8% rendements 4h',
  },
]

export function generateWeeklyChallenges(netWorth: number, passiveIncome: number): WeeklyChallengesState {
  const weekISO = getWeekISO()
  const rand = seededRand(weekSeed(weekISO) + Math.floor(netWorth / 10000))

  // Pick 3 unique templates
  const shuffled = [...CHALLENGE_TEMPLATES].sort(() => rand() - 0.5)
  const picked = shuffled.slice(0, 3)

  const challenges: WeeklyChallenge[] = picked.map((tpl) => {
    let target = tpl.baseTarget
    if (tpl.targetScale === 'net_worth') {
      target = Math.max(tpl.baseTarget, Math.round(netWorth * 0.02 / 500) * 500)
    } else if (tpl.targetScale === 'passive') {
      target = Math.max(tpl.baseTarget, Math.round(passiveIncome * 0.3 / 50) * 50)
    } else if (tpl.targetScale === 'milestone') {
      target = Math.max(tpl.baseTarget, Math.round(netWorth * 0.1 / 1000) * 1000)
    }

    return {
      id: `${tpl.id}_${weekISO}`,
      label: tpl.label,
      description: tpl.description.replace('{target}', target.toLocaleString('fr-FR')),
      target,
      progress: 0,
      completed: false,
      rewardType: tpl.rewardType,
      rewardValue: tpl.rewardValue,
      rewardLabel: tpl.rewardLabel,
    }
  })

  return { weekISO, challenges, allClaimedBonus: false, claimedChallengeIds: [] }
}

export function getCurrentWeekISO(): string {
  return getWeekISO()
}

const FAKE_NAMES = [
  'Marie D.', 'Thomas B.', 'Sophie L.', 'Lucas M.', 'Emma R.',
  'Antoine C.', 'Camille F.', 'Jules P.', 'Léa V.', 'Hugo N.',
]

export function getSimulatedLeaderboard(playerNetWorth: number, weekISO: string): Array<{name: string, netWorth: number, isPlayer: boolean}> {
  const rand = seededRand(weekSeed(weekISO))
  const base = Math.max(playerNetWorth * 0.5, 10000)

  const fakeEntries = FAKE_NAMES.map((name) => ({
    name,
    netWorth: Math.round(base * (0.4 + rand() * 1.6) / 100) * 100,
    isPlayer: false,
  }))

  const allEntries = [
    ...fakeEntries,
    { name: 'Toi', netWorth: playerNetWorth, isPlayer: true },
  ].sort((a, b) => b.netWorth - a.netWorth)

  return allEntries
}
