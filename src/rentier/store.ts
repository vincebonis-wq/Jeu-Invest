import { create } from 'zustand'
import {
  createGame, createWorld, step, applyOffline, build as simBuild, buildFloor as simFloor, collect as simCollect,
  renovate as simRenovate, repair as simRepair, furnish as simFurnish, upgradeLift as simLift, claimQuest as simClaim,
  evict as simEvict, fillQuests, checkProgress, welcomeTenant, spawnConciergeIfNeeded, canPlace, roomCost,
  type Game, type World, type GEvent,
} from './sim'
import { ROOMS, FREEDOM_TIERS, type RoomType } from './data'
import { sfxBuild, sfxCoin, sfxError, sfxFanfare, sfxUpgrade, setMuted, haptic, sfxTap } from '../archipel/audio'

const SAVE_KEY = 'rentier-save-v2'

export interface Toast { id: number; icon: string; title: string; text?: string; tone: 'good' | 'info' | 'warn' | 'gold' }
export interface Fly { id: number; x: number; y: number; amount: number }
export type Sheet = null | 'build' | 'quests' | 'stats'

interface Store {
  game: Game
  world: World
  rev: number
  buildType: RoomType | null
  target: { floor: number; slot: number } | null
  selected: string | null
  sheet: Sheet
  toasts: Toast[]
  flies: Fly[]
  popped: Record<string, number>
  floorPop: Record<number, number>
  welcome: { months: number; gained: number } | null
  celebrate: number | null

  start: () => void
  collect: (roomId: string, x: number, y: number) => void
  collectAll: () => void
  chooseBuild: (t: RoomType) => void
  setTarget: (t: { floor: number; slot: number } | null) => void
  confirmBuild: () => void
  cancelBuild: () => void
  buildFloor: (up: boolean) => void
  select: (id: string | null) => void
  renovate: (id: string) => void
  repair: (id: string) => void
  furnish: (id: string) => void
  upgradeLift: () => void
  demolish: (id: string) => void
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

function load(): Game {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) { const g = JSON.parse(raw) as Game; if (g?.version === 2) return g }
  } catch { /* ignore */ }
  return createGame()
}
const save = (g: Game) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...g, lastSeen: Date.now() })) } catch { /* ignore */ } }

let toastSeq = 1, flySeq = 1, running = false

