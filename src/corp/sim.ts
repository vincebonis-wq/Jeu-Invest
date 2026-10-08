/**
 * OPEN SPACE — simulation.
 *
 * Deux couches :
 *  - Game  : l'état persistant (pièces, employés, argent, déchets, recherches).
 *  - World : la vie transitoire (personnages, ascenseur, files), recréée au chargement.
 */

import {
  ROOMS, SLOTS, LEFT_SLOTS, SHAFT_X0, COL_B_X0, COL_X_X0, slotX, SW, SHAFT_W, DAY_S, WALK, LIFT_SPEED, LIFT_CAP, START_CASH, STAIR_S, WORK_START, WORK_END,
  COST_GROWTH, CLEAN_COST, FIX_COST, HIRE_COST, RESEARCH, RP_RATE, STAFF, TIERS, TRASH_KINDS,
  FIRST_NAMES, SKINS, SHIRTS, TIES, HAIR, liftInstallCost, liftExtendCost, floorCost, chargesPerDay,
  type RoomType, type StaffRole, type TrashKind,
} from './data'

// ── État persistant ──────────────────────────────────────────────────────────
export interface Employee { id: string; name: string; skin: string; shirt: string; tie: string; hair: string; mood: number; car?: boolean }
export interface Trash { id: string; x: number; kind: TrashKind }
export interface Room {
  id: string; type: RoomType; floor: number; slot: number; level: number
  workers: (Employee | null)[]     // un par poste
  bank: number[]                   // argent non encaissé par poste
  broken: boolean[]                // ordinateur en panne par poste
  trash: Trash[]
  builtAt: number
}
export interface Quest { id: string; title: string; kind: QuestKind; target: number; param?: string; reward: number; done?: boolean }
export type QuestKind = 'collect' | 'build' | 'count' | 'floors' | 'employees' | 'profit' | 'lift' | 'research'

export interface Game {
  version: 3
  cash: number
  day: number
  top: number
  bottom: number
  liftLevel: number
  liftOn: boolean
  liftTop: number
  liftBottom: number
  lift2?: { on: boolean; top: number; bottom: number }     // ascenseur n°2 (bout de l'aile droite)
  express?: { on: boolean; top: number; bottom: number }   // ascenseur express
  rp: number
  research: string[]
  rooms: Room[]
  dayEarned: number
  dayHist: number[]                // bénéfice net des derniers jours
  stats: { earned: number; salaries: number; collects: number; files: number; repairs: number; cleans: number; quits: number; stolen: number; caught: number; peak: number }
  quests: Quest[]
  questCursor: number
  tier: number
  lastSeen: number
  introDone: boolean
  muted: boolean
  speed?: number              // vitesse choisie : 1, 2 ou 4
  fastNight?: boolean         // nuit accélérée (activée par défaut)
}

export const NIGHT_MULT = 6
/** Nuit « creuse » : bureaux vides, on peut accélérer. */
export function isQuietNight(g: Game, w: World) {
  const p = g.day % 1
  const night = p >= WORK_END + 0.07 || p < WORK_START - 0.03
  void w
  return night
}
export function timeScale(g: Game, w: World) {
  return (g.speed ?? 1) * (g.fastNight !== false && isQuietNight(g, w) ? NIGHT_MULT : 1)
}

let seq = 0
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]

export function newEmployee(): Employee {
  return { id: uid('e'), name: pick(FIRST_NAMES), skin: pick(SKINS), shirt: pick(SHIRTS), tie: pick(TIES), hair: pick(HAIR), mood: 72, car: Math.random() < 0.5 }
}

/** Anciennes sauvegardes : tirer au sort qui vient en voiture. */
export function migrate(g: Game) {
  for (const r of g.rooms) for (const e of r.workers) if (e && e.car === undefined) e.car = Math.random() < 0.5
  // L'argent n'est plus « à encaisser » : ce qui restait sur les postes arrive sur le compte.
  for (const r of g.rooms) { g.cash += r.bank.reduce((a, b) => a + b, 0); r.bank = r.bank.map(() => 0) }
  g.research = g.research.filter((x) => x !== 'autopay')
  return g
}

function makeRoom(type: RoomType, floor: number, slot: number, day: number): Room {
  const n = ROOMS[type].desks ?? 0
  return {
    id: uid('r'), type, floor, slot, level: 1,
    workers: Array.from({ length: n }, () => newEmployee()),
    bank: Array(n).fill(0), broken: Array(n).fill(false), trash: [], builtAt: day,
  }
}

export function createGame(): Game {
  const lobby: Room = { id: 'lobby', type: 'lobby', floor: 0, slot: 0, level: 1, workers: [], bank: [], broken: [], trash: [], builtAt: 0 }
  const os = makeRoom('openspace', 0, 1, 0)
  const g: Game = {
    version: 3, cash: START_CASH, day: 0.27, top: 1, bottom: 0, liftLevel: 1, liftOn: false, liftTop: 0, liftBottom: 0,
    rp: 0, research: [], rooms: [lobby, os], dayEarned: 0, dayHist: [],
    stats: { earned: 0, salaries: 0, collects: 0, files: 0, repairs: 0, cleans: 0, quits: 0, stolen: 0, caught: 0, peak: 0 },
    quests: [], questCursor: 0, tier: 0, lastSeen: Date.now(), introDone: false, muted: false,
  }
  fillQuests(g)
  return g
}

// ── Géométrie ────────────────────────────────────────────────────────────────
export const shaftX = SHAFT_X0 + SHAFT_W / 2
export const EXIT_X = -70
/** Paliers d'ascenseur : une porte de chaque côté de la cage. */
export const DOOR_X = SHAFT_X0 - 6
export const DOOR_R = SHAFT_X0 + SHAFT_W + 6
export const stairX = (f: number) => (((Math.round(f) % 2) + 2) % 2 === 0 ? SHAFT_X0 + 8 : SHAFT_X0 + SHAFT_W - 8)
export const stairServed = (g: Game, k: number) => g.liftOn && k >= g.liftBottom && k + 1 <= g.liftTop
export const roomX = (r: Room, frac = 0.5) => slotX(r.slot) + ROOMS[r.type].w * SW * frac
export const deskX = (r: Room, i: number) => slotX(r.slot) + (i + 0.5) * (ROOMS[r.type].w * SW / Math.max(1, ROOMS[r.type].desks ?? 1))

export function roomAt(g: Game, floor: number, slot: number) {
  return g.rooms.find((r) => r.floor === floor && slot >= r.slot && slot < r.slot + ROOMS[r.type].w)
}

export function canPlace(g: Game, type: RoomType, floor: number, slot: number) {
  const d = ROOMS[type]
  if (floor > g.top || floor < g.bottom) return false
  if (slot < 0 || slot + d.w > SLOTS) return false
  if (slot < LEFT_SLOTS && slot + d.w > LEFT_SLOTS) return false   // pas à cheval sur la cage
  if (d.floor === 'ground' && floor !== 0) return false
  if (d.floor === 'upper' && floor < 1) return false
  if (d.floor === 'notBasement' && floor < 0) return false
  if (d.floor === 'basement' && floor >= 0) return false
  if (type === 'escalator' && floor >= g.top) return false   // il faut un étage au-dessus
  for (let i = 0; i < d.w; i++) if (roomAt(g, floor, slot + i)) return false
  return true
}

export const has = (g: Game, id: string) => g.research.includes(id)

export function isUnlocked(g: Game, t: RoomType) {
  const d = ROOMS[t]
  return (d.unlockFloors ?? 0) <= g.top && (!d.research || has(g, d.research))
}

// ── Économie ─────────────────────────────────────────────────────────────────
const countOf = (g: Game, t: RoomType) => g.rooms.filter((r) => r.type === t).length
export const archivesBonus = (g: Game) => 0.05 * Math.min(3, countOf(g, 'archives'))
export const serversMult = (g: Game) => Math.pow(0.5, Math.min(2, countOf(g, 'serveurs')))
export function valueMult(g: Game, r: Room) {
  return (has(g, 'training') ? 1.15 : 1) * (1 + 0.15 * (r.level - 1)) * (1 + archivesBonus(g))
}
export const fileValue = (g: Game, r: Room) => (ROOMS[r.type].taskValue ?? 0) * valueMult(g, r)

export function employees(g: Game) {
  return g.rooms.reduce((a, r) => a + r.workers.filter(Boolean).length, 0)
}

export function staffSalaries(g: Game) {
  return g.rooms.reduce((a, r) => { const role = ROOMS[r.type].staff; return a + (role ? STAFF[role].salary * r.level : 0) }, 0)
}
export function workerSalaries(g: Game) {
  return g.rooms.reduce((a, r) => a + r.workers.filter(Boolean).length * (ROOMS[r.type].salary ?? 0), 0)
}
export function buildingCharges(g: Game) {
  return chargesPerDay(g.top, -g.bottom) + liftDefs(g).filter((d) => d.on).length * (20 + (g.liftLevel - 1) * 25)
}
export function dailyCosts(g: Game) {
  return workerSalaries(g) + staffSalaries(g) + buildingCharges(g)
}

/** Bénéfice quotidien moyen (3 derniers jours), ou estimation au démarrage. */
export function profitPerDay(g: Game) {
  const h = g.dayHist.slice(-3)
  if (h.length) return h.reduce((a, b) => a + b, 0) / h.length
  // Estimation : ~60 % du temps de travail effectif.
  let prod = 0
  for (const r of g.rooms) if (ROOMS[r.type].kind === 'work') prod += r.workers.filter(Boolean).length * (WORK_END - WORK_START) * DAY_S * 0.6 / (ROOMS[r.type].taskTime ?? 4) * fileValue(g, r)
  return prod - dailyCosts(g)
}

export function tierOf(profit: number) {
  let t = 0
  for (let i = 0; i < TIERS.length; i++) if (profit >= TIERS[i].min) t = i
  return t
}

export function buildingValue(g: Game) {
  let v = 0
  for (let f = 1; f <= g.top; f++) v += floorCost(f) * 0.8
  for (let f = -1; f >= g.bottom; f--) v += floorCost(f) * 0.8
  for (const r of g.rooms) v += ROOMS[r.type].cost * (1 + 0.5 * (r.level - 1))
  return v
}
export function netWorth(g: Game) {
  return g.cash + buildingValue(g) + g.rooms.reduce((a, r) => a + r.bank.reduce((x, y) => x + y, 0), 0)
}

