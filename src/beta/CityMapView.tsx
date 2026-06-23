/**
 * CityMapView — carte de ville prédéfinie style Sim Companies / Boom Beach.
 *
 * Architecture :
 *  • Carte fixe (pas de scroll) avec 5 quartiers et ~20 emplacements bâtiment.
 *  • Chaque bâtiment accumule ses revenus (pendingRevenue) que le joueur
 *    récupère en tapant dessus → boucle de rétention quotidienne.
 *  • Tap bâtiment → modal collect + upgrade.
 *  • Bouton "Tout collecter" en haut quand des bâtiments sont prêts.
 */

import { useState, useEffect } from 'react'
import {
  Lock, Plus, ArrowUpCircle, Clock, X, ChevronRight,
  Hammer, Coins, Sparkles, CheckCircle2,
} from 'lucide-react'
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

// ─── Types ───────────────────────────────────────────────────────────────────

type DistrictId = 'finance' | 'realestate' | 'business' | 'alternative' | 'savings'

interface MapSlot {
  id: string
  catalogId: InvestmentCategory
  slotIndex: number       // which instance (0-indexed) of that catalogId
  district: DistrictId
  x: number              // % of canvas width (0-100)
  y: number              // % of canvas height (0-100)
}

interface District {
  id: DistrictId
  label: string
  shortLabel: string
  emoji: string
  hex: string
  // Zone bounding box (% of canvas) — used for colored background
  zLeft: number; zTop: number; zRight: number; zBottom: number
}

// ─── Districts ────────────────────────────────────────────────────────────────

const DISTRICTS: District[] = [
  {
    id: 'finance',    label: 'Financial District', shortLabel: 'Finance',
    emoji: '📈', hex: '#38bdf8',
    zLeft: 0, zTop: 0, zRight: 49, zBottom: 47,
  },
  {
    id: 'realestate', label: 'Real Estate Quarter', shortLabel: 'Immobilier',
    emoji: '🏠', hex: '#fbbf24',
    zLeft: 51, zTop: 0, zRight: 100, zBottom: 47,
  },
  {
    id: 'business',   label: 'Business Park', shortLabel: 'Business',
    emoji: '🏭', hex: '#a78bfa',
    zLeft: 10, zTop: 46, zRight: 90, zBottom: 70,
  },
  {
    id: 'alternative', label: 'Alternative Zone', shortLabel: 'Alternatif',
    emoji: '⚡', hex: '#fb923c',
    zLeft: 0, zTop: 69, zRight: 49, zBottom: 100,
  },
  {
    id: 'savings',    label: 'Savings Village', shortLabel: 'Épargne',
    emoji: '🛡️', hex: '#34d399',
    zLeft: 51, zTop: 69, zRight: 100, zBottom: 100,
  },
]

// ─── Map slots (prédéfinis) ───────────────────────────────────────────────────
// x/y en % du canvas. 1 instance max par type sauf immo (3 max).

