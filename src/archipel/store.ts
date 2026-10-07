/**
 * ARCHIPEL — store (état + boucle temps réel + sauvegarde + effets).
 */

import { create } from 'zustand'
import {
  createGame, tick, applyOffline, build as engineBuild, buyLand as engineBuyLand,
  collect as engineCollect, upgrade as engineUpgrade, sell as engineSell, claimQuest as engineClaim,
  checkProgress, fillQuests, placementCost, nextLandCost, canPlace, isShore, atMaxCount,
  type GameState, type GameEvent,
} from './engine'
import { DEFS, FREEDOM_TIERS, PHASES, type BType } from './data'
import { sfxBuild, sfxCoin, sfxError, sfxFanfare, sfxUpgrade, setMuted, haptic } from './audio'

const SAVE_KEY = 'archipel-save-v1'

export interface Toast { id: number; icon: string; title: string; text?: string; tone: 'good' | 'info' | 'warn' | 'gold' }
export interface Fly { id: number; x: number; y: number; amount: number; tax: number }
export type Mode = 'idle' | 'build' | 'land'
export type Sheet = null | 'build' | 'quests' | 'stats' | 'market'

interface Store {
  game: GameState
  rev: number
  mode: Mode
  buildType: BType | null
  target: string | null            // case visée en mode construction / terrain
  selected: string | null          // bâtiment sélectionné
  sheet: Sheet
  toasts: Toast[]
  flies: Fly[]
  risen: Record<string, number>    // cases fraîchement émergées → timestamp (animation)
  popped: Record<string, number>   // bâtiments fraîchement construits → timestamp
  welcome: { months: number; gained: number } | null
  celebrate: number | null         // palier de liberté à célébrer

  start: () => void
  collect: (id: string, x: number, y: number) => void
  collectAll: () => void
  chooseBuild: (t: BType) => void
  chooseLand: () => void
  setTarget: (k: string | null) => void
  confirm: () => void
  cancel: () => void
  select: (id: string | null) => void
  upgrade: (id: string) => void
  sell: (id: string) => void
  claim: (id: string, x: number, y: number) => void
  openSheet: (s: Sheet) => void
  dismissToast: (id: number) => void
  removeFly: (id: number) => void
  closeWelcome: () => void
  closeCelebrate: () => void
  finishIntro: () => void
  toggleMute: () => void
  reset: () => void
}

function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const g = JSON.parse(raw) as GameState
      if (g && g.version === 1) return g
    }
  } catch { /* ignore */ }
  return createGame()
}

function save(g: GameState) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...g, lastSeen: Date.now() })) } catch { /* ignore */ }
}

let toastSeq = 1
let flySeq = 1
let loop: ReturnType<typeof setInterval> | null = null

