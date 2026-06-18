import type { EconomyState, PropertyCandidate } from '../types'

// ============================================================================
// Moteur de recherche immobilière — génération de candidats et durées
// ============================================================================

// Durées de recherche en ms réel
export const IMMO_SEARCH_DURATIONS: Record<
  'parking' | 'lmnp' | 'immo_classique',
  { financing: number; property: number }
> = {
  parking: {
    financing: 1 * 3_600_000,  // 1h
    property: 2 * 3_600_000,   // 2h
  },
  lmnp: {
    financing: 3 * 3_600_000,  // 3h
    property: 6 * 3_600_000,   // 6h
  },
  immo_classique: {
    financing: 6 * 3_600_000,  // 6h
    property: 12 * 3_600_000,  // 12h
  },
}

const FRENCH_CITIES = [
  'Lyon', 'Bordeaux', 'Nantes', 'Toulouse', 'Lille',
  'Rennes', 'Montpellier', 'Strasbourg', 'Nice', 'Angers',
  'Le Mans', 'Reims', 'Tours', 'Clermont-Ferrand', 'Dijon',
  'Grenoble', 'Rouen', 'Toulon', 'Aix-en-Provence', 'Brest',
]

const STREET_NAMES = [
  'rue de la République', 'avenue Jean Jaurès', 'rue Victor Hugo',
  'boulevard Gambetta', 'rue des Lilas', 'place du Marché',
  'rue Pasteur', 'avenue de la Gare', 'rue Voltaire', 'cours Mirabeau',
  'boulevard de la Liberté', 'rue de la Paix', 'allée des Roses',
  'impasse des Acacias', 'chemin des Vignes',
]

let _candidateCounter = 0
function uid(): string {
  _candidateCounter += 1
  return `cand_${Date.now().toString(36)}_${_candidateCounter}`
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]
}

function randBetween(min: number, max: number, salt: number): number {
  // Pseudo-random but deterministic-ish for given salt
  const r = Math.sin(salt * 9301 + 49297) * 233280
  const norm = (r - Math.floor(r))
  return min + norm * (max - min)
}

/**
 * Génère 3-4 candidats immobiliers réalistes selon le type
 */
