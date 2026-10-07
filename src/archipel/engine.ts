/**
 * ARCHIPEL — moteur de jeu (fonctions pures sur l'état).
 */

import {
  DEFS, SYNERGY, MONTH_SECONDS, STORAGE_MONTHS, STORAGE_PER_LEVEL, START_CASH,
  EXPENSES, SALARY_BY_LEVEL, CAREER_COST, LIFESTYLE_CREEP, upgradeCost, landCost, PHASES, NEXT_PHASE,
  FREEDOM_TIERS, OFFLINE_SECONDS_PER_MONTH, OFFLINE_MAX_MONTHS,
  type BType, type Phase,
} from './data'

export interface Building {
  id: string
  type: BType
  q: number
  r: number
  level: number
  capital: number      // € investis (hors marché)
  units: number        // pour les actifs de marché : parts (valeur = units × indice)
  stored: number       // € nets prêts à être récoltés
  builtAt: number      // mois de jeu de la construction
}

export interface Quest {
  id: string
  title: string
  target: number
  reward: number
  kind: QuestKind
  param?: string
  done?: boolean
}

export type QuestKind =
  | 'collect_home' | 'build' | 'collects' | 'passive' | 'land' | 'level'
  | 'adjacent' | 'career' | 'networth' | 'mature' | 'freedom'

export interface GameState {
  version: number
  cash: number
  month: number                 // mois de jeu écoulés (float)
  land: string[]                // cases de terre « q,r »
  buildings: Building[]
  market: { phase: Phase; phaseEnds: number; stock: number; crypto: number; hist?: [number, number][] }
  stats: { collects: number; earned: number; taxes: number; peakNetWorth: number }
  quests: Quest[]
  questCursor: number
  freedomTier: number           // dernier palier de liberté franchi (index)
  seenUnlocks: BType[]
  lastSeen: number              // ms réels
  muted: boolean
  introDone: boolean
}

export const key = (q: number, r: number) => `${q},${r}`
export const parseKey = (k: string) => k.split(',').map(Number) as [number, number]
export const NEIGHBORS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

let idSeq = 0
const newId = () => `b${Date.now().toString(36)}${(idSeq++).toString(36)}`

// ── Création ─────────────────────────────────────────────────────────────────
export function createGame(): GameState {
  const land: string[] = []
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.abs(q) + Math.abs(r) <= 2) land.push(key(q, r))
  const s: GameState = {
    version: 1,
    cash: START_CASH,
    month: 0,
    land,
    buildings: [{ id: 'home', type: 'maison', q: 0, r: 0, level: 1, capital: 0, units: 0, stored: savingsPerMonth(1) * 1.3, builtAt: 0 }],
    market: { phase: 'calme', phaseEnds: 14, stock: 1, crypto: 1, hist: [[1, 1]] },
    stats: { collects: 0, earned: 0, taxes: 0, peakNetWorth: START_CASH },
    quests: [],
    questCursor: 0,
    freedomTier: -1,
    seenUnlocks: ['banque', 'etf'],
    lastSeen: Date.now(),
    muted: false,
    introDone: false,
  }
  fillQuests(s)
  return s
}

// ── Valeurs ──────────────────────────────────────────────────────────────────
export function salaryFor(level: number) {
  return SALARY_BY_LEVEL[Math.min(level, SALARY_BY_LEVEL.length - 1)]
}

/** Dépenses mensuelles : elles grimpent avec la carrière (inflation du train de vie). */
export function expensesFor(level: number) {
  return Math.round(EXPENSES + LIFESTYLE_CREEP * (salaryFor(level) - SALARY_BY_LEVEL[1]))
}

export function savingsPerMonth(level: number) {
  return salaryFor(level) - expensesFor(level)
}

export function expenses(s: GameState) {
  return expensesFor(s.buildings.find((b) => b.type === 'maison')?.level ?? 1)
}

export function marketIndex(s: GameState, b: Building) {
  const m = DEFS[b.type].market
  return m === 'stock' ? s.market.stock : m === 'crypto' ? s.market.crypto : 1
}

export function yearsHeld(s: GameState, b: Building) {
  return Math.max(0, (s.month - b.builtAt) / 12)
}

export function isMature(s: GameState, b: Building) {
  const d = DEFS[b.type]
  return !!d.matureAfterYears && yearsHeld(s, b) >= d.matureAfterYears
}

export function currentTaxRate(s: GameState, b: Building) {
  const d = DEFS[b.type]
  return isMature(s, b) && d.matureTaxRate != null ? d.matureTaxRate : d.taxRate
}

