/**
 * ARCHIPEL — dessin isométrique procédural (SVG).
 *
 * Repère : origine = centre du dessus de la case. x le long de l'axe q
 * (vers bas-droite), y le long de l'axe r (vers bas-gauche), z vers le haut (px).
 * Une case fait 1 × 1 unité ; ses bords sont à ±0,5.
 */

import type { ReactElement } from 'react'
import type { BType } from './data'

export const TW = 112
export const TH = 56
export const DEPTH = 18
const QX = TW / 2
const QY = TH / 2

type P = [number, number]
export const pt = (x: number, y: number, z = 0): P => [(x - y) * QX, (x + y) * QY - z]
export const poly = (ps: P[]) => ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')

// ── Couleurs ─────────────────────────────────────────────────────────────────
function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function shade(h: string, amt: number) {
  const [r, g, b] = hexToRgb(h)
  const f = (c: number) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

// ── Primitives ───────────────────────────────────────────────────────────────
interface BoxOpts { cx?: number; cy?: number; a: number; b: number; z?: number; h: number; color: string; top?: string; stroke?: boolean }

/** Pavé isométrique : renvoie les 3 faces visibles + des helpers de façade. */
function box(o: BoxOpts) {
  const { cx = 0, cy = 0, a, b, z = 0, h, color } = o
  const c = (sx: number, sy: number, zz: number) => pt(cx + sx * a, cy + sy * b, zz)
  const z1 = z + h
  const el = (
    <>
      <polygon points={poly([c(1, -1, z), c(1, 1, z), c(1, 1, z1), c(1, -1, z1)])} fill={shade(color, -0.22)} />
      <polygon points={poly([c(-1, 1, z), c(1, 1, z), c(1, 1, z1), c(-1, 1, z1)])} fill={shade(color, -0.05)} />
      <polygon points={poly([c(-1, -1, z1), c(1, -1, z1), c(1, 1, z1), c(-1, 1, z1)])} fill={o.top ?? shade(color, 0.18)} />
      {o.stroke !== false && (
        <polyline points={poly([c(-1, 1, z1), c(1, 1, z1), c(1, -1, z1)])} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.8} />
      )}
    </>
  )
  /** Rectangle sur la façade droite (+q). u ∈ [-1,1] le long de y, zz en px. */
  const onRight = (u1: number, u2: number, z1_: number, z2_: number) =>
    poly([c(1, u1, z1_), c(1, u2, z1_), c(1, u2, z2_), c(1, u1, z2_)])
  /** Rectangle sur la façade gauche (+r). u ∈ [-1,1] le long de x. */
  const onLeft = (u1: number, u2: number, z1_: number, z2_: number) =>
    poly([c(u1, 1, z1_), c(u2, 1, z1_), c(u2, 1, z2_), c(u1, 1, z2_)])
  return { el, c, top: z1, onRight, onLeft }
}

/** Grille de fenêtres sur les deux façades. */
function windows(bx: ReturnType<typeof box>, z0: number, z1: number, rows: number, colsL: number, colsR: number, fill: string, lit = false) {
  const out: ReactElement[] = []
  const fh = (z1 - z0) / rows
  for (let i = 0; i < rows; i++) {
    const a = z0 + i * fh + fh * 0.28
    const b2 = z0 + i * fh + fh * 0.78
    for (let j = 0; j < colsL; j++) {
      const u1 = -1 + (2 / colsL) * (j + 0.22), u2 = -1 + (2 / colsL) * (j + 0.78)
      out.push(<polygon key={`l${i}-${j}`} points={bx.onLeft(u1, u2, a, b2)} fill={lit && (i + j) % 3 === 0 ? '#ffe9a8' : fill} />)
    }
    for (let j = 0; j < colsR; j++) {
      const u1 = -1 + (2 / colsR) * (j + 0.22), u2 = -1 + (2 / colsR) * (j + 0.78)
      out.push(<polygon key={`r${i}-${j}`} points={bx.onRight(u1, u2, a, b2)} fill={lit && (i + j) % 4 === 1 ? '#ffe9a8' : shade(fill, -0.12)} />)
    }
  }
  return out
}

