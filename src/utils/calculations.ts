import type {
  AssetBreakdown,
  GameState,
  Investment,
  InvestmentCategory,
  MilestoneLevel,
} from '../types'
import { getCatalogItem } from '../data/investments'

// ============================================================================
// Calculs dérivés : patrimoine, cashflow, répartition, paliers.
// Fonctions pures, sans effet de bord.
// ============================================================================

/** Valeur totale des investissements (valeur de marché). */
export function totalInvestmentValue(investments: Investment[]): number {
  return investments.reduce((sum, inv) => sum + inv.currentValue, 0)
}

/** Dette totale restante (crédits immo). */
export function totalDebt(state: GameState): number {
  return state.mortgages.reduce((sum, m) => sum + m.outstandingBalance, 0)
}

/** Patrimoine net = cash + investissements - dettes. */
export function calcNetWorth(state: GameState): number {
  return (
    state.cashBalance +
    totalInvestmentValue(state.investments) -
    totalDebt(state)
  )
}

/** Revenu passif mensuel net (loyers, dividendes, livret...). */
export function calcMonthlyPassiveIncome(state: GameState): number {
  return state.investments.reduce((sum, inv) => sum + inv.monthlyIncome, 0)
}

/** Total des mensualités de crédit. */
export function totalMortgagePayments(state: GameState): number {
  return state.mortgages.reduce((sum, m) => sum + m.monthlyPayment, 0)
}

/** Cashflow mensuel net = salaire + passif - charges - crédits. */
export function calcMonthlyCashflow(state: GameState): number {
  return (
    state.player.salary +
    calcMonthlyPassiveIncome(state) -
    state.monthlyExpenses.total -
    totalMortgagePayments(state)
  )
}

/** Répartition des actifs par catégorie (valeur). */
export function calcAssetBreakdown(state: GameState): AssetBreakdown {
  const breakdown: AssetBreakdown = {
    cash: Math.max(0, state.cashBalance),
    livret: 0,
    assurance_vie: 0,
    obligations_etat: 0,
    bourse_etf: 0,
    or_metaux: 0,
    crowdfunding_immo: 0,
    scpi: 0,
    produit_structure: 0,
    business: 0,
    parking: 0,
    lmnp: 0,
    crypto: 0,
    immo_classique: 0,
    club_deal_immo: 0,
  }
  for (const inv of state.investments) {
    breakdown[inv.catalogId] += inv.currentValue
  }
  return breakdown
}

const MILESTONE_ORDER: MilestoneLevel[] = [
  'debutant',
  'epargnant',
  'investisseur',
  'rentier_partiel',
  'rentier',
  'millionnaire',
  'multimillionnaire',
]

export interface MilestoneInfo {
  level: MilestoneLevel
  label: string
  description: string
  icon: string
  color: string
  /** Renvoie [valeur courante, objectif] pour la barre de progression. */
  progress: (state: GameState) => { current: number; target: number }
}

export const MILESTONE_INFO: Record<MilestoneLevel, MilestoneInfo> = {
  debutant: {
    level: 'debutant',
    label: 'Débutant',
    description: 'Tu démarres ton aventure financière.',
    icon: 'Sprout',
    color: '#94a3b8',
    progress: (s) => ({ current: calcNetWorth(s), target: 10000 }),
  },
  epargnant: {
    level: 'epargnant',
    label: 'Épargnant',
    description: 'Patrimoine de 10 000 € atteint !',
    icon: 'PiggyBank',
    color: '#38bdf8',
    progress: (s) => ({ current: calcNetWorth(s), target: 50000 }),
  },
  investisseur: {
    level: 'investisseur',
    label: 'Investisseur',
    description: 'Patrimoine de 50 000 € — tu investis sérieusement.',
    icon: 'TrendingUp',
    color: '#22c55e',
    progress: (s) => ({ current: calcNetWorth(s), target: 200000 }),
  },
  rentier_partiel: {
    level: 'rentier_partiel',
    label: 'Rentier partiel',
    description: 'Patrimoine de 200 000 € — la liberté approche.',
    icon: 'Wallet',
    color: '#f59e0b',
    progress: (s) => ({
      current: calcMonthlyPassiveIncome(s),
      target: s.player.salary,
    }),
  },
  rentier: {
    level: 'rentier',
    label: 'Rentier',
    description: 'Tes revenus passifs dépassent ton salaire. Liberté !',
    icon: 'Crown',
    color: '#a855f7',
    progress: (s) => ({ current: calcNetWorth(s), target: 1000000 }),
  },
  millionnaire: {
    level: 'millionnaire',
    label: 'Millionnaire',
    description: '1 million d\'euros de patrimoine. Bravo !',
    icon: 'Gem',
    color: '#ec4899',
    progress: (s) => ({ current: calcNetWorth(s), target: 5000000 }),
  },
  multimillionnaire: {
    level: 'multimillionnaire',
    label: 'Multimillionnaire',
    description: '5 millions et plus. Tu as gagné le jeu de la richesse.',
    icon: 'Trophy',
    color: '#fbbf24',
    progress: () => ({ current: 1, target: 1 }),
  },
}

/**
 * Détermine le palier atteint le plus élevé selon l'état.
 * Renvoie le niveau (peut rester identique).
 */
export function evaluateMilestone(state: GameState): MilestoneLevel {
  const nw = calcNetWorth(state)
  const passive = calcMonthlyPassiveIncome(state)
  if (nw >= 5_000_000) return 'multimillionnaire'
  if (nw >= 1_000_000) return 'millionnaire'
  if (passive >= state.player.salary && passive > 0) return 'rentier'
  if (nw >= 200_000) return 'rentier_partiel'
  if (nw >= 50_000) return 'investisseur'
  if (nw >= 10_000) return 'epargnant'
  return 'debutant'
}

export function milestoneRank(level: MilestoneLevel): number {
  return MILESTONE_ORDER.indexOf(level)
}

/**
 * Taux d'endettement = mensualités crédit / (salaire + revenus passifs).
 * La réglementation française plafonne à 35 %.
 */
export function calcDebtRatio(state: GameState): number {
  const income = state.player.salary + calcMonthlyPassiveIncome(state)
  if (income <= 0) return 0
  return totalMortgagePayments(state) / income
}

/** LTV moyen sur l'ensemble du parc immobilier financé à crédit. */
export function calcLTV(state: GameState): number {
  const immoWithMortgage = state.investments.filter((i) => i.mortgageId)
  if (immoWithMortgage.length === 0) return 0
  const totalValue = immoWithMortgage.reduce((s, i) => s + i.currentValue, 0)
  const totalOwed = totalDebt(state)
  if (totalValue <= 0) return 0
  return totalOwed / totalValue
}

/** Une catégorie est-elle débloquée selon le patrimoine ? */
export function isCategoryUnlocked(
  category: InvestmentCategory,
  netWorth: number,
): boolean {
  return netWorth >= getCatalogItem(category).unlockThreshold
}
