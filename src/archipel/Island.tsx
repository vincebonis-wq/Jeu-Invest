/**
 * ARCHIPEL — l'île : rendu isométrique, caméra (glisser / pincer / molette),
 * bulles de récolte, aperçu de placement avec synergies.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useArchipel } from './store'
import {
  buildingAt, canPlace, isLand, isShore, isMature, monthlyProduction, storageCap, synergyFor,
  parseKey, key, NEIGHBORS, type GameState,
} from './engine'
import { SYNERGY, type BType } from './data'
import { BuildingArt, SvgDefs, TW, TH, DEPTH, artHeight, poly, tree } from './art'
import { fmtShort } from './format'

const tc = (q: number, r: number): [number, number] => [(q - r) * (TW / 2), (q + r) * (TH / 2)]
const rhombus = (s = 1): [number, number][] => [[0, -TH / 2 * s], [TW / 2 * s, 0], [0, TH / 2 * s], [-TW / 2 * s, 0]]
const shift = (pts: [number, number][], x: number, y: number) => pts.map(([a, b]) => [a + x, b + y] as [number, number])

function hash(q: number, r: number) {
  let h = (q * 73856093) ^ (r * 19349663)
  h = (h ^ (h >>> 13)) * 1274126177
  return Math.abs(h ^ (h >>> 16))
}

const GRASS = ['#9bd77a', '#a3db80', '#94d273', '#a8de86']

interface Cam { x: number; y: number; s: number }

export function Island() {
  const game = useArchipel((s) => s.game)
  const mode = useArchipel((s) => s.mode)
  const buildType = useArchipel((s) => s.buildType)
  const target = useArchipel((s) => s.target)
  const selected = useArchipel((s) => s.selected)
  const risen = useArchipel((s) => s.risen)
  const popped = useArchipel((s) => s.popped)
  const st = useArchipel.getState

  const wrap = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 400, h: 800 })
  const [cam, setCam] = useState<Cam | null>(null)
  const camRef = useRef<Cam | null>(null)
  camRef.current = cam

  // ── Taille du conteneur ──
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // ── Bornes du monde ──
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const k of game.land) {
      const [q, r] = parseKey(k)
      const [x, y] = tc(q, r)
      minX = Math.min(minX, x - TW / 2); maxX = Math.max(maxX, x + TW / 2)
      minY = Math.min(minY, y - TH / 2 - 120); maxY = Math.max(maxY, y + TH / 2 + DEPTH)
    }
    return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
  }, [game.land])

  // Cadrage initial
  useEffect(() => {
    if (cam || size.w < 10) return
    // Zoom de départ confortable : on voit les bâtiments en grand et l'on se
    // déplace en glissant. Centré sur le cœur bâti de l'île.
    const bw = bounds.maxX - bounds.minX + TW * 0.8
    const s = Math.max(0.95, Math.min(1.35, size.w / bw))
    const pts = game.buildings.map((b) => tc(b.q, b.r))
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length
    const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length - 30
    setCam(clampCam({ s, x: size.w / 2 - cx * s, y: size.h * 0.55 - cy * s }))
  }, [size, bounds, cam])

  // ── Interaction : glisser / pincer / taper ──
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef({ moved: false, startX: 0, startY: 0, pinchD: 0, pinchS: 1 })

  const clampCam = (c: Cam): Cam => {
    const m = 200
    const minX = size.w - (bounds.maxX + m) * c.s, maxX = -(bounds.minX - m) * c.s
    const minY = size.h - (bounds.maxY + m) * c.s, maxY = -(bounds.minY - m) * c.s
    return {
      s: c.s,
      x: minX > maxX ? (minX + maxX) / 2 : Math.min(maxX, Math.max(minX, c.x)),
      y: minY > maxY ? (minY + maxY) / 2 : Math.min(maxY, Math.max(minY, c.y)),
    }
  }

  const zoomAt = (c: Cam, ns: number, px: number, py: number): Cam => {
    const s = Math.max(0.45, Math.min(1.9, ns))
    const wx = (px - c.x) / c.s, wy = (py - c.y) / c.s
    return clampCam({ s, x: px - wx * s, y: py - wy * s })
  }

  function onDown(e: React.PointerEvent) {
    wrap.current?.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) gesture.current = { moved: false, startX: e.clientX, startY: e.clientY, pinchD: 0, pinchS: camRef.current?.s ?? 1 }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current.pinchD = Math.hypot(a.x - b.x, a.y - b.y)
      gesture.current.pinchS = camRef.current?.s ?? 1
      gesture.current.moved = true
    }
  }

  function onMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev || !camRef.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const c = camRef.current
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const rect = wrap.current!.getBoundingClientRect()
      setCam(zoomAt(c, gesture.current.pinchS * (d / gesture.current.pinchD), (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top))
      return
    }
    if (!gesture.current.moved && Math.hypot(e.clientX - gesture.current.startX, e.clientY - gesture.current.startY) > 7) gesture.current.moved = true
    if (gesture.current.moved) setCam(clampCam({ ...c, x: c.x + (e.clientX - prev.x), y: c.y + (e.clientY - prev.y) }))
  }

  function onUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (gesture.current.moved || pointers.current.size > 0) return
    handleTap(e.clientX, e.clientY)
  }

  function onWheel(e: React.WheelEvent) {
    if (!camRef.current) return
    const rect = wrap.current!.getBoundingClientRect()
    setCam(zoomAt(camRef.current, camRef.current.s * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX - rect.left, e.clientY - rect.top))
  }

  function handleTap(cx: number, cy: number) {
    const el = document.elementFromPoint(cx, cy) as Element | null
    const hit = el?.closest('[data-bubble],[data-bid],[data-tile]') as HTMLElement | SVGElement | null
    const s = st()
    const bubble = hit?.getAttribute('data-bubble')
    const bid = hit?.getAttribute('data-bid')
    const tile = hit?.getAttribute('data-tile')
    if (s.mode === 'idle') {
      if (bubble) { s.collect(bubble, cx, cy); return }
      if (bid) { s.select(bid === s.selected ? null : bid); return }
      s.select(null)
      return
    }
    // Mode construction / terrain : on vise une case
    let k = tile
    if (!k && bid) { const b = s.game.buildings.find((x) => x.id === bid); if (b) k = key(b.q, b.r) }
    if (!k) return
    const [q, r] = parseKey(k)
    const valid = s.mode === 'land' ? isShore(s.game, q, r) : canPlace(s.game, q, r)
    if (!valid) return
    if (s.target === k) s.confirm()
    else s.setTarget(k)
  }

  if (!cam) return <div ref={wrap} className="absolute inset-0" />

  const now = Date.now()
  const g = game
  const tiles = [...g.land].map(parseKey).sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0])

  // Cases cibles (rivage) en mode terrain / construction
  const shore: [number, number][] = []
  if (mode !== 'idle') {
    const seen = new Set<string>()
    for (const [q, r] of tiles) for (const [dq, dr] of NEIGHBORS) {
      const k = key(q + dq, r + dr)
      if (!seen.has(k) && !isLand(g, q + dq, r + dr)) { seen.add(k); shore.push([q + dq, r + dr]) }
    }
  }

  // Objets 3D triés en profondeur
  type Obj = { d: number; el: ReactElement }
  const objs: Obj[] = []
  const occupied = new Set(g.buildings.map((b) => key(b.q, b.r)))
  for (const [q, r] of tiles) {
    const k = key(q, r)
    if (occupied.has(k) || (target === k && mode === 'build')) continue
    const h = hash(q, r)
    const n = h % 4 === 0 ? 0 : h % 3 === 0 ? 2 : 1
    const [x, y] = tc(q, r)
    for (let i = 0; i < n; i++) {
      const ox = (((h >> (i * 4)) % 7) - 3) * 0.08
      const oy = (((h >> (i * 4 + 2)) % 7) - 3) * 0.08
      objs.push({ d: q + r + 0.01 * i, el: <g key={`t${k}${i}`} transform={`translate(${x},${y})`} pointerEvents="none">{tree(ox, oy, (h >> i) % 3, 0.85 + ((h >> 5) % 3) * 0.1)}</g> })
    }
  }
  for (const b of g.buildings) {
    const [x, y] = tc(b.q, b.r)
    const isPop = popped[b.id] && now - popped[b.id] < 900
    const isSel = selected === b.id
    objs.push({
      d: b.q + b.r + 0.5,
      el: (
        <g key={b.id} data-bid={b.id} transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }}>
          {isSel && <polygon points={poly(rhombus(1.02))} fill="rgba(255,255,255,0.35)" stroke="#fff" strokeWidth={3} className="selpulse" />}
          <g className={isPop ? 'bpop' : undefined}>
            <BuildingArt type={b.type} level={b.level} mature={isMature(g, b)} />
          </g>
        </g>
      ),
    })
  }
  // Fantôme de placement
  let ghost: { type: BType; q: number; r: number } | undefined
  if (mode === 'build' && buildType && target) {
    const [q, r] = parseKey(target)
    ghost = { type: buildType, q, r }
    const [x, y] = tc(q, r)
    objs.push({
      d: q + r + 0.5,
      el: (
        <g key="ghost" transform={`translate(${x},${y})`} opacity={0.82} pointerEvents="none">
          <g className="ghostbob"><BuildingArt type={buildType} level={1} /></g>
        </g>
      ),
    })
  }
  objs.sort((a, b) => a.d - b.d)

  const phase = g.market.phase
  const sea = phase === 'krach' ? ['#2c5d79', '#173a52'] : phase === 'euphorie' ? ['#3fc1d0', '#1f8fb0'] : ['#46c2d6', '#2390b8']

  return (
    <div
      ref={wrap}
      className="absolute inset-0 touch-none select-none overflow-hidden"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={onWheel}
      style={{ background: `radial-gradient(120% 90% at 50% 45%, ${sea[0]} 0%, ${sea[1]} 100%)`, transition: 'background 2s' }}
    >
      <svg width={size.w} height={size.h} className="absolute inset-0">
        <SvgDefs />
        <g transform={`translate(${cam.x},${cam.y}) scale(${cam.s})`}>
          <rect x={bounds.minX - 1200} y={bounds.minY - 1200} width={bounds.maxX - bounds.minX + 2400} height={bounds.maxY - bounds.minY + 2400} fill="url(#waves)" className="wavedrift" />

          {/* Lagon + plage */}
          {tiles.map(([q, r]) => { const [x, y] = tc(q, r); return <polygon key={`l${q},${r}`} points={poly(shift(rhombus(1.55), x, y + 8))} fill="#7fdde0" opacity={0.45} /> })}
          {tiles.map(([q, r]) => { const [x, y] = tc(q, r); return <polygon key={`f${q},${r}`} points={poly(shift(rhombus(1.22), x, y + 6))} fill="#bff0ea" opacity={0.6} /> })}
          {tiles.map(([q, r]) => { const [x, y] = tc(q, r); return <polygon key={`s${q},${r}`} points={poly(shift(rhombus(1.1), x, y + 4))} fill="#f1dcaa" /> })}

          {/* Cibles sur l'eau */}
          {shore.map(([q, r]) => {
            const [x, y] = tc(q, r)
            const k = key(q, r)
            const on = target === k
            return (
              <polygon key={`sh${k}`} data-tile={k} points={poly(shift(rhombus(0.92), x, y))}
                fill={on ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.12)'} stroke="#fff" strokeWidth={on ? 3 : 1.6}
                strokeDasharray={on ? undefined : '7 6'} className={on ? undefined : 'shorepulse'} />
            )
          })}

          {/* Cases de terre */}
          {tiles.map(([q, r]) => {
            const [x, y] = tc(q, r)
            const k = key(q, r)
            const h = hash(q, r)
            const top = shift(rhombus(), x, y)
            const rise = risen[k] && now - risen[k] < 1300
            const free = mode === 'build' && !buildingAt(g, q, r)
            return (
              <g key={`g${k}`} data-tile={k} className={rise ? 'rise' : undefined}>
                <polygon points={poly([[x + TW / 2, y], [x, y + TH / 2], [x, y + TH / 2 + DEPTH], [x + TW / 2, y + DEPTH]])} fill="#c99a5b" />
                <polygon points={poly([[x - TW / 2, y], [x, y + TH / 2], [x, y + TH / 2 + DEPTH], [x - TW / 2, y + DEPTH]])} fill="#e0b878" />
                <polygon points={poly([[x - TW / 2, y + DEPTH * 0.45], [x, y + TH / 2 + DEPTH * 0.45], [x + TW / 2, y + DEPTH * 0.45]])} fill="none" stroke="rgba(120,80,40,0.25)" strokeWidth={1} />
                <polygon points={poly(top)} fill={GRASS[h % GRASS.length]} />
                <polyline points={poly([top[3], top[2], top[1]])} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1.2} />
                {h % 5 === 0 && !occupied.has(k) && <>
                  <circle cx={x - 18 + (h % 13)} cy={y + 4 - (h % 7)} r={1.8} fill="#fff7a8" />
                  <circle cx={x + 10 - (h % 9)} cy={y - 6 + (h % 5)} r={1.6} fill="#ffb3c7" />
                </>}
                {free && <polygon points={poly(shift(rhombus(0.86), x, y))} fill={target === k ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.14)'} stroke="#fff" strokeWidth={target === k ? 3 : 1.4} strokeDasharray={target === k ? undefined : '6 5'} />}
              </g>
            )
          })}

          {objs.map((o) => o.el)}
        </g>
      </svg>

      {/* Couche HTML alignée sur la caméra : bulles + puces de synergie */}
      <div className="absolute left-0 top-0 pointer-events-none" style={{ transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`, transformOrigin: '0 0' }}>
        {mode === 'idle' && g.buildings.map((b) => <Bubble key={b.id} g={g} id={b.id} s={cam.s} />)}
        {ghost && <SynergyChips g={g} ghost={ghost} s={cam.s} />}
      </div>

      {/* Nuages */}
      <div className="cloud" style={{ top: '18%', animationDuration: '95s' }} />
      <div className="cloud" style={{ top: '58%', animationDuration: '130s', animationDelay: '-60s', transform: 'scale(1.4)' }} />
      <div className="cloud" style={{ top: '36%', animationDuration: '160s', animationDelay: '-20s', opacity: 0.5 }} />
      {phase === 'krach' && <div className="rain" />}
      {phase === 'euphorie' && <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(80% 60% at 70% 0%, rgba(255,214,120,0.35), transparent 70%)' }} />}
    </div>
  )
}

function Bubble({ g, id, s }: { g: GameState; id: string; s: number }) {
  const b = g.buildings.find((x) => x.id === id)!
  const prod = monthlyProduction(g, b).net
  if (b.stored < Math.max(0.5, prod * 1)) return null
  const full = b.stored >= storageCap(g, b) * 0.995
  const [x, y] = tc(b.q, b.r)
  const top = y - artHeight(b.type, b.level) - 18
  return (
    <button
      data-bubble={b.id}
      className={`absolute pointer-events-auto flex items-center gap-1 rounded-full pl-[3px] pr-2 py-[3px] font-display font-extrabold whitespace-nowrap ${full ? 'bubble-full' : 'bubble'}`}
      style={{ left: x, top, transform: `translate(-50%,-100%) scale(${1 / Math.max(0.75, s)})`, transformOrigin: '50% 100%' }}
    >
      <span className="coin coin-md" />
      <span className="text-[13px] leading-none">{fmtShort(b.stored)}</span>
    </button>
  )
}

function SynergyChips({ g, ghost, s }: { g: GameState; ghost: { type: BType; q: number; r: number }; s: number }) {
  const own = synergyFor(g, ghost.type, ghost.q, ghost.r, ghost).total
  const chips: ReactElement[] = []
  const [gx, gy] = tc(ghost.q, ghost.r)
  chips.push(<Chip key="own" x={gx} y={gy - artHeight(ghost.type, 1) - 26} pct={own} big s={s} />)
  for (const [dq, dr] of NEIGHBORS) {
    const n = buildingAt(g, ghost.q + dq, ghost.r + dr)
    if (!n) continue
    const pct = SYNERGY[n.type]?.[ghost.type]
    if (!pct) continue
    const [x, y] = tc(n.q, n.r)
    chips.push(<Chip key={n.id} x={x} y={y - artHeight(n.type, n.level) - 14} pct={pct} s={s} />)
  }
  return <>{chips}</>
}

function Chip({ x, y, pct, big, s }: { x: number; y: number; pct: number; big?: boolean; s: number }) {
  const pos = pct >= 0
  return (
    <div className="absolute font-display font-extrabold rounded-full shadow-lg chip-in whitespace-nowrap"
      style={{
        left: x, top: y, transform: `translate(-50%,-100%) scale(${1 / Math.max(0.75, s)})`, transformOrigin: '50% 100%',
        background: pct === 0 ? 'rgba(255,255,255,0.92)' : pos ? '#22c55e' : '#ef4444',
        color: pct === 0 ? '#475569' : '#fff', fontSize: big ? 16 : 13, padding: big ? '4px 12px' : '2px 9px',
        border: '2px solid #fff',
      }}>
      {pct === 0 ? 'Aucune synergie' : `${pos ? '+' : ''}${pct} %`}
    </div>
  )
}