export function buildingValue(s: GameState, b: Building) {
  const d = DEFS[b.type]
  if (b.type === 'maison') return 0
  if (d.market) return b.units * marketIndex(s, b)
  const appr = d.appreciation ? Math.pow(1 + d.appreciation, yearsHeld(s, b)) : 1
  return b.capital * appr
}

// ── Synergies ────────────────────────────────────────────────────────────────
export interface SynergyLine { from: BType | 'diversite'; pct: number }

export function buildingAt(s: GameState, q: number, r: number) {
  return s.buildings.find((b) => b.q === q && b.r === r)
}

/** Quartier = composante connexe de bâtiments voisins. */
function district(s: GameState, b: Building, extra?: { type: BType; q: number; r: number }) {
  const all = [...s.buildings, ...(extra ? [{ ...extra, id: '__ghost' } as Building] : [])]
  const at = (q: number, r: number) => all.find((x) => x.q === q && x.r === r)
  const seen = new Set<string>([key(b.q, b.r)])
  const stack = [b]
  const types = new Set<BType>()
  while (stack.length) {
    const cur = stack.pop()!
    types.add(cur.type)
    for (const [dq, dr] of NEIGHBORS) {
      const n = at(cur.q + dq, cur.r + dr)
      if (n && !seen.has(key(n.q, n.r))) { seen.add(key(n.q, n.r)); stack.push(n) }
    }
  }
  return types
}

export function synergyFor(
  s: GameState, type: BType, q: number, r: number, ghost?: { type: BType; q: number; r: number },
): { lines: SynergyLine[]; total: number } {
  const lines: SynergyLine[] = []
  const table = SYNERGY[type] ?? {}
  for (const [dq, dr] of NEIGHBORS) {
    const nq = q + dq, nr = r + dr
    const n = ghost && ghost.q === nq && ghost.r === nr ? ghost : buildingAt(s, nq, nr)
    if (!n) continue
    const pct = table[n.type]
    if (pct) lines.push({ from: n.type, pct })
  }
  const types = district(s, { id: 'x', type, q, r } as Building, ghost)
  if (types.size >= 6) lines.push({ from: 'diversite', pct: 15 })
  else if (types.size >= 4) lines.push({ from: 'diversite', pct: 8 })
  const total = lines.reduce((a, l) => a + l.pct, 0)
  return { lines, total }
}

export function diversityBonus(s: GameState, b: Building) {
  const types = district(s, b)
  return types.size >= 6 ? 15 : types.size >= 4 ? 8 : 0
}

function multiplier(totalPct: number) {
  return Math.max(0.4, Math.min(1.9, 1 + totalPct / 100))
}

// ── Production ───────────────────────────────────────────────────────────────
export interface Production { gross: number; tax: number; net: number; mult: number }

/** Production mensuelle d'un bâtiment (avec synergies, marché et niveau). */
export function monthlyProduction(s: GameState, b: Building): Production {
  if (b.type === 'maison') {
    const sv = savingsPerMonth(b.level)
    const mult = multiplier(synergyFor(s, 'maison', b.q, b.r).total)
    return { gross: sv * mult, tax: 0, net: sv * mult, mult }
  }
  const d = DEFS[b.type]
  const syn = synergyFor(s, b.type, b.q, b.r).total
  const lvl = Math.pow(1.12, b.level - 1)
  const phase = PHASES[s.market.phase]
  const mk = d.market === 'stock' ? phase.stockProd : d.market === 'crypto' ? phase.cryptoProd : 1
  const mult = multiplier(syn) * lvl * mk
  const gross = (buildingValue(s, b) * d.grossYield / 12) * mult
  const tax = gross * currentTaxRate(s, b)
  return { gross, tax, net: gross - tax, mult }
}

export function storageCap(s: GameState, b: Building) {
  const p = monthlyProduction(s, b).net
  return Math.max(1, p * (STORAGE_MONTHS + STORAGE_PER_LEVEL * (b.level - 1)))
}

export function passiveIncome(s: GameState) {
  return s.buildings.filter((b) => b.type !== 'maison').reduce((a, b) => a + monthlyProduction(s, b).net, 0)
}

export function netWorth(s: GameState) {
  return s.cash + s.buildings.reduce((a, b) => a + buildingValue(s, b) + b.stored, 0)
}

export function freedom(s: GameState) {
  return passiveIncome(s) / expenses(s)
}

export function isUnlocked(s: GameState, t: BType) {
  return s.stats.peakNetWorth >= DEFS[t].unlock
}