export function avgMood(g: Game) {
  const e = g.rooms.flatMap((r) => r.workers).filter(Boolean) as Employee[]
  return e.length ? e.reduce((a, x) => a + x.mood, 0) / e.length : 70
}

// ── Actions joueur ───────────────────────────────────────────────────────────
export function roomCost(g: Game, type: RoomType) {
  const d = ROOMS[type]
  const n = g.rooms.filter((r) => r.type === type).length
  return Math.round(d.cost * Math.pow(d.kind === 'work' ? COST_GROWTH : 1.35, n))
}

export function build(g: Game, type: RoomType, floor: number, slot: number) {
  const cost = roomCost(g, type)
  if (!canPlace(g, type, floor, slot) || g.cash < cost || !isUnlocked(g, type)) return null
  g.cash -= cost
  const r = makeRoom(type, floor, slot, g.day)
  g.rooms.push(r)
  return r
}

export function buildFloor(g: Game, up: boolean) {
  const n = up ? g.top + 1 : g.bottom - 1
  const c = floorCost(n)
  if (g.cash < c) return false
  g.cash -= c
  if (up) g.top = n; else g.bottom = n
  return true
}

/** Encaisse l'argent de tous les postes d'une pièce. */
export function collect(g: Game, r: Room) {
  const v = r.bank.reduce((a, b) => a + b, 0)
  if (v < 1) return 0
  r.bank = r.bank.map(() => 0)
  g.cash += v
  g.stats.collects++
  return v
}

export const renovateCost = (r: Room) => Math.round(ROOMS[r.type].cost * (0.8 + 0.6 * r.level))
export const canRenovate = (r: Room) => r.level < 3 && ROOMS[r.type].kind !== 'fixed' && ROOMS[r.type].kind !== 'support'
export function renovate(g: Game, r: Room) {
  const c = renovateCost(r)
  if (!canRenovate(r) || g.cash < c) return false
  g.cash -= c
  r.level++
  for (const e of r.workers) if (e) e.mood = Math.min(100, e.mood + 10)
  return true
}

/** Ménage ponctuel (sans agent d'entretien) : tout le local est nettoyé. */
export function cleanRoom(g: Game, r: Room) {
  if (!r.trash.length || g.cash < CLEAN_COST) return false
  g.cash -= CLEAN_COST
  r.trash = []
  g.stats.cleans++
  return true
}
/** Réparation ponctuelle d'un poste (sans technicien). */
export function fixDesk(g: Game, r: Room, i: number) {
  if (!r.broken[i] || g.cash < FIX_COST) return false
  g.cash -= FIX_COST
  r.broken[i] = false
  g.stats.repairs++
  return true
}

export const liftCost = (lvl: number) => [0, 6000, 20000][lvl] ?? Infinity
export const liftNeeds = (lvl: number) => (lvl === 1 ? 'lift2' : 'lift3')
export function upgradeLift(g: Game) {
  const c = liftCost(g.liftLevel)
  if (!g.liftOn || g.liftLevel >= 3 || g.cash < c || !has(g, liftNeeds(g.liftLevel))) return false
  g.cash -= c
  g.liftLevel++
  return true
}
export function sell(g: Game, r: Room) {
  if (r.type === 'lobby') return 0
  const v = ROOMS[r.type].cost * 0.5 + r.bank.reduce((a, b) => a + b, 0)
  g.cash += v
  g.rooms = g.rooms.filter((x) => x.id !== r.id)
  return v
}

export function canResearch(g: Game, id: string) {
  const d = RESEARCH.find((x) => x.id === id)
  return !!d && !has(g, id) && (!d.req || has(g, d.req)) && g.rp >= d.cost
}
export function doResearch(g: Game, id: string) {
  const d = RESEARCH.find((x) => x.id === id)
  if (!d || !canResearch(g, id)) return false
  g.rp -= d.cost
  g.research.push(id)
  return true
}

// ── Événements ───────────────────────────────────────────────────────────────
export type GEvent =
  | { kind: 'quest'; quest: Quest }
  | { kind: 'tier'; tier: number }
  | { kind: 'quit'; name: string }
  | { kind: 'theft'; amount: number; room: Room }
  | { kind: 'caught'; byGuard: boolean }
  | { kind: 'day'; net: number }

// ── Objectifs ────────────────────────────────────────────────────────────────
const SCRIPT: Omit<Quest, 'id'>[] = [
  { kind: 'build', param: 'wc', title: 'Construis des toilettes', target: 1, reward: 1200 },
  { kind: 'build', param: 'cafe', title: 'Installe un coin café', target: 1, reward: 1500 },
  { kind: 'build', param: 'menage', title: 'Embauche un agent d’entretien', target: 1, reward: 1500 },
  { kind: 'count', param: 'openspace', title: 'Ouvre un 2ᵉ open space', target: 2, reward: 2500 },
  { kind: 'build', param: 'it', title: 'Ouvre le service informatique', target: 1, reward: 2000 },
  { kind: 'floors', title: 'Construis le 2ᵉ étage', target: 2, reward: 3000 },
  { kind: 'build', param: 'parking', title: 'Creuse un sous-sol et ouvre un parking', target: 1, reward: 4000 },
  { kind: 'lift', title: 'Installe l’ascenseur', target: 1, reward: 2500 },
  { kind: 'build', param: 'supervision', title: 'Recrute un superviseur', target: 1, reward: 3000 },
  { kind: 'build', param: 'labo', title: 'Ouvre un laboratoire R&D', target: 1, reward: 2500 },
  { kind: 'research', title: 'Termine une recherche', target: 1, reward: 2000 },
  { kind: 'employees', title: 'Atteins 12 employés', target: 12, reward: 4000 },
  { kind: 'profit', title: 'Atteins 1 000 € de bénéfice par jour', target: 1000, reward: 5000 },
  { kind: 'build', param: 'pause', title: 'Ouvre une salle de pause', target: 1, reward: 4000 },
  { kind: 'floors', title: 'Monte à 4 étages', target: 4, reward: 6000 },
  { kind: 'build', param: 'bureaupro', title: 'Ouvre des bureaux premium', target: 1, reward: 8000 },
  { kind: 'profit', title: 'Atteins 3 000 € de bénéfice par jour', target: 3000, reward: 10000 },
  { kind: 'build', param: 'securite', title: 'Installe un poste de sécurité', target: 1, reward: 6000 },
  { kind: 'floors', title: 'Monte à 6 étages', target: 6, reward: 15000 },
  { kind: 'profit', title: 'Atteins 8 000 € de bénéfice par jour', target: 8000, reward: 25000 },
  { kind: 'build', param: 'direction', title: 'Installe le conseil d’administration', target: 1, reward: 40000 },
  { kind: 'profit', title: 'Atteins 20 000 € de bénéfice par jour', target: 20000, reward: 60000 },
]
function generated(n: number): Omit<Quest, 'id'> {
  const k = Math.pow(2, n + 1)
  return n % 2 === 0
    ? { kind: 'profit', title: `Atteins ${Math.round(20000 * k).toLocaleString('fr-FR')} € de bénéfice par jour`, target: Math.round(20000 * k), reward: Math.round(60000 * k) }
    : { kind: 'floors', title: `Monte à ${8 + n * 2} étages`, target: 8 + n * 2, reward: Math.round(50000 * k) }
}
export function fillQuests(g: Game) {
  while (g.quests.length < 3) {
    const tpl = g.questCursor < SCRIPT.length ? SCRIPT[g.questCursor] : generated(g.questCursor - SCRIPT.length)
    g.questCursor++
    g.quests.push({ ...tpl, id: `q${g.questCursor}` })
  }
}
export function questProgress(g: Game, q: Quest) {
  switch (q.kind) {
    case 'collect': return g.stats.collects
    case 'build': return g.rooms.some((r) => r.type === q.param) ? 1 : 0
    case 'count': return g.rooms.filter((r) => r.type === q.param).length
    case 'floors': return g.top
    case 'employees': return employees(g)
    case 'profit': return g.dayHist.length ? g.dayHist[g.dayHist.length - 1] : 0
    case 'lift': return g.liftOn ? 1 : 0
    case 'research': return g.research.length
  }
}
export function claimQuest(g: Game, id: string) {
  const q = g.quests.find((x) => x.id === id)
  if (!q?.done) return 0
  g.cash += q.reward
  g.quests = g.quests.filter((x) => x.id !== id)
  fillQuests(g)
  return q.reward
}
export function checkProgress(g: Game, ev: GEvent[]) {
  const nw = netWorth(g)
  if (nw > g.stats.peak) g.stats.peak = nw
  if (g.dayHist.length) {
    const t = tierOf(profitPerDay(g))
    if (t > g.tier) { g.tier = t; ev.push({ kind: 'tier', tier: t }) }
  }
  for (const q of g.quests) if (!q.done && questProgress(g, q) >= q.target) { q.done = true; ev.push({ kind: 'quest', quest: q }) }
}

export function applyOffline(g: Game, now: number) {
  const days = Math.min(8, Math.max(0, (now - g.lastSeen) / 1000 / (DAY_S * 4)))
  g.lastSeen = now
  if (days < 0.25) return null
  const gained = Math.max(0, profitPerDay(g)) * days * 0.5
  g.cash += gained
  return { days, gained }
}

// ════════════════════════════════════════════════════════════════════════════
// WORLD — la vie de la tour
// ════════════════════════════════════════════════════════════════════════════
export type Step =
  | { t: 'walk'; x: number }
  | { t: 'lift'; liftId: LiftId; to: number }
  | { t: 'escal'; roomId: string; to: number }
  | { t: 'stairs'; to: number; said?: boolean }
  | { t: 'enter'; roomId: string }
  | { t: 'queue'; roomId: string }
  | { t: 'serve'; roomId: string; idx: number }
  | { t: 'work'; roomId: string; idx: number }
  | { t: 'fix'; roomId: string; idx: number; dur: number; total?: number }
  | { t: 'pick'; roomId: string; trashId: string; dur: number }
  | { t: 'dump'; dur: number }
  | { t: 'coach'; targetId: string; dur: number }
  | { t: 'research'; roomId: string; dur: number }
  | { t: 'wait'; dur: number; icon?: string }
  | { t: 'steal'; roomId: string; dur: number }
  | { t: 'chase'; thiefId: string }
  | { t: 'drive'; carId: string }
  | { t: 'door'; liftId: LiftId }
  | { t: 'gone' }

