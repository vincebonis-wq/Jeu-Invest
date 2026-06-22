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

// ── District definitions ──────────────────────────────────────────────────────

interface BuildingDef { catalogId: InvestmentCategory; slots: number }
interface District {
  id: string
  label: string
  emoji: string
  hex: string
  buildings: BuildingDef[]
}

const DISTRICTS: District[] = [
  {
    id: 'finance',
    label: 'Financial District',
    emoji: '🏦',
    hex: '#38bdf8',
    buildings: [
      { catalogId: 'bourse_etf', slots: 3 },
      { catalogId: 'scpi', slots: 2 },
      { catalogId: 'obligations_etat', slots: 2 },
      { catalogId: 'produit_structure', slots: 1 },
    ],
  },
  {
    id: 'realestate',
    label: 'Real Estate Quarter',
    emoji: '🏠',
    hex: '#fbbf24',
    buildings: [
      { catalogId: 'immo_classique', slots: 2 },
      { catalogId: 'lmnp', slots: 2 },
      { catalogId: 'parking', slots: 3 },
      { catalogId: 'club_deal_immo', slots: 1 },
    ],
  },
  {
    id: 'business',
    label: 'Business Park',
    emoji: '🚀',
    hex: '#a78bfa',
    buildings: [
      { catalogId: 'business', slots: 2 },
      { catalogId: 'crowdfunding_immo', slots: 3 },
    ],
  },
  {
    id: 'alternative',
    label: 'Alternative Zone',
    emoji: '⚡',
    hex: '#fb923c',
    buildings: [
      { catalogId: 'crypto', slots: 2 },
      { catalogId: 'or_metaux', slots: 2 },
    ],
  },
  {
    id: 'savings',
    label: 'Savings Village',
    emoji: '🛡️',
    hex: '#34d399',
    buildings: [
      { catalogId: 'livret', slots: 1 },
      { catalogId: 'assurance_vie', slots: 2 },
    ],
  },
]

// Isometric plot geometry
const PLOT_W = 116
const PLOT_H = 64
const HALF_W = PLOT_W / 2
const HALF_H = PLOT_H / 2
const HEADROOM = 70 // space above plots for tall buildings