const MAP_SLOTS: MapSlot[] = [
  // Financial District
  { id: 'f1', catalogId: 'bourse_etf',        slotIndex: 0, district: 'finance',     x: 10, y: 12 },
  { id: 'f2', catalogId: 'scpi',              slotIndex: 0, district: 'finance',     x: 28, y:  6 },
  { id: 'f3', catalogId: 'obligations_etat',  slotIndex: 0, district: 'finance',     x: 43, y: 12 },
  { id: 'f4', catalogId: 'produit_structure', slotIndex: 0, district: 'finance',     x: 14, y: 34 },

  // Real Estate Quarter
  { id: 'r1', catalogId: 'immo_classique',    slotIndex: 0, district: 'realestate',  x: 57, y:  7 },
  { id: 'r2', catalogId: 'immo_classique',    slotIndex: 1, district: 'realestate',  x: 74, y: 12 },
  { id: 'r3', catalogId: 'lmnp',              slotIndex: 0, district: 'realestate',  x: 90, y:  7 },
  { id: 'r4', catalogId: 'parking',           slotIndex: 0, district: 'realestate',  x: 60, y: 32 },
  { id: 'r5', catalogId: 'parking',           slotIndex: 1, district: 'realestate',  x: 79, y: 34 },
  { id: 'r6', catalogId: 'club_deal_immo',    slotIndex: 0, district: 'realestate',  x: 93, y: 32 },

  // Business Park
  { id: 'b1', catalogId: 'business',          slotIndex: 0, district: 'business',    x: 22, y: 56 },
  { id: 'b2', catalogId: 'crowdfunding_immo', slotIndex: 0, district: 'business',    x: 42, y: 52 },
  { id: 'b3', catalogId: 'business',          slotIndex: 1, district: 'business',    x: 62, y: 56 },
  { id: 'b4', catalogId: 'crowdfunding_immo', slotIndex: 1, district: 'business',    x: 80, y: 52 },

  // Alternative Zone
  { id: 'a1', catalogId: 'crypto',            slotIndex: 0, district: 'alternative', x: 10, y: 76 },
  { id: 'a2', catalogId: 'or_metaux',         slotIndex: 0, district: 'alternative', x: 30, y: 72 },
  { id: 'a3', catalogId: 'crypto',            slotIndex: 1, district: 'alternative', x: 14, y: 90 },

  // Savings Village
  { id: 's1', catalogId: 'livret',            slotIndex: 0, district: 'savings',     x: 58, y: 74 },
  { id: 's2', catalogId: 'assurance_vie',     slotIndex: 0, district: 'savings',     x: 76, y: 72 },
  { id: 's3', catalogId: 'assurance_vie',     slotIndex: 1, district: 'savings',     x: 62, y: 89 },
  { id: 's4', catalogId: 'livret',            slotIndex: 1, district: 'savings',     x: 88, y: 87 },
]

// ─── Root component ───────────────────────────────────────────────────────────