export const useArchipel = create<Store>((set, get) => {
  const bump = (patch: Partial<Store> = {}) => set((st) => ({ ...patch, game: { ...st.game }, rev: st.rev + 1 }))

  const pushToast = (t: Omit<Toast, 'id'>) =>
    set((st) => ({ toasts: [...st.toasts.slice(-2), { ...t, id: toastSeq++ }] }))

  const handle = (events: GameEvent[]) => {
    for (const e of events) {
      if (e.kind === 'phase') {
        const p = PHASES[e.phase]
        pushToast({ icon: p.emoji, title: p.label, text: p.desc, tone: e.phase === 'krach' ? 'warn' : 'info' })
      } else if (e.kind === 'unlock') {
        const d = DEFS[e.type]
        pushToast({ icon: d.emoji, title: `Nouveau : ${d.name}`, text: 'Disponible dans Construire.', tone: 'gold' })
      } else if (e.kind === 'freedom') {
        const tier = FREEDOM_TIERS[e.tier]
        if (tier.pct >= 1) { sfxFanfare(); set({ celebrate: e.tier }) }
        else pushToast({ icon: tier.emoji, title: tier.title, text: `${Math.round(tier.pct * 100)} % de tes dépenses couvertes par tes rentes.`, tone: 'good' })
      } else if (e.kind === 'quest') {
        pushToast({ icon: '🎯', title: 'Objectif atteint !', text: e.quest.title, tone: 'good' })
      } else if (e.kind === 'mature') {
        pushToast({ icon: '🔓', title: `${DEFS[e.type].name} : cadenas d’or !`, text: 'Fiscalité allégée : 17,2 % au lieu de 30 %.', tone: 'gold' })
      }
    }
  }

  return {
    game: load(),
    rev: 0,
    mode: 'idle',
    buildType: null,
    target: null,
    selected: null,
    sheet: null,
    toasts: [],
    flies: [],
    risen: {},
    popped: {},
    welcome: null,
    celebrate: null,

    start: () => {
      if (loop) return
      const g = get().game
      setMuted(g.muted)
      const off = applyOffline(g, Date.now())
      fillQuests(g)
      const ev: GameEvent[] = []
      checkProgress(g, ev)
      if (off.gained > 1 && g.introDone) set({ welcome: off })
      bump()
      let last = performance.now()
      let saveAcc = 0
      loop = setInterval(() => {
        const now = performance.now()
        const dt = Math.min(1, (now - last) / 1000)
        last = now
        const events: GameEvent[] = []
        const st = get()
        if (st.welcome || st.celebrate != null || !st.game.introDone) return
        tick(st.game, dt, events)
        handle(events)
        saveAcc += dt
        if (saveAcc > 3) { saveAcc = 0; save(st.game) }
        bump()
      }, 200)
      const persist = () => save(get().game)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist() })
      window.addEventListener('beforeunload', persist)
    },

    collect: (id, x, y) => {
      const g = get().game
      const b = g.buildings.find((x) => x.id === id)
      if (!b) return
      const { net, tax } = engineCollect(g, b)
      if (net <= 0) return
      sfxCoin(); haptic(8)
      const ev: GameEvent[] = []
      checkProgress(g, ev)
      handle(ev)
      bump({ flies: [...get().flies, { id: flySeq++, x, y, amount: net, tax }] })
    },

    collectAll: () => {
      const g = get().game
      let total = 0
      for (const b of g.buildings) total += engineCollect(g, b).net
      if (total <= 0) return
      sfxCoin(); haptic(15)
      const ev: GameEvent[] = []
      checkProgress(g, ev)
      handle(ev)
      bump({ flies: [...get().flies, { id: flySeq++, x: window.innerWidth / 2, y: window.innerHeight * 0.55, amount: total, tax: 0 }] })
    },

    chooseBuild: (t) => set({ mode: 'build', buildType: t, target: null, sheet: null, selected: null }),
    chooseLand: () => set({ mode: 'land', buildType: null, target: null, sheet: null, selected: null }),
    setTarget: (k) => set({ target: k }),

    confirm: () => {
      const st = get()
      const g = st.game
      if (!st.target) return
      const [q, r] = st.target.split(',').map(Number)
      if (st.mode === 'build' && st.buildType) {
        if (!canPlace(g, q, r) || g.cash < placementCost(g, st.buildType, q, r)) { sfxError(); return }
        const res = engineBuild(g, st.buildType, q, r)
        if (!res.ok) { sfxError(); return }
        sfxBuild(); haptic(20)
        const now = Date.now()
        const risen = { ...st.risen }
        res.newLand.forEach((k) => { risen[k] = now })
        const nb = g.buildings[g.buildings.length - 1]
        if (st.buildType === 'parking' && res.newLand.length > 1) {
          pushToast({ icon: '🏝️', title: 'L’île s’agrandit !', text: 'Ton parking a construit ses accès : +2 terrains.', tone: 'good' })
        }
        const ev: GameEvent[] = []
        checkProgress(g, ev)
        handle(ev)
        // Reste en mode construction si on peut encore payer le même bâtiment.
        const again = g.cash >= DEFS[st.buildType].cost && !atMaxCount(g, st.buildType)
        bump({ risen, popped: { ...st.popped, [nb.id]: now }, target: null, mode: again ? 'build' : 'idle', buildType: again ? st.buildType : null })
      } else if (st.mode === 'land') {
        if (!isShore(g, q, r) || g.cash < nextLandCost(g)) { sfxError(); return }
        engineBuyLand(g, q, r)
        sfxBuild(); haptic(15)
        const ev: GameEvent[] = []
        checkProgress(g, ev)
        handle(ev)
        bump({ risen: { ...st.risen, [st.target]: Date.now() }, target: null })
      }
    },

    cancel: () => set({ mode: 'idle', buildType: null, target: null }),
    select: (id) => set({ selected: id, sheet: null }),

    upgrade: (id) => {
      const g = get().game
      const b = g.buildings.find((x) => x.id === id)
      if (!b || !engineUpgrade(g, b)) { sfxError(); return }
      sfxUpgrade(); haptic(15)
      const ev: GameEvent[] = []
      checkProgress(g, ev)
      handle(ev)
      bump({ popped: { ...get().popped, [b.id]: Date.now() } })
    },

    sell: (id) => {
      const g = get().game
      const b = g.buildings.find((x) => x.id === id)
      if (!b) return
      const net = engineSell(g, b)
      sfxCoin()
      pushToast({ icon: '💰', title: `${DEFS[b.type].name} vendu`, text: `+${Math.round(net).toLocaleString('fr-FR')} € nets d’impôt`, tone: 'info' })
      bump({ selected: null })
    },

    claim: (id, x, y) => {
      const g = get().game
      const amount = engineClaim(g, id)
      if (!amount) return
      sfxCoin(); haptic(15)
      const ev: GameEvent[] = []
      checkProgress(g, ev)
      handle(ev)
      bump({ flies: [...get().flies, { id: flySeq++, x, y, amount, tax: 0 }] })
    },

    openSheet: (s) => set({ sheet: s, selected: null, mode: 'idle', buildType: null, target: null }),
    dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
    removeFly: (id) => set((st) => ({ flies: st.flies.filter((f) => f.id !== id) })),
    closeWelcome: () => {
      const w = get().welcome
      set({ welcome: null })
      if (w) { sfxCoin(); set({ flies: [...get().flies, { id: flySeq++, x: window.innerWidth / 2, y: window.innerHeight / 2, amount: w.gained, tax: 0 }] }) }
    },
    closeCelebrate: () => set({ celebrate: null }),
    finishIntro: () => { get().game.introDone = true; save(get().game); bump() },
    toggleMute: () => { const g = get().game; g.muted = !g.muted; setMuted(g.muted); save(g); bump() },
    reset: () => {
      const g = createGame()
      g.introDone = true
      save(g)
      set({ game: g, rev: get().rev + 1, mode: 'idle', selected: null, sheet: null, toasts: [], risen: {}, popped: {} })
    },
  }
})
