/**
 * ARCHIPEL — données de jeu.
 *
 * Chaque bâtiment est un vrai placement français, avec son régime fiscal réel
 * (simplifié) et des synergies de voisinage façon « Islanders ».
 */

export type BType =
  | 'maison' | 'banque' | 'etf' | 'coffre' | 'parking' | 'studio'
  | 'crypto' | 'bureaux' | 'solaire' | 'commerce' | 'immeuble'

export type MarketKind = 'stock' | 'crypto'

export interface BDef {
  type: BType
  name: string
  emoji: string
  cost: number          // capital investi à la construction
  grossYield: number    // rendement brut annuel
  taxRate: number       // fiscalité sur les revenus (avant maturité éventuelle)
  matureAfterYears?: number
  matureTaxRate?: number
  taxLabel: string
  regime: string        // explication pédagogique courte
  unlock: number        // patrimoine requis (record atteint)
  maxLevel: number
  maxCount?: number      // limite réglementaire (ex. un seul Livret A par personne)
  market?: MarketKind
  appreciation?: number // revalorisation annuelle de l'immobilier
  color: string
  desc: string
}

export const DEFS: Record<BType, BDef> = {
  maison: {
    type: 'maison', name: 'Ton foyer', emoji: '🏡', cost: 0, grossYield: 0, taxRate: 0,
    taxLabel: 'Épargne', regime: 'Ton salaire moins tes dépenses : la source de ton premier capital.',
    unlock: 0, maxLevel: 5, color: '#e76f51',
    desc: 'Chaque mois, tu mets de côté la différence entre ton salaire et tes dépenses.',
  },
  banque: {
    type: 'banque', name: 'Livret A', emoji: '🏦', cost: 500, grossYield: 0.03, taxRate: 0,
    taxLabel: 'Exonéré', regime: 'Intérêts totalement exonérés d’impôt. Sûr, mais plafonné.',
    unlock: 0, maxLevel: 3, maxCount: 1, color: '#4f7cff',
    desc: 'La petite banque de quartier. Un seul Livret A par personne : rapporte peu, mais rassure tes voisins.',
  },
  etf: {
    type: 'etf', name: 'Tour ETF (PEA)', emoji: '📈', cost: 1000, grossYield: 0.045, taxRate: 0.30,
    matureAfterYears: 5, matureTaxRate: 0.172,
    taxLabel: 'PEA · 5 ans', regime: 'Flat tax 30 % avant 5 ans, puis seulement 17,2 % de prélèvements sociaux.',
    unlock: 0, maxLevel: 5, market: 'stock', color: '#2bb3c0',
    desc: 'Un fonds indiciel mondial. Suit les marchés : euphorie… et krachs.',
  },
  coffre: {
    type: 'coffre', name: 'Coffre Assurance-vie', emoji: '🔐', cost: 2000, grossYield: 0.04, taxRate: 0.30,
    matureAfterYears: 8, matureTaxRate: 0.172,
    taxLabel: 'Assurance-vie · 8 ans', regime: 'Taxée à 30 % avant 8 ans. Après 8 ans, l’abattement annuel ramène l’impôt à 17,2 %.',
    unlock: 1500, maxLevel: 5, color: '#8a6dff',
    desc: 'Un coffre-fort patient. Son cadenas s’ouvre en or au bout de 8 ans.',
  },
  parking: {
    type: 'parking', name: 'Parking', emoji: '🅿️', cost: 4000, grossYield: 0.062, taxRate: 0.30,
    taxLabel: 'Revenus fonciers', regime: 'Loyers imposés à ton taux marginal + prélèvements sociaux (≈ 30 %).',
    unlock: 6000, maxLevel: 4, appreciation: 0.01, color: '#6c7a89',
    desc: 'Agrandit l’île de 2 terrains en construisant ses accès. Booste tout ce qui l’entoure.',
  },
  studio: {
    type: 'studio', name: 'Studio meublé', emoji: '🏠', cost: 10000, grossYield: 0.055, taxRate: 0.02,
    taxLabel: 'LMNP · amorti', regime: 'Location meublée : l’amortissement du bien efface quasiment l’impôt sur les loyers.',
    unlock: 12000, maxLevel: 5, appreciation: 0.015, color: '#f4a261',
    desc: 'Le meilleur rendement net du début de partie. Adore avoir un parking à côté.',
  },
  crypto: {
    type: 'crypto', name: 'Ferme crypto', emoji: '⛏️', cost: 3000, grossYield: 0.15, taxRate: 0.30,
    taxLabel: 'Flat tax 30 %', regime: 'Plus-values et revenus taxés à 30 %. Extrêmement volatile.',
    unlock: 22000, maxLevel: 4, market: 'crypto', color: '#9b5de5',
    desc: 'Énorme rendement… ou rien. Bruyante : tes voisins résidentiels n’aiment pas.',
  },
  bureaux: {
    type: 'bureaux', name: 'Bureaux (SCPI)', emoji: '🏢', cost: 8000, grossYield: 0.05, taxRate: 0.30,
    taxLabel: 'Revenus fonciers', regime: 'Loyers de bureaux mutualisés, imposés comme des revenus fonciers.',
    unlock: 35000, maxLevel: 5, appreciation: 0.008, color: '#577590',
    desc: 'De l’immobilier sans les soucis. Prospère près des parkings et des commerces.',
  },
  solaire: {
    type: 'solaire', name: 'Parc solaire', emoji: '☀️', cost: 15000, grossYield: 0.06, taxRate: 0.30,
    taxLabel: 'Flat tax 30 %', regime: 'Financement participatif de la transition énergétique, intérêts au PFU.',
    unlock: 60000, maxLevel: 4, color: '#f9c74f',
    desc: 'Énergie propre et revenus réguliers. Alimente gratuitement une ferme crypto voisine.',
  },
  commerce: {
    type: 'commerce', name: 'Boutique', emoji: '🛍️', cost: 30000, grossYield: 0.10, taxRate: 0.25,
    taxLabel: 'Impôt société 25 %', regime: 'Bénéfices d’entreprise imposés à l’IS. Plus risqué, plus rentable.',
    unlock: 110000, maxLevel: 5, color: '#e5383b',
    desc: 'Vit de ses clients : chaque logement voisin fait grimper son chiffre.',
  },
  immeuble: {
    type: 'immeuble', name: 'Immeuble de rapport', emoji: '🏛️', cost: 80000, grossYield: 0.065, taxRate: 0.30,
    taxLabel: 'Revenus fonciers', regime: 'Un immeuble entier en location nue. Loyers imposés ≈ 30 %.',
    unlock: 220000, maxLevel: 5, appreciation: 0.015, color: '#bc8a5f',
    desc: 'Le graal du rentier. Imposant, rentable, et sublimé par les commerces.',
  },
}

