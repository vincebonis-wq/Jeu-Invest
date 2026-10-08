/**
 * OPEN SPACE — données de jeu.
 * Une tour de bureaux en coupe : des employés traitent des dossiers à leur poste
 * et font apparaître de l'argent ; il faut gérer leurs besoins (toilettes, café,
 * pause), la propreté, les pannes informatiques, l'encadrement et la recherche.
 * 1 cycle jour/nuit = 1 journée de travail.
 */

export type RoomType =
  | 'lobby' | 'openspace' | 'bureaupro' | 'direction'
  | 'wc' | 'cafe' | 'pause'
  | 'supervision' | 'menage' | 'it' | 'securite' | 'labo'
  | 'parking' | 'serveurs' | 'archives'

export type Need = 'bladder' | 'energy' | 'mood'
export type StaffRole = 'janitor' | 'tech' | 'guard' | 'researcher' | 'supervisor'

export interface RoomDef {
  type: RoomType
  name: string
  emoji: string
  w: number
  cost: number
  kind: 'fixed' | 'work' | 'facility' | 'service' | 'support'
  floor: 'ground' | 'upper' | 'any' | 'notBasement' | 'basement'
  spots?: number            // places de parking
  desks?: number            // postes de travail
  taskTime?: number         // secondes par dossier
  taskValue?: number        // € par dossier
  salary?: number           // € par jour et par employé
  serves?: Need             // besoin satisfait (pièces de vie)
  stations?: number         // cabines / machines / canapés
  useTime?: number
  staff?: StaffRole
  research?: string
  unlockFloors?: number
  wall: string
  desc: string
}

export const ROOMS: Record<RoomType, RoomDef> = {
  lobby:       { type: 'lobby', name: 'Accueil', emoji: '🛎️', w: 1, cost: 0, kind: 'fixed', floor: 'ground', wall: '#e9dcc6', desc: 'L’entrée de ta tour.' },
  openspace:   { type: 'openspace', name: 'Open space', emoji: '🖥️', w: 2, cost: 3000, kind: 'work', floor: 'notBasement', desks: 4, taskTime: 3, taskValue: 40, salary: 40, wall: '#e8eef6', desc: '4 postes de travail. Chaque dossier traité rapporte de l’argent : touche les billets pour encaisser.' },
  bureaupro:   { type: 'bureaupro', name: 'Bureaux premium', emoji: '💼', w: 2, cost: 12000, kind: 'work', floor: 'notBasement', desks: 3, taskTime: 5, taskValue: 150, salary: 130, research: 'pro', wall: '#e4e0f5', desc: '3 consultants seniors : des dossiers très rentables, mais exigeants (pause, café, propreté).' },
  direction:   { type: 'direction', name: 'Salle du conseil', emoji: '🏛️', w: 2, cost: 40000, kind: 'work', floor: 'upper', desks: 2, taskTime: 7, taskValue: 600, salary: 400, research: 'board', unlockFloors: 5, wall: '#f3e7cf', desc: '2 directeurs : des contrats énormes. Ils veulent un étage propre et calme.' },
  wc:          { type: 'wc', name: 'Toilettes', emoji: '🚻', w: 1, cost: 1500, kind: 'facility', floor: 'any', serves: 'bladder', stations: 2, useTime: 2.4, wall: '#dff1f5', desc: '2 cabines. Sans toilettes, tes employés souffrent… et travaillent mal. Elles se salissent vite.' },
  cafe:        { type: 'cafe', name: 'Coin café', emoji: '☕', w: 1, cost: 2000, kind: 'facility', floor: 'notBasement', serves: 'energy', stations: 2, useTime: 2.6, wall: '#f6dfc6', desc: 'Une machine à café pour recharger les batteries. Les gobelets finissent par terre.' },
  pause:       { type: 'pause', name: 'Salle de pause', emoji: '🛋️', w: 2, cost: 6000, kind: 'facility', floor: 'notBasement', serves: 'mood', stations: 3, useTime: 4, research: 'pause', wall: '#e3f3e1', desc: 'Canapés et baby-foot : les employés stressés y retrouvent le moral.' },
  supervision: { type: 'supervision', name: 'Bureau du superviseur', emoji: '🧑‍💼', w: 1, cost: 5000, kind: 'service', floor: 'notBasement', staff: 'supervisor', wall: '#efe7da', desc: 'Le superviseur fait le tour des postes de son étage et des étages voisins : les employés qu’il croise travaillent bien plus vite.' },
  menage:      { type: 'menage', name: 'Local d’entretien', emoji: '🧹', w: 1, cost: 1500, kind: 'service', floor: 'any', staff: 'janitor', wall: '#dcecf5', desc: 'L’agent d’entretien ramasse papiers, gobelets et peaux de banane, et récure les toilettes.' },
  it:          { type: 'it', name: 'Service informatique', emoji: '🔧', w: 1, cost: 3000, kind: 'service', floor: 'any', staff: 'tech', wall: '#e2e8f0', desc: 'Le technicien court réparer les ordinateurs en panne.' },
  securite:    { type: 'securite', name: 'Poste de sécurité', emoji: '👮', w: 1, cost: 5000, kind: 'service', floor: 'notBasement', staff: 'guard', research: 'securite', wall: '#dfe4ec', desc: 'Le vigile fait des rondes de nuit et arrête les voleurs avant qu’ils ne vident les postes.' },
  parking:     { type: 'parking', name: 'Parking', emoji: '🅿️', w: 2, cost: 4000, kind: 'support', floor: 'basement', spots: 3, wall: '#8a929c', desc: '3 places. Les employés motorisés arrivent par le garage, à l’heure et de bonne humeur. Sans place, ils tournent pour se garer : en retard et agacés.' },
  serveurs:    { type: 'serveurs', name: 'Salle des serveurs', emoji: '🗄️', w: 1, cost: 8000, kind: 'support', floor: 'basement', wall: '#1f2937', desc: 'Au frais sous terre : deux fois moins de pannes d’ordinateur dans toute la tour (cumulable deux fois).' },
  archives:    { type: 'archives', name: 'Archives', emoji: '🗃️', w: 2, cost: 7000, kind: 'support', floor: 'basement', wall: '#d6cfc0', desc: 'Des dossiers bien classés : +10 % sur chaque dossier traité dans toute la tour (jusqu’à 3 salles).' },
  labo:        { type: 'labo', name: 'Laboratoire R&D', emoji: '🔬', w: 1, cost: 4000, kind: 'service', floor: 'notBasement', staff: 'researcher', wall: '#eef2ff', desc: 'Des chercheurs produisent des points de recherche 💡 pour améliorer ton entreprise.' },
}