// ── Événements remontés à l'UI ───────────────────────────────────────────────
export type GameEvent =
  | { kind: 'phase'; phase: Phase }
  | { kind: 'unlock'; type: BType }
  | { kind: 'freedom'; tier: number }
  | { kind: 'quest'; quest: Quest }
  | { kind: 'mature'; type: BType }

// ── Tick ─────────────────────────────────────────────────────────────────────
export function tick(s: GameState, dt: number, events: GameEvent[]) {
  const prevMonth = s.month
  s.month += dt / MONTH_SECONDS
  const dm = s.month - prevMonth

  // Marché
  const ph = PHASES[s.market.phase]
  s.market.stock = Math.max(0.2, s.market.stock * (1 + ph.stockDrift * dm))
  const noise = (Math.random() - 0.5) * 2 * ph.cryptoVol * Math.sqrt(dm)
  s.market.crypto = Math.max(0.05, s.market.crypto * (1 + ph.cryptoDrift * dm + noise))
  if (Math.floor(s.month) > Math.floor(prevMonth)) {
    s.market.hist = [...(s.market.hist ?? []), [s.market.stock, s.market.crypto] as [number, number]].slice(-60)
  }
  if (s.month >= s.market.phaseEnds) {
    const opts = NEXT_PHASE[s.market.phase]
    const next = opts[Math.floor(Math.random() * opts.length)]
    const [a, b] = PHASES[next].duration
    s.market.phase = next
    s.market.phaseEnds = s.month + a + Math.random() * (b - a)
    events.push({ kind: 'phase', phase: next })
  }

  // Production → stockage
  for (const b of s.buildings) {
    const p = monthlyProduction(s, b)
    const cap = storageCap(s, b)
    if (b.stored < cap) b.stored = Math.min(cap, b.stored + p.net * dm)
    // Maturité fiscale franchie pendant ce tick
    const d = DEFS[b.type]
    if (d.matureAfterYears) {
      const before = (prevMonth - b.builtAt) / 12
      const after = (s.month - b.builtAt) / 12
      if (before < d.matureAfterYears && after >= d.matureAfterYears) events.push({ kind: 'mature', type: b.type })
    }
  }

  checkProgress(s, events)
}

export function checkProgress(s: GameState, events: GameEvent[]) {
  const nw = netWorth(s)
  if (nw > s.stats.peakNetWorth) s.stats.peakNetWorth = nw
  for (const t of Object.keys(DEFS) as BType[]) {
    if (t === 'maison') continue
    if (!s.seenUnlocks.includes(t) && isUnlocked(s, t)) {
      s.seenUnlocks.push(t)
      events.push({ kind: 'unlock', type: t })
    }
  }
  const f = freedom(s)
  for (let i = s.freedomTier + 1; i < FREEDOM_TIERS.length; i++) {
    if (f >= FREEDOM_TIERS[i].pct) { s.freedomTier = i; events.push({ kind: 'freedom', tier: i }) }
    else break
  }
  for (const q of s.quests) {
    if (!q.done && questProgress(s, q) >= q.target) { q.done = true; events.push({ kind: 'quest', quest: q }) }
  }
}

// ── Hors-ligne ───────────────────────────────────────────────────────────────
export function applyOffline(s: GameState, nowMs: number): { months: number; gained: number } {
  const elapsed = Math.max(0, (nowMs - s.lastSeen) / 1000)
  const months = Math.min(OFFLINE_MAX_MONTHS, elapsed / OFFLINE_SECONDS_PER_MONTH)
  s.lastSeen = nowMs
  if (months < 0.25) return { months: 0, gained: 0 }
  let gained = 0
  for (const b of s.buildings) {
    const p = monthlyProduction(s, b)
    gained += p.net * months
    s.stats.taxes += p.tax * months
  }
  s.month += months
  s.cash += gained
  s.stats.earned += gained
  return { months, gained }
}

// ── Actions ──────────────────────────────────────────────────────────────────
export function isLand(s: GameState, q: number, r: number) {
  return s.land.includes(key(q, r))
}

export function isShore(s: GameState, q: number, r: number) {
  return !isLand(s, q, r) && NEIGHBORS.some(([dq, dr]) => isLand(s, q + dq, r + dr))
}

export function nextLandCost(s: GameState) {
  return landCost(s.land.length - 13)
}

export function placementCost(s: GameState, t: BType, q: number, r: number) {
  return DEFS[t].cost + (isLand(s, q, r) ? 0 : nextLandCost(s))
}