export function generatePropertyCandidates(
  catalogId: 'parking' | 'lmnp' | 'immo_classique',
  economy: EconomyState,
): PropertyCandidate[] {
  const now = Date.now()
  const count = 3 + (Math.random() > 0.5 ? 1 : 0)
  const candidates: PropertyCandidate[] = []

  for (let i = 0; i < count; i++) {
    const seed = now + i * 1000

    if (catalogId === 'parking') {
      const price = Math.round(randBetween(8000, 25000, seed) * economy.realEstateIndex)
      const monthlyRent = Math.round(price * randBetween(0.06, 0.08, seed + 1) / 12)
      const monthlyCharges = Math.round(15 + randBetween(0, 20, seed + 2))
      const grossYieldPct = (monthlyRent * 12) / price
      const netYieldPct = ((monthlyRent - monthlyCharges) * 12) / price
      const sqm = Math.round(randBetween(12, 20, seed + 3))
      const cityIdx = Math.floor(randBetween(0, FRENCH_CITIES.length - 0.01, seed + 4))
      const streetIdx = Math.floor(randBetween(0, STREET_NAMES.length - 0.01, seed + 5))
      const num = Math.round(randBetween(1, 120, seed + 6))
      const conditions: Array<'neuf' | 'bon' | 'à rénover'> = ['neuf', 'bon', 'à rénover']
      const cond = pick(conditions, Math.floor(randBetween(0, 2.99, seed + 7)))
      const types: Array<'parking' | 'box'> = ['parking', 'box']
      const pType = pick(types, Math.floor(randBetween(0, 1.99, seed + 8)))

      candidates.push({
        id: uid(),
        address: `${num} ${STREET_NAMES[streetIdx]}`,
        city: FRENCH_CITIES[cityIdx],
        squareMeters: sqm,
        price,
        monthlyRent,
        monthlyCharges,
        grossYieldPct,
        netYieldPct,
        propertyType: pType,
        condition: cond,
      })
    } else if (catalogId === 'lmnp') {
      const price = Math.round(randBetween(80000, 200000, seed) * economy.realEstateIndex)
      const monthlyRent = Math.round(price * randBetween(0.04, 0.06, seed + 1) / 12)
      const monthlyCharges = Math.round(80 + randBetween(0, 120, seed + 2))
      const grossYieldPct = (monthlyRent * 12) / price
      const netYieldPct = ((monthlyRent - monthlyCharges) * 12) / price
      const sqm = Math.round(randBetween(20, 55, seed + 3))
      const cityIdx = Math.floor(randBetween(0, FRENCH_CITIES.length - 0.01, seed + 4))
      const streetIdx = Math.floor(randBetween(0, STREET_NAMES.length - 0.01, seed + 5))
      const num = Math.round(randBetween(1, 120, seed + 6))
      const conditions: Array<'neuf' | 'bon' | 'à rénover'> = ['neuf', 'bon', 'à rénover']
      const cond = pick(conditions, Math.floor(randBetween(0, 2.99, seed + 7)))
      const types: Array<'studio' | 'T2'> = ['studio', 'T2']
      const pType = pick(types, Math.floor(randBetween(0, 1.99, seed + 8)))

      candidates.push({
        id: uid(),
        address: `${num} ${STREET_NAMES[streetIdx]}`,
        city: FRENCH_CITIES[cityIdx],
        squareMeters: sqm,
        price,
        monthlyRent,
        monthlyCharges,
        grossYieldPct,
        netYieldPct,
        propertyType: pType,
        condition: cond,
      })
    } else {
      // immo_classique
      const price = Math.round(randBetween(100000, 350000, seed) * economy.realEstateIndex)
      const monthlyRent = Math.round(price * randBetween(0.03, 0.05, seed + 1) / 12)
      const monthlyCharges = Math.round(100 + randBetween(0, 200, seed + 2))
      const grossYieldPct = (monthlyRent * 12) / price
      const netYieldPct = ((monthlyRent - monthlyCharges) * 12) / price
      const sqm = Math.round(randBetween(35, 90, seed + 3))
      const cityIdx = Math.floor(randBetween(0, FRENCH_CITIES.length - 0.01, seed + 4))
      const streetIdx = Math.floor(randBetween(0, STREET_NAMES.length - 0.01, seed + 5))
      const num = Math.round(randBetween(1, 120, seed + 6))
      const conditions: Array<'neuf' | 'bon' | 'à rénover'> = ['neuf', 'bon', 'à rénover']
      const cond = pick(conditions, Math.floor(randBetween(0, 2.99, seed + 7)))
      const types: Array<'T2' | 'T3' | 'T4' | 'maison'> = ['T2', 'T3', 'T4', 'maison']
      const pType = pick(types, Math.floor(randBetween(0, 3.99, seed + 8)))

      candidates.push({
        id: uid(),
        address: `${num} ${STREET_NAMES[streetIdx]}`,
        city: FRENCH_CITIES[cityIdx],
        squareMeters: sqm,
        price,
        monthlyRent,
        monthlyCharges,
        grossYieldPct,
        netYieldPct,
        propertyType: pType,
        condition: cond,
      })
    }
  }

  return candidates
}

export interface AmortizationRow {
  month: number
  payment: number
  interest: number
  principal: number
  balance: number
}

/**
 * Calcule les N premières lignes du tableau d'amortissement
 */
export function buildAmortizationSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  rows = 6,
): AmortizationRow[] {
  const monthlyRate = annualRate / 12
  const payment = monthlyRate === 0
    ? principal / termMonths
    : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths))

  const result: AmortizationRow[] = []
  let balance = principal

  for (let m = 1; m <= Math.min(rows, termMonths); m++) {
    const interest = balance * monthlyRate
    const principalPaid = payment - interest
    balance = Math.max(0, balance - principalPaid)

    result.push({
      month: m,
      payment: Math.round(payment),
      interest: Math.round(interest),
      principal: Math.round(principalPaid),
      balance: Math.round(balance),
    })
  }

  return result
}
