import type { WeeklyChallenge, WeeklyChallengesState, ChallengeDifficulty } from '../types'

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

interface ChallengeTemplate {
  id: string
  label: string
  description: string
  baseTarget: number
  targetScale: 'net_worth' | 'passive' | 'milestone' | 'none'
  rewardType: 'cash_bonus' | 'return_bonus'
  rewardValue: number
  rewardLabel: string
  difficulty: ChallengeDifficulty
}

const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  // ── EASY ────────────────────────────────────────────────────────────────────
  {
    id: 'hold_day',
    label: 'Investisseur zen',
    description: "Ne vends aucun actif aujourd'hui",
    baseTarget: 1,
    targetScale: 'none',
    rewardType: 'cash_bonus',
    rewardValue: 250,
    rewardLabel: '+250€ cash',
    difficulty: 'easy',
  },
  {
    id: 'buy_investments_day',
    label: 'Acheteur actif',
    description: "Réalise 2 achats d'investissements aujourd'hui",
    baseTarget: 2,
    targetScale: 'none',
    rewardType: 'return_bonus',
    rewardValue: 0.05,
    rewardLabel: '+5% rendements 4h',
    difficulty: 'easy',
  },
  {
    id: 'invest_day_1',
    label: 'Investisseur du jour',
    description: "Investis {target}€ de nouveau capital aujourd'hui",
    baseTarget: 500,
    targetScale: 'net_worth',
    rewardType: 'cash_bonus',
    rewardValue: 350,
    rewardLabel: '+350€ cash',
    difficulty: 'easy',
  },
  {
    id: 'diversify_2',
    label: 'Duo d\'actifs',
    description: "Possède des actifs dans 2 classes différentes",
    baseTarget: 2,
    targetScale: 'none',
    rewardType: 'cash_bonus',
    rewardValue: 400,
    rewardLabel: '+400€ cash',
    difficulty: 'easy',
  },
  {
    id: 'save_cash_buffer',
    label: 'Fonds de sécurité',
    description: "Maintiens {target}€ de cash disponible",
    baseTarget: 1000,
    targetScale: 'net_worth',
    rewardType: 'cash_bonus',
    rewardValue: 300,
    rewardLabel: '+300€ cash',
    difficulty: 'easy',
  },

  // ── MEDIUM ───────────────────────────────────────────────────────────────────
  {
    id: 'invest_day_2',
    label: 'Grand investissement',
    description: "Investis {target}€ de nouveau capital aujourd'hui",
    baseTarget: 2000,
    targetScale: 'net_worth',
    rewardType: 'cash_bonus',
    rewardValue: 900,
    rewardLabel: '+900€ cash',
    difficulty: 'medium',
  },
  {
    id: 'earn_passive_day',
    label: 'Machine à cash',
    description: "Génère {target}€ de revenus passifs ce mois",
    baseTarget: 100,
    targetScale: 'passive',
    rewardType: 'return_bonus',
    rewardValue: 0.1,
    rewardLabel: '+10% rendements 4h',
    difficulty: 'medium',
  },
  {
    id: 'diversify_challenge',
    label: 'Trilogie d\'actifs',
    description: "Possède des actifs dans {target} classes différentes",
    baseTarget: 3,
    targetScale: 'none',
    rewardType: 'cash_bonus',
    rewardValue: 800,
    rewardLabel: '+800€ cash',
    difficulty: 'medium',
  },
  {
    id: 'upgrade_investment',
    label: 'Évolution du portefeuille',
    description: "Améliore un placement au niveau 2 ou plus",
    baseTarget: 1,
    targetScale: 'none',
    rewardType: 'cash_bonus',
    rewardValue: 700,
    rewardLabel: '+700€ cash',
    difficulty: 'medium',
  },
  {
    id: 'reach_net_worth_1',
    label: 'Cap patrimoine',
    description: "Atteins {target}€ de patrimoine net total",
    baseTarget: 10000,
    targetScale: 'milestone',
    rewardType: 'cash_bonus',
    rewardValue: 1200,
    rewardLabel: '+1 200€ cash',
    difficulty: 'medium',
  },
  {
    id: 'invest_etf',
    label: 'Entrée en bourse',
    description: "Investis dans un ETF aujourd'hui",
    baseTarget: 1,
    targetScale: 'none',
    rewardType: 'return_bonus',
    rewardValue: 0.08,
    rewardLabel: '+8% rendements 4h',
    difficulty: 'medium',
  },
  {
    id: 'three_investments',
    label: 'Trio gagnant',
    description: "Possède 3 placements actifs simultanément",
    baseTarget: 3,
    targetScale: 'none',
    rewardType: 'cash_bonus',
    rewardValue: 600,
    rewardLabel: '+600€ cash',
    difficulty: 'medium',
  },

  // ── HARD ────────────────────────────────────────────────────────────────────
  {
    id: 'passive_500',
    label: 'Rentier junior',
    description: "Atteins 500€/mois de revenus passifs",
    baseTarget: 500,
    targetScale: 'none',
    rewardType: 'return_bonus',
    rewardValue: 0.08,
    rewardLabel: '+8% rendements 4h',
    difficulty: 'hard',
  },
  {
    id: 'passive_1000',
    label: 'Rentier confirmé',
    description: "Atteins 1 000€/mois de revenus passifs",
    baseTarget: 1000,
    targetScale: 'none',
    rewardType: 'return_bonus',
    rewardValue: 0.15,
    rewardLabel: '+15% rendements 6h',
    difficulty: 'hard',
  },
  {
    id: 'five_investments',
    label: 'Portefeuille expert',
    description: "Possède 5 placements actifs simultanément",
    baseTarget: 5,
    targetScale: 'none',
    rewardType: 'cash_bonus',
    rewardValue: 1500,
    rewardLabel: '+1 500€ cash',
    difficulty: 'hard',
  },
  {
    id: 'diversify_4classes',
    label: 'Maître de la diversification',
    description: "Répartis ton patrimoine sur 4 classes d'actifs",
    baseTarget: 4,
    targetScale: 'none',
    rewardType: 'cash_bonus',
    rewardValue: 2000,
    rewardLabel: '+2 000€ cash',
    difficulty: 'hard',
  },
  {
    id: 'big_invest_day',
    label: 'Mise de roi',
    description: "Investis {target}€ en une seule journée",
    baseTarget: 10000,
    targetScale: 'net_worth',
    rewardType: 'cash_bonus',
    rewardValue: 2500,
    rewardLabel: '+2 500€ cash',
    difficulty: 'hard',
  },
  {
    id: 'passive_ratio_50',
    label: 'Semi-rentier',
    description: "Tes revenus passifs atteignent 50% de ton salaire",
    baseTarget: 50,
    targetScale: 'none',
    rewardType: 'return_bonus',
    rewardValue: 0.12,
    rewardLabel: '+12% rendements 6h',
    difficulty: 'hard',
  },
]

