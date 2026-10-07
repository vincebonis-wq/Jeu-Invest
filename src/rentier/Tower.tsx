/**
 * RENTIER INC. — l'immeuble en coupe (SVG), ses habitants et l'ascenseur.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { useRentier } from './store'
import {
  canPlace, monthlyRent, shaftX, EXIT_X, stationCount, stationX, stationsOf, PATIENCE, dirtOf, DOOR_X, stairX, stairServed, desksOf, deskX,
  type Agent, type Game, type Room, type Station,
} from './sim'
import { ROOMS, SLOTS, SW, SHAFT_W, FH, BW, STAFF, floorCost, liftInstallCost, liftExtendCost, type RoomType } from './data'
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
function shade(hex: string, k = 0.75) {
  const m = hex.match(/^#(\w\w)(\w\w)(\w\w)$/)
  if (!m) return hex
  return `rgb(${m.slice(1).map((h) => Math.min(255, Math.round(parseInt(h, 16) * k))).join(',')})`
}

function Person({ a, x, y, small }: { a: Agent; x: number; y: number; small?: boolean }) {
  const s = small ? 0.85 : 1
  return (
    <g transform={`translate(${x},${y}) scale(${a.dir * s},${s})`}>
      <ellipse cx={0} cy={0} rx={6} ry={1.8} fill="rgba(0,0,0,0.18)" />
      {/* bras arrière */}
      <g className={a.walking ? 'walk-r' : undefined}><rect x={-1.2} y={-18} width={2.4} height={8.5} rx={1.2} fill={shade(a.cloth)} /></g>
      <g className={a.walking ? 'walk-l' : undefined}><rect x={-3.2} y={-9} width={2.6} height={9} rx={1.2} fill="#2d3142" /><rect x={-3.6} y={-1.4} width={3.6} height={1.6} rx={0.8} fill="#1b1e2b" /></g>
      <g className={a.walking ? 'walk-r' : undefined}><rect x={0.6} y={-9} width={2.6} height={9} rx={1.2} fill="#3b4058" /><rect x={0.6} y={-1.4} width={3.8} height={1.6} rx={0.8} fill="#1b1e2b" /></g>
      <rect x={-4.6} y={-19} width={9.2} height={11} rx={3.2} fill={a.cloth} stroke="rgba(0,0,0,0.35)" strokeWidth={0.5} />
      <rect x={-4.6} y={-19} width={3} height={11} rx={1.5} fill="rgba(255,255,255,0.18)" />
      {a.role === 'researcher' && <><rect x={-4.8} y={-19} width={9.6} height={14} rx={3} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={0.5} /><rect x={-0.5} y={-18} width={1} height={12} fill="#93c5fd" /></>}
      {/* bras avant */}
      <g className={a.walking ? 'walk-l' : undefined}><rect x={-0.6} y={-18} width={2.4} height={8.5} rx={1.2} fill={a.role === 'researcher' ? '#e2e8f0' : a.cloth} stroke="rgba(0,0,0,0.12)" strokeWidth={0.4} /><circle cx={0.6} cy={-9.6} r={1.3} fill={a.skin} /></g>
      <circle cx={0} cy={-23.5} r={4.6} fill={a.skin} stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
      {a.role === 'researcher' && <g><circle cx={2.4} cy={-23.4} r={1.6} fill="none" stroke="#1e293b" strokeWidth={0.6} /><line x1={-1} y1={-23.6} x2={0.8} y2={-23.6} stroke="#1e293b" strokeWidth={0.5} /></g>}
      <path d="M-4.7,-24 A4.8,4.8 0 0 1 4.7,-24 L4.7,-25.5 A4.8,4.8 0 0 0 -4.7,-25.5 Z" fill={a.hair} />
      <path d={`M-4.8,-24.5 A4.8,4.8 0 0 1 4.8,-24.5 Q2,-27 -4.8,-24.5`} fill={a.hair} />
      <circle cx={2} cy={-23.4} r={0.7} fill="#222" />
      {a.carry === 'suitcase' && <g><rect x={5} y={-11} width={6} height={8} rx={1.5} fill="#c0392b" /><rect x={6.8} y={-13} width={2.4} height={2.4} rx={0.8} fill="none" stroke="#7f2318" strokeWidth={0.8} /></g>}
      {a.carry === 'wrench' && <rect x={4.5} y={-17} width={2} height={9} rx={1} fill="#9aa5b1" transform="rotate(20,5,-12)" />}
      {a.carry === 'bag' && <rect x={4.4} y={-14} width={5} height={6} rx={1} fill="#6d4c41" />}
      {a.carry === 'basket' && <g><rect x={3.5} y={-15} width={9} height={7} rx={2} fill="#d4a373" stroke="#a0703f" strokeWidth={0.7} /><rect x={4.5} y={-17} width={7} height={3} rx={1.5} fill="#90caf9" /></g>}
      {a.carry === 'mop' && (
        <g className={a.steps[0]?.t === 'clean' ? 'mop-swing' : undefined}>
          <rect x={4.6} y={-18} width={1.6} height={18} rx={0.8} fill="#a1887f" />
          <rect x={1.5} y={-1.5} width={8} height={2.6} rx={1.2} fill="#e0f2fe" stroke="#7dd3fc" strokeWidth={0.6} />
        </g>
      )}
      {a.carry === 'sack' && <g><circle cx={-7} cy={-15} r={5} fill="#8d6e63" /><rect x={-8.5} y={-21} width={3} height={3} rx={1} fill="#6d4c41" /><text x={-7} y={-14} fontSize={5} textAnchor="middle" dominantBaseline="middle" fill="#ffd34d" fontWeight={900}>€</text></g>}
      {a.kind === 'staff' && a.role && <rect x={-5} y={-28.5} width={10} height={2.6} rx={1} fill={STAFF[a.role].cap} />}
      {a.kind === 'staff' && a.role === 'guard' && <circle cx={2} cy={-16} r={1.4} fill="#facc15" />}
      {a.kind === 'staff' && a.role === 'janitor' && <rect x={-4.6} y={-13} width={9.2} height={1.6} fill="#facc15" />}
      {a.kind === 'thief' && <g><path d="M-5.6,-22 A5.6,5.8 0 0 1 5.6,-22 L5.6,-19.5 L-5.6,-19.5 Z" fill="#14141c" /><rect x={-3} y={-25} width={7} height={2.4} rx={1} fill="#14141c" /><circle cx={2} cy={-23.8} r={0.8} fill="#fff" /></g>}
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