/** Toit à deux pans, faîtage parallèle à l'axe r. */
function gable(cx: number, cy: number, a: number, b: number, z: number, rh: number, color: string) {
  const o = 1.12
  const c = (sx: number, sy: number, zz: number) => pt(cx + sx * a * o, cy + sy * b * o, zz)
  const ridge = (sy: number) => pt(cx, cy + sy * b * o, z + rh)
  return (
    <>
      <polygon points={poly([c(-1, 1, z), ridge(1), ridge(-1), c(-1, -1, z)])} fill={shade(color, 0.2)} />
      <polygon points={poly([c(1, -1, z), c(1, 1, z), ridge(1), ridge(-1)])} fill={shade(color, -0.12)} />
      <polygon points={poly([c(-1, 1, z), c(1, 1, z), ridge(1)])} fill={shade(color, 0.04)} />
      <line x1={ridge(1)[0]} y1={ridge(1)[1]} x2={ridge(-1)[0]} y2={ridge(-1)[1]} stroke={shade(color, 0.35)} strokeWidth={1.4} />
    </>
  )
}

function shadow(rx: number, ry = rx / 2) {
  return <ellipse cx={0} cy={4} rx={rx} ry={ry} fill="rgba(20,40,60,0.22)" />
}

function bush(x: number, y: number, r = 6, col = '#4caf50') {
  const [px, py] = pt(x, y, 0)
  return (
    <g>
      <ellipse cx={px} cy={py + 1} rx={r} ry={r / 2} fill="rgba(20,40,60,0.18)" />
      <circle cx={px} cy={py - r * 0.7} r={r} fill={col} />
      <circle cx={px - r * 0.3} cy={py - r} r={r * 0.45} fill={shade(col, 0.25)} />
    </g>
  )
}

export function tree(x: number, y: number, kind: number, s = 1) {
  const [px, py] = pt(x, y, 0)
  if (kind === 0) {
    // sapin
    return (
      <g>
        <ellipse cx={px} cy={py + 1} rx={8 * s} ry={4 * s} fill="rgba(20,40,60,0.2)" />
        <rect x={px - 1.5 * s} y={py - 6 * s} width={3 * s} height={7 * s} fill="#7a5230" />
        <polygon points={`${px},${py - 30 * s} ${px + 9 * s},${py - 8 * s} ${px - 9 * s},${py - 8 * s}`} fill="#2e8b57" />
        <polygon points={`${px},${py - 30 * s} ${px + 9 * s},${py - 8 * s} ${px},${py - 10 * s}`} fill="#256f46" />
      </g>
    )
  }
  if (kind === 1) {
    // feuillu rond
    return (
      <g>
        <ellipse cx={px} cy={py + 1} rx={9 * s} ry={4.5 * s} fill="rgba(20,40,60,0.2)" />
        <rect x={px - 1.5 * s} y={py - 8 * s} width={3 * s} height={9 * s} fill="#7a5230" />
        <circle cx={px} cy={py - 16 * s} r={10 * s} fill="#5cb85c" />
        <circle cx={px + 4 * s} cy={py - 13 * s} r={7 * s} fill="#4aa64a" />
        <circle cx={px - 3 * s} cy={py - 20 * s} r={4.5 * s} fill="#7fd07f" />
      </g>
    )
  }
  // palmier
  return (
    <g>
      <ellipse cx={px} cy={py + 1} rx={8 * s} ry={4 * s} fill="rgba(20,40,60,0.18)" />
      <path d={`M${px},${py} Q${px + 4 * s},${py - 14 * s} ${px + 2 * s},${py - 26 * s}`} stroke="#9c6b3c" strokeWidth={3 * s} fill="none" strokeLinecap="round" />
      {[-60, -20, 20, 60, 160].map((ang, i) => {
        const r = (ang * Math.PI) / 180
        const ex = px + 2 * s + Math.cos(r) * 14 * s, ey = py - 26 * s + Math.sin(r) * 6 * s + 4 * s
        return <path key={i} d={`M${px + 2 * s},${py - 26 * s} Q${(px + 2 * s + ex) / 2},${py - 34 * s} ${ex},${ey}`} stroke="#3aa35a" strokeWidth={3.2 * s} fill="none" strokeLinecap="round" />
      })}
    </g>
  )
}

