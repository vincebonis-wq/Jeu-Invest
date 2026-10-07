/**
 * RENTIER INC. — simulation.
 *
 * Deux couches :
 *  - Game  : l'état persistant (pièces, locataires, argent, objectifs).
 *  - World : la vie transitoire (personnages, ascenseur), recréée au chargement.
 */

import {
  ROOMS, SLOTS, SW, SHAFT_W, DAY_S, WALK, LIFT_SPEED, LIFT_CAP, START_CASH, LIFESTYLE, TAX, HOME_COST_GROWTH, HOME_COST_FREE, SHOP_COST_GROWTH,
  FURNISH_COST, floorCost, chargesPerMonth, FREEDOM_TIERS, FIRST_NAMES, SKINS, CLOTHES, HAIR, STAFF, CLEAN_COST,
  type RoomType, type Need, type StaffRole,
} from './data'

// ── État persistant ──────────────────────────────────────────────────────────
export interface Tenant {
  id: string; name: string; sat: number; car: boolean; needs: Need[]
  skin: string; cloth: string; hair: string
}
export interface Incident { kind: 'fuite' | 'panne'; since: number }
export interface Room {
  id: string; type: RoomType; floor: number; slot: number
  regime: 'lmnp' | 'nu'; level: number; stored: number
  tenants: Tenant[]; incident: Incident | null; builtAt: number
  visits: number
  dirt?: number             // saleté 0..100
}
export interface Quest { id: string; title: string; kind: QuestKind; target: number; param?: string; reward: number; done?: boolean }
export type QuestKind = 'collect' | 'build' | 'count' | 'floors' | 'basement' | 'tenants' | 'income' | 'repair' | 'renovate' | 'freedom'

export interface Game {
  version: 2
  cash: number
  month: number
  top: number
  bottom: number
  liftLevel: number
  rooms: Room[]
  shopHist: number[]          // recettes nettes des commerces par mois
  shopMonth: number           // recettes du mois en cours
  stats: { earned: number; taxes: number; charges: number; visits: number; moves: number; repairs: number; collects: number; peak: number; lost?: number; cleans?: number; stolen?: number; caught?: number }
  quests: Quest[]
  questCursor: number
  freedomTier: number
  lastSeen: number
  introDone: boolean
  muted: boolean
}

let seq = 0
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

export function newTenant(): Tenant {
  const all: Need[] = ['food', 'laundry', 'sport', 'fun']
  const needs = all.filter(() => Math.random() < 0.6)
  if (!needs.includes('laundry')) needs.push('laundry')
  return {
    id: uid('t'), name: pick(FIRST_NAMES), sat: 68, car: Math.random() < 0.45, needs,
    skin: pick(SKINS), cloth: pick(CLOTHES), hair: pick(HAIR),
  }
}

export function createGame(): Game {
  const studio: Room = { id: uid('r'), type: 'studio', floor: 1, slot: 0, regime: 'lmnp', level: 1, stored: 380, tenants: [newTenant()], incident: null, builtAt: 0, visits: 0 }
  studio.tenants[0].car = false
  const g: Game = {
    version: 2, cash: START_CASH, month: 0.3, top: 1, bottom: 0, liftLevel: 1,
    rooms: [
      { id: 'lobby', type: 'lobby', floor: 0, slot: 0, regime: 'nu', level: 1, stored: 0, tenants: [], incident: null, builtAt: 0, visits: 0 },
      studio,
    ],
    shopHist: [], shopMonth: 0,
    stats: { earned: 0, taxes: 0, charges: 0, visits: 0, moves: 0, repairs: 0, collects: 0, peak: START_CASH },
    quests: [], questCursor: 0, freedomTier: 0, lastSeen: Date.now(), introDone: false, muted: false,
  }
  fillQuests(g)
  return g
}

// ── Géométrie ────────────────────────────────────────────────────────────────
export const shaftX = SLOTS * SW + SHAFT_W / 2
export const EXIT_X = -70
export const roomX = (r: Room, frac = 0.5) => r.slot * SW + ROOMS[r.type].w * SW * frac

export function roomAt(g: Game, floor: number, slot: number) {
  return g.rooms.find((r) => r.floor === floor && slot >= r.slot && slot < r.slot + ROOMS[r.type].w)
}

export function canPlace(g: Game, type: RoomType, floor: number, slot: number) {
  const d = ROOMS[type]
  if (floor > g.top || floor < g.bottom) return false
  if (slot < 0 || slot + d.w > SLOTS) return false
  const rule = d.floor
  if (rule === 'upper' && floor < 1) return false
  if (rule === 'basement' && floor > -1) return false
  if (rule === 'notBasement' && floor < 0) return false
  if (rule === 'ground' && floor !== 0) return false
  for (let i = 0; i < d.w; i++) if (roomAt(g, floor, slot + i)) return false
  return true
}

export function isUnlocked(g: Game, t: RoomType) {
  return (ROOMS[t].unlockFloors ?? 0) <= g.top
}

// ── Économie ─────────────────────────────────────────────────────────────────
export function taxRate(r: Room) {
  const k = ROOMS[r.type].kind
  if (k === 'home') return r.regime === 'lmnp' ? TAX.lmnp : TAX.nu
  if (k === 'parking') return TAX.parking
  if (k === 'shop') return TAX.bic
  return 0
}

export const satMult = (sat: number) => 0.65 + 0.7 * (sat / 100)

export function parkingStatus(g: Game) {
  const spots = g.rooms.filter((r) => r.type === 'parking').reduce((a) => a + (ROOMS.parking.capacity ?? 0), 0)
  const cars = g.rooms.flatMap((r) => r.tenants).filter((t) => t.car).length
  return { spots, cars, used: Math.min(spots, cars) }
}

/** Loyer mensuel net (logement ou parking) au taux d'occupation et de satisfaction actuels. */
export function monthlyRent(g: Game, r: Room) {
  const d = ROOMS[r.type]
  if (d.kind === 'home') {
    const occ = r.tenants.length / (d.capacity ?? 1)
    const sat = r.tenants.length ? r.tenants.reduce((a, t) => a + t.sat, 0) / r.tenants.length : 0
    const gross = (d.rent ?? 0) * occ * satMult(sat) * (1 + 0.18 * (r.level - 1))
    return { gross, net: gross * (1 - taxRate(r)) }
  }
  if (d.kind === 'parking') {
    const ps = parkingStatus(g)
    const parks = g.rooms.filter((x) => x.type === 'parking').length
    const usedHere = parks ? ps.used / parks : 0
    const gross = (d.rent ?? 0) * usedHere * (1 + 0.18 * (r.level - 1))
    return { gross, net: gross * (1 - taxRate(r)) }
  }
  return { gross: 0, net: 0 }
}