export interface Agent {
  id: string
  kind: 'worker' | 'staff' | 'thief'
  role?: StaffRole
  roomId?: string          // pièce de travail (employé) ou local (personnel)
  idx?: number             // poste
  empId?: string
  floor: number
  x: number
  steps: Step[]
  skin: string; cloth: string; hair: string; tie?: string
  icon: string | null
  iconT: number
  walking: boolean
  dir: 1 | -1
  inLift: boolean
  liftId?: LiftId
  waitT: number
  away: boolean
  speed: number
  carry?: 'wrench' | 'bag' | 'trashbag' | 'sack' | 'clipboard' | 'cup'
  task?: string
  energy: number
  bladder: number
  bRate: number            // vitesse à laquelle l'envie monte (propre à chacun)
  eRate: number            // vitesse de fatigue
  bMax: number             // seuil où il se lève pour y aller
  needCd: number           // « je patiente encore un peu »
  sweepDir?: 1 | -1        // sens de balayage de l'agent d'entretien
  boostT: number
  needT: number
  prog: number
  bagN: number
  loot?: number
  lootRoom?: string
  caught?: boolean
  spotted?: boolean        // voleur repéré (caméras ou vigile)
  seenF?: number           // dernière position connue
  seenX?: number
  camT?: number            // délai avant que les caméras ne le repèrent
  arrive: number
  leave: number
  lastDay: number
  done: Set<string>
}

export interface Lift { y: number; dir: 1 | -1; riders: string[]; stopT: number; door: number; waiting: Map<number, string[]>; skip?: number | null; avgWait?: number }
export interface Station { agentId: string | null; t: number; dur: number; phase: 'idle' | 'reserved' | 'run' | 'done'; doneT: number }

export interface World {
  agents: Agent[]
  lifts: Record<LiftId, Lift>
  stations: Record<string, Station[]>
  queues: Record<string, string[]>
  thiefDay: number
  cars: Car[]
  pops: { id: number; x: number; floor: number; amount: number; t: number }[]
}
let popSeq = 1

/** Voiture d'un employé : garée, qui sort par le tunnel, dehors, ou qui arrive. */
export interface Car { id: string; color: string; roomId: string; spot: number; floor: number; x: number; state: 'parked' | 'leave' | 'out' | 'arrive'; dir: 1 | -1 }
export const GARAGE_X = -46
const CAR_SPEED = 85
export const spotX = (r: Room, i: number) => slotX(r.slot) + 24 + i * 42
const CAR_COLORS = ['#e63946', '#3a86ff', '#ffbe0b', '#2a9d8f', '#8338ec', '#f4a261', '#ef476f', '#118ab2', '#6d6875', '#06d6a0']

export function parkingStatus(g: Game) {
  const spots = g.rooms.reduce((a, r) => a + (ROOMS[r.type].spots ?? 0), 0)
  const cars = g.rooms.reduce((a, r) => a + r.workers.filter((e) => e?.car).length, 0)
  return { spots, cars }
}

function syncCars(g: Game, w: World) {
  const owners = (g.rooms.flatMap((r) => r.workers).filter((e) => e?.car) as Employee[])
  w.cars = w.cars.filter((c) => owners.some((e) => e.id === c.id) && g.rooms.some((r) => r.id === c.roomId))
  for (const c of w.cars) if (c.state === 'out') {
    // Propriétaire déjà sur place (arrivé autrement) : sa voiture est garée.
    const a = w.agents.find((x) => x.empId === c.id)
    const r = roomOf(g, c.roomId)
    if (a && !a.away && r && !a.steps.some((s) => s.t === 'drive')) { c.state = 'parked'; c.x = spotX(r, c.spot); c.floor = r.floor }
  }
  const taken = new Set(w.cars.map((c) => `${c.roomId}:${c.spot}`))
  const spots: { r: Room; i: number }[] = []
  for (const r of g.rooms) for (let i = 0; i < (ROOMS[r.type].spots ?? 0); i++) if (!taken.has(`${r.id}:${i}`)) spots.push({ r, i })
  for (const e of owners) {
    if (w.cars.some((c) => c.id === e.id)) continue
    const sp = spots.shift()
    if (!sp) break
    const a = w.agents.find((x) => x.empId === e.id)
    const h = e.id.charCodeAt(e.id.length - 1) + e.id.charCodeAt(e.id.length - 2)
    w.cars.push({ id: e.id, color: CAR_COLORS[h % CAR_COLORS.length], roomId: sp.r.id, spot: sp.i, floor: sp.r.floor, x: spotX(sp.r, sp.i), state: !a || a.away ? 'out' : 'parked', dir: -1 })
  }
}

function runCars(g: Game, w: World, dt: number) {
  for (const c of w.cars) {
    const r = roomOf(g, c.roomId)
    if (!r) continue
    if (c.state === 'leave') {
      c.dir = -1
      c.x -= CAR_SPEED * dt
      if (c.x <= GARAGE_X - 30) c.state = 'out'
    } else if (c.state === 'arrive') {
      const tx = spotX(r, c.spot)
      c.dir = 1
      c.x = Math.min(tx, c.x + CAR_SPEED * dt)
      if (c.x >= tx) {
        c.state = 'parked'
        const a = w.agents.find((x) => x.empId === c.id)
        const wr = a && roomOf(g, a.roomId)
        if (a && wr && a.idx != null) {
          a.away = false; a.floor = c.floor; a.x = c.x + 18; a.dir = 1; a.carry = 'bag'
          a.energy = 75 + Math.random() * 25; a.bladder = Math.random() * 70
          a.steps = [...routeA(a, wr.floor, deskX(wr, a.idx)), { t: 'work', roomId: wr.id, idx: a.idx }]
        }
      }
    }
  }
}

// ── Pièces de vie (toilettes, café, pause) ───────────────────────────────────
export const PATIENCE = 12
export function stationCount(r: Room) { return (ROOMS[r.type].stations ?? 0) + (r.level - 1) }
export function stationX(r: Room, i: number) {
  const w = ROOMS[r.type].w * SW
  const n = stationCount(r)
  return slotX(r.slot) + 6 + (i + 0.5) * ((w - 14) / n)
}
export function queueX(r: Room, i: number) { return slotX(r.slot) + ROOMS[r.type].w * SW - 6 + i * 9 }
export function stationsOf(w: World, r: Room) {
  const n = stationCount(r)
  const st = w.stations[r.id] ?? (w.stations[r.id] = [])
  while (st.length < n) st.push({ agentId: null, t: 0, dur: 0, phase: 'idle', doneT: 0 })
  return st
}
export function useTime(g: Game, t: RoomType) {
  const base = ROOMS[t].useTime ?? 3
  return t === 'cafe' && has(g, 'espresso') ? base * 0.5 : base
}

// ── Transports : ascenseurs (central, n°2, express), escalators, escalier ────
export type LiftId = 'A' | 'B' | 'X'
export interface LiftDef { id: LiftId; name: string; x0: number; on: boolean; top: number; bottom: number; express: boolean }
export function liftDefs(g: Game): LiftDef[] {
  return [
    { id: 'A', name: 'Ascenseur central', x0: SHAFT_X0, on: g.liftOn, top: g.liftTop, bottom: g.liftBottom, express: false },
    { id: 'B', name: 'Ascenseur n°2', x0: COL_B_X0, on: !!g.lift2?.on, top: g.lift2?.top ?? 0, bottom: g.lift2?.bottom ?? 0, express: false },
    { id: 'X', name: 'Ascenseur express', x0: COL_X_X0, on: !!g.express?.on, top: g.express?.top ?? 0, bottom: g.express?.bottom ?? 0, express: true },
  ]
}
/** L'express ne s'arrête qu'au hall, tous les 4 étages, et en bout de course. */
export const liftStops = (d: LiftDef, f: number) => f >= d.bottom && f <= d.top && (!d.express || f === 0 || f === d.top || f === d.bottom || (f > 0 && f % 4 === 0))
export const liftCap = (g: Game, d: LiftDef) => LIFT_CAP + (g.liftLevel - 1) * 3 + (d.express ? 6 : 0)
export const liftSpeed = (g: Game, d: LiftDef) => LIFT_SPEED * (1 + 0.45 * (g.liftLevel - 1)) * (d.express ? 2.2 : 1)
export const liftUnlocked = (g: Game, id: LiftId) => id === 'A' ? true : id === 'B' ? g.top >= 3 : has(g, 'express') && g.top >= 4
export function liftInstallPrice(g: Game, id: LiftId) {
  const n = g.top - g.bottom
  return id === 'A' ? liftInstallCost(n) : id === 'B' ? Math.round(liftInstallCost(n) * 1.5) : 15000 + 1500 * n
}
export function liftExtendPrice(id: LiftId, n: number) {
  return Math.round(liftExtendCost(n) * (id === 'A' ? 1 : id === 'B' ? 1.2 : 2))
}
function liftState(g: Game, id: LiftId): { on: boolean; top: number; bottom: number } {
  if (id === 'A') return { on: g.liftOn, top: g.liftTop, bottom: g.liftBottom }
  return (id === 'B' ? g.lift2 : g.express) ?? { on: false, top: 0, bottom: 0 }
}
function setLiftState(g: Game, id: LiftId, st: { on: boolean; top: number; bottom: number }) {
  if (id === 'A') { g.liftOn = st.on; g.liftTop = st.top; g.liftBottom = st.bottom } else if (id === 'B') g.lift2 = st; else g.express = st
}
export function installLift(g: Game, id: LiftId = 'A') {
  const c = liftInstallPrice(g, id)
  if (liftState(g, id).on || !liftUnlocked(g, id) || g.cash < c) return false
  g.cash -= c
  setLiftState(g, id, { on: true, top: g.top, bottom: g.bottom })
  return true
}
export function extendLift(g: Game, up: boolean, id: LiftId = 'A') {
  const st = liftState(g, id)
  if (!st.on) return false
  const n = up ? st.top + 1 : st.bottom - 1
  if (up ? n > g.top : n < g.bottom) return false
  const c = liftExtendPrice(id, n)
  if (g.cash < c) return false
  g.cash -= c
  setLiftState(g, id, up ? { ...st, top: n } : { ...st, bottom: n })
  return true
}

