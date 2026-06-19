import { useEffect, useMemo, useState } from 'react'
import { Check, Clock, Droplets, GraduationCap, Lock, Search, TrendingUp } from 'lucide-react'
import { INVESTMENT_CATALOG } from '../../data/investments'
import { SKILL_BY_ID } from '../../data/skills'
import { getLevelReturnBonus, LEVEL_LABELS } from '../../data/upgradeTiers'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { Icon } from '../ui/Icon'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { formatPercent, formatEuro, formatEuroCompact, cn } from '../../utils/formatting'
import type { ImmoSearch, InvestmentCatalogItem } from '../../types'

const CATEGORIES = [
  {
    emoji: '💰',
    label: 'Épargne sécurisée',
    ids: ['livret', 'assurance_vie', 'obligations_etat'],
  },
  {
    emoji: '📈',
    label: 'Marchés financiers',
    ids: ['bourse_etf', 'or_metaux', 'produit_structure', 'crypto'],
  },
  {
    emoji: '🏢',
    label: 'Immobilier collectif',
    ids: ['crowdfunding_immo', 'scpi', 'club_deal_immo'],
  },
  {
    emoji: '🏠',
    label: 'Immobilier direct',
    ids: ['parking', 'lmnp', 'immo_classique'],
  },
  {
    emoji: '💼',
    label: 'Entrepreneuriat',
    ids: ['business'],
  },
]

const IMMO_SEARCHABLE = ['parking', 'lmnp', 'immo_classique']

interface MapProps {
  onBuy: (item: InvestmentCatalogItem) => void
  onDeposit: (instanceId: string) => void
  onInfo: (item: InvestmentCatalogItem) => void
  onShowCandidates: (search: ImmoSearch) => void
}