export function CityMapView() {
  const { drawerScreen, open, close } = useDrawer()
  const game = useGameStore(s => s.game)!
  const collectAll = useGameStore(s => s.collectAllRevenue)

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [collectAnim, setCollectAnim] = useState<{ id: string; amount: number }[]>([])
  const netWorth = calcNetWorth(game)

  const totalPending = game.investments.reduce((s, i) => s + (i.pendingRevenue ?? 0), 0)
  const readyCount = game.investments.filter(i => (i.pendingRevenue ?? 0) > 0).length

  function handleCollectAll() {
    const { total } = collectAll()
    if (total > 0) {
      const animId = Date.now().toString()
      setCollectAnim(prev => [...prev, { id: animId, amount: total }])
      setTimeout(() => setCollectAnim(prev => prev.filter(a => a.id !== animId)), 1800)
    }
  }

  const selectedSlot = MAP_SLOTS.find(s => s.id === selectedSlotId)

  return (
    <BetaShell accent="#050b18" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div className="h-full flex flex-col overflow-hidden" style={{ background: '#060d1e' }}>

        {/* ── Collect-all banner ── */}
        {readyCount > 0 && (
          <button
            onClick={handleCollectAll}
            className="mx-3 mt-2 mb-1 rounded-2xl flex items-center justify-between px-4 py-2.5 active:scale-98 transition-transform"
            style={{
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              boxShadow: '0 4px 16px #f59e0b50',
            }}
          >
            <div className="flex items-center gap-2">
              <Coins size={16} className="text-amber-900" />
              <span className="text-amber-900 font-extrabold text-sm">
                {readyCount} bâtiment{readyCount > 1 ? 's' : ''} prêt{readyCount > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-amber-900 font-black text-sm">
                +{formatEuroCompact(totalPending)}
              </span>
              <span className="text-amber-800 text-xs font-bold">COLLECTER</span>
            </div>
          </button>
        )}

        {/* ── City map canvas ── */}
        <div className="relative flex-1 min-h-0 mx-2 mb-2 mt-1 rounded-2xl overflow-hidden"
          style={{ background: '#070e1c' }}>

          {/* SVG background: roads */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            {/* Subtle grid */}
            <defs>
              <pattern id="citygrid" width="40" height="22" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 22" fill="none" stroke="#0d1e35" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#citygrid)" />
            {/* Main roads */}
            <rect x="49%" y="0" width="2%" height="70%" fill="#040a14" />
            <rect x="0" y="46%" width="100%" height="3%" fill="#040a14" />
            <rect x="0" y="69%" width="100%" height="2%" fill="#040a14" />
            {/* Road center lines */}
            <line x1="50%" y1="0" x2="50%" y2="69%" stroke="#0f2040" strokeWidth="1" strokeDasharray="6 4" />
            <line x1="0" y1="47.5%" x2="100%" y2="47.5%" stroke="#0f2040" strokeWidth="1" strokeDasharray="6 4" />
            <line x1="0" y1="70%" x2="100%" y2="70%" stroke="#0f2040" strokeWidth="1" strokeDasharray="6 4" />
          </svg>

          {/* District zone backgrounds */}
          {DISTRICTS.map(d => (
            <div
              key={d.id}
              className="absolute pointer-events-none"
              style={{
                left: `${d.zLeft}%`,
                top: `${d.zTop}%`,
                width: `${d.zRight - d.zLeft}%`,
                height: `${d.zBottom - d.zTop}%`,
                background: `radial-gradient(ellipse at center, ${d.hex}12 0%, transparent 75%)`,
                border: `1px solid ${d.hex}22`,
              }}
            >
              {/* District badge */}
              <div
                className="absolute top-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{
                  background: `${d.hex}18`,
                  border: `1px solid ${d.hex}40`,
                  color: d.hex,
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                }}
              >
                {d.emoji} {d.shortLabel.toUpperCase()}
              </div>
            </div>
          ))}

          {/* Building slots */}
          {MAP_SLOTS.map(slot => (
            <BuildingSlot
              key={slot.id}
              slot={slot}
              netWorth={netWorth}
              isSelected={selectedSlotId === slot.id}
              onTap={() => setSelectedSlotId(prev => prev === slot.id ? null : slot.id)}
            />
          ))}

          {/* Floating collect animations */}
          {collectAnim.map(a => (
            <div
              key={a.id}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 font-black text-amber-300 pointer-events-none"
              style={{
                fontSize: 20,
                animation: 'floatUp 1.8s ease-out forwards',
                textShadow: '0 0 20px #fbbf24',
                zIndex: 100,
              }}
            >
              +{formatEuroCompact(a.amount)}
            </div>
          ))}
        </div>
      </div>

      {/* ── Slot modal ── */}
      {selectedSlot && (
        <SlotModal
          slot={selectedSlot}
          netWorth={netWorth}
          onClose={() => setSelectedSlotId(null)}
          onGotoPortfolio={() => { setSelectedSlotId(null); open('portfolio') }}
        />
      )}
    </BetaShell>
  )
}

// ─── Building slot (on the map) ───────────────────────────────────────────────