// ── Bâtiments ────────────────────────────────────────────────────────────────
export interface ArtOpts { level: number; mature?: boolean; ghost?: boolean }

/** Hauteur visuelle (px) — sert à placer la bulle de récolte au-dessus du toit. */
export function artHeight(t: BType, level: number): number {
  switch (t) {
    case 'maison': return 46 + (level - 1) * 10
    case 'banque': return 50 + (level >= 3 ? 16 : 0)
    case 'etf': return 70 + level * 22
    case 'coffre': return 44
    case 'parking': return level >= 3 ? 30 : 22
    case 'studio': return 48 + (level - 1) * 13
    case 'crypto': return 40
    case 'bureaux': return 56 + (level - 1) * 15
    case 'solaire': return 26
    case 'commerce': return 46 + (level >= 3 ? 18 : 0)
    case 'immeuble': return 78 + (level - 1) * 13
  }
}

export function BuildingArt({ type, level, mature }: { type: BType } & ArtOpts) {
  switch (type) {
    case 'maison': return <Maison level={level} />
    case 'banque': return <Banque level={level} />
    case 'etf': return <Etf level={level} mature={mature} />
    case 'coffre': return <Coffre level={level} mature={mature} />
    case 'parking': return <Parking level={level} />
    case 'studio': return <Studio level={level} />
    case 'crypto': return <Crypto level={level} />
    case 'bureaux': return <Bureaux level={level} />
    case 'solaire': return <Solaire level={level} />
    case 'commerce': return <Commerce level={level} />
    case 'immeuble': return <Immeuble level={level} />
  }
}

function Maison({ level }: { level: number }) {
  const h = 22 + (level - 1) * 10
  const body = box({ a: 0.26, b: 0.22, h, color: '#f6e7cf' })
  const door = body.onLeft(-0.25, 0.15, 0, 14)
  return (
    <g>
      {shadow(40)}
      {level >= 5 && <polygon points={poly([pt(0.12, -0.42), pt(0.42, -0.42), pt(0.42, -0.12), pt(0.12, -0.12)])} fill="#5ec8f2" stroke="#fff" strokeWidth={1.5} />}
      {level >= 3 && (() => { const ext = box({ cx: 0.24, cy: -0.1, a: 0.12, b: 0.16, h: 16, color: '#efd9b6' }); return <>{ext.el}{gable(0.24, -0.1, 0.12, 0.16, 16, 10, '#c4553a')}</> })()}
      {body.el}
      {windows(body, 4, h - 2, Math.max(1, level - 1) + (level > 2 ? 0 : 0), 2, 2, '#9fd3f5')}
      <polygon points={door} fill="#8d5a3b" />
      {gable(0, 0, 0.26, 0.22, h, 20, '#e76f51')}
      {(() => { const ch = box({ cx: 0.1, cy: -0.12, a: 0.04, b: 0.04, z: h + 8, h: 12, color: '#b5523b', stroke: false }); return ch.el })()}
      {bush(-0.36, 0.32, 6)}
      {bush(0.34, 0.36, 5, '#66bb6a')}
      {level >= 2 && bush(-0.1, 0.42, 4.5, '#81c784')}
    </g>
  )
}

