import { useState, useEffect } from 'react'
import { Lock, Plus, X, ChevronDown } from 'lucide-react'
import { useGameStore } from '../store/gameStore'
import { calcNetWorth } from '../utils/calculations'
import { getCatalogItem } from '../data/investments'
import { getInvestmentLevelBonus } from '../data/upgradeTiers'
import { formatEuroCompact, cn } from '../utils/formatting'
import type { Investment, InvestmentCategory } from '../types'
import { Icon } from '../components/ui/Icon'
import { BetaShell, useDrawer } from './BetaShell'

// ── District definitions (matches image zones) ───────────────────────────────

interface BuildingDef { catalogId: InvestmentCategory; slots: number }
interface District {
  id: string
  label: string
  emoji: string
  color: string          // hex accent
  glowClass: string      // tailwind shadow utility
  bgFrom: string         // gradient start (rgba)
  bgTo: string           // gradient end
  gridArea: string
  buildings: BuildingDef[]
}

const DISTRICTS: District[] = [
  {
    id: 'finance',
    label: 'Financial District',
    emoji: '🏦',
    color: '#38bdf8',
    glowClass: 'shadow-sky-500/30',
    bgFrom: 'rgba(14,116,144,0.35)',
    bgTo: 'rgba(7,89,133,0.15)',
    gridArea: 'finance',
    buildings: [
      { catalogId: 'bourse_etf', slots: 4 },
      { catalogId: 'obligations_etat', slots: 2 },
      { catalogId: 'scpi', slots: 3 },
      { catalogId: 'produit_structure', slots: 2 },
    ],
  },
  {
    id: 'realestate',
    label: 'Real Estate Quarter',
    emoji: '🏠',
    color: '#fbbf24',
    glowClass: 'shadow-amber-500/30',
    bgFrom: 'rgba(180,83,9,0.35)',
    bgTo: 'rgba(120,53,15,0.15)',
    gridArea: 'realestate',
    buildings: [
      { catalogId: 'immo_classique', slots: 3 },
      { catalogId: 'lmnp', slots: 3 },
      { catalogId: 'parking', slots: 4 },
    ],
  },
  {
    id: 'business',
    label: 'Business Park',
    emoji: '🚀',
    color: '#a78bfa',
    glowClass: 'shadow-purple-500/30',
    bgFrom: 'rgba(109,40,217,0.35)',
    bgTo: 'rgba(76,29,149,0.15)',
    gridArea: 'business',
    buildings: [
      { catalogId: 'business', slots: 2 },
      { catalogId: 'crowdfunding_immo', slots: 4 },
      { catalogId: 'club_deal_immo', slots: 2 },
    ],
  },
  {
    id: 'alternative',
    label: 'Alternative Zone',
    emoji: '⚡',
    color: '#fb923c',
    glowClass: 'shadow-orange-500/30',
    bgFrom: 'rgba(194,65,12,0.35)',
    bgTo: 'rgba(154,52,18,0.15)',
    gridArea: 'alternative',
    buildings: [
      { catalogId: 'crypto', slots: 3 },
      { catalogId: 'or_metaux', slots: 2 },
    ],
  },
  {
    id: 'savings',
    label: 'Savings Village',
    emoji: '🛡️',
    color: '#34d399',
    glowClass: 'shadow-emerald-500/30',
    bgFrom: 'rgba(6,95,70,0.35)',
    bgTo: 'rgba(5,46,22,0.15)',
    gridArea: 'savings',
    buildings: [
      { catalogId: 'livret', slots: 1 },
      { catalogId: 'assurance_vie', slots: 2 },
    ],
  },
]

// ── Main view ─────────────────────────────────────────────────────────────────