function BuildingSlot({
  slot, netWorth, isSelected, onTap,
}: {
  slot: MapSlot
  netWorth: number
  isSelected: boolean
  onTap: () => void
}) {
  const game = useGameStore(s => s.game)!
  const item = getCatalogItem(slot.catalogId)
  const inv = game.investments.filter(i => i.catalogId === slot.catalogId)[slot.slotIndex] ?? null
  const unlocked = netWorth >= item.unlockThreshold
  const sprite = getBuildingSprite(slot.catalogId)
  const pending = inv?.pendingRevenue ?? 0
  const isReady = pending > 0
  const level = inv?.level ?? 1

  // District color
  const district = DISTRICTS.find(d => d.id === slot.district)!
  const hex = district.hex

  return (
    <button
      onClick={onTap}
      className="absolute flex flex-col items-center"
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isSelected ? 30 : isReady ? 20 : 10,
        outline: 'none',
        border: 'none',
        background: 'none',
        padding: 0,
      }}
    >
      {/* Pending revenue badge */}
      {isReady && (
        <div
          className="mb-0.5 px-1.5 py-0.5 rounded-full font-black flex items-center gap-0.5"
          style={{
            background: '#fbbf24',
            color: '#431407',
            fontSize: 8,
            boxShadow: '0 2px 8px #fbbf2480',
            animation: 'floatBadge 2s ease-in-out infinite',
          }}
        >
          <Coins size={7} />
          {formatEuroCompact(pending)}
        </div>
      )}

      {/* Building visual */}
      <div
        className="relative flex items-center justify-center rounded-xl"
        style={{
          width: 58,
          height: 58,
          background: inv
            ? `radial-gradient(circle at 35% 35%, ${item.color}30, ${item.color}10)`
            : unlocked
            ? `rgba(255,255,255,0.03)`
            : `rgba(0,0,0,0.3)`,
          border: isSelected
            ? `2px solid ${inv ? item.color : hex}`
            : isReady
            ? `2px solid #fbbf24`
            : inv
            ? `1.5px solid ${item.color}55`
            : unlocked
            ? `1.5px dashed ${hex}35`
            : `1.5px dashed rgba(100,116,139,0.2)`,
          boxShadow: isSelected
            ? `0 0 0 3px ${inv ? item.color : hex}40, 0 0 20px ${inv ? item.color : hex}30`
            : isReady
            ? `0 0 12px #fbbf2455`
            : inv
            ? `0 0 8px ${item.color}20`
            : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        {inv ? (
          sprite ? (
            <img
              src={sprite}
              alt={item.name}
              draggable={false}
              className="w-full h-full object-contain p-1"
              style={{ filter: `drop-shadow(0 1px 4px ${item.color}80)` }}
            />
          ) : (
            <Icon name={item.icon} size={24} style={{ color: item.color } as React.CSSProperties} />
          )
        ) : unlocked ? (
          <Plus size={18} style={{ color: hex, opacity: 0.5 }} />
        ) : (
          <Lock size={14} className="text-slate-700" />
        )}

        {/* Level pip */}
        {inv && (
          <div
            className="absolute -bottom-0 -right-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black"
            style={{ background: item.color, color: '#000' }}
          >
            {level}
          </div>
        )}
      </div>

      {/* Ready glow ring */}
      {isReady && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ animation: 'pulseRing 1.5s ease-in-out infinite' }}
        />
      )}
    </button>
  )
}

// ─── Slot modal ───────────────────────────────────────────────────────────────