function Banque({ level }: { level: number }) {
  const base = box({ a: 0.36, b: 0.32, h: 5, color: '#dfe3ea' })
  const body = box({ a: 0.3, b: 0.24, z: 5, h: 30, color: '#f7f8fb' })
  const cols = [-0.75, -0.25, 0.25, 0.75].map((u, i) => {
    const col = box({ cx: u * 0.3, cy: 0.3, a: 0.025, b: 0.025, z: 5, h: 26, color: '#ffffff', stroke: false })
    return <g key={i}>{col.el}</g>
  })
  const t = body.top
  const ped = poly([pt(-0.33, 0.3, t), pt(0.33, 0.3, t), pt(0, 0.3, t + 13)])
  return (
    <g>
      {shadow(44)}
      {base.el}
      {body.el}
      <polygon points={body.onRight(-0.6, -0.1, 12, 26)} fill="#a9c4ff" />
      <polygon points={body.onRight(0.15, 0.65, 12, 26)} fill="#a9c4ff" />
      <polygon points={body.onLeft(-0.2, 0.2, 5, 22)} fill="#3f5bd6" />
      {cols}
      {(() => { const roof = box({ cx: 0, cy: 0.03, a: 0.33, b: 0.3, z: t, h: 3, color: '#4f7cff' }); return roof.el })()}
      <polygon points={ped} fill="#4f7cff" />
      <polygon points={ped} fill="none" stroke="#fff" strokeWidth={1} opacity={0.6} />
      {level >= 2 && <text {...txt(pt(0, 0.3, t + 4), 8)} fill="#fff" fontWeight={900}>€</text>}
      {level >= 3 && (() => { const [x, y] = pt(0, 0, t + 3); return <g><ellipse cx={x} cy={y} rx={16} ry={8} fill="#e9c46a" /><path d={`M${x - 16},${y} A16,16 0 0 1 ${x + 16},${y}`} fill="#f4d58d" /><circle cx={x} cy={y - 17} r={2.5} fill="#e9c46a" /></g> })()}
    </g>
  )
}

function txt([x, y]: P, size: number) {
  return { x, y, fontSize: size, textAnchor: 'middle' as const, dominantBaseline: 'middle' as const, fontFamily: 'Baloo 2, system-ui' }
}

function Etf({ level }: { level: number; mature?: boolean }) {
  const h = 54 + level * 22
  const plaza = box({ a: 0.4, b: 0.4, h: 3, color: '#d5dbe3' })
  const tower = box({ a: 0.2, b: 0.2, z: 3, h, color: '#2bb3c0', top: '#7fe0e8' })
  const bands: ReactElement[] = []
  for (let z = 10; z < h - 4; z += 9) {
    bands.push(<polygon key={`l${z}`} points={tower.onLeft(-0.92, 0.92, z, z + 5)} fill="#c6f5f8" opacity={0.85} />)
    bands.push(<polygon key={`r${z}`} points={tower.onRight(-0.92, 0.92, z, z + 5)} fill="#9ee6ec" opacity={0.75} />)
  }
  const [ax, ay] = pt(0, 0, h + 3)
  return (
    <g>
      {shadow(40)}
      {plaza.el}
      {tower.el}
      {bands}
      {(() => { const cap = box({ a: 0.14, b: 0.14, z: h + 3, h: 6, color: '#1d8a95' }); return cap.el })()}
      <line x1={ax} y1={ay - 6} x2={ax} y2={ay - 26} stroke="#456" strokeWidth={2} />
      <circle cx={ax} cy={ay - 27} r={3} fill="#ff4d6d" className="blink" />
      {bush(-0.36, 0.36, 5)}
      {bush(0.38, 0.3, 5, '#66bb6a')}
    </g>
  )
}

