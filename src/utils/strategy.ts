import type {
  GameState,
  InvestmentCategory,
  StrategicStance,
} from '../types'
import { getCatalogItem } from '../data/investments'
import { getLifeGoal } from '../data/lifeGoals'
import {
  calcAssetBreakdown,
  calcMonthlyPassiveIncome,
  calcNetWorth,
} from './calculations'

// ============================================================================
// Analyse stratégique : diversification, miroir comportemental, postures,
// progression vers l'objectif de vie. Fonctions pures.
// ============================================================================

// ----------------------------------------------------------------------------
// Postures stratégiques (bilan trimestriel)
// ----------------------------------------------------------------------------

export interface StanceInfo {
  id: StrategicStance
  label: string
  emoji: string
  description: string
  /** Catégories favorisées par cette posture. */
  favored: InvestmentCategory[]
}

export const STANCE_INFO: Record<StrategicStance, StanceInfo> = {
  secure: {
    id: 'secure',
    label: 'Sécuriser',
    emoji: '🛡️',
    description: 'Protéger le capital, reconstituer le matelas de sécurité, privilégier le sans-risque.',
    favored: ['livret', 'assurance_vie', 'obligations_etat', 'produit_structure', 'or_metaux'],
  },
  growth: {
    id: 'growth',
    label: 'Croissance',
    emoji: '🚀',
    description: 'Faire grossir le patrimoine, accepter la volatilité, viser le rendement long terme.',
    favored: ['bourse_etf', 'crypto', 'business', 'crowdfunding_immo'],
  },
  income: {
    id: 'income',
    label: 'Revenus',
    emoji: '💸',
    description: 'Construire des revenus passifs réguliers : loyers, dividendes, rentes mensuelles.',
    favored: ['scpi', 'parking', 'lmnp', 'immo_classique', 'club_deal_immo'],
  },
}

/** Petit bonus de rendement quand l'actif est aligné sur la posture active. */
export function stanceYieldMultiplier(
  catalogId: InvestmentCategory,
  stance: StrategicStance | undefined,
): number {
  if (!stance) return 1
  return STANCE_INFO[stance].favored.includes(catalogId) ? 1.04 : 1
}

// ----------------------------------------------------------------------------
// Diversification
// ----------------------------------------------------------------------------

export interface DiversificationAnalysis {
  classCount: number          // nombre de classes d'actifs détenues (hors cash)
  topCategory: InvestmentCategory | null
  topShare: number            // part de la plus grosse classe (0-1)
  isConcentrated: boolean      // > 70% sur une classe
  isResilient: boolean         // 4+ classes
  /** Facteur appliqué aux chocs de marché : <1 amortit, >1 amplifie. */
  shockFactor: number
  score: number               // 0-100 score de diversification
}

export function analyzeDiversification(state: GameState): DiversificationAnalysis {
  const breakdown = calcAssetBreakdown(state)
  const entries = (Object.entries(breakdown) as [string, number][])
    .filter(([key, val]) => key !== 'cash' && val > 0)
  const totalInvested = entries.reduce((s, [, v]) => s + v, 0)

  if (totalInvested <= 0) {
    return {
      classCount: 0,
      topCategory: null,
      topShare: 0,
      isConcentrated: false,
      isResilient: false,
      shockFactor: 1,
      score: 0,
    }
  }

  let topCategory: InvestmentCategory | null = null
  let topValue = 0
  for (const [key, val] of entries) {
    if (val > topValue) {
      topValue = val
      topCategory = key as InvestmentCategory
    }
  }

  const topShare = topValue / totalInvested
  const classCount = entries.length
  const isConcentrated = topShare > 0.7
  const isResilient = classCount >= 4

  // Facteur de choc : diversifié → amortit (~0.6), concentré → amplifie (~1.5).
  let shockFactor = 1
  if (isResilient) shockFactor = 0.6
  else if (classCount === 3) shockFactor = 0.8
  if (isConcentrated) shockFactor = 1.5

  // Score : nombre de classes + équilibre.
  const balanceScore = Math.max(0, 1 - (topShare - 1 / Math.max(1, classCount)))
  const score = Math.min(100, Math.round((Math.min(classCount, 5) / 5) * 60 + balanceScore * 40))

  return { classCount, topCategory, topShare, isConcentrated, isResilient, shockFactor, score }
}

