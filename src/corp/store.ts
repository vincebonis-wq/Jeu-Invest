import { create } from 'zustand'
import {
  createGame, createWorld, step, applyOffline, build as simBuild, buildFloor as simFloor, collect as simCollect,
  renovate as simRenovate, cleanRoom, fixDesk as simFix, upgradeLift as simLift, claimQuest as simClaim, sell as simSell,
  migrate, installLift as simInstallLift, extendLift as simExtendLift, doResearch, scareThief, fillQuests, checkProgress, canPlace, roomCost,
  timeScale, type Game, type World, type GEvent,
} from './sim'
import { ROOMS, TIERS, type RoomType } from './data'
import { sfxBuild, sfxCoin, sfxError, sfxFanfare, sfxUpgrade, setMuted, haptic, sfxTap } from '../archipel/audio'

const SAVE_KEY = 'openspace-save-v1'

export interface Toast { id: number; icon: string; title: string; text?: string; tone: 'good' | 'info' | 'warn' | 'gold' }
export interface Fly { id: number; x: number; y: number; amount: number }
export type Sheet = null | 'build' | 'quests' | 'stats' | 'research' | 'staff'

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
  welcome: { days: number; gained: number } | null
  celebrate: number | null
  askNew: boolean

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
  clean: (id: string) => void
  fixDesk: (id: string, i: number) => void
  upgradeLift: () => void
  installLift: () => void
  extendLift: (up: boolean) => void
  research: (id: string) => void
  scare: (agentId: string) => void
  sell: (id: string) => void
  claim: (id: string, x: number, y: number) => void
  openSheet: (s: Sheet) => void
  dismissToast: (id: number) => void
  removeFly: (id: number) => void
  closeWelcome: () => void
  closeCelebrate: () => void
  finishIntro: () => void
  toggleMute: () => void
  setSpeed: (s: number) => void
  toggleFastNight: () => void
  reset: () => void
  setAskNew: (v: boolean) => void
}

function load(): Game {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) { const g = JSON.parse(raw) as Game; if (g?.version === 3) return migrate(g) }
  } catch { /* ignore */ }
  return createGame()
}
const save = (g: Game) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...g, lastSeen: Date.now() })) } catch { /* ignore */ } }

let toastSeq = 1, flySeq = 1, running = false

export const useCorp = create<Store>((set, get) => {
  const bump = (patch: Partial<Store> = {}) => set((s) => ({ ...patch, rev: s.rev + 1 }))
  const toast = (t: Omit<Toast, 'id'>) => set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id: toastSeq++ }] }))

  const handle = (evs: GEvent[]) => {
    for (const e of evs) {
      if (e.kind === 'quit') toast({ icon: '😤', title: `${e.name} démissionne`, text: 'Moral au plus bas : toilettes, café, propreté ?', tone: 'warn' })
      else if (e.kind === 'theft') toast({ icon: '🦹', title: 'Vol au bureau !', text: `${Math.round(e.amount)} € dérobés : ${ROOMS[e.room.type].name}.`, tone: 'warn' })
      else if (e.kind === 'caught') { sfxUpgrade(); toast(e.byGuard ? { icon: '👮', title: 'Voleur arrêté !', text: 'Ton vigile l’a intercepté.', tone: 'good' } : { icon: '🦹', title: 'Voleur mis en fuite !', text: 'Un poste de sécurité veillera à ta place.', tone: 'good' }) }
      else if (e.kind === 'tier') {
        const t = TIERS[e.tier]
        sfxFanfare()
        if (e.tier >= 3) set({ celebrate: e.tier })
        else toast({ icon: t.emoji, title: `Ton entreprise devient : ${t.title}`, text: `Plus de ${t.min.toLocaleString('fr-FR')} € de bénéfice par jour.`, tone: 'gold' })
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
    askNew: false,

    start: () => {
      if (running) return
      running = true
      const g = get().game
      setMuted(g.muted)
      const off = applyOffline(g, Date.now())
      fillQuests(g)
      if (off && g.introDone && off.gained > 1) set({ welcome: off })
      let last = performance.now(), saveAcc = 0, frame = 0
      const loop = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000)
        last = now
        const st = get()
        if (st.game.introDone && !st.welcome && st.celebrate == null && document.visibilityState === 'visible') {
          const ev: GEvent[] = []
          // Accéléré : plusieurs petits pas de simulation par image.
          let rem = dt * timeScale(st.game, st.world)
          while (rem > 1e-6) { const h = Math.min(0.1, rem); step(st.game, st.world, h, ev); rem -= h }
          if (ev.length) handle(ev)
          saveAcc += dt
          if (saveAcc > 3) { saveAcc = 0; save(st.game) }
        }
        frame++
        if (frame % 2 === 0) bump()
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
      const persist = () => save(get().game)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist() })
      window.addEventListener('beforeunload', persist)
    },

    collect: (id, x, y) => {
      const g = get().game
      const r = g.rooms.find((q) => q.id === id)
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
      const ev: GEvent[] = []; checkProgress(g, ev); handle(ev)
      let again = ROOMS[r.type].kind === 'work' && g.cash >= roomCost(g, r.type)
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
      bump({ popped: { ...get().popped, [r.id]: Date.now() } })
    },
    clean: (id) => {
      const g = get().game; const r = g.rooms.find((x) => x.id === id)
      if (!r || !cleanRoom(g, r)) { sfxError(); return }
      sfxTap(); haptic(10); bump()
    },
    fixDesk: (id, i) => {
      const g = get().game; const r = g.rooms.find((x) => x.id === id)
      if (!r || !simFix(g, r, i)) { sfxError(); return }
      sfxUpgrade(); haptic(10); bump()
    },
    upgradeLift: () => {
      const g = get().game
      if (!simLift(g)) { sfxError(); return }
      sfxUpgrade(); bump()
    },
    installLift: () => {
      const g = get().game
      if (!simInstallLift(g)) { sfxError(); return }
      sfxBuild(); haptic(20)
      const ev: GEvent[] = []; checkProgress(g, ev); handle(ev)
      bump()
    },
    extendLift: (up) => {
      const g = get().game
      if (!simExtendLift(g, up)) { sfxError(); return }
      sfxBuild(); haptic(15); bump()
    },
    research: (id) => {
      const g = get().game
      if (!doResearch(g, id)) { sfxError(); return }
      sfxUpgrade(); haptic(20)
      const ev: GEvent[] = []; checkProgress(g, ev); handle(ev)
      bump()
    },
    scare: (agentId) => {
      const g = get().game
      const ev: GEvent[] = []
      if (scareThief(g, get().world, agentId, ev)) { haptic(20); handle(ev); bump() }
    },
    sell: (id) => {
      const g = get().game; const r = g.rooms.find((x) => x.id === id)
      if (!r || !simSell(g, r)) { sfxError(); return }
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
    setSpeed: (s) => { const g = get().game; g.speed = s; sfxTap(); save(g); bump() },
    toggleFastNight: () => { const g = get().game; g.fastNight = g.fastNight === false; sfxTap(); save(g); bump() },
    /** Nouvelle partie : tout repart de zéro, écran d'accueil compris. */
    reset: () => {
      const old = get().game
      const g = createGame(); g.muted = old.muted; g.speed = old.speed; g.fastNight = old.fastNight; save(g)
      sfxTap()
      set({ game: g, world: createWorld(g), selected: null, sheet: null, toasts: [], flies: [], popped: {}, floorPop: {}, buildType: null, target: null, welcome: null, celebrate: null, askNew: false })
    },
    setAskNew: (v) => set({ askNew: v, sheet: null, selected: null, buildType: null, target: null }),
  }
})