function Coffre({ level, mature }: { level: number; mature?: boolean }) {
  const col = mature ? '#e9c46a' : '#8792a8'
  const body = box({ a: 0.28, b: 0.28, h: 24 + level * 3, color: col })
  const zc = (24 + level * 3) / 2
  const door = Array.from({ length: 20 }, (_, i) => {
    const th = (i / 20) * Math.PI * 2
    return pt(Math.cos(th) * 0.18, 0.28, zc + Math.sin(th) * 9.5)
  })
  const inner = Array.from({ length: 20 }, (_, i) => {
    const th = (i / 20) * Math.PI * 2
    return pt(Math.cos(th) * 0.11, 0.28, zc + Math.sin(th) * 6)
  })
  const [hx, hy] = pt(0, 0.28, zc)
  const [lx, ly] = pt(0, 0, body.top + 2)
  return (
    <g>
      {shadow(38)}
      {body.el}
      {[-0.8, 0.8].map((u) => [0.2, 0.8].map((v) => {
        const [x, y] = pt(1 * 0.28, u * 0.28, v * (24 + level * 3))
        return <circle key={`${u}${v}`} cx={x} cy={y} r={1.6} fill={shade(col, 0.4)} />
      }))}
      <polygon points={poly(door)} fill={shade(col, -0.3)} />
      <polygon points={poly(inner)} fill={shade(col, 0.1)} />
      {[0, 60, 120].map((d) => {
        const r = (d * Math.PI) / 180
        return <line key={d} x1={hx - Math.cos(r) * 7} y1={hy - Math.sin(r) * 4} x2={hx + Math.cos(r) * 7} y2={hy + Math.sin(r) * 4} stroke={shade(col, -0.45)} strokeWidth={1.6} />
      })}
      {/* Cadenas sur le toit */}
      <g transform={`translate(${lx},${ly - 10})`}>
        {mature && <circle r={16} fill="#ffe08a" opacity={0.45} className="glow" />}
        <path d={mature ? 'M-5,-2 L-5,-9 A5,5 0 0 1 5,-9' : 'M-5,-2 L-5,-9 A5,5 0 0 1 5,-9 L5,-2'} fill="none" stroke={mature ? '#b8860b' : '#4a5568'} strokeWidth={2.5} />
        <rect x={-7} y={-3} width={14} height={11} rx={2.5} fill={mature ? '#f4c430' : '#5a6578'} />
        <circle cx={0} cy={2} r={1.6} fill={mature ? '#7a5a00' : '#e2e8f0'} />
      </g>
    </g>
  )
}

function Parking({ level }: { level: number }) {
  const slab = box({ a: 0.42, b: 0.42, h: 6, color: '#5c6670', top: '#6b7680' })
  const decks = level >= 3 ? [slab, box({ a: 0.42, b: 0.42, z: 14, h: 6, color: '#5c6670', top: '#6b7680' })] : [slab]
  const topZ = decks[decks.length - 1].top
  const lines = [-0.25, 0, 0.25].map((x) => (
    <polygon key={x} points={poly([pt(x - 0.01, -0.36, topZ), pt(x + 0.01, -0.36, topZ), pt(x + 0.01, -0.05, topZ), pt(x - 0.01, -0.05, topZ)])} fill="#f1f3f5" />
  ))
  const carCols = ['#e63946', '#ffb703', '#219ebc', '#ffffff', '#8338ec', '#2a9d8f']
  const nCars = Math.min(6, 2 + level)
  const slots: [number, number][] = [[-0.37, -0.2], [-0.12, -0.2], [0.13, -0.2], [-0.37, 0.22], [-0.12, 0.22], [0.13, 0.22]]
  const cars = slots.slice(0, nCars).map(([x, y], i) => {
    const car = box({ cx: x + 0.11, cy: y, a: 0.07, b: 0.12, z: topZ, h: 6, color: carCols[i % carCols.length], stroke: false })
    const cab = box({ cx: x + 0.11, cy: y + 0.01, a: 0.055, b: 0.065, z: topZ + 6, h: 4, color: '#cfe8ff', stroke: false })
    return <g key={i}>{car.el}{cab.el}</g>
  })
  const [sx, sy] = pt(0.38, 0.38, topZ)
  return (
    <g>
      {shadow(48)}
      {level >= 3 && (() => { const pil = [[-0.35, 0.35], [0.35, 0.35], [0.35, -0.35]].map(([x, y], i) => { const p = box({ cx: x, cy: y, a: 0.03, b: 0.03, z: 6, h: 8, color: '#8a949e', stroke: false }); return <g key={i}>{p.el}</g> }); return <>{decks[0].el}{pil}</> })()}
      {level < 3 && decks[0].el}
      {level >= 3 && decks[1].el}
      {lines}
      {cars}
      <line x1={sx} y1={sy} x2={sx} y2={sy - 26} stroke="#9aa5b1" strokeWidth={2} />
      <rect x={sx - 7} y={sy - 38} width={14} height={14} rx={3} fill="#1d4ed8" stroke="#fff" strokeWidth={1.2} />
      <text x={sx} y={sy - 30.5} fontSize={11} fontWeight={900} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontFamily="Baloo 2, system-ui">P</text>
    </g>
  )
}