export const BUILD_ORDER: RoomType[] = ['openspace', 'wc', 'cafe', 'menage', 'it', 'supervision', 'labo', 'parking', 'serveurs', 'archives', 'pause', 'bureaupro', 'securite', 'direction']

export const STAFF: Record<StaffRole, { title: string; emoji: string; salary: number; cloth: string; cap: string }> = {
  janitor: { title: 'Agent d’entretien', emoji: '🧹', salary: 50, cloth: '#3a86ff', cap: '#1d4ed8' },
  tech: { title: 'Technicien IT', emoji: '🔧', salary: 80, cloth: '#2f6f3e', cap: '#1f4d2b' },
  guard: { title: 'Vigile', emoji: '👮', salary: 70, cloth: '#273043', cap: '#111827' },
  researcher: { title: 'Chercheur', emoji: '🧑‍🔬', salary: 90, cloth: '#f8fafc', cap: '' },
  supervisor: { title: 'Superviseur', emoji: '🧑‍💼', salary: 120, cloth: '#7c2d12', cap: '' },
}

/** Arbre de recherche (inspiré des améliorations de bureau classiques). */
export interface ResearchDef { id: string; name: string; emoji: string; desc: string; cost: number; req?: string }
export const RESEARCH: ResearchDef[] = [
  { id: 'espresso', name: 'Machine expresso', emoji: '☕', desc: 'Le café est servi deux fois plus vite et recharge plus d’énergie.', cost: 8 },
  { id: 'plants', name: 'Plantes vertes', emoji: '🪴', desc: 'Des plantes dans tous les bureaux : +10 de moral pour tout le monde.', cost: 10 },
  { id: 'chairs', name: 'Chaises ergonomiques', emoji: '🪑', desc: 'Les employés se fatiguent 35 % moins vite.', cost: 12 },
  { id: 'pc', name: 'Ordinateurs neufs', emoji: '💻', desc: '+20 % de vitesse de traitement et deux fois moins de pannes.', cost: 14 },
  { id: 'japaneseWc', name: 'Toilettes japonaises', emoji: '🚽', desc: 'Les toilettes se salissent deux fois moins.', cost: 12 },
  { id: 'pause', name: 'Salle de pause', emoji: '🛋️', desc: 'Débloque la salle de pause (moral).', cost: 16 },
  { id: 'securite', name: 'Vidéosurveillance', emoji: '📹', desc: 'Débloque le poste de sécurité et ses vigiles.', cost: 15 },
  { id: 'coaching', name: 'Coaching managérial', emoji: '📣', desc: 'Les superviseurs boostent deux fois plus longtemps et couvrent un étage de plus.', cost: 20 },
  { id: 'screens', name: 'Double écran', emoji: '🖥️', desc: '+25 % de vitesse de traitement.', cost: 22, req: 'pc' },
  { id: 'pro', name: 'Bureaux premium', emoji: '💼', desc: 'Débloque les bureaux premium et leurs consultants.', cost: 24 },
  { id: 'badge', name: 'Badgeuse', emoji: '⏰', desc: 'Tout le monde arrive à l’heure : la journée de travail dure une heure de plus.', cost: 22 },
  { id: 'training', name: 'Formation continue', emoji: '🎓', desc: 'Chaque dossier rapporte 25 % de plus.', cost: 28 },
  { id: 'servers', name: 'Serveurs maison', emoji: '🗄️', desc: 'Encore deux fois moins de pannes, réparations deux fois plus rapides.', cost: 26, req: 'pc' },
  { id: 'lift2', name: 'Ascenseur rapide', emoji: '🛗', desc: 'Permet de moderniser l’ascenseur (niveau 2).', cost: 16 },
  { id: 'autopay', name: 'Virement automatique', emoji: '🏦', desc: 'L’argent des dossiers arrive directement sur ton compte (plus besoin de toucher les billets).', cost: 40 },
  { id: 'lift3', name: 'Ascenseur express', emoji: '🚀', desc: 'Permet le niveau 3 de l’ascenseur.', cost: 40, req: 'lift2' },
  { id: 'board', name: 'Conseil d’administration', emoji: '🏛️', desc: 'Débloque la salle du conseil et ses directeurs (5 étages requis).', cost: 60, req: 'pro' },
]
export const RP_RATE = 0.35