/** Escalator d'une pièce : bas à gauche (étage r.floor), haut à droite (étage r.floor + 1). */
export const escX = (r: Room) => ({ lo: slotX(r.slot) + 9, hi: slotX(r.slot) + SW - 9 })

let G: Game | null = null
let WREF: World | null = null
function setLR(g: Game, w?: World) { G = g; if (w) WREF = w }

/**
 * Chemin le plus rapide d'un point à un autre (Dijkstra) : marche, attente et trajet
 * dans chaque ascenseur, escalators, escalier dans la cage centrale.
 */
function route(fromFloor: number, toFloor: number, toX: number, fromX = 20): Step[] {
  const from = Math.round(fromFloor), to = Math.round(toFloor)
  if (from === to || !G) return [{ t: 'walk', x: toX }]
  const g = G
  type N = { f: number; x: number; kind: 'p' | 'door' | 'car' | 'esc' | 'stair' | 'goal'; lift?: LiftId; room?: string }
  const nodes: N[] = [{ f: from, x: fromX, kind: 'p' }, { f: to, x: toX, kind: 'goal' }]
  const defs = liftDefs(g).filter((d) => d.on && d.top > d.bottom)
  for (const d of defs) for (let f = d.bottom; f <= d.top; f++) if (liftStops(d, f)) {
    nodes.push({ f, x: d.x0 + SHAFT_W / 2, kind: 'door', lift: d.id }, { f, x: d.x0 + SHAFT_W / 2, kind: 'car', lift: d.id })
  }
  for (const r of g.rooms) if (r.type === 'escalator' && r.floor < g.top) {
    const e = escX(r)
    nodes.push({ f: r.floor, x: e.lo, kind: 'esc', room: r.id }, { f: r.floor + 1, x: e.hi, kind: 'esc', room: r.id })
  }
  for (let k = g.bottom; k < g.top; k++) if (!stairServed(g, k)) nodes.push({ f: k, x: stairX(k), kind: 'stair' }, { f: k + 1, x: stairX(k + 1), kind: 'stair' })
  const n = nodes.length
  const dist = new Array<number>(n).fill(Infinity), prev = new Array<number>(n).fill(-1), done = new Array<boolean>(n).fill(false)
  dist[0] = 0
  // Attente estimée : moyenne réellement observée sur cet ascenseur + file sur le palier.
  const wait = (d: LiftId, f: number) => { const L = WREF?.lifts[d]; return 2 + (L?.avgWait ?? 2) + (L?.waiting.get(f)?.length ?? 0) * 0.6 }
  for (;;) {
    let u = -1, best = Infinity
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i }
    if (u < 0 || u === 1) break
    done[u] = true
    const a = nodes[u]
    const relax = (v: number, c: number) => { if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u } }
    for (let v = 0; v < n; v++) {
      if (done[v] || v === u) continue
      const b = nodes[v]
      if (a.kind === 'car') {
        if (b.kind === 'car' && b.lift === a.lift && b.f !== a.f) {
          const d = defs.find((x) => x.id === a.lift)!
          relax(v, Math.abs(b.f - a.f) / liftSpeed(g, d) + 0.8)
        } else if (b.kind === 'door' && b.lift === a.lift && b.f === a.f) relax(v, 0)
        continue
      }
      if (b.kind === 'car') { if (a.kind === 'door' && a.lift === b.lift && a.f === b.f) relax(v, wait(b.lift!, b.f)); continue }
      if (b.f === a.f) relax(v, Math.abs(b.x - a.x) / WALK)
      else if (a.kind === 'esc' && b.kind === 'esc' && a.room === b.room) relax(v, 1.4)
      else if (a.kind === 'stair' && b.kind === 'stair' && Math.abs(b.f - a.f) === 1 && Math.abs(b.x - stairX(b.f)) < 0.01 && Math.abs(a.x - stairX(a.f)) < 0.01 && !stairServed(g, Math.min(a.f, b.f))) relax(v, STAIR_S)
    }
  }
  if (!isFinite(dist[1])) return [{ t: 'walk', x: toX }]
  const path: number[] = []
  for (let v = 1; v >= 0; v = prev[v]) path.unshift(v)
  const out: Step[] = []
  for (let i = 1; i < path.length; i++) {
    const a = nodes[path[i - 1]], b = nodes[path[i]]
    if (b.kind === 'car' && a.kind === 'door') {
      if (out.length && out[out.length - 1].t === 'walk') out.pop()
      out.push({ t: 'door', liftId: b.lift! })
    } else if (a.kind === 'car' && b.kind === 'car') {
      const last = out[out.length - 1]
      if (last && last.t === 'lift' && last.liftId === b.lift) last.to = b.f
      else out.push({ t: 'lift', liftId: b.lift!, to: b.f })
    } else if (a.kind === 'car') continue
    else if (a.f !== b.f && a.kind === 'esc') out.push({ t: 'escal', roomId: a.room!, to: b.f })
    else if (a.f !== b.f) {
      const last = out[out.length - 1]
      if (last && last.t === 'stairs') last.to = b.f; else out.push({ t: 'stairs', to: b.f })
    } else if (Math.abs(b.x - a.x) > 0.5 || b.kind === 'goal') out.push({ t: 'walk', x: b.x })
  }
  return out
}

const routeA = (a: Agent, toFloor: number, toX: number): Step[] => route(a.floor, toFloor, toX, a.x)

function say(a: Agent, icon: string, dur = 2.4) { a.icon = icon; a.iconT = dur }
const walkSpeed = () => WALK * (0.85 + Math.random() * 0.35)
const workEnd = (g: Game) => WORK_END + (has(g, 'badge') ? 0.04 : 0)

function baseAgent(id: string, kind: Agent['kind'], floor: number, x: number): Agent {
  return {
    id, kind, floor, x, steps: [], skin: pick(SKINS), cloth: '#64748b', hair: pick(HAIR), icon: null, iconT: 0, walking: false, dir: 1,
    inLift: false, waitT: 0, away: false, speed: walkSpeed(), energy: 70 + Math.random() * 30, bladder: Math.random() * 55, boostT: 0, needT: 0,
    bRate: 0.9 + Math.random() * 1.8, eRate: 1.3 + Math.random() * 1.3, bMax: 70 + Math.random() * 24, needCd: 0,
    prog: Math.random() * 0.5, bagN: 0, arrive: WORK_START + Math.random() * 0.06, leave: WORK_END + Math.random() * 0.04, lastDay: -1, done: new Set(),
  }
}

/** Un agent par employé et par membre du personnel ; ils apparaissent / disparaissent avec les pièces. */
function syncAgents(g: Game, w: World) {
  const want = new Set<string>()
  const p = g.day % 1
  const offHours = (a: Agent) => p < a.arrive || p > workEnd(g) + 0.04
  for (const r of g.rooms) {
    r.workers.forEach((e, i) => {
      if (!e) return
      const id = `w-${e.id}`
      want.add(id)
      if (w.agents.some((a) => a.id === id)) return
      const a = baseAgent(id, 'worker', r.floor, deskX(r, i))
      Object.assign(a, { roomId: r.id, idx: i, empId: e.id, skin: e.skin, cloth: e.shirt, hair: e.hair, tie: e.tie })
      a.away = offHours(a)
      w.agents.push(a)
    })
    const role = ROOMS[r.type].staff
    if (role) for (let i = 0; i < r.level; i++) {
      const id = `st-${r.id}-${i}`
      want.add(id)
      if (w.agents.some((a) => a.id === id)) continue
      const a = baseAgent(id, 'staff', r.floor, slotX(r.slot) + 16 + i * 14)
      Object.assign(a, { role, roomId: r.id, cloth: STAFF[role].cloth, speed: WALK * 1.2 })
      if (role === 'supervisor') a.tie = '#111827'
      a.away = (role === 'researcher' || role === 'supervisor') && offHours(a)
      w.agents.push(a)
    }
  }
  w.agents = w.agents.filter((a) => a.kind === 'thief' || want.has(a.id))
  for (const L of Object.values(w.lifts)) L.riders = L.riders.filter((id) => w.agents.some((a) => a.id === id))
}

const newLift = (): Lift => ({ y: 0, dir: 1, riders: [], stopT: 0, door: 0, waiting: new Map() })
export function createWorld(g: Game): World {
  const w: World = { agents: [], lifts: { A: newLift(), B: newLift(), X: newLift() }, stations: {}, queues: {}, thiefDay: -1, cars: [], pops: [] }
  setLR(g, w)
  syncAgents(g, w)
  syncCars(g, w)
  return w
}

const roomOf = (g: Game, id?: string) => (id ? g.rooms.find((r) => r.id === id) : undefined)
function empOf(g: Game, a: Agent) {
  const r = roomOf(g, a.roomId)
  return r && a.idx != null ? r.workers[a.idx] ?? undefined : undefined
}