function Studio({ level }: { level: number }) {
  const floors = 2 + level
  const h = floors * 12
  const body = box({ a: 0.26, b: 0.3, h, color: '#f4a261' })
  const balconies: ReactElement[] = []
  for (let f = 1; f < floors; f++) {
    const z = f * 12
    balconies.push(<polygon key={f} points={poly([pt(0.26, -0.2, z), pt(0.34, -0.2, z), pt(0.34, 0.2, z), pt(0.26, 0.2, z)])} fill="#ffffff" opacity={0.9} />)
    balconies.push(<polyline key={`rl${f}`} points={poly([pt(0.34, -0.2, z), pt(0.34, -0.2, z + 4), pt(0.34, 0.2, z + 4), pt(0.34, 0.2, z)])} fill="none" stroke="#fff" strokeWidth={1} />)
  }
  return (
    <g>
      {shadow(40)}
      {body.el}
      {windows(body, 0, h, floors, 2, 2, '#fff2d8', true)}
      {balconies}
      {(() => { const r = box({ a: 0.28, b: 0.32, z: h, h: 3, color: '#e07a3a' }); return r.el })()}
      {(() => { const t = box({ cx: -0.08, cy: -0.1, a: 0.07, b: 0.06, z: h + 3, h: 7, color: '#d9d9d9', stroke: false }); return t.el })()}
      {bush(-0.36, 0.38, 5)}
      {bush(0.38, -0.36, 4.5, '#81c784')}
    </g>
  )
}

function Crypto({ level }: { level: number }) {
  const body = box({ a: 0.3, b: 0.3, h: 22, color: '#2b2d42' })
  const neon = level >= 3 ? '#00f5d4' : '#9b5de5'
  const strips = [6, 13].map((z) => (
    <g key={z}>
      <polygon points={body.onLeft(-0.9, 0.9, z, z + 2)} fill={neon} className="neon" />
      <polygon points={body.onRight(-0.9, 0.9, z, z + 2)} fill={neon} className="neon" opacity={0.8} />
    </g>
  ))
  const fans = [[-0.12, -0.12], [0.12, 0.12], [0.12, -0.12], [-0.12, 0.12]].slice(0, 2 + Math.min(2, level - 1)).map(([x, y], i) => {
    const [px, py] = pt(x, y, 22)
    return (
      <g key={i}>
        <ellipse cx={px} cy={py} rx={9} ry={4.5} fill="#1a1b2e" />
        <ellipse cx={px} cy={py} rx={7} ry={3.5} fill="none" stroke="#5a5c78" strokeWidth={1} className="spin" />
      </g>
    )
  })
  return (
    <g>
      {shadow(40)}
      {body.el}
      {strips}
      {fans}
      {(() => { const [x, y] = pt(0.3, 0.3, 30); return <text x={x} y={y} fontSize={12} textAnchor="middle" fontFamily="Baloo 2, system-ui" fontWeight={900} fill={neon} className="neon">₿</text> })()}
    </g>
  )
}

