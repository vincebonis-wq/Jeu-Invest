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

// Profils fixes par type — 5 offres aux conditions de paiement distinctes
type Profile = {
  label: string
  priceFactor: number
  yieldBonus: number
  chargeFactor: number
  condition: 'neuf' | 'bon' | 'à rénover'
  suggestedDownPct: number
}

const PARKING_PROFILES: Profile[] = [
  { label: 'Affaire à saisir',    priceFactor: 0.70, yieldBonus:  0.016, chargeFactor: 1.6, condition: 'à rénover', suggestedDownPct: 1.00 },
  { label: 'Box abordable',       priceFactor: 0.85, yieldBonus:  0.006, chargeFactor: 1.1, condition: 'bon',        suggestedDownPct: 0.50 },
  { label: 'Parking résidentiel', priceFactor: 1.00, yieldBonus:  0.000, chargeFactor: 1.0, condition: 'bon',        suggestedDownPct: 0.30 },
  { label: 'Box sécurisé',        priceFactor: 1.22, yieldBonus: -0.005, chargeFactor: 0.8, condition: 'neuf',       suggestedDownPct: 0.20 },
  { label: 'Emplacement premium', priceFactor: 1.50, yieldBonus: -0.012, chargeFactor: 0.6, condition: 'neuf',       suggestedDownPct: 0.10 },
]

const LMNP_PROFILES: Profile[] = [
  { label: 'Studio à rénover',    priceFactor: 0.72, yieldBonus:  0.015, chargeFactor: 1.5, condition: 'à rénover', suggestedDownPct: 1.00 },
  { label: 'Studio meublé',       priceFactor: 0.88, yieldBonus:  0.006, chargeFactor: 1.1, condition: 'bon',        suggestedDownPct: 0.30 },
  { label: 'T2 résidentiel',      priceFactor: 1.00, yieldBonus:  0.000, chargeFactor: 1.0, condition: 'bon',        suggestedDownPct: 0.20 },
  { label: 'T2 neuf Pinel',       priceFactor: 1.20, yieldBonus: -0.005, chargeFactor: 0.7, condition: 'neuf',       suggestedDownPct: 0.15 },
  { label: 'Résidence services',  priceFactor: 1.45, yieldBonus: -0.010, chargeFactor: 0.5, condition: 'neuf',       suggestedDownPct: 0.10 },
]

const CLASSIQUE_PROFILES: Profile[] = [
  { label: 'Bien à rénover',      priceFactor: 0.70, yieldBonus:  0.018, chargeFactor: 1.7, condition: 'à rénover', suggestedDownPct: 1.00 },
  { label: 'T2 accessible',       priceFactor: 0.85, yieldBonus:  0.007, chargeFactor: 1.2, condition: 'bon',        suggestedDownPct: 0.20 },
  { label: 'T3 équilibré',        priceFactor: 1.00, yieldBonus:  0.000, chargeFactor: 1.0, condition: 'bon',        suggestedDownPct: 0.15 },
  { label: 'T4 familial neuf',    priceFactor: 1.25, yieldBonus: -0.006, chargeFactor: 0.7, condition: 'neuf',       suggestedDownPct: 0.10 },
  { label: 'Maison avec jardin',  priceFactor: 1.55, yieldBonus: -0.012, chargeFactor: 0.6, condition: 'neuf',       suggestedDownPct: 0.10 },
]

/**
 * Génère exactement 5 candidats immobiliers avec des profils et conditions de paiement distincts.
 */
export function generatePropertyCandidates(
  catalogId: 'parking' | 'lmnp' | 'immo_classique',
  economy: EconomyState,
): PropertyCandidate[] {
  const now = Date.now()

  const profiles =
    catalogId === 'parking' ? PARKING_PROFILES
    : catalogId === 'lmnp'  ? LMNP_PROFILES
    : CLASSIQUE_PROFILES

  const basePriceRange =
    catalogId === 'parking'      ? { min: 10000, max: 22000, baseYield: 0.07, baseCharges: 20  }
    : catalogId === 'lmnp'       ? { min: 80000, max: 190000, baseYield: 0.05, baseCharges: 110 }
    : /* immo_classique */         { min: 110000, max: 340000, baseYield: 0.04, baseCharges: 160 }

  const basePropertyTypes: Record<string, Array<'studio' | 'T2' | 'T3' | 'T4' | 'maison' | 'parking' | 'box'>> = {
    parking:      ['parking', 'box'],
    lmnp:         ['studio', 'T2'],
    immo_classique: ['T2', 'T3', 'T4', 'maison'],
  }

  return profiles.map((profile, i) => {
    const seed = now + i * 7919  // prime to avoid repeating decimals

    const basePrice = randBetween(basePriceRange.min, basePriceRange.max, seed)
    const price = Math.round(basePrice * profile.priceFactor * economy.realEstateIndex)
    const yieldRate = Math.max(0.03, basePriceRange.baseYield + profile.yieldBonus)
    const monthlyRent = Math.round((price * yieldRate) / 12)
    const monthlyCharges = Math.round(basePriceRange.baseCharges * profile.chargeFactor * (0.8 + 0.4 * ((Math.sin(seed) + 1) / 2)))
    const grossYieldPct = (monthlyRent * 12) / price
    const netYieldPct = ((monthlyRent - monthlyCharges) * 12) / price

    const sqmRange =
      catalogId === 'parking' ? [10, 22]
      : catalogId === 'lmnp'  ? [18, 52]
      : [32, 95]
    const sqm = Math.round(randBetween(sqmRange[0], sqmRange[1], seed + 1))
    const cityIdx = Math.floor(randBetween(0, FRENCH_CITIES.length - 0.01, seed + 2))
    const streetIdx = Math.floor(randBetween(0, STREET_NAMES.length - 0.01, seed + 3))
    const num = Math.round(randBetween(1, 120, seed + 4))
    const types = basePropertyTypes[catalogId]
    const pType = pick(types, i)

    return {
      id: uid(),
      label: profile.label,
      suggestedDownPct: profile.suggestedDownPct,
      address: `${num} ${STREET_NAMES[streetIdx]}`,
      city: FRENCH_CITIES[cityIdx],
      squareMeters: sqm,
      price,
      monthlyRent,
      monthlyCharges,
      grossYieldPct,
      netYieldPct,
      propertyType: pType,
      condition: profile.condition,
    }
  })
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
