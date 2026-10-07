/**
 * RENTIER INC. — données de jeu.
 * Un immeuble en coupe : chaque étage contient des pièces de largeur 1 à 3.
 * 1 cycle jour/nuit = 1 mois de jeu (loyers mensuels versés en continu).
 */

export type RoomType =
  | 'lobby' | 'studio' | 't2' | 'penthouse'
  | 'cafe' | 'laverie' | 'sport' | 'bar'
  | 'parking' | 'concierge' | 'menage' | 'securite' | 'labo' | 'bureau'

export type Need = 'food' | 'laundry' | 'sport' | 'fun'
export type StaffRole = 'janitor' | 'tech' | 'guard' | 'researcher'

export interface RoomDef {
  type: RoomType
  name: string
  emoji: string
  w: number                 // largeur en cases
  cost: number
  kind: 'fixed' | 'home' | 'shop' | 'parking' | 'service' | 'office'
  floor: 'ground' | 'upper' | 'basement' | 'any' | 'notBasement'
  rent?: number             // loyer mensuel brut (logements)
  capacity?: number         // habitants (logements) / places (parking)
  serves?: Need
  price?: number            // dépense par visite (commerces)
  noisy?: boolean
  unlockFloors?: number     // nombre d'étages requis
  staff?: StaffRole         // personnel logé (1 par niveau)
  research?: string         // recherche requise
  wall: string
  desc: string
}

export const ROOMS: Record<RoomType, RoomDef> = {
  lobby:     { type: 'lobby', name: 'Hall d’entrée', emoji: '🚪', w: 1, cost: 0, kind: 'fixed', floor: 'ground', wall: '#e9dcc6', desc: 'L’entrée de ton immeuble.' },
  studio:    { type: 'studio', name: 'Studio meublé', emoji: '🛏️', w: 1, cost: 5000, kind: 'home', floor: 'upper', rent: 420, capacity: 1, wall: '#fbe3c8', desc: '1 locataire. Location meublée (LMNP) : quasiment pas d’impôt sur les loyers.' },
  t2:        { type: 't2', name: 'Appartement T2', emoji: '🛋️', w: 2, cost: 11000, kind: 'home', floor: 'upper', rent: 900, capacity: 2, wall: '#d8eefc', desc: '2 locataires. Location nue par défaut (revenus fonciers ≈ 30 %), à meubler pour passer en LMNP.' },
  penthouse: { type: 'penthouse', name: 'Penthouse', emoji: '🌇', w: 3, cost: 48000, kind: 'home', floor: 'upper', rent: 3600, capacity: 2, unlockFloors: 5, research: 'penthouse', wall: '#efe4ff', desc: 'Loyer énorme, locataires exigeants : ils veulent du sport et du calme.' },
  cafe:      { type: 'cafe', name: 'Café', emoji: '☕', w: 2, cost: 4000, kind: 'shop', floor: 'notBasement', serves: 'food', price: 28, wall: '#f6d6b8', desc: 'Nourrit tes locataires et attire les passants.' },
  laverie:   { type: 'laverie', name: 'Laverie', emoji: '🧺', w: 1, cost: 2500, kind: 'shop', floor: 'any', serves: 'laundry', price: 18, wall: '#d6f2ee', desc: 'Indispensable : sans laverie, tes locataires râlent.' },
  sport:     { type: 'sport', name: 'Salle de sport', emoji: '🏋️', w: 2, cost: 9000, kind: 'shop', floor: 'any', serves: 'sport', price: 40, research: 'sport', wall: '#dfe7f7', desc: 'Adorée des locataires aisés. Les gens du quartier s’y abonnent.' },
  bar:       { type: 'bar', name: 'Bar à cocktails', emoji: '🍸', w: 2, cost: 8000, kind: 'shop', floor: 'notBasement', serves: 'fun', price: 55, noisy: true, research: 'bar', wall: '#3b2a4f', desc: 'Très rentable… mais bruyant la nuit pour les logements voisins.' },
  parking:   { type: 'parking', name: 'Parking', emoji: '🅿️', w: 2, cost: 6000, kind: 'parking', floor: 'basement', capacity: 3, rent: 90, wall: '#8a929c', desc: '3 places louées. Les locataires avec voiture en ont besoin.' },
  concierge: { type: 'concierge', name: 'Atelier technique', emoji: '🧰', w: 1, cost: 6000, kind: 'service', floor: 'any', research: 'concierge', staff: 'tech', wall: '#e7efd9', desc: 'Un technicien court réparer les fuites et pannes dès qu’elles arrivent. Locataires plus sereins.' },
  labo:      { type: 'labo', name: 'Laboratoire R&D', emoji: '🔬', w: 1, cost: 4000, kind: 'service', floor: 'notBasement', staff: 'researcher', wall: '#eef2ff', desc: 'Des chercheurs y inventent de nouvelles pièces et améliorations. Plus de chercheurs = recherches plus rapides.' },
  bureau:    { type: 'bureau', name: 'Bureaux', emoji: '💼', w: 2, cost: 9000, kind: 'office', floor: 'notBasement', rent: 1300, capacity: 4, research: 'bureau', wall: '#e6edf3', desc: 'Loués à une entreprise (4 postes). Tes locataires peuvent y travailler sans quitter l’immeuble : ils adorent.' },
  menage:    { type: 'menage', name: 'Local d’entretien', emoji: '🧹', w: 1, cost: 3500, kind: 'service', floor: 'any', unlockFloors: 2, staff: 'janitor', wall: '#dcecf5', desc: 'Un agent d’entretien fait le tour de l’immeuble et nettoie les pièces sales avant que ça ne dégoûte locataires et clients.' },
  securite:  { type: 'securite', name: 'Poste de sécurité', emoji: '👮', w: 1, cost: 6000, kind: 'service', floor: 'notBasement', research: 'securite', staff: 'guard', wall: '#dfe4ec', desc: 'Un vigile surveille les caméras et fait des rondes la nuit. Il arrête les cambrioleurs avant qu’ils ne vident tes caisses.' },
}