export function Interior({ r, w, night, skyCol, home, st, desks }: { r: Room; w: number; night: number; skyCol: string; home: boolean; g: Game; st?: Station[]; desks?: (string | null)[] }): ReactElement {
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
    case 'menage':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#b0bec5" />
          <rect x={6} y={14} width={34} height={2.5} fill="#90a4ae" />
          <rect x={6} y={30} width={34} height={2.5} fill="#90a4ae" />
          {[9, 17, 25, 33].map((kx, i) => <rect key={kx} x={kx} y={6 + (i % 2)} width={5} height={8 - (i % 2)} rx={1.5} fill={['#4dd0e1', '#ffb74d', '#81c784', '#f06292'][i]} />)}
          {[9, 19, 29].map((kx, i) => <rect key={kx} x={kx} y={22} width={7} height={8} rx={1} fill={['#fff59d', '#b3e5fc', '#ffccbc'][i]} />)}
          <rect x={w - 20} y={fl - 30} width={1.6} height={30} fill="#a1887f" transform={`rotate(-8,${w - 20},${fl})`} />
          <rect x={w - 14} y={fl - 28} width={1.6} height={28} fill="#a1887f" transform={`rotate(6,${w - 14},${fl})`} />
          <path d={`M${w - 30},${fl - 10} L${w - 18},${fl - 10} L${w - 20},${fl} L${w - 28},${fl} Z`} fill="#1e88e5" />
          <rect x={8} y={fl - 18} width={14} height={18} rx={1} fill="#78909c" />
          <rect x={14.5} y={fl - 12} width={1} height={4} fill="#cfd8dc" />
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
              <rect x={12 + (i % 2) * 24} y={16 + Math.floor(i / 2) * 17 - (i % 3)} width={6} height={4} fill="#a5d6a7" opacity={0.6} />
            </g>
          ))}
          {blink && <circle cx={w - 10} cy={12} r={2.2} fill="#ef4444" />}
          <rect x={6} y={fl - 14} width={w - 12} height={4} rx={1} fill="#37474f" />
          <rect x={10} y={fl - 10} width={3} height={10} fill="#263238" /><rect x={w - 13} y={fl - 10} width={3} height={10} fill="#263238" />
        </g>
      )
    }
    case 'labo':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#cbd5e1" />
          <rect x={6} y={8} width={28} height={18} rx={1.5} fill="#fff" stroke="#94a3b8" />
          <path d="M9,21 L14,15 L19,18 L25,11 L31,13" stroke="#6366f1" strokeWidth={1.2} fill="none" />
          <text x={20} y={13} fontSize={4.5} fill="#ef4444" textAnchor="middle" fontWeight={900}>E=mc²</text>
          <rect x={w - 22} y={10} width={14} height={20} rx={1} fill="#e0e7ff" stroke="#a5b4fc" />
          {[0, 1, 2].map((i) => <rect key={i} x={w - 20 + i * 4} y={14 + (i % 2) * 2} width={2.5} height={10 - (i % 2) * 2} rx={1} fill={['#34d399', '#f472b6', '#60a5fa'][i]} />)}
          <rect x={4} y={fl - 13} width={w - 8} height={3} rx={1} fill="#64748b" />
          <rect x={6} y={fl - 10} width={2.5} height={10} fill="#475569" /><rect x={w - 8.5} y={fl - 10} width={2.5} height={10} fill="#475569" />
          {Array.from({ length: Math.max(1, r.level) }, (_, i) => <g key={i}><rect x={10 + i * 14} y={fl - 22} width={10} height={8} rx={1} fill="#1e293b" /><rect x={11} y={fl - 21} width={8} height={6} fill={night < 0.5 ? '#7dd3fc' : '#334155'} transform={`translate(${i * 14},0)`} /></g>)}
          <path d={`M${w - 30},${fl - 13} l3,-8 h3 l3,8 z`} fill="#86efac" opacity={0.85} />
        </g>
      )
    case 'bureau':
      return (
        <g>
          <rect x={0} y={fl} width={w} height={6} fill="#94a3b8" />
          {Array.from({ length: 6 }, (_, i) => <rect key={i} x={i * 22} y={fl} width={11} height={6} fill="#8492a6" />)}
          <Window x={10} y={10} w={24} h={22} skyCol={skyCol} lit={false} />
          <Window x={w - 34} y={10} w={24} h={22} skyCol={skyCol} lit={false} />
          <rect x={w / 2 - 14} y={12} width={28} height={12} rx={2} fill="#0f172a" />
          <text x={w / 2} y={19.5} fontSize={5.5} fill="#38bdf8" textAnchor="middle" fontWeight={900}>START·UP</text>
          {Array.from({ length: ROOMS.bureau.capacity ?? 4 }, (_, i) => {
            const cx = deskX(r, i) - r.slot * SW
            const on = !!desks?.[i]
            return (
              <g key={i}>
                <rect x={cx - 12} y={fl - 13} width={18} height={2.5} rx={1} fill="#e2e8f0" />
                <rect x={cx - 11} y={fl - 10.5} width={1.6} height={10.5} fill="#64748b" /><rect x={cx + 3.5} y={fl - 10.5} width={1.6} height={10.5} fill="#64748b" />
                <rect x={cx - 9} y={fl - 21} width={10} height={7} rx={1} fill="#1e293b" />
                <rect x={cx - 8} y={fl - 20} width={8} height={5} fill={on ? '#60a5fa' : '#334155'} />
                <rect x={cx - 5} y={fl - 14} width={2} height={1.5} fill="#1e293b" />
              </g>
            )
          })}
          <circle cx={w - 8} cy={fl - 14} r={5} fill="#22c55e" /><rect x={w - 10} y={fl - 9} width={4} height={9} rx={1} fill="#b45309" />
        </g>
      )
    default:
      return <g />
  }
}

