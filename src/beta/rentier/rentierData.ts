/**
 * Le Rentier — données du jeu (beta, gameplay autonome, tour par tour).
 *
 * Objectif : atteindre LA BASCULE — revenus passifs NETS d'impôt ≥ dépenses.
 * Le cœur pédagogique : c'est le NET qui compte. Chaque flux a un rendement
 * brut, une fiscalité, un risque et une liquidité → l'arbitrage fait le jeu.
 *
 * Autonome : n'utilise ni la simulation patrimoniale, ni les lingots.
 */

export type StreamId = 'fonds_euro' | 'etf' | 'lmnp' | 'scpi' | 'business'

export interface StreamArch {
  id: StreamId
  emoji: string
  name: string
  short: string
  color: string
  grossAnnual: number   // rendement brut annuel
  taxRate: number       // fiscalité appliquée au revenu
  risk: number          // 0 = sûr, 1 = très volatil (sensibilité aux krachs)
  liquidity: number     // 1 (bloqué) → 5 (dispo)
  taxLabel: string
  note: string
}

/** Rendement NET mensuel d'un flux (le chiffre qui rapproche de la liberté). */
export function netMonthlyRate(a: StreamArch): number {
  return (a.grossAnnual * (1 - a.taxRate)) / 12
}

export const STREAMS: StreamArch[] = [
  {
    id: 'fonds_euro', emoji: '🏦', name: 'Assurance-vie · fonds €', short: 'Fonds €', color: '#38bdf8',
    grossAnnual: 0.025, taxRate: 0.172, risk: 0, liquidity: 4,
    taxLabel: 'PS 17,2 %', note: 'Sûr, liquide, fiscalité douce. Rendement modeste.',
  },
  {
    id: 'etf', emoji: '📈', name: 'Dividendes ETF', short: 'ETF', color: '#a78bfa',
    grossAnnual: 0.04, taxRate: 0.30, risk: 0.8, liquidity: 5,
    taxLabel: 'Flat tax 30 %', note: 'Liquide et rentable, mais volatil : un krach coupe les revenus.',
  },
  {
    id: 'lmnp', emoji: '🏠', name: 'Immo LMNP (meublé)', short: 'LMNP', color: '#34d399',
    grossAnnual: 0.05, taxRate: 0.02, risk: 0.2, liquidity: 1,
    taxLabel: 'Amorti ≈ 0 %', note: "L'amortissement efface l'impôt → meilleur rendement NET. Peu liquide.",
  },
  {
    id: 'scpi', emoji: '🏢', name: 'SCPI de rendement', short: 'SCPI', color: '#f59e0b',
    grossAnnual: 0.05, taxRate: 0.30, risk: 0.3, liquidity: 1,
    taxLabel: 'Flat tax 30 %', note: 'Régulier et passif, mais taxé et illiquide.',
  },
  {
    id: 'business', emoji: '💼', name: 'Business automatisé', short: 'Business', color: '#fb7185',
    grossAnnual: 0.09, taxRate: 0.30, risk: 1, liquidity: 2,
    taxLabel: 'Flat tax 30 %', note: 'Le plus rentable… et le plus risqué. Sensible aux coups durs.',
  },
]

export const STREAM_BY_ID: Record<StreamId, StreamArch> =
  Object.fromEntries(STREAMS.map((s) => [s.id, s])) as Record<StreamId, StreamArch>

// ── Paramètres de départ ─────────────────────────────────────────────────────
export const START = {
  age: 30,
  cash: 6_000,
  salary: 2_400,      // net mensuel
  expenses: 1_900,    // net mensuel
}
export const MONTHS_PER_TURN = 3
export const INFLATION_PER_TURN = 0.008   // dépenses qui grimpent doucement

// ── Événements (tirés à chaque « avancer ») ──────────────────────────────────
export type EventKind = 'krach' | 'depense' | 'prime' | 'raise' | 'vacance' | 'optim'

export interface RentierEvent {
  kind: EventKind
  emoji: string
  text: string
}

// Paliers de liberté (couverture des dépenses par les revenus passifs nets)
export const FREEDOM_TIERS: { min: number; title: string; emoji: string }[] = [
  { min: 0,    title: 'Salarié',              emoji: '🧑‍💼' },
  { min: 0.5,  title: 'Mi-chemin',            emoji: '🌗' },
  { min: 1.0,  title: 'Libre',                emoji: '🕊️' },
  { min: 1.5,  title: 'Rentier confortable',  emoji: '🌳' },
  { min: 3.0,  title: 'Rentier abondant',     emoji: '👑' },
]

export function freedomTier(coverage: number) {
  let t = FREEDOM_TIERS[0]
  for (const tier of FREEDOM_TIERS) if (coverage >= tier.min) t = tier
  return t
}
