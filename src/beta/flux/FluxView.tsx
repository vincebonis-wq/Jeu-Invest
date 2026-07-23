/**
 * FluxView — beta « LE FLUX · La Raffinerie à Capital » (mode eau).
 *
 * Ton patrimoine est une machine hydraulique : chaque actif est une cuve reliée
 * par des tuyaux à un RÉSERVOIR central (ta trésorerie). L'argent coule en
 * billes de lumière ; taper une cuve pour récolter fait dévaler ses billes vers
 * le réservoir. L'impôt est une VANNE qu'on voit sur chaque tuyau ; l'assurance
 * vie a une vanne verrouillée avec un compte à rebours des 8 ans.
 *
 * Topologie FIXE (tronc + branches à emplacements prédéterminés, aucun
 * auto-routing), particules plafonnées et poolées → propre et performant, local.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Coins, Plus, Lock, Unlock, Droplets } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth, calcMonthlyPassiveIncome } from '../../utils/calculations'
import { getCatalogItem } from '../../data/investments'
import { getBuildingSprite } from '../buildingSprites'
import { Icon } from '../../components/ui/Icon'
import { BetaShell, useDrawer } from '../BetaShell'
import { euro, fiscalStatus } from '../shared/fiscalHelpers'
import { AssetSheet, BuildSheet } from '../shared/ManageSheets'
import type { GameState, Investment, MarketPhase } from '../../types'

const W = 360
const CARD_W = 132
const SLOT_H = 116
const RES_H = 104

interface ModuleNode {
  inv: Investment
  x: number; y: number
  side: 'left' | 'right'
  color: string
  pending: number
}
interface Layout {
  H: number
  trunkX: number
  reservoir: { x: number; y: number; w: number; h: number }
  modules: ModuleNode[]
}

function buildLayout(game: GameState): Layout {
  const invs = [...game.investments].sort((a, b) => a.currentValue - b.currentValue)
  const n = invs.length
  const trunkX = W / 2
  const topPad = 74
  const H = topPad + Math.max(1, n) * SLOT_H + RES_H + 18
  const resTopY = H - 18 - RES_H
  const modules: ModuleNode[] = invs.map((inv, i) => {
    const side = i % 2 === 0 ? 'left' : 'right'
    return {
      inv,
      x: side === 'left' ? 78 : W - 78,
      y: resTopY - 60 - i * SLOT_H,
      side,
      color: getCatalogItem(inv.catalogId).color,
      pending: inv.pendingRevenue ?? 0,
    }
  })
  return { H, trunkX, reservoir: { x: W / 2 - 104, y: resTopY, w: 208, h: RES_H }, modules }
}

// ── Canvas : tuyaux + billes + liquide ───────────────────────────────────────
interface Bead { active: boolean; px: number[]; py: number[]; seg: number; t: number; speed: number; color: string; leak: boolean; vy: number }

const PHASE_FX: Record<MarketPhase, { bead: string; alt: string; speed: number; pipe: string }> = {
  bull:    { bead: '#fde68a', alt: '#34d399', speed: 1.5, pipe: '#f59e0b55' },
  neutral: { bead: '#7dd3fc', alt: '#38bdf8', speed: 1.0, pipe: '#38bdf844' },
  bear:    { bead: '#94a3b8', alt: '#64748b', speed: 0.6, pipe: '#47556955' },
  crash:   { bead: '#f87171', alt: '#fca5a5', speed: 0.8, pipe: '#7f1d1d66' },
}

function FluxCanvas({ layout, phase, signals }: { layout: Layout; phase: MarketPhase; signals: React.MutableRefObject<{ bursts: number[] }> }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = W * dpr
    canvas.height = layout.H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    const fx = PHASE_FX[phase] ?? PHASE_FX.neutral
    const { trunkX, reservoir, modules } = layout
    const resTop = reservoir.y
    const beads: Bead[] = []
    let frame = 0
    let raf = 0
    let level = 0.2 // niveau du réservoir (0..1) animé

    function pathFor(m: ModuleNode): { px: number[]; py: number[] } {
      const anchorX = m.side === 'left' ? m.x + 34 : m.x - 34
      return { px: [anchorX, trunkX, trunkX + (Math.random() * 40 - 20)], py: [m.y, m.y, resTop + 14] }
    }
    function spawn(m: ModuleNode, leak = false) {
      if (beads.length > 150) return
      const p = pathFor(m)
      const b: Bead | undefined = beads.find((x) => !x.active)
      const nb: Bead = b ?? ({} as Bead)
      nb.active = true; nb.px = p.px; nb.py = p.py; nb.seg = 0; nb.t = 0
      nb.speed = (0.9 + Math.random() * 0.5) * fx.speed
      nb.color = Math.random() < 0.5 ? fx.bead : fx.alt
      nb.leak = leak; nb.vy = 0
      if (!b) beads.push(nb)
    }

    function draw() {
      frame++
      ctx.clearRect(0, 0, W, layout.H)

      // Tuyaux (tronc + branches) — statiques, épais, arrondis
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(148,163,184,0.18)'
      ctx.lineWidth = 13
      if (modules.length) {
        const topY = Math.min(...modules.map((m) => m.y))
        ctx.beginPath(); ctx.moveTo(trunkX, resTop); ctx.lineTo(trunkX, topY); ctx.stroke()
        for (const m of modules) {
          const ax = m.side === 'left' ? m.x + 34 : m.x - 34
          ctx.beginPath(); ctx.moveTo(ax, m.y); ctx.lineTo(trunkX, m.y); ctx.stroke()
        }
      }
      // Liseré coloré selon la phase
      ctx.strokeStyle = fx.pipe; ctx.lineWidth = 3
      if (modules.length) {
        const topY = Math.min(...modules.map((m) => m.y))
        ctx.beginPath(); ctx.moveTo(trunkX, resTop); ctx.lineTo(trunkX, topY); ctx.stroke()
      }

      // Spawns continus (débit) + fuites en krach
      for (let i = 0; i < modules.length; i++) {
        const m = modules[i]
        const rate = m.pending > 0 ? 10 : 26
        if (frame % rate === 0) spawn(m)
        if (phase === 'crash' && frame % 60 === 0 && Math.random() < 0.5) spawn(m, true)
      }
      // Bursts de récolte
      while (signals.current.bursts.length) {
        const idx = signals.current.bursts.shift()!
        const m = modules[idx]
        if (m) for (let k = 0; k < 14; k++) setTimeout(() => spawn(m), k * 30)
      }

      // Billes
      for (const b of beads) {
        if (!b.active) continue
        if (b.leak) {
          b.vy += 0.25; b.py[b.seg] += b.vy; b.px[b.seg] += 0.4
          ctx.fillStyle = '#f87171'
          ctx.beginPath(); ctx.arc(b.px[b.seg], b.py[b.seg], 2.6, 0, 7); ctx.fill()
          if (b.py[b.seg] > layout.H) b.active = false
          continue
        }
        const x0 = b.px[b.seg], y0 = b.py[b.seg], x1 = b.px[b.seg + 1], y1 = b.py[b.seg + 1]
        const dx = x1 - x0, dy = y1 - y0
        const len = Math.hypot(dx, dy) || 1
        b.t += b.speed / len
        if (b.t >= 1) { b.t = 0; b.seg++; if (b.seg >= b.px.length - 1) { b.active = false; level = Math.min(1, level + 0.006); continue } }
        const cx = x0 + dx * b.t, cy = y0 + dy * b.t
        ctx.fillStyle = b.color
        ctx.shadowBlur = 8; ctx.shadowColor = b.color
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill()
        ctx.shadowBlur = 0
      }

      // Réservoir — liquide
      level += (0.35 - level) * 0.002 // dérive douce vers un niveau de repos
      const rx = reservoir.x, rw = reservoir.w, rh = reservoir.h, ry = reservoir.y
      const liqH = rh * (0.25 + level * 0.6)
      const liqY = ry + rh - liqH
      ctx.save()
      const rr = 14
      ctx.beginPath()
      ctx.moveTo(rx + rr, ry); ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr); ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr)
      ctx.arcTo(rx, ry + rh, rx, ry, rr); ctx.arcTo(rx, ry, rx + rw, ry, rr); ctx.closePath()
      ctx.clip()
      const grad = ctx.createLinearGradient(0, liqY, 0, ry + rh)
      grad.addColorStop(0, fx.alt); grad.addColorStop(1, fx.bead)
      ctx.fillStyle = grad
      ctx.globalAlpha = 0.5
      ctx.fillRect(rx, liqY, rw, liqH)
      // vaguelette
      ctx.globalAlpha = 0.8; ctx.strokeStyle = fx.bead; ctx.lineWidth = 2
      ctx.beginPath()
      for (let x = rx; x <= rx + rw; x += 6) ctx.lineTo(x, liqY + Math.sin((x + frame * 2) / 18) * 2.5)
      ctx.stroke()
      ctx.restore()
      // contour réservoir
      ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(rx + rr, ry); ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr); ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr)
      ctx.arcTo(rx, ry + rh, rx, ry, rr); ctx.arcTo(rx, ry, rx + rw, ry, rr); ctx.closePath(); ctx.stroke()

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [layout, phase, signals])

  return <canvas ref={ref} className="absolute inset-0" style={{ width: W, height: layout.H }} />
}

// ── Racine ───────────────────────────────────────────────────────────────────
export function FluxView() {
  const { drawerScreen, open, close } = useDrawer()
  const game = useGameStore((s) => s.game)!
  const collectRevenue = useGameStore((s) => s.collectRevenue)
  const collectAll = useGameStore((s) => s.collectAllRevenue)
  const [selected, setSelected] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [flash, setFlash] = useState(false)
  const signals = useRef<{ bursts: number[] }>({ bursts: [] })

  const netWorth = calcNetWorth(game)
  const phase = game.economy.marketPhase
  const layout = useMemo(() => buildLayout(game), [game])

  const totalPending = game.investments.reduce((s, i) => s + (i.pendingRevenue ?? 0), 0)
  const readyCount = game.investments.filter((i) => (i.pendingRevenue ?? 0) > 0).length
  const passive = calcMonthlyPassiveIncome(game)
  const free = passive >= game.monthlyExpenses.total && passive > 0

  function collectModule(idx: number, inv: Investment) {
    if ((inv.pendingRevenue ?? 0) <= 0) { setSelected(inv.instanceId); return }
    signals.current.bursts.push(idx)
    collectRevenue(inv.instanceId)
  }
  function harvestAll() {
    layout.modules.forEach((m, i) => { if (m.pending > 0) signals.current.bursts.push(i) })
    const { total } = collectAll()
    if (total > 0) { setFlash(true); setTimeout(() => setFlash(false), 800) }
  }

  const selectedInv = game.investments.find((i) => i.instanceId === selected) ?? null

  return (
    <BetaShell accent="#071a1e" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 100%, #0a2230 0%, #061420 55%, #040d16 100%)' }} />

      <div className="absolute inset-0 overflow-y-auto hide-scrollbar">
        <div className="relative mx-auto" style={{ width: W, height: layout.H }}>
          <FluxCanvas layout={layout} phase={phase} signals={signals} />

          {/* Cuves (modules) */}
          {layout.modules.map((m, i) => {
            const item = getCatalogItem(m.inv.catalogId)
            const fs = fiscalStatus(m.inv, game)
            const sprite = getBuildingSprite(m.inv.catalogId)
            const lockColor = fs.kind === 'open' ? '#34d399' : fs.kind === 'hard' ? '#f87171' : '#fbbf24'
            const valveX = (m.x + layout.trunkX) / 2
            return (
              <div key={m.inv.instanceId}>
                {/* Vanne fiscale sur la branche */}
                <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-0.5 px-1 py-0.5 rounded-full"
                  style={{ left: valveX, top: m.y, background: '#0b1220ee', border: `1.5px solid ${lockColor}` }}>
                  {fs.kind === 'open' ? <Unlock size={9} style={{ color: lockColor }} /> : <Lock size={9} style={{ color: lockColor }} />}
                  <span className="text-[8px] font-black" style={{ color: lockColor }}>
                    {fs.kind === 'fiscal' && fs.yearsToFav != null ? `${fs.yearsToFav}a` : `${Math.round(fs.rate * 100)}%`}
                  </span>
                </div>

                {/* Bille prête (récolte) */}
                {m.pending > 0 && (
                  <button onClick={() => collectModule(i, m.inv)}
                    className="absolute z-20 -translate-x-1/2 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-black active:scale-90 transition-transform"
                    style={{ left: m.x, top: m.y - 40, background: '#fbbf24', color: '#431407', fontSize: 10, boxShadow: '0 2px 10px rgba(251,191,36,0.8)', animation: 'badgeBob 1.5s ease-in-out infinite' }}>
                    <Coins size={9} /> +{euro(m.pending)}
                  </button>
                )}

                {/* Cuve */}
                <button onClick={() => collectModule(i, m.inv)}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-xl flex items-center gap-2 px-2 py-1.5 active:brightness-110 transition-all"
                  style={{ left: m.x, top: m.y, width: CARD_W, background: `linear-gradient(160deg, ${m.color}2e, #0b1622ee)`, border: `1.5px solid ${m.color}66`, boxShadow: m.pending > 0 ? `0 0 14px ${m.color}55` : '0 4px 12px rgba(0,0,0,0.4)' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${m.color}22`, border: `1px solid ${m.color}55` }}>
                    {sprite ? <img src={sprite} alt="" className="w-full h-full object-contain p-0.5" draggable={false} /> : <Icon name={item.icon} size={18} style={{ color: '#fff' } as React.CSSProperties} />}
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="text-[11px] font-black text-white leading-tight truncate">{item.shortName}</div>
                    <div className="text-[10px] font-black" style={{ color: '#cbd5e1' }}>{euro(m.inv.currentValue)}</div>
                  </div>
                </button>
              </div>
            )
          })}

          {/* Réservoir — étiquette */}
          <div className="absolute -translate-x-1/2 text-center z-10 pointer-events-none"
            style={{ left: W / 2, top: layout.reservoir.y + layout.reservoir.h / 2 - 18 }}>
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: free ? '#fde68a' : '#7dd3fc' }}>
              {free ? '🕊️ Liberté' : 'Trésorerie'}
            </div>
            <div className="text-white font-black text-lg leading-none">{euro(game.cashBalance)}</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Passif {euro(passive)}/mois</div>
          </div>
        </div>
      </div>

      {/* En-tête flottant */}
      <div className="absolute top-2 right-3 z-20 px-2 py-1 rounded-full flex items-center gap-1 text-[10px] font-bold"
        style={{ background: 'rgba(0,0,0,0.4)', color: '#cbd5e1' }}>
        <Droplets size={11} /> {phase === 'crash' ? '⚠️ Fuite (krach)' : phase === 'bull' ? 'Débit fort' : phase === 'bear' ? 'Débit faible' : 'Débit stable'}
      </div>

      {/* Récolte globale */}
      {readyCount > 0 && (
        <button onClick={harvestAll}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-30 rounded-full flex items-center gap-2 px-4 py-2 active:scale-95 transition-transform"
          style={{ background: flash ? 'linear-gradient(135deg,#22c55e,#15803d)' : 'linear-gradient(135deg,#fbbf24,#d97706)', boxShadow: '0 4px 18px rgba(251,191,36,0.5)', transition: 'background .3s' }}>
          <Coins size={15} style={{ color: flash ? '#fff' : '#431407' }} />
          <span className="font-black text-sm" style={{ color: flash ? '#fff' : '#431407' }}>{flash ? '✓ Récolté !' : `Tout récolter · +${euro(totalPending)}`}</span>
        </button>
      )}

      {/* Raccorder un actif */}
      <button onClick={() => setBuilding(true)}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 rounded-full flex items-center gap-1.5 px-4 py-2.5 active:scale-95 transition-transform"
        style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', boxShadow: '0 6px 20px rgba(14,165,233,0.45)' }}>
        <Plus size={16} className="text-white" /> <span className="font-black text-sm text-white">Raccorder un actif</span>
      </button>

      {selectedInv && <AssetSheet inv={selectedInv} game={game} onClose={() => setSelected(null)} />}
      {building && <BuildSheet game={game} netWorth={netWorth} title="Raccorder un actif" onClose={() => setBuilding(false)} onGotoInvest={() => { setBuilding(false); open('marketplace') }} />}
    </BetaShell>
  )
}