export function MarketplaceMap({ onBuy, onDeposit, onInfo, onShowCandidates }: MapProps) {
  const game = useGameStore((s) => s.game)!
  const netWorth = calcNetWorth(game)
  const learned = game.player.learnedSkillIds || []
  const [selected, setSelected] = useState<string | null>(null)

  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeData>()
    for (const item of INVESTMENT_CATALOG) {
      const skillOk = !item.skillRequired || learned.includes(item.skillRequired)
      const wealthOk = netWorth >= item.unlockThreshold
      const unlocked = skillOk && wealthOk
      const owned = game.investments.filter((inv) => inv.catalogId === item.id)
      const isOwned = owned.length > 0
      const level = owned[0]?.level ?? 1
      const isUpgrading = !!owned[0]?.upgradeReadyAtReal && owned[0].upgradeReadyAtReal > Date.now()
      const activeSearch = IMMO_SEARCHABLE.includes(item.id)
        ? (game.immoSearches ?? []).find((s) => s.catalogId === item.id)
        : undefined
      const searchReady = !!activeSearch?.candidates
      map.set(item.id, { item, unlocked, isOwned, level, isUpgrading, activeSearch, searchReady })
    }
    return map
  }, [game, netWorth, learned])

  const selectedItem = selected ? INVESTMENT_CATALOG.find((it) => it.id === selected) ?? null : null

  return (
    <>
      <div className="space-y-3">
        {CATEGORIES.map((cat) => {
          const nodes = cat.ids.map((id) => nodeMap.get(id)).filter((n): n is NodeData => !!n)
          const ownedCount = nodes.filter((n) => n.isOwned).length
          const unlockedCount = nodes.filter((n) => n.unlocked).length

          return (
            <div key={cat.label} className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
              {/* Category header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-base">{cat.emoji}</span>
                  <span className="font-display font-bold text-sm text-slate-700">{cat.label}</span>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {ownedCount > 0
                    ? `${ownedCount} possédé${ownedCount > 1 ? 's' : ''}`
                    : `${unlockedCount}/${nodes.length} débloqué${unlockedCount !== 1 ? 's' : ''}`}
                </span>
              </div>

              {/* Cards grid */}
              <div className="p-2 grid grid-cols-2 gap-2">
                {nodes.map((n) => {
                  const returnRate =
                    n.item.baseAnnualReturn * (1 + (n.isOwned ? getLevelReturnBonus(n.level) : 0))
                  return (
                    <button
                      key={n.item.id}
                      onClick={() => setSelected(n.item.id)}
                      className={cn(
                        'relative flex items-center gap-2.5 p-3 rounded-xl text-left transition-all active:scale-[0.97]',
                        n.isOwned
                          ? cn('bg-gradient-to-br shadow-sm border border-white/40', n.item.gradient)
                          : n.unlocked
                            ? 'bg-white border-2 border-slate-200 hover:border-brand-300 hover:shadow-sm'
                            : 'bg-slate-50 border border-slate-100 opacity-55',
                      )}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                          n.isOwned
                            ? 'bg-white/20'
                            : n.unlocked
                              ? cn('bg-gradient-to-br', n.item.gradient)
                              : 'bg-slate-200',
                        )}
                      >
                        {n.unlocked ? (
                          <Icon name={n.item.icon} size={18} className="text-white" />
                        ) : (
                          <Lock size={14} className="text-slate-400" />
                        )}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            'font-display font-bold text-[12px] leading-tight truncate',
                            n.isOwned ? 'text-white' : 'text-slate-800',
                          )}
                        >
                          {n.item.shortName}
                        </div>
                        {n.unlocked ? (
                          <div
                            className={cn(
                              'text-[11px] font-semibold mt-0.5',
                              n.isOwned ? 'text-white/80' : 'text-emerald-600',
                            )}
                          >
                            {n.item.returnVariance > 0 ? '~' : ''}
                            {formatPercent(returnRate)}/an
                          </div>
                        ) : (
                          <div className="text-[11px] text-amber-600 font-semibold mt-0.5">
                            🔒 {formatEuroCompact(n.item.unlockThreshold)}
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      {n.isOwned && !n.isUpgrading && !n.activeSearch && (
                        <span
                          className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white/30 text-white text-[9px] font-extrabold flex items-center justify-center"
                        >
                          {n.level > 1 ? `N${n.level}` : <Check size={9} />}
                        </span>
                      )}
                      {n.isUpgrading && (
                        <span className="absolute top-1.5 right-1.5 text-sm animate-pulse">⚡</span>
                      )}
                      {n.activeSearch && !n.searchReady && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                          <Search size={8} className="text-white" />
                        </span>
                      )}
                      {n.searchReady && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center text-white text-[9px] font-extrabold">
                          !
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {selectedItem && (
        <NodeDetailSheet
          item={selectedItem}
          onClose={() => setSelected(null)}
          onBuy={onBuy}
          onDeposit={onDeposit}
          onInfo={onInfo}
          onShowCandidates={onShowCandidates}
        />
      )}
    </>
  )
}

// ── Types internes ───────────────────────────────────────────────────────────

type NodeData = {
  item: InvestmentCatalogItem
  unlocked: boolean
  isOwned: boolean
  level: number
  isUpgrading: boolean
  activeSearch?: ImmoSearch
  searchReady: boolean
}

// ── Panneau d'action (bottom sheet) ─────────────────────────────────────────

function NodeDetailSheet({
  item,
  onClose,
  onBuy,
  onDeposit,
  onInfo,
  onShowCandidates,
}: {
  item: InvestmentCatalogItem
  onClose: () => void
  onBuy: (item: InvestmentCatalogItem) => void
  onDeposit: (instanceId: string) => void
  onInfo: (item: InvestmentCatalogItem) => void
  onShowCandidates: (search: ImmoSearch) => void
}) {
  const game = useGameStore((s) => s.game)!
  const startImmoSearch = useGameStore((s) => s.startImmoSearch)
  const setScreen = useGameStore((s) => s.setScreen)
  const netWorth = calcNetWorth(game)
  const learned = game.player.learnedSkillIds || []
  const [now, setNow] = useState(Date.now())

  const skillOk = !item.skillRequired || learned.includes(item.skillRequired)
  const wealthOk = netWorth >= item.unlockThreshold
  const unlocked = skillOk && wealthOk

  const owned = game.investments.filter((inv) => inv.catalogId === item.id)
  const isOwned = owned.length > 0
  const ownedInv = owned[0] ?? null
  const level = ownedInv?.level ?? 1
  const isRealEstate = ['parking', 'lmnp', 'immo_classique', 'club_deal_immo'].includes(item.id)
  const isImmoSearchable = IMMO_SEARCHABLE.includes(item.id)
  const maxInstances = isRealEstate ? 3 : 1
  const isFullyOwned = owned.length >= maxInstances

  const activeSearch = isImmoSearchable
    ? (game.immoSearches ?? []).find((s) => s.catalogId === item.id)
    : undefined
  const searchReady = !!activeSearch?.candidates

  useEffect(() => {
    if (!activeSearch || searchReady) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [activeSearch, searchReady])

  function fmtTime(target: number): string {
    const ms = Math.max(0, target - now)
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    const s = Math.floor((ms % 60_000) / 1000)
    if (h > 0) return `${h}h ${m}min`
    if (m > 0) return `${m}min ${s}s`
    return `${s}s`
  }

  const returnRate = item.baseAnnualReturn * (1 + (isOwned ? getLevelReturnBonus(level) : 0))

  return (
    <Modal open onClose={onClose} title={undefined} size="md">
      {/* En-tête gradient */}
      <div className={cn('-m-5 mb-4 p-5 rounded-t-3xl bg-gradient-to-br text-white relative overflow-hidden', item.gradient)}>
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-black/10" />
        <div className="relative flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shrink-0">
            <Icon name={item.icon} size={28} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-extrabold text-lg leading-tight">{item.name}</div>
            <div className="text-sm text-white/85">
              {item.returnVariance > 0 ? '~' : ''}{formatPercent(returnRate)}/an
              {isOwned && level > 1 && (
                <span className="ml-1.5 font-bold">
                  · {LEVEL_LABELS[level]} (+{Math.round(getLevelReturnBonus(level) * 100)}%)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-slate-500 leading-relaxed">{item.description}</p>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Rendement" value={`${item.returnVariance > 0 ? '~' : ''}${formatPercent(returnRate)}`} icon={<TrendingUp size={13} />} />
          <Stat label="Risque" value={`${item.riskLevel}/5`} icon={<span className="text-amber-500">★</span>} />
          <Stat label="Liquidité" value={`${item.liquidityLevel}/5`} icon={<Droplets size={13} />} />
          <Stat label="Blocage" value={item.lockPeriodMonths ? `${item.lockPeriodMonths}m` : '—'} icon={<Clock size={13} />} />
        </div>

        {/* État possédé */}
        {isOwned && (
          <div className="rounded-2xl bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-500">Tu possèdes — Niveau {level}/5</span>
              <span className="text-sm font-display font-bold text-slate-800">
                {formatEuro(Math.round(ownedInv!.currentValue))}
              </span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((l) => (
                <div
                  key={l}
                  className={cn('flex-1 h-1.5 rounded-full', l <= level ? 'bg-brand-500' : 'bg-slate-200')}
                />
              ))}
            </div>
          </div>
        )}

        {/* Verrou */}
        {!unlocked && (
          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-800 space-y-1">
            {!skillOk && (
              <div className="flex items-center gap-1.5">
                <GraduationCap size={14} /> Requiert la formation :{' '}
                <strong>{SKILL_BY_ID[item.skillRequired!]?.name ?? item.skillRequired}</strong>
              </div>
            )}
            {!wealthOk && (
              <div className="flex items-center gap-1.5">
                <Lock size={14} /> Débloqué à <strong>{formatEuro(item.unlockThreshold)}</strong> de
                patrimoine (encore {formatEuroCompact(item.unlockThreshold - netWorth)})
              </div>
            )}
          </div>
        )}

        {/* Recherche immo en cours */}
        {unlocked && activeSearch && !searchReady && (
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3 space-y-2.5">
            <div className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
              <Search size={13} /> Recherche en cours...
            </div>
            <ProgressLine
              label="Financement"
              done={now >= activeSearch.financingReadyAtReal}
              timeLeft={fmtTime(activeSearch.financingReadyAtReal)}
              progress={Math.min(
                1,
                (now - activeSearch.startedAtReal) /
                  (activeSearch.financingReadyAtReal - activeSearch.startedAtReal),
              )}
              color="bg-brand-500"
            />
            <ProgressLine
              label="Recherche de bien"
              done={now >= activeSearch.propertyReadyAtReal}
              timeLeft={fmtTime(activeSearch.propertyReadyAtReal)}
              progress={Math.min(
                1,
                (now - activeSearch.startedAtReal) /
                  (activeSearch.propertyReadyAtReal - activeSearch.startedAtReal),
              )}
              color="bg-violet-500"
            />
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {!unlocked ? (
            <Button fullWidth variant="secondary" onClick={() => { onInfo(item); onClose() }}>
              En savoir plus
            </Button>
          ) : isImmoSearchable ? (
            searchReady && activeSearch ? (
              <Button fullWidth variant="gold" onClick={() => { onShowCandidates(activeSearch); onClose() }}>
                <Search size={15} /> Voir les {activeSearch.candidates!.length} biens trouvés
              </Button>
            ) : activeSearch ? (
              <Button fullWidth variant="secondary" disabled>
                <Clock size={15} /> Recherche en cours...
              </Button>
            ) : (
              <Button
                fullWidth
                onClick={() => {
                  const res = startImmoSearch(item.id as 'parking' | 'lmnp' | 'immo_classique')
                  if (!res.success) { onBuy(item) }
                  onClose()
                }}
              >
                <Search size={15} /> Lancer une recherche{isFullyOwned ? ' (bien supplémentaire)' : ''}
              </Button>
            )
          ) : isFullyOwned ? (
            <>
              {!isRealEstate && ownedInv && (
                <Button fullWidth onClick={() => { onDeposit(ownedInv.instanceId); onClose() }}>
                  💰 Ajouter des fonds
                </Button>
              )}
              {level < 5 ? (
                <Button fullWidth variant="secondary" onClick={() => { setScreen('portfolio'); onClose() }}>
                  ⬆️ Améliorer → {LEVEL_LABELS[level + 1]} (+{Math.round(getLevelReturnBonus(level + 1) * 100)}%)
                </Button>
              ) : (
                <div className="text-center py-2 text-sm font-bold text-violet-600">⚜️ Niveau Maître atteint</div>
              )}
            </>
          ) : (
            <Button fullWidth onClick={() => { onBuy(item); onClose() }}>
              Investir →
            </Button>
          )}

          {unlocked && (
            <button
              onClick={() => { onInfo(item); onClose() }}
              className="w-full text-center text-xs font-semibold text-slate-400 hover:text-brand-600 py-1"
            >
              En savoir plus sur ce placement
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <div className="flex items-center justify-center text-slate-400 mb-0.5">{icon}</div>
      <div className="font-display font-bold text-slate-800 text-xs">{value}</div>
      <div className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</div>
    </div>
  )
}

function ProgressLine({
  label,
  done,
  timeLeft,
  progress,
  color,
}: {
  label: string
  done: boolean
  timeLeft: string
  progress: number
  color: string
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-0.5">
        <span>{label}</span>
        <span className="font-semibold">{done ? '✓ Prêt' : timeLeft}</span>
      </div>
      <div className="h-1.5 bg-white rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', done ? 'bg-emerald-500' : color)}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}
