import { useState, useEffect, useRef } from 'react'
import { Lock, Plus, X, ChevronRight } from 'lucide-react'
import { useGameStore } from '../store/gameStore'
import { calcNetWorth } from '../utils/calculations'
import { getCatalogItem } from '../data/investments'
import { getInvestmentLevelBonus } from '../data/upgradeTiers'
import { formatEuroCompact } from '../utils/formatting'
import type { Investment, InvestmentCategory } from '../types'
import { Icon } from '../components/ui/Icon'
import { BetaShell, useDrawer } from './BetaShell'
import { getBuildingSprite } from './buildingSprites'

/* ── Geometry ─────────────────────────────────────────────────────────────── */

const HW = 46        // iso half-width per tile
const HH = 26        // iso half-height per tile
const TW = HW * 2   // tile pixel width  = 92
const TH = HH * 2   // tile pixel height = 52
const HEADROOM = 60  // px above tile base for building sprite
const PAD = 70       // canvas padding on each side

function isoXY(col: number, row: number) {
  return { x: (col - row) * HW, y: (col + row) * HH }
}

/* ── District registry ────────────────────────────────────────────────────── */

interface DistrictDef { label: string; emoji: string; hex: string }

const DISTRICTS: Record<string, DistrictDef> = {
  savings:     { label: 'Épargne',            emoji: '🛡️', hex: '#34d399' },
  business:    { label: 'Business Park',      emoji: '🚀', hex: '#a78bfa' },
  finance:     { label: 'Financial District', emoji: '🏦', hex: '#38bdf8' },
  realestate:  { label: 'Real Estate',        emoji: '🏠', hex: '#fbbf24' },
  alternative: { label: 'Alternative',        emoji: '⚡', hex: '#fb923c' },
}

const ZONE_RADII: Record<string, number> = {
  savings: 105, business: 150, finance: 195, realestate: 195, alternative: 130,
}

/* ── Fixed slot layout ────────────────────────────────────────────────────── */

interface MapSlot {
  col: number; row: number
  catalogId: InvestmentCategory
  slotIndex: number
  districtId: string
}

const MAP_SLOTS: MapSlot[] = [
  // Épargne — top-left
  { col: 0, row: 0, catalogId: 'livret',        slotIndex: 0, districtId: 'savings' },
  { col: 1, row: 0, catalogId: 'assurance_vie', slotIndex: 0, districtId: 'savings' },
  { col: 0, row: 1, catalogId: 'assurance_vie', slotIndex: 1, districtId: 'savings' },

  // Business Park — center-left
  { col: 3, row: 0, catalogId: 'crowdfunding_immo', slotIndex: 0, districtId: 'business' },
  { col: 2, row: 1, catalogId: 'business',          slotIndex: 0, districtId: 'business' },
  { col: 3, row: 2, catalogId: 'business',          slotIndex: 1, districtId: 'business' },
  { col: 2, row: 3, catalogId: 'crowdfunding_immo', slotIndex: 1, districtId: 'business' },
  { col: 1, row: 3, catalogId: 'crowdfunding_immo', slotIndex: 2, districtId: 'business' },

  // Financial District — center-right
  { col: 5, row: 0, catalogId: 'bourse_etf',        slotIndex: 0, districtId: 'finance' },
  { col: 6, row: 0, catalogId: 'bourse_etf',        slotIndex: 1, districtId: 'finance' },
  { col: 7, row: 1, catalogId: 'bourse_etf',        slotIndex: 2, districtId: 'finance' },
  { col: 5, row: 2, catalogId: 'obligations_etat',  slotIndex: 0, districtId: 'finance' },
  { col: 6, row: 2, catalogId: 'scpi',              slotIndex: 0, districtId: 'finance' },
  { col: 7, row: 3, catalogId: 'scpi',              slotIndex: 1, districtId: 'finance' },
  { col: 5, row: 4, catalogId: 'obligations_etat',  slotIndex: 1, districtId: 'finance' },
  { col: 6, row: 4, catalogId: 'produit_structure', slotIndex: 0, districtId: 'finance' },

  // Real Estate — bottom-left
  { col: 0, row: 4, catalogId: 'immo_classique', slotIndex: 0, districtId: 'realestate' },
  { col: 1, row: 4, catalogId: 'immo_classique', slotIndex: 1, districtId: 'realestate' },
  { col: 0, row: 5, catalogId: 'lmnp',           slotIndex: 0, districtId: 'realestate' },
  { col: 1, row: 5, catalogId: 'lmnp',           slotIndex: 1, districtId: 'realestate' },
  { col: 0, row: 6, catalogId: 'parking',        slotIndex: 0, districtId: 'realestate' },
  { col: 1, row: 6, catalogId: 'parking',        slotIndex: 1, districtId: 'realestate' },
  { col: 2, row: 6, catalogId: 'parking',        slotIndex: 2, districtId: 'realestate' },
  { col: 0, row: 7, catalogId: 'club_deal_immo', slotIndex: 0, districtId: 'realestate' },

  // Alternative — bottom-right
  { col: 7, row: 5, catalogId: 'or_metaux', slotIndex: 0, districtId: 'alternative' },
  { col: 8, row: 6, catalogId: 'or_metaux', slotIndex: 1, districtId: 'alternative' },
  { col: 7, row: 7, catalogId: 'crypto',    slotIndex: 0, districtId: 'alternative' },
  { col: 8, row: 8, catalogId: 'crypto',    slotIndex: 1, districtId: 'alternative' },
]