/** Saleté visible et progressive : traces de pas, taches, papiers, sac poubelle, mouches, odeur. */
function Dirt({ w, fl, d }: { w: number; fl: number; d: number }) {
  if (d < 6) return null
  const k = Math.min(1, d / 80)
  return (
    <g pointerEvents="none">
      {/* traces de pas */}
      {Array.from({ length: Math.min(6, Math.floor(d / 6)) }, (_, i) => <ellipse key={`f${i}`} cx={8 + ((i * 23) % (w - 16))} cy={fl + 2 + (i % 2)} rx={2.2} ry={0.9} fill="#5b4632" opacity={0.35 + 0.3 * k} />)}
      {[0.22, 0.55, 0.8].map((fx, i) => (d > 18 + i * 14) && <ellipse key={i} cx={w * fx} cy={fl + 1.5} rx={6 + i * 2} ry={1.8} fill="#6b4f2a" opacity={0.25 + 0.35 * k} />)}
      {/* papiers froissés, canette */}
      {d > 28 && <g><circle cx={w * 0.4} cy={fl - 1.5} r={1.8} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={0.4} /><rect x={w * 0.65} y={fl - 3} width={2} height={3} rx={0.5} fill="#ef4444" transform={`rotate(70,${w * 0.65},${fl - 2})`} /></g>}
      {d > 40 && <g transform={`translate(${w - 14},${fl - 9})`}><path d="M-6,9 Q-7,0 0,-1 Q7,0 6,9 Z" fill="#2e3b2c" /><path d="M-2,-1 L0,-5 L2,-1 Z" fill="#2e3b2c" /></g>}
      {d > 52 && <circle cx={w * 0.15} cy={fl - 1.6} r={2.2} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={0.4} />}
      {d > 60 && [0, 1, 2].map((i) => <circle key={i} cx={w - 14 + Math.sin(Date.now() / 260 + i * 2) * 7} cy={fl - 18 + Math.cos(Date.now() / 210 + i) * 4} r={0.9} fill="#111" />)}
      {d > 72 && <path d={`M${w * 0.3},${fl - 10} q3,-4 0,-8 q-3,-4 0,-8`} stroke="#7cb342" strokeWidth={1.2} fill="none" opacity={0.7} />}
      {d > 30 && <rect x={0} y={0} width={w} height={fl} fill="#7a5c2e" opacity={Math.min(0.12, (d - 30) / 400)} />}
    </g>
  )
}