export function generateWeeklyChallenges(netWorth: number, passiveIncome: number, salary = 0): WeeklyChallengesState {
  const dateISO = getTodayISO()
  const rand = seededRand(daySeed(dateISO) + Math.floor(netWorth / 10000))

  // Pick 1 easy + 1 medium + 1 hard for a balanced day
  const easy = CHALLENGE_TEMPLATES.filter((t) => t.difficulty === 'easy')
  const medium = CHALLENGE_TEMPLATES.filter((t) => t.difficulty === 'medium')
  const hard = CHALLENGE_TEMPLATES.filter((t) => t.difficulty === 'hard')

  function pickOne(pool: ChallengeTemplate[]): ChallengeTemplate {
    const shuffled = [...pool].sort(() => rand() - 0.5)
    return shuffled[0]
  }

  const picked = [pickOne(easy), pickOne(medium), pickOne(hard)]

  const challenges: WeeklyChallenge[] = picked.map((tpl) => {
    let target = tpl.baseTarget
    let rewardValue = tpl.rewardValue

    if (tpl.targetScale === 'net_worth') {
      target = Math.max(tpl.baseTarget, Math.round((netWorth * 0.05) / 100) * 100)
    } else if (tpl.targetScale === 'passive') {
      target = Math.max(tpl.baseTarget, Math.round(passiveIncome * 0.3 / 10) * 10)
    } else if (tpl.targetScale === 'milestone') {
      target = Math.max(tpl.baseTarget, Math.round((netWorth * 0.2) / 1000) * 1000)
    }

    // Passive ratio challenge: target = 50% of salary
    if (tpl.id === 'passive_ratio_50' && salary > 0) {
      target = Math.round(salary * 0.5)
    }

    // Scale cash rewards with net worth (slightly)
    if (tpl.rewardType === 'cash_bonus' && netWorth > 50000) {
      rewardValue = Math.round(tpl.rewardValue * (1 + netWorth / 500000))
    }

    const rewardLabel = tpl.rewardType === 'cash_bonus'
      ? `+${Math.round(rewardValue).toLocaleString('fr-FR')}€ cash`
      : tpl.rewardLabel

    return {
      id: `${tpl.id}_${dateISO}`,
      label: tpl.label,
      description: tpl.description.replace('{target}', target.toLocaleString('fr-FR')),
      target,
      progress: 0,
      completed: false,
      rewardType: tpl.rewardType,
      rewardValue,
      rewardLabel,
      difficulty: tpl.difficulty,
    }
  })

  return {
    weekISO: dateISO,
    challenges,
    allClaimedBonus: false,
    claimedChallengeIds: [],
    comboClaimed: false,
  }
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