// ----------------------------------------------------------------------------
// Miroir comportemental — insights sur les patterns du joueur
// ----------------------------------------------------------------------------

export interface BehaviorInsight {
  id: string
  emoji: string
  tone: 'positive' | 'warning' | 'neutral'
  text: string
}

export function buildBehaviorInsights(state: GameState): BehaviorInsight[] {
  const insights: BehaviorInsight[] = []
  const b = state.behavior
  const div = analyzeDiversification(state)
  const monthIndex = state.monthIndex ?? 0

  // 1. Concentration
  if (div.isConcentrated && div.topCategory) {
    const item = getCatalogItem(div.topCategory)
    insights.push({
      id: 'concentration',
      emoji: '⚠️',
      tone: 'warning',
      text: `${Math.round(div.topShare * 100)}% de ton patrimoine est en ${item.shortName}. Un choc sur cette classe te ferait très mal. Diversifier amortirait le coup.`,
    })
  } else if (div.isResilient) {
    insights.push({
      id: 'resilient',
      emoji: '🛡️',
      tone: 'positive',
      text: `Ton portefeuille est bien diversifié (${div.classCount} classes d'actifs). Les chocs de marché t'affectent ~40% moins fort.`,
    })
  }

  // 2. Timing d'achat (acheter en bull vs bear)
  if (b && b.totalBuys >= 4) {
    const bullRatio = b.buysInBull / b.totalBuys
    const bearCrashRatio = (b.buysInBear + b.buysInCrash) / b.totalBuys
    if (bullRatio > 0.6) {
      insights.push({
        id: 'buy_high',
        emoji: '📈',
        tone: 'warning',
        text: `Tu investis surtout quand le marché monte (${Math.round(bullRatio * 100)}% de tes achats). Les plus grandes fortunes accumulent dans les creux. Oseras-tu acheter au prochain krach ?`,
      })
    } else if (bearCrashRatio > 0.4) {
      insights.push({
        id: 'buy_low',
        emoji: '🎯',
        tone: 'positive',
        text: `Tu as le sang-froid d'investir dans les phases baissières (${Math.round(bearCrashRatio * 100)}% de tes achats). C'est exactement le comportement des investisseurs aguerris.`,
      })
    }
  }

  // 3. Inertie de vente
  if (b && b.totalBuys >= 3) {
    const monthsSinceSell = b.totalSells === 0 ? monthIndex : monthIndex - b.lastSellMonthIndex
    if (monthsSinceSell >= 12 && b.totalSells === 0) {
      insights.push({
        id: 'never_sold',
        emoji: '🤔',
        tone: 'neutral',
        text: `Tu n'as jamais vendu un seul investissement. Conviction de long terme, ou peur de prendre une décision ? Parfois, arbitrer est le bon choix.`,
      })
    }
  }

  // 4. Cash dormant
  const netWorth = calcNetWorth(state)
  if (netWorth > 0 && state.cashBalance / netWorth > 0.4 && state.cashBalance > 8000) {
    insights.push({
      id: 'idle_cash',
      emoji: '💤',
      tone: 'warning',
      text: `${Math.round((state.cashBalance / netWorth) * 100)}% de ton patrimoine dort en cash. L'inflation le grignote silencieusement chaque mois. Fais-le travailler.`,
    })
  }

  // 5. Alignement à la posture
  if (state.strategicStance && b && b.totalBuys >= 2) {
    const stance = STANCE_INFO[state.strategicStance]
    insights.push({
      id: 'stance_reminder',
      emoji: stance.emoji,
      tone: 'neutral',
      text: `Posture actuelle : « ${stance.label} ». ${stance.description}`,
    })
  }

  return insights.slice(0, 3)
}

