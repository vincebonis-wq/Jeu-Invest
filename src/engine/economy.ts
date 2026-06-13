import type { EconomyState, MarketPhase } from '../types'

// ============================================================================
// Simulation de l'économie : phases de marché, indices, taux.
// Fonctions pures qui renvoient le nouvel état économique.
// ============================================================================

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1))
}

export function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Multiplicateur appliqué aux rendements de marché selon la phase. */
export const PHASE_RETURN_MULTIPLIER: Record<MarketPhase, number> = {
  bull: 1.6,
  neutral: 1.0,
  bear: 0.2,
  crash: -1.8,
}

/** Libellé + emoji pour l'UI. */
export const PHASE_LABEL: Record<MarketPhase, { label: string; emoji: string; color: string }> = {
  bull: { label: 'Marché haussier', emoji: '📈', color: '#16a34a' },
  neutral: { label: 'Marché stable', emoji: '➡️', color: '#64748b' },
  bear: { label: 'Marché baissier', emoji: '📉', color: '#ea580c' },
  crash: { label: 'Krach boursier', emoji: '💥', color: '#dc2626' },
}

// Matrice de transition mensuelle (durées minimales appliquées en plus).
const MIN_PHASE_MONTHS: Record<MarketPhase, number> = {
  bull: 4,
  neutral: 3,
  bear: 4,
  crash: 1,
}

interface Transition {
  to: MarketPhase
  prob: number
}

const TRANSITIONS: Record<MarketPhase, Transition[]> = {
  neutral: [
    { to: 'bull', prob: 0.18 },
    { to: 'bear', prob: 0.1 },
  ],
  bull: [
    { to: 'neutral', prob: 0.14 },
    { to: 'crash', prob: 0.04 },
  ],
  bear: [
    { to: 'neutral', prob: 0.2 },
    { to: 'crash', prob: 0.08 },
  ],
  crash: [
    { to: 'bear', prob: 0.45 },
    { to: 'neutral', prob: 0.1 },
  ],
}

/**
 * Fait évoluer la phase de marché (appelé une fois par mois de jeu).
 */
export function stepMarketPhase(economy: EconomyState): {
  phase: MarketPhase
  phaseMonthsElapsed: number
  changed: boolean
} {
  const elapsed = economy.phaseMonthsElapsed + 1
  // Respecter la durée minimale de phase.
  if (elapsed < MIN_PHASE_MONTHS[economy.marketPhase]) {
    return { phase: economy.marketPhase, phaseMonthsElapsed: elapsed, changed: false }
  }
  const roll = Math.random()
  let cumulative = 0
  for (const t of TRANSITIONS[economy.marketPhase]) {
    cumulative += t.prob
    if (roll < cumulative) {
      return { phase: t.to, phaseMonthsElapsed: 0, changed: true }
    }
  }
  return { phase: economy.marketPhase, phaseMonthsElapsed: elapsed, changed: false }
}

/**
 * Variation quotidienne de l'indice boursier (pour un graphique fluide).
 * Renvoie un facteur multiplicatif autour de 1.
 */
export function dailyStockDrift(phase: MarketPhase): number {
  // Tendance annuelle ~8,5% en neutral, modulée par la phase.
  const annualBase = 0.085 * PHASE_RETURN_MULTIPLIER[phase]
  const dailyTrend = annualBase / 365
  const noise = randRange(-0.004, 0.004) // volatilité quotidienne
  const crashShock = phase === 'crash' ? randRange(-0.01, 0.002) : 0
  return 1 + dailyTrend + noise + crashShock
}

/** Appréciation quotidienne de l'indice immobilier. */
export function dailyRealEstateDrift(phase: MarketPhase): number {
  const annual =
    phase === 'crash'
      ? -0.04
      : phase === 'bear'
        ? 0.005
        : phase === 'bull'
          ? 0.07
          : 0.035
  const daily = annual / 365
  const noise = randRange(-0.0006, 0.0006)
  return 1 + daily + noise
}

/** Ajuste le taux d'intérêt de base (annuel, lent). */
export function driftInterestRate(current: number): number {
  const change = randRange(-0.0015, 0.0015)
  return Math.min(0.06, Math.max(0.018, current + change))
}

export const MAX_INDEX_HISTORY = 400 // ~13 mois de points quotidiens