function Bureaux({ level }: { level: number }) {
  const h = 44 + (level - 1) * 15
  const body = box({ a: 0.34, b: 0.28, h, color: '#577590' })
  return (
    <g>
      {shadow(46)}
      {body.el}
      {windows(body, 3, h - 2, Math.round(h / 11), 4, 3, '#bfe0ff', true)}
      {(() => { const u = box({ cx: 0.1, cy: -0.05, a: 0.1, b: 0.08, z: h, h: 6, color: '#9aa9b8', stroke: false }); return u.el })()}
      {(() => { const u = box({ cx: -0.15, cy: 0.08, a: 0.06, b: 0.06, z: h, h: 4, color: '#c3ccd6', stroke: false }); return u.el })()}
      {bush(-0.4, 0.38, 5)}
    </g>
  )
}

function Solaire({ level }: { level: number }) {
  const rows = Math.min(3, 1 + Math.floor(level / 2))
  const panels: ReactElement[] = []
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < 2; j++) {
      const x = -0.22 + j * 0.42, y = -0.3 + i * 0.28
      const p0 = pt(x - 0.17, y, 6), p1 = pt(x + 0.17, y, 6), p2 = pt(x + 0.17, y + 0.14, 14), p3 = pt(x - 0.17, y + 0.14, 14)
      panels.push(
        <g key={`${i}${j}`}>
          <line x1={pt(x, y + 0.1, 0)[0]} y1={pt(x, y + 0.1, 0)[1]} x2={pt(x, y + 0.1, 10)[0]} y2={pt(x, y + 0.1, 10)[1]} stroke="#8a8f99" strokeWidth={1.5} />
          <polygon points={poly([p0, p1, p2, p3])} fill="#1e3a8a" stroke="#93c5fd" strokeWidth={0.8} />
          <line x1={(p0[0] + p1[0]) / 2} y1={(p0[1] + p1[1]) / 2} x2={(p3[0] + p2[0]) / 2} y2={(p3[1] + p2[1]) / 2} stroke="#93c5fd" strokeWidth={0.6} />
          <line x1={(p0[0] + p3[0]) / 2} y1={(p0[1] + p3[1]) / 2} x2={(p1[0] + p2[0]) / 2} y2={(p1[1] + p2[1]) / 2} stroke="#93c5fd" strokeWidth={0.6} />
          <polygon points={poly([p0, p1, p2, p3])} fill="url(#solarShine)" />
        </g>,
      )
    }
  }
  const inv = box({ cx: 0.36, cy: 0.36, a: 0.06, b: 0.06, h: 10, color: '#e5e7eb' })
  return <g>{shadow(46, 20)}{panels}{inv.el}</g>
}

function Commerce({ level }: { level: number }) {
  const h = 24
  const body = box({ a: 0.32, b: 0.26, h, color: '#fff8e7' })
  const awning: ReactElement[] = []
  const n = 6
  for (let i = 0; i < n; i++) {
    const u1 = -1 + (2 / n) * i, u2 = -1 + (2 / n) * (i + 1)
    const a1 = pt(u1 * 0.32, 0.26, 17), a2 = pt(u2 * 0.32, 0.26, 17), a3 = pt(u2 * 0.32, 0.38, 11), a4 = pt(u1 * 0.32, 0.38, 11)
    awning.push(<polygon key={i} points={poly([a1, a2, a3, a4])} fill={i % 2 ? '#ffffff' : '#e5383b'} />)
  }
  const upper = level >= 3 ? box({ a: 0.3, b: 0.24, z: h, h: 18, color: '#f2e2c4' }) : null
  const roofZ = upper ? upper.top : h
  const [sx, sy] = pt(0, -0.05, roofZ)
  return (
    <g>
      {shadow(44)}
      {body.el}
      <polygon points={body.onLeft(-0.8, 0.8, 2, 15)} fill="#bde0fe" />
      <polygon points={body.onRight(-0.4, 0.4, 0, 14)} fill="#8d5a3b" />
      {upper && <>{upper.el}{windows(upper, h, h + 18, 1, 3, 2, '#fff2d8', true)}</>}
      {awning}
      <rect x={sx - 18} y={sy - 18} width={36} height={12} rx={3} fill="#e5383b" />
      <text x={sx} y={sy - 11.5} fontSize={8} fontWeight={900} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontFamily="Baloo 2, system-ui">SHOP</text>
      {bush(-0.42, 0.42, 4.5, '#81c784')}
      {bush(0.42, 0.42, 4.5, '#81c784')}
    </g>
  )
}