function lightOn(r: Room, home: boolean, p: number) {
  const k = ROOMS[r.type].kind
  if (k === 'home') return home
  if (k === 'shop') return p > 0.26 && p < 0.92
  if (k === 'office') return p > 0.3 && p < 0.7
  return true
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
                  <rect x={X0 + s * SW} y={y0} width={SW} height={FH - 8} fill={f < 0 ? '#5d5f63' : '#c7c2bb'} />
                  <rect x={X0 + s * SW} y={y0} width={SW} height={FH - 8} fill="url(#brick)" opacity={0.5} />
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
                {d.kind !== 'parking' && r.type !== 'bar' && (
                  <g pointerEvents="none">
                    <rect x={0} y={FH - 34} width={wpx} height={20} fill={shade(d.wall, 0.9)} />
                    <rect x={0} y={FH - 35.5} width={wpx} height={1.5} fill={shade(d.wall, 1.08)} />
                  </g>
                )}
                <Interior r={r} w={wpx} night={sk.night} skyCol={sk.bot} home={home} g={g} st={ROOMS[r.type].kind === 'shop' ? stationsOf(w, r) : undefined} desks={r.type === 'bureau' ? desksOf(w, r) : undefined} />
                <rect x={0} y={0} width={wpx} height={FH - 8} fill="url(#roomShade)" pointerEvents="none" />
                {/* Plafond, plafonniers et lumière */}
                <g pointerEvents="none">
                  <rect x={0} y={0} width={wpx} height={4} fill={shade(d.wall, 0.7)} />
                  {Array.from({ length: d.w }, (_, i) => {
                    const lx = (i + 0.5) * SW
                    const on = lightOn(r, home, p)
                    return (
                      <g key={i}>
                        <rect x={lx - 7} y={4} width={14} height={2} rx={1} fill={on ? '#fffbe6' : '#9aa1ab'} />
                        {on && sk.night > 0.35 && <path d={`M${lx - 6},6 L${lx + 6},6 L${lx + 26},${FH - 14} L${lx - 26},${FH - 14} Z`} fill="#fff4c2" opacity={0.13} />}
                      </g>
                    )
                  })}
                  <rect x={0} y={FH - 14} width={wpx} height={1} fill="rgba(255,255,255,0.35)" />
                </g>
                <Dirt w={wpx} fl={FH - 14} d={dirtOf(r)} />
                {dark && <rect x={0} y={0} width={wpx} height={FH - 8} fill="#0b1028" opacity={0.35} />}
                <rect x={-1} y={0} width={3} height={FH - 8} fill="#5a4c42" />
                <rect x={wpx - 2} y={0} width={3} height={FH - 8} fill="#5a4c42" />
                {vacant && <g><rect x={wpx / 2 - 22} y={22} width={44} height={14} rx={3} fill="#e63946" /><text x={wpx / 2} y={31.5} fontSize={8} fill="#fff" textAnchor="middle" fontWeight={900}>À LOUER</text></g>}
              </g>
              {selected === r.id && <rect x={1.5} y={1.5} width={wpx - 3} height={FH - 11} fill="none" stroke="#fff" strokeWidth={3} rx={2} className="sel-pulse" />}
            </g>
          )
        })}

        {/* Cage : ascenseur là où il dessert, escalier ailleurs */}
        <rect x={X0 + SLOTS * SW} y={baseY(g.top) - FH} width={SHAFT_W} height={(g.top - g.bottom + 1) * FH} fill="#3d4450" />
        {floors.map((f) => {
          const served = g.liftOn && f >= g.liftBottom && f <= g.liftTop
          const sx = X0 + SLOTS * SW
          const yb = baseY(f)
          return (
            <g key={`sd${f}`}>
              {served ? (
                <rect x={sx + 4} y={yb - FH + 12} width={SHAFT_W - 8} height={FH - 20} fill="#1f242c" />
              ) : (
                <g>
                  <rect x={sx} y={yb - FH} width={SHAFT_W} height={FH} fill="#59606b" />
                  <rect x={sx} y={yb - FH} width={SHAFT_W} height={FH} fill="url(#brick)" opacity={0.35} />
                  {f < g.top && !stairServed(g, f) && (() => {
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
        {g.liftOn && (() => {
          const sx = X0 + SLOTS * SW
          const topY = baseY(g.liftTop) - FH
          const here = Math.abs(w.lift.y - Math.round(w.lift.y)) < 0.01 ? Math.round(w.lift.y) : null
          return (
            <g>
              <line x1={sx + SHAFT_W / 2} y1={topY} x2={sx + SHAFT_W / 2} y2={liftY - FH + 12} stroke="#888" strokeWidth={1} />
              <g transform={`translate(${sx + 4},${liftY - FH + 12})`}>
                <rect x={0} y={0} width={SHAFT_W - 8} height={FH - 20} rx={2} fill="#c9a227" />
                <rect x={2.5} y={2.5} width={SHAFT_W - 13} height={FH - 25} rx={1.5} fill="#f6e7b0" />
                <rect x={8} y={4} width={SHAFT_W - 24} height={3} rx={1.5} fill="#fff7d6" />
                <rect x={2.5} y={FH - 32} width={SHAFT_W - 13} height={2} fill="#d8c27a" />
              </g>
              {w.lift.riders.map((id, i) => {
                const a = w.agents.find((x) => x.id === id)
                if (!a) return null
                return <Person key={id} a={a} x={sx + 11 + (i % 4) * 7} y={liftY - 9} small />
              })}
              {/* Portes vitrées à chaque palier */}
              {floors.filter((f) => f >= g.liftBottom && f <= g.liftTop).map((f) => {
                const open = here === f ? w.lift.door : 0
                const y0 = baseY(f) - FH + 12, hh = FH - 20, half = (SHAFT_W - 8) / 2
                const pw = half * (1 - open * 0.92)
                const waiting = (w.lift.waiting.get(f)?.length ?? 0) > 0
                return (
                  <g key={`door${f}`} pointerEvents="none">
                    <rect x={sx + 4} y={y0} width={pw} height={hh} fill="#bfe3f5" opacity={0.42} stroke="#8fa3b5" strokeWidth={0.8} />
                    <rect x={sx + 4 + 2 * half - pw} y={y0} width={pw} height={hh} fill="#bfe3f5" opacity={0.42} stroke="#8fa3b5" strokeWidth={0.8} />
                    <rect x={sx + 2} y={y0 - 2} width={SHAFT_W - 4} height={hh + 2} fill="none" stroke="#9aa5b1" strokeWidth={2} />
                    <rect x={sx + SHAFT_W / 2 - 7} y={y0 - 10} width={14} height={7} rx={2} fill="#111827" />
                    <text x={sx + SHAFT_W / 2} y={y0 - 6.2} fontSize={5.5} textAnchor="middle" dominantBaseline="middle" fill={here === f ? '#fbbf24' : '#4b5563'} fontWeight={900}>{f === 0 ? 'RDC' : f < 0 ? `S${-f}` : f}</text>
                    <circle cx={sx - 3} cy={baseY(f) - FH / 2} r={2.2} fill={waiting ? '#fbbf24' : '#4b5563'} stroke="#1f2937" strokeWidth={0.6} />
                  </g>
                )
              })}
            </g>
          )
        })()}

        {/* Voitures des locataires & tunnel du garage */}
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
        {w.agents.filter((a) => !a.inLift && !a.away).map((a) => {
          const y = baseY(a.floor) - 9
          let x = X0 + a.x
          const s0 = a.steps[0]
          if (s0 && s0.t === 'lift') {
            // Les gens attendent l'ascenseur en file, sans se superposer.
            const q = w.lift.waiting.get(a.floor) ?? []
            const i = Math.max(0, q.indexOf(a.id))
            x = X0 + DOOR_X - i * 8
          }
          const waitK = s0 && s0.t === 'queue' ? Math.min(1, a.waitT / (a.kind === 'res' ? PATIENCE.res : PATIENCE.vis)) : null
          return (
            <g key={a.id} pointerEvents={a.kind === 'thief' && !a.caught ? undefined : 'none'}
              onClick={a.kind === 'thief' ? (e) => { e.stopPropagation(); useRentier.getState().scare(a.id) } : undefined}
              style={a.kind === 'thief' ? { cursor: 'pointer' } : undefined}>
              {a.kind === 'thief' && !a.caught && <circle cx={x} cy={y - 14} r={16} fill="rgba(239,68,68,0.18)" stroke="#ef4444" strokeWidth={1.2} strokeDasharray="3 3" className="incident" />}
              {a.steps[0]?.t === 'clean' && (
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

        {/* Incidents & bulles de loyers */}
        {rooms.map((r) => {
          const d = ROOMS[r.type]
          const x = X0 + r.slot * SW + d.w * SW / 2
          const y0 = baseY(r.floor) - FH
          const out: ReactElement[] = []
          if (r.incident) {
            out.push(
              <g key="inc" transform={`translate(${x + d.w * SW / 2 - 16},${y0 + 40})`} onClick={(e) => { e.stopPropagation(); useRentier.getState().repair(r.id) }} style={{ cursor: 'pointer' }}>
                <g className="incident">
                  <circle r={11} fill="#e63946" stroke="#fff" strokeWidth={2.5} />
                  <text y={1} fontSize={11} textAnchor="middle" dominantBaseline="middle">{r.incident.kind === 'fuite' ? '💧' : '⚡'}</text>
                </g>
              </g>,
            )
          }
          const cleaning = w.agents.some((a) => a.kind === 'staff' && a.task === r.id)
          if (dirtOf(r) >= 45 && !cleaning) {
            out.push(
              <g key="dirt" transform={`translate(${X0 + r.slot * SW + 14},${y0 + 40})`} onClick={(e) => { e.stopPropagation(); useRentier.getState().clean(r.id) }} style={{ cursor: 'pointer' }}>
                <g className="incident">
                  <circle r={10} fill="#a16207" stroke="#fff" strokeWidth={2.5} />
                  <text y={1} fontSize={10} textAnchor="middle" dominantBaseline="middle">🧹</text>
                </g>
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

        {/* Ascenseur : installer / prolonger */}
        {(() => {
          const sx = X0 + SLOTS * SW + SHAFT_W / 2
          const btns: ReactElement[] = []
          const tag = (key: string, f: number, l1: string, l2: string, cost: number, onClick: () => void) => {
            const ok = g.cash >= cost
            btns.push(
              <g key={key} transform={`translate(${sx},${baseY(f) - FH / 2 - 4})`} onClick={(e) => { e.stopPropagation(); onClick() }} style={{ cursor: 'pointer' }}>
                <g className={ok ? 'incident' : undefined}>
                  <rect x={-21} y={-26} width={42} height={52} rx={9} fill={ok ? '#f2792b' : '#94a3b8'} stroke="#fff" strokeWidth={2} />
                  <text x={0} y={-12} fontSize={13} textAnchor="middle" dominantBaseline="middle">🛗</text>
                  <text x={0} y={4} fontSize={l1.length > 9 ? 5.6 : 6.5} fill="#fff" textAnchor="middle" fontWeight={900}>{l1}</text>
                  <text x={0} y={15} fontSize={7.5} fill="#fff" textAnchor="middle" fontWeight={900}>{l2}</text>
                </g>
              </g>,
            )
          }
          if (!g.liftOn) tag('inst', Math.min(1, g.top), 'Installer', `${fmtShort(liftInstallCost(g.top - g.bottom))} €`, liftInstallCost(g.top - g.bottom), () => useRentier.getState().installLift())
          else {
            if (g.liftTop < g.top) tag('up', g.liftTop + 1, 'Prolonger', `${fmtShort(liftExtendCost(g.liftTop + 1))} €`, liftExtendCost(g.liftTop + 1), () => useRentier.getState().extendLift(true))
            if (g.liftBottom > g.bottom) tag('dn', g.liftBottom - 1, 'Prolonger', `${fmtShort(liftExtendCost(g.liftBottom - 1))} €`, liftExtendCost(g.liftBottom - 1), () => useRentier.getState().extendLift(false))
          }
          return btns
        })()}

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