/* ── Canvas bounds (computed once) ───────────────────────────────────────── */

const ALL_ISO = MAP_SLOTS.map(s => isoXY(s.col, s.row))
const MIN_X = Math.min(...ALL_ISO.map(p => p.x))
const MAX_X = Math.max(...ALL_ISO.map(p => p.x))
const MIN_Y = Math.min(...ALL_ISO.map(p => p.y))
const MAX_Y = Math.max(...ALL_ISO.map(p => p.y))
const OX = -MIN_X + PAD   // x offset: normalise coords to canvas
const OY = -MIN_Y + PAD   // y offset
const CANVAS_W = MAX_X - MIN_X + TW + PAD * 2
const CANVAS_H = MAX_Y - MIN_Y + TH + HEADROOM + PAD * 2

/* Compute halo centre for each district */
const ZONE_HALOS = Object.entries(DISTRICTS).map(([id, def]) => {
  const slots = MAP_SLOTS.filter(s => s.districtId === id)
  const avgCol = slots.reduce((s, p) => s + p.col, 0) / slots.length
  const avgRow = slots.reduce((s, p) => s + p.row, 0) / slots.length
  const { x, y } = isoXY(avgCol, avgRow)
  const r = ZONE_RADII[id] ?? 130
  return { id, def, cx: x + OX + HW, cy: y + OY + HH, r }
})

/* ── Root component ───────────────────────────────────────────────────────── */

