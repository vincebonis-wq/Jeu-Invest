import { useState, useEffect } from 'react'
import { Lock, Plus, X, ChevronRight } from 'lucide-react'
import { useGameStore } from '../store/gameStore'
import { calcNetWorth } from '../utils/calculations'
import { getCatalogItem } from '../data/investments'
import { getInvestmentLevelBonus } from '../data/upgradeTiers'
import { formatEuroCompact } from '../utils/formatting'
import type { Investment, InvestmentCategory } from '../types'
import { Icon } from '../components/ui/Icon'
import { BetaShell, useDrawer } from './BetaShell'

// ── District definitions ──────────────────────────────────────────────────────

interface BuildingDef { catalogId: InvestmentCategory; slots: number }
interface District {
  id: string
  label: string
  sublabel: string
  emoji: string
  hex: string            // accent color
  buildings: BuildingDef[]
}

const DISTRICTS: District[] = [
  {
    id: 'finance',
    label: 'Financial District',
    sublabel: 'Marchés & placements',
    emoji: '🏦',
    hex: '#38bdf8',
    buildings: [
      { catalogId: 'bourse_etf', slots: 4 },
      { catalogId: 'scpi', slots: 3 },
      { catalogId: 'obligations_etat', slots: 2 },
      { catalogId: 'produit_structure', slots: 2 },
    ],
  },
  {
    id: 'realestate',
    label: 'Real Estate Quarter',
    sublabel: 'Immobilier & locatif',
    emoji: '🏠',
    hex: '#fbbf24',
    buildings: [
      { catalogId: 'immo_classique', slots: 3 },
      { catalogId: 'lmnp', slots: 3 },
      { catalogId: 'parking', slots: 4 },
      { catalogId: 'club_deal_immo', slots: 2 },
    ],
  },
  {
    id: 'business',
    label: 'Business Park',
    sublabel: 'Entrepreneuriat',
    emoji: '🚀',
    hex: '#a78bfa',
    buildings: [
      { catalogId: 'business', slots: 2 },
      { catalogId: 'crowdfunding_immo', slots: 4 },
    ],
  },
  {
    id: 'alternative',
    label: 'Alternative Zone',
    sublabel: 'Actifs risqués',
    emoji: '⚡',
    hex: '#fb923c',
    buildings: [
      { catalogId: 'crypto', slots: 3 },
      { catalogId: 'or_metaux', slots: 2 },
    ],
  },
  {
    id: 'savings',
    label: 'Savings Village',
    sublabel: 'Épargne sécurisée',
    emoji: '🛡️',
    hex: '#34d399',
    buildings: [
      { catalogId: 'livret', slots: 1 },
      { catalogId: 'assurance_vie', slots: 2 },
    ],
  },
]

// ── Root ──────────────────────────────────────────────────────────────────────