// ── Employés ─────────────────────────────────────────────────────────────────
function runWorker(g: Game, w: World, a: Agent, p: number, day: number) {
  const e = empOf(g, a)
  const car = w.cars.find((c) => c.id === a.empId)
  if (a.lastDay !== day) {
    a.lastDay = day; a.done.clear()
    // Venu en voiture sans place de parking : il tourne pour se garer.
    a.arrive = WORK_START + Math.random() * 0.06 + (e?.car && !car ? 0.06 : 0)
    a.leave = workEnd(g) + Math.random() * 0.03
    if (!a.away && p > WORK_START) a.arrive = Math.min(a.arrive, p)   // déjà au bureau : il y reste
  }
  if (a.steps.length) return
  const r = roomOf(g, a.roomId)
  if (!r || a.idx == null) return
  const working = p >= a.arrive && p < a.leave
  if (!working) {
    if (!a.away) {
      a.carry = 'bag'
      a.steps = car && car.state === 'parked'
        ? [...routeA(a, car.floor, car.x + 18), { t: 'drive', carId: car.id }]
        : [...routeA(a, 0, 20), { t: 'walk', x: EXIT_X }, { t: 'gone' }]
    }
    return
  }
  if (a.away) {
    if (car) {
      // Il arrive en voiture : runCars le fait descendre une fois garé.
      if (car.state === 'out') { const pr = roomOf(g, car.roomId); car.state = 'arrive'; car.x = GARAGE_X - 30; car.floor = pr?.floor ?? car.floor }
      return
    }
    if (e?.car) say(a, '🚗😤', 2.5)
    a.away = false; a.floor = 0; a.x = EXIT_X; a.carry = 'bag'
    a.energy = 75 + Math.random() * 25; a.bladder = Math.random() * 70
    a.steps = [...route(0, r.floor, deskX(r, a.idx)), { t: 'work', roomId: r.id, idx: a.idx }]
    return
  }
  a.carry = undefined
  a.steps = [...routeA(a, r.floor, deskX(r, a.idx)), { t: 'work', roomId: r.id, idx: a.idx }]
}

/** Un besoin pressant : aller aux toilettes / au café / en pause, puis revenir au poste. */
function needTrip(g: Game, w: World, a: Agent, r: Room, idx: number): boolean {
  const e = empOf(g, a)
  let type: RoomType | null = null
  if (a.bladder >= a.bMax) type = 'wc'
  else if (a.energy <= 22) type = 'cafe'
  else if (e && e.mood < 38 && !a.done.has('pause') && g.rooms.some((x) => x.type === 'pause')) { type = 'pause'; a.done.add('pause') }
  if (!type) return false
  // Le local le moins encombré à distance raisonnable (étages, file d'attente, places occupées).
  const load = (x: Room) => (w.queues[x.id]?.length ?? 0) + stationsOf(w, x).filter((st) => st.agentId).length / stationCount(x)
  const target = g.rooms.filter((x) => x.type === type).sort((x, y) => Math.abs(x.floor - a.floor) * 2.5 + load(x) * 2.5 - (Math.abs(y.floor - a.floor) * 2.5 + load(y) * 2.5))[0]
  if (!target) return false
  // Tout est pris et ce n'est pas encore urgent : il patiente encore un peu à son poste.
  const urgent = type === 'wc' ? a.bladder >= Math.min(99, a.bMax + 14) : a.energy <= 12
  if (type !== 'pause' && !urgent && (w.queues[target.id]?.length ?? 0) >= 1 && stationsOf(w, target).every((st) => st.agentId)) {
    a.needCd = 2 + Math.random() * 3.5
    if (!a.icon && Math.random() < 0.5) say(a, type === 'wc' ? '🚽⏳' : '☕⏳', 1.6)
    return false
  }
  a.steps.unshift(...routeA(a, target.floor, queueX(target, 0)), { t: 'enter', roomId: target.id }, ...route(target.floor, r.floor, deskX(r, idx), roomX(target)))
  return true
}

function workTick(g: Game, w: World, a: Agent, s: Extract<Step, { t: 'work' }>, dt: number, p: number) {
  const r = roomOf(g, s.roomId)
  const e = empOf(g, a)
  if (!r || !e) { a.steps.shift(); return }
  a.dir = 1
  a.x = deskX(r, s.idx)
  if (p >= a.leave || p < 0.2) { a.steps.shift(); return }
  // Besoins
  if (a.needCd > 0) a.needCd -= dt
  else if ((a.bladder >= a.bMax || a.energy <= 22 || e.mood < 38) && needTrip(g, w, a, r, s.idx)) { a.needT = 0; return }
  const unmet = a.bladder >= Math.min(99, a.bMax + 14) || a.energy <= 12
  a.needT = unmet ? a.needT + dt : 0
  if (unmet && !a.icon && Math.random() < dt * 0.35) say(a, a.bladder >= a.bMax ? '🚽❗' : '🥱', 1.8)
  // Panne ?
  if (r.broken[s.idx]) { if (!a.icon && Math.random() < dt * 0.5) say(a, '❓', 1.5); return }
  const val = fileValue(g, r)
  // Travail
  const speed = (0.55 + e.mood / 100 * 0.65) * (has(g, 'pc') ? 1.2 : 1) * (has(g, 'screens') ? 1.25 : 1)
    * (a.boostT > 0 ? 1.7 : 1) * (unmet ? 0.5 : 1)
  if (a.boostT > 0) a.boostT -= dt
  a.prog += dt * speed / (ROOMS[r.type].taskTime ?? 4)
  if (a.prog >= 1) {
    a.prog -= 1
    // Comme dans les jeux de bureau classiques : l'argent arrive tout seul, un « +40 € » s'envole du poste.
    g.cash += val
    w.pops.push({ id: popSeq++, x: deskX(r, s.idx), floor: r.floor, amount: val, t: 0 })
    if (w.pops.length > 40) w.pops.shift()
    g.dayEarned += val
    g.stats.earned += val
    g.stats.files++
    if (Math.random() < 0.09 && r.trash.length < 12) dropTrash(r, deskX(r, s.idx) + (Math.random() - 0.5) * 26, pick(TRASH_KINDS))
    const breakP = 0.03 * (has(g, 'pc') ? 0.5 : 1) * (has(g, 'servers') ? 0.5 : 1) * serversMult(g)
    if (Math.random() < breakP) { r.broken[s.idx] = true; say(a, '💥', 2) }
  }
}

function dropTrash(r: Room, x: number, kind: TrashKind) {
  const lo = slotX(r.slot) + 6, hi = slotX(r.slot) + ROOMS[r.type].w * SW - 6
  r.trash.push({ id: uid('t'), x: Math.max(lo, Math.min(hi, x)), kind })
}

/** Moral : propreté, besoins, pannes, plantes. */
function moodTick(g: Game, w: World, dt: number) {
  for (const a of w.agents) {
    if (a.kind !== 'worker' || a.away) continue
    const e = empOf(g, a)
    const r = roomOf(g, a.roomId)
    if (!e || !r) continue
    // Les besoins montent tout le temps (trajet compris), chacun à son rythme.
    const s0 = a.steps[0]
    if (!a.inLift && s0?.t !== 'serve') {
      a.energy = Math.max(0, a.energy - dt * a.eRate * (has(g, 'chairs') ? 0.65 : 1))
      a.bladder = Math.min(100, a.bladder + dt * a.bRate)
    }
    const here = g.rooms.find((x) => x.floor === Math.round(a.floor) && a.x >= slotX(x.slot) && a.x < slotX(x.slot) + ROOMS[x.type].w * SW) ?? r
    const noSpot = e.car && !w.cars.some((c) => c.id === e.id)
    let target = 74 + (has(g, 'plants') ? 10 : 0) - (noSpot ? 8 : 0) - Math.min(5, here.trash.length) * 6 - (a.needT > 0 ? 22 : 0) - (r.broken[a.idx ?? 0] ? 8 : 0)
    if (ROOMS[r.type].type === 'direction' && r.trash.length) target -= 12
    e.mood += (target - e.mood) * dt * 0.06
    e.mood = Math.max(0, Math.min(100, e.mood))
  }
}

// ── Personnel ────────────────────────────────────────────────────────────────
const isNight = (p: number) => p > 0.86 || p < 0.22

function goHome(g: Game, a: Agent) {
  const home = roomOf(g, a.roomId)
  if (!home) return
  const idx = Number(a.id.split('-').pop()) || 0
  const hx = slotX(home.slot) + 16 + idx * 14
  if (Math.round(a.floor) === home.floor && Math.abs(a.x - hx) < 2) a.steps = [{ t: 'wait', dur: 1.2 + Math.random() * 2, icon: Math.random() < 0.12 ? '☕' : undefined }]
  else a.steps = routeA(a, home.floor, hx)
}