export function salaries(g: Game) {
  return g.rooms.reduce((a, r) => { const role = ROOMS[r.type].staff; return a + (role ? STAFF[role].salary * r.level : 0) }, 0)
}

export function charges(g: Game) {
  return chargesPerMonth(g.top, -g.bottom) + (g.liftLevel - 1) * 40 + salaries(g)
}

/** Effet de la saleté (0 = propre). */
export const dirtOf = (r: Room) => r.dirt ?? 0
export const shopPriceMult = (r: Room) => (1 + 0.25 * (r.level - 1)) * (1 - dirtOf(r) / 250)

export function shopAverage(g: Game) {
  const h = g.shopHist.slice(-3)
  return h.length ? h.reduce((a, b) => a + b, 0) / h.length : g.shopMonth
}

export function monthlyNet(g: Game) {
  const rents = g.rooms.reduce((a, r) => a + monthlyRent(g, r).net, 0)
  return rents + shopAverage(g) - charges(g)
}

export function freedom(g: Game) {
  return Math.max(0, monthlyNet(g)) / LIFESTYLE
}

export function buildingValue(g: Game) {
  let v = 0
  for (let f = 1; f <= g.top; f++) v += floorCost(f) * 0.8
  for (let f = -1; f >= g.bottom; f--) v += floorCost(f) * 0.8
  for (const r of g.rooms) v += ROOMS[r.type].cost * (1 + 0.5 * (r.level - 1))
  return v
}

export function netWorth(g: Game) {
  return g.cash + buildingValue(g) + g.rooms.reduce((a, r) => a + r.stored, 0)
}

export function tenantCount(g: Game) {
  return g.rooms.reduce((a, r) => a + r.tenants.length, 0)
}

export function avgSat(g: Game) {
  const ts = g.rooms.flatMap((r) => r.tenants)
  return ts.length ? ts.reduce((a, t) => a + t.sat, 0) / ts.length : 60
}

export function storageCap(g: Game, r: Room) {
  const k = ROOMS[r.type].kind
  if (k === 'shop') return Infinity
  return Math.max(50, monthlyRent(g, r).net * 2.5)
}

// ── Actions joueur ───────────────────────────────────────────────────────────
/** Prix réel : chaque logement (ou commerce du même type) de plus coûte davantage. */
export function roomCost(g: Game, type: RoomType) {
  const d = ROOMS[type]
  if (d.kind === 'home') return Math.round(d.cost * Math.pow(HOME_COST_GROWTH, Math.max(0, g.rooms.filter((r) => ROOMS[r.type].kind === 'home').length - HOME_COST_FREE)))
  if (d.kind === 'shop' || d.kind === 'parking') return Math.round(d.cost * Math.pow(SHOP_COST_GROWTH, g.rooms.filter((r) => r.type === type).length))
  return d.cost
}