// ── Géométrie (unités SVG) ───────────────────────────────────────────────────
export const SLOTS = 5
export const SW = 66
export const SHAFT_W = 46
export const FH = 86
export const BW = SLOTS * SW + SHAFT_W

// ── Rythme ───────────────────────────────────────────────────────────────────
export const DAY_S = 80             // 1 cycle jour/nuit = 1 journée de travail
export const WORK_START = 0.25      // ≈ 6 h (ils arrivent entre 6 h et 8 h)
export const WORK_END = 0.78        // ≈ 19 h
export const WALK = 70
export const LIFT_SPEED = 2.3
export const LIFT_CAP = 8
export const STAIR_S = 1.7

export const START_CASH = 9000
export const COST_GROWTH = 1.22
export const BANK_CAP = 6           // dossiers non encaissés avant que l'employé ne s'arrête
export const CLEAN_COST = 40
export const FIX_COST = 120
export const HIRE_COST = 150

export const liftInstallCost = (floors: number) => 2500 + 600 * floors
export const liftExtendCost = (n: number) => Math.round(1000 * Math.pow(1.3, Math.abs(n) - 1))

export function floorCost(n: number) {
  return n > 0 ? Math.round(5000 * Math.pow(1.55, n - 1)) : Math.round(8000 * Math.pow(1.8, -n - 1))
}
export function chargesPerDay(floors: number, basements: number) {
  return 30 + floors * 20 + basements * 25
}

/** Paliers de l'entreprise selon le bénéfice quotidien. */
export const TIERS = [
  { min: 0, title: 'Garage', emoji: '🚲' },
  { min: 1000, title: 'Start-up', emoji: '🚀' },
  { min: 3000, title: 'TPE', emoji: '🏪' },
  { min: 8000, title: 'PME', emoji: '🏢' },
  { min: 20000, title: 'ETI', emoji: '🏙️' },
  { min: 50000, title: 'Grand groupe', emoji: '🌆' },
  { min: 120000, title: 'Multinationale', emoji: '🌍' },
]

export const FIRST_NAMES = ['Léa', 'Hugo', 'Inès', 'Tom', 'Jade', 'Nathan', 'Chloé', 'Louis', 'Emma', 'Adam', 'Sarah', 'Noah', 'Lina', 'Jules', 'Zoé', 'Malik', 'Camille', 'Yanis', 'Manon', 'Théo', 'Alice', 'Rayan', 'Lou', 'Gabriel']
export const SKINS = ['#f2c9a0', '#e0a97a', '#c68a5b', '#8d5a3b', '#f6d7b8', '#b9784f']
export const SHIRTS = ['#ffffff', '#dbeafe', '#e0f2fe', '#fce7f3', '#fef3c7', '#dcfce7', '#ede9fe', '#f1f5f9']
export const TIES = ['#e63946', '#1d3557', '#2a9d8f', '#f4a261', '#8338ec', '#ff006e', '#3a86ff', '#111827']
export const HAIR = ['#2b1d14', '#5b3a29', '#a0522d', '#d4a017', '#111111', '#7a7a7a', '#c0392b']

/** Déchets visibles au sol. */
export const TRASH_KINDS = ['paper', 'cup', 'banana', 'pizza', 'puddle', 'can'] as const
export type TrashKind = typeof TRASH_KINDS[number] | 'wcpaper' | 'wcpuddle'