export function canPlace(s: GameState, q: number, r: number) {
  return (isLand(s, q, r) && !buildingAt(s, q, r)) || isShore(s, q, r)
}

export function atMaxCount(s: GameState, t: BType) {
  const max = DEFS[t].maxCount
  return max != null && s.buildings.filter((b) => b.type === t).length >= max
}

export function build(s: GameState, t: BType, q: number, r: number): { ok: boolean; newLand: string[] } {
  const cost = placementCost(s, t, q, r)
  if (!canPlace(s, q, r) || s.cash < cost || !isUnlocked(s, t) || atMaxCount(s, t)) return { ok: false, newLand: [] }
  const newLand: string[] = []
  s.cash -= cost
  if (!isLand(s, q, r)) { s.land.push(key(q, r)); newLand.push(key(q, r)) }
  const d = DEFS[t]
  const idx = d.market ? (d.market === 'stock' ? s.market.stock : s.market.crypto) : 1
  s.buildings.push({
    id: newId(), type: t, q, r, level: 1,
    capital: d.cost, units: d.market ? d.cost / idx : 0, stored: 0, builtAt: s.month,
  })
  // Le parking construit ses accès : +2 terrains gratuits autour de lui.
  if (t === 'parking') {
    const cands: [number, number][] = []
    for (const [dq, dr] of [...NEIGHBORS, [1, 1], [-1, -1], [1, -1], [-1, 1]] as [number, number][]) {
      const nq = q + dq, nr = r + dr
      if (!isLand(s, nq, nr)) cands.push([nq, nr])
    }
    cands.sort(() => Math.random() - 0.5)
    for (const [nq, nr] of cands.slice(0, 2)) { s.land.push(key(nq, nr)); newLand.push(key(nq, nr)) }
  }
  return { ok: true, newLand }
}

export function buyLand(s: GameState, q: number, r: number): boolean {
  const c = nextLandCost(s)
  if (!isShore(s, q, r) || s.cash < c) return false
  s.cash -= c
  s.land.push(key(q, r))
  return true
}

export function collect(s: GameState, b: Building): { net: number; tax: number } {
  const net = b.stored
  if (net <= 0.5) return { net: 0, tax: 0 }
  const rate = b.type === 'maison' ? 0 : currentTaxRate(s, b)
  const tax = rate > 0 ? (net / (1 - rate)) * rate : 0
  b.stored = 0
  s.cash += net
  s.stats.collects += 1
  s.stats.earned += net
  s.stats.taxes += tax
  return { net, tax }
}

export function upgradePrice(b: Building) {
  if (b.type === 'maison') return CAREER_COST[b.level] ?? Infinity
  return upgradeCost(b.type, b.level)
}

export function canUpgrade(b: Building) {
  return b.level < DEFS[b.type].maxLevel
}

export function upgrade(s: GameState, b: Building): boolean {
  const c = upgradePrice(b)
  if (!canUpgrade(b) || s.cash < c) return false
  s.cash -= c
  b.level += 1
  if (b.type !== 'maison') {
    const d = DEFS[b.type]
    if (d.market) b.units += c / marketIndex(s, b)
    else b.capital += c
  }
  return true
}

/** Vente : valeur − impôt sur la plus-value (selon maturité fiscale). */
export function salePreview(s: GameState, b: Building) {
  const value = buildingValue(s, b)
  // Marché : le capital initial + les montées en niveau. Immobilier : capital (déjà cumulé).
  const invested = DEFS[b.type].market ? b.capital + totalUpgradeSpent(b) : b.capital
  const gain = Math.max(0, value - invested)
  // Plus-value immobilière ≈ 30 % (IR 19 % + PS, abattements ignorés) ; sinon taux courant.
  const rate = DEFS[b.type].appreciation ? 0.3 : currentTaxRate(s, b)
  const tax = gain * rate
  return { value, invested, gain, tax, net: value - tax + b.stored }
}

function totalUpgradeSpent(b: Building) {
  let sum = 0
  for (let l = 1; l < b.level; l++) sum += upgradeCost(b.type, l)
  return sum
}

export function sell(s: GameState, b: Building): number {
  if (b.type === 'maison') return 0
  const p = salePreview(s, b)
  s.cash += p.net
  s.stats.taxes += p.tax
  s.buildings = s.buildings.filter((x) => x.id !== b.id)
  return p.net
}

