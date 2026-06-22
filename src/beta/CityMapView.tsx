import { useState } from 'react'
import { Lock, Plus, X, TrendingUp } from 'lucide-react'
import { useGameStore } from '../store/gameStore'
import { calcNetWorth, calcMonthlyPassiveIncome } from '../utils/calculations'
import { getCatalogItem } from '../data/investments'
import { getInvestmentLevelBonus } from '../data/upgradeTiers'
import { formatEuroCompact, cn } from '../utils/formatting'
import type { Investment, InvestmentCategory } from '../types'
import { Icon } from '../components/ui/Icon'
import { BetaShell, useDrawer } from './BetaShell'

// ── Zone definitions ─────────────────────────────────────────────────────────

interface SlotDef {
  catalogId: InvestmentCategory
  maxSlots: number
}

interface ZoneDef {
  id: string
  label: string
  emoji: string
  accent: string         // tailwind color token (used in classes)
  slots: SlotDef[]
}

const ZONES: ZoneDef[] = [
  {
    id: 'epargne',
    label: 'Épargne sécurisée',
    emoji: '🏦',
    accent: 'sky',
    slots: [
      { catalogId: 'livret', maxSlots: 1 },
      { catalogId: 'assurance_vie', maxSlots: 2 },
      { catalogId: 'obligations_etat', maxSlots: 2 },
    ],
  },
  {
    id: 'marches',
    label: 'Marchés financiers',
    emoji: '📈',
    accent: 'indigo',
    slots: [
      { catalogId: 'bourse_etf', maxSlots: 4 },
      { catalogId: 'or_metaux', maxSlots: 2 },
      { catalogId: 'scpi', maxSlots: 3 },
      { catalogId: 'produit_structure', maxSlots: 2 },
    ],
  },
  {
    id: 'alternatifs',
    label: 'Investissements alternatifs',
    emoji: '⚡',
    accent: 'orange',
    slots: [
      { catalogId: 'crowdfunding_immo', maxSlots: 5 },
      { catalogId: 'crypto', maxSlots: 3 },
      { catalogId: 'club_deal_immo', maxSlots: 2 },
    ],
  },
  {
    id: 'business',
    label: 'Entrepreneuriat',
    emoji: '🚀',
    accent: 'purple',
    slots: [
      { catalogId: 'business', maxSlots: 2 },
    ],
  },
  {
    id: 'immo',
    label: 'Immobilier',
    emoji: '🏠',
    accent: 'amber',
    slots: [
      { catalogId: 'parking', maxSlots: 4 },
      { catalogId: 'lmnp', maxSlots: 3 },
      { catalogId: 'immo_classique', maxSlots: 3 },
    ],
  },
]

// Tailwind needs full class strings — no dynamic construction
const ACCENT_CLASSES: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  sky:    { bg: 'bg-sky-900/50',    border: 'border-sky-500/30',    text: 'text-sky-300',    glow: 'shadow-sky-500/20' },
  indigo: { bg: 'bg-indigo-900/50', border: 'border-indigo-500/30', text: 'text-indigo-300', glow: 'shadow-indigo-500/20' },
  orange: { bg: 'bg-orange-900/50', border: 'border-orange-500/30', text: 'text-orange-300', glow: 'shadow-orange-500/20' },
  purple: { bg: 'bg-purple-900/50', border: 'border-purple-500/30', text: 'text-purple-300', glow: 'shadow-purple-500/20' },
  amber:  { bg: 'bg-amber-900/50',  border: 'border-amber-500/30',  text: 'text-amber-300',  glow: 'shadow-amber-500/20' },
}

// ── Main view ────────────────────────────────────────────────────────────────

export function CityMapView() {
  const game = useGameStore((s) => s.game)!
  const { drawerScreen, open, close } = useDrawer()
  const [selectedInv, setSelectedInv] = useState<Investment | null>(null)

  return (
    <BetaShell accent="#4f46e5" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div className="h-full bg-slate-950 overflow-y-auto">
        <div className="p-3 sm:p-4 space-y-3 pb-6">
          {/* Summary bar */}
          <SummaryBar />

          {/* Zones */}
          {ZONES.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              game={game}
              netWorth={calcNetWorth(game)}
              onSelectInv={setSelectedInv}
              onOpenMarketplace={() => open('marketplace')}
            />
          ))}
        </div>
      </div>

      {/* Investment detail overlay */}
      {selectedInv && (
        <InvOverlay
          inv={selectedInv}
          onClose={() => setSelectedInv(null)}
          onOpenPortfolio={() => { setSelectedInv(null); open('portfolio') }}
        />
      )}
    </BetaShell>
  )
}

// ── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar() {
  const game = useGameStore((s) => s.game)!
  const passive = calcMonthlyPassiveIncome(game)
  const totalSlots = ZONES.flatMap((z) => z.slots).reduce((s, sl) => s + sl.maxSlots, 0)
  const usedSlots = game.investments.length

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-2">
        <TrendingUp size={13} className="text-emerald-400" />
        <span className="text-xs font-bold text-emerald-300">
          {formatEuroCompact(passive)}/mois
        </span>
      </div>
      <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-2">
        <span className="text-xs text-slate-400">Emplacements</span>
        <span className="text-xs font-bold text-white">{usedSlots} / {totalSlots}</span>
      </div>
    </div>
  )
}

// ── Zone card ────────────────────────────────────────────────────────────────

function ZoneCard({
  zone,
  game,
  netWorth,
  onSelectInv,
  onOpenMarketplace,
}: {
  zone: ZoneDef
  game: ReturnType<typeof useGameStore.getState>['game'] & object
  netWorth: number
  onSelectInv: (inv: Investment) => void
  onOpenMarketplace: () => void
}) {
  const ac = ACCENT_CLASSES[zone.accent]

  return (
    <div className={cn('rounded-2xl border p-3 sm:p-4', ac.bg, ac.border)}>
      <div className={cn('flex items-center gap-2 mb-3 text-sm font-bold', ac.text)}>
        <span>{zone.emoji}</span>
        <span>{zone.label}</span>
      </div>
      <div className="space-y-2">
        {zone.slots.map((slotDef) => (
          <SlotRow
            key={slotDef.catalogId}
            slotDef={slotDef}
            game={game}
            netWorth={netWorth}
            accent={zone.accent}
            onSelectInv={onSelectInv}
            onOpenMarketplace={onOpenMarketplace}
          />
        ))}
      </div>
    </div>
  )
}

// ── Slot row (one row per investment type) ───────────────────────────────────

function SlotRow({
  slotDef,
  game,
  netWorth,
  accent,
  onSelectInv,
  onOpenMarketplace,
}: {
  slotDef: SlotDef
  game: ReturnType<typeof useGameStore.getState>['game'] & object
  netWorth: number
  accent: string
  onSelectInv: (inv: Investment) => void
  onOpenMarketplace: () => void
}) {
  const item = getCatalogItem(slotDef.catalogId)
  const owned = (game.investments ?? []).filter((i: Investment) => i.catalogId === slotDef.catalogId)
  const unlocked = netWorth >= item.unlockThreshold

  return (
    <div className="flex items-center gap-2 min-w-0">
      {/* Label */}
      <div className="w-24 sm:w-28 shrink-0">
        <div className="text-[11px] text-white/60 font-medium leading-tight truncate">{item.shortName ?? item.name}</div>
        {!unlocked && (
          <div className="text-[10px] text-slate-500 leading-tight">≥ {formatEuroCompact(item.unlockThreshold)}</div>
        )}
      </div>

      {/* Slots */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar">
        {Array.from({ length: slotDef.maxSlots }).map((_, idx) => {
          const inv = owned[idx] ?? null
          if (inv) {
            return (
              <FilledSlot
                key={inv.instanceId}
                inv={inv}
                accent={accent}
                onClick={() => onSelectInv(inv)}
              />
            )
          }
          if (!unlocked) {
            return <LockedSlot key={idx} threshold={item.unlockThreshold} />
          }
          return (
            <EmptySlot key={idx} icon={item.icon} color={item.color} onClick={onOpenMarketplace} />
          )
        })}
      </div>
    </div>
  )
}

// ── Slot variants ─────────────────────────────────────────────────────────────

function FilledSlot({ inv, accent, onClick }: { inv: Investment; accent: string; onClick: () => void }) {
  const item = getCatalogItem(inv.catalogId)
  const level = inv.level ?? 1
  const effectiveRate = inv.annualReturnRate + getInvestmentLevelBonus(inv.catalogId, level)
  const ac = ACCENT_CLASSES[accent]

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-[72px] sm:w-20 h-[84px] sm:h-24 rounded-xl flex flex-col items-center justify-center gap-1 p-1.5 shrink-0 border transition-all active:scale-95 hover:scale-105 shadow-lg',
        ac.bg,
        ac.border,
        ac.glow,
      )}
      style={{ borderColor: item.color + '60', boxShadow: `0 0 12px ${item.color}22` }}
    >
      <div
        className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: item.color + '25', color: item.color }}
      >
        <Icon name={item.icon} size={18} />
      </div>
      <div className="text-[10px] font-bold text-white text-center leading-tight">
        {formatEuroCompact(inv.currentValue)}
      </div>
      <div className="text-[9px] text-white/50">+{(effectiveRate * 100).toFixed(1)}%</div>
      {/* Level dots */}
      {level > 1 && (
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn('w-1 h-1 rounded-full', i < level ? 'bg-white/80' : 'bg-white/15')}
            />
          ))}
        </div>
      )}
    </button>
  )
}