export function CityMapView() {
  const { drawerScreen, open, close } = useDrawer()
  const [selected, setSelected] = useState<Investment | null>(null)
  const game = useGameStore(s => s.game)!
  const netWorth = calcNetWorth(game)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to show center of city on first mount
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = Math.max(0, (CANVAS_W - el.clientWidth) / 2 - 40)
    el.scrollTop = Math.max(0, (CANVAS_H - el.clientHeight) / 3)
  }, [])

  // Sort slots by iso depth for correct z-ordering
  const sortedSlots = [...MAP_SLOTS].sort((a, b) => (a.col + a.row) - (b.col + b.row))

  return (
    <BetaShell accent="#0b1120" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div
        ref={scrollRef}
        className="h-full overflow-auto hide-scrollbar"
        style={{
          background: 'radial-gradient(120% 80% at 50% 0%, #1e293b 0%, #0b1120 55%, #060912 100%)',
        }}
      >
        {/* ── Single city canvas ── */}
        <div
          className="relative"
          style={{ width: CANVAS_W, height: CANVAS_H, minWidth: CANVAS_W }}
        >
          {/* District zone background halos */}
          {ZONE_HALOS.map(({ id, def, cx, cy, r }) => (
            <div
              key={id}
              className="absolute pointer-events-none"
              style={{
                left: cx - r,
                top: cy - r * 0.62,
                width: r * 2,
                height: r * 1.24,
                borderRadius: '50%',
                background: `radial-gradient(ellipse, ${def.hex}1a 0%, ${def.hex}0a 50%, transparent 75%)`,
              }}
            />
          ))}

          {/* District label badges — floating above their zone */}
          {ZONE_HALOS.map(({ id, def, cx, cy, r }) => (
            <div
              key={id}
              className="absolute pointer-events-none flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{
                left: cx - 44,
                top: cy - r * 0.62 - 2,
                background: `${def.hex}18`,
                border: `1px solid ${def.hex}35`,
                color: def.hex,
                fontSize: 10,
                fontWeight: 700,
                backdropFilter: 'blur(4px)',
                letterSpacing: '0.04em',
                zIndex: 1,
              }}
            >
              {def.emoji} {def.label}
            </div>
          ))}

          {/* All building slots */}
          {sortedSlots.map(slot => {
            const { x, y } = isoXY(slot.col, slot.row)
            const item = getCatalogItem(slot.catalogId)
            const owned = game.investments.filter(i => i.catalogId === slot.catalogId)
            const inv = owned[slot.slotIndex] ?? null
            const unlocked = netWorth >= item.unlockThreshold
            const district = DISTRICTS[slot.districtId]

            return (
              <MapPlot
                key={`${slot.catalogId}-${slot.slotIndex}`}
                left={x + OX}
                top={y + OY}
                depth={slot.col + slot.row}
                catalogId={slot.catalogId}
                inv={inv}
                unlocked={unlocked}
                threshold={item.unlockThreshold}
                district={district}
                onSelect={setSelected}
                onBuild={() => open('marketplace')}
              />
            )
          })}
        </div>
      </div>

      {/* Building detail sheet */}
      {selected && (
        <BuildingSheet
          inv={selected}
          onClose={() => setSelected(null)}
          onPortfolio={() => { setSelected(null); open('portfolio') }}
        />
      )}
    </BetaShell>
  )
}

/* ── Single isometric plot ────────────────────────────────────────────────── */

function MapPlot({
  left, top, depth,
  catalogId, inv, unlocked, threshold, district,
  onSelect, onBuild,
}: {
  left: number; top: number; depth: number
  catalogId: InvestmentCategory
  inv: Investment | null
  unlocked: boolean; threshold: number
  district: DistrictDef
  onSelect: (i: Investment) => void
  onBuild: () => void
}) {
  const item = getCatalogItem(catalogId)

  return (
    <div
      className="absolute"
      style={{ left, top, width: TW, height: TH + HEADROOM, zIndex: depth * 2 }}
    >
      {/* Ground diamond */}
      <svg
        viewBox={`0 0 ${TW} ${TH}`}
        width={TW}
        height={TH}
        className="absolute left-0"
        style={{ top: HEADROOM }}
      >
        <polygon
          points={`${HW},2 ${TW - 2},${HH} ${HW},${TH - 2} 2,${HH}`}
          fill={inv ? `${item.color}1c` : `${district.hex}0a`}
          stroke={
            inv
              ? `${item.color}99`
              : unlocked
              ? `${district.hex}55`
              : 'rgba(148,163,184,0.18)'
          }
          strokeWidth={1.5}
          strokeDasharray={inv ? undefined : '4 3'}
        />
      </svg>

      {/* Building content */}
      {inv ? (
        <OwnedBuilding inv={inv} district={district} depth={depth} onClick={() => onSelect(inv)} />
      ) : unlocked ? (
        <EmptySlot item={item} onClick={onBuild} />
      ) : (
        <LockedSlot threshold={threshold} />
      )}
    </div>
  )
}

/* ── Owned building (sprite + animations) ────────────────────────────────── */

