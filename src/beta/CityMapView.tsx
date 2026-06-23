import { useState, useEffect } from 'react'
import { Lock, Plus, ArrowUpCircle, Clock, X, ChevronRight, Hammer } from 'lucide-react'
import { useGameStore } from '../store/gameStore'
import { calcNetWorth } from '../utils/calculations'
import { getCatalogItem } from '../data/investments'
import {
  getInvestmentLevelBonus,
  getUpgradeCost,
  TIER_LABELS,
  LEVEL_LABELS,
} from '../data/upgradeTiers'
import { formatEuroCompact } from '../utils/formatting'
import type { InvestmentCategory } from '../types'
import { Icon } from '../components/ui/Icon'
import { BetaShell, useDrawer } from './BetaShell'
import { getBuildingSprite } from './buildingSprites'

// ─── District data ────────────────────────────────────────────────────────────

interface Slot { catalogId: InvestmentCategory; slotIndex: number }

interface DistrictDef {
  id: string
  label: string
  emoji: string
  hex: string
  /** Clip-path polygon (% of map canvas) giving the isometric zone shape */
  clip: string
  /** Absolute center of the label badge (px, relative to map canvas) */
  badgeX: number
  badgeY: number
  /** Preview buildings shown on the map (first 4 owned/empty/locked) */
  previewSlots: Slot[]
  /** Rough xy positions for each preview building inside the zone (0-1 relative) */
  previewPos: { rx: number; ry: number }[]
  /** All slots managed in the bottom panel */
  slots: Slot[]
}