export function CityMapView() {
  const { drawerScreen, open, close } = useDrawer()
  const [selected, setSelected] = useState<Investment | null>(null)

  return (
    <BetaShell accent="#1e1b4b" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div className="h-full bg-slate-950 flex flex-col overflow-hidden">
        {/* Districts — vertical scroll */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 hide-scrollbar">
          {DISTRICTS.map((d) => (
            <DistrictRow
              key={d.id}
              district={d}
              onSelect={setSelected}
              onBuy={() => open('marketplace')}
            />
          ))}
          <div className="h-2" />
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

// ── District row ──────────────────────────────────────────────────────────────

function DistrictRow({
  district,
  onSelect,
  onBuy,
}: {
  district: District
  onSelect: (inv: Investment) => void
  onBuy: () => void
}) {
  const game = useGameStore((s) => s.game)!
  const netWorth = calcNetWorth(game)

  // Flatten all slots in order
  const tiles = district.buildings.flatMap((b) =>
    Array.from({ length: b.slots }, (_, i) => {
      const item = getCatalogItem(b.catalogId)
      const owned = game.investments.filter((inv) => inv.catalogId === b.catalogId)
      const inv = owned[i] ?? null
      const unlocked = netWorth >= item.unlockThreshold
      return { catalogId: b.catalogId, slotIdx: i, inv, unlocked, item }
    })
  )

  const ownedCount = tiles.filter((t) => t.inv).length
  const totalValue = tiles.reduce((s, t) => s + (t.inv?.currentValue ?? 0), 0)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(160deg, ${district.hex}18 0%, rgba(2,6,23,0.85) 60%)`,
        border: `1px solid ${district.hex}35`,
        boxShadow: `0 0 24px ${district.hex}12`,
      }}
    >
      {/* Zone header */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ background: district.hex + '22', border: `1px solid ${district.hex}40` }}
          >
            {district.emoji}
          </div>
          <div>
            <div className="text-xs font-extrabold text-white tracking-wide leading-tight">
              {district.label}
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">{district.sublabel}</div>
          </div>
        </div>
        {totalValue > 0 && (
          <div className="text-right">
            <div
              className="text-sm font-extrabold leading-tight"
              style={{ color: district.hex }}
            >
              {formatEuroCompact(totalValue)}
            </div>
            <div className="text-[10px] text-slate-500">{ownedCount} bâtiment{ownedCount > 1 ? 's' : ''}</div>
          </div>
        )}
      </div>

      {/* Horizontal scroll of buildings */}
      <div className="flex gap-2.5 px-3.5 pb-3.5 overflow-x-auto hide-scrollbar">
        {tiles.map(({ catalogId, slotIdx, inv, unlocked, item }) => {
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
                key={`${catalogId}-${slotIdx}-lock`}
                threshold={item.unlockThreshold}
                icon={item.icon}
              />
            )
          }
          return (
            <EmptyTile
              key={`${catalogId}-${slotIdx}-empty`}
              district={district}
              icon={item.icon}
              label={item.shortName ?? item.name.split(' ')[0]}
              onClick={onBuy}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Building tile (owned) ─────────────────────────────────────────────────────

const BUILDING_W = 88 // px

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
  const timer = secsLeft > 3600
    ? `${Math.floor(secsLeft / 3600)}h${String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0')}`
    : secsLeft > 60
    ? `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`
    : `${secsLeft}s`

  return (
    <button
      onClick={onClick}
      className="shrink-0 flex flex-col rounded-2xl overflow-hidden active:scale-95 transition-transform"
      style={{ width: BUILDING_W, minHeight: 116 }}
    >
      {/* Building body */}
      <div
        className="flex-1 flex flex-col items-center justify-center gap-1.5 pt-3 pb-2 px-2 relative"
        style={{
          background: `linear-gradient(160deg, ${item.color}38 0%, ${item.color}15 100%)`,
          border: `1px solid ${item.color}55`,
          borderBottom: 'none',
          borderRadius: '16px 16px 0 0',
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.10)`,
        }}
      >
        {/* Upgrade pulse */}
        {isUpgrading && (
          <div
            className="absolute inset-0 animate-pulse rounded-t-2xl"
            style={{ background: `linear-gradient(to bottom, ${district.hex}30, transparent)` }}
          />
        )}

        {/* Level dots */}
        <div className="flex gap-0.5 z-10">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: i < level ? district.hex : 'rgba(255,255,255,0.1)',
                boxShadow: i < level ? `0 0 4px ${district.hex}` : undefined,
              }}
            />
          ))}
        </div>

        {/* Icon — large */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center z-10"
          style={{
            background: item.color + '25',
            boxShadow: `0 0 14px ${item.color}40`,
          }}
        >
          <Icon name={item.icon} size={26} style={{ color: item.color } as React.CSSProperties} />
        </div>

        {/* Monthly income badge */}
        {inv.monthlyIncome > 0 && !isUpgrading && (
          <div
            className="absolute top-1.5 right-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white z-10"
            style={{ background: district.hex + 'dd' }}
          >
            +{formatEuroCompact(inv.monthlyIncome)}/m
          </div>
        )}
      </div>

      {/* Basement / info strip */}
      <div
        className="px-2 py-1.5 text-center"
        style={{
          background: item.color + '22',
          border: `1px solid ${item.color}40`,
          borderTop: `1px solid ${item.color}30`,
          borderRadius: '0 0 16px 16px',
        }}
      >
        {isUpgrading ? (
          <div className="text-[10px] font-bold text-amber-300">⏳ {timer}</div>
        ) : (
          <>
            <div className="text-[11px] font-extrabold text-white leading-tight">
              {formatEuroCompact(inv.currentValue)}
            </div>
            <div className="text-[9px] font-semibold leading-tight" style={{ color: district.hex }}>
              +{(rate * 100).toFixed(1)}%/an
            </div>
          </>
        )}
      </div>
    </button>
  )
}

// ── Empty tile ────────────────────────────────────────────────────────────────

function EmptyTile({
  district,
  icon,
  label,
  onClick,
}: {
  district: District
  icon: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 flex flex-col rounded-2xl overflow-hidden active:scale-95 transition-transform group"
      style={{ width: BUILDING_W, minHeight: 116 }}
    >
      <div
        className="flex-1 flex flex-col items-center justify-center gap-2 pt-3 pb-2 px-2"
        style={{
          border: `1.5px dashed rgba(255,255,255,0.12)`,
          borderBottom: 'none',
          borderRadius: '16px 16px 0 0',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div className="opacity-20 group-hover:opacity-40 transition-opacity" style={{ color: district.hex }}>
          <Icon name={icon} size={24} />
        </div>
        <Plus
          size={16}
          className="text-white/15 group-hover:text-white/40 transition-colors"
        />
      </div>
      <div
        className="px-2 py-1.5 text-center"
        style={{
          border: '1.5px dashed rgba(255,255,255,0.10)',
          borderTop: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: '0 0 16px 16px',
          background: 'rgba(255,255,255,0.01)',
        }}
      >
        <div className="text-[9px] text-slate-600 font-semibold truncate">{label}</div>
        <div className="text-[8px] text-slate-700">Disponible</div>
      </div>
    </button>
  )
}

// ── Locked tile ───────────────────────────────────────────────────────────────

function LockedTile({
  threshold,
  icon,
}: {
  threshold: number
  icon: string
}) {
  return (
    <div
      className="shrink-0 flex flex-col rounded-2xl overflow-hidden opacity-45"
      style={{ width: BUILDING_W, minHeight: 116 }}
    >
      <div
        className="flex-1 flex flex-col items-center justify-center gap-2 pt-3 pb-2 px-2"
        style={{
          background: 'rgba(15,23,42,0.7)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderBottom: 'none',
          borderRadius: '16px 16px 0 0',
        }}
      >
        <div className="text-slate-700">
          <Icon name={icon} size={22} />
        </div>
        <Lock size={14} className="text-slate-600" />
      </div>
      <div
        className="px-2 py-1.5 text-center"
        style={{
          background: 'rgba(15,23,42,0.6)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderTop: 'none',
          borderRadius: '0 0 16px 16px',
        }}
      >
        <div className="text-[9px] text-slate-600 font-semibold">
          {formatEuroCompact(threshold)}
        </div>
        <div className="text-[8px] text-slate-700">Verrouillé</div>
      </div>
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
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: item.color + '20',
                border: `1.5px solid ${item.color}50`,
                boxShadow: `0 0 20px ${item.color}30`,
              }}
            >
              <Icon name={item.icon} size={28} style={{ color: item.color } as React.CSSProperties} />
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