function runStaff(g: Game, w: World, a: Agent, p: number, day: number) {
  if (a.lastDay !== day) { a.lastDay = day; a.done.clear() }
  // Alerte : le vigile interrompt sa ronde.
  if (a.role === 'guard' && !a.task && a.steps.length && !a.inLift && (a.steps[0].t === 'walk' || a.steps[0].t === 'wait')
    && w.agents.some((t) => t.kind === 'thief' && !t.caught && t.spotted)) a.steps = []
  if (a.steps.length) return
  const claimed = (id: string) => w.agents.some((o) => o !== a && o.kind === 'staff' && o.task === id)
  a.task = undefined
  const home = roomOf(g, a.roomId)
  if (!home) return
  // Chercheurs et superviseurs ont des horaires de bureau.
  // Chercheurs, superviseurs et techniciens ont des horaires de bureau.
  if (a.role === 'researcher' || a.role === 'supervisor' || a.role === 'tech') {
    const on = p > WORK_START + 0.01 && p < workEnd(g)
    if (!on) { if (!a.away) { a.carry = 'bag'; a.steps = [...routeA(a, 0, 20), { t: 'walk', x: EXIT_X }, { t: 'gone' }] } return }
    if (a.away) { a.away = false; a.floor = 0; a.x = EXIT_X; a.carry = 'bag'; a.steps = route(0, home.floor, slotX(home.slot) + 20); return }
    a.carry = undefined
  }
  if (a.role === 'researcher') {
    const idx = Number(a.id.split('-').pop()) || 0
    const hx = slotX(home.slot) + 16 + idx * 14
    if (Math.round(a.floor) !== home.floor || Math.abs(a.x - hx) > 2) { a.steps = routeA(a, home.floor, hx); return }
    a.steps = [{ t: 'research', roomId: home.id, dur: 3 + Math.random() * 3 }]
    return
  }
  if (a.role === 'supervisor') {
    // Tournée dans toute la tour : il va dans le bureau où le plus d'employés ont besoin d'être relancés,
    // en tenant compte du trajet ; seul ce bureau profite de son passage.
    let best: Room | null = null, score = -Infinity
    for (const r of g.rooms) {
      if (ROOMS[r.type].kind !== 'work' || claimed(r.id)) continue
      const need = w.agents.filter((x) => x.kind === 'worker' && x.roomId === r.id && !x.away && x.steps[0]?.t === 'work' && x.boostT <= 1).length
      if (!need) continue
      const sc = need * 10 - Math.abs(r.floor - a.floor) * 6 - Math.abs(roomX(r) - a.x) / 30
      if (sc > score) { score = sc; best = r }
    }
    if (best) {
      a.task = best.id; a.carry = 'clipboard'
      a.steps = [...routeA(a, best.floor, roomX(best)), { t: 'coach', targetId: best.id, dur: 1.6 }]
      return
    }
    goHome(g, a)
    return
  }
  if (a.role === 'tech') {
    let best: { r: Room; i: number } | null = null, bd = Infinity
    for (const r of g.rooms) r.broken.forEach((b, i) => {
      if (!b || claimed(`${r.id}:${i}`)) return
      const d = Math.abs(r.floor - a.floor) * 300 + Math.abs(deskX(r, i) - a.x)
      if (d < bd) { bd = d; best = { r, i } }
    })
    if (best) {
      const { r, i } = best as { r: Room; i: number }
      a.task = `${r.id}:${i}`; a.carry = 'wrench'
      a.steps = [...routeA(a, r.floor, deskX(r, i) + 10), { t: 'fix', roomId: r.id, idx: i, dur: has(g, 'servers') ? 1.6 : 3.2, total: has(g, 'servers') ? 1.6 : 3.2 }]
      return
    }
    a.carry = undefined
  } else if (a.role === 'janitor') {
    // Ménage complet la nuit ; en journée, seulement un passage aux toilettes quand elles sont sales.
    const office = p > WORK_START && p < workEnd(g)
    // Chaque agent a sa propre zone d'étages (blocs contigus), et la balaie étage par étage.
    const crew = w.agents.filter((x) => x.role === 'janitor').sort((x, y) => (x.id < y.id ? -1 : 1))
    const k = Math.max(0, crew.indexOf(a)), nJ = Math.max(1, crew.length)
    const nF = g.top - g.bottom + 1
    const zLo = g.bottom + Math.floor(k * nF / nJ), zHi = g.bottom + Math.floor((k + 1) * nF / nJ) - 1
    const inZone = (f: number) => f >= zLo && f <= zHi
    const cur = Math.round(a.floor)
    // Le jour : toilettes dès qu'elles sont sales, et les bureaux vraiment encombrés (3 déchets ou plus).
    const ok = (r: Room, t: Trash) => !(office && r.type !== 'wc' && r.trash.length < 3) && !claimed(t.id)
    let best: { r: Room; t: Trash } | null = null
    if (a.bagN < 12) {
      // 1) sur l'étage courant, dans le sens de balayage (sinon on fait demi-tour)
      const here = g.rooms.filter((r) => r.floor === cur && inZone(cur)).flatMap((r) => r.trash.filter((t) => ok(r, t)).map((t) => ({ r, t })))
      if (here.length) {
        const dir = a.sweepDir ?? 1
        const ahead = here.filter((c) => (c.t.x - a.x) * dir >= -2).sort((p1, p2) => Math.abs(p1.t.x - a.x) - Math.abs(p2.t.x - a.x))
        if (ahead.length) best = ahead[0]
        else { a.sweepDir = (-dir) as 1 | -1; best = here.sort((p1, p2) => Math.abs(p1.t.x - a.x) - Math.abs(p2.t.x - a.x))[0] }
      } else {
        // 2) l'étage sale le plus proche de sa zone (le jour, toilettes de toute la tour si personne d'autre n'y va)
        let bd = Infinity, tf: number | null = null
        for (const r of g.rooms) {
          if (!r.trash.some((t) => ok(r, t))) continue
          // Sa zone d'abord ; si elle est propre, il va aider ailleurs.
          const d = Math.abs(r.floor - cur) + (inZone(r.floor) ? 0 : 20)
          if (d < bd) { bd = d; tf = r.floor }
        }
        if (tf != null) {
          // Balayage en serpentin : il commence par un bout de l'étage et va jusqu'à l'autre,
          // en alternant le sens d'un étage à l'autre.
          const dir = (-(a.sweepDir ?? -1)) as 1 | -1
          a.sweepDir = dir
          const cands = g.rooms.filter((r) => r.floor === tf).flatMap((r) => r.trash.filter((t) => ok(r, t)).map((t) => ({ r, t })))
          best = cands.sort((p1, p2) => (p1.t.x - p2.t.x) * dir)[0] ?? null
        }
      }
    }
    if (best) {
      const { r, t } = best as { r: Room; t: Trash }
      a.task = t.id; a.carry = 'trashbag'
      a.steps = [...routeA(a, r.floor, t.x - 6), { t: 'pick', roomId: r.id, trashId: t.id, dur: t.kind.startsWith('wc') || t.kind === 'puddle' ? 1.3 : 0.6 }]
      return
    }
    if (a.bagN > 0) {
      const idx = Number(a.id.split('-').pop()) || 0
      a.steps = [...routeA(a, home.floor, slotX(home.slot) + 16 + idx * 14), { t: 'dump', dur: 0.8 }]
      return
    }
    a.carry = undefined
  } else if (a.role === 'guard') {
    // Il ne fonce que vers un voleur repéré, et seulement là où on l'a vu en dernier.
    const thief = w.agents.find((t) => t.kind === 'thief' && !t.caught && t.spotted && !claimed(t.id))
    if (thief && thief.seenF != null && thief.seenX != null) {
      a.task = thief.id
      a.steps = [...routeA(a, thief.seenF, thief.seenX), { t: 'chase', thiefId: thief.id }]
      say(a, '🚨', 2)
      return
    }
    if (isNight(p)) {
      const f = g.bottom + Math.floor(Math.random() * (g.top - g.bottom + 1))
      a.steps = [...routeA(a, f, slotX(Math.floor(Math.random() * SLOTS)) + 10 + Math.random() * (SW - 20)), { t: 'wait', dur: 1 + Math.random() * 1.5, icon: Math.random() < 0.3 ? '🔦' : undefined }]
      return
    }
  }
  goHome(g, a)
}

function maybeThief(g: Game, w: World, p: number, day: number) {
  if (day < 3 || w.thiefDay === day || p < 0.9) return
  w.thiefDay = day
  const first = !(g.stats.caught || g.stats.stolen)
  if ((!first && Math.random() > 0.4) || w.agents.some((a) => a.kind === 'thief')) return
  // Il vise un bureau au hasard pour fouiller les tiroirs et la petite caisse.
  const offices = g.rooms.filter((x) => ROOMS[x.type].kind === 'work')
  const r = offices[Math.floor(Math.random() * offices.length)]
  if (!r || g.cash < 300) return
  const t = baseAgent(uid('x'), 'thief', 0, EXIT_X)
  Object.assign(t, { cloth: '#1f1f2b', hair: '#111', speed: WALK * 1.05 })
  say(t, '🤫', 3)
  t.camT = 3 + Math.random() * 6
  t.steps = [...route(0, r.floor, roomX(r)), { t: 'steal', roomId: r.id, dur: 8 }, ...route(r.floor, 0, 20, roomX(r)), { t: 'walk', x: EXIT_X }, { t: 'gone' }]
  w.agents.push(t)
}

/** Le vigile voit le voleur : même étage, assez près, et pas dans un ascenseur. */
function canSee(guard: Agent, t: Agent) {
  return !guard.inLift && !t.inLift && !guard.away && Math.abs(guard.floor - t.floor) < 0.3 && Math.abs(guard.x - t.x) < 140
}

/** Repérage : caméras (avec un délai aléatoire) ou vigile qui croise le voleur pendant sa ronde. */
function detectThieves(g: Game, w: World, dt: number) {
  const guards = w.agents.filter((a) => a.role === 'guard')
  const cams = g.rooms.some((r) => r.type === 'securite')
  for (const t of w.agents) {
    if (t.kind !== 'thief' || t.caught) continue
    const seenBy = guards.find((gd) => canSee(gd, t))
    if (!t.spotted && cams && t.camT != null) { t.camT -= dt; if (t.camT <= 0 && !t.inLift) { t.spotted = true; t.seenF = Math.round(t.floor); t.seenX = t.x; for (const gd of guards) say(gd, '📹', 1.6) } }
    if (seenBy && !t.spotted) { t.spotted = true; say(seenBy, '❗', 1.6) }
    // Position connue : mise à jour tant qu'un vigile l'a en vue.
    if (seenBy) { t.seenF = Math.round(t.floor); t.seenX = t.x }
    // Un vigile à sa poursuite qui l'aperçoit court droit sur lui.
    for (const gd of guards) if (gd.task === t.id && canSee(gd, t) && gd.steps[0]?.t !== 'chase') gd.steps = [{ t: 'chase', thiefId: t.id }]
  }
}

export function scareThief(g: Game, w: World, id: string, ev: GEvent[]) {
  const t = w.agents.find((a) => a.id === id && a.kind === 'thief' && !a.caught)
  if (!t || t.inLift) return false
  catchThief(g, w, null, t, ev)
  return true
}
function catchThief(g: Game, _w: World, guard: Agent | null, t: Agent, ev: GEvent[]) {
  t.caught = true
  if (t.loot) g.cash += t.loot
  t.loot = 0; t.carry = undefined; t.speed = WALK * 1.7
  say(t, '😱', 3); if (guard) say(guard, '✋', 2.5)
  if (!t.inLift) t.steps = [...routeA(t, 0, 20), { t: 'walk', x: EXIT_X }, { t: 'gone' }]
  g.stats.caught++
  ev.push({ kind: 'caught', byGuard: !!guard })
}