export const BUILDABLE: BType[] = [
  'banque', 'etf', 'coffre', 'parking', 'studio', 'crypto', 'bureaux', 'solaire', 'commerce', 'immeuble',
]

/** Bonus (en %) qu'un bâtiment de type T reçoit de chaque voisin de type N. */
export const SYNERGY: Partial<Record<BType, Partial<Record<BType, number>>>> = {
  banque:   { maison: 10, coffre: 10 },
  etf:      { banque: 10, bureaux: 10, etf: -10 },
  coffre:   { banque: 15, maison: 10 },
  parking:  { studio: 10, immeuble: 15, bureaux: 10, commerce: 15 },
  studio:   { parking: 25, commerce: 10, banque: 5, crypto: -15 },
  crypto:   { solaire: 40, crypto: -15 },
  bureaux:  { parking: 20, commerce: 10, banque: 5 },
  solaire:  { crypto: 10 },
  commerce: { studio: 15, immeuble: 20, parking: 15, maison: 10 },
  immeuble: { parking: 25, commerce: 15, crypto: -15 },
  maison:   { banque: 10, commerce: 10, crypto: -10 },
}

// ── Rythme du jeu ────────────────────────────────────────────────────────────
export const MONTH_SECONDS = 20            // 1 mois de jeu = 20 s réelles
export const STORAGE_MONTHS = 4            // capacité de stockage de base
export const STORAGE_PER_LEVEL = 2
export const OFFLINE_SECONDS_PER_MONTH = 600 // hors-ligne : 1 mois toutes les 10 min
export const OFFLINE_MAX_MONTHS = 12