function OwnedBuilding({
  inv, district, depth, onClick,
}: {
  inv: Investment
  district: DistrictDef
  depth: number
  onClick: () => void
}) {
  const [now, setNow] = useState(Date.now())
  const item = getCatalogItem(inv.catalogId)
  const level = inv.level ?? 1
  const sprite = getBuildingSprite(inv.catalogId)
  const isUpgrading = !!inv.upgradeReadyAtReal && inv.upgradeReadyAtReal > now
  const rate = inv.annualReturnRate + getInvestmentLevelBonus(inv.catalogId, level)

  // Level-up flash
  const prevLevel = useRef(level)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (level > prevLevel.current) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 900)
      return () => clearTimeout(t)
    }
    prevLevel.current = level
  }, [level])

  // Upgrade timer tick
  useEffect(() => {
    if (!isUpgrading) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [isUpgrading])

  // Floating income ping
  const [ping, setPing] = useState(0)
  useEffect(() => {
    if (inv.monthlyIncome <= 0) return
    const t = setInterval(() => setPing(p => p + 1), 4000 + Math.random() * 2000)
    return () => clearInterval(t)
  }, [inv.monthlyIncome])

  const secsLeft = isUpgrading ? Math.max(0, Math.round((inv.upgradeReadyAtReal! - now) / 1000)) : 0
  const timer =
    secsLeft > 3600
      ? `${Math.floor(secsLeft / 3600)}h${String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0')}`
      : secsLeft > 60
      ? `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`
      : `${secsLeft}s`

  // Per-instance phase so buildings don't bob in unison
  const phase = (parseInt(inv.instanceId.slice(-3), 36) % 100) / 100

  return (
    <button
      onClick={onClick}
      className="absolute inset-x-0 spawn-pop"
      style={{ top: 0, height: HEADROOM + TH, zIndex: depth * 2 + 1 }}
    >
      {/* Glow halo */}
      <div
        className="iso-glow absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          top: HEADROOM + 4,
          width: TW * 0.78,
          height: TH * 0.78,
          background: `radial-gradient(ellipse, ${item.color}60 0%, transparent 70%)`,
          animationDelay: `${phase * -3}s`,
        }}
      />

      {/* Building sprite (bobbing) */}
      <div
        className="iso-bob absolute left-1/2 -translate-x-1/2 flex items-end justify-center"
        style={{
          top: 0,
          width: TW * 0.94,
          height: HEADROOM + TH,
          animationDelay: `${phase * -3.4}s`,
        }}
      >
        {sprite ? (
          <img
            src={sprite}
            alt={item.name}
            className={flash ? 'levelup-flash' : ''}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.5))',
            }}
            draggable={false}
          />
        ) : (
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-1"
            style={{ background: item.color + '30', boxShadow: `0 0 14px ${item.color}55` }}
          >
            <Icon name={item.icon} size={24} style={{ color: item.color } as React.CSSProperties} />
          </div>
        )}
      </div>

      {/* Level dots */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex gap-0.5"
        style={{ top: HEADROOM + TH - 30 }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: i < level ? district.hex : 'rgba(255,255,255,0.12)',
              boxShadow: i < level ? `0 0 4px ${district.hex}` : undefined,
            }}
          />
        ))}
      </div>

      {/* Info chip at tile front */}
      <div
        className="absolute left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md whitespace-nowrap"
        style={{
          top: HEADROOM + TH - 16,
          background: 'rgba(2,6,23,0.82)',
          border: `1px solid ${item.color}40`,
          backdropFilter: 'blur(4px)',
        }}
      >
        {isUpgrading ? (
          <span className="text-[9px] font-bold text-amber-300">⏳ {timer}</span>
        ) : (
          <span className="text-[9px] font-extrabold text-white">
            {formatEuroCompact(inv.currentValue)}
            <span className="ml-1 font-semibold" style={{ color: district.hex }}>
              +{(rate * 100).toFixed(1)}%
            </span>
          </span>
        )}
      </div>

      {/* Floating income */}
      {inv.monthlyIncome > 0 && !isUpgrading && (
        <span
          key={ping}
          className="income-float absolute left-1/2 text-[11px] font-extrabold pointer-events-none"
          style={{
            top: HEADROOM - 16,
            color: '#4ade80',
            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
          }}
        >
          +{formatEuroCompact(inv.monthlyIncome)}
        </span>
      )}
    </button>
  )
}

