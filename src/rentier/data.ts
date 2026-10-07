/**
 * RENTIER INC. — données de jeu.
 * Un immeuble en coupe : chaque étage contient des pièces de largeur 1 à 3.
 * 1 cycle jour/nuit = 1 mois de jeu (loyers mensuels versés en continu).
 */

export type RoomType =
  | 'lobby' | 'studio' | 't2' | 'penthouse'
  | 'cafe' | 'laverie' | 'sport' | 'bar'
  | 'parking' | 'concierge'

export type Need = 'food' | 'laundry' | 'sport' | 'fun'

export interface RoomDef {
  type: RoomType
  name: string
  emoji: string
  w: number                 // largeur en cases
  cost: number
  kind: 'fixed' | 'home' | 'shop' | 'parking' | 'service'
  floor: 'ground' | 'upper' | 'basement' | 'any' | 'notBasement'
  rent?: number             // loyer mensuel brut (logements)
  capacity?: number         // habitants (logements) / places (parking)
  serves?: Need
  price?: number            // dépense par visite (commerces)
  noisy?: boolean
  unlockFloors?: number     // nombre d'étages requis
  wall: string
  desc: string
}

export const ROOMS: Record<RoomType, RoomDef> = {
  lobby:     { type: 'lobby', name: 'Hall d’entrée', emoji: '🚪', w: 1, cost: 0, kind: 'fixed', floor: 'ground', wall: '#e9dcc6', desc: 'L’entrée de ton immeuble.' },
  studio:    { type: 'studio', name: 'Studio meublé', emoji: '🛏️', w: 1, cost: 5000, kind: 'home', floor: 'upper', rent: 420, capacity: 1, wall: '#fbe3c8', desc: '1 locataire. Location meublée (LMNP) : quasiment pas d’impôt sur les loyers.' },
  t2:        { type: 't2', name: 'Appartement T2', emoji: '🛋️', w: 2, cost: 11000, kind: 'home', floor: 'upper', rent: 900, capacity: 2, wall: '#d8eefc', desc: '2 locataires. Location nue par défaut (revenus fonciers ≈ 30 %), à meubler pour passer en LMNP.' },
  penthouse: { type: 'penthouse', name: 'Penthouse', emoji: '🌇', w: 3, cost: 48000, kind: 'home', floor: 'upper', rent: 3600, capacity: 2, unlockFloors: 5, wall: '#efe4ff', desc: 'Loyer énorme, locataires exigeants : ils veulent du sport et du calme.' },
  cafe:      { type: 'cafe', name: 'Café', emoji: '☕', w: 2, cost: 4000, kind: 'shop', floor: 'notBasement', serves: 'food', price: 28, wall: '#f6d6b8', desc: 'Nourrit tes locataires et attire les passants.' },
  laverie:   { type: 'laverie', name: 'Laverie', emoji: '🧺', w: 1, cost: 2500, kind: 'shop', floor: 'any', serves: 'laundry', price: 18, wall: '#d6f2ee', desc: 'Indispensable : sans laverie, tes locataires râlent.' },
  sport:     { type: 'sport', name: 'Salle de sport', emoji: '🏋️', w: 2, cost: 9000, kind: 'shop', floor: 'any', serves: 'sport', price: 40, unlockFloors: 3, wall: '#dfe7f7', desc: 'Adorée des locataires aisés. Les gens du quartier s’y abonnent.' },
  bar:       { type: 'bar', name: 'Bar à cocktails', emoji: '🍸', w: 2, cost: 8000, kind: 'shop', floor: 'notBasement', serves: 'fun', price: 55, noisy: true, unlockFloors: 3, wall: '#3b2a4f', desc: 'Très rentable… mais bruyant la nuit pour les logements voisins.' },
  parking:   { type: 'parking', name: 'Parking', emoji: '🅿️', w: 2, cost: 6000, kind: 'parking', floor: 'basement', capacity: 3, rent: 90, wall: '#8a929c', desc: '3 places louées. Les locataires avec voiture en ont besoin.' },
  concierge: { type: 'concierge', name: 'Conciergerie', emoji: '🧰', w: 1, cost: 7000, kind: 'service', floor: 'notBasement', unlockFloors: 4, wall: '#e7efd9', desc: 'Un concierge répare automatiquement les fuites et pannes.' },
}

export const BUILD_ORDER: RoomType[] = ['studio', 'laverie', 'cafe', 't2', 'parking', 'sport', 'bar', 'concierge', 'penthouse']

// ── Géométrie (unités SVG) ───────────────────────────────────────────────────
export const SLOTS = 5
export const SW = 66          // largeur d'une case
export const SHAFT_W = 46     // cage d'ascenseur (à droite)
export const FH = 86          // hauteur d'étage
export const BW = SLOTS * SW + SHAFT_W

// ── Rythme ───────────────────────────────────────────────────────────────────
export const DAY_S = 36             // 1 cycle jour/nuit = 1 mois = 36 s
export const WALK = 46              // px/s
export const LIFT_SPEED = 1.7       // étages/s
export const LIFT_CAP = 6

export const START_CASH = 9000
export const LIFESTYLE = 5000       // train de vie mensuel = cible de liberté
/** Chaque logement de plus coûte plus cher : les meilleures affaires partent en premier. */
export const HOME_COST_GROWTH = 1.27
export const SHOP_COST_GROWTH = 1.45
export const TAX = { lmnp: 0.02, nu: 0.30, bic: 0.25, parking: 0.30 }
export const FURNISH_COST = (t: RoomType) => (t === 'penthouse' ? 12000 : 3000)

export function floorCost(n: number) {
  // n ≥ 1 : étage n ; n ≤ -1 : sous-sol
  return n > 0 ? Math.round(6000 * Math.pow(1.6, n - 1)) : Math.round(9000 * Math.pow(1.8, -n - 1))
}

export function chargesPerMonth(floors: number, basements: number) {
  return 60 + floors * 35 + basements * 45
}

export const FREEDOM_TIERS = [
  { pct: 0.1, title: 'Premiers loyers', emoji: '🌱' },
  { pct: 0.25, title: 'Un quart de liberté', emoji: '🌿' },
  { pct: 0.5, title: 'À mi-chemin', emoji: '🌳' },
  { pct: 0.75, title: 'Presque libre', emoji: '⛵' },
  { pct: 1, title: 'Liberté financière', emoji: '🕊️' },
  { pct: 2, title: 'Rentier', emoji: '👑' },
  { pct: 4, title: 'Magnat de l’immobilier', emoji: '🏙️' },
]

export const FIRST_NAMES = ['Léa', 'Hugo', 'Inès', 'Tom', 'Jade', 'Nathan', 'Chloé', 'Louis', 'Emma', 'Adam', 'Sarah', 'Noah', 'Lina', 'Jules', 'Zoé', 'Malik', 'Camille', 'Yanis', 'Manon', 'Théo', 'Alice', 'Rayan', 'Lou', 'Gabriel']
export const SKINS = ['#f2c9a0', '#e0a97a', '#c68a5b', '#8d5a3b', '#f6d7b8', '#b9784f']
export const CLOTHES = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#8338ec', '#ff006e', '#3a86ff', '#06d6a0', '#ffbe0b', '#6d6875', '#ef476f', '#118ab2']
export const HAIR = ['#2b1d14', '#5b3a29', '#a0522d', '#d4a017', '#111111', '#7a7a7a', '#c0392b']