// ----------------------------------------------------------------------------
// Progression vers l'objectif de vie
// ----------------------------------------------------------------------------

export interface GoalProgress {
  hasGoal: boolean
  emoji: string
  title: string
  tagline: string
  currentNetWorth: number
  targetNetWorth: number
  progressPct: number
  monthsElapsed: number
  monthsRemaining: number
  deadlineMonths: number
  onTrack: boolean
  /** Patrimoine requis pour être « dans les temps » à ce stade (courbe quadratique). */
  expectedNetWorth: number
  /** Conseil personnalisé pour l'objectif. */
  coachTip: string
}

export function calcGoalProgress(state: GameState): GoalProgress {
  const goal = getLifeGoal(state.player.lifeGoalId)
  const netWorth = calcNetWorth(state)
  if (!goal) {
    return {
      hasGoal: false,
      emoji: '',
      title: '',
      tagline: '',
      currentNetWorth: netWorth,
      targetNetWorth: 0,
      progressPct: 0,
      monthsElapsed: 0,
      monthsRemaining: 0,
      deadlineMonths: 0,
      onTrack: true,
      expectedNetWorth: 0,
      coachTip: '',
    }
  }
  const start = state.player.goalStartMonthIndex ?? 0
  const monthsElapsed = Math.max(0, (state.monthIndex ?? 0) - start)
  const monthsRemaining = Math.max(0, goal.deadlineMonths - monthsElapsed)
  const progressPct = Math.min(100, (netWorth / goal.targetNetWorth) * 100)

  // Quadratic expected curve: early months are forgiving (compound growth is slow at first,
  // then accelerates — linear expectations are always too harsh early on).
  const t = goal.deadlineMonths > 0 ? monthsElapsed / goal.deadlineMonths : 0
  const expectedNetWorth = t * t * goal.targetNetWorth
  const onTrack = netWorth >= expectedNetWorth * 0.85

  const timeRatio = t
  let coachTip = ''
  if (progressPct >= 100) {
    coachTip = '🎉 Objectif atteint ! Envisage de viser plus grand.'
  } else if (!onTrack) {
    if (timeRatio < 0.25) {
      coachTip = 'Le début est toujours lent. Chaque euro investi maintenant compte double grâce aux intérêts composés.'
    } else if (timeRatio < 0.6) {
      coachTip = 'Phase critique : augmente ton épargne mensuelle ou ajoute un actif à rendement plus élevé.'
    } else {
      coachTip = 'L\'échéance approche. Privilégie des actifs dynamiques et réduis tes dépenses non essentielles.'
    }
  } else {
    if (timeRatio < 0.3) {
      coachTip = 'Bon départ ! Continue d\'investir régulièrement pour bénéficier des intérêts composés.'
    } else if (timeRatio < 0.7) {
      coachTip = 'Tu es dans les temps. Diversifie pour protéger tes gains en cas de choc de marché.'
    } else {
      coachTip = 'La ligne d\'arrivée est proche. Sécurise progressivement tes investissements.'
    }
  }

  return {
    hasGoal: true,
    emoji: goal.emoji,
    title: goal.title,
    tagline: goal.tagline,
    currentNetWorth: netWorth,
    targetNetWorth: goal.targetNetWorth,
    progressPct,
    monthsElapsed,
    monthsRemaining,
    deadlineMonths: goal.deadlineMonths,
    onTrack,
    expectedNetWorth,
    coachTip,
  }
}

/** L'objectif de vie est-il atteint ? */
export function isGoalAchieved(state: GameState): boolean {
  const goal = getLifeGoal(state.player.lifeGoalId)
  if (!goal) return false
  // Pour la retraite anticipée : revenus passifs >= charges suffit aussi.
  if (goal.id === 'early_retirement') {
    const passive = calcMonthlyPassiveIncome(state)
    if (passive >= state.monthlyExpenses.total && passive > 0) return true
  }
  return calcNetWorth(state) >= goal.targetNetWorth
}