function SlotModal({
  slot, netWorth, onClose, onGotoPortfolio,
}: {
  slot: MapSlot
  netWorth: number
  onClose: () => void
  onGotoPortfolio: () => void
}) {
  const game = useGameStore(s => s.game)!
  const buyInvestment = useGameStore(s => s.buyInvestment)
  const upgradeInvestment = useGameStore(s => s.upgradeInvestment)
  const collectRevenue = useGameStore(s => s.collectRevenue)
  const cash = game.cashBalance

  const item = getCatalogItem(slot.catalogId)
  const inv = game.investments.filter(i => i.catalogId === slot.catalogId)[slot.slotIndex] ?? null
  const unlocked = netWorth >= item.unlockThreshold
  const sprite = getBuildingSprite(slot.catalogId)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [collected, setCollected] = useState(false)
  const [now, setNow] = useState(Date.now())

  const level = inv?.level ?? 1
  const isMax = level >= 5
  const isUpgrading = !!inv?.upgradeReadyAtReal && inv.upgradeReadyAtReal > now
  const targetLevel = level + 1
  const upgradeCost = isMax ? 0 : getUpgradeCost(item.minAmount, targetLevel)
  const buildCost = item.minAmount
  const isRealEstate = ['parking', 'lmnp', 'immo_classique', 'club_deal_immo'].includes(slot.catalogId)
  const pending = inv?.pendingRevenue ?? 0
  const isReady = pending > 0

  const secsLeft = isUpgrading ? Math.max(0, Math.round((inv!.upgradeReadyAtReal! - now) / 1000)) : 0
  const timer = secsLeft > 3600
    ? `${Math.floor(secsLeft / 3600)}h${String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0')}`
    : secsLeft > 60
    ? `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`
    : `${secsLeft}s`

  const district = DISTRICTS.find(d => d.id === slot.district)!

  useEffect(() => {
    if (!isUpgrading) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [isUpgrading])

  function handleCollect() {
    const { collected: amount } = collectRevenue(inv!.instanceId)
    if (amount > 0) {
      setCollected(true)
      setFeedback(`+${formatEuroCompact(amount)} collecté !`)
      setTimeout(() => { setCollected(false); onClose() }, 1200)
    }
  }

  function handleBuild() {
    const r = buyInvestment(slot.catalogId, item.minAmount, false)
    if (r.success) onClose()
    else setFeedback(r.message)
  }

  function handleUpgrade() {
    if (!inv) return
    const r = upgradeInvestment(inv.instanceId)
    setFeedback(r.message)
    if (r.success) setTimeout(onClose, 800)
  }

  const rate = inv
    ? inv.annualReturnRate + getInvestmentLevelBonus(slot.catalogId, level)
    : item.baseAnnualReturn

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative rounded-t-3xl pb-10 shadow-2xl"
        style={{
          background: `linear-gradient(165deg, ${item.color}1e 0%, #070e1c 60%)`,
          border: `1px solid ${item.color}30`,
          borderBottom: 'none',
          animation: 'slideUpPanel 0.2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3" />

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-3 pb-0">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: `radial-gradient(circle, ${item.color}25, ${item.color}0a)`,
              border: `1.5px solid ${item.color}50`,
            }}
          >
            {sprite
              ? <img src={sprite} alt={item.name} className="w-full h-full object-contain p-1" draggable={false} />
              : <Icon name={item.icon} size={30} style={{ color: item.color } as React.CSSProperties} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 11, color: district.hex, fontWeight: 800, letterSpacing: '0.06em' }}>
                {district.emoji} {district.shortLabel.toUpperCase()}
              </span>
            </div>
            <div className="font-black text-white text-base leading-tight mt-0.5">{item.name}</div>
            {inv && (
              <div className="flex items-center gap-1 mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-1.5 rounded-full flex-1"
                    style={{ background: i < level ? item.color : 'rgba(255,255,255,0.1)' }} />
                ))}
                <span className="text-[10px] font-bold ml-1 whitespace-nowrap" style={{ color: item.color }}>
                  Niv. {level} — {LEVEL_LABELS[level]}
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-white p-1 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Collect card (if revenue pending) */}
        {isReady && (
          <div className="mx-5 mt-4">
            <button
              onClick={handleCollect}
              className="w-full py-4 rounded-2xl flex items-center justify-between px-5 active:scale-98 transition-transform"
              style={{
                background: collected
                  ? 'rgba(34,197,94,0.2)'
                  : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                boxShadow: collected ? 'none' : '0 6px 20px #f59e0b50',
              }}
            >
              <div className="flex items-center gap-2">
                {collected ? <CheckCircle2 size={20} className="text-green-400" /> : <Coins size={20} className="text-amber-900" />}
                <div className="text-left">
                  <div className="font-black text-sm" style={{ color: collected ? '#4ade80' : '#431407' }}>
                    {collected ? 'Collecté !' : 'Revenus disponibles'}
                  </div>
                  <div className="text-[11px] font-semibold" style={{ color: collected ? '#86efac' : '#78350f' }}>
                    {collected ? '' : `Tap pour encaisser`}
                  </div>
                </div>
              </div>
              {!collected && (
                <div className="font-black text-xl" style={{ color: '#431407' }}>
                  +{formatEuroCompact(pending)}
                </div>
              )}
            </button>
          </div>
        )}

        {/* Stats row */}
        {inv ? (
          <div className="grid grid-cols-3 gap-2 mx-5 mt-3">
            <StatPill label="Valeur" value={formatEuroCompact(inv.currentValue)} color={item.color} />
            <StatPill label="Rendement" value={`${(rate * 100).toFixed(1)}%`} color="#34d399" />
            {inv.monthlyIncome > 0
              ? <StatPill label="Revenu/mois" value={`+${formatEuroCompact(inv.monthlyIncome)}`} color="#fbbf24" />
              : <StatPill label="Niveau" value={`${level}/5`} color={item.color} />
            }
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mx-5 mt-3">
            <StatPill label="Investissement min." value={formatEuroCompact(buildCost)} color={item.color} />
            <StatPill label="Rendement/an" value={`${(item.baseAnnualReturn * 100).toFixed(1)}%`} color="#34d399" />
          </div>
        )}

        {/* Primary action */}
        <div className="mx-5 mt-3 space-y-2">
          {!inv ? (
            !unlocked ? (
              <div className="w-full py-3.5 rounded-2xl text-center text-sm font-bold text-slate-500 flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Lock size={14} />
                Débloque à {formatEuroCompact(item.unlockThreshold)} de patrimoine
              </div>
            ) : isRealEstate ? (
              <button onClick={onGotoPortfolio}
                className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform"
                style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}88)`, boxShadow: `0 6px 20px ${item.color}40` }}>
                <Hammer size={16} /> Acheter · {formatEuroCompact(buildCost)}
                <ChevronRight size={14} className="opacity-70" />
              </button>
            ) : (
              <button onClick={handleBuild} disabled={cash < buildCost}
                className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}88)`, boxShadow: `0 6px 20px ${item.color}40` }}>
                <Hammer size={16} /> Construire · {formatEuroCompact(buildCost)}
              </button>
            )
          ) : isUpgrading ? (
            <div className="w-full py-3.5 rounded-2xl font-bold text-sm text-amber-300 flex items-center justify-center gap-2"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <Clock size={16} /> Amélioration en cours — {timer}
            </div>
          ) : isMax ? (
            <div className="w-full py-3 rounded-2xl text-center text-sm font-extrabold flex items-center justify-center gap-2"
              style={{ background: 'rgba(255,255,255,0.05)', color: item.color }}>
              <Sparkles size={14} /> Niveau maximum atteint
            </div>
          ) : (
            <button onClick={handleUpgrade} disabled={cash < upgradeCost}
              className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 6px 20px #f59e0b40' }}>
              <ArrowUpCircle size={16} />
              Améliorer → Niv.{targetLevel} · {formatEuroCompact(upgradeCost)}
              <span className="opacity-70 text-[10px]">({TIER_LABELS[targetLevel]})</span>
            </button>
          )}

          {inv && (
            <button onClick={onGotoPortfolio}
              className="w-full py-2.5 rounded-2xl font-semibold text-xs text-white/50 flex items-center justify-center gap-1 active:scale-98"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              Gérer dans le portefeuille <ChevronRight size={11} />
            </button>
          )}
        </div>

        {feedback && (
          <div className="text-center text-xs mt-2 pb-1 font-semibold"
            style={{ color: feedback.startsWith('+') || feedback.startsWith('✓') ? '#4ade80' : '#94a3b8' }}>
            {feedback}
          </div>
        )}
      </div>
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[9px] text-slate-500 font-semibold mb-0.5 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-extrabold leading-tight" style={{ color }}>{value}</div>
    </div>
  )
}
