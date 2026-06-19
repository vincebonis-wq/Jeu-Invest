import { useEffect, useState } from 'react'
import { Lock, Search, Info } from 'lucide-react'
import { INVESTMENT_CATALOG } from '../../data/investments'
import { SKILL_BY_ID } from '../../data/skills'
import { getLevelReturnBonus, TIER_SECS } from '../../data/upgradeTiers'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { Icon } from '../ui/Icon'
import { formatPercent, cn } from '../../utils/formatting'
import type { ImmoSearch, InvestmentCatalogItem } from '../../types'

// ── Positions [x%, y%] dans le conteneur de la carte ──────────────────────────
const NODE_POS: Record<string, [number, number]> = {
  livret:            [11, 22],
  obligations_etat:  [6,  48],
  assurance_vie:     [22, 35],
  bourse_etf:        [50, 14],
  or_metaux:         [65, 26],
  scpi:              [57, 42],
  produit_structure: [77, 16],
  crowdfunding_immo: [34, 62],
  parking:           [16, 74],
  lmnp:              [34, 82],
  immo_classique:    [19, 88],
  club_deal_immo:    [46, 74],
  business:          [71, 60],
  crypto:            [84, 74],
}

// ── Lignes de progression ──────────────────────────────────────────────────────
const EDGES: [string, string][] = [
  ['livret', 'assurance_vie'],
  ['livret', 'obligations_etat'],
  ['assurance_vie', 'bourse_etf'],
  ['bourse_etf', 'or_metaux'],
  ['bourse_etf', 'scpi'],
  ['scpi', 'produit_structure'],
  ['assurance_vie', 'crowdfunding_immo'],
  ['crowdfunding_immo', 'parking'],
  ['crowdfunding_immo', 'club_deal_immo'],
  ['parking', 'lmnp'],
  ['lmnp', 'immo_classique'],
  ['bourse_etf', 'business'],
  ['business', 'crypto'],
]

// ── Zones (fond de carte) ──────────────────────────────────────────────────────
const ZONES = [
  { label: 'Épargne', color: '#0e7490', x: 0, y: 0, w: 36, h: 58 },
  { label: 'Marchés', color: '#15803d', x: 36, y: 0, w: 64, h: 58 },
  { label: 'Immobilier', color: '#b45309', x: 0, y: 58, w: 56, h: 42 },
  { label: 'Alternatif', color: '#7c3aed', x: 56, y: 58, w: 44, h: 42 },
]

interface MapProps {
  onBuy: (item: InvestmentCatalogItem) => void
  onInfo: (item: InvestmentCatalogItem) => void
  onDeposit: (instanceId: string) => void
  onShowCandidates: (search: ImmoSearch) => void
}