export const BUILD_ORDER: RoomType[] = ['studio', 'laverie', 'labo', 'cafe', 't2', 'menage', 'parking', 'sport', 'bureau', 'bar', 'concierge', 'securite', 'penthouse']

/** Personnel : salaire mensuel par employé (1 employé par niveau du local). */
export const STAFF: Record<StaffRole, { title: string; emoji: string; salary: number; cloth: string; cap: string }> = {
  janitor: { title: 'Agent d’entretien', emoji: '🧹', salary: 300, cloth: '#3a86ff', cap: '#1d4ed8' },
  tech: { title: 'Technicien', emoji: '🔧', salary: 400, cloth: '#2f6f3e', cap: '#1f4d2b' },
  guard: { title: 'Vigile', emoji: '👮', salary: 350, cloth: '#273043', cap: '#111827' },
  researcher: { title: 'Chercheur', emoji: '🧑‍🔬', salary: 300, cloth: '#f8fafc', cap: '' },
}

/** Arbre de recherche : les chercheurs produisent des points 💡. */
export interface ResearchDef { id: string; name: string; emoji: string; desc: string; cost: number; req?: string }
export const RESEARCH: ResearchDef[] = [
  { id: 'sport', name: 'Salle de sport', emoji: '🏋️', desc: 'Débloque la salle de sport.', cost: 10 },
  { id: 'concierge', name: 'Atelier technique', emoji: '🧰', desc: 'Débloque les techniciens qui réparent tout seuls.', cost: 10 },
  { id: 'laundryFast', name: 'Machines rapides', emoji: '🫧', desc: 'Lavages 35 % plus courts : moins d’attente à la laverie.', cost: 14 },
  { id: 'lift2', name: 'Ascenseur rapide', emoji: '🛗', desc: 'Permet de moderniser l’ascenseur (niveau 2).', cost: 16 },
  { id: 'bar', name: 'Bar à cocktails', emoji: '🍸', desc: 'Débloque le bar : très rentable, mais bruyant.', cost: 18 },
  { id: 'cafeFast', name: 'Percolateur pro', emoji: '☕', desc: 'Service au café 35 % plus rapide.', cost: 14 },
  { id: 'securite', name: 'Vidéosurveillance', emoji: '📹', desc: 'Débloque le poste de sécurité et ses vigiles.', cost: 20 },
  { id: 'bureau', name: 'Immobilier de bureau', emoji: '💼', desc: 'Débloque les bureaux : tes locataires peuvent travailler sur place.', cost: 24 },
  { id: 'marketing', name: 'Annonces en ligne', emoji: '📣', desc: 'Les logements vides se louent plus vite, +30 % de passants.', cost: 22 },
  { id: 'soundproof', name: 'Isolation phonique', emoji: '🔇', desc: 'Le bar ne gêne plus les voisins.', cost: 28, req: 'bar' },
  { id: 'domotique', name: 'Domotique', emoji: '📡', desc: 'Deux fois moins de fuites et de pannes.', cost: 30, req: 'concierge' },
  { id: 'safeBox', name: 'Coffres connectés', emoji: '🔐', desc: 'Les cambrioleurs n’emportent que 25 % des loyers.', cost: 24, req: 'securite' },
  { id: 'lift3', name: 'Ascenseur express', emoji: '🚀', desc: 'Permet le niveau 3 de l’ascenseur.', cost: 40, req: 'lift2' },
  { id: 'solar', name: 'Panneaux solaires', emoji: '☀️', desc: '−30 % sur les charges de l’immeuble.', cost: 40 },
  { id: 'penthouse', name: 'Penthouse', emoji: '🌇', desc: 'Débloque le penthouse (5 étages requis).', cost: 50, req: 'sport' },
]
/** Points de recherche par seconde et par chercheur au travail. */
export const RP_RATE = 0.4

/** Ascenseur : installation puis prolongement étage par étage. */
export const liftInstallCost = (floors: number) => 2500 + 600 * floors
export const liftExtendCost = (n: number) => Math.round(1000 * Math.pow(1.3, Math.abs(n) - 1))
/** Escaliers : secondes par étage. */
export const STAIR_S = 1.7
/** Nettoyage ponctuel par une entreprise extérieure (sans agent d'entretien). */
export const CLEAN_COST = 120

// ── Géométrie (unités SVG) ───────────────────────────────────────────────────
export const SLOTS = 5
export const SW = 66          // largeur d'une case
export const SHAFT_W = 46     // cage d'ascenseur (à droite)
export const FH = 86          // hauteur d'étage
export const BW = SLOTS * SW + SHAFT_W

// ── Rythme ───────────────────────────────────────────────────────────────────
export const DAY_S = 30             // 1 cycle jour/nuit = 1 mois = 30 s
export const WALK = 46              // px/s
export const LIFT_SPEED = 2.3       // étages/s
export const LIFT_CAP = 8

export const START_CASH = 13000
export const LIFESTYLE = 8000       // train de vie mensuel = cible de liberté
/** Chaque logement du même type coûte plus cher : les meilleures affaires partent en premier. */
export const HOME_COST_GROWTH = 1.3
/** Les premiers logements de chaque type gardent leur prix de base : on démarre vite. */
export const HOME_COST_FREE: Partial<Record<RoomType, number>> = { studio: 4, t2: 1, penthouse: 0 }
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