export const useRentier = create<Store>((set, get) => {
  const bump = (patch: Partial<Store> = {}) => set((s) => ({ ...patch, rev: s.rev + 1 }))
  const toast = (t: Omit<Toast, 'id'>) => set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id: toastSeq++ }] }))

  const handle = (evs: GEvent[]) => {
    for (const e of evs) {
      if (e.kind === 'arrive') toast({ icon: '🧳', title: `${e.name} emménage !`, text: 'Un nouveau locataire paie son loyer.', tone: 'good' })
      else if (e.kind === 'leave') toast({ icon: '😤', title: `${e.name} déménage`, text: `À cause de ${e.reason}.`, tone: 'warn' })
      else if (e.kind === 'incident') toast({ icon: e.room.incident?.kind === 'fuite' ? '💧' : '💡', title: e.room.incident?.kind === 'fuite' ? 'Fuite d’eau !' : 'Panne électrique !', text: `${ROOMS[e.room.type].name}, étage ${e.room.floor}. Touche-le pour réparer.`, tone: 'warn' })
      else if (e.kind === 'freedom') {
        const t = FREEDOM_TIERS[e.tier]
        if (t.pct >= 1) { sfxFanfare(); set({ celebrate: e.tier }) }
        else toast({ icon: t.emoji, title: t.title, text: `${Math.round(t.pct * 100)} % de ton train de vie couvert par tes revenus.`, tone: 'good' })
      } else if (e.kind === 'quest') toast({ icon: '🎯', title: 'Objectif atteint !', text: e.quest.title, tone: 'gold' })
    }
  }

  const g0 = load()
  return {
    game: g0,
    world: createWorld(g0),
    rev: 0,
    buildType: null,
    target: null,
    selected: null,
    sheet: null,
    toasts: [],
    flies: [],
    popped: {},
    floorPop: {},
    welcome: null,
    celebrate: null,

    start: () => {
      if (running) return
      running = true
      const g = get().game
      setMuted(g.muted)
      const off = applyOffline(g, Date.now())
      fillQuests(g)
      if (off && g.introDone && off.gained > 1) set({ welcome: off, world: createWorld(g) })
      let last = performance.now(), acc = 0, saveAcc = 0, frame = 0
      const loop = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000)
        last = now
        const st = get()
        if (st.game.introDone && !st.welcome && st.celebrate == null && document.visibilityState === 'visible') {
          const ev: GEvent[] = []
          step(st.game, st.world, dt, ev)
          if (ev.length) handle(ev)
          saveAcc += dt
          if (saveAcc > 3) { saveAcc = 0; save(st.game) }
        }
        acc += dt
        frame++
        if (frame % 2 === 0) bump()
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
      const persist = () => save(get().game)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist() })
      window.addEventListener('beforeunload', persist)
      void acc
    },

    collect: (id, x, y) => {
      const g = get().game
      const r = g.rooms.find((x) => x.id === id)
      if (!r) return
      const v = simCollect(g, r)
      if (!v) return
      sfxCoin(); haptic(8)
      const ev: GEvent[] = []; checkProgress(g, ev); handle(ev)
      bump({ flies: [...get().flies, { id: flySeq++, x, y, amount: v }] })
    },
    collectAll: () => {
      const g = get().game
      let v = 0
      for (const r of g.rooms) v += simCollect(g, r)
      if (!v) return
      sfxCoin(); haptic(15)
      const ev: GEvent[] = []; checkProgress(g, ev); handle(ev)
      bump({ flies: [...get().flies, { id: flySeq++, x: window.innerWidth / 2, y: window.innerHeight * 0.55, amount: v }] })
    },

    chooseBuild: (t) => { sfxTap(); set({ buildType: t, target: null, sheet: null, selected: null }) },
    setTarget: (t) => set({ target: t }),
    cancelBuild: () => set({ buildType: null, target: null }),
    confirmBuild: () => {
      const st = get()
      const g = st.game
      if (!st.buildType || !st.target) return
      const r = simBuild(g, st.buildType, st.target.floor, st.target.slot)
      if (!r) { sfxError(); return }
      sfxBuild(); haptic(20)
      if (ROOMS[r.type].kind === 'home') welcomeTenant(g, st.world, r)
      spawnConciergeIfNeeded(g, st.world)
      const ev: GEvent[] = []; checkProgress(g, ev); handle(ev)
      // On reste en construction si un autre emplacement est possible et abordable.
      let again = ROOMS[r.type].kind === 'home' && g.cash >= roomCost(g, r.type)
      if (again) {
        again = false
        for (let f = g.bottom; f <= g.top && !again; f++) for (let s = 0; s < 5 && !again; s++) if (canPlace(g, r.type, f, s)) again = true
      }
      bump({ popped: { ...st.popped, [r.id]: Date.now() }, target: null, buildType: again ? r.type : null })
    },
    buildFloor: (up) => {
      const g = get().game
      if (!simFloor(g, up)) { sfxError(); return }
      sfxBuild(); haptic(20)
      const ev: GEvent[] = []; checkProgress(g, ev); handle(ev)
      bump({ floorPop: { ...get().floorPop, [up ? g.top : g.bottom]: Date.now() }, sheet: null })
    },

    select: (id) => set({ selected: id, sheet: null }),
    renovate: (id) => {
      const g = get().game; const r = g.rooms.find((x) => x.id === id)
      if (!r || !simRenovate(g, r)) { sfxError(); return }
      sfxUpgrade(); haptic(15)
      const ev: GEvent[] = []; checkProgress(g, ev); handle(ev)
      bump({ popped: { ...get().popped, [r.id]: Date.now() } })
    },
    repair: (id) => {
      const g = get().game; const r = g.rooms.find((x) => x.id === id)
      if (!r || !simRepair(g, r)) { sfxError(); return }
      sfxUpgrade(); haptic(12)
      const ev: GEvent[] = []; checkProgress(g, ev); handle(ev)
      bump()
    },
    furnish: (id) => {
      const g = get().game; const r = g.rooms.find((x) => x.id === id)
      if (!r || !simFurnish(g, r)) { sfxError(); return }
      sfxUpgrade(); bump()
    },
    upgradeLift: () => {
      const g = get().game
      if (!simLift(g)) { sfxError(); return }
      sfxUpgrade(); bump()
    },
    demolish: (id) => {
      const g = get().game; const r = g.rooms.find((x) => x.id === id)
      if (!r || !simEvict(g, r)) { sfxError(); return }
      sfxCoin(); bump({ selected: null })
    },
    claim: (id, x, y) => {
      const g = get().game
      const v = simClaim(g, id)
      if (!v) return
      sfxCoin(); haptic(15)
      const ev: GEvent[] = []; checkProgress(g, ev); handle(ev)
      bump({ flies: [...get().flies, { id: flySeq++, x, y, amount: v }] })
    },
    openSheet: (s) => set({ sheet: s, selected: null, buildType: null, target: null }),
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    removeFly: (id) => set((s) => ({ flies: s.flies.filter((f) => f.id !== id) })),
    closeWelcome: () => {
      const w = get().welcome
      set({ welcome: null })
      if (w) { sfxCoin(); set({ flies: [...get().flies, { id: flySeq++, x: window.innerWidth / 2, y: window.innerHeight / 2, amount: w.gained }] }) }
    },
    closeCelebrate: () => set({ celebrate: null }),
    finishIntro: () => { const g = get().game; g.introDone = true; save(g); bump() },
    toggleMute: () => { const g = get().game; g.muted = !g.muted; setMuted(g.muted); save(g); bump() },
    reset: () => {
      const g = createGame(); g.introDone = true; save(g)
      set({ game: g, world: createWorld(g), selected: null, sheet: null, toasts: [], popped: {}, floorPop: {} })
    },
  }
})