// ── Objectifs ────────────────────────────────────────────────────────────────
const SCRIPT: Omit<Quest, 'id'>[] = [
  { kind: 'collect_home', title: 'Récupère ton épargne du mois', target: 1, reward: 150 },
  { kind: 'build', param: 'banque', title: 'Ouvre un Livret A', target: 1, reward: 250 },
  { kind: 'build', param: 'etf', title: 'Construis une Tour ETF', target: 1, reward: 400 },
  { kind: 'collects', title: 'Récolte 12 fois', target: 12, reward: 600 },
  { kind: 'passive', title: 'Atteins 30 €/mois de rentes', target: 30, reward: 800 },
  { kind: 'build', param: 'coffre', title: 'Ouvre une assurance-vie', target: 1, reward: 900 },
  { kind: 'land', title: 'Gagne du terrain sur la mer', target: 14, reward: 1000 },
  { kind: 'build', param: 'parking', title: 'Construis un Parking (il agrandit l’île !)', target: 1, reward: 1500 },
  { kind: 'level', title: 'Améliore un bâtiment au niveau 2', target: 2, reward: 1500 },
  { kind: 'career', title: 'Fais évoluer ta carrière', target: 2, reward: 2500 },
  { kind: 'adjacent', param: 'studio:parking', title: 'Place un Studio à côté d’un Parking', target: 1, reward: 4000 },
  { kind: 'passive', title: 'Atteins 300 €/mois de rentes', target: 300, reward: 5000 },
  { kind: 'networth', title: 'Atteins 50 000 € de patrimoine', target: 50000, reward: 6000 },
  { kind: 'mature', title: 'Fais mûrir un placement (cadenas d’or)', target: 1, reward: 8000 },
  { kind: 'freedom', title: 'Atteins 50 % de liberté financière', target: 50, reward: 15000 },
  { kind: 'passive', title: 'Atteins 1 200 €/mois de rentes', target: 1200, reward: 20000 },
  { kind: 'freedom', title: 'Deviens financièrement libre', target: 100, reward: 50000 },
]

function generated(n: number): Omit<Quest, 'id'> {
  const k = n % 3
  const step = Math.pow(1.8, Math.floor(n / 3) + 1)
  if (k === 0) return { kind: 'passive', title: `Atteins ${Math.round(2000 * step).toLocaleString('fr-FR')} €/mois de rentes`, target: Math.round(2000 * step), reward: Math.round(30000 * step) }
  if (k === 1) return { kind: 'networth', title: `Atteins ${Math.round(500000 * step).toLocaleString('fr-FR')} € de patrimoine`, target: Math.round(500000 * step), reward: Math.round(40000 * step) }
  return { kind: 'land', title: `Agrandis l’île à ${Math.round(30 + 8 * n / 3)} terrains`, target: Math.round(30 + 8 * n / 3), reward: Math.round(20000 * step) }
}

export function fillQuests(s: GameState) {
  while (s.quests.length < 3) {
    const tpl = s.questCursor < SCRIPT.length ? SCRIPT[s.questCursor] : generated(s.questCursor - SCRIPT.length)
    s.questCursor++
    s.quests.push({ ...tpl, id: `q${s.questCursor}` })
  }
}

export function questProgress(s: GameState, q: Quest): number {
  switch (q.kind) {
    case 'collect_home': return s.stats.collects > 0 ? 1 : 0
    case 'build': return s.buildings.filter((b) => b.type === q.param).length
    case 'collects': return s.stats.collects
    case 'passive': return passiveIncome(s)
    case 'land': return s.land.length
    case 'level': return Math.max(...s.buildings.filter((b) => b.type !== 'maison').map((b) => b.level), 0)
    case 'career': return s.buildings.find((b) => b.type === 'maison')?.level ?? 1
    case 'adjacent': {
      const [a, b] = (q.param ?? '').split(':') as BType[]
      return s.buildings.some((x) => x.type === a && NEIGHBORS.some(([dq, dr]) => buildingAt(s, x.q + dq, x.r + dr)?.type === b)) ? 1 : 0
    }
    case 'networth': return netWorth(s)
    case 'mature': return s.buildings.some((b) => isMature(s, b)) ? 1 : 0
    case 'freedom': return freedom(s) * 100
  }
}

export function claimQuest(s: GameState, id: string): number {
  const q = s.quests.find((x) => x.id === id)
  if (!q || !q.done) return 0
  s.cash += q.reward
  s.quests = s.quests.filter((x) => x.id !== id)
  fillQuests(s)
  return q.reward
}

// ── Date ─────────────────────────────────────────────────────────────────────
export function dateLabel(month: number) {
  const m = Math.floor(month)
  return { monthIdx: m % 12, year: 2026 + Math.floor(m / 12) }
}