export function CityMapView() {
  const { drawerScreen, open, close } = useDrawer()
  const [selected, setSelected] = useState<Investment | null>(null)

  return (
    <BetaShell accent="#1e1b4b" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div className="h-full flex flex-col bg-slate-950 overflow-hidden">
        {/* City map — scrollable */}
        <div className="flex-1 overflow-y-auto p-2 pb-4 space-y-2 hide-scrollbar">
          {/* Grid top row: Finance + RealEstate */}
          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-3">
              <DistrictCard district={DISTRICTS[0]} onSelect={setSelected} onMarket={() => open('marketplace')} />
            </div>
            <div className="col-span-2">
              <DistrictCard district={DISTRICTS[1]} onSelect={setSelected} onMarket={() => open('marketplace')} />
            </div>
          </div>
          {/* Grid bottom row: Business + Alternative + Savings */}
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-2">
              <DistrictCard district={DISTRICTS[2]} onSelect={setSelected} onMarket={() => open('marketplace')} />
            </div>
            <div className="col-span-1">
              <DistrictCard district={DISTRICTS[3]} onSelect={setSelected} onMarket={() => open('marketplace')} />
            </div>
            <div className="col-span-1">
              <DistrictCard district={DISTRICTS[4]} onSelect={setSelected} onMarket={() => open('marketplace')} />
            </div>
          </div>
        </div>

        {/* Active slots panel */}
        <ActiveSlotsPanel onOpenPortfolio={() => open('portfolio')} />
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

// ── District card ─────────────────────────────────────────────────────────────

function DistrictCard({
  district,
  onSelect,
  onMarket,
}: {
  district: District
  onSelect: (inv: Investment) => void
  onMarket: () => void
}) {
  const game = useGameStore((s) => s.game)!
  const netWorth = calcNetWorth(game)

  return (
    <div
      className={cn('rounded-2xl p-2 border shadow-lg flex flex-col gap-1.5', district.glowClass)}
      style={{
        background: `linear-gradient(135deg, ${district.bgFrom}, ${district.bgTo})`,
        borderColor: district.color + '40',
        boxShadow: `0 0 20px ${district.color}15, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      {/* District label */}
      <div className="flex items-center gap-1 px-0.5">
        <span className="text-[11px]">{district.emoji}</span>
        <span
          className="text-[10px] font-bold tracking-wide uppercase"
          style={{ color: district.color }}
        >
          {district.label}
        </span>
      </div>

      {/* Buildings grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {district.buildings.flatMap((b) =>
          Array.from({ length: b.slots }, (_, i) => ({ ...b, slotIdx: i }))
        ).map(({ catalogId, slotIdx }) => {
          const item = getCatalogItem(catalogId)
          const owned = game.investments.filter((inv) => inv.catalogId === catalogId)
          const inv = owned[slotIdx] ?? null
          const unlocked = netWorth >= item.unlockThreshold

          if (inv) {
            return (
              <BuildingTile
                key={`${catalogId}-${slotIdx}`}
                inv={inv}
                district={district}
                onClick={() => onSelect(inv)}
              />
            )
          }
          if (!unlocked) {
            return (
              <LockedTile
                key={`${catalogId}-${slotIdx}-locked`}
                threshold={item.unlockThreshold}
                icon={item.icon}
                color={item.color}
              />
            )
          }
          return (
            <EmptyTile
              key={`${catalogId}-${slotIdx}-empty`}
              icon={item.icon}
              color={item.color}
              onClick={onMarket}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Building tiles ─────────────────────────────────────────────────────────────

function BuildingTile({
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
  const isUpgrading = !!inv.upgradeReadyAtReal && inv.upgradeReadyAtReal > now
  const rate = inv.annualReturnRate + getInvestmentLevelBonus(inv.catalogId, level)

  useEffect(() => {
    if (!isUpgrading) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [isUpgrading])

  const secsLeft = isUpgrading ? Math.max(0, Math.round((inv.upgradeReadyAtReal! - now) / 1000)) : 0
  const upgradeLabel = secsLeft > 3600
    ? `${Math.floor(secsLeft / 3600)}h${String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0')}`
    : secsLeft > 60
    ? `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`
    : `${secsLeft}s`

  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-xl overflow-hidden transition-transform active:scale-90 hover:scale-105 group"
      style={{
        background: `linear-gradient(160deg, ${item.color}28 0%, ${item.color}10 100%)`,
        border: `1px solid ${item.color}50`,
        boxShadow: `0 2px 12px ${item.color}20, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      {/* Upgrade animation overlay */}
      {isUpgrading && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: `linear-gradient(to bottom, ${district.color}30, transparent)` }}
        />
      )}

      {/* Building icon (large, centered) */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ color: item.color, opacity: 0.9 }}
      >
        <Icon name={item.icon} size={22} />
      </div>

      {/* Level dots — top left */}
      <div className="absolute top-1 left-1 flex gap-0.5">
        {Array.from({ length: Math.min(level, 5) }).map((_, i) => (
          <div
            key={i}
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: district.color, boxShadow: `0 0 4px ${district.color}` }}
          />
        ))}
      </div>

      {/* Value + rate — bottom bar */}
      <div
        className="absolute bottom-0 left-0 right-0 px-1 py-1"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      >
        {isUpgrading ? (
          <div className="text-[9px] font-bold text-amber-300 text-center">⏳ {upgradeLabel}</div>
        ) : (
          <>
            <div className="text-[9px] font-bold text-white text-center leading-none">
              {formatEuroCompact(inv.currentValue)}
            </div>
            <div
              className="text-[8px] text-center leading-none mt-0.5"
              style={{ color: district.color }}
            >
              +{(rate * 100).toFixed(1)}%
            </div>
          </>
        )}
      </div>

      {/* Monthly income badge */}
      {inv.monthlyIncome > 0 && !isUpgrading && (
        <div
          className="absolute top-1 right-1 rounded-full px-1 text-[8px] font-bold text-white leading-tight"
          style={{ background: district.color + 'cc' }}
        >
          +{formatEuroCompact(inv.monthlyIncome)}
        </div>
      )}
    </button>
  )
}

function EmptyTile({ icon, color, onClick }: { icon: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-90 group"
      style={{
        border: `1.5px dashed rgba(255,255,255,0.12)`,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ color, opacity: 0.25 }} className="group-hover:opacity-50 transition-opacity">
        <Icon name={icon} size={16} />
      </div>
      <Plus size={10} className="text-white/15 group-hover:text-white/35 transition-colors" />
    </button>
  )
}

function LockedTile({ threshold, icon, color }: { threshold: number; icon: string; color: string }) {
  return (
    <div
      className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1"
      style={{
        background: 'rgba(15,23,42,0.6)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="opacity-20" style={{ color }}>
        <Icon name={icon} size={14} />
      </div>
      <Lock size={9} className="text-slate-600" />
      <div className="text-[8px] text-slate-600 font-medium">
        {formatEuroCompact(threshold)}
      </div>
    </div>
  )
}

// ── Active slots panel (bottom) ────────────────────────────────────────────────

function ActiveSlotsPanel({ onOpenPortfolio }: { onOpenPortfolio: () => void }) {
  const game = useGameStore((s) => s.game)!
  const [expanded, setExpanded] = useState(false)

  const active = game.investments
    .filter((i) => i.currentValue > 0)
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, expanded ? 8 : 3)

  if (active.length === 0) return null

  return (
    <div
      className="shrink-0 border-t"
      style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(2,6,23,0.9)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Building Slots ({game.investments.length})
        </span>
        <button onClick={() => setExpanded((e) => !e)} className="text-slate-500 hover:text-slate-300 transition-colors">
          <ChevronDown size={16} className={cn('transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>
      <div className="flex gap-2 px-2 pb-2 overflow-x-auto hide-scrollbar">
        {active.map((inv) => <ActiveSlotChip key={inv.instanceId} inv={inv} />)}
        <button
          onClick={onOpenPortfolio}
          className="shrink-0 flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-xl border border-white/10 text-slate-500 hover:text-slate-300 transition-colors text-[10px] font-bold"
        >
          <span className="text-lg">+</span>
          <span>Gérer</span>
        </button>
      </div>
    </div>
  )
}

function ActiveSlotChip({ inv }: { inv: Investment }) {
  const item = getCatalogItem(inv.catalogId)
  const level = inv.level ?? 1
  const isUpgrading = !!inv.upgradeReadyAtReal && inv.upgradeReadyAtReal > Date.now()

  return (
    <div
      className="shrink-0 flex flex-col items-center justify-between w-16 h-16 rounded-xl p-1.5"
      style={{
        background: `linear-gradient(135deg, ${item.color}20, ${item.color}08)`,
        border: `1px solid ${item.color}40`,
      }}
    >
      <div className="flex items-center gap-0.5">
        {Array.from({ length: level }).map((_, i) => (
          <div key={i} className="w-0.5 h-0.5 rounded-full" style={{ backgroundColor: item.color }} />
        ))}
      </div>
      <div style={{ color: item.color, opacity: 0.85 }}>
        <Icon name={item.icon} size={18} />
      </div>
      <div className="text-[8px] font-bold text-white/80 text-center leading-none">
        {isUpgrading ? '⏳' : formatEuroCompact(inv.currentValue)}
      </div>
    </div>
  )
}

// ── Building detail sheet ──────────────────────────────────────────────────────

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
  const gain = inv.currentValue - inv.purchasePrice
  const gainPct = inv.purchasePrice > 0 ? (gain / inv.purchasePrice) * 100 : 0

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative rounded-t-3xl p-5 pb-8 shadow-2xl animate-slide-up"
        style={{
          background: `linear-gradient(160deg, ${item.color}18, rgba(2,6,23,0.98))`,
          border: `1px solid ${item.color}30`,
          borderBottom: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-8 h-1 rounded-full bg-white/20 mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: item.color + '20',
                border: `1px solid ${item.color}40`,
                boxShadow: `0 0 16px ${item.color}30`,
              }}
            >
              <Icon name={item.icon} size={24} style={{ color: item.color } as React.CSSProperties} />
            </div>
            <div>
              <div className="font-bold text-white">{item.name}</div>
              <div className="flex gap-1 mt-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-3 h-1 rounded-full"
                    style={{ background: i < level ? item.color : 'rgba(255,255,255,0.1)' }}
                  />
                ))}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <SheetStat label="Valeur" value={formatEuroCompact(inv.currentValue)} color={item.color} />
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
          className="w-full py-3 rounded-2xl font-bold text-sm text-white transition-all active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${item.color}, ${item.color}99)`,
            boxShadow: `0 4px 16px ${item.color}40`,
          }}
        >
          Gérer dans le portefeuille →
        </button>
      </div>
    </div>
  )
}

function SheetStat({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div
      className="rounded-xl p-2.5"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  )
}