const CITY: DistrictDef[] = [
  {
    id: 'finance',
    label: 'Financial District',
    emoji: '📈',
    hex: '#38bdf8',
    // Top-left diamond zone
    clip: 'polygon(50% 0%, 95% 20%, 72% 47%, 28% 47%, 5% 20%)',
    badgeX: 96, badgeY: 48,
    previewSlots: [
      { catalogId: 'bourse_etf', slotIndex: 0 },
      { catalogId: 'bourse_etf', slotIndex: 1 },
      { catalogId: 'scpi', slotIndex: 0 },
      { catalogId: 'obligations_etat', slotIndex: 0 },
    ],
    previewPos: [
      { rx: 0.28, ry: 0.38 },
      { rx: 0.48, ry: 0.26 },
      { rx: 0.68, ry: 0.38 },
      { rx: 0.48, ry: 0.55 },
    ],
    slots: [
      { catalogId: 'bourse_etf', slotIndex: 0 },
      { catalogId: 'bourse_etf', slotIndex: 1 },
      { catalogId: 'bourse_etf', slotIndex: 2 },
      { catalogId: 'scpi', slotIndex: 0 },
      { catalogId: 'scpi', slotIndex: 1 },
      { catalogId: 'obligations_etat', slotIndex: 0 },
      { catalogId: 'obligations_etat', slotIndex: 1 },
      { catalogId: 'produit_structure', slotIndex: 0 },
    ],
  },
  {
    id: 'realestate',
    label: 'Real Estate Quarter',
    emoji: '🏠',
    hex: '#fbbf24',
    // Top-right diamond zone
    clip: 'polygon(50% 0%, 95% 20%, 72% 47%, 28% 47%, 5% 20%)',
    badgeX: 288, badgeY: 42,
    previewSlots: [
      { catalogId: 'immo_classique', slotIndex: 0 },
      { catalogId: 'lmnp', slotIndex: 0 },
      { catalogId: 'parking', slotIndex: 0 },
      { catalogId: 'parking', slotIndex: 1 },
    ],
    previewPos: [
      { rx: 0.28, ry: 0.38 },
      { rx: 0.52, ry: 0.26 },
      { rx: 0.72, ry: 0.38 },
      { rx: 0.48, ry: 0.55 },
    ],
    slots: [
      { catalogId: 'immo_classique', slotIndex: 0 },
      { catalogId: 'immo_classique', slotIndex: 1 },
      { catalogId: 'lmnp', slotIndex: 0 },
      { catalogId: 'lmnp', slotIndex: 1 },
      { catalogId: 'parking', slotIndex: 0 },
      { catalogId: 'parking', slotIndex: 1 },
      { catalogId: 'parking', slotIndex: 2 },
      { catalogId: 'club_deal_immo', slotIndex: 0 },
    ],
  },
  {
    id: 'business',
    label: 'Business Park',
    emoji: '🏭',
    hex: '#a78bfa',
    // Center diamond (wider)
    clip: 'polygon(50% 0%, 95% 28%, 95% 72%, 50% 100%, 5% 72%, 5% 28%)',
    badgeX: 192, badgeY: 200,
    previewSlots: [
      { catalogId: 'business', slotIndex: 0 },
      { catalogId: 'business', slotIndex: 1 },
      { catalogId: 'crowdfunding_immo', slotIndex: 0 },
      { catalogId: 'crowdfunding_immo', slotIndex: 1 },
    ],
    previewPos: [
      { rx: 0.32, ry: 0.36 },
      { rx: 0.56, ry: 0.28 },
      { rx: 0.68, ry: 0.52 },
      { rx: 0.36, ry: 0.60 },
    ],
    slots: [
      { catalogId: 'business', slotIndex: 0 },
      { catalogId: 'business', slotIndex: 1 },
      { catalogId: 'crowdfunding_immo', slotIndex: 0 },
      { catalogId: 'crowdfunding_immo', slotIndex: 1 },
      { catalogId: 'crowdfunding_immo', slotIndex: 2 },
    ],
  },
  {
    id: 'alternative',
    label: 'Alternative Zone',
    emoji: '⚡',
    hex: '#fb923c',
    // Bottom-left diamond
    clip: 'polygon(50% 0%, 95% 20%, 72% 47%, 28% 47%, 5% 20%)',
    badgeX: 96, badgeY: 338,
    previewSlots: [
      { catalogId: 'crypto', slotIndex: 0 },
      { catalogId: 'crypto', slotIndex: 1 },
      { catalogId: 'or_metaux', slotIndex: 0 },
      { catalogId: 'or_metaux', slotIndex: 1 },
    ],
    previewPos: [
      { rx: 0.30, ry: 0.38 },
      { rx: 0.52, ry: 0.26 },
      { rx: 0.70, ry: 0.38 },
      { rx: 0.50, ry: 0.58 },
    ],
    slots: [
      { catalogId: 'crypto', slotIndex: 0 },
      { catalogId: 'crypto', slotIndex: 1 },
      { catalogId: 'or_metaux', slotIndex: 0 },
      { catalogId: 'or_metaux', slotIndex: 1 },
    ],
  },
  {
    id: 'savings',
    label: 'Savings Village',
    emoji: '🛡️',
    hex: '#34d399',
    // Bottom-right diamond
    clip: 'polygon(50% 0%, 95% 20%, 72% 47%, 28% 47%, 5% 20%)',
    badgeX: 288, badgeY: 330,
    previewSlots: [
      { catalogId: 'livret', slotIndex: 0 },
      { catalogId: 'assurance_vie', slotIndex: 0 },
      { catalogId: 'assurance_vie', slotIndex: 1 },
    ],
    previewPos: [
      { rx: 0.32, ry: 0.30 },
      { rx: 0.58, ry: 0.30 },
      { rx: 0.46, ry: 0.54 },
      { rx: 0.5, ry: 0.5 },
    ],
    slots: [
      { catalogId: 'livret', slotIndex: 0 },
      { catalogId: 'assurance_vie', slotIndex: 0 },
      { catalogId: 'assurance_vie', slotIndex: 1 },
    ],
  },
]

// ─── Zone layout (position of each district's zone div in the map canvas) ────

// The 5 zones are absolutely positioned. Values are in px for a ~384px wide canvas.
// The canvas itself is full-width/height so these are effectively responsive.
type ZoneLayout = { left: string; top: string; width: string; height: string }

const ZONE_LAYOUT: Record<string, ZoneLayout> = {
  // top-left
  finance:     { left: '0%',    top: '0%',   width: '52%', height: '44%' },
  // top-right
  realestate:  { left: '48%',   top: '0%',   width: '52%', height: '44%' },
  // center (overlaps slightly with top/bottom — higher z-index)
  business:    { left: '12%',   top: '32%',  width: '76%', height: '38%' },
  // bottom-left
  alternative: { left: '0%',    top: '62%',  width: '52%', height: '38%' },
  // bottom-right
  savings:     { left: '48%',   top: '62%',  width: '52%', height: '38%' },
}