interface PlotData {
  key: string
  catalogId: InvestmentCategory
  inv: Investment | null
  unlocked: boolean
  threshold: number
  // grid pos
  col: number
  row: number
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function CityMapView() {
  const { drawerScreen, open, close } = useDrawer()
  const [selected, setSelected] = useState<Investment | null>(null)

  return (
    <BetaShell accent="#0b1120" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div
        className="h-full overflow-y-auto hide-scrollbar"
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, #1e293b 0%, #0b1120 55%, #060912 100%)',
        }}
      >
        <div className="px-2 py-3 space-y-2.5 pb-8">
          {DISTRICTS.map((d) => (
            <DistrictZone
              key={d.id}
              district={d}
              onSelect={setSelected}
              onBuild={() => open('marketplace')}
            />
          ))}
        </div>
      </div>

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

// ── District zone (isometric cluster) ─────────────────────────────────────────

function DistrictZone({
  district,
  onSelect,
  onBuild,
}: {
  district: District
  onSelect: (inv: Investment) => void
  onBuild: () => void
}) {
  const game = useGameStore((s) => s.game)!
  const netWorth = calcNetWorth(game)

  // Build the flat list of plots
  const flat: Omit<PlotData, 'col' | 'row'>[] = district.buildings.flatMap((b) => {
    const item = getCatalogItem(b.catalogId)
    const owned = game.investments.filter((inv) => inv.catalogId === b.catalogId)
    const unlocked = netWorth >= item.unlockThreshold
    return Array.from({ length: b.slots }, (_, i) => ({
      key: `${b.catalogId}-${i}`,
      catalogId: b.catalogId,
      inv: owned[i] ?? null,
      unlocked,
      threshold: item.unlockThreshold,
    }))
  })

  // Arrange in iso grid
  const COLS = flat.length <= 4 ? 2 : 3
  const plots: PlotData[] = flat.map((p, i) => ({
    ...p,
    col: i % COLS,
    row: Math.floor(i / COLS),
  }))

  // Compute iso positions + container size
  const positioned = plots.map((p) => ({
    plot: p,
    isoX: (p.col - p.row) * HALF_W,
    isoY: (p.col + p.row) * HALF_H,
  }))
  const xs = positioned.map((p) => p.isoX)
  const ys = positioned.map((p) => p.isoY)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const containerW = maxX - minX + PLOT_W
  const containerH = maxY - minY + PLOT_H + HEADROOM

  const totalValue = plots.reduce((s, p) => s + (p.inv?.currentValue ?? 0), 0)
  const ownedCount = plots.filter((p) => p.inv).length

  return (
    <div
      className="relative rounded-3xl overflow-hidden"
      style={{
        background: `radial-gradient(90% 70% at 50% 40%, ${district.hex}1f 0%, transparent 70%)`,
        border: `1px solid ${district.hex}22`,
      }}
    >
      {/* District label badge — floating top-left like reference */}
      <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5">
        <div
          className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-lg shadow-lg backdrop-blur-sm"
          style={{
            background: `linear-gradient(135deg, ${district.hex}cc, ${district.hex}88)`,
            boxShadow: `0 2px 12px ${district.hex}55`,
          }}
        >
          <span className="text-sm">{district.emoji}</span>
          <span className="text-[10px] font-extrabold text-white uppercase tracking-wider">
            {district.label}
          </span>
        </div>
      </div>

      {/* Holdings summary — top right */}
      {totalValue > 0 && (
        <div className="absolute top-2.5 right-3 z-30 text-right">
          <div className="text-sm font-extrabold leading-none" style={{ color: district.hex }}>
            {formatEuroCompact(totalValue)}
          </div>
          <div className="text-[9px] text-white/40 leading-none mt-0.5">
            {ownedCount} bâtiment{ownedCount > 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Iso scene */}
      <div className="w-full flex justify-center overflow-x-auto hide-scrollbar pt-9 pb-2">
        <div className="relative shrink-0" style={{ width: containerW, height: containerH }}>
          {positioned.map(({ plot, isoX, isoY }) => (
            <IsoPlot
              key={plot.key}
              plot={plot}
              district={district}
              left={isoX - minX}
              top={isoY - minY}
              z={plot.col + plot.row}
              onSelect={onSelect}
              onBuild={onBuild}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Isometric plot ────────────────────────────────────────────────────────────

function IsoPlot({
  plot,
  district,
  left,
  top,
  z,
  onSelect,
  onBuild,
}: {
  plot: PlotData
  district: District
  left: number
  top: number
  z: number
  onSelect: (inv: Investment) => void
  onBuild: () => void
}) {
  const { inv, unlocked, threshold, catalogId } = plot
  const item = getCatalogItem(catalogId)

  return (
    <div
      className="absolute"
      style={{ left, top, width: PLOT_W, height: PLOT_H + HEADROOM, zIndex: z }}
    >
      {/* Ground diamond (SVG for crisp dashed edges) */}
      <svg
        viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
        width={PLOT_W}
        height={PLOT_H}
        className="absolute left-0"
        style={{ top: HEADROOM }}
      >
        <polygon
          points={`${HALF_W},2 ${PLOT_W - 2},${HALF_H} ${HALF_W},${PLOT_H - 2} 2,${HALF_H}`}
          fill={inv ? `${item.color}1f` : 'rgba(255,255,255,0.02)'}
          stroke={
            inv ? `${item.color}aa` : unlocked ? `${district.hex}88` : 'rgba(148,163,184,0.35)'
          }
          strokeWidth={1.5}
          strokeDasharray={inv ? undefined : '5 4'}
        />
      </svg>

      {/* Content on the plot */}
      {inv ? (
        <OwnedBuilding inv={inv} district={district} onClick={() => onSelect(inv)} />
      ) : unlocked ? (
        <EmptyPlot item={item} onClick={onBuild} />
      ) : (
        <LockedPlot threshold={threshold} />
      )}
    </div>
  )
}

// ── Owned building (sprite + animations) ──────────────────────────────────────

function OwnedBuilding({
  inv,
  district,
  onClick,
}: {
  inv: Investment
  district: District
  onClick: () => void
}) {
  const [now, setNow] = useState(Date.now())
  const item = getCatalogItem(inv.catalogId)
  const level = inv.level ?? 1
  const sprite = getBuildingSprite(inv.catalogId)
  const isUpgrading = !!inv.upgradeReadyAtReal && inv.upgradeReadyAtReal > now
  const rate = inv.annualReturnRate + getInvestmentLevelBonus(inv.catalogId, level)

  // Level-up flash detection
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
    const t = setInterval(() => setPing((p) => p + 1), 4000 + Math.random() * 2000)
    return () => clearInterval(t)
  }, [inv.monthlyIncome])

  const secsLeft = isUpgrading ? Math.max(0, Math.round((inv.upgradeReadyAtReal! - now) / 1000)) : 0
  const timer =
    secsLeft > 3600
      ? `${Math.floor(secsLeft / 3600)}h${String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0')}`
      : secsLeft > 60
      ? `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`
      : `${secsLeft}s`

  // Slight per-instance phase so buildings don't bob in unison
  const phase = (parseInt(inv.instanceId.slice(-3), 36) % 100) / 100

  return (
    <button
      onClick={onClick}
      className="absolute inset-x-0 spawn-pop"
      style={{ top: 0, height: HEADROOM + PLOT_H }}
    >
      {/* Glow halo under building base */}
      <div
        className="iso-glow absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          top: HEADROOM + 4,
          width: PLOT_W * 0.78,
          height: PLOT_H * 0.78,
          background: `radial-gradient(ellipse, ${item.color}66 0%, transparent 70%)`,
          animationDelay: `${phase * -3}s`,
        }}
      />

      {/* Building sprite (bobbing) — base planted on diamond front vertex */}
      <div
        className="iso-bob absolute left-1/2 -translate-x-1/2 flex items-end justify-center"
        style={{
          top: 0,
          width: PLOT_W * 0.92,
          height: HEADROOM + PLOT_H,
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
              filter: `drop-shadow(0 6px 8px rgba(0,0,0,0.5))`,
            }}
            draggable={false}
          />
        ) : (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-1"
            style={{ background: item.color + '30', boxShadow: `0 0 14px ${item.color}55` }}
          >
            <Icon name={item.icon} size={26} style={{ color: item.color } as React.CSSProperties} />
          </div>
        )}
      </div>

      {/* Level dots — above info chip */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex gap-0.5"
        style={{ top: HEADROOM + PLOT_H - 30 }}
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

      {/* Info chip at plot front */}
      <div
        className="absolute left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md whitespace-nowrap"
        style={{
          top: HEADROOM + PLOT_H - 16,
          background: 'rgba(2,6,23,0.82)',
          border: `1px solid ${item.color}40`,
          backdropFilter: 'blur(4px)',
        }}
      >
        {isUpgrading ? (
          <span className="text-[10px] font-bold text-amber-300">⏳ {timer}</span>
        ) : (
          <span className="text-[10px] font-extrabold text-white">
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
          style={{ top: HEADROOM - 18, color: '#4ade80', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
        >
          +{formatEuroCompact(inv.monthlyIncome)}
        </span>
      )}
    </button>
  )
}

// ── Empty plot (available to build) ───────────────────────────────────────────

function EmptyPlot({ item, onClick }: { item: ReturnType<typeof getCatalogItem>; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center group"
      style={{ top: HEADROOM + 6, width: PLOT_W * 0.6, height: PLOT_H - 12 }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)' }}
      >
        <Plus size={16} className="text-white/40 group-hover:text-white/70 transition-colors" />
      </div>
      <span className="mt-1 text-[8px] text-white/35 font-semibold truncate max-w-full">
        {item.shortName ?? item.name.split(' ')[0]}
      </span>
    </button>
  )
}

// ── Locked plot ───────────────────────────────────────────────────────────────

function LockedPlot({ threshold }: { threshold: number }) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center"
      style={{ top: HEADROOM + 8, width: PLOT_W * 0.7, height: PLOT_H - 14 }}
    >
      <Lock size={15} className="text-slate-500" />
      <span className="mt-0.5 text-[8px] text-slate-500 font-bold uppercase tracking-wide">Locked</span>
      <span className="text-[8px] text-slate-600 font-semibold">{formatEuroCompact(threshold)}</span>
    </div>
  )
}

// ── Building detail sheet ─────────────────────────────────────────────────────

function BuildingSheet({
  inv,
  onClose,
  onPortfolio,
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
    <div className="absolute inset-0 z-30 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        className="relative rounded-t-3xl p-5 pb-10 shadow-2xl animate-slide-up"
        style={{
          background: `linear-gradient(160deg, ${item.color}20, rgba(2,6,23,0.98))`,
          border: `1px solid ${item.color}35`,
          borderBottom: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
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
          <Stat label="Valeur actuelle" value={formatEuroCompact(inv.currentValue)} color={item.color} />
          <Stat label="Rendement/an" value={`+${(rate * 100).toFixed(2)} %`} color="#34d399" />
          <Stat
            label="Plus-value"
            value={`${gain >= 0 ? '+' : ''}${formatEuroCompact(gain)}`}
            sub={`${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)} %`}
            color={gain >= 0 ? '#34d399' : '#f87171'}
          />
          {inv.monthlyIncome > 0 && (
            <Stat label="Revenu/mois" value={`+${formatEuroCompact(inv.monthlyIncome)}`} color="#fbbf24" />
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

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
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
