/**
 * OPEN SPACE — la tour de bureaux en coupe (SVG), ses employés et l'ascenseur.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { useCorp } from './store'
import {
  canPlace, shaftX, EXIT_X, escalatorsOf, liftDefs, liftStops, liftUnlocked, liftInstallPrice, liftExtendPrice, stationCount, stationX, stationsOf, PATIENCE, stairX, stairServed, deskX, fileValue, has,
  type Agent, type Game, type Room, type Station,
} from './sim'
import { ROOMS, SLOTS, SW, SHAFT_W, SHAFT_X0, slotX, FH, BW, STAFF, BANK_CAP, WORK_START, WORK_END, floorCost, type RoomType, type TrashKind } from './data'
import { fmtShort } from '../archipel/format'

const SIDE = 34          // trottoir de chaque côté
const BELOW = 90
const W = BW + SIDE * 2
/** Largeur visible (unités SVG) sur un téléphone : côté gauche + cage. */
const VIEW_W = SIDE + SHAFT_X0 + SHAFT_W + 34

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
function shade(hex: string, k = 0.75) {
  const m = hex.match(/^#(\w\w)(\w\w)(\w\w)$/)
  if (!m) return hex
  return `rgb(${m.slice(1).map((h) => Math.min(255, Math.round(parseInt(h, 16) * k))).join(',')})`
}

function Person({ a, x, y, small }: { a: Agent; x: number; y: number; small?: boolean }) {
  const s = small ? 0.85 : 1
  const coat = a.role === 'researcher'
  const cap = a.kind === 'staff' && a.role ? STAFF[a.role].cap : ''
  return (
    <g transform={`translate(${x},${y}) scale(${a.dir * s},${s})`}>
      <ellipse cx={0} cy={0} rx={6} ry={1.8} fill="rgba(0,0,0,0.18)" />
      <g className={a.walking ? 'walk-r' : undefined}><rect x={-1.2} y={-18} width={2.4} height={8.5} rx={1.2} fill={shade(a.cloth)} /></g>
      <g className={a.walking ? 'walk-l' : undefined}><rect x={-3.2} y={-9} width={2.6} height={9} rx={1.2} fill="#2d3142" /><rect x={-3.6} y={-1.4} width={3.6} height={1.6} rx={0.8} fill="#1b1e2b" /></g>
      <g className={a.walking ? 'walk-r' : undefined}><rect x={0.6} y={-9} width={2.6} height={9} rx={1.2} fill="#3b4058" /><rect x={0.6} y={-1.4} width={3.8} height={1.6} rx={0.8} fill="#1b1e2b" /></g>
      <rect x={-4.6} y={-19} width={9.2} height={11} rx={3.2} fill={a.cloth} stroke="rgba(0,0,0,0.35)" strokeWidth={0.5} />
      {a.tie && <path d="M1.2,-18.6 L2.8,-18.6 L3.2,-12.5 L2,-11 L0.8,-12.5 Z" fill={a.tie} />}
      {coat && <><rect x={-4.8} y={-19} width={9.6} height={14} rx={3} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={0.5} /><rect x={-0.5} y={-18} width={1} height={12} fill="#93c5fd" /></>}
      {a.role === 'guard' && <circle cx={2} cy={-16} r={1.4} fill="#facc15" />}
      {a.role === 'janitor' && <rect x={-4.6} y={-13} width={9.2} height={1.6} fill="#facc15" />}
      <g className={a.walking ? 'walk-l' : undefined}><rect x={-0.6} y={-18} width={2.4} height={8.5} rx={1.2} fill={coat ? '#e2e8f0' : a.cloth} stroke="rgba(0,0,0,0.15)" strokeWidth={0.4} /><circle cx={0.6} cy={-9.6} r={1.3} fill={a.skin} /></g>
      <circle cx={0} cy={-23.5} r={4.6} fill={a.skin} stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
      <path d="M-4.7,-24 A4.8,4.8 0 0 1 4.7,-24 L4.7,-25.5 A4.8,4.8 0 0 0 -4.7,-25.5 Z" fill={a.hair} />
      <path d="M-4.8,-24.5 A4.8,4.8 0 0 1 4.8,-24.5 Q2,-27 -4.8,-24.5" fill={a.hair} />
      <circle cx={2} cy={-23.4} r={0.7} fill="#222" />
      {coat && <g><circle cx={2.4} cy={-23.4} r={1.6} fill="none" stroke="#1e293b" strokeWidth={0.6} /><line x1={-1} y1={-23.6} x2={0.8} y2={-23.6} stroke="#1e293b" strokeWidth={0.5} /></g>}
      {cap && <rect x={-5} y={-28.5} width={10} height={2.6} rx={1} fill={cap} />}
      {a.carry === 'wrench' && <rect x={4.5} y={-17} width={2} height={9} rx={1} fill="#9aa5b1" transform="rotate(20,5,-12)" />}
      {a.carry === 'bag' && <g><rect x={4.2} y={-12} width={7} height={5.5} rx={1} fill="#4b2e1e" /><rect x={6.2} y={-13.5} width={3} height={2} rx={0.8} fill="none" stroke="#4b2e1e" strokeWidth={0.8} /></g>}
      {a.carry === 'clipboard' && <g><rect x={4} y={-16} width={6} height={8} rx={0.8} fill="#a16207" /><rect x={4.8} y={-15} width={4.4} height={6} fill="#fff" /><rect x={5.5} y={-14} width={3} height={0.6} fill="#94a3b8" /><rect x={5.5} y={-12.5} width={3} height={0.6} fill="#94a3b8" /></g>}
      {a.carry === 'cup' && <path d="M4.5,-13 L8.5,-13 L8,-8.5 L5,-8.5 Z" fill="#fff" stroke="#a16207" strokeWidth={0.6} />}
      {a.carry === 'trashbag' && <g><path d={`M-6,-${8 + a.bagN} Q-13,-${5 + a.bagN / 2} -10,0 L-3,0 Q-1,-${5 + a.bagN / 2} -6,-${8 + a.bagN} Z`} fill="#1f2937" /><path d={`M-7,-${8 + a.bagN} L-6,-${11 + a.bagN} L-5,-${8 + a.bagN} Z`} fill="#1f2937" /></g>}
      {a.carry === 'sack' && <g><circle cx={-7} cy={-15} r={5} fill="#8d6e63" /><rect x={-8.5} y={-21} width={3} height={3} rx={1} fill="#6d4c41" /><text x={-7} y={-14} fontSize={5} textAnchor="middle" dominantBaseline="middle" fill="#ffd34d" fontWeight={900}>€</text></g>}
      {a.kind === 'thief' && <g><path d="M-5.6,-22 A5.6,5.8 0 0 1 5.6,-22 L5.6,-19.5 L-5.6,-19.5 Z" fill="#14141c" /><rect x={-3} y={-25} width={7} height={2.4} rx={1} fill="#14141c" /><circle cx={2} cy={-23.8} r={0.8} fill="#fff" /></g>}
    </g>
  )
}

/** Employé assis à son poste, de profil, qui tape sur son clavier. */
const NEED_ICON: Record<string, string> = { pc: '💻', wc: '🚽', coffee: '☕', mood: '😠', stress: '😩', boost: '⚡' }

function SeatedWorker({ a, cx, fl, boost }: { a: Agent; cx: number; fl: number; boost: boolean }) {
  const pk = a.prodK ?? 1
  const col = pk >= 1.05 ? '#22c55e' : pk >= 0.8 ? '#84cc16' : pk >= 0.55 ? '#f59e0b' : '#ef4444'
  const need = a.need && a.need !== 'boost' ? a.need : null
  return (
    <g transform={`translate(${cx - 7},${fl})`}>
      {/* Avancement du dossier en cours : la vitesse de remplissage montre sa productivité */}
      <g transform="translate(1.6,-40)" pointerEvents="none">
        <rect x={-8} y={0} width={16} height={2.6} rx={1.3} fill="rgba(15,23,42,0.35)" />
        <rect x={-8} y={0} width={16 * Math.min(1, a.prog)} height={2.6} rx={1.3} fill={col} />
      </g>
      {need && (
        <g transform="translate(1.6,-50)" pointerEvents="none">
          <rect x={-7} y={-6} width={14} height={11} rx={5.5} fill={need === 'pc' || pk < 0.55 ? '#fee2e2' : '#fff'} stroke={need === 'pc' || pk < 0.55 ? '#ef4444' : 'rgba(0,0,0,0.15)'} strokeWidth={0.8} />
          <text x={0} y={0} fontSize={7.5} textAnchor="middle" dominantBaseline="middle">{NEED_ICON[need]}</text>
        </g>
      )}
      <rect x={-2} y={-11} width={9} height={2.5} rx={1} fill="#1f2937" />
      <rect x={1.5} y={-8.5} width={1.6} height={8.5} fill="#334155" />
      <rect x={-4} y={-25} width={3} height={15} rx={1.5} fill="#334155" />
      <rect x={-1.5} y={-14} width={8} height={3} rx={1.5} fill="#2d3142" />
      <rect x={-2.5} y={-24} width={8.4} height={11} rx={3} fill={a.cloth} stroke="rgba(0,0,0,0.35)" strokeWidth={0.5} />
      {a.tie && <path d="M3.6,-23.6 L5.2,-23.6 L5.6,-17.5 L4.4,-16 L3.2,-17.5 Z" fill={a.tie} />}
      <g className="type-arm"><rect x={2} y={-21} width={8} height={2.4} rx={1.2} fill={shade(a.cloth)} /><circle cx={10.2} cy={-19.8} r={1.3} fill={a.skin} /></g>
      <circle cx={1.6} cy={-28.4} r={4.5} fill={a.skin} stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
      <path d="M-2.9,-29 A4.6,4.6 0 0 1 6.1,-29 Q3.5,-32 -2.9,-29" fill={a.hair} />
      <circle cx={3.6} cy={-28.4} r={0.7} fill="#222" />
      {boost && <g className="boost-glow"><circle cx={1.6} cy={-28} r={8} fill="none" stroke="#facc15" strokeWidth={1.2} opacity={0.8} /></g>}
    </g>
  )
}

function CarSprite({ x, y, color, dir, moving, night }: { x: number; y: number; color: string; dir: 1 | -1; moving: boolean; night: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${dir},1)`} pointerEvents="none">
      <ellipse cx={0} cy={0.5} rx={17} ry={2} fill="rgba(0,0,0,0.25)" />
      {moving && night > 0.3 && <path d="M15,-6 L40,-11 L40,1 Z" fill="#fff7c2" opacity={0.35} />}
      <rect x={-16} y={-10} width={32} height={8} rx={3} fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth={0.6} />
      <path d="M-9,-10 L-6,-16 L7,-16 L11,-10 Z" fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth={0.6} />
      <path d="M-7.5,-10.5 L-5.2,-15 L0,-15 L0,-10.5 Z M1,-10.5 L1,-15 L6.4,-15 L9.6,-10.5 Z" fill="#cfe8ff" />
      <rect x={-16} y={-6.5} width={32} height={1.2} fill="rgba(255,255,255,0.35)" />
      <rect x={14} y={-8.5} width={2.2} height={2} rx={0.6} fill={moving ? '#fff59d' : '#fde68a'} />
      <rect x={-16.2} y={-8.5} width={2} height={2} rx={0.6} fill="#ef4444" />
      <g className={moving ? 'wheel' : undefined}><circle cx={-9} cy={-2} r={3} fill="#1f2937" /><circle cx={-9} cy={-2} r={1.2} fill="#9ca3af" /></g>
      <g className={moving ? 'wheel' : undefined}><circle cx={9} cy={-2} r={3} fill="#1f2937" /><circle cx={9} cy={-2} r={1.2} fill="#9ca3af" /></g>
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

/** Un déchet bien précis au sol. */
function TrashSprite({ x, fl, kind }: { x: number; fl: number; kind: TrashKind }) {
  switch (kind) {
    case 'paper': return <g transform={`translate(${x},${fl - 1.6}) scale(1.4)`}><circle r={2.2} fill="#f8fafc" stroke="#94a3b8" strokeWidth={0.5} /><path d="M-1.3,-0.6 L0.4,0.3 L-0.2,1.2 M0.6,-1.4 L1.3,0" stroke="#94a3b8" strokeWidth={0.4} fill="none" /></g>
    case 'cup': return <g transform={`translate(${x},${fl - 1.4}) scale(1.4) rotate(80)`}><path d="M-2,-2.2 L2,-2.2 L1.4,2.4 L-1.4,2.4 Z" fill="#fff" stroke="#a16207" strokeWidth={0.5} /><rect x={-2} y={-0.6} width={4} height={1.2} fill="#b45309" /></g>
    case 'banana': return <g transform={`translate(${x},${fl - 1}) scale(1.4)`}><path d="M-3.5,0.6 Q0,-3 3.5,0.6 L2.6,0.9 Q0,-1.4 -2.6,0.9 Z" fill="#facc15" stroke="#a16207" strokeWidth={0.4} /><path d="M-3.5,0.6 L-4.6,1.4 M3.5,0.6 L4.4,1.6" stroke="#facc15" strokeWidth={0.8} /></g>
    case 'pizza': return <g transform={`translate(${x},${fl - 1.2}) scale(1.4)`}><rect x={-4.5} y={-1.2} width={9} height={2.4} rx={0.4} fill="#e7c89b" stroke="#a16207" strokeWidth={0.4} /><circle cx={1.6} cy={-1.3} r={0.8} fill="#dc2626" /></g>
    case 'puddle': return <g transform={`translate(${x},${fl + 0.6}) scale(1.4)`}><ellipse rx={5.5} ry={1.3} fill="#7c4a1e" opacity={0.75} /><ellipse cx={-1.5} cy={-0.3} rx={1.6} ry={0.4} fill="#fff" opacity={0.35} /></g>
    case 'can': return <g transform={`translate(${x},${fl - 1.3}) scale(1.4) rotate(90)`}><rect x={-1.3} y={-2.4} width={2.6} height={4.8} rx={0.6} fill="#dc2626" /><rect x={-1.3} y={-0.4} width={2.6} height={0.8} fill="#fff" /></g>
    case 'wcpaper': return <g transform={`translate(${x},${fl - 1.6}) scale(1.4)`}><circle r={1.8} fill="#fff" stroke="#cbd5e1" strokeWidth={0.4} /><path d="M1.6,1.4 Q4,1.8 6,1.2 L6.4,1.8 Q4,2.4 1.4,2" fill="#fff" stroke="#cbd5e1" strokeWidth={0.3} /></g>
    case 'wcpuddle': return <g transform={`translate(${x},${fl + 0.6}) scale(1.4)`}><ellipse rx={5} ry={1.2} fill="#facc15" opacity={0.55} /><ellipse cx={1} cy={-0.2} rx={1.4} ry={0.35} fill="#fff" opacity={0.5} /></g>
  }
  return null
}

/** Poste de travail : chaise, employé (si présent), bureau, écran. */
function Desk({ cx, fl, agent, broken, bank, val, pro, boost }: { cx: number; fl: number; agent: Agent | null; broken: boolean; bank: number; val: number; pro: number; boost: boolean }) {
  const wood = pro === 2 ? '#7c4a26' : pro === 1 ? '#a16207' : '#cbd5e1'
  const full = bank >= val * BANK_CAP
  return (
    <g>
      {agent && <SeatedWorker a={agent} cx={cx} fl={fl} boost={boost} />}
      {!agent && <g><rect x={cx - 11} y={fl - 11} width={9} height={2.5} rx={1} fill="#1f2937" /><rect x={cx - 7.5} y={fl - 8.5} width={1.6} height={8.5} fill="#334155" /><rect x={cx - 13} y={fl - 24} width={3} height={15} rx={1.5} fill="#334155" /></g>}
      <rect x={cx - 3} y={fl - 13} width={18} height={2.6} rx={0.8} fill={wood} stroke="rgba(0,0,0,0.25)" strokeWidth={0.4} />
      <rect x={cx - 2} y={fl - 10.4} width={16} height={10.4} fill={shade(wood.length === 7 ? wood : '#cbd5e1', 0.85)} />
      <rect x={cx + 2} y={fl - 7} width={8} height={1} fill="rgba(0,0,0,0.2)" />
      {/* écran */}
      <rect x={cx + 3} y={fl - 23} width={11} height={8.5} rx={1} fill="#111827" />
      <rect x={cx + 4} y={fl - 22} width={9} height={6.5} fill={broken ? '#1d4ed8' : agent ? '#0f172a' : '#1f2937'} />
      {agent && !broken && <g className="screen-lines">{[0, 1, 2].map((i) => <rect key={i} x={cx + 5} y={fl - 21 + i * 2} width={3 + ((i * 3) % 5)} height={0.8} fill={full ? '#f59e0b' : '#22c55e'} />)}</g>}
      {broken && <g><text x={cx + 8.5} y={fl - 17.6} fontSize={4} fill="#fff" textAnchor="middle" fontWeight={900}>:(</text><g className="smoke"><circle cx={cx + 10} cy={fl - 26} r={2} fill="#9ca3af" opacity={0.6} /><circle cx={cx + 12} cy={fl - 29} r={2.6} fill="#9ca3af" opacity={0.45} /></g></g>}
      <rect x={cx + 7.6} y={fl - 14.6} width={1.6} height={1.8} fill="#111827" />
      <rect x={cx + 4} y={fl - 13.9} width={6} height={0.9} rx={0.4} fill="#475569" />
      {pro === 0 && <rect x={cx + 16} y={fl - 30} width={2.4} height={30} fill="#94a3b8" />}
    </g>
  )
}

export function Interior({ r, w, night, skyCol, g, st, seats, boosts }: { r: Room; w: number; night: number; skyCol: string; g: Game; st?: Station[]; seats?: (Agent | null)[]; boosts?: boolean[] }): ReactElement {
  const n = stationCount(r)
  const sx = (i: number) => stationX(r, i) - slotX(r.slot)
  const stOf = (i: number): Station => st?.[i] ?? { agentId: null, t: 0, dur: 0, phase: 'idle', doneT: 0 }
  const h = FH - 8
  const fl = h - 6
  const d = ROOMS[r.type]
  if (d.kind === 'work') {
    const pro = r.type === 'openspace' ? 0 : r.type === 'bureaupro' ? 1 : 2
    const val = fileValue(g, r)
    return (
      <g>
        <rect x={0} y={fl} width={w} height={6} fill={pro === 0 ? '#64748b' : pro === 1 ? '#8b5a2b' : '#7f1d1d'} />
        {pro === 0 && Array.from({ length: Math.ceil(w / 8) }, (_, i) => <rect key={i} x={i * 8} y={fl} width={4} height={6} fill="#5b6678" />)}
        {pro >= 1 && Array.from({ length: Math.ceil(w / 14) }, (_, i) => <rect key={i} x={i * 14} y={fl} width={0.8} height={6} fill="rgba(0,0,0,0.25)" />)}
        <Window x={10} y={10} w={22} h={20} skyCol={skyCol} lit={false} />
        <Window x={w - 32} y={10} w={22} h={20} skyCol={skyCol} lit={false} />
        {pro === 0 && <g><rect x={w / 2 - 15} y={11} width={30} height={14} rx={1} fill="#fff" stroke="#94a3b8" /><path d={`M${w / 2 - 12},22 L${w / 2 - 6},17 L${w / 2},19 L${w / 2 + 8},13`} stroke="#22c55e" strokeWidth={1.3} fill="none" /><text x={w / 2} y={15.5} fontSize={3.5} fill="#64748b" textAnchor="middle" fontWeight={900}>OBJECTIFS</text></g>}
        {pro === 1 && <g>{[0, 1, 2].map((i) => <rect key={i} x={w / 2 - 13} y={11 + i * 5} width={26} height={1.5} fill="#7c4a26" />)}{[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={w / 2 - 12 + i * 4} y={7 + (i % 3) * 5} width={2.4} height={4} fill={['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#0ea5e9'][i]} />)}</g>}
        {pro === 2 && <g><rect x={w / 2 - 14} y={9} width={28} height={20} fill="#fde68a" stroke="#a16207" strokeWidth={2} /><circle cx={w / 2} cy={19} r={5} fill="#b45309" /></g>}
        {has(g, 'plants') && <g><rect x={w - 8} y={fl - 8} width={5} height={8} rx={1} fill="#b45309" /><circle cx={w - 5.5} cy={fl - 11} r={4} fill="#22c55e" /></g>}
        {Array.from({ length: d.desks ?? 0 }, (_, i) => (
          <Desk key={i} cx={deskX(r, i) - slotX(r.slot)} fl={fl} agent={seats?.[i] ?? null} broken={r.broken[i]} bank={r.bank[i]} val={val} pro={pro} boost={!!boosts?.[i]} />
        ))}
      </g>
    )
  }
  switch (r.type) {
    case 'lobby':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#c9b79c" />
          {Array.from({ length: 6 }, (_, i) => <rect key={i} x={i * 11} y={fl} width={5.5} height={6} fill="#b8a487" />)}
          <rect x={6} y={14} width={30} height={10} rx={2} fill="#1e293b" />
          <text x={21} y={21} fontSize={5.5} fill="#facc15" textAnchor="middle" fontWeight={900}>OPEN·SPACE</text>
          <rect x={16} y={fl - 14} width={30} height={14} rx={1} fill="#7a5a3a" />
          <rect x={14} y={fl - 16} width={34} height={3} rx={1} fill="#a0784f" />
          <rect x={34} y={fl - 22} width={7} height={5} rx={1} fill="#111827" />
          <circle cx={55} cy={fl - 16} r={6} fill="#6fbf4a" /><rect x={53} y={fl - 11} width={4} height={11} rx={1} fill="#5d8a3c" />
        </g>
      )
    case 'wc':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#cbd5e1" />
          {Array.from({ length: Math.ceil(w / 7) * 9 }, (_, i) => <rect key={i} x={(i % Math.ceil(w / 7)) * 7} y={Math.floor(i / Math.ceil(w / 7)) * 7} width={6.4} height={6.4} fill="#e0f2fe" opacity={0.55} />)}
          {Array.from({ length: n }, (_, i) => {
            const cx = sx(i)
            const s = stOf(i)
            const busy = s.phase === 'run'
            return (
              <g key={i}>
                <rect x={cx - 9} y={fl - 34} width={18} height={34} fill="#bfdbfe" stroke="#60a5fa" strokeWidth={0.6} />
                <ellipse cx={cx + 1} cy={fl - 7} rx={4.5} ry={2} fill="#fff" stroke="#94a3b8" strokeWidth={0.5} />
                <rect x={cx - 1} y={fl - 7} width={4.5} height={7} rx={1} fill="#fff" stroke="#94a3b8" strokeWidth={0.5} />
                <rect x={cx + 3} y={fl - 18} width={3} height={8} rx={1} fill="#fff" stroke="#94a3b8" strokeWidth={0.5} />
                {/* porte */}
                <rect x={busy ? cx - 9 : cx - 9} y={fl - 32} width={busy ? 18 : 5} height={30} fill="#3b82f6" stroke="#1d4ed8" strokeWidth={0.6} />
                <circle cx={cx + 6} cy={fl - 27} r={1.4} fill={busy ? '#ef4444' : '#22c55e'} />
                <Progress x={cx} y={fl - 42} st={s} />
              </g>
            )
          })}
          <text x={w - 6} y={12} fontSize={7} textAnchor="end">🚻</text>
        </g>
      )
    case 'cafe':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#8d5a3b" />
          <rect x={2} y={fl - 14} width={w - 4} height={14} fill="#a0522d" />
          <rect x={1} y={fl - 16} width={w - 2} height={3} fill="#d6a679" />
          {Array.from({ length: n }, (_, i) => {
            const cx = sx(i)
            const s = stOf(i)
            return (
              <g key={i}>
                <rect x={cx - 6} y={fl - 30} width={12} height={14} rx={1.5} fill="#374151" />
                <rect x={cx - 4} y={fl - 28} width={8} height={4} rx={1} fill={s.phase === 'run' ? '#f59e0b' : '#9ca3af'} />
                <rect x={cx - 1.5} y={fl - 22} width={3} height={3} fill="#111827" />
                {s.phase === 'run' && <rect x={cx - 0.5} y={fl - 19} width={1} height={2.5} fill="#78350f" />}
                <Progress x={cx} y={fl - 40} st={s} />
              </g>
            )
          })}
          <rect x={4} y={10} width={20} height={9} rx={1} fill="#1f2937" /><text x={14} y={16.5} fontSize={4.5} fill="#fbbf24" textAnchor="middle" fontWeight={900}>CAFÉ</text>
        </g>
      )
    case 'pause':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#a3a380" />
          <rect x={w / 2 - 16} y={10} width={32} height={18} rx={1.5} fill="#111827" /><rect x={w / 2 - 14} y={12} width={28} height={14} fill={night > 0.5 ? '#1e3a8a' : '#38bdf8'} />
          {Array.from({ length: n }, (_, i) => {
            const cx = sx(i)
            const play = stOf(i).phase === 'run'
            // Canapés, puis baby-foot (niveau 2) et borne d'arcade (niveau 3).
            if (i === 3) return <g key={i}><rect x={cx - 9} y={fl - 14} width={18} height={8} rx={1.5} fill="#166534" stroke="#a16207" strokeWidth={1.2} /><line x1={cx - 9} y1={fl - 11} x2={cx + 9} y2={fl - 11} stroke="#d4d4d8" strokeWidth={0.6} /><line x1={cx - 9} y1={fl - 9} x2={cx + 9} y2={fl - 9} stroke="#d4d4d8" strokeWidth={0.6} />{play && <circle cx={cx + Math.sin(Date.now() / 150) * 6} cy={fl - 10} r={0.9} fill="#fff" />}<rect x={cx - 8} y={fl - 6} width={2} height={6} fill="#78350f" /><rect x={cx + 6} y={fl - 6} width={2} height={6} fill="#78350f" /><Progress x={cx} y={fl - 30} st={stOf(i)} /></g>
            if (i === 4) return <g key={i}><rect x={cx - 6} y={fl - 26} width={12} height={26} rx={1.5} fill="#7c3aed" /><rect x={cx - 4} y={fl - 23} width={8} height={7} fill={play ? '#22d3ee' : '#1e1b4b'} /><circle cx={cx - 2} cy={fl - 12} r={1.2} fill="#ef4444" /><circle cx={cx + 2} cy={fl - 12} r={1.2} fill="#facc15" /><Progress x={cx} y={fl - 34} st={stOf(i)} /></g>
            return <g key={i}><rect x={cx - 9} y={fl - 10} width={18} height={10} rx={3} fill="#16a34a" /><rect x={cx - 9} y={fl - 16} width={18} height={7} rx={3} fill="#22c55e" /><rect x={cx - 11} y={fl - 12} width={4} height={12} rx={2} fill="#15803d" /><rect x={cx + 7} y={fl - 12} width={4} height={12} rx={2} fill="#15803d" /><Progress x={cx} y={fl - 30} st={stOf(i)} /></g>
          })}
          <circle cx={8} cy={fl - 14} r={6} fill="#4ade80" /><rect x={5} y={fl - 9} width={6} height={9} rx={1} fill="#b45309" />
        </g>
      )
    case 'rh':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#d6a4b8" />
          <rect x={6} y={9} width={24} height={16} rx={1} fill="#fff" stroke="#f9a8d4" />
          <text x={18} y={19.5} fontSize={7} textAnchor="middle">❤️</text>
          <rect x={34} y={10} width={22} height={14} rx={2} fill="#fce7f3" stroke="#f472b6" />
          <text x={45} y={19} fontSize={4.3} fill="#9d174d" textAnchor="middle" fontWeight={900}>BIEN-ÊTRE</text>
          <rect x={8} y={fl - 12} width={30} height={3} rx={1} fill="#9d174d" /><rect x={10} y={fl - 9} width={26} height={9} fill="#831843" />
          <rect x={44} y={fl - 13} width={14} height={13} rx={4} fill="#f472b6" />
          <circle cx={w - 7} cy={fl - 14} r={5} fill="#22c55e" /><rect x={w - 9} y={fl - 9} width={4} height={9} rx={1} fill="#b45309" />
        </g>
      )
    case 'compta':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#6b7280" />
          <rect x={6} y={9} width={30} height={17} rx={1} fill="#fff" stroke="#6ee7b7" />
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={9 + i * 5} y={23 - (i * 7) % 12 - 2} width={3.5} height={(i * 7) % 12 + 2} fill="#10b981" />)}
          <rect x={40} y={9} width={18} height={20} rx={1} fill="#e5e7eb" stroke="#9ca3af" />
          {[0, 1, 2].map((i) => <rect key={i} x={42} y={12 + i * 6} width={14} height={4} rx={0.6} fill="#d1d5db" />)}
          <rect x={4} y={fl - 13} width={w - 8} height={3} rx={1} fill="#374151" />
          {[0, 1, 2].map((i) => <g key={i}><rect x={10 + i * 16} y={fl - 19} width={7} height={6} rx={1} fill="#111827" /><rect x={11 + i * 16} y={fl - 18} width={5} height={2} fill="#34d399" /></g>)}
        </g>
      )
    case 'supervision':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#8b5a2b" />
          <rect x={6} y={9} width={26} height={18} rx={1} fill="#fff" stroke="#94a3b8" />
          {[0, 1, 2, 3].map((i) => <rect key={i} x={10 + i * 5} y={24 - (i + 1) * 3.2} width={3.5} height={(i + 1) * 3.2} fill={['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'][i]} />)}
          <rect x={6} y={fl - 13} width={34} height={3} rx={1} fill="#7c4a26" /><rect x={8} y={fl - 10} width={30} height={10} fill="#6b3f1f" />
          <rect x={14} y={fl - 17} width={12} height={4} rx={0.6} fill="#fef3c7" /><text x={20} y={fl - 14.2} fontSize={3} fill="#7c2d12" textAnchor="middle" fontWeight={900}>CHEF</text>
          <circle cx={w - 9} cy={fl - 14} r={5} fill="#22c55e" /><rect x={w - 11} y={fl - 9} width={4} height={9} rx={1} fill="#b45309" />
        </g>
      )
    case 'it':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#475569" />
          {[0, 1].map((k) => (
            <g key={k}>
              <rect x={6 + k * 16} y={12} width={13} height={fl - 12} rx={1} fill="#1f2937" />
              {Array.from({ length: 7 }, (_, i) => <g key={i}><rect x={8 + k * 16} y={15 + i * 7} width={9} height={4.5} fill="#374151" /><circle cx={15 + k * 16} cy={17 + i * 7} r={0.8} fill={(Math.floor(Date.now() / 300) + i + k) % 3 ? '#22c55e' : '#f59e0b'} /></g>)}
            </g>
          ))}
          <rect x={40} y={fl - 13} width={22} height={3} rx={1} fill="#94a3b8" /><rect x={42} y={fl - 10} width={2} height={10} fill="#64748b" /><rect x={58} y={fl - 10} width={2} height={10} fill="#64748b" />
          <rect x={44} y={fl - 20} width={10} height={7} rx={1} fill="#111827" /><rect x={45} y={fl - 19} width={8} height={5} fill="#22c55e" opacity={0.5} />
          <text x={56} y={14} fontSize={8}>🔧</text>
        </g>
      )
    case 'menage':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#b0bec5" />
          <rect x={6} y={14} width={34} height={2.5} fill="#90a4ae" />
          <rect x={6} y={30} width={34} height={2.5} fill="#90a4ae" />
          {[9, 17, 25, 33].map((kx, i) => <rect key={kx} x={kx} y={6 + (i % 2)} width={5} height={8 - (i % 2)} rx={1.5} fill={['#4dd0e1', '#ffb74d', '#81c784', '#f06292'][i]} />)}
          {[9, 19, 29].map((kx, i) => <rect key={kx} x={kx} y={22} width={7} height={8} rx={1} fill={['#fff59d', '#b3e5fc', '#ffccbc'][i]} />)}
          <rect x={w - 20} y={fl - 30} width={1.6} height={30} fill="#a1887f" transform={`rotate(-8,${w - 20},${fl})`} />
          <path d={`M${w - 30},${fl - 10} L${w - 18},${fl - 10} L${w - 20},${fl} L${w - 28},${fl} Z`} fill="#1e88e5" />
          <rect x={8} y={fl - 14} width={12} height={14} rx={2} fill="#374151" /><rect x={7} y={fl - 16} width={14} height={3} rx={1} fill="#4b5563" />
        </g>
      )
    case 'securite': {
      const blink = Math.floor(Date.now() / 700) % 2 === 0
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#546e7a" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={8 + (i % 2) * 24} y={8 + Math.floor(i / 2) * 17} width={22} height={15} rx={1.5} fill="#263238" />
              <rect x={10 + (i % 2) * 24} y={10 + Math.floor(i / 2) * 17} width={18} height={11} fill={night > 0.5 ? '#1b5e20' : '#4b6584'} opacity={0.9} />
            </g>
          ))}
          {blink && <circle cx={w - 10} cy={12} r={2.2} fill="#ef4444" />}
          <rect x={6} y={fl - 14} width={w - 12} height={4} rx={1} fill="#37474f" />
        </g>
      )
    }
    case 'labo':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#cbd5e1" />
          <rect x={6} y={8} width={28} height={18} rx={1.5} fill="#fff" stroke="#94a3b8" />
          <text x={20} y={14} fontSize={4.5} fill="#ef4444" textAnchor="middle" fontWeight={900}>E=mc²</text>
          <path d="M9,23 L14,17 L19,20 L25,13 L31,15" stroke="#6366f1" strokeWidth={1.2} fill="none" />
          <rect x={w - 22} y={10} width={14} height={20} rx={1} fill="#e0e7ff" stroke="#a5b4fc" />
          {[0, 1, 2].map((i) => <rect key={i} x={w - 20 + i * 4} y={14 + (i % 2) * 2} width={2.5} height={10 - (i % 2) * 2} rx={1} fill={['#34d399', '#f472b6', '#60a5fa'][i]} />)}
          <rect x={4} y={fl - 13} width={w - 8} height={3} rx={1} fill="#64748b" />
          <path d={`M${w - 30},${fl - 13} l3,-8 h3 l3,8 z`} fill="#86efac" opacity={0.85} />
        </g>
      )
    case 'escalator': {
      // Escalator : du bas à gauche (cet étage) au haut à droite (étage du dessus), marches qui défilent.
      const x1 = 9, x2 = w - 9, y1 = fl, y2 = 2
      const off = (Date.now() / 90) % 1
      const n = 11
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#9ca3af" />
          <polygon points={`${x1 - 4},${y1} ${x2 + 4},${y2} ${x2 + 4},${y2 + 9} ${x1 - 4},${y1 + 9}`} fill="#475569" />
          {Array.from({ length: n }, (_, i) => {
            const k = (i + off) / n
            const tx = x1 + (x2 - x1) * k, ty = y1 + (y2 - y1) * k
            return <rect key={i} x={tx - 3} y={ty - 0.5} width={6} height={1.6} fill="#cbd5e1" />
          })}
          <line x1={x1 - 2} y1={y1 - 15} x2={x2 + 2} y2={y2 - 15} stroke="#111827" strokeWidth={2.4} strokeLinecap="round" />
          <line x1={x1 - 2} y1={y1 - 15} x2={x1 - 2} y2={y1} stroke="#6b7280" strokeWidth={1.2} />
          <rect x={w / 2 - 9} y={8} width={18} height={8} rx={2} fill="#1f2937" />
          <text x={w / 2} y={13.5} fontSize={5} fill="#a7f3d0" textAnchor="middle" fontWeight={900}>↗ ↙</text>
        </g>
      )
    }
    case 'parking':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#5f666e" />
          {[0, 1, 2, 3].map((i) => <rect key={i} x={3 + i * 42} y={fl - 1} width={2} height={7} fill="#f1f5f9" />)}
          {[0, 1, 2].map((i) => <text key={i} x={24 + i * 42} y={fl + 5} fontSize={5} fill="#cbd5e1" textAnchor="middle" fontWeight={900}>{r.slot * 3 + i + 1}</text>)}
          <rect x={0} y={4} width={w} height={3} fill="#475569" />
          {[0.25, 0.75].map((k) => <rect key={k} x={w * k - 6} y={7} width={12} height={2} fill={night > 0.3 ? '#fef9c3' : '#e2e8f0'} />)}
          <rect x={w - 20} y={12} width={12} height={12} rx={2} fill="#1d4ed8" />
          <text x={w - 14} y={20} fontSize={8} fill="#fff" textAnchor="middle" fontWeight={900}>P</text>
        </g>
      )
    case 'serveurs': {
      const t = Math.floor(Date.now() / 250)
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#334155" />
          {Array.from({ length: Math.ceil(w / 8) }, (_, i) => <rect key={i} x={i * 8} y={fl} width={4} height={6} fill="#3f4b5e" />)}
          {[0, 1, 2].map((k) => (
            <g key={k}>
              <rect x={5 + k * 20} y={12} width={16} height={fl - 12} rx={1} fill="#0f172a" stroke="#475569" strokeWidth={0.6} />
              {Array.from({ length: 8 }, (_, i) => (
                <g key={i}>
                  <rect x={7 + k * 20} y={14 + i * 6.5} width={12} height={4.5} fill="#1e293b" />
                  <circle cx={9 + k * 20} cy={16.2 + i * 6.5} r={0.8} fill={(t + i * 3 + k) % 4 ? '#22c55e' : '#38bdf8'} />
                  <circle cx={11.5 + k * 20} cy={16.2 + i * 6.5} r={0.8} fill={(t + i + k * 2) % 5 ? '#16a34a' : '#f59e0b'} />
                </g>
              ))}
            </g>
          ))}
          <text x={w - 8} y={10} fontSize={6} textAnchor="end">❄️</text>
          <rect x={0} y={0} width={w} height={h} fill="#38bdf8" opacity={0.06} />
        </g>
      )
    }
    case 'archives':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#8d7b63" />
          {[0, 1, 2, 3].map((k) => (
            <g key={k}>
              <rect x={6 + k * 31} y={10} width={26} height={fl - 10} fill="#78716c" />
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <rect x={7 + k * 31} y={22 + i * 12} width={24} height={1.6} fill="#57534e" />
                  {[0, 1, 2, 3].map((b) => <rect key={b} x={8 + k * 31 + b * 6} y={14 + i * 12} width={5} height={8} rx={0.6} fill={['#e7d3a8', '#d6c08f', '#c9b27a', '#ead9b4'][(b + i + k) % 4]} stroke="#a8916a" strokeWidth={0.4} />)}
                </g>
              ))}
            </g>
          ))}
        </g>
      )
    default:
      return <g />
  }
}

function lightOn(r: Room, p: number, present: boolean) {
  const k = ROOMS[r.type].kind
  if (k === 'work') return present
  if (k === 'facility') return p > WORK_START - 0.02 && p < WORK_END + 0.04
  return true
}

// ── Composant principal ──────────────────────────────────────────────────────
export function Tower() {
  useCorp((s) => s.rev)
  const st = useCorp.getState()
  const { game: g, world: w, buildType, target, selected, popped, floorPop } = st
  const scroller = useRef<HTMLDivElement>(null)
  const [vh, setVh] = useState(1200)
  const [base, setBase] = useState(1)
  // Zoom (boutons + / − et pincement à deux doigts), mémorisé.
  const [zoom, setZoomState] = useState(() => { try { return Math.min(2.6, Math.max(1, Number(localStorage.getItem('openspace-zoom')) || 1)) } catch { return 1 } })
  const k = base * zoom
  const anchor = useRef<{ cx: number; cy: number; ux: number; uy: number } | null>(null)
  const setZoom = (nz: number, cx?: number, cy?: number) => {
    const el = scroller.current
    const z = Math.min(2.6, Math.max(1, nz))
    if (!el || Math.abs(z - zoom) < 0.001) return
    const fx = cx ?? el.clientWidth / 2, fy = cy ?? el.clientHeight / 2
    // Point du dessin sous le doigt / au centre : il doit rester au même endroit à l'écran.
    anchor.current = { cx: fx, cy: fy, ux: (el.scrollLeft + fx) / k, uy: (el.scrollTop + fy) / k }
    setZoomState(z)
    try { localStorage.setItem('openspace-zoom', String(z)) } catch { /* ignore */ }
  }
  useLayoutEffect(() => {
    const el = scroller.current, a = anchor.current
    if (!el || !a) return
    anchor.current = null
    el.scrollLeft = a.ux * k - a.cx
    el.scrollTop = a.uy * k - a.cy
  }, [k])
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    // Échelle : sur téléphone, la moitié gauche + la cage remplissent l'écran ; on glisse pour voir l'autre côté.
    const upd = () => { const kk = Math.min(1.6, el.clientWidth / VIEW_W); setBase(kk); setVh(el.clientHeight / kk) }
    upd()
    const ro = new ResizeObserver(upd); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Pincement à deux doigts
  const pinch = useRef<{ d: number; z: number } | null>(null)
  const touchDist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  const { groundBase, H, baseY } = geo(g, vh)
  const p = g.day % 1
  const sk = sky(p)
  const now = Date.now()
  const X0 = SIDE

  // Défilement initial (une fois la hauteur réelle connue) : le rez-de-chaussée en bas de l'écran.
  const scrolled = useRef(false)
  useEffect(() => {
    const el = scroller.current
    if (!el || scrolled.current || vh === 1200) return
    scrolled.current = true
    const scale = k
    // Avec un sous-sol, on remonte un peu la vue pour qu'il ne soit pas caché par les boutons.
    el.scrollTop = Math.max(0, groundBase * scale - el.clientHeight * 0.74 + Math.min(2, -g.bottom) * FH * scale)
  }, [vh, groundBase])

  const rooms = g.rooms
  const occupied = new Set<string>()
  for (const r of rooms) for (let i = 0; i < ROOMS[r.type].w; i++) occupied.add(`${r.floor},${r.slot + i}`)

  const floors: number[] = []
  for (let f = g.bottom; f <= g.top; f++) floors.push(f)

  // Emplacements de construction valides
  const targets: { floor: number; slot: number }[] = []
  if (buildType) for (const f of floors) for (let s = 0; s < SLOTS; s++) if (canPlace(g, buildType, f, s)) targets.push({ floor: f, slot: s })

  // Employés assis à leur poste (dessinés dans la pièce) et coups de boost du superviseur.
  const seats = new Map<string, (Agent | null)[]>()
  const boosts = new Map<string, boolean[]>()
  const seated = new Set<string>()
  for (const a of w.agents) {
    const s0 = a.steps[0]
    if (a.kind !== 'worker' || a.away || a.inLift || !s0 || s0.t !== 'work' || a.roomId == null || a.idx == null) continue
    const r = rooms.find((x) => x.id === a.roomId)
    if (!r || Math.round(a.floor) !== r.floor || Math.abs(a.x - deskX(r, a.idx)) > 1) continue
    const arr = seats.get(r.id) ?? Array(ROOMS[r.type].desks ?? 0).fill(null)
    arr[a.idx] = a; seats.set(r.id, arr)
    const b = boosts.get(r.id) ?? []; b[a.idx] = a.boostT > 0; boosts.set(r.id, b)
    seated.add(a.id)
  }

  const defs = liftDefs(g)

  return (
    <>
    <div ref={scroller} className="absolute inset-0 overflow-auto hide-scrollbar"
      style={{ background: `linear-gradient(180deg, ${sk.top} 0%, ${sk.bot} 70%)`, touchAction: 'pan-x pan-y' }}
      onTouchStart={(e) => { if (e.touches.length === 2) pinch.current = { d: touchDist(e.touches), z: zoom } }}
      onTouchMove={(e) => {
        if (e.touches.length !== 2 || !pinch.current) return
        const r = scroller.current!.getBoundingClientRect()
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top
        setZoom(pinch.current.z * touchDist(e.touches) / pinch.current.d, mx, my)
      }}
      onTouchEnd={(e) => { if (e.touches.length < 2) pinch.current = null }}
      onWheel={(e) => { if (e.ctrlKey || e.metaKey) { const r = scroller.current!.getBoundingClientRect(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX - r.left, e.clientY - r.top) } }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W * k} height={H * k} style={{ display: 'block', margin: '0 auto' }}>
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
        <rect x={X0 - 6} y={baseY(g.top) - FH - 4} width={BW + 12} height={(g.top - g.bottom + 1) * FH + 8} fill="#7d6a5b" stroke="#4a3d33" strokeWidth={2} />
        <rect x={X0 - 6} y={baseY(g.top) - FH - 4} width={BW + 12} height={(g.top - g.bottom + 1) * FH + 8} fill="url(#brick)" opacity={0.5} />

        {/* Étages */}
        {floors.map((f) => {
          const y0 = baseY(f) - FH
          const pop = floorPop[f] && now - floorPop[f] < 900
          return (
            <g key={f} className={pop ? 'floor-pop' : undefined}>
              {/* Cases vides */}
              {Array.from({ length: SLOTS }, (_, s) => occupied.has(`${f},${s}`) ? null : (
                <g key={s}>
                  <rect x={X0 + slotX(s)} y={y0} width={SW} height={FH - 8} fill={f < 0 ? '#5d5f63' : '#c7c2bb'} />
                  <rect x={X0 + slotX(s)} y={y0} width={SW} height={FH - 8} fill="url(#brick)" opacity={0.5} />
                </g>
              ))}
              {/* Dalle */}
              <rect x={X0 - 6} y={baseY(f) - 8} width={BW + 12} height={8} fill={f < 0 ? '#4b4d52' : '#9e9389'} />
              <rect x={X0 - 6} y={baseY(f) - 8} width={BW + 12} height={1.5} fill="rgba(255,255,255,0.25)" />
              <rect x={X0 - 6} y={baseY(f) - 1.5} width={BW + 12} height={1.5} fill="rgba(0,0,0,0.3)" />
              <text x={X0 - 17} y={y0 + FH / 2} fontSize={10} fill="#fff" opacity={0.75} textAnchor="middle" fontWeight={800}>{f === 0 ? 'RDC' : f < 0 ? `S${-f}` : f}</text>
            </g>
          )
        })}

        {/* Pièces */}
        {rooms.map((r) => {
          const d = ROOMS[r.type]
          const x = X0 + slotX(r.slot)
          const y0 = baseY(r.floor) - FH
          const wpx = d.w * SW
          const isPop = popped[r.id] && now - popped[r.id] < 900
          const present = (seats.get(r.id) ?? []).some(Boolean)
          const dark = sk.night > 0.5 && d.kind === 'work' && !present
          return (
            <g key={r.id} transform={`translate(${x},${y0})`} onClick={() => useCorp.getState().select(r.id === selected ? null : r.id)} style={{ cursor: 'pointer' }}>
              <g className={isPop ? 'room-pop' : undefined}>
                <rect x={0} y={0} width={wpx} height={FH - 8} fill={d.wall} />
                {r.type !== 'wc' && r.type !== 'parking' && r.type !== 'serveurs' && (
                  <g pointerEvents="none">
                    <rect x={0} y={FH - 34} width={wpx} height={20} fill={shade(d.wall, 0.9)} />
                    <rect x={0} y={FH - 35.5} width={wpx} height={1.5} fill={shade(d.wall, 1.08)} />
                  </g>
                )}
                <Interior r={r} w={wpx} night={sk.night} skyCol={sk.bot} g={g} st={d.kind === 'facility' ? stationsOf(w, r) : undefined} seats={seats.get(r.id)} boosts={boosts.get(r.id)} />
                {r.trash.map((t) => <TrashSprite key={t.id} x={t.x - slotX(r.slot)} fl={FH - 14} kind={t.kind} />)}
                {r.trash.length >= 3 && [0, 1, 2].map((i) => {
                  const t = r.trash[i % r.trash.length]
                  return <circle key={`fly${i}`} cx={t.x - slotX(r.slot) + Math.sin(now / 240 + i * 2) * 6} cy={FH - 24 + Math.cos(now / 190 + i) * 4} r={0.9} fill="#111" pointerEvents="none" />
                })}
                {r.trash.length >= 6 && <path d={`M${wpx * 0.35},${FH - 24} q3,-4 0,-8 q-3,-4 0,-8 M${wpx * 0.6},${FH - 22} q3,-4 0,-8 q-3,-4 0,-8`} stroke="#84cc16" strokeWidth={1.1} fill="none" opacity={0.7} pointerEvents="none" />}
                <rect x={0} y={0} width={wpx} height={FH - 8} fill="url(#roomShade)" pointerEvents="none" />
                <g pointerEvents="none">
                  <rect x={0} y={0} width={wpx} height={4} fill={shade(d.wall, 0.7)} />
                  {Array.from({ length: d.w }, (_, i) => {
                    const lx = (i + 0.5) * SW
                    const on = lightOn(r, p, present)
                    return (
                      <g key={i}>
                        <rect x={lx - 9} y={4} width={18} height={2} rx={1} fill={on ? '#fffbe6' : '#9aa1ab'} />
                        {on && sk.night > 0.35 && <path d={`M${lx - 8},6 L${lx + 8},6 L${lx + 28},${FH - 14} L${lx - 28},${FH - 14} Z`} fill="#fff4c2" opacity={0.13} />}
                      </g>
                    )
                  })}
                  <rect x={0} y={FH - 14} width={wpx} height={1} fill="rgba(255,255,255,0.35)" />
                </g>
                {dark && <rect x={0} y={0} width={wpx} height={FH - 8} fill="#0b1028" opacity={0.4} />}
                <rect x={-1} y={0} width={3} height={FH - 8} fill="#5a4c42" />
                <rect x={wpx - 2} y={0} width={3} height={FH - 8} fill="#5a4c42" />
              </g>
              {selected === r.id && <rect x={1.5} y={1.5} width={wpx - 3} height={FH - 11} fill="none" stroke="#fff" strokeWidth={3} rx={2} className="sel-pulse" />}
            </g>
          )
        })}

        {/* Escalators : posés par-dessus les pièces, de l'étage au suivant */}
        {escalatorsOf(g).map((e) => {
          const x0 = X0 + slotX(e.slot), yb = baseY(e.floor)
          const sel0 = selected === `esc:${e.id}`
          const pick = (ev: { stopPropagation: () => void }) => { ev.stopPropagation(); useCorp.getState().select(sel0 ? null : `esc:${e.id}`) }
          if (e.kind === 'pole') {
            // Barre de pompier : on glisse de l'étage du dessus vers celui-ci.
            const cx = x0 + SW / 2
            return (
              <g key={`esc${e.id}`} onClick={pick} style={{ cursor: 'pointer' }}>
                <ellipse cx={cx} cy={yb - FH - 4} rx={9} ry={2.5} fill="#111827" />
                <rect x={cx - 1.6} y={yb - FH - 6} width={3.2} height={FH - 6} rx={1.6} fill="url(#brass)" />
                <ellipse cx={cx} cy={yb - 12.5} rx={8} ry={1.8} fill="#ef4444" opacity={0.85} />
                <rect x={cx - 9} y={yb - FH + 6} width={18} height={6} rx={2} fill="#dc2626" /><text x={cx} y={yb - FH + 10.3} fontSize={4} fill="#fff" textAnchor="middle" fontWeight={900}>↓ POMPIER</text>
                {sel0 && <rect x={cx - 11} y={yb - FH} width={22} height={FH - 8} fill="none" stroke="#fff" strokeWidth={2} rx={3} className="sel-pulse" />}
              </g>
            )
          }
          if (e.kind === 'hook') {
            // Monte-charge express : câble, poulie et plateforme.
            const cx = x0 + SW / 2
            const bob = Math.sin(now / 300 + e.slot) * 2
            return (
              <g key={`esc${e.id}`} onClick={pick} style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={yb - FH + 3} r={3.2} fill="#475569" stroke="#cbd5e1" strokeWidth={0.8} />
                <line x1={cx} y1={yb - FH + 3} x2={cx} y2={yb - 26 + bob} stroke="#1f2937" strokeWidth={1} />
                <rect x={cx - 7} y={yb - 26 + bob} width={14} height={2.6} rx={1} fill="#f59e0b" stroke="#92400e" strokeWidth={0.6} />
                <rect x={cx - 9} y={yb - FH + 9} width={18} height={6} rx={2} fill="#d97706" /><text x={cx} y={yb - FH + 13.3} fontSize={4} fill="#fff" textAnchor="middle" fontWeight={900}>↑ EXPRESS</text>
                {sel0 && <rect x={cx - 11} y={yb - FH} width={22} height={FH - 8} fill="none" stroke="#fff" strokeWidth={2} rx={3} className="sel-pulse" />}
              </g>
            )
          }
          const x1 = x0 + 9, x2 = x0 + SW - 9, y1 = yb - 14, y2 = yb - FH + 2
          const off = (now / 90) % 1
          const n = 11
          const sel = selected === `esc:${e.id}`
          return (
            <g key={`esc${e.id}`} onClick={(ev) => { ev.stopPropagation(); useCorp.getState().select(sel ? null : `esc:${e.id}`) }} style={{ cursor: 'pointer' }}>
              <polygon points={`${x1 - 5},${y1 + 1} ${x2 + 5},${y2} ${x2 + 5},${y2 + 10} ${x1 - 5},${y1 + 11}`} fill="#334155" opacity={0.92} />
              {Array.from({ length: n }, (_, i) => {
                const k = (i + off) / n
                const tx = x1 + (x2 - x1) * k, ty = y1 + (y2 - y1) * k
                return <rect key={i} x={tx - 3} y={ty - 0.5} width={6} height={1.6} fill="#cbd5e1" />
              })}
              <line x1={x1 - 3} y1={y1 - 14} x2={x2 + 3} y2={y2 - 14} stroke="#0f172a" strokeWidth={2.4} strokeLinecap="round" />
              <line x1={x1 - 3} y1={y1 - 14} x2={x1 - 3} y2={y1 + 1} stroke="#64748b" strokeWidth={1.2} />
              <line x1={x2 + 3} y1={y2 - 14} x2={x2 + 3} y2={y2 + 1} stroke="#64748b" strokeWidth={1.2} />
              {sel && <polygon points={`${x1 - 7},${y1 + 3} ${x2 + 7},${y2 - 2} ${x2 + 7},${y2 + 12} ${x1 - 7},${y1 + 13}`} fill="none" stroke="#fff" strokeWidth={2} className="sel-pulse" />}
            </g>
          )
        })}

        {/* Cages : ascenseur central (escalier là où il ne dessert pas), ascenseur n°2, express */}
        {defs.map((d) => (
          <g key={`col${d.id}`}>
            <rect x={X0 + d.x0} y={baseY(g.top) - FH} width={SHAFT_W} height={(g.top - g.bottom + 1) * FH} fill={d.id === 'A' ? '#3d4450' : '#2f3540'} />
            {floors.map((f) => {
              const served = d.on && f >= d.bottom && f <= d.top
              const sx = X0 + d.x0
              const yb = baseY(f)
              return (
                <g key={`sd${d.id}${f}`}>
                  {served ? (
                    <rect x={sx + 4} y={yb - FH + 12} width={SHAFT_W - 8} height={FH - 20} fill="#1f242c" />
                  ) : (
                    <g>
                      <rect x={sx} y={yb - FH} width={SHAFT_W} height={FH} fill={d.id === 'A' ? '#59606b' : '#4b5160'} />
                      <rect x={sx} y={yb - FH} width={SHAFT_W} height={FH} fill="url(#brick)" opacity={0.35} />
                      {d.id === 'A' && f < g.top && !stairServed(g, f) && (() => {
                        const x1 = X0 + stairX(f), x2 = X0 + stairX(f + 1)
                        const y1 = yb - 8, y2 = yb - FH - 8
                        const n = 9
                        return (
                          <g>
                            <polygon points={`${x1},${y1} ${x2},${y2} ${x2},${y2 + 6} ${x1},${y1 + 6}`} fill="#8b929c" />
                            {Array.from({ length: n }, (_, i) => {
                              const k = (i + 0.5) / n
                              const tx = x1 + (x2 - x1) * k, ty = y1 + (y2 - y1) * k
                              return <rect key={i} x={tx - 2.5} y={ty - 1} width={5} height={2} fill="#b8bec6" />
                            })}
                            <line x1={x1} y1={y1 - 12} x2={x2} y2={y2 - 12} stroke="#c9a227" strokeWidth={1.2} />
                          </g>
                        )
                      })()}
                    </g>
                  )}
                  <rect x={sx} y={yb - 8} width={SHAFT_W} height={8} fill="#2a2f38" />
                </g>
              )
            })}
            {d.on && (() => {
              const L = w.lifts[d.id]
              const sx = X0 + d.x0
              const ly = baseY(L.y)
              const here = Math.abs(L.y - Math.round(L.y)) < 0.01 ? Math.round(L.y) : null
              const frame = d.id === 'A' ? '#c9a227' : d.id === 'B' ? '#94a3b8' : '#dc2626'
              const inner = d.id === 'A' ? '#f6e7b0' : d.id === 'B' ? '#e2e8f0' : '#fee2e2'
              return (
                <g>
                  <line x1={sx + SHAFT_W / 2} y1={baseY(d.top) - FH} x2={sx + SHAFT_W / 2} y2={ly - FH + 12} stroke="#888" strokeWidth={1} />
                  <g transform={`translate(${sx + 4},${ly - FH + 12})`}>
                    <rect x={0} y={0} width={SHAFT_W - 8} height={FH - 20} rx={2} fill={frame} />
                    <rect x={2.5} y={2.5} width={SHAFT_W - 13} height={FH - 25} rx={1.5} fill={inner} />
                    <rect x={8} y={4} width={SHAFT_W - 24} height={3} rx={1.5} fill="#fff7d6" />
                    {d.express && <text x={(SHAFT_W - 8) / 2} y={14} fontSize={6} textAnchor="middle" fill="#b91c1c" fontWeight={900}>⚡EXP</text>}
                  </g>
                  {L.riders.map((id, i) => {
                    const a = w.agents.find((x) => x.id === id)
                    if (!a) return null
                    return <Person key={id} a={a} x={sx + 11 + (i % 4) * 7} y={ly - 9} small />
                  })}
                  {floors.filter((f) => f >= d.bottom && f <= d.top).map((f) => {
                    const stop = liftStops(d, f)
                    const open = here === f ? L.door : 0
                    const y0 = baseY(f) - FH + 12, hh = FH - 20, half = (SHAFT_W - 8) / 2
                    const pw = half * (1 - open * 0.92)
                    const waiting = (L.waiting.get(f)?.length ?? 0) > 0
                    return (
                      <g key={`door${d.id}${f}`} pointerEvents="none">
                        <rect x={sx + 4} y={y0} width={pw} height={hh} fill={stop ? '#bfe3f5' : '#64748b'} opacity={stop ? 0.42 : 0.55} stroke="#8fa3b5" strokeWidth={0.8} />
                        <rect x={sx + 4 + 2 * half - pw} y={y0} width={pw} height={hh} fill={stop ? '#bfe3f5' : '#64748b'} opacity={stop ? 0.42 : 0.55} stroke="#8fa3b5" strokeWidth={0.8} />
                        <rect x={sx + 2} y={y0 - 2} width={SHAFT_W - 4} height={hh + 2} fill="none" stroke={d.express ? '#ef4444' : '#9aa5b1'} strokeWidth={2} />
                        <rect x={sx + SHAFT_W / 2 - 8} y={y0 - 10} width={16} height={7} rx={2} fill="#111827" />
                        <text x={sx + SHAFT_W / 2} y={y0 - 6.2} fontSize={5.5} textAnchor="middle" dominantBaseline="middle" fill={!stop ? '#64748b' : here === f ? '#fbbf24' : '#4b5563'} fontWeight={900}>{!stop ? '—' : f === 0 ? 'RDC' : f < 0 ? `S${-f}` : f}</text>
                        {stop && <circle cx={sx - 3} cy={baseY(f) - FH / 2} r={2.2} fill={waiting ? '#fbbf24' : '#4b5563'} stroke="#1f2937" strokeWidth={0.6} />}
                      </g>
                    )
                  })}
                </g>
              )
            })()}
          </g>
        ))}

        {/* Voitures des employés & tunnel du garage */}
        {w.cars.filter((c) => c.state !== 'out').map((c) => (
          <CarSprite key={c.id} x={X0 + c.x} y={baseY(c.floor) - 9} color={c.color} dir={c.dir} moving={c.state !== 'parked'} night={sk.night} />
        ))}
        {floors.filter((f) => f < 0).map((f) => (
          <g key={`tun${f}`} pointerEvents="none">
            <rect x={0} y={baseY(f) - 44} width={X0 - 6} height={36} fill="#1b1410" />
            <rect x={0} y={baseY(f) - 44} width={X0 - 6} height={36} fill="url(#tunnel)" />
            <rect x={X0 - 9} y={baseY(f) - 47} width={5} height={39} fill="#f2c94c" />
            {[0, 1, 2, 3].map((i) => <rect key={i} x={X0 - 9} y={baseY(f) - 45 + i * 10} width={5} height={5} fill="#1f2937" />)}
          </g>
        ))}

        {/* Habitants & visiteurs */}
        {w.agents.filter((a) => !a.inLift && !a.away && !seated.has(a.id)).map((a) => {
          const y = baseY(a.floor) - 9
          let x = X0 + a.x
          const s0 = a.steps[0]
          if (s0 && s0.t === 'lift') {
            // File d'attente devant les portes de cet ascenseur, de chaque côté de la cage.
            const d = defs.find((z) => z.id === s0.liftId)!
            const c = d.x0 + SHAFT_W / 2
            const right = a.x > c
            const q = (w.lifts[s0.liftId].waiting.get(a.floor) ?? []).filter((id) => { const o = w.agents.find((z) => z.id === id); return !!o && (o.x > c) === right })
            const i = Math.max(0, q.indexOf(a.id))
            x = right ? X0 + d.x0 + SHAFT_W + 6 + i * 8 : X0 + d.x0 - 6 - i * 8
          }
          const waitK = s0 && s0.t === 'queue' ? Math.min(1, a.waitT / PATIENCE) : null
          return (
            <g key={a.id} pointerEvents={a.kind === 'thief' && !a.caught ? undefined : 'none'}
              onClick={a.kind === 'thief' ? (e) => { e.stopPropagation(); useCorp.getState().scare(a.id) } : undefined}
              style={a.kind === 'thief' ? { cursor: 'pointer' } : undefined}>
              {a.kind === 'thief' && !a.caught && <circle cx={x} cy={y - 14} r={16} fill="rgba(239,68,68,0.18)" stroke="#ef4444" strokeWidth={1.2} strokeDasharray="3 3" className="incident" />}
              {a.steps[0]?.t === 'pick' && (
                <g transform={`translate(${x + 12 * a.dir},${y})`}>
                  <path d="M-4,0 L0,-11 L4,0 Z" fill="#facc15" stroke="#a16207" strokeWidth={0.6} />
                  <text x={0} y={-3.2} fontSize={5} textAnchor="middle" fontWeight={900} fill="#713f12">!</text>
                </g>
              )}
              <Person a={a} x={x} y={y} />
              {a.icon && <IconBubble x={x} y={y - 30} icon={a.icon} />}
              {waitK != null && <g transform={`translate(${x - 8},${y - 52})`}><rect width={16} height={3} rx={1.5} fill="rgba(0,0,0,0.25)" /><rect width={16 * (1 - waitK)} height={3} rx={1.5} fill={waitK > 0.66 ? '#ef4444' : waitK > 0.33 ? '#f59e0b' : '#22c55e'} /></g>}
            </g>
          )
        })}

        {/* Billets à encaisser, pannes, ménage, files d'attente */}
        {rooms.map((r) => {
          const d = ROOMS[r.type]
          const y0 = baseY(r.floor) - FH
          const out: ReactElement[] = []
          if (d.kind === 'work') {
            r.broken.forEach((_b, i) => {
              const cx = X0 + deskX(r, i) + 4
              if (r.broken[i]) {
                // L'incident reste affiché jusqu'à la fin de l'intervention : en attente, technicien en route, réparation.
                const tech = w.agents.find((a) => a.role === 'tech' && a.task === `${r.id}:${i}`)
                const s0 = tech?.steps[0]
                const fixing = s0 && s0.t === 'fix' ? s0 : null
                if (!tech) out.push(
                  <g key={`x${i}`} transform={`translate(${cx + 4},${y0 + 46})`} onClick={(e) => { e.stopPropagation(); useCorp.getState().fixDesk(r.id, i) }} style={{ cursor: 'pointer' }}>
                    <g className="incident"><circle r={8} fill="#e63946" stroke="#fff" strokeWidth={2} /><text y={1} fontSize={8} textAnchor="middle" dominantBaseline="middle">🔧</text></g>
                  </g>,
                )
                else if (!fixing) out.push(
                  <g key={`x${i}`} transform={`translate(${cx + 4},${y0 + 46})`} pointerEvents="none">
                    <circle r={8.5} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
                    <text y={1} fontSize={8} textAnchor="middle" dominantBaseline="middle">🔧</text>
                    <g transform="translate(0,-15)"><rect x={-25} y={-5.5} width={50} height={11} rx={5.5} fill="#92400e" /><text y={0.5} fontSize={6} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight={900}>Tech en route</text></g>
                  </g>,
                )
                else {
                  const k = Math.max(0, Math.min(1, 1 - fixing.dur / (fixing.total ?? 3.2)))
                  const C = 2 * Math.PI * 8
                  out.push(
                    <g key={`x${i}`} transform={`translate(${cx + 4},${y0 + 46})`} pointerEvents="none">
                      <circle r={8.5} fill="#2563eb" stroke="#fff" strokeWidth={2} />
                      <circle r={8} fill="none" stroke="#bfdbfe" strokeWidth={2.2} />
                      <circle r={8} fill="none" stroke="#22c55e" strokeWidth={2.2} strokeDasharray={`${C * k} ${C}`} transform="rotate(-90)" strokeLinecap="round" />
                      <text y={1} fontSize={7.5} textAnchor="middle" dominantBaseline="middle">🔧</text>
                      <g transform="translate(0,-15)"><rect x={-27} y={-5.5} width={54} height={11} rx={5.5} fill="#1e3a8a" /><text y={0.5} fontSize={6} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight={900}>Réparation {Math.round(k * 100)} %</text></g>
                    </g>,
                  )
                }
              }
            })
          }
          const cleaning = w.agents.some((a) => a.role === 'janitor' && r.trash.some((t) => t.id === a.task))
          if (r.trash.length >= 4 && !cleaning && !g.rooms.some((x) => x.type === 'menage')) {
            out.push(
              <g key="dirt" transform={`translate(${X0 + slotX(r.slot) + 12},${y0 + 14})`} onClick={(e) => { e.stopPropagation(); useCorp.getState().clean(r.id) }} style={{ cursor: 'pointer' }}>
                <g className="incident"><circle r={9} fill="#a16207" stroke="#fff" strokeWidth={2} /><text y={1} fontSize={9} textAnchor="middle" dominantBaseline="middle">🧹</text></g>
              </g>,
            )
          }
          const qn = d.kind === 'facility' ? (w.queues[r.id]?.length ?? 0) : 0
          if (qn > 0) {
            const busy = stationsOf(w, r).filter((s) => s.agentId).length
            out.push(
              <g key="q" transform={`translate(${X0 + slotX(r.slot) + d.w * SW - 52},${y0 - 12})`} pointerEvents="none">
                <rect width={70} height={14} rx={7} fill={qn >= 3 ? '#ef4444' : '#f59e0b'} />
                <text x={35} y={7.5} fontSize={7.5} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight={900}>⏳ {qn} en attente · {busy}/{stationCount(r)}</text>
              </g>,
            )
          }
          return <g key={`o${r.id}`}>{out}</g>
        })}

        {/* L'argent qui rentre tout seul : « +40 € » qui s'envole de chaque poste */}
        {w.pops.map((q) => {
          const k = q.t / 1.4
          return (
            <g key={q.id} transform={`translate(${X0 + q.x + 4},${baseY(q.floor) - FH + 30 - k * 22})`} opacity={k < 0.15 ? k / 0.15 : 1 - Math.max(0, k - 0.6) / 0.4} pointerEvents="none">
              <text x={0} y={0} fontSize={8.5} textAnchor="middle" fontWeight={900} fill="#16a34a" stroke="#fff" strokeWidth={2.2} paintOrder="stroke" fontFamily="Baloo 2, system-ui">+{fmtShort(q.amount)} €</text>
            </g>
          )
        })}

        {/* Ascenseurs : installer / prolonger */}
        {defs.map((d) => {
          const sx = X0 + d.x0 + SHAFT_W / 2
          const btns: ReactElement[] = []
          const icon = d.id === 'X' ? '⚡' : '🛗'
          const tag = (key: string, f: number, l1: string, l2: string, cost: number, onClick: (() => void) | null) => {
            const ok = !!onClick && g.cash >= cost
            btns.push(
              <g key={key} transform={`translate(${sx},${baseY(f) - FH / 2 - 4})`} onClick={onClick ? (e) => { e.stopPropagation(); onClick() } : undefined} style={{ cursor: onClick ? 'pointer' : 'default' }}>
                <g className={ok ? 'incident' : undefined}>
                  <rect x={-21} y={-26} width={42} height={52} rx={9} fill={ok ? (d.id === 'X' ? '#dc2626' : '#f2792b') : '#94a3b8'} stroke="#fff" strokeWidth={2} opacity={onClick ? 1 : 0.85} />
                  <text x={0} y={-12} fontSize={13} textAnchor="middle" dominantBaseline="middle">{onClick ? icon : '🔒'}</text>
                  <text x={0} y={4} fontSize={l1.length > 9 ? 5.2 : 6.3} fill="#fff" textAnchor="middle" fontWeight={900}>{l1}</text>
                  <text x={0} y={15} fontSize={l2.length > 9 ? 5.6 : 7.5} fill="#fff" textAnchor="middle" fontWeight={900}>{l2}</text>
                </g>
              </g>,
            )
          }
          const f0 = Math.min(1, g.top)
          if (!d.on) {
            if (liftUnlocked(g, d.id)) tag(`i${d.id}`, f0, d.id === 'A' ? 'Installer' : d.id === 'B' ? 'Ascenseur 2' : 'Express', `${fmtShort(liftInstallPrice(g, d.id))} €`, liftInstallPrice(g, d.id), () => useCorp.getState().installLift(d.id))
            else tag(`l${d.id}`, f0, d.id === 'B' ? 'Ascenseur 2' : 'Express', d.id === 'B' ? '3 étages' : 'Recherche', 0, null)
          } else {
            if (d.top < g.top) tag(`u${d.id}`, d.top + 1, 'Prolonger', `${fmtShort(liftExtendPrice(d.id, d.top + 1))} €`, liftExtendPrice(d.id, d.top + 1), () => useCorp.getState().extendLift(true, d.id))
            if (d.bottom > g.bottom) tag(`d${d.id}`, d.bottom - 1, 'Prolonger', `${fmtShort(liftExtendPrice(d.id, d.bottom - 1))} €`, liftExtendPrice(d.id, d.bottom - 1), () => useCorp.getState().extendLift(false, d.id))
          }
          return <g key={`tags${d.id}`}>{btns}</g>
        })}

        {/* Cibles de construction */}
        {targets.map((t) => {
          const d = ROOMS[buildType as RoomType]
          const on = target && target.floor === t.floor && target.slot === t.slot
          return (
            <g key={`t${t.floor},${t.slot}`} onClick={() => {
              const s = useCorp.getState()
              if (on) s.confirmBuild(); else s.setTarget(t)
            }} style={{ cursor: 'pointer' }}>
              <rect x={X0 + slotX(t.slot) + 3} y={baseY(t.floor) - FH + 3} width={d.w * SW - 6} height={FH - 14} rx={4}
                fill={on ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.18)'} stroke={on ? '#34d399' : '#fff'} strokeWidth={on ? 3 : 2} strokeDasharray={on ? undefined : '6 5'} className={on ? undefined : 'target-pulse'} />
              {on && <text x={X0 + slotX(t.slot) + d.w * SW / 2} y={baseY(t.floor) - FH / 2} fontSize={24} textAnchor="middle" dominantBaseline="middle">{d.emoji}</text>}
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
          <FloorButton x={X0 + SHAFT_X0 / 2} y={baseY(g.top) - FH - 40} label="Étage" cost={floorCost(g.top + 1)} cash={g.cash} onClick={() => useCorp.getState().buildFloor(true)} />
        </g>
        <FloorButton x={X0 + SHAFT_X0 / 2} y={baseY(g.bottom) + 34} label="Sous-sol" cost={floorCost(g.bottom - 1)} cash={g.cash} onClick={() => useCorp.getState().buildFloor(false)} />

        {/* Porte d'entrée */}
        <rect x={X0 - 6} y={groundBase - 52} width={6} height={44} fill="#5b3a29" />

        <defs>
          <linearGradient id="brass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a16207" /><stop offset="50%" stopColor="#fde68a" /><stop offset="100%" stopColor="#a16207" />
          </linearGradient>
          <radialGradient id="coinGrad" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#fff6c4" /><stop offset="40%" stopColor="#ffd34d" /><stop offset="100%" stopColor="#d18a0d" />
          </radialGradient>
          <linearGradient id="tunnel" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#3a2e24" /><stop offset="100%" stopColor="#0b0806" />
          </linearGradient>
          <linearGradient id="tunnel" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#3a2e24" /><stop offset="100%" stopColor="#0b0806" />
          </linearGradient>
          <linearGradient id="roomShade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity={0.16} /><stop offset="18%" stopColor="#000" stopOpacity={0} />
            <stop offset="88%" stopColor="#000" stopOpacity={0} /><stop offset="100%" stopColor="#000" stopOpacity={0.1} />
          </linearGradient>
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
    <div className="absolute right-2.5 bottom-[200px] z-20 flex flex-col gap-1.5">
      <button aria-label="Zoomer" onClick={() => setZoom(zoom * 1.3)} disabled={zoom >= 2.6}
        className="w-10 h-10 rounded-2xl bg-white/90 backdrop-blur shadow-lg text-slate-700 font-extrabold text-[20px] leading-none disabled:opacity-40 active:scale-90">+</button>
      <button aria-label="Dézoomer" onClick={() => setZoom(zoom / 1.3)} disabled={zoom <= 1}
        className="w-10 h-10 rounded-2xl bg-white/90 backdrop-blur shadow-lg text-slate-700 font-extrabold text-[22px] leading-none disabled:opacity-40 active:scale-90">−</button>
    </div>
    </>
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