function Immeuble({ level }: { level: number }) {
  const h = 54 + (level - 1) * 13
  const body = box({ a: 0.37, b: 0.34, h, color: '#efe0c8' })
  const mansard = box({ a: 0.33, b: 0.3, z: h, h: 12, color: '#4a5568', top: '#5a6578' })
  const rows = Math.round(h / 13)
  const rails: ReactElement[] = []
  for (let f = 1; f < rows; f++) {
    const z = f * 13 - 2
    rails.push(<polygon key={f} points={body.onLeft(-0.95, 0.95, z, z + 1.4)} fill="#2d3748" />)
    rails.push(<polygon key={`r${f}`} points={body.onRight(-0.95, 0.95, z, z + 1.4)} fill="#2d3748" opacity={0.7} />)
  }
  const dormers = [-0.15, 0.15].map((u, i) => {
    const d = box({ cx: u, cy: 0.3, a: 0.05, b: 0.03, z: h + 3, h: 7, color: '#efe0c8', stroke: false })
    return <g key={i}>{d.el}</g>
  })
  return (
    <g>
      {shadow(52)}
      {body.el}
      {windows(body, 2, h - 2, rows, 5, 4, '#a9c7e8', true)}
      {rails}
      {mansard.el}
      {dormers}
      <polygon points={body.onLeft(-0.15, 0.15, 0, 12)} fill="#5b3a29" />
    </g>
  )
}

// ── Petite icône (cartes de construction) ────────────────────────────────────
export function MiniArt({ type, size = 72, level = 1 }: { type: BType; size?: number; level?: number }) {
  const hgt = artHeight(type, level)
  const vbH = 70 + hgt
  return (
    <svg viewBox={`-62 ${-hgt - 34} 124 ${vbH}`} width={size} height={size} style={{ overflow: 'visible' }}>
      <polygon points={poly([pt(-0.5, -0.5), pt(0.5, -0.5), pt(0.5, 0.5), pt(-0.5, 0.5)])} fill="#9bd77a" />
      <polygon points={poly([pt(0.5, -0.5), pt(0.5, 0.5), pt(0.5, 0.5, -8), pt(0.5, -0.5, -8)])} fill="#c8a76a" />
      <polygon points={poly([pt(-0.5, 0.5), pt(0.5, 0.5), pt(0.5, 0.5, -8), pt(-0.5, 0.5, -8)])} fill="#dbbd80" />
      <BuildingArt type={type} level={level} />
    </svg>
  )
}

export function SvgDefs() {
  return (
    <defs>
      <linearGradient id="solarShine" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="grassTop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a6e07f" />
        <stop offset="1" stopColor="#86cd5f" />
      </linearGradient>
      <pattern id="waves" width="120" height="40" patternUnits="userSpaceOnUse">
        <path d="M0 20 Q15 14 30 20 T60 20" stroke="rgba(255,255,255,0.16)" strokeWidth="2" fill="none" />
        <path d="M60 32 Q75 26 90 32 T120 32" stroke="rgba(255,255,255,0.10)" strokeWidth="2" fill="none" />
      </pattern>
    </defs>
  )
}
