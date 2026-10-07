/**
 * RENTIER INC. — l'immeuble en coupe (SVG), ses habitants et l'ascenseur.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { useRentier } from './store'
import {
  canPlace, monthlyRent, parkingStatus, shaftX, EXIT_X, stationCount, stationX, stationsOf, PATIENCE,
  type Agent, type Game, type Room, type Station,
} from './sim'
import { ROOMS, SLOTS, SW, SHAFT_W, FH, BW, floorCost, type RoomType } from './data'
import { fmtShort } from '../archipel/format'

const SIDE = 34          // trottoir de chaque côté
const BELOW = 90
const W = BW + SIDE * 2

/** Le rez-de-chaussée est ancré vers le bas de l'écran ; le ciel comble le haut. */
function geo(g: Game, viewH: number) {
  const minRoof = 190
  const above = (g.top + 1) * FH
  const below = (-g.bottom) * FH + BELOW
  const roof = Math.max(minRoof, viewH * 0.74 - above)
  const groundBase = roof + above
  const H = Math.max(groundBase + below, viewH + 40)
  const baseY = (f: number) => groundBase - f * FH
  return { groundBase, H, baseY }
}

// ── Ciel ─────────────────────────────────────────────────────────────────────
function mix(a: string, b: string, k: number) {
  const pa = a.match(/\w\w/g)!.map((h) => parseInt(h, 16)), pb = b.match(/\w\w/g)!.map((h) => parseInt(h, 16))
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`
}
function sky(p: number): { top: string; bot: string; night: number } {
  const keys: [number, string, string, number][] = [
    [0.0, '0b1028', '1c2550', 1], [0.2, '0b1028', '1c2550', 1], [0.27, 'f6a072', 'ffd9a0', 0.3],
    [0.34, '5fb6ea', 'bfe7ff', 0], [0.76, '5fb6ea', 'bfe7ff', 0], [0.84, 'f08a5d', 'ffcf91', 0.3],
    [0.91, '1a1d45', '3a2f63', 0.9], [1.0, '0b1028', '1c2550', 1],
  ]
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, at, ab, an] = keys[i], [b, bt, bb, bn] = keys[i + 1]
    if (p >= a && p <= b) { const k = (p - a) / (b - a || 1); return { top: mix(at, bt, k), bot: mix(ab, bb, k), night: an + (bn - an) * k } }
  }
  return { top: '#0b1028', bot: '#1c2550', night: 1 }
}

// ── Personnage ───────────────────────────────────────────────────────────────
function Person({ a, x, y, small }: { a: Agent; x: number; y: number; small?: boolean }) {
  const s = small ? 0.85 : 1
  return (
    <g transform={`translate(${x},${y}) scale(${a.dir * s},${s})`}>
      <ellipse cx={0} cy={0} rx={6} ry={1.8} fill="rgba(0,0,0,0.18)" />
      <g className={a.walking ? 'walk-l' : undefined}><rect x={-3.2} y={-9} width={2.6} height={9} rx={1.2} fill="#2d3142" /></g>
      <g className={a.walking ? 'walk-r' : undefined}><rect x={0.6} y={-9} width={2.6} height={9} rx={1.2} fill="#3b4058" /></g>
      <rect x={-4.6} y={-19} width={9.2} height={11} rx={3.2} fill={a.cloth} />
      <circle cx={0} cy={-23.5} r={4.6} fill={a.skin} />
      <path d="M-4.7,-24 A4.8,4.8 0 0 1 4.7,-24 L4.7,-25.5 A4.8,4.8 0 0 0 -4.7,-25.5 Z" fill={a.hair} />
      <path d={`M-4.8,-24.5 A4.8,4.8 0 0 1 4.8,-24.5 Q2,-27 -4.8,-24.5`} fill={a.hair} />
      <circle cx={2} cy={-23.4} r={0.7} fill="#222" />
      {a.carry === 'suitcase' && <g><rect x={5} y={-11} width={6} height={8} rx={1.5} fill="#c0392b" /><rect x={6.8} y={-13} width={2.4} height={2.4} rx={0.8} fill="none" stroke="#7f2318" strokeWidth={0.8} /></g>}
      {a.carry === 'wrench' && <rect x={4.5} y={-17} width={2} height={9} rx={1} fill="#9aa5b1" transform="rotate(20,5,-12)" />}
      {a.carry === 'bag' && <rect x={4.4} y={-14} width={5} height={6} rx={1} fill="#6d4c41" />}
      {a.carry === 'basket' && <g><rect x={3.5} y={-15} width={9} height={7} rx={2} fill="#d4a373" stroke="#a0703f" strokeWidth={0.7} /><rect x={4.5} y={-17} width={7} height={3} rx={1.5} fill="#90caf9" /></g>}
      {a.kind === 'concierge' && <rect x={-5} y={-28.5} width={10} height={2.6} rx={1} fill="#1f4d2b" />}
    </g>
  )
}

function IconBubble({ x, y, icon }: { x: number; y: number; icon: string }) {
  const w = icon.length > 2 ? 30 : 22
  return (
    <g transform={`translate(${x},${y})`} className="icon-pop" pointerEvents="none">
      <rect x={-w / 2} y={-18} width={w} height={17} rx={8.5} fill="#fff" stroke="rgba(0,0,0,0.12)" />
      <polygon points="-3,-1.5 3,-1.5 0,2.5" fill="#fff" />
      <text x={0} y={-9} fontSize={11} textAnchor="middle" dominantBaseline="middle">{icon}</text>
    </g>
  )
}

// ── Intérieurs ───────────────────────────────────────────────────────────────
function Window({ x, y, w, h, skyCol, lit }: { x: number; y: number; w: number; h: number; skyCol: string; lit: boolean }) {
  return (
    <g>
      <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} rx={2} fill="#fff" />
      <rect x={x} y={y} width={w} height={h} fill={lit ? '#ffe7a8' : skyCol} />
      <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#fff" strokeWidth={1.5} />
      {!lit && <rect x={x + 2} y={y + 2} width={w / 2 - 4} height={4} fill="rgba(255,255,255,0.35)" />}
    </g>
  )
}

/** Anneau de progression d'un poste en service (machine, table…). */
function Progress({ x, y, st }: { x: number; y: number; st: Station }) {
  if (st.phase === 'done') return <g transform={`translate(${x},${y})`}><circle r={7} fill="#22c55e" stroke="#fff" strokeWidth={1.5} /><text y={0.5} fontSize={8} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight={900}>✓</text></g>
  if (st.phase !== 'run') return null
  const k = Math.min(1, st.t / Math.max(0.1, st.dur))
  const C = 2 * Math.PI * 6
  const left = Math.max(0, Math.ceil(st.dur - st.t))
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={8} fill="#fff" stroke="rgba(0,0,0,0.15)" />
      <circle r={6} fill="none" stroke="#e2e8f0" strokeWidth={2.5} />
      <circle r={6} fill="none" stroke="#0ea5e9" strokeWidth={2.5} strokeDasharray={`${C * k} ${C}`} transform="rotate(-90)" strokeLinecap="round" />
      <text y={0.5} fontSize={6.5} fill="#0f172a" textAnchor="middle" dominantBaseline="middle" fontWeight={900}>{left}</text>
    </g>
  )
}

export function Interior({ r, w, night, skyCol, home, g, st }: { r: Room; w: number; night: number; skyCol: string; home: boolean; g: Game; st?: Station[] }): ReactElement {
  const n = stationCount(r)
  const sx = (i: number) => stationX(r, i) - r.slot * SW
  const stOf = (i: number): Station => st?.[i] ?? { agentId: null, t: 0, dur: 0, phase: 'idle', doneT: 0 }
  const h = FH - 8
  const fl = h - 6 // niveau du sol intérieur
  const lit = night > 0.5 && home
  switch (r.type) {
    case 'lobby':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#c9b79c" />
          {Array.from({ length: 6 }, (_, i) => <rect key={i} x={i * 11} y={fl} width={5.5} height={6} fill="#b8a487" />)}
          <rect x={6} y={18} width={22} height={fl - 18} rx={2} fill="#9fd0f0" stroke="#7a5a3a" strokeWidth={3} />
          <rect x={36} y={30} width={16} height={12} rx={2} fill="#7a5a3a" />
          <text x={44} y={37} fontSize={6} fill="#fff" textAnchor="middle" fontWeight={800}>HALL</text>
          <rect x={47} y={fl - 14} width={8} height={14} rx={2} fill="#5d8a3c" />
          <circle cx={51} cy={fl - 18} r={7} fill="#6fbf4a" />
        </g>
      )
    case 'studio':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#c08a5a" />
          <Window x={10} y={12} w={20} h={22} skyCol={skyCol} lit={lit} />
          <rect x={30} y={fl - 14} width={32} height={10} rx={3} fill="#e8e1d5" />
          <rect x={30} y={fl - 18} width={10} height={6} rx={2} fill="#fff" />
          <rect x={30} y={fl - 6} width={32} height={6} rx={2} fill="#8d5a3b" />
          <rect x={6} y={fl - 16} width={14} height={16} rx={1} fill="#a0704a" />
          {r.level >= 2 && <rect x={40} y={14} width={14} height={11} fill="#f4a261" stroke="#fff" strokeWidth={2} />}
          {r.level >= 3 && <circle cx={58} cy={fl - 22} r={5} fill="#6fbf4a" />}
          {lit && <circle cx={13} cy={fl - 20} r={9} fill="#ffe7a8" opacity={0.5} />}
        </g>
      )
    case 't2':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#c08a5a" />
          <Window x={12} y={12} w={22} h={22} skyCol={skyCol} lit={lit} />
          <Window x={w - 40} y={12} w={22} h={22} skyCol={skyCol} lit={lit} />
          <rect x={42} y={fl - 14} width={36} height={14} rx={4} fill={r.regime === 'lmnp' ? '#5b8def' : '#9aa9b8'} />
          <rect x={42} y={fl - 20} width={36} height={8} rx={4} fill={r.regime === 'lmnp' ? '#7aa5f5' : '#b5c1cd'} />
          <rect x={w - 34} y={fl - 22} width={26} height={22} fill="#e8e1d5" />
          <rect x={w - 34} y={fl - 24} width={26} height={4} fill="#8d6e63" />
          <rect x={8} y={fl - 26} width={18} height={14} rx={1} fill="#222" />
          <rect x={10} y={fl - 24} width={14} height={10} fill={lit ? '#7fd3ff' : '#2e3a4a'} />
        </g>
      )
    case 'penthouse':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#e6d5b8" />
          <rect x={8} y={8} width={w - 16} height={40} fill={lit ? '#ffe7a8' : skyCol} stroke="#fff" strokeWidth={3} />
          {[1, 2, 3].map((i) => <line key={i} x1={8 + (w - 16) * i / 4} y1={8} x2={8 + (w - 16) * i / 4} y2={48} stroke="#fff" strokeWidth={2} />)}
          <rect x={20} y={fl - 18} width={30} height={18} rx={3} fill="#1b1b1b" />
          <rect x={20} y={fl - 20} width={30} height={4} fill="#333" />
          <rect x={w - 70} y={fl - 13} width={50} height={13} rx={5} fill="#c9a227" />
          <circle cx={w / 2} cy={14} r={6} fill="#ffd166" opacity={lit ? 1 : 0.6} />
          <circle cx={w - 14} cy={fl - 16} r={8} fill="#4caf50" />
        </g>
      )
    case 'cafe':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#8d5a3b" />
          <rect x={6} y={10} width={30} height={16} rx={2} fill="#2f3e46" />
          <text x={21} y={19.5} fontSize={7} fill="#fff" textAnchor="middle" fontWeight={800}>CAFÉ</text>
          <rect x={6} y={fl - 20} width={40} height={20} rx={2} fill="#a0522d" />
          <rect x={6} y={fl - 22} width={40} height={4} fill="#d2a679" />
          <rect x={12} y={fl - 34} width={12} height={13} rx={2} fill="#c0c0c0" />
          <rect x={14} y={fl - 30} width={3} height={4} fill="#333" />
          <rect x={w - 26} y={12} width={18} height={20} fill={skyCol} stroke="#fff" strokeWidth={2} />
          {Array.from({ length: n }, (_, i) => {
            const cx = sx(i)
            return <g key={i}><rect x={cx - 8} y={fl - 14} width={16} height={3} fill="#d2a679" /><rect x={cx - 1} y={fl - 11} width={2} height={11} fill="#6d4c41" /><rect x={cx - 11} y={fl - 8} width={4} height={8} fill="#8d6e63" /><Progress x={cx} y={fl - 44} st={stOf(i)} /></g>
          })}
        </g>
      )
    case 'laverie': {
      const mw = Math.min(20, (w - 6) / n - 2)
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#cfd8dc" />
          <rect x={4} y={8} width={w - 8} height={8} rx={2} fill="#26a69a" />
          <text x={w / 2} y={13} fontSize={5.5} fill="#fff" textAnchor="middle" fontWeight={800}>LAVERIE</text>
          {Array.from({ length: n }, (_, i) => {
            const s = stOf(i)
            const cx = sx(i)
            const running = s.phase === 'run'
            return (
              <g key={i}>
                <rect x={cx - mw / 2} y={fl - 26} width={mw} height={26} rx={2} fill="#f5f5f5" stroke="#b0bec5" />
                <rect x={cx - mw / 2 + 2} y={fl - 24} width={mw - 4} height={3} rx={1} fill={running ? '#22c55e' : '#cfd8dc'} />
                <circle cx={cx} cy={fl - 11} r={mw * 0.32} fill={running ? '#64b5f6' : '#cfe3f2'} stroke="#78909c" strokeWidth={1.2} />
                {running && <g className="spin-fast" style={{ transformOrigin: `${cx}px ${fl - 11}px` }}><circle cx={cx - 2} cy={fl - 12} r={1.6} fill="#fff" /><circle cx={cx + 2} cy={fl - 10} r={1.2} fill="#e3f2fd" /><circle cx={cx + 1} cy={fl - 13.5} r={1} fill="#fff" /></g>}
                <Progress x={cx} y={fl - 36} st={s} />
              </g>
            )
          })}
        </g>
      )
    }
    case 'sport':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#455a64" />
          <rect x={8} y={10} width={40} height={30} fill="#cfe3f2" stroke="#fff" strokeWidth={2} />
          {Array.from({ length: n }, (_, i) => {
            const cx = sx(i)
            return i % 2 === 0
              ? <g key={i}><rect x={cx - 14} y={fl - 7} width={26} height={7} rx={2} fill="#37474f" /><rect x={cx + 8} y={fl - 24} width={3} height={18} fill="#546e7a" /><rect x={cx + 6} y={fl - 26} width={8} height={3} rx={1} fill="#263238" /><Progress x={cx} y={fl - 44} st={stOf(i)} /></g>
              : <g key={i}><rect x={cx - 10} y={fl - 9} width={20} height={4} rx={1} fill="#455a64" /><rect x={cx - 8} y={fl - 5} width={2} height={5} fill="#263238" /><rect x={cx + 6} y={fl - 5} width={2} height={5} fill="#263238" /><circle cx={cx - 12} cy={fl - 16} r={3} fill="#555" /><circle cx={cx + 12} cy={fl - 16} r={3} fill="#555" /><rect x={cx - 12} y={fl - 17} width={24} height={2} fill="#333" /><Progress x={cx} y={fl - 44} st={stOf(i)} /></g>
          })}
          <rect x={w - 22} y={12} width={12} height={8} rx={2} fill="#ef5350" />
        </g>
      )
    case 'bar': {
      const glow = night > 0.3
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#2b1d3a" />
          <text x={w / 2} y={22} fontSize={11} textAnchor="middle" fill={glow ? '#ff4fd8' : '#a35da0'} fontWeight={900} className={glow ? 'neon-text' : undefined}>BAR</text>
          <rect x={10} y={fl - 18} width={w - 20} height={18} rx={2} fill="#5b3a6b" />
          <rect x={10} y={fl - 20} width={w - 20} height={4} fill="#c79bd8" />
          {Array.from({ length: 7 }, (_, i) => <rect key={i} x={16 + i * 14} y={30} width={4} height={12} rx={1} fill={['#4dd0e1', '#ffb74d', '#81c784', '#e57373'][i % 4]} />)}
          {Array.from({ length: n }, (_, i) => {
            const cx = sx(i)
            return <g key={i}><rect x={cx - 4} y={fl - 10} width={8} height={2.5} rx={1} fill="#c79bd8" /><rect x={cx - 0.8} y={fl - 8} width={1.6} height={8} fill="#8e6aa3" /><Progress x={cx} y={fl - 44} st={stOf(i)} /></g>
          })}
          {glow && <rect x={0} y={0} width={w} height={h} fill="#ff4fd8" opacity={0.08} />}
        </g>
      )
    }
    case 'parking': {
      const ps = parkingStatus(g)
      const parks = g.rooms.filter((x) => x.type === 'parking')
      const idx = parks.findIndex((x) => x.id === r.id)
      const here = Math.max(0, Math.min(3, ps.used - idx * 3))
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#5f666e" />
          {[0, 1, 2, 3].map((i) => <rect key={i} x={6 + i * 40} y={fl - 2} width={2} height={2} fill="#fff" />)}
          {Array.from({ length: here }, (_, i) => (
            <g key={i} transform={`translate(${12 + i * 40},${fl - 14})`}>
              <rect x={0} y={4} width={30} height={9} rx={3} fill={['#e63946', '#3a86ff', '#ffbe0b'][i]} />
              <rect x={6} y={0} width={16} height={7} rx={2.5} fill={['#c92a35', '#2d6fd6', '#e0a800'][i]} />
              <rect x={8} y={1.5} width={12} height={4} rx={1} fill="#cfe8ff" />
              <circle cx={7} cy={13} r={2.8} fill="#222" /><circle cx={23} cy={13} r={2.8} fill="#222" />
            </g>
          ))}
          <rect x={w - 20} y={10} width={12} height={12} rx={2} fill="#1d4ed8" />
          <text x={w - 14} y={18} fontSize={8} fill="#fff" textAnchor="middle" fontWeight={900}>P</text>
        </g>
      )
    }
    case 'concierge':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#a1887f" />
          <rect x={8} y={fl - 14} width={30} height={14} rx={1} fill="#6d4c41" />
          <rect x={10} y={10} width={30} height={20} rx={1} fill="#795548" />
          {[14, 22, 30].map((kx) => <rect key={kx} x={kx} y={14} width={3} height={10} rx={1} fill="#ffca28" />)}
          <text x={33} y={fl - 18} fontSize={9}>🧰</text>
        </g>
      )
  }
}

// ── Composant principal ──────────────────────────────────────────────────────
export function Tower() {
  useRentier((s) => s.rev)
  const st = useRentier.getState()
  const { game: g, world: w, buildType, target, selected, popped, floorPop } = st
  const scroller = useRef<HTMLDivElement>(null)
  const [vh, setVh] = useState(1200)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const upd = () => setVh(el.clientHeight * (W / Math.max(1, el.clientWidth)))
    upd()
    const ro = new ResizeObserver(upd); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const { groundBase, H, baseY } = geo(g, vh)
  const p = g.month % 1
  const sk = sky(p)
  const now = Date.now()
  const X0 = SIDE

  // Défilement initial (une fois la hauteur réelle connue) : le rez-de-chaussée en bas de l'écran.
  const scrolled = useRef(false)
  useEffect(() => {
    const el = scroller.current
    if (!el || scrolled.current || vh === 1200) return
    scrolled.current = true
    const scale = el.clientWidth / W
    el.scrollTop = Math.max(0, groundBase * scale - el.clientHeight * 0.74)
  }, [vh, groundBase])

  const rooms = g.rooms
  const occupied = new Set<string>()
  for (const r of rooms) for (let i = 0; i < ROOMS[r.type].w; i++) occupied.add(`${r.floor},${r.slot + i}`)

  const floors: number[] = []
  for (let f = g.bottom; f <= g.top; f++) floors.push(f)

  // Emplacements de construction valides
  const targets: { floor: number; slot: number }[] = []
  if (buildType) for (const f of floors) for (let s = 0; s < SLOTS; s++) if (canPlace(g, buildType, f, s)) targets.push({ floor: f, slot: s })

  const homesAt = new Map<string, boolean>()
  for (const a of w.agents) if (a.kind === 'res' && !a.away && a.homeId && !a.steps.length) homesAt.set(a.homeId, true)

  const liftY = baseY(w.lift.y)

  return (
    <div ref={scroller} className="absolute inset-0 overflow-y-auto overflow-x-hidden hide-scrollbar"
      style={{ background: `linear-gradient(180deg, ${sk.top} 0%, ${sk.bot} 70%)` }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Étoiles */}
        {sk.night > 0.2 && Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={(i * 97) % W} cy={(i * 53) % Math.max(60, groundBase - (g.top + 1) * FH)} r={0.8 + (i % 3) * 0.4} fill="#fff" opacity={sk.night * (0.4 + (i % 5) / 8)} />
        ))}
        {/* Immeubles lointains */}
        {[[-10, 150, '#9cc3dd'], [W - 120, 210, '#a9cde2'], [W - 60, 120, '#8fb8d4'], [30, 90, '#b4d4e8']].map(([x, h, c], i) => (
          <rect key={i} x={x as number} y={groundBase - (h as number)} width={i === 2 ? 50 : 70} height={h as number} fill={sk.night > 0.5 ? '#232a4d' : (c as string)} opacity={0.7} />
        ))}

        {/* Sous-sol : terre */}
        <rect x={0} y={groundBase} width={W} height={H - groundBase} fill="#6b4f3a" />
        <rect x={0} y={groundBase} width={W} height={10} fill="#5a4030" />
        {Array.from({ length: 18 }, (_, i) => <circle key={i} cx={(i * 61) % W} cy={groundBase + 20 + ((i * 37) % Math.max(20, H - groundBase - 30))} r={2 + (i % 3)} fill="#7d5d45" />)}

        {/* Trottoir & rue */}
        <rect x={0} y={groundBase - 6} width={W} height={10} fill="#b8b2a7" />
        {[10, W - 14].map((lx) => (
          <g key={lx}>
            <rect x={lx} y={groundBase - 70} width={3} height={64} fill="#4a4e57" />
            <rect x={lx - 5} y={groundBase - 74} width={13} height={6} rx={3} fill="#4a4e57" />
            <circle cx={lx + 1.5} cy={groundBase - 67} r={sk.night > 0.4 ? 14 : 3} fill="#ffe08a" opacity={sk.night > 0.4 ? 0.35 : 0.9} />
          </g>
        ))}
        <g>
          <rect x={W - 30} y={groundBase - 30} width={4} height={24} fill="#7a5230" />
          <circle cx={W - 28} cy={groundBase - 40} r={12} fill="#5cb85c" />
          <circle cx={W - 23} cy={groundBase - 34} r={8} fill="#4aa64a" />
        </g>

        {/* Façade */}
        <rect x={X0 - 6} y={baseY(g.top) - FH - 4} width={BW + 12} height={(g.top - g.bottom + 1) * FH + 8} fill="#7d6a5b" />

        {/* Étages */}
        {floors.map((f) => {
          const y0 = baseY(f) - FH
          const pop = floorPop[f] && now - floorPop[f] < 900
          return (
            <g key={f} className={pop ? 'floor-pop' : undefined}>
              {/* Cases vides */}
              {Array.from({ length: SLOTS }, (_, s) => occupied.has(`${f},${s}`) ? null : (
                <g key={s}>
                  <rect x={X0 + s * SW} y={y0} width={SW} height={FH - 8} fill={f < 0 ? '#5d5f63' : '#c7c2bb'} />
                  <rect x={X0 + s * SW} y={y0} width={SW} height={FH - 8} fill="url(#brick)" opacity={0.5} />
                </g>
              ))}
              {/* Dalle */}
              <rect x={X0 - 6} y={baseY(f) - 8} width={BW + 12} height={8} fill={f < 0 ? '#4b4d52' : '#9e9389'} />
              <text x={X0 - 17} y={y0 + FH / 2} fontSize={10} fill="#fff" opacity={0.75} textAnchor="middle" fontWeight={800}>{f === 0 ? 'RDC' : f < 0 ? `S${-f}` : f}</text>
            </g>
          )
        })}

        {/* Pièces */}
        {rooms.map((r) => {
          const d = ROOMS[r.type]
          const x = X0 + r.slot * SW
          const y0 = baseY(r.floor) - FH
          const wpx = d.w * SW
          const isPop = popped[r.id] && now - popped[r.id] < 900
          const home = homesAt.has(r.id)
          const vacant = d.kind === 'home' && r.tenants.length === 0
          const dark = sk.night > 0.5 && !home && d.kind === 'home'
          return (
            <g key={r.id} transform={`translate(${x},${y0})`} onClick={() => useRentier.getState().select(r.id === selected ? null : r.id)} style={{ cursor: 'pointer' }}>
              <g className={isPop ? 'room-pop' : undefined}>
                <rect x={0} y={0} width={wpx} height={FH - 8} fill={d.wall} />
                <Interior r={r} w={wpx} night={sk.night} skyCol={sk.bot} home={home} g={g} st={ROOMS[r.type].kind === 'shop' ? stationsOf(w, r) : undefined} />
                {dark && <rect x={0} y={0} width={wpx} height={FH - 8} fill="#0b1028" opacity={0.35} />}
                <rect x={0} y={0} width={1.5} height={FH - 8} fill="rgba(0,0,0,0.15)" />
                {vacant && <g><rect x={wpx / 2 - 22} y={22} width={44} height={14} rx={3} fill="#e63946" /><text x={wpx / 2} y={31.5} fontSize={8} fill="#fff" textAnchor="middle" fontWeight={900}>À LOUER</text></g>}
              </g>
              {selected === r.id && <rect x={1.5} y={1.5} width={wpx - 3} height={FH - 11} fill="none" stroke="#fff" strokeWidth={3} rx={2} className="sel-pulse" />}
            </g>
          )
        })}

        {/* Cage d'ascenseur */}
        <rect x={X0 + SLOTS * SW} y={baseY(g.top) - FH} width={SHAFT_W} height={(g.top - g.bottom + 1) * FH} fill="#3d4450" />
        {floors.map((f) => (
          <g key={`sd${f}`}>
            <rect x={X0 + SLOTS * SW + 4} y={baseY(f) - FH + 18} width={SHAFT_W - 8} height={FH - 26} fill="#2a2f38" />
            <rect x={X0 + SLOTS * SW} y={baseY(f) - 8} width={SHAFT_W} height={8} fill="#2a2f38" />
            {(w.lift.waiting.get(f)?.length ?? 0) > 0 && <circle cx={X0 + SLOTS * SW + SHAFT_W / 2} cy={baseY(f) - FH + 10} r={3} fill="#ffb703" />}
          </g>
        ))}
        <line x1={X0 + SLOTS * SW + SHAFT_W / 2} y1={baseY(g.top) - FH} x2={X0 + SLOTS * SW + SHAFT_W / 2} y2={liftY - FH + 12} stroke="#777" strokeWidth={1} />
        <g transform={`translate(${X0 + SLOTS * SW + 4},${liftY - FH + 12})`}>
          <rect x={0} y={0} width={SHAFT_W - 8} height={FH - 20} rx={3} fill="#c9a227" />
          <rect x={3} y={3} width={SHAFT_W - 14} height={FH - 26} rx={2} fill="#f3e3a0" />
        </g>
        {w.lift.riders.map((id, i) => {
          const a = w.agents.find((x) => x.id === id)
          if (!a) return null
          return <Person key={id} a={a} x={X0 + SLOTS * SW + 12 + (i % 4) * 7} y={liftY - 9} small />
        })}

        {/* Habitants & visiteurs */}
        {w.agents.filter((a) => !a.inLift && !(a.kind === 'res' && a.away)).map((a) => {
          const y = baseY(a.floor) - 9
          let x = X0 + a.x
          const s0 = a.steps[0]
          if (s0 && s0.t === 'lift') {
            // Les gens attendent l'ascenseur en file, sans se superposer.
            const q = w.lift.waiting.get(a.floor) ?? []
            const i = Math.max(0, q.indexOf(a.id))
            x = X0 + shaftX - 14 - i * 9
          }
          const waitK = s0 && s0.t === 'queue' ? Math.min(1, a.waitT / (a.kind === 'res' ? PATIENCE.res : PATIENCE.vis)) : null
          return (
            <g key={a.id} pointerEvents="none">
              <Person a={a} x={x} y={y} />
              {a.icon && <IconBubble x={x} y={y - 30} icon={a.icon} />}
              {waitK != null && <g transform={`translate(${x - 8},${y - 52})`}><rect width={16} height={3} rx={1.5} fill="rgba(0,0,0,0.25)" /><rect width={16 * (1 - waitK)} height={3} rx={1.5} fill={waitK > 0.66 ? '#ef4444' : waitK > 0.33 ? '#f59e0b' : '#22c55e'} /></g>}
            </g>
          )
        })}

        {/* Incidents & bulles de loyers */}
        {rooms.map((r) => {
          const d = ROOMS[r.type]
          const x = X0 + r.slot * SW + d.w * SW / 2
          const y0 = baseY(r.floor) - FH
          const out: ReactElement[] = []
          if (r.incident) {
            out.push(
              <g key="inc" transform={`translate(${x + d.w * SW / 2 - 16},${y0 + 40})`} onClick={(e) => { e.stopPropagation(); useRentier.getState().repair(r.id) }} style={{ cursor: 'pointer' }} className="incident">
                <circle r={11} fill="#e63946" stroke="#fff" strokeWidth={2.5} />
                <text y={1} fontSize={11} textAnchor="middle" dominantBaseline="middle">{r.incident.kind === 'fuite' ? '💧' : '⚡'}</text>
              </g>,
            )
          }
          const qn = d.kind === 'shop' ? (w.queues[r.id]?.length ?? 0) : 0
          if (qn > 0) {
            const busy = stationsOf(w, r).filter((s) => s.agentId).length
            out.push(
              <g key="q" transform={`translate(${X0 + r.slot * SW + d.w * SW - 44},${y0 - 12})`} pointerEvents="none">
                <rect width={74} height={15} rx={7.5} fill={qn >= 3 ? '#ef4444' : '#f59e0b'} />
                <text x={37} y={8} fontSize={8} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight={900}>⏳ {qn} en attente · {busy}/{stationCount(r)}</text>
              </g>,
            )
          }
          const k = d.kind
          const threshold = k === 'shop' ? 20 : Math.max(40, monthlyRent(g, r).net * 0.5)
          if ((k === 'home' || k === 'shop' || k === 'parking') && r.stored >= threshold) {
            const label = fmtShort(r.stored)
            const bw = 26 + label.length * 7
            out.push(
              <g key="coin" transform={`translate(${x},${y0 + 15})`} onClick={(e) => { e.stopPropagation(); useRentier.getState().collect(r.id, e.clientX, e.clientY) }} style={{ cursor: 'pointer' }} className="coin-bob">
                <rect x={-bw / 2} y={-12} width={bw} height={22} rx={11} fill="#fff" stroke="#ffd34d" strokeWidth={2.5} />
                <circle cx={-bw / 2 + 11} cy={-1} r={7.5} fill="url(#coinGrad)" />
                <text x={-bw / 2 + 11} y={0} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#a86400" fontWeight={900}>€</text>
                <text x={-bw / 2 + 22} y={0} fontSize={12} dominantBaseline="middle" fill="#7a4a00" fontWeight={900} fontFamily="Baloo 2, system-ui">{label}</text>
              </g>,
            )
          }
          return <g key={`o${r.id}`}>{out}</g>
        })}

        {/* Cibles de construction */}
        {targets.map((t) => {
          const d = ROOMS[buildType as RoomType]
          const on = target && target.floor === t.floor && target.slot === t.slot
          return (
            <g key={`t${t.floor},${t.slot}`} onClick={() => {
              const s = useRentier.getState()
              if (on) s.confirmBuild(); else s.setTarget(t)
            }} style={{ cursor: 'pointer' }}>
              <rect x={X0 + t.slot * SW + 3} y={baseY(t.floor) - FH + 3} width={d.w * SW - 6} height={FH - 14} rx={4}
                fill={on ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.18)'} stroke={on ? '#34d399' : '#fff'} strokeWidth={on ? 3 : 2} strokeDasharray={on ? undefined : '6 5'} className={on ? undefined : 'target-pulse'} />
              {on && <text x={X0 + t.slot * SW + d.w * SW / 2} y={baseY(t.floor) - FH / 2} fontSize={24} textAnchor="middle" dominantBaseline="middle">{d.emoji}</text>}
            </g>
          )
        })}

        {/* Toit + construire un étage */}
        <g>
          <rect x={X0 - 8} y={baseY(g.top) - FH - 10} width={BW + 16} height={8} fill="#5d4e43" />
          <rect x={X0 + BW - 78} y={baseY(g.top) - FH - 34} width={26} height={24} rx={3} fill="#9aa5b1" />
          <rect x={X0 + BW - 68} y={baseY(g.top) - FH - 42} width={6} height={8} fill="#7b8794" />
          <line x1={X0 + BW - 30} y1={baseY(g.top) - FH - 10} x2={X0 + BW - 30} y2={baseY(g.top) - FH - 44} stroke="#5d6670" strokeWidth={2} />
          <circle cx={X0 + BW - 30} cy={baseY(g.top) - FH - 46} r={2.5} fill="#ff4d6d" className="blink" />
          <FloorButton x={X0 + BW / 2 - 40} y={baseY(g.top) - FH - 40} label="Étage" cost={floorCost(g.top + 1)} cash={g.cash} onClick={() => useRentier.getState().buildFloor(true)} />
        </g>
        <FloorButton x={X0 + BW / 2} y={baseY(g.bottom) + 34} label="Sous-sol" cost={floorCost(g.bottom - 1)} cash={g.cash} onClick={() => useRentier.getState().buildFloor(false)} />

        {/* Porte d'entrée */}
        <rect x={X0 - 6} y={groundBase - 52} width={6} height={44} fill="#5b3a29" />

        <defs>
          <radialGradient id="coinGrad" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#fff6c4" /><stop offset="40%" stopColor="#ffd34d" /><stop offset="100%" stopColor="#d18a0d" />
          </radialGradient>
          <pattern id="brick" width="22" height="12" patternUnits="userSpaceOnUse">
            <rect width="22" height="12" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
            <line x1="11" y1="6" x2="11" y2="12" stroke="rgba(0,0,0,0.12)" />
          </pattern>
        </defs>
      </svg>
      <div className="cloud" style={{ top: 70, animationDuration: '110s', opacity: 0.8 - sk.night * 0.6 }} />
      <div className="cloud" style={{ top: 190, animationDuration: '150s', animationDelay: '-70s', opacity: 0.6 - sk.night * 0.5 }} />
      <div style={{ height: 150 }} />
    </div>
  )
}

function FloorButton({ x, y, label, cost, cash, onClick }: { x: number; y: number; label: string; cost: number; cash: number; onClick: () => void }) {
  const ok = cash >= cost
  return (
    <g transform={`translate(${x},${y})`} onClick={onClick} style={{ cursor: 'pointer' }} opacity={ok ? 1 : 0.6}>
      <rect x={-56} y={-14} width={112} height={28} rx={14} fill={ok ? '#f2792b' : '#94a3b8'} stroke="#fff" strokeWidth={2.5} />
      <text x={0} y={1} fontSize={11.5} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight={900} fontFamily="Baloo 2, system-ui">+ {label} · {fmtShort(cost)} €</text>
    </g>
  )
}

export { shaftX, EXIT_X }