function EmptySlot({ icon, color, onClick }: { icon: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-[72px] sm:w-20 h-[84px] sm:h-24 rounded-xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-1 shrink-0 hover:border-white/40 transition-colors group active:scale-95"
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center opacity-30 group-hover:opacity-60 transition-opacity"
        style={{ backgroundColor: color + '20', color }}
      >
        <Icon name={icon} size={15} />
      </div>
      <Plus size={14} className="text-white/20 group-hover:text-white/50 transition-colors" />
    </button>
  )
}

function LockedSlot({ threshold }: { threshold: number }) {
  return (
    <div className="w-[72px] sm:w-20 h-[84px] sm:h-24 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center gap-1 shrink-0 opacity-50">
      <Lock size={16} className="text-slate-600" />
      <div className="text-[9px] text-slate-600 text-center leading-tight">
        {formatEuroCompact(threshold)}
      </div>
    </div>
  )
}

// ── Investment detail overlay ────────────────────────────────────────────────

function InvOverlay({
  inv,
  onClose,
  onOpenPortfolio,
}: {
  inv: Investment
  onClose: () => void
  onOpenPortfolio: () => void
}) {
  const item = getCatalogItem(inv.catalogId)
  const level = inv.level ?? 1
  const effectiveRate = inv.annualReturnRate + getInvestmentLevelBonus(inv.catalogId, level)
  const gain = inv.currentValue - inv.purchasePrice
  const gainPct = inv.purchasePrice > 0 ? (gain / inv.purchasePrice) * 100 : 0

  return (
    <div
      className="absolute inset-0 bg-black/70 backdrop-blur-sm z-30 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-white/15 rounded-2xl p-5 w-full max-w-xs shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: item.color + '25', color: item.color }}
            >
              <Icon name={item.icon} size={22} />
            </div>
            <div>
              <div className="font-bold text-white text-sm">{item.name}</div>
              <div className="text-xs text-slate-400">Niveau {level} / 5</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <Stat label="Valeur actuelle" value={formatEuroCompact(inv.currentValue)} />
          <Stat label="Rendement/an" value={`+${(effectiveRate * 100).toFixed(2)} %`} />
          <Stat
            label="Plus-value"
            value={`${gain >= 0 ? '+' : ''}${formatEuroCompact(gain)} (${gain >= 0 ? '+' : ''}${gainPct.toFixed(1)}%)`}
            green={gain >= 0}
          />
          {inv.monthlyIncome > 0 && (
            <Stat label="Revenu mensuel" value={`+${formatEuroCompact(inv.monthlyIncome)}/mois`} green />
          )}
        </div>

        <button
          onClick={onOpenPortfolio}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors"
        >
          Gérer dans le portefeuille →
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="bg-white/5 rounded-xl p-2.5">
      <div className="text-[10px] text-slate-500 leading-tight mb-0.5">{label}</div>
      <div className={cn('text-xs font-bold leading-tight', green ? 'text-emerald-400' : 'text-white')}>
        {value}
      </div>
    </div>
  )
}