export function build(g: Game, type: RoomType, floor: number, slot: number) {
  const cost = roomCost(g, type)
  if (!canPlace(g, type, floor, slot) || g.cash < cost || !isUnlocked(g, type)) return null
  g.cash -= cost
  const r: Room = {
    id: uid('r'), type, floor, slot, regime: type === 'studio' ? 'lmnp' : 'nu', level: 1, stored: 0,
    tenants: [], incident: null, builtAt: g.month, visits: 0,
  }
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

export function collect(g: Game, r: Room) {
  const v = r.stored
  if (v < 1) return 0
  r.stored = 0
  g.cash += v
  g.stats.collects++
  return v
}

export const renovateCost = (r: Room) => Math.round(ROOMS[r.type].cost * (0.7 + 0.5 * r.level))
export const canRenovate = (r: Room) => r.level < 3 && ROOMS[r.type].kind !== 'fixed'

export function renovate(g: Game, r: Room) {
  const c = renovateCost(r)
  if (!canRenovate(r) || g.cash < c) return false
  g.cash -= c
  r.level++
  r.tenants.forEach((t) => { t.sat = Math.min(100, t.sat + 12) })
  return true
}

export const repairCost = (r: Room) => (r.incident?.kind === 'fuite' ? 250 : 150)

export function repair(g: Game, r: Room, free = false) {
  if (!r.incident) return false
  if (!free) {
    const c = repairCost(r)
    if (g.cash < c) return false
    g.cash -= c
  }
  r.incident = null
  r.tenants.forEach((t) => { t.sat = Math.min(100, t.sat + 6) })
  g.stats.repairs++
  return true
}

/** Nettoyage ponctuel (entreprise extérieure). */
export function clean(g: Game, r: Room) {
  if (dirtOf(r) < 5 || g.cash < CLEAN_COST) return false
  g.cash -= CLEAN_COST
  r.dirt = 0
  r.tenants.forEach((t) => { t.sat = Math.min(100, t.sat + 3) })
  g.stats.cleans = (g.stats.cleans ?? 0) + 1
  return true
}

export function furnish(g: Game, r: Room) {
  const c = FURNISH_COST(r.type)
  if (r.regime === 'lmnp' || ROOMS[r.type].kind !== 'home' || g.cash < c) return false
  g.cash -= c
  r.regime = 'lmnp'
  return true
}

export const liftCost = (lvl: number) => [0, 6000, 20000][lvl] ?? Infinity
export function upgradeLift(g: Game) {
  const c = liftCost(g.liftLevel)
  if (g.liftLevel >= 3 || g.cash < c) return false
  g.cash -= c
  g.liftLevel++
  return true
}

export function evict(g: Game, r: Room) {
  // Vente d'un local vide (pas de logement occupé)
  if (r.type === 'lobby' || r.tenants.length) return 0
  const v = ROOMS[r.type].cost * 0.5
  g.cash += v + r.stored
  g.rooms = g.rooms.filter((x) => x.id !== r.id)
  return v
}

// ── Événements remontés à l'interface ───────────────────────────────────────
export type GEvent =
  | { kind: 'arrive'; name: string }
  | { kind: 'leave'; name: string; reason: string }
  | { kind: 'incident'; room: Room }
  | { kind: 'freedom'; tier: number }
  | { kind: 'quest'; quest: Quest }
  | { kind: 'month'; net: number; charges: number }
  | { kind: 'theft'; amount: number; room: Room }
  | { kind: 'caught'; byGuard: boolean }

// ── Objectifs ────────────────────────────────────────────────────────────────
const SCRIPT: Omit<Quest, 'id'>[] = [
  { kind: 'collect', title: 'Encaisse ton premier loyer', target: 1, reward: 600 },
  { kind: 'build', param: 'laverie', title: 'Construis une laverie', target: 1, reward: 1500 },
  { kind: 'count', param: 'studio', title: 'Possède 3 studios', target: 3, reward: 3000 },
  { kind: 'build', param: 'cafe', title: 'Ouvre un café', target: 1, reward: 3000 },
  { kind: 'floors', title: 'Construis le 2ᵉ étage', target: 2, reward: 4000 },
  { kind: 'build', param: 'menage', title: 'Embauche un agent d’entretien', target: 1, reward: 2500 },
  { kind: 'tenants', title: 'Loge 6 locataires', target: 6, reward: 2500 },
  { kind: 'basement', title: 'Creuse un sous-sol et ouvre un parking', target: 1, reward: 3000 },
  { kind: 'repair', title: 'Répare un incident', target: 1, reward: 1000 },
  { kind: 'income', title: 'Atteins 1 500 €/mois de revenus nets', target: 1500, reward: 4000 },
  { kind: 'renovate', title: 'Rénove un logement', target: 1, reward: 3000 },
  { kind: 'build', param: 'securite', title: 'Installe un poste de sécurité', target: 1, reward: 5000 },
  { kind: 'build', param: 'sport', title: 'Ouvre une salle de sport', target: 1, reward: 6000 },
  { kind: 'floors', title: 'Monte à 5 étages', target: 5, reward: 8000 },
  { kind: 'freedom', title: 'Atteins 50 % de liberté financière', target: 50, reward: 12000 },
  { kind: 'build', param: 'penthouse', title: 'Construis un penthouse', target: 1, reward: 20000 },
  { kind: 'freedom', title: 'Deviens financièrement libre', target: 100, reward: 40000 },
]

function generated(n: number): Omit<Quest, 'id'> {
  const step = Math.pow(1.6, n + 1)
  return n % 2 === 0
    ? { kind: 'income', title: `Atteins ${Math.round(LIFESTYLE * 1.5 * step).toLocaleString('fr-FR')} €/mois nets`, target: Math.round(LIFESTYLE * 1.5 * step), reward: Math.round(20000 * step) }
    : { kind: 'floors', title: `Monte à ${8 + n * 2} étages`, target: 8 + n * 2, reward: Math.round(25000 * step) }
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
    case 'basement': return g.rooms.some((r) => r.type === 'parking') ? 1 : 0
    case 'tenants': return tenantCount(g)
    case 'income': return monthlyNet(g)
    case 'repair': return g.stats.repairs
    case 'renovate': return g.rooms.some((r) => ROOMS[r.type].kind === 'home' && r.level > 1) ? 1 : 0
    case 'freedom': return freedom(g) * 100
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
  const f = freedom(g)
  for (let i = g.freedomTier + 1; i < FREEDOM_TIERS.length; i++) {
    if (f >= FREEDOM_TIERS[i].pct) { g.freedomTier = i; ev.push({ kind: 'freedom', tier: i }) } else break
  }
  for (const q of g.quests) if (!q.done && questProgress(g, q) >= q.target) { q.done = true; ev.push({ kind: 'quest', quest: q }) }
}

// ── Hors-ligne ───────────────────────────────────────────────────────────────
export function applyOffline(g: Game, now: number) {
  const months = Math.min(12, Math.max(0, (now - g.lastSeen) / 1000 / 600))
  g.lastSeen = now
  if (months < 0.2) return null
  const gained = Math.max(0, monthlyNet(g)) * months
  g.cash += gained
  g.stats.earned += gained
  g.month += months
  return { months, gained }
}

// ════════════════════════════════════════════════════════════════════════════
// WORLD — la vie de l'immeuble
// ════════════════════════════════════════════════════════════════════════════
export type Step =
  | { t: 'walk'; x: number }
  | { t: 'lift'; to: number }
  | { t: 'enter'; roomId: string }
  | { t: 'queue'; roomId: string }
  | { t: 'serve'; roomId: string; idx: number }
  | { t: 'fix'; roomId: string; dur: number }
  | { t: 'clean'; roomId: string }
  | { t: 'wait'; dur: number; icon?: string }
  | { t: 'steal'; roomId: string; dur: number }
  | { t: 'chase'; thiefId: string }
  | { t: 'gone' }
  | { t: 'settle' }

export interface Agent {
  id: string
  kind: 'res' | 'vis' | 'staff' | 'thief'
  role?: StaffRole
  task?: string             // pièce / voleur pris en charge par un employé
  loot?: number
  lootRoom?: string
  caught?: boolean
  tenantId?: string
  homeId?: string
  floor: number
  x: number
  steps: Step[]
  skin: string; cloth: string; hair: string
  icon: string | null
  iconT: number
  walking: boolean
  dir: 1 | -1
  inLift: boolean
  waitT: number
  carry?: 'suitcase' | 'wrench' | 'bag' | 'basket' | 'mop' | 'sack'
  speed: number
  away: boolean
  sched: { leave: number; back: number; evening: number; works: boolean }
  lastDay: number
  phaseDone: Set<string>
}

export interface Lift { y: number; dir: 1 | -1; riders: string[]; stopT: number; waiting: Map<number, string[]> }

/** Poste de service : machine à laver, table de café, appareil de sport, tabouret de bar. */
export interface Station { agentId: string | null; t: number; dur: number; phase: 'idle' | 'reserved' | 'run' | 'done'; doneT: number }

export interface World {
  agents: Agent[]
  lift: Lift
  dayIdx: number
  spawnAcc: number
  stations: Record<string, Station[]>
  queues: Record<string, string[]>
  thiefDay: number          // dernière nuit où un cambriolage a été tiré au sort
}

// ── Services (laverie, café, sport, bar) ─────────────────────────────────────
export const SERVICE_TIME: Partial<Record<RoomType, number>> = { laverie: 8, cafe: 4.5, sport: 6, bar: 6 }
const BASE_STATIONS: Partial<Record<RoomType, number>> = { laverie: 2, cafe: 3, sport: 2, bar: 4 }
const SPAN: Partial<Record<RoomType, [number, number]>> = { laverie: [3, 3], cafe: [46, 6], sport: [22, 8], bar: [14, 10] }
export const PATIENCE = { res: 10, vis: 6 }

export function stationCount(r: Room) {
  return (BASE_STATIONS[r.type] ?? 0) + (r.level - 1)
}

/** Position (x locale à l'immeuble) du poste i d'un commerce. */
export function stationX(r: Room, i: number) {
  const [a, b] = SPAN[r.type] ?? [6, 6]
  const w = ROOMS[r.type].w * SW
  const n = stationCount(r)
  return r.slot * SW + a + (i + 0.5) * ((w - a - b) / n)
}

/** File d'attente : devant la porte, côté ascenseur. */
export function queueX(r: Room, i: number) {
  return r.slot * SW + ROOMS[r.type].w * SW - 8 + i * 10
}

export function stationsOf(w: World, r: Room) {
  const n = stationCount(r)
  const st = w.stations[r.id] ?? (w.stations[r.id] = [])
  while (st.length < n) st.push({ agentId: null, t: 0, dur: 0, phase: 'idle', doneT: 0 })
  return st
}

function schedule() {
  return { leave: 0.26 + Math.random() * 0.08, back: 0.58 + Math.random() * 0.08, evening: 0.62 + Math.random() * 0.24, works: Math.random() < 0.82 }
}

function residentAgent(r: Room, t: Tenant, idx: number): Agent {
  return {
    id: `a-${t.id}`, kind: 'res', tenantId: t.id, homeId: r.id, floor: r.floor, x: homeSpot(r, idx),
    steps: [], skin: t.skin, cloth: t.cloth, hair: t.hair, icon: null, iconT: 0, walking: false, dir: 1,
    inLift: false, waitT: 0, away: false, sched: schedule(), lastDay: -1, phaseDone: new Set(), speed: walkSpeed(),
  }
}

const walkSpeed = () => WALK * (0.8 + Math.random() * 0.45)

function homeSpot(r: Room, idx: number) {
  const w = ROOMS[r.type].w * SW
  return r.slot * SW + w * (idx + 1) / ((r.tenants.length || 1) + 1)
}

export function createWorld(g: Game): World {
  const w: World = { agents: [], lift: { y: 0, dir: 1, riders: [], stopT: 0, waiting: new Map() }, dayIdx: Math.floor(g.month), spawnAcc: 0, stations: {}, queues: {}, thiefDay: -1 }
  const p = g.month % 1
  for (const r of g.rooms) r.tenants.forEach((t, i) => {
    const a = residentAgent(r, t, i)
    // Au chargement en journée, les travailleurs sont dehors.
    if (a.sched.works && p > a.sched.leave && p < a.sched.back) { a.away = true; a.phaseDone.add('leave') }
    if (p > a.sched.back) a.phaseDone.add('back').add('leave')
    if (p > a.sched.evening) a.phaseDone.add('evening')
    a.lastDay = w.dayIdx
    w.agents.push(a)
  })
  syncStaff(g, w)
  return w
}

// ── Personnel ────────────────────────────────────────────────────────────────
/** Un employé par niveau de local ; ils apparaissent / disparaissent avec les locaux. */
export function syncStaff(g: Game, w: World) {
  const want = new Set<string>()
  for (const r of g.rooms) {
    const role = ROOMS[r.type].staff
    if (!role) continue
    for (let i = 0; i < r.level; i++) {
      const id = `st-${r.id}-${i}`
      want.add(id)
      if (w.agents.some((a) => a.id === id)) continue
      const h = (r.id.charCodeAt(r.id.length - 1) + i * 7) % 6
      w.agents.push({
        id, kind: 'staff', role, homeId: r.id, floor: r.floor, x: r.slot * SW + 16 + i * 14, steps: [],
        skin: SKINS[h], cloth: STAFF[role].cloth, hair: HAIR[h % HAIR.length], icon: null, iconT: 0, walking: false, dir: 1,
        inLift: false, waitT: 0, away: false, sched: schedule(), lastDay: 0, phaseDone: new Set(), speed: WALK * 1.2,
      })
    }
  }
  w.agents = w.agents.filter((a) => a.kind !== 'staff' || want.has(a.id))
  w.lift.riders = w.lift.riders.filter((id) => w.agents.some((a) => a.id === id))
}

const isNight = (p: number) => p > 0.88 || p < 0.22

function staffHome(g: Game, a: Agent) {
  return g.rooms.find((r) => r.id === a.homeId)
}

function goHome(g: Game, a: Agent) {
  const home = staffHome(g, a)
  if (!home) return
  const idx = Number(a.id.split('-').pop()) || 0
  const hx = home.slot * SW + 16 + idx * 14
  if (a.floor === home.floor && Math.abs(a.x - hx) < 2) {
    a.steps = [{ t: 'wait', dur: 1.5 + Math.random() * 2, icon: Math.random() < 0.15 ? '☕' : undefined }]
  } else a.steps = route(a.floor, home.floor, hx)
}

function runStaff(g: Game, w: World, a: Agent, p: number) {
  // Alerte : le vigile interrompt sa ronde (jamais au milieu d'un trajet en ascenseur).
  if (a.role === 'guard' && !a.task && a.steps.length && !a.inLift && (a.steps[0].t === 'walk' || a.steps[0].t === 'wait')
    && w.agents.some((t) => t.kind === 'thief' && !t.caught)) a.steps = []
  if (a.steps.length) return
  const claimed = (id: string) => w.agents.some((o) => o !== a && o.kind === 'staff' && o.task === id)
  a.task = undefined
  if (a.role === 'tech') {
    const broken = g.rooms.filter((r) => r.incident && !claimed(r.id))
      .sort((x, y) => Math.abs(x.floor - a.floor) - Math.abs(y.floor - a.floor))[0]
    if (broken) {
      a.task = broken.id; a.carry = 'wrench'
      a.steps = [...route(a.floor, broken.floor, roomX(broken)), { t: 'fix', roomId: broken.id, dur: 2.2 }]
      return
    }
    a.carry = undefined
  } else if (a.role === 'janitor') {
    let best: Room | null = null, score = -Infinity
    for (const r of g.rooms) {
      if (dirtOf(r) < 15 || claimed(r.id)) continue
      const sc = dirtOf(r) - 8 * Math.abs(r.floor - a.floor)
      if (sc > score) { score = sc; best = r }
    }
    if (best) {
      a.task = best.id; a.carry = 'mop'
      a.steps = [...route(a.floor, best.floor, roomX(best, 0.3 + Math.random() * 0.4)), { t: 'clean', roomId: best.id }]
      return
    }
    a.carry = undefined
  } else if (a.role === 'guard') {
    const thief = w.agents.find((t) => t.kind === 'thief' && !t.caught && !claimed(t.id))
    if (thief) {
      a.task = thief.id
      // Les caméras montrent où il va : on l'attend sur place.
      const st = thief.steps.find((x) => x.t === 'steal') as { roomId: string } | undefined
      const r = st && g.rooms.find((x) => x.id === st.roomId)
      a.steps = r && !thief.inLift && thief.floor !== r.floor
        ? [...route(a.floor, r.floor, roomX(r)), { t: 'chase', thiefId: thief.id }]
        : thief.inLift ? [{ t: 'wait', dur: 0.5 }] : [...route(a.floor, thief.floor, thief.x), { t: 'chase', thiefId: thief.id }]
      say(a, '🚨', 2)
      return
    }
    if (isNight(p)) {
      // Ronde : un étage au hasard, d'un bout à l'autre.
      const f = g.bottom + Math.floor(Math.random() * (g.top - g.bottom + 1))
      a.steps = [...route(a.floor, f, 10 + Math.random() * (SLOTS * SW - 20)), { t: 'wait', dur: 1 + Math.random() * 1.5, icon: Math.random() < 0.3 ? '🔦' : undefined }]
      return
    }
  }
  goHome(g, a)
}

/** Les nuits, un cambrioleur peut tenter sa chance là où dorment les loyers. */
function maybeThief(g: Game, w: World, p: number, day: number) {
  if (g.top < 3 || w.thiefDay === day || p < 0.9) return
  w.thiefDay = day
  const first = !(g.stats.caught || g.stats.stolen)
  if ((!first && Math.random() > 0.45) || w.agents.some((a) => a.kind === 'thief')) return
  const loot = g.rooms.filter((r) => r.stored >= 80 && ROOMS[r.type].kind !== 'service').sort((a, b) => b.stored - a.stored)
  const r = loot[0]
  if (!r) return
  w.agents.push({
    id: uid('x'), kind: 'thief', floor: 0, x: EXIT_X, skin: pick(SKINS), cloth: '#1f1f2b', hair: '#111', icon: '🤫', iconT: 3,
    steps: [...route(0, r.floor, roomX(r)), { t: 'steal', roomId: r.id, dur: 6 }, ...route(r.floor, 0, 20), { t: 'walk', x: EXIT_X }, { t: 'gone' }],
    walking: false, dir: 1, inLift: false, waitT: 0, away: false, sched: schedule(), lastDay: day, phaseDone: new Set(), speed: WALK * 1.05,
  })
}

/** Le joueur tape sur un cambrioleur : il détale (sans vigile, il faut être là au bon moment). */
export function scareThief(g: Game, w: World, id: string, ev: GEvent[]) {
  const t = w.agents.find((a) => a.id === id && a.kind === 'thief' && !a.caught)
  if (!t || t.inLift) return false
  catchThief(g, w, null, t, ev)
  return true
}

function catchThief(g: Game, w: World, guard: Agent | null, t: Agent, ev: GEvent[]) {
  t.caught = true
  if (t.loot && t.lootRoom) { const r = g.rooms.find((x) => x.id === t.lootRoom); if (r) r.stored += t.loot }
  t.loot = 0; t.carry = undefined; t.speed = WALK * 1.7
  say(t, '😱', 3); if (guard) say(guard, '✋', 2.5)
  w.queues = Object.fromEntries(Object.entries(w.queues).map(([k, v]) => [k, v.filter((x) => x !== t.id)]))
  const exit: Step[] = t.inLift ? [] : [...route(t.floor, 0, 20), { t: 'walk', x: EXIT_X }, { t: 'gone' }]
  if (!t.inLift) t.steps = exit
  g.stats.caught = (g.stats.caught ?? 0) + 1
  ev.push({ kind: 'caught', byGuard: !!guard })
}

/** Chemin d'un étage/position vers un autre (via l'ascenseur si besoin). */
function route(fromFloor: number, toFloor: number, toX: number): Step[] {
  if (fromFloor === toFloor) return [{ t: 'walk', x: toX }]
  return [{ t: 'walk', x: shaftX }, { t: 'lift', to: toFloor }, { t: 'walk', x: toX }]
}

function say(a: Agent, icon: string, dur = 2.6) { a.icon = icon; a.iconT = dur }

function findTenant(g: Game, a: Agent) {
  const r = g.rooms.find((x) => x.id === a.homeId)
  return { room: r, tenant: r?.tenants.find((t) => t.id === a.tenantId) }
}

const DIRT_PER_USE: Partial<Record<RoomType, number>> = { laverie: 2.5, cafe: 3, sport: 3, bar: 4 }
function dirty(r: Room | undefined, v: number) { if (r) r.dirt = Math.min(100, dirtOf(r) + v) }

const NEED_ROOM: Record<Need, RoomType> = { food: 'cafe', laundry: 'laverie', sport: 'sport', fun: 'bar' }
const NEED_ICON: Record<Need, string> = { food: '☕', laundry: '🧺', sport: '🏋️', fun: '🍸' }

/** Avance la simulation de dt secondes. */
export function step(g: Game, w: World, dt: number, ev: GEvent[]) {
  const prevMonth = g.month
  g.month += dt / DAY_S
  const p = g.month % 1
  const day = Math.floor(g.month)

  // ── Loyers en continu ──
  for (const r of g.rooms) {
    const k = ROOMS[r.type].kind
    if (k === 'home' && r.tenants.length) r.dirt = Math.min(100, dirtOf(r) + r.tenants.length * 6 * dt / DAY_S)
    if (k !== 'home' && k !== 'parking') continue
    const rent = monthlyRent(g, r)
    const cap = storageCap(g, r)
    if (r.stored < cap) {
      const add = rent.net * dt / DAY_S
      r.stored = Math.min(cap, r.stored + add)
      g.stats.earned += add
      g.stats.taxes += (rent.gross - rent.net) * dt / DAY_S
    }
  }

  // ── Nouveau mois ──
  if (day > Math.floor(prevMonth)) monthRollover(g, w, ev)

  // ── Vie des résidents ──
  for (const a of [...w.agents]) {
    if (a.kind !== 'res') continue
    const { room, tenant } = findTenant(g, a)
    if (!room || !tenant) continue
    if (a.lastDay !== day) { a.lastDay = day; a.phaseDone.clear(); a.sched = schedule() }
    if (a.steps.length) continue
    // Départ au travail
    if (a.sched.works && !a.phaseDone.has('leave') && p >= a.sched.leave && p < a.sched.back) {
      a.phaseDone.add('leave')
      const ps = parkingStatus(g)
      const park = tenant.car && ps.spots > 0 ? g.rooms.find((r) => r.type === 'parking') : undefined
      if (tenant.car && !park) { say(a, '🚗❌'); tenant.sat = Math.max(0, tenant.sat - 5) }
      a.carry = 'bag'
      dirty(g.rooms.find((r) => r.type === 'lobby'), 0.25)
      a.steps = park
        ? [...route(a.floor, park.floor, roomX(park, 0.6)), { t: 'gone' }]
        : [...route(a.floor, 0, 20), { t: 'walk', x: EXIT_X }, { t: 'gone' }]
      continue
    }
    // Retour
    if (a.away && !a.phaseDone.has('back') && p >= a.sched.back) {
      a.phaseDone.add('back')
      const park = tenant.car ? g.rooms.find((r) => r.type === 'parking') : undefined
      a.away = false
      a.carry = undefined
      if (park) { a.floor = park.floor; a.x = roomX(park, 0.6) } else { a.floor = 0; a.x = EXIT_X }
      const idx = room.tenants.indexOf(tenant)
      a.steps = route(a.floor, room.floor, homeSpot(room, idx))
      continue
    }
    // Soirée : satisfaire un besoin
    if (!a.away && !a.phaseDone.has('evening') && p >= a.sched.evening && p < 0.9) {
      a.phaseDone.add('evening')
      const need = pick(tenant.needs)
      const target = g.rooms.filter((r) => r.type === NEED_ROOM[need])
      if (!target.length) {
        say(a, `${NEED_ICON[need]}❌`, 3)
        tenant.sat = Math.max(0, tenant.sat - 9)
      } else {
        const t = pick(target)
        const idx = room.tenants.indexOf(tenant)
        if (need === 'laundry') a.carry = 'basket'
        a.steps = [...route(a.floor, t.floor, queueX(t, 0)), { t: 'enter', roomId: t.id }, ...route(t.floor, room.floor, homeSpot(room, idx))]
      }
    }
    // Petits déplacements chez soi (vivant, mais pas la nuit)
    if (!a.away && p > 0.24 && p < 0.9 && Math.random() < dt * 0.07) {
      const wpx = ROOMS[room.type].w * SW
      a.steps = [{ t: 'walk', x: room.slot * SW + 10 + Math.random() * (wpx - 20) }]
      continue
    }
    // Sommeil / bruit
    if (!a.away && (p > 0.92 || p < 0.2) && !a.icon) {
      const noisy = g.rooms.some((r) => ROOMS[r.type].noisy && Math.abs(r.floor - room.floor) <= 1)
      if (noisy && Math.random() < dt * 0.15) { say(a, '😫', 2); tenant.sat = Math.max(0, tenant.sat - 0.6) }
      else if (Math.random() < dt * 0.25) say(a, '💤', 2)
    }
  }

  // ── Clients venus de la rue ──
  const shops = g.rooms.filter((r) => ROOMS[r.type].kind === 'shop')
  if (shops.length && p > 0.28 && p < 0.88) {
    const appeal = 0.6 + avgSat(g) / 100
    w.spawnAcc += dt * 0.12 * Math.min(6, shops.length) * appeal
    while (w.spawnAcc >= 1) {
      w.spawnAcc -= 1
      const visitors = w.agents.filter((a) => a.kind === 'vis').length
      if (visitors > 14) break
      const s = pick(shops)
      dirty(g.rooms.find((r) => r.type === 'lobby'), 0.6)
      w.agents.push({
        id: uid('v'), kind: 'vis', floor: 0, x: EXIT_X, skin: pick(SKINS), cloth: pick(CLOTHES), hair: pick(HAIR),
        steps: [...route(0, s.floor, queueX(s, 0)), { t: 'enter', roomId: s.id }, ...route(s.floor, 0, 20), { t: 'walk', x: EXIT_X }, { t: 'gone' }],
        icon: null, iconT: 0, walking: false, dir: 1, inLift: false, waitT: 0, away: false, sched: schedule(), lastDay: day, phaseDone: new Set(),
        speed: walkSpeed(), carry: s.type === 'laverie' ? 'basket' : undefined,
      })
    }
  }

  // ── Personnel & cambrioleurs ──
  syncStaff(g, w)
  for (const a of w.agents) if (a.kind === 'staff') runStaff(g, w, a, p)
  maybeThief(g, w, p, day)

  // ── Postes de service : libération des postes orphelins, fin d'affichage « terminé » ──
  const alive = new Set(w.agents.map((a) => a.id))
  for (const id of Object.keys(w.stations)) {
    if (!g.rooms.some((r) => r.id === id)) { delete w.stations[id]; delete w.queues[id]; continue }
    for (const st of w.stations[id]) {
      if (st.agentId && !alive.has(st.agentId)) { st.agentId = null; st.phase = 'idle'; st.t = 0 }
      if (st.phase === 'done') { st.doneT -= dt; if (st.doneT <= 0) st.phase = 'idle' }
    }
  }
  for (const id of Object.keys(w.queues)) w.queues[id] = w.queues[id].filter((x) => alive.has(x))

  // ── Déplacements ──
  for (const a of [...w.agents]) moveAgent(g, w, a, dt, ev)

  // ── Ascenseur ──
  runLift(g, w, dt)

  // Icônes
  for (const a of w.agents) if (a.iconT > 0) { a.iconT -= dt; if (a.iconT <= 0) a.icon = null }

  checkProgress(g, ev)
}

function moveAgent(g: Game, w: World, a: Agent, dt: number, ev: GEvent[]) {
  a.walking = false
  const s = a.steps[0]
  if (!s || a.inLift) return
  if (s.t === 'walk') {
    const dx = s.x - a.x
    const d = (a.speed ?? WALK) * dt
    a.dir = dx >= 0 ? 1 : -1
    if (Math.abs(dx) <= d) { a.x = s.x; a.steps.shift() } else { a.x += Math.sign(dx) * d; a.walking = true }
  } else if (s.t === 'lift') {
    if (a.waitT === 0) {
      const q = w.lift.waiting.get(a.floor) ?? []
      if (!q.includes(a.id)) { q.push(a.id); w.lift.waiting.set(a.floor, q) }
    }
    a.waitT += dt
    if (a.waitT > 7 && a.waitT - dt <= 7) {
      say(a, '😤', 2.5)
      if (a.kind === 'res') { const { tenant } = findTenant(g, a); if (tenant) tenant.sat = Math.max(0, tenant.sat - 4) }
    }
  } else if (s.t === 'enter') {
    const r = g.rooms.find((x) => x.id === s.roomId)
    if (!r) { a.steps.shift(); return }
    // Local sale : les clients de passage tournent les talons.
    if (dirtOf(r) > 50 && Math.random() < (dirtOf(r) - 50) / 70) {
      say(a, '🤢', 2.8)
      if (a.kind === 'vis') { g.stats.lost = (g.stats.lost ?? 0) + 1; a.steps.shift(); return }
      const { tenant } = findTenant(g, a); if (tenant) tenant.sat = Math.max(0, tenant.sat - 3)
    }
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
    const r = g.rooms.find((x) => x.id === s.roomId)
    const q = r ? w.queues[r.id] ?? [] : []
    const pos = q.indexOf(a.id)
    if (!r || pos < 0) { a.icon = null; a.steps.shift(); return }
    // Se placer dans la file
    const qx = queueX(r, pos)
    const dx = qx - a.x
    if (Math.abs(dx) > 1) { a.x += Math.sign(dx) * Math.min(Math.abs(dx), (a.speed ?? WALK) * dt); a.walking = true; a.dir = dx > 0 ? 1 : -1 } else a.dir = -1
    a.waitT += dt
    const st = stationsOf(w, r)
    const free = st.findIndex((x) => !x.agentId)
    if (pos === 0 && free >= 0) {
      q.shift(); a.icon = null; a.iconT = 0
      st[free].agentId = a.id; st[free].phase = 'reserved'; st[free].t = 0
      a.steps.splice(0, 1, { t: 'walk', x: stationX(r, free) }, { t: 'serve', roomId: r.id, idx: free })
    } else if (a.waitT > (a.kind === 'res' ? PATIENCE.res : PATIENCE.vis)) {
      // Trop d'attente : on repart, agacé.
      w.queues[r.id] = q.filter((x) => x !== a.id)
      say(a, '😤', 2.8)
      if (a.kind === 'res') { const { tenant } = findTenant(g, a); if (tenant) tenant.sat = Math.max(0, tenant.sat - 7) }
      else g.stats.lost = (g.stats.lost ?? 0) + 1
      a.steps.shift()
    }
  } else if (s.t === 'serve') {
    const r = g.rooms.find((x) => x.id === s.roomId)
    if (!r) { a.steps.shift(); return }
    const st = stationsOf(w, r)[s.idx]
    if (!st) { a.steps.shift(); return }
    if (st.phase !== 'run') {
      st.phase = 'run'; st.t = 0; st.dur = SERVICE_TIME[r.type] ?? 4
      if (r.type === 'laverie') a.carry = undefined
      say(a, r.type === 'cafe' ? '☕' : r.type === 'sport' ? '💪' : r.type === 'bar' ? '🍸' : '🫧', 1.6)
    }
    a.dir = -1
    st.t += dt
    if (st.t >= st.dur) {
      const net = (ROOMS[r.type].price ?? 0) * shopPriceMult(r) * (1 - TAX.bic)
      dirty(r, DIRT_PER_USE[r.type] ?? 3)
      r.stored += net
      r.visits++
      g.shopMonth += net
      g.stats.earned += net
      g.stats.visits++
      st.agentId = null; st.phase = 'done'; st.doneT = 1.2; st.t = 0
      if (r.type === 'laverie') a.carry = 'basket'
      say(a, a.kind === 'res' ? '😊' : '💶', 1.6)
      if (a.kind === 'res') { const { tenant } = findTenant(g, a); if (tenant) tenant.sat = Math.min(100, tenant.sat + 4) }
      a.steps.shift()
    }
  } else if (s.t === 'fix') {
    s.dur -= dt
    say(a, '🔧', 0.3)
    if (s.dur <= 0) {
      const r = g.rooms.find((x) => x.id === s.roomId)
      if (r) repair(g, r, true)
      a.steps.shift()
    }
  } else if (s.t === 'clean') {
    const r = g.rooms.find((x) => x.id === s.roomId)
    if (!r) { a.steps.shift(); return }
    r.dirt = Math.max(0, dirtOf(r) - 40 * dt)
    a.walking = Math.random() < 0.5
    if (!a.icon) say(a, '🧽', 0.8)
    if (r.dirt <= 0) { say(a, '✨', 1.4); a.steps.shift(); a.task = undefined }
  } else if (s.t === 'wait') {
    if (s.icon && !a.icon) { say(a, s.icon, 1.5); s.icon = undefined }
    s.dur -= dt
    if (s.dur <= 0) a.steps.shift()
  } else if (s.t === 'steal') {
    const r = g.rooms.find((x) => x.id === s.roomId)
    s.dur -= dt
    if (!a.icon) say(a, '💰', 0.8)
    a.walking = Math.random() < 0.3
    if (!r) { a.steps.shift(); return }
    if (s.dur <= 0) {
      const amount = Math.round(r.stored * 0.7)
      r.stored -= amount
      a.loot = amount; a.lootRoom = r.id; a.carry = 'sack'; a.speed = WALK * 1.35
      r.tenants.forEach((t) => { t.sat = Math.max(0, t.sat - 8) })
      g.stats.stolen = (g.stats.stolen ?? 0) + amount
      say(a, '🏃', 2)
      ev.push({ kind: 'theft', amount, room: r })
      a.steps.shift()
    }
  } else if (s.t === 'chase') {
    const t = w.agents.find((x) => x.id === s.thiefId)
    if (!t || t.caught) { a.steps.shift(); a.task = undefined; return }
    if (t.inLift || t.floor !== a.floor) {
      // Pas (encore) à cet étage : on attend s'il doit venir voler ici, sinon on le suit.
      const st = t.steps.find((x) => x.t === 'steal') as { roomId: string } | undefined
      const r = st && g.rooms.find((x) => x.id === st.roomId)
      if (r && r.floor === a.floor) return
      if (!t.inLift) a.steps = [...route(a.floor, t.floor, t.x), { t: 'chase', thiefId: t.id }]
      return
    }
    const dx = t.x - a.x
    a.dir = dx >= 0 ? 1 : -1
    if (Math.abs(dx) < 9) { catchThief(g, w, a, t, ev); a.steps.shift(); a.task = undefined; return }
    a.x += Math.sign(dx) * Math.min(Math.abs(dx), a.speed * 1.35 * dt)
    a.walking = true
  } else if (s.t === 'gone') {
    a.steps.shift()
    if (a.kind === 'res') a.away = true
    else w.agents = w.agents.filter((x) => x.id !== a.id)
  } else if (s.t === 'settle') {
    a.steps.shift()
  }
  if (!a.steps.length && a.carry === 'basket' && a.kind === 'res') a.carry = undefined
  void ev
}

function runLift(g: Game, w: World, dt: number) {
  const L = w.lift
  const cap = LIFT_CAP + (g.liftLevel - 1) * 3
  const speed = LIFT_SPEED * (1 + 0.45 * (g.liftLevel - 1))
  // Nettoyage des appels d'agents disparus
  for (const [f, ids] of L.waiting) L.waiting.set(f, ids.filter((id) => w.agents.some((a) => a.id === id)))
  // Un passager dont le trajet a changé en cours de route descend au prochain étage.
  for (const id of L.riders) {
    const a = w.agents.find((x) => x.id === id)
    if (a && a.steps[0]?.t !== 'lift') a.steps.unshift({ t: 'lift', to: L.dir > 0 ? Math.ceil(L.y - 0.001) : Math.floor(L.y + 0.001) })
  }
  const calls = new Set<number>()
  // Cabine pleine : on ne s'arrête plus pour prendre du monde (sinon blocage).
  if (L.riders.length < cap) for (const [f, ids] of L.waiting) if (ids.length) calls.add(f)
  for (const id of L.riders) {
    const a = w.agents.find((x) => x.id === id)
    const s = a?.steps[0]
    if (s && s.t === 'lift') calls.add(s.to)
  }
  for (const id of L.riders) { const a = w.agents.find((x) => x.id === id); if (a) a.floor = L.y }
  if (L.stopT > 0) { L.stopT -= dt; return }
  if (!calls.size) return
  const list = [...calls]
  const ahead = list.filter((f) => (L.dir > 0 ? f >= L.y - 0.001 : f <= L.y + 0.001))
  if (!ahead.length) { L.dir = (L.dir * -1) as 1 | -1; return }
  const target = ahead.reduce((b, f) => (Math.abs(f - L.y) < Math.abs(b - L.y) ? f : b))
  const d = target - L.y
  const mv = speed * dt
  if (Math.abs(d) > mv) { L.y += Math.sign(d) * mv; return }
  L.y = target
  // Arrêt : descente puis montée
  let changed = false
  L.riders = L.riders.filter((id) => {
    const a = w.agents.find((x) => x.id === id)
    const s = a?.steps[0]
    if (a && s && s.t === 'lift' && s.to === target) {
      a.inLift = false; a.floor = target; a.x = shaftX; a.steps.shift(); a.waitT = 0; changed = true
      return false
    }
    return !!a
  })
  const q = L.waiting.get(target) ?? []
  const stay: string[] = []
  for (const id of q) {
    const a = w.agents.find((x) => x.id === id)
    if (!a) continue
    if (L.riders.length < cap) { L.riders.push(id); a.inLift = true; a.waitT = 0; changed = true } else stay.push(id)
  }
  L.waiting.set(target, stay)
  if (changed) L.stopT = 0.6
}

function monthRollover(g: Game, w: World, ev: GEvent[]) {
  const hasConcierge = g.rooms.some((r) => r.type === 'concierge')
  // Bilan des commerces
  g.shopHist = [...g.shopHist, g.shopMonth].slice(-6)
  g.shopMonth = 0
  // Charges
  const ch = charges(g)
  g.cash -= ch
  g.stats.charges += ch
  // Satisfaction, départs, arrivées, incidents
  for (const r of g.rooms) {
    const d = ROOMS[r.type]
    if (d.kind !== 'home') continue
    const noisy = g.rooms.some((x) => ROOMS[x.type].noisy && Math.abs(x.floor - r.floor) <= 1)
    for (const t of [...r.tenants]) {
      let target = 62 + (hasConcierge ? 8 : 0) + (r.level - 1) * 6 - (r.regime === 'lmnp' && r.type !== 'studio' ? 4 : 0)
      if (dirtOf(r) > 30) target -= (dirtOf(r) - 30) / 3
      if (r.type === 'penthouse') target -= (g.rooms.some((x) => x.type === 'sport') ? 0 : 15) + (noisy ? 15 : 0)
      t.sat += (target - t.sat) * 0.15
      if (r.incident) t.sat -= 8
      if (noisy) t.sat -= 4
      t.sat = Math.max(0, Math.min(100, t.sat))
      if (t.sat < 22) {
        r.tenants = r.tenants.filter((x) => x.id !== t.id)
        g.stats.moves++
        const a = w.agents.find((x) => x.tenantId === t.id)
        if (a) {
          a.kind = 'vis'; a.tenantId = undefined; a.carry = 'suitcase'; say(a, '😤', 4)
          if (!a.away) a.steps = [...route(a.floor, 0, 20), { t: 'walk', x: EXIT_X }, { t: 'gone' }]
          else w.agents = w.agents.filter((x) => x.id !== a.id)
        }
        ev.push({ kind: 'leave', name: t.name, reason: r.incident ? 'un incident non réparé' : dirtOf(r) > 60 ? 'la saleté' : noisy ? 'le bruit du bar' : 'son mécontentement' })
      }
    }
    // Arrivée d'un nouveau locataire
    const cap = d.capacity ?? 1
    if (r.tenants.length < cap && Math.random() < 0.55 + avgSat(g) / 250) {
      const t = newTenant()
      r.tenants.push(t)
      const idx = r.tenants.length - 1
      const a = residentAgent(r, t, idx)
      a.floor = 0; a.x = EXIT_X; a.carry = 'suitcase'; a.lastDay = Math.floor(g.month); a.phaseDone.add('leave').add('back')
      a.steps = [...route(0, r.floor, homeSpot(r, idx)), { t: 'settle' }]
      say(a, '🏠', 3)
      w.agents.push(a)
      ev.push({ kind: 'arrive', name: t.name })
    }
    // Incidents
    if (!r.incident && r.tenants.length && Math.random() < 0.08) {
      r.incident = { kind: Math.random() < 0.55 ? 'fuite' : 'panne', since: g.month }
      ev.push({ kind: 'incident', room: r })
    }
  }
  ev.push({ kind: 'month', net: monthlyNet(g), charges: ch })
}

/** Fait apparaître le premier locataire d'un logement tout neuf (rapidement). */
export function welcomeTenant(g: Game, w: World, r: Room) {
  const t = newTenant()
  r.tenants.push(t)
  const idx = r.tenants.length - 1
  const a = residentAgent(r, t, idx)
  a.floor = 0; a.x = EXIT_X; a.carry = 'suitcase'; a.lastDay = Math.floor(g.month); a.phaseDone.add('leave').add('back')
  a.steps = [...route(0, r.floor, homeSpot(r, idx)), { t: 'settle' }]
  say(a, '🏠', 3)
  w.agents.push(a)
  return t
}

export function spawnConciergeIfNeeded(g: Game, w: World) {
  syncStaff(g, w)
}

export const NEED_LABEL: Record<Need, string> = { food: 'Manger (café)', laundry: 'Laver son linge', sport: 'Faire du sport', fun: 'Sortir (bar)' }
export { NEED_ICON }