/* ── Empty slot ───────────────────────────────────────────────────────────── */

function EmptySlot({
  item, onClick,
}: {
  item: ReturnType<typeof getCatalogItem>
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center group"
      style={{ top: HEADROOM + 8, width: TW * 0.6, height: TH - 14 }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)' }}
      >
        <Plus size={14} className="text-white/40 group-hover:text-white/70 transition-colors" />
      </div>
      <span className="mt-0.5 text-[8px] text-white/35 font-semibold truncate max-w-full">
        {item.shortName ?? item.name.split(' ')[0]}
      </span>
    </button>
  )
}

/* ── Locked slot ──────────────────────────────────────────────────────────── */

function LockedSlot({ threshold }: { threshold: number }) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center"
      style={{ top: HEADROOM + 10, width: TW * 0.7, height: TH - 16 }}
    >
      <Lock size={13} className="text-slate-600" />
      <span className="mt-0.5 text-[8px] text-slate-600 font-bold">{formatEuroCompact(threshold)}</span>
    </div>
  )
}

/* ── Building detail sheet ────────────────────────────────────────────────── */

function BuildingSheet({
  inv, onClose, onPortfolio,
}: {
  inv: Investment
  onClose: () => void
  onPortfolio: () => void
}) {
  const item = getCatalogItem(inv.catalogId)
  const level = inv.level ?? 1
  const rate = inv.annualReturnRate + getInvestmentLevelBonus(inv.catalogId, level)
  const sprite = getBuildingSprite(inv.catalogId)
  const gain = inv.currentValue - inv.purchasePrice
  const gainPct = inv.purchasePrice > 0 ? (gain / inv.purchasePrice) * 100 : 0

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        className="relative rounded-t-3xl p-5 pb-10 shadow-2xl animate-slide-up"
        style={{
          background: `linear-gradient(160deg, ${item.color}20, rgba(2,6,23,0.98))`,
          border: `1px solid ${item.color}35`,
          borderBottom: 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden shrink-0"
              style={{
                background: item.color + '18',
                border: `1.5px solid ${item.color}50`,
                boxShadow: `0 0 20px ${item.color}30`,
              }}
            >
              {sprite ? (
                <img src={sprite} alt={item.name} className="w-14 h-14 object-contain" />
              ) : (
                <Icon name={item.icon} size={30} style={{ color: item.color } as React.CSSProperties} />
              )}
            </div>
            <div>
              <div className="font-extrabold text-white text-base leading-tight">{item.name}</div>
              <div className="flex gap-1 mt-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-4 h-1.5 rounded-full"
                    style={{
                      background: i < level ? item.color : 'rgba(255,255,255,0.1)',
                      boxShadow: i < level ? `0 0 6px ${item.color}` : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <SheetStat label="Valeur actuelle" value={formatEuroCompact(inv.currentValue)} color={item.color} />
          <SheetStat label="Rendement/an" value={`+${(rate * 100).toFixed(2)} %`} color="#34d399" />
          <SheetStat
            label="Plus-value"
            value={`${gain >= 0 ? '+' : ''}${formatEuroCompact(gain)}`}
            sub={`${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)} %`}
            color={gain >= 0 ? '#34d399' : '#f87171'}
          />
          {inv.monthlyIncome > 0 && (
            <SheetStat label="Revenu/mois" value={`+${formatEuroCompact(inv.monthlyIncome)}`} color="#fbbf24" />
          )}
        </div>

        <button
          onClick={onPortfolio}
          className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${item.color}, ${item.color}88)`,
            boxShadow: `0 6px 20px ${item.color}40`,
          }}
        >
          Gérer dans le portefeuille <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

function SheetStat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="text-[10px] text-slate-500 mb-1">{label}</div>
      <div className="text-sm font-extrabold leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}