// ── Pas de simulation ────────────────────────────────────────────────────────
export function step(g: Game, w: World, dt: number, ev: GEvent[]) {
  setLR(g, w)
  const prev = g.day
  g.day += dt / DAY_S
  const p = g.day % 1
  const day = Math.floor(g.day)
  if (day > Math.floor(prev)) dayRollover(g, w, ev)

  syncAgents(g, w)
  syncCars(g, w)
  runCars(g, w, dt)
  for (const a of w.agents) {
    if (a.kind === 'worker') runWorker(g, w, a, p, day)
    else if (a.kind === 'staff') runStaff(g, w, a, p, day)
  }
  maybeThief(g, w, p, day)
  detectThieves(g, w, dt)
  for (const q of w.pops) q.t += dt
  w.pops = w.pops.filter((q) => q.t < 1.4)

  // Postes de service : libération des postes orphelins
  for (const id of Object.keys(w.stations)) {
    if (!g.rooms.some((r) => r.id === id)) { delete w.stations[id]; delete w.queues[id]; continue }
    w.stations[id].forEach((st, i) => {
      // Libère le poste si celui qui l'a réservé n'y va plus (parti, trajet annulé…).
      const holder = st.agentId ? w.agents.find((a) => a.id === st.agentId) : undefined
      if (st.agentId && !holder?.steps.some((s) => s.t === 'serve' && s.roomId === id && s.idx === i)) { st.agentId = null; if (st.phase !== 'done') st.phase = 'idle'; st.t = 0 }
      if (st.phase === 'done') { st.doneT -= dt; if (st.doneT <= 0) st.phase = 'idle' }
    })
  }
  for (const id of Object.keys(w.queues)) w.queues[id] = w.queues[id].filter((x) => { const a = w.agents.find((q) => q.id === x); return !!a && a.steps[0]?.t === 'queue' && (a.steps[0] as { roomId: string }).roomId === id })

  for (const a of [...w.agents]) moveAgent(g, w, a, dt, ev)
  for (const d of liftDefs(g)) if (d.on) runLift(g, w, w.lifts[d.id], d, dt)
  moodTick(g, w, dt)
  for (const a of w.agents) if (a.iconT > 0) { a.iconT -= dt; if (a.iconT <= 0) a.icon = null }
  checkProgress(g, ev)
}

function moveAgent(g: Game, w: World, a: Agent, dt: number, ev: GEvent[]) {
  a.walking = false
  const s = a.steps[0]
  if (!s || a.inLift) return
  const p = g.day % 1
  // Fin de journée : inutile de remonter au poste, on rentre directement.
  if (a.kind === 'worker' && p >= a.leave && (s.t === 'walk' || s.t === 'wait' || s.t === 'door' || s.t === 'lift' || s.t === 'queue' || s.t === 'enter') && a.steps.some((x) => x.t === 'work')) {
    for (const L of Object.values(w.lifts)) for (const [f, ids] of L.waiting) L.waiting.set(f, ids.filter((x) => x !== a.id))
    a.steps = []; a.icon = null; return
  }
  if (s.t === 'door') {
    // Porte de l'ascenseur choisi, du côté où l'on se trouve.
    const d = liftDefs(g).find((x) => x.id === s.liftId)!
    a.steps.splice(0, 1, { t: 'walk', x: a.x > d.x0 + SHAFT_W / 2 ? d.x0 + SHAFT_W + 6 : d.x0 - 6 })
    return
  }
  if (s.t === 'walk') {
    const dx = s.x - a.x
    const d = a.speed * dt * (a.role === 'guard' && a.task ? 1.6 : a.role === 'supervisor' && has(g, 'coaching') ? 1.3 : 1)   // le vigile court quand il est alerté
    a.dir = dx >= 0 ? 1 : -1
    if (Math.abs(dx) <= d) { a.x = s.x; a.steps.shift() } else { a.x += Math.sign(dx) * d; a.walking = true }
  } else if (s.t === 'lift') {
    const d = liftDefs(g).find((x) => x.id === s.liftId)!
    if (!d.on || !liftStops(d, Math.round(a.floor)) || !liftStops(d, s.to)) { a.steps.splice(0, 1, ...route(a.floor, s.to, a.x, a.x)); return }
    const L = w.lifts[s.liftId]
    const q = L.waiting.get(a.floor) ?? []
    if (!q.includes(a.id)) { q.push(a.id); L.waiting.set(a.floor, q) }
    a.waitT += dt
    if (a.waitT > 8 && a.waitT - dt <= 8) say(a, '😤', 2.5)
    if (a.waitT > 20) {
      // Trop long : il change d'itinéraire (autre ascenseur, escalator ou escalier).
      L.avgWait = Math.max(L.avgWait ?? 0, a.waitT)
      L.waiting.set(a.floor, (L.waiting.get(a.floor) ?? []).filter((x) => x !== a.id))
      a.waitT = 0
      say(a, '🔀', 1.6)
      a.steps.splice(0, 1, ...route(a.floor, s.to, a.x, a.x).filter((st, i, arr) => !(i === arr.length - 1 && st.t === 'walk')))
    }
  } else if (s.t === 'escal') {
    const r = roomOf(g, s.roomId)
    if (!r) { a.steps.splice(0, 1, ...route(a.floor, s.to, a.x, a.x)); return }
    const d = s.to - a.floor
    const mv = dt / 1.3
    if (Math.abs(d) <= mv) { a.floor = s.to; a.steps.shift() } else a.floor += Math.sign(d) * mv
    const e = escX(r)
    const nx = e.lo + (e.hi - e.lo) * Math.max(0, Math.min(1, a.floor - r.floor))
    if (Math.abs(nx - a.x) > 0.01) a.dir = nx > a.x ? 1 : -1
    a.x = nx
  } else if (s.t === 'stairs') {
    const d = s.to - a.floor
    const mv = dt / STAIR_S * (a.kind === 'worker' ? 1 : 1.25)
    if (Math.abs(d) <= mv) { a.floor = s.to; a.steps.shift() } else { a.floor += Math.sign(d) * mv; a.walking = true }
    const k = Math.floor(a.floor + 1e-6), f = a.floor - k
    const nx = stairX(k) + (stairX(k + 1) - stairX(k)) * f
    if (Math.abs(nx - a.x) > 0.01) a.dir = nx > a.x ? 1 : -1
    a.x = nx
    if (a.kind === 'worker' && d > 0) { a.energy = Math.max(0, a.energy - mv * 6); if (!s.said && d > 1.5) { s.said = true; say(a, '😮‍💨', 2) } }
  } else if (s.t === 'enter') {
    const r = roomOf(g, s.roomId)
    if (!r) { a.steps.shift(); return }
    if (r.type === 'wc' && r.trash.length >= 4) say(a, '🤢', 2)
    const st = stationsOf(w, r)
    const q = w.queues[r.id] ?? (w.queues[r.id] = [])
    const free = st.findIndex((x) => !x.agentId)
    if (free >= 0 && q.length === 0) {
      st[free].agentId = a.id; st[free].phase = 'reserved'; st[free].t = 0
      a.steps.splice(0, 1, { t: 'walk', x: stationX(r, free) }, { t: 'serve', roomId: r.id, idx: free })
    } else {
      q.push(a.id); a.waitT = 0; say(a, '⏳', 999)
      a.steps.splice(0, 1, { t: 'queue', roomId: r.id })
    }
  } else if (s.t === 'queue') {
    const r = roomOf(g, s.roomId)
    const q = r ? w.queues[r.id] ?? [] : []
    const pos = q.indexOf(a.id)
    if (!r || pos < 0) { a.icon = null; a.steps.shift(); return }
    const qx = queueX(r, pos)
    const dx = qx - a.x
    if (Math.abs(dx) > 1) { a.x += Math.sign(dx) * Math.min(Math.abs(dx), a.speed * dt); a.walking = true; a.dir = dx > 0 ? 1 : -1 } else a.dir = -1
    a.waitT += dt
    const st = stationsOf(w, r)
    const free = st.findIndex((x) => !x.agentId)
    if (pos === 0 && free >= 0) {
      q.shift(); a.icon = null; a.iconT = 0; a.waitT = 0
      st[free].agentId = a.id; st[free].phase = 'reserved'; st[free].t = 0
      a.steps.splice(0, 1, { t: 'walk', x: stationX(r, free) }, { t: 'serve', roomId: r.id, idx: free })
    } else if (a.waitT > PATIENCE) {
      w.queues[r.id] = q.filter((x) => x !== a.id)
      say(a, '😤', 2.8); a.waitT = 0
      const e = empOf(g, a); if (e) e.mood = Math.max(0, e.mood - 8)
      a.steps.shift()
    }
  } else if (s.t === 'serve') {
    const r = roomOf(g, s.roomId)
    if (!r) { a.steps.shift(); return }
    const st = stationsOf(w, r)[s.idx]
    if (!st) { a.steps.shift(); return }
    if (st.phase !== 'run') {
      st.phase = 'run'; st.t = 0; st.dur = useTime(g, r.type)
      say(a, r.type === 'wc' ? '🚽' : r.type === 'cafe' ? '☕' : '🎮', 1.4)
    }
    a.dir = -1
    st.t += dt
    if (st.t >= st.dur) {
      st.agentId = null; st.phase = 'done'; st.doneT = 1; st.t = 0
      const e = empOf(g, a)
      if (r.type === 'wc') {
        a.bladder = Math.random() * 6
        a.bMax = 70 + Math.random() * 24
        if (Math.random() < (has(g, 'japaneseWc') ? 0.22 : 0.45) && r.trash.length < 8) dropTrash(r, stationX(r, s.idx) + (Math.random() - 0.5) * 10, Math.random() < 0.5 ? 'wcpaper' : 'wcpuddle')
      } else if (r.type === 'cafe') {
        a.energy = has(g, 'espresso') ? 100 : 88
        a.carry = 'cup'
        if (Math.random() < 0.3 && r.trash.length < 8) dropTrash(r, stationX(r, s.idx) + 8, 'cup')
      } else if (r.type === 'pause' && e) e.mood = Math.min(100, e.mood + 28)
      say(a, r.type === 'pause' ? '😊' : '👍', 1.3)
      a.steps.shift()
    }
  } else if (s.t === 'work') {
    workTick(g, w, a, s, dt, p)
    if (a.carry === 'cup' && Math.random() < dt * 0.15) {
      a.carry = undefined
      const r = roomOf(g, s.roomId); if (r && Math.random() < 0.5 && r.trash.length < 12) dropTrash(r, a.x + 10, 'cup')
    }
  } else if (s.t === 'fix') {
    s.dur -= dt
    if (!a.icon) say(a, '🔧', 0.5)
    if (s.dur <= 0) {
      const r = roomOf(g, s.roomId)
      if (r && r.broken[s.idx]) { r.broken[s.idx] = false; g.stats.repairs++ }
      say(a, '✅', 1.2)
      a.steps.shift(); a.task = undefined
    }
  } else if (s.t === 'pick') {
    const r = roomOf(g, s.roomId)
    s.dur -= dt
    a.walking = Math.random() < 0.4
    if (!a.icon) say(a, '🧽', 0.6)
    if (s.dur <= 0) {
      if (r) { const n = r.trash.length; r.trash = r.trash.filter((t) => t.id !== s.trashId); if (r.trash.length < n) { a.bagN++; g.stats.cleans++ } }
      if (r && !r.trash.length) say(a, '✨', 1.2)
      a.steps.shift(); a.task = undefined
    }
  } else if (s.t === 'dump') {
    s.dur -= dt
    if (s.dur <= 0) { a.bagN = 0; a.carry = undefined; a.steps.shift() }
  } else if (s.t === 'coach') {
    // Il motive tout le bureau où il se trouve (et seulement celui-là).
    s.dur -= dt
    a.dir = Math.sin(s.dur * 3) > 0 ? 1 : -1
    if (!a.icon) say(a, Math.random() < 0.5 ? '👉' : '💬', 0.8)
    if (s.dur <= 0) {
      for (const t of w.agents) if (t.kind === 'worker' && t.roomId === s.targetId && t.steps[0]?.t === 'work' && Math.round(t.floor) === Math.round(a.floor)) {
        t.boostT = has(g, 'coaching') ? 12 : 7
        say(t, '⚡', 1.6)
      }
      a.steps.shift(); a.task = undefined
    }
  } else if (s.t === 'research') {
    g.rp += RP_RATE * dt
    a.dir = -1
    if (!a.icon && Math.random() < dt * 0.25) say(a, Math.random() < 0.5 ? '💡' : '🧪', 1.4)
    s.dur -= dt
    if (s.dur <= 0 || p > workEnd(g)) a.steps.shift()
  } else if (s.t === 'wait') {
    if (s.icon && !a.icon) { say(a, s.icon, 1.5); s.icon = undefined }
    s.dur -= dt
    if (s.dur <= 0) a.steps.shift()
  } else if (s.t === 'steal') {
    const r = roomOf(g, s.roomId)
    s.dur -= dt
    if (!a.icon) say(a, '💰', 0.8)
    a.walking = Math.random() < 0.3
    if (!r) { a.steps.shift(); return }
    if (s.dur <= 0) {
      const amount = Math.round(Math.min(g.cash * 0.06, 4000 + g.cash * 0.01))
      g.cash -= amount
      if (r.broken.length) r.broken[Math.floor(Math.random() * r.broken.length)] = true   // il a forcé un poste
      a.loot = amount; a.lootRoom = r.id; a.carry = 'sack'; a.speed = WALK * 1.35
      g.stats.stolen += amount
      say(a, '🏃', 2)
      ev.push({ kind: 'theft', amount, room: r })
      a.steps.shift()
    }
  } else if (s.t === 'chase') {
    const t = w.agents.find((x) => x.id === s.thiefId)
    if (!t || t.caught) { a.steps.shift(); a.task = undefined; return }
    if (!canSee(a, t)) {
      // Plus en vue : on va jusqu'à la dernière position connue… et s'il n'y est plus, on perd sa trace.
      if (t.seenF != null && t.seenX != null && Math.round(a.floor) === t.seenF && Math.abs(a.x - t.seenX) < 8) {
        t.spotted = false; t.camT = 3 + Math.random() * 7
        say(a, '❓', 2)
        a.steps.shift(); a.task = undefined
      } else if (t.seenF != null && t.seenX != null) a.steps = [...routeA(a, t.seenF, t.seenX), { t: 'chase', thiefId: t.id }]
      else { a.steps.shift(); a.task = undefined }
      return
    }
    const dx = t.x - a.x
    a.dir = dx >= 0 ? 1 : -1
    if (Math.abs(dx) < 9) { catchThief(g, w, a, t, ev); a.steps.shift(); a.task = undefined; return }
    a.x += Math.sign(dx) * Math.min(Math.abs(dx), a.speed * 2.1 * dt)   // sprint
    a.walking = true
  } else if (s.t === 'drive') {
    const c = w.cars.find((x) => x.id === s.carId)
    a.steps.shift()
    a.away = true
    if (c) { c.state = 'leave'; c.dir = -1 }
  } else if (s.t === 'gone') {
    a.steps.shift()
    if (a.kind === 'thief') w.agents = w.agents.filter((x) => x.id !== a.id)
    else a.away = true
  }
}