const ZONE_Z: Record<string, number> = {
  finance: 1, realestate: 1, business: 2, alternative: 1, savings: 1,
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function CityMapView() {
  const { drawerScreen, open, close } = useDrawer()
  const [activeId, setActiveId] = useState<string>('finance')
  const [slotAction, setSlotAction] = useState<{ catalogId: InvestmentCategory; slotIndex: number } | null>(null)
  const game = useGameStore(s => s.game)!
  const netWorth = calcNetWorth(game)

  const active = CITY.find(d => d.id === activeId)!

  return (
    <BetaShell accent="#050b18" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div className="h-full flex flex-col" style={{ background: '#050b18' }}>

        {/* ── City map ── */}
        <div className="relative flex-1 min-h-0 overflow-hidden">

          {/* Background grid / road texture */}
          <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="48" height="27" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
                <path d="M 48 0 L 0 0 0 27" fill="none" stroke="#4f6a8a" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* District zones */}
          {CITY.map(d => {
            const layout = ZONE_LAYOUT[d.id]
            const z = ZONE_Z[d.id]
            const isActive = d.id === activeId

            // Gather preview slots with state
            const previewBuildings = d.previewSlots.slice(0, 4).map(slot => {
              const item = getCatalogItem(slot.catalogId)
              const inv = game.investments.filter(i => i.catalogId === slot.catalogId)[slot.slotIndex] ?? null
              const unlocked = netWorth >= item.unlockThreshold
              const sprite = getBuildingSprite(slot.catalogId)
              return { slot, item, inv, unlocked, sprite }
            })

            const ownedCount = d.slots.filter(s =>
              game.investments.filter(i => i.catalogId === s.catalogId)[s.slotIndex]
            ).length
            const totalValue = d.slots.reduce((sum, s) => {
              const inv = game.investments.filter(i => i.catalogId === s.catalogId)[s.slotIndex]
              return sum + (inv?.currentValue ?? 0)
            }, 0)

            return (
              <button
                key={d.id}
                onClick={() => setActiveId(d.id)}
                className="absolute transition-all duration-200"
                style={{
                  ...layout,
                  zIndex: z,
                  outline: 'none',
                  border: 'none',
                  background: 'none',
                  padding: 0,
                }}
              >
                {/* Zone background */}
                <div
                  className="w-full h-full relative"
                  style={{
                    background: isActive
                      ? `radial-gradient(ellipse at 50% 50%, ${d.hex}28 0%, ${d.hex}0e 60%, transparent 85%)`
                      : `radial-gradient(ellipse at 50% 50%, ${d.hex}14 0%, ${d.hex}06 60%, transparent 85%)`,
                    border: `1.5px solid ${d.hex}${isActive ? '90' : '40'}`,
                    borderRadius: 20,
                    boxShadow: isActive
                      ? `0 0 32px ${d.hex}35, inset 0 0 24px ${d.hex}15`
                      : `0 0 12px ${d.hex}18`,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* District label badge */}
                  <div
                    className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap z-10"
                    style={{
                      background: `${d.hex}22`,
                      border: `1px solid ${d.hex}55`,
                      color: d.hex,
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    {d.emoji} {d.label.toUpperCase()}
                  </div>

                  {/* Owned count + value (bottom-right) */}
                  {totalValue > 0 && (
                    <div
                      className="absolute bottom-1.5 right-2 text-right"
                      style={{ color: d.hex }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 800 }}>{formatEuroCompact(totalValue)}</div>
                      <div style={{ fontSize: 8, opacity: 0.7 }}>{ownedCount}/{d.slots.length} bâtiments</div>
                    </div>
                  )}

                  {/* Preview buildings */}
                  {previewBuildings.map(({ slot, item, inv, unlocked, sprite }, i) => {
                    const pos = d.previewPos[i]
                    if (!pos) return null

                    return (
                      <div
                        key={`${slot.catalogId}-${slot.slotIndex}`}
                        className="absolute flex flex-col items-center"
                        style={{
                          left: `${pos.rx * 100}%`,
                          top: `${pos.ry * 100}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        {inv ? (
                          // Owned building
                          <div className="relative">
                            <div
                              className="iso-bob"
                              style={{
                                width: 52,
                                height: 52,
                                animationDelay: `${i * -0.9}s`,
                                filter: `drop-shadow(0 0 8px ${item.color}99)`,
                              }}
                            >
                              {sprite ? (
                                <img src={sprite} alt={item.name} className="w-full h-full object-contain" draggable={false} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center rounded-lg"
                                  style={{ background: item.color + '25', border: `1px solid ${item.color}55` }}>
                                  <Icon name={item.icon} size={22} style={{ color: item.color } as React.CSSProperties} />
                                </div>
                              )}
                            </div>
                            {/* Level indicator */}
                            <div className="flex gap-0.5 justify-center mt-0.5">
                              {Array.from({ length: 5 }).map((_, li) => (
                                <div key={li} className="w-1 h-1 rounded-full"
                                  style={{ background: li < (inv.level ?? 1) ? d.hex : 'rgba(255,255,255,0.12)' }} />
                              ))}
                            </div>
                          </div>
                        ) : unlocked ? (
                          // Empty unlocked slot
                          <div
                            className="flex items-center justify-center rounded-xl"
                            style={{
                              width: 44, height: 44,
                              border: `1.5px dashed ${d.hex}55`,
                              background: `${d.hex}08`,
                            }}
                          >
                            <Plus size={16} style={{ color: d.hex, opacity: 0.5 }} />
                          </div>
                        ) : (
                          // Locked slot
                          <div
                            className="flex flex-col items-center justify-center rounded-xl gap-0.5"
                            style={{
                              width: 44, height: 44,
                              border: '1.5px dashed rgba(148,163,184,0.2)',
                              background: 'rgba(255,255,255,0.02)',
                            }}
                          >
                            <Lock size={12} className="text-slate-600" />
                            <span style={{ fontSize: 7, color: '#475569', fontWeight: 700 }}>
                              {formatEuroCompact(item.unlockThreshold)}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Bottom building slots panel ── */}
        <div
          className="shrink-0"
          style={{ background: '#080f1e', borderTop: `1px solid ${active.hex}30` }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 pt-2.5 pb-1.5">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 14 }}>{active.emoji}</span>
              <span
                className="text-xs font-extrabold uppercase tracking-wider"
                style={{ color: active.hex }}
              >
                {active.label}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-semibold">
              Emplacements
            </div>
          </div>

          {/* Horizontal slot strip */}
          <div className="overflow-x-auto hide-scrollbar px-3 pb-3">
            <div className="flex gap-2.5" style={{ width: 'max-content' }}>
              {active.slots.map(slot => (
                <SlotCard
                  key={`${slot.catalogId}-${slot.slotIndex}`}
                  slot={slot}
                  districtHex={active.hex}
                  netWorth={netWorth}
                  onClick={() => setSlotAction(slot)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Slot action modal ── */}
      {slotAction && (
        <SlotModal
          slot={slotAction}
          onClose={() => setSlotAction(null)}
          onGotoPortfolio={() => { setSlotAction(null); open('portfolio') }}
        />
      )}
    </BetaShell>
  )
}

// ─── Slot card (in the bottom strip) ─────────────────────────────────────────

function SlotCard({
  slot, districtHex, netWorth, onClick,
}: {
  slot: Slot
  districtHex: string
  netWorth: number
  onClick: () => void
}) {
  const game = useGameStore(s => s.game)!
  const item = getCatalogItem(slot.catalogId)
  const inv = game.investments.filter(i => i.catalogId === slot.catalogId)[slot.slotIndex] ?? null
  const unlocked = netWorth >= item.unlockThreshold
  const sprite = getBuildingSprite(slot.catalogId)

  const [now, setNow] = useState(Date.now())
  const isUpgrading = !!inv?.upgradeReadyAtReal && inv.upgradeReadyAtReal > now
  const level = inv?.level ?? 1

  useEffect(() => {
    if (!isUpgrading) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [isUpgrading])

  const secsLeft = isUpgrading ? Math.max(0, Math.round((inv!.upgradeReadyAtReal! - now) / 1000)) : 0
  const timer =
    secsLeft > 3600
      ? `${Math.floor(secsLeft / 3600)}h${String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0')}`
      : secsLeft > 60
      ? `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`
      : `${secsLeft}s`

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center rounded-2xl transition-all active:scale-95"
      style={{
        width: 88, flexShrink: 0,
        background: inv
          ? `linear-gradient(145deg, ${item.color}18, rgba(5,11,24,0.9))`
          : 'rgba(255,255,255,0.04)',
        border: inv
          ? `1.5px solid ${item.color}55`
          : unlocked
          ? `1.5px dashed ${districtHex}40`
          : '1.5px dashed rgba(100,116,139,0.3)',
        padding: '8px 6px 6px',
      }}
    >
      {/* Building preview */}
      <div className="w-14 h-14 flex items-center justify-center relative">
        {inv ? (
          sprite ? (
            <img src={sprite} alt={item.name} className="w-full h-full object-contain"
              style={{ filter: `drop-shadow(0 2px 6px ${item.color}77)` }} draggable={false} />
          ) : (
            <div className="w-full h-full flex items-center justify-center rounded-xl"
              style={{ background: item.color + '22', border: `1px solid ${item.color}44` }}>
              <Icon name={item.icon} size={26} style={{ color: item.color } as React.CSSProperties} />
            </div>
          )
        ) : unlocked ? (
          <div className="w-12 h-12 flex items-center justify-center rounded-xl"
            style={{ border: `1.5px dashed ${districtHex}50`, background: `${districtHex}08` }}>
            <Plus size={18} style={{ color: districtHex, opacity: 0.5 }} />
          </div>
        ) : (
          <div className="w-12 h-12 flex flex-col items-center justify-center rounded-xl gap-1"
            style={{ border: '1.5px dashed rgba(100,116,139,0.25)' }}>
            <Lock size={14} className="text-slate-600" />
            <span className="text-[8px] text-slate-600 font-bold">{formatEuroCompact(item.unlockThreshold)}</span>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="text-[9px] font-bold text-center leading-tight mt-1 px-1"
        style={{ color: inv ? '#e2e8f0' : '#64748b' }}>
        {item.shortName ?? item.name.split(' ')[0]}
      </div>

      {/* Level dots / status */}
      {inv ? (
        <div className="mt-1">
          {isUpgrading ? (
            <div className="flex items-center gap-0.5 text-[8px] text-amber-300 font-bold">
              <Clock size={8} /> {timer}
            </div>
          ) : (
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{ background: i < level ? item.color : 'rgba(255,255,255,0.1)' }} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-1 text-[8px] font-bold"
          style={{ color: unlocked ? districtHex : '#475569', opacity: 0.7 }}>
          {unlocked ? 'Construire' : 'Verrouillé'}
        </div>
      )}
    </button>
  )
}

// ─── Slot modal (build or upgrade) ───────────────────────────────────────────

function SlotModal({
  slot, onClose, onGotoPortfolio,
}: {
  slot: Slot
  onClose: () => void
  onGotoPortfolio: () => void
}) {
  const game = useGameStore(s => s.game)!
  const buyInvestment = useGameStore(s => s.buyInvestment)
  const upgradeInvestment = useGameStore(s => s.upgradeInvestment)
  const cash = game.cashBalance
  const netWorth = calcNetWorth(game)

  const item = getCatalogItem(slot.catalogId)
  const inv = game.investments.filter(i => i.catalogId === slot.catalogId)[slot.slotIndex] ?? null
  const unlocked = netWorth >= item.unlockThreshold
  const sprite = getBuildingSprite(slot.catalogId)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const level = inv?.level ?? 1
  const isMax = level >= 5
  const isUpgrading = !!inv?.upgradeReadyAtReal && inv.upgradeReadyAtReal > now
  const targetLevel = level + 1
  const upgradeCost = isMax ? 0 : getUpgradeCost(item.minAmount, targetLevel)
  const buildCost = item.minAmount
  const isRE = ['parking', 'lmnp', 'immo_classique', 'club_deal_immo'].includes(slot.catalogId)

  useEffect(() => {
    if (!isUpgrading) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [isUpgrading])

  const secsLeft = isUpgrading ? Math.max(0, Math.round((inv!.upgradeReadyAtReal! - now) / 1000)) : 0
  const timer =
    secsLeft > 3600
      ? `${Math.floor(secsLeft / 3600)}h${String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0')}`
      : secsLeft > 60
      ? `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`
      : `${secsLeft}s`

  const rate = inv ? inv.annualReturnRate + getInvestmentLevelBonus(slot.catalogId, level) : item.baseAnnualReturn

  function handleBuild() {
    const r = buyInvestment(slot.catalogId, item.minAmount, false)
    if (r.success) onClose()
    else setFeedback(r.message)
  }

  function handleUpgrade() {
    if (!inv) return
    const r = upgradeInvestment(inv.instanceId)
    setFeedback(r.message)
    if (r.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative rounded-t-3xl p-5 pb-10 shadow-2xl"
        style={{
          background: `linear-gradient(160deg, ${item.color}1c, rgba(5,11,24,0.99))`,
          border: `1px solid ${item.color}30`,
          borderBottom: 'none',
          animation: 'slideUpPanel 0.22s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
              style={{ background: item.color + '18', border: `1.5px solid ${item.color}45` }}>
              {sprite
                ? <img src={sprite} alt={item.name} className="w-full h-full object-contain" />
                : <Icon name={item.icon} size={26} style={{ color: item.color } as React.CSSProperties} />
              }
            </div>
            <div>
              <div className="font-extrabold text-white text-base leading-tight">{item.name}</div>
              {inv && (
                <div className="flex gap-0.5 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="w-4 h-1.5 rounded-full"
                      style={{ background: i < level ? item.color : 'rgba(255,255,255,0.1)' }} />
                  ))}
                  <span className="text-[10px] font-bold ml-1" style={{ color: item.color }}>
                    {LEVEL_LABELS[level]}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {inv ? (
            <>
              <ModalStat label="Valeur actuelle" value={formatEuroCompact(inv.currentValue)} color={item.color} />
              <ModalStat label="Rendement/an" value={`+${(rate * 100).toFixed(2)} %`} color="#34d399" />
              {inv.monthlyIncome > 0 && (
                <ModalStat label="Revenu/mois" value={`+${formatEuroCompact(inv.monthlyIncome)}`} color="#fbbf24" />
              )}
              {!isMax && !isUpgrading && (
                <ModalStat label="Amélioration" value={formatEuroCompact(upgradeCost)} color={item.color} />
              )}
            </>
          ) : (
            <>
              <ModalStat label="Coût de construction" value={formatEuroCompact(buildCost)} color={item.color} />
              <ModalStat label="Rendement de base" value={`+${(item.baseAnnualReturn * 100).toFixed(1)} %`} color="#34d399" />
            </>
          )}
        </div>

        {/* Primary action */}
        {!inv ? (
          // BUILD
          !unlocked ? (
            <div className="w-full py-3.5 rounded-2xl text-center text-sm font-bold text-slate-500"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              🔒 Débloquer à {formatEuroCompact(item.unlockThreshold)} de patrimoine
            </div>
          ) : isRE ? (
            <button onClick={onGotoPortfolio}
              className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}88)`, boxShadow: `0 6px 20px ${item.color}40` }}>
              <Hammer size={16} /> Acheter (avec option crédit) <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={handleBuild}
              disabled={cash < buildCost}
              className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}88)`, boxShadow: `0 6px 20px ${item.color}40` }}>
              <Hammer size={16} /> Construire · {formatEuroCompact(buildCost)}
            </button>
          )
        ) : isUpgrading ? (
          // UPGRADING IN PROGRESS
          <div className="w-full py-3.5 rounded-2xl font-bold text-sm text-amber-300 flex items-center justify-center gap-2"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
            <Clock size={16} /> Amélioration en cours — {timer}
          </div>
        ) : isMax ? (
          // MAX LEVEL
          <div className="w-full py-3 rounded-2xl text-center text-sm font-extrabold"
            style={{ background: 'rgba(255,255,255,0.06)', color: item.color }}>
            ⭐ Niveau maximum atteint
          </div>
        ) : (
          // UPGRADE
          <button onClick={handleUpgrade}
            disabled={cash < upgradeCost}
            className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 6px 20px #f59e0b40' }}>
            <ArrowUpCircle size={16} />
            Améliorer → {LEVEL_LABELS[targetLevel]} · {formatEuroCompact(upgradeCost)}
            <span className="text-[10px] opacity-80">({TIER_LABELS[targetLevel]})</span>
          </button>
        )}

        {feedback && (
          <div className="text-center text-[11px] mt-2" style={{ color: feedback.startsWith('✓') ? '#4ade80' : '#94a3b8' }}>
            {feedback}
          </div>
        )}

        {inv && (
          <button onClick={onGotoPortfolio}
            className="w-full py-2.5 mt-2 rounded-2xl font-semibold text-xs text-white/60 flex items-center justify-center gap-1 transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            Gérer dans le portefeuille <ChevronRight size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function ModalStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
      <div className="text-sm font-extrabold leading-tight" style={{ color }}>{value}</div>
    </div>
  )
}
