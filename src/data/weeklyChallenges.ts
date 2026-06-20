import type { WeeklyChallenge, WeeklyChallengesState } from '../types'

// Seeded random for consistent leaderboard per day
function seededRand(seed: number): () => number {
  let s = seed
  return function () {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function daySeed(dateISO: string): number {
  return dateISO.split('-').reduce((acc, n) => acc * 100 + parseInt(n), 0)
}

const CHALLENGE_TEMPLATES = [
  {
    id: 'invest_day_1',
    label: 'Investisseur du jour',
    description: 'Investis {target}€ de nouveau capital aujourd\'hui',
    baseTarget: 500,
    targetScale: 'net_worth',
    rewardType: 'cash_bonus' as const,
    rewardValue: 300,
    rewardLabel: '+300€ cash',
  },
  {
    id: 'invest_day_2',
    label: 'Grand investissement',
    description: 'Investis {target}€ de nouveau capital aujourd\'hui',
    baseTarget: 2000,
    targetScale: 'net_worth',
    rewardType: 'cash_bonus' as const,
    rewardValue: 800,
    rewardLabel: '+800€ cash',
  },
  {
    id: 'earn_passive_day',
    label: 'Machine à cash',
    description: 'Génère {target}€ de revenus passifs aujourd\'hui',
    baseTarget: 100,
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
    id: 'buy_investments_day',
    label: 'Acheteur actif',
    description: "Réalise 2 achats d'investissements aujourd'hui",
    baseTarget: 2,
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
    id: 'hold_day',
    label: 'Investisseur zen',
    description: "Ne vends aucun actif aujourd'hui",
    baseTarget: 1,
    targetScale: 'none',
    rewardType: 'cash_bonus' as const,
    rewardValue: 200,
    rewardLabel: '+200€ cash',
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
  const dateISO = getTodayISO()
  const rand = seededRand(daySeed(dateISO) + Math.floor(netWorth / 10000))

  // Pick 3 unique templates
  const shuffled = [...CHALLENGE_TEMPLATES].sort(() => rand() - 0.5)
  const picked = shuffled.slice(0, 3)

  const challenges: WeeklyChallenge[] = picked.map((tpl) => {
    let target = tpl.baseTarget
    if (tpl.targetScale === 'net_worth') {
      target = Math.max(tpl.baseTarget, Math.round(netWorth * 0.003 / 100) * 100)
    } else if (tpl.targetScale === 'passive') {
      target = Math.max(tpl.baseTarget, Math.round(passiveIncome * 0.05 / 10) * 10)
    } else if (tpl.targetScale === 'milestone') {
      target = Math.max(tpl.baseTarget, Math.round(netWorth * 0.1 / 1000) * 1000)
    }

    return {
      id: `${tpl.id}_${dateISO}`,
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

  return { weekISO: dateISO, challenges, allClaimedBonus: false, claimedChallengeIds: [] }
}

export function getCurrentWeekISO(): string {
  return getTodayISO()
}

const FAKE_NAMES = [
  'Marie D.', 'Thomas B.', 'Sophie L.', 'Lucas M.', 'Emma R.',
  'Antoine C.', 'Camille F.', 'Jules P.', 'Léa V.', 'Hugo N.',
]

export function getSimulatedLeaderboard(playerNetWorth: number, dateISO: string): Array<{name: string, netWorth: number, isPlayer: boolean}> {
  const rand = seededRand(daySeed(dateISO))
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