export function MarketplaceMap({ onBuy, onInfo, onDeposit, onShowCandidates }: MapProps) {
  const game = useGameStore((s) => s.game)!
  const startImmoSearch = useGameStore((s) => s.startImmoSearch)
  const netWorth = calcNetWorth(game)
  const learned = game.player.learnedSkillIds || []
  const immoSearches = game.immoSearches ?? []

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/40 shadow-xl select-none"
      style={{ paddingBottom: '68%' }}
    >
      {/* ── Fond carte ── */}
      <div className="absolute inset-0 bg-slate-900">
        {ZONES.map((z) => (
          <div
            key={z.label}
            className="absolute flex items-end p-2"
            style={{
              left: `${z.x}%`, top: `${z.y}%`,
              width: `${z.w}%`, height: `${z.h}%`,
              backgroundColor: `${z.color}22`,
              borderRight: z.x + z.w < 100 ? `1px solid ${z.color}33` : undefined,
              borderBottom: z.y + z.h < 100 ? `1px solid ${z.color}33` : undefined,
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-30"
              style={{ color: z.color }}
            >
              {z.label}
            </span>
          </div>
        ))}

        {/* ── Lignes de progression (SVG) ── */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          {EDGES.map(([a, b]) => {
            const [ax, ay] = NODE_POS[a] ?? [0, 0]
            const [bx, by] = NODE_POS[b] ?? [0, 0]
            const aOwned = game.investments.some((i) => i.catalogId === a)
            const bUnlocked = (() => {
              const item = INVESTMENT_CATALOG.find((i) => i.id === b)
              if (!item) return false
              const skillOk = !item.skillRequired || learned.includes(item.skillRequired)
              return skillOk && netWorth >= item.unlockThreshold
            })()
            return (
              <line
                key={`${a}-${b}`}
                x1={`${ax}%`} y1={`${ay}%`}
                x2={`${bx}%`} y2={`${by}%`}
                stroke={aOwned && bUnlocked ? '#ffffff' : '#ffffff'}
                strokeOpacity={aOwned && bUnlocked ? 0.25 : 0.08}
                strokeWidth="1.5"
                strokeDasharray={aOwned && bUnlocked ? undefined : '4 4'}
              />
            )
          })}
        </svg>

        {/* ── Noeuds d'investissement ── */}
        {INVESTMENT_CATALOG.map((item) => {
          const pos = NODE_POS[item.id]
          if (!pos) return null

          const skillOk = !item.skillRequired || learned.includes(item.skillRequired)
          const wealthOk = netWorth >= item.unlockThreshold
          const unlocked = skillOk && wealthOk

          const ownedInvs = game.investments.filter((i) => i.catalogId === item.id)
          const isRealEstateType = ['parking', 'lmnp', 'immo_classique', 'club_deal_immo'].includes(item.id)
          const maxInstances = isRealEstateType ? 3 : 1
          const isOwned = ownedInvs.length > 0
          const isFullyOwned = ownedInvs.length >= maxInstances
          const ownedInv = ownedInvs[0] ?? null
          const level = ownedInv?.level ?? 1
          const isUpgrading = !!ownedInv?.upgradeReadyAtReal && (ownedInv.upgradeReadyAtReal > Date.now())

          const isImmoSearchable = ['parking', 'lmnp', 'immo_classique'].includes(item.id)
          const activeSearch = isImmoSearchable
            ? immoSearches.find((s) => s.catalogId === (item.id as 'parking' | 'lmnp' | 'immo_classique'))
            : undefined
          const searchReady = !!activeSearch?.candidates

          function handleClick() {
            if (!unlocked) return
            if (searchReady && activeSearch) {
              onShowCandidates(activeSearch)
            } else if (isFullyOwned && !isRealEstateType && ownedInv) {
              onDeposit(ownedInv.instanceId)
            } else if (isImmoSearchable && !activeSearch) {
              const res = startImmoSearch(item.id as 'parking' | 'lmnp' | 'immo_classique')
              if (!res.success) onBuy(item)
            } else {
              onBuy(item)
            }
          }

          return (
            <MapNode
              key={item.id}
              item={item}
              pos={pos}
              unlocked={unlocked}
              isOwned={isOwned}
              level={level}
              isUpgrading={isUpgrading}
              searchReady={searchReady}
              activeSearch={activeSearch}
              missingSkill={!skillOk ? (item.skillRequired ?? undefined) : undefined}
              missingWealth={!wealthOk ? item.unlockThreshold : undefined}
              onClick={handleClick}
              onInfo={() => onInfo(item)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Noeud individuel ──────────────────────────────────────────────────────────
function MapNode({
  item,
  pos,
  unlocked,
  isOwned,
  level,
  isUpgrading,
  searchReady,
  activeSearch,
  missingSkill,
  missingWealth,
  onClick,
  onInfo,
}: {
  item: InvestmentCatalogItem
  pos: [number, number]
  unlocked: boolean
  isOwned: boolean
  level: number
  isUpgrading: boolean
  searchReady: boolean
  activeSearch?: ImmoSearch
  missingSkill?: string
  missingWealth?: number
  onClick: () => void
  onInfo: () => void
}) {
  const [now, setNow] = useState(Date.now())
  const [tooltip, setTooltip] = useState(false)

  useEffect(() => {
    if (!isUpgrading) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isUpgrading])

  const levelBonus = getLevelReturnBonus(level)
  const returnRate = item.baseAnnualReturn * (1 + levelBonus)

  // Progress arc for upgrade timer
  let upgradeProgress = 0
  if (isUpgrading) {
    // We don't have the start time easily, but we know targetLevel = level + 1
    // Use TIER_SECS to estimate total duration
    const totalSecs = TIER_SECS[level + 1] ?? 180
    // We can't get the exact start time here, just show 50% as placeholder
    // Actually let's compute from upgradeReadyAtReal
    void totalSecs
  }
  void upgradeProgress

  // Upgrade timer from store
  const upgradeReadyAtReal = useGameStore((s) =>
    s.game?.investments.find((i) => i.catalogId === item.id)?.upgradeReadyAtReal
  )
  let arcProgress = 0
  if (isUpgrading && upgradeReadyAtReal) {
    const targetLevel = level + 1
    const totalMs = TIER_SECS[targetLevel] * 1000
    const elapsed = totalMs - Math.max(0, upgradeReadyAtReal - now)
    arcProgress = Math.min(1, elapsed / totalMs)
  }

  const NODE_SIZE = 52 // px (used for arc calculations)
  const RADIUS = 23
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS

  function formatCountdown(ms: number): string {
    const s = Math.ceil(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60); const sec = s % 60
    if (m < 60) return `${m}m${sec > 0 ? sec + 's' : ''}`
    return `${Math.floor(m / 60)}h${m % 60 > 0 ? (m % 60) + 'm' : ''}`
  }

  return (
    <div
      className="absolute"
      style={{
        left: `${pos[0]}%`,
        top: `${pos[1]}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: tooltip ? 20 : (isOwned ? 3 : unlocked ? 2 : 1),
      }}
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
    >
      {/* Glow ring for owned */}
      {isOwned && (
        <div
          className="absolute inset-0 rounded-2xl blur-md opacity-60"
          style={{ background: item.color, transform: 'scale(1.3)' }}
        />
      )}

      {/* Main node button */}
      <button
        onClick={onClick}
        className={cn(
          `relative w-[${NODE_SIZE}px] h-[${NODE_SIZE}px] rounded-2xl flex items-center justify-center transition-all duration-150`,
          'bg-gradient-to-br shadow-lg',
          item.gradient,
          unlocked
            ? 'hover:scale-110 active:scale-95 cursor-pointer'
            : 'grayscale opacity-40 cursor-default',
        )}
        style={{ width: NODE_SIZE, height: NODE_SIZE }}
        aria-label={item.shortName}
      >
        <Icon name={item.icon} size={22} className="text-white drop-shadow-sm relative z-10" />

        {/* Lock overlay */}
        {!unlocked && (
          <div className="absolute inset-0 rounded-2xl bg-slate-900/50 flex items-center justify-center">
            <Lock size={14} className="text-white/60" />
          </div>
        )}

        {/* Upgrade progress arc (SVG) */}
        {isUpgrading && (
          <svg
            className="absolute inset-0"
            width={NODE_SIZE} height={NODE_SIZE}
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle
              cx={NODE_SIZE / 2} cy={NODE_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="rgba(251,191,36,0.3)"
              strokeWidth="3"
            />
            <circle
              cx={NODE_SIZE / 2} cy={NODE_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - arcProgress)}
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Search in progress indicator */}
        {activeSearch && !activeSearch.candidates && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shadow">
            <Search size={8} className="text-white" />
          </div>
        )}

        {/* Properties found indicator */}
        {searchReady && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center shadow animate-bounce">
            <span className="text-[8px] font-bold text-white">!</span>
          </div>
        )}
      </button>

      {/* Level badge */}
      {isOwned && level > 0 && (
        <div
          className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center shadow-md text-[9px] font-bold"
          style={{ backgroundColor: item.color, color: '#fff' }}
        >
          {level > 1 ? level : '✓'}
        </div>
      )}

      {/* Upgrade countdown badge */}
      {isUpgrading && upgradeReadyAtReal && (
        <div className="absolute -top-1.5 -left-1.5 bg-amber-400 text-amber-900 rounded-full px-1.5 h-[18px] flex items-center text-[9px] font-bold shadow-md whitespace-nowrap">
          {formatCountdown(Math.max(0, upgradeReadyAtReal - now))}
        </div>
      )}

      {/* Name label */}
      <div
        className={cn(
          'absolute top-full left-1/2 -translate-x-1/2 mt-1.5 text-center whitespace-nowrap text-[10px] font-bold leading-tight pointer-events-none',
          unlocked ? 'text-white/80' : 'text-white/25',
        )}
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
      >
        {item.shortName.split(' ')[0]}
      </div>

      {/* Return rate pill */}
      {unlocked && (
        <div
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow pointer-events-none"
          style={{ backgroundColor: item.color, color: '#fff', opacity: isOwned ? 1 : 0.85 }}
        >
          {item.returnVariance > 0 ? '~' : ''}{formatPercent(returnRate)}
        </div>
      )}

      {/* Tooltip (hover) */}
      {tooltip && (
        <div
          className="absolute z-30 bg-slate-800/95 backdrop-blur-sm border border-slate-600 rounded-xl p-3 shadow-2xl pointer-events-none"
          style={{
            width: 180,
            left: pos[0] > 65 ? 'auto' : '100%',
            right: pos[0] > 65 ? '100%' : 'auto',
            top: '50%',
            transform: 'translateY(-50%)',
            marginLeft: pos[0] > 65 ? undefined : 8,
            marginRight: pos[0] > 65 ? 8 : undefined,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={cn('w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0', item.gradient)}>
              <Icon name={item.icon} size={14} className="text-white" />
            </div>
            <span className="font-bold text-xs text-white">{item.name}</span>
          </div>
          <div className="text-[11px] text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Rendement</span>
              <span className="text-emerald-400 font-semibold">
                {item.returnVariance > 0 ? '~' : ''}{formatPercent(returnRate)}/an
                {level > 1 && <span className="text-amber-400 ml-1">+{Math.round(getLevelReturnBonus(level) * 100)}%</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Risque</span>
              <span className="font-semibold text-white">{'★'.repeat(item.riskLevel)}{'☆'.repeat(5 - item.riskLevel)}</span>
            </div>
            {item.lockPeriodMonths && (
              <div className="flex justify-between">
                <span className="text-slate-400">Blocage</span>
                <span className="text-orange-400 font-semibold">{item.lockPeriodMonths} mois</span>
              </div>
            )}
            {isOwned && (
              <div className="flex justify-between">
                <span className="text-slate-400">Niveau</span>
                <span className="text-amber-400 font-semibold">{level}/5</span>
              </div>
            )}
            {!unlocked && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-700 text-orange-400 text-[10px]">
                {missingSkill
                  ? `🎓 Requiert : ${SKILL_BY_ID[missingSkill]?.name ?? missingSkill}`
                  : missingWealth
                    ? `🔒 Débloqué à ${missingWealth.toLocaleString('fr-FR')} €`
                    : '🔒 Non disponible'}
              </div>
            )}
          </div>
          <button
            className="pointer-events-auto mt-2 flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300"
            onClick={(e) => { e.stopPropagation(); onInfo() }}
          >
            <Info size={10} /> En savoir plus
          </button>
        </div>
      )}
    </div>
  )
}