export const START_CASH = 1500
export const EXPENSES = 1600               // dépenses mensuelles de départ = cible de liberté

/** Carrière (niveau du foyer) → salaire net mensuel. */
export const SALARY_BY_LEVEL = [0, 2200, 2500, 2850, 3300, 3900]
export const CAREER_COST = [0, 4000, 12000, 30000, 70000]
/** Inflation du train de vie : chaque hausse de salaire augmente aussi les dépenses. */
export const LIFESTYLE_CREEP = 0.35

export const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

export function upgradeCost(t: BType, level: number): number {
  return Math.round(DEFS[t].cost * (0.8 + level * 0.7))
}

export function landCost(extraTiles: number): number {
  return Math.round(400 * Math.pow(1.13, Math.max(0, extraTiles)))
}

// ── Marché ───────────────────────────────────────────────────────────────────
export type Phase = 'calme' | 'euphorie' | 'krach' | 'reprise'

export const PHASES: Record<Phase, {
  label: string; emoji: string; stockDrift: number; cryptoDrift: number; cryptoVol: number
  stockProd: number; cryptoProd: number; duration: [number, number]; desc: string
}> = {
  calme:    { label: 'Marché calme', emoji: '🌤️', stockDrift: 0.003, cryptoDrift: 0.0, cryptoVol: 0.06, stockProd: 1, cryptoProd: 1, duration: [10, 20], desc: 'Les marchés avancent tranquillement.' },
  euphorie: { label: 'Euphorie', emoji: '🚀', stockDrift: 0.015, cryptoDrift: 0.06, cryptoVol: 0.10, stockProd: 1.35, cryptoProd: 1.8, duration: [6, 12], desc: 'Tout monte ! Actions et crypto s’envolent.' },
  krach:    { label: 'Krach', emoji: '⛈️', stockDrift: -0.06, cryptoDrift: -0.16, cryptoVol: 0.12, stockProd: 0.6, cryptoProd: 0.25, duration: [3, 5], desc: 'Panique sur les marchés. Les audacieux achètent la baisse.' },
  reprise:  { label: 'Reprise', emoji: '🌈', stockDrift: 0.02, cryptoDrift: 0.05, cryptoVol: 0.08, stockProd: 1.1, cryptoProd: 1.1, duration: [6, 10], desc: 'Le soleil revient. Ceux qui ont tenu sont récompensés.' },
}

export const NEXT_PHASE: Record<Phase, Phase[]> = {
  calme: ['euphorie', 'euphorie', 'krach', 'calme'],
  euphorie: ['krach', 'calme', 'calme'],
  krach: ['reprise'],
  reprise: ['calme', 'euphorie'],
}

// ── Paliers de liberté ───────────────────────────────────────────────────────
export const FREEDOM_TIERS = [
  { pct: 0.05, title: 'Premiers revenus', emoji: '🌱' },
  { pct: 0.25, title: 'Un quart de liberté', emoji: '🌿' },
  { pct: 0.50, title: 'À mi-chemin', emoji: '🌳' },
  { pct: 0.75, title: 'Presque libre', emoji: '⛵' },
  { pct: 1.00, title: 'Liberté financière', emoji: '🕊️' },
  { pct: 2.00, title: 'Rentier', emoji: '👑' },
  { pct: 5.00, title: 'Magnat de l’archipel', emoji: '🏝️' },
]