function runLift(g: Game, w: World, L: Lift, def: LiftDef, dt: number) {
  const cap = liftCap(g, def)
  const speed = liftSpeed(g, def)
  const stops: number[] = []
  for (let f = def.bottom; f <= def.top; f++) if (liftStops(def, f)) stops.push(f)
  if (L.y < def.bottom || L.y > def.top) L.y = Math.max(def.bottom, Math.min(def.top, L.y))
  for (const [f, ids] of L.waiting) L.waiting.set(f, ids.filter((id) => { const a = w.agents.find((x) => x.id === id); const s0 = a?.steps[0]; return !!a && !a.inLift && s0?.t === 'lift' && s0.liftId === def.id && a.floor === f }))
  const pDay = g.day % 1
  for (const id of L.riders) {
    const a = w.agents.find((x) => x.id === id)
    // Employé qui remontait à son poste alors que la journée est finie : il descend au prochain arrêt.
    if (a && a.kind === 'worker' && pDay >= a.leave && a.steps.some((x) => x.t === 'work')) a.steps = []
    if (a && a.steps[0]?.t !== 'lift') {
      // Trajet changé en route : il descend au prochain arrêt.
      const ahead = stops.filter((f) => (L.dir > 0 ? f >= L.y - 0.001 : f <= L.y + 0.001))
      const nxt = ahead.length ? ahead.reduce((b, f) => (Math.abs(f - L.y) < Math.abs(b - L.y) ? f : b)) : stops[0]
      a.steps.unshift({ t: 'lift', liftId: def.id, to: nxt })
    }
  }
  const calls = new Set<number>()
  if (L.riders.length < cap) for (const [f, ids] of L.waiting) if (ids.length && !(L.skip === f && Math.abs(L.y - f) < 0.001)) calls.add(f)
  for (const id of L.riders) {
    const s = w.agents.find((x) => x.id === id)?.steps[0]
    if (s && s.t === 'lift') calls.add(s.to)
  }
  for (const id of L.riders) { const a = w.agents.find((x) => x.id === id); if (a) a.floor = L.y }
  const want = L.stopT > 0.18 ? 1 : 0
  L.door = Math.max(0, Math.min(1, L.door + Math.sign(want - L.door) * dt * 6))
  if (L.stopT > 0) { L.stopT -= dt; return }
  if (L.door > 0.02) return
  if (!calls.size) return
  const list = [...calls]
  const ahead = list.filter((f) => (L.dir > 0 ? f >= L.y - 0.001 : f <= L.y + 0.001))
  if (!ahead.length) { L.dir = (L.dir * -1) as 1 | -1; return }
  const target = ahead.reduce((b, f) => (Math.abs(f - L.y) < Math.abs(b - L.y) ? f : b))
  const d = target - L.y
  const mv = speed * dt
  if (Math.abs(d) > mv) { L.y += Math.sign(d) * mv; L.skip = null; return }
  L.y = target
  let changed = false
  L.riders = L.riders.filter((id) => {
    const a = w.agents.find((x) => x.id === id)
    const s = a?.steps[0]
    if (a && s && s.t === 'lift' && s.to === target) {
      a.steps.shift()
      // On sort du côté où l'on va.
      const nx = a.steps[0]?.t === 'walk' ? (a.steps[0] as { x: number }).x : 0
      const right = nx > def.x0 + SHAFT_W / 2
      a.inLift = false; a.liftId = undefined; a.floor = target; a.x = right ? def.x0 + SHAFT_W + 2 : def.x0 - 2; a.dir = right ? 1 : -1; a.waitT = 0; changed = true
      return false
    }
    return !!a
  })
  const destOf = (id: string) => { const s0 = w.agents.find((x) => x.id === id)?.steps[0]; return s0 && s0.t === 'lift' ? s0.to : target }
  const further = (dir: number) => L.riders.some((id) => (destOf(id) - target) * dir > 0)
    || [...L.waiting.entries()].some(([f, ids]) => ids.length && f !== target && (f - target) * dir > 0)
  if (!further(L.dir)) L.dir = (L.dir * -1) as 1 | -1
  const q = L.waiting.get(target) ?? []
  const stay: string[] = []
  for (const id of q) {
    const a = w.agents.find((x) => x.id === id)
    if (!a) continue
    const sameWay = (destOf(id) - target) * L.dir > 0 || (L.riders.length === 0 && !further(L.dir))
    if (L.riders.length < cap && sameWay) { L.avgWait = (L.avgWait ?? 2) * 0.9 + a.waitT * 0.1; L.riders.push(id); a.inLift = true; a.liftId = def.id; a.waitT = 0; changed = true } else stay.push(id)
  }
  if (!changed) L.skip = target
  L.waiting.set(target, stay)
  if (changed) L.stopT = 0.75
}

function dayRollover(g: Game, w: World, ev: GEvent[]) {
  const costs = dailyCosts(g)
  g.cash -= costs
  g.stats.salaries += costs
  const net = g.dayEarned - costs
  g.dayHist = [...g.dayHist, net].slice(-7)
  g.dayEarned = 0
  // Démissions des employés à bout, remplacés le lendemain.
  for (const r of g.rooms) r.workers = r.workers.map((e) => {
    if (e && e.mood < 18) { g.stats.quits++; ev.push({ kind: 'quit', name: e.name }); return null }
    if (!e && g.cash >= HIRE_COST) { g.cash -= HIRE_COST; return newEmployee() }
    return e
  })
  ev.push({ kind: 'day', net })
  void w
}
