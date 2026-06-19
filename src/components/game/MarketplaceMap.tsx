import { useEffect, useMemo, useState } from 'react'
import { Lock, Search, Info, Check, GraduationCap, Clock, Droplets, TrendingUp, ChevronRight } from 'lucide-react'
import { INVESTMENT_CATALOG } from '../../data/investments'
import { SKILL_BY_ID } from '../../data/skills'
import { getLevelReturnBonus, TIER_SECS, LEVEL_LABELS } from '../../data/upgradeTiers'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { Icon } from '../ui/Icon'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { formatPercent, formatEuro, formatEuroCompact, cn } from '../../utils/formatting'
import type { ImmoSearch, InvestmentCatalogItem } from '../../types'

// Layout du parcours vertical
const VSPACING = 112          // espace vertical entre noeuds (px)
const PAD_TOP = 56
const PAD_BOTTOM = 56
const NODE = 66               // diamètre du noeud (px)
const X_PATTERN = [50, 24, 50, 76]  // serpentin doux (% horizontal)

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

  // Ordre du parcours : du plus accessible au plus avancé
  const ordered = useMemo(
    () => [...INVESTMENT_CATALOG].sort((a, b) => a.unlockThreshold - b.unlockThreshold),
    [],
  )

  const totalHeight = PAD_TOP + (ordered.length - 1) * VSPACING + PAD_BOTTOM

  // Calcul d'état pour chaque noeud
  const nodes = ordered.map((item, i) => {
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
    const x = X_PATTERN[i % X_PATTERN.length]
    const y = PAD_TOP + i * VSPACING
    return { item, i, unlocked, skillOk, wealthOk, isOwned, level, isUpgrading, activeSearch, searchReady, x, y }
  })

  // Premier noeud verrouillé = frontière (objectif suivant)
  const frontierIndex = nodes.findIndex((n) => !n.unlocked)

  const selectedItem = selected ? INVESTMENT_CATALOG.find((it) => it.id === selected) ?? null : null

  return (
    <>
      <div
        className="relative w-full rounded-3xl overflow-hidden border border-slate-700/40 shadow-2xl"
        style={{
          height: totalHeight,
          background:
            'radial-gradient(120% 60% at 50% 0%, #1e3a5f 0%, #0f172a 45%, #0b1120 100%)',
        }}
      >
        {/* Texture / glpoints décoratifs */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />

        {/* Chemin (SVG) */}
        <svg className="absolute inset-0 w-full" height={totalHeight} style={{ pointerEvents: 'none' }}>
          {nodes.slice(0, -1).map((n, idx) => {
            const next = nodes[idx + 1]
            const active = n.isOwned && next.unlocked
            const midY = (n.y + next.y) / 2
            return (
              <path
                key={`path-${idx}`}
                d={`M ${n.x}% ${n.y} C ${n.x}% ${midY}, ${next.x}% ${midY}, ${next.x}% ${next.y}`}
                fill="none"
                stroke={active ? '#38bdf8' : '#475569'}
                strokeOpacity={active ? 0.55 : 0.3}
                strokeWidth={active ? 4 : 3}
                strokeDasharray={next.unlocked ? undefined : '6 7'}
                strokeLinecap="round"
              />
            )
          })}
        </svg>

        {/* Noeuds */}
        {nodes.map((n) => (
          <JourneyNode
            key={n.item.id}
            node={n}
            isFrontier={n.i === frontierIndex}
            onTap={() => setSelected(n.item.id)}
          />
        ))}
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

// ── Noeud du parcours ───────────────────────────────────────────────────────
type NodeData = {
  item: InvestmentCatalogItem
  unlocked: boolean
  isOwned: boolean
  level: number
  isUpgrading: boolean
  activeSearch?: ImmoSearch
  searchReady: boolean
  x: number
  y: number
}

function JourneyNode({
  node,
  isFrontier,
  onTap,
}: {
  node: NodeData
  isFrontier: boolean
  onTap: () => void
}) {
  const { item, unlocked, isOwned, level, isUpgrading, activeSearch, searchReady, x, y } = node
  const [now, setNow] = useState(Date.now())
  const upgradeReadyAtReal = useGameStore((s) =>
    s.game?.investments.find((inv) => inv.catalogId === item.id)?.upgradeReadyAtReal,
  )

  useEffect(() => {
    if (!isUpgrading) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isUpgrading])

  const RADIUS = (NODE - 6) / 2
  const CIRC = 2 * Math.PI * RADIUS
  let arc = 0
  if (isUpgrading && upgradeReadyAtReal) {
    const totalMs = TIER_SECS[level + 1] * 1000
    arc = Math.min(1, (totalMs - Math.max(0, upgradeReadyAtReal - now)) / totalMs)
  }

  return (
    <button
      onClick={onTap}
      className="absolute flex flex-col items-center group"
      style={{ left: `${x}%`, top: y, transform: 'translate(-50%, -50%)', zIndex: isOwned ? 4 : 2 }}
    >
      {/* Halo possédé / frontière */}
      {isOwned && (
        <span
          className="absolute rounded-full blur-md opacity-50"
          style={{ width: NODE * 1.4, height: NODE * 1.4, background: item.color, top: -NODE * 0.2 }}
        />
      )}
      {isFrontier && (
        <span
          className="absolute rounded-full animate-ping"
          style={{ width: NODE + 14, height: NODE + 14, border: '2px solid rgba(56,189,248,0.6)', top: -7 }}
        />
      )}

      {/* Médaillon */}
      <span
        className={cn(
          'relative flex items-center justify-center rounded-full bg-gradient-to-br shadow-xl transition-transform duration-150',
          item.gradient,
          unlocked ? 'group-hover:scale-110 group-active:scale-95' : 'grayscale',
        )}
        style={{ width: NODE, height: NODE, opacity: unlocked ? 1 : 0.45 }}
      >
        <Icon name={item.icon} size={28} className="text-white drop-shadow relative z-10" />

        {!unlocked && (
          <span className="absolute inset-0 rounded-full bg-slate-950/40 flex items-center justify-center">
            <Lock size={16} className="text-white/70" />
          </span>
        )}

        {/* Arc d'amélioration */}
        {isUpgrading && (
          <svg className="absolute inset-0" width={NODE} height={NODE} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={NODE / 2} cy={NODE / 2} r={RADIUS} fill="none" stroke="rgba(251,191,36,0.25)" strokeWidth="3.5" />
            <circle
              cx={NODE / 2} cy={NODE / 2} r={RADIUS} fill="none" stroke="#fbbf24" strokeWidth="3.5"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - arc)} strokeLinecap="round"
            />
          </svg>
        )}
      </span>

      {/* Badge niveau */}
      {isOwned && (
        <span
          className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shadow-md border border-white/30"
          style={{ backgroundColor: item.color }}
        >
          {level > 1 ? `N${level}` : <Check size={11} />}
        </span>
      )}

      {/* Indicateur recherche immo */}
      {activeSearch && !searchReady && (
        <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-md animate-pulse">
          <Search size={10} className="text-white" />
        </span>
      )}
      {searchReady && (
        <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center shadow-md animate-bounce">
          <span className="text-[10px] font-extrabold text-white">!</span>
        </span>
      )}

      {/* Étiquette */}
      <span
        className="mt-2 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
        style={{
          color: unlocked ? '#fff' : 'rgba(255,255,255,0.4)',
          backgroundColor: unlocked ? 'rgba(15,23,42,0.6)' : 'transparent',
          textShadow: '0 1px 3px rgba(0,0,0,0.7)',
        }}
      >
        {item.shortName}
      </span>

      {/* Rendement / objectif */}
      {unlocked ? (
        <span className="text-[10px] font-bold mt-0.5" style={{ color: item.color, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
          {item.returnVariance > 0 ? '~' : ''}{formatPercent(item.baseAnnualReturn * (1 + (isOwned ? getLevelReturnBonus(level) : 0)))}/an
        </span>
      ) : (
        <span className="text-[10px] font-semibold text-amber-300/80 mt-0.5">
          🔒 {formatEuroCompact(item.unlockThreshold)}
        </span>
      )}
    </button>
  )
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

  // Live countdown pour la recherche immo
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
              {isOwned && level > 1 && <span className="ml-1.5 font-bold">· {LEVEL_LABELS[level]} (+{Math.round(getLevelReturnBonus(level) * 100)}%)</span>}
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
              <span className="text-sm font-display font-bold text-slate-800">{formatEuro(Math.round(ownedInv!.currentValue))}</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((l) => (
                <div key={l} className={cn('flex-1 h-1.5 rounded-full', l <= level ? 'bg-brand-500' : 'bg-slate-200')} />
              ))}
            </div>
          </div>
        )}

        {/* Verrou */}
        {!unlocked && (
          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-800 space-y-1">
            {!skillOk && (
              <div className="flex items-center gap-1.5">
                <GraduationCap size={14} /> Requiert la formation : <strong>{SKILL_BY_ID[item.skillRequired!]?.name ?? item.skillRequired}</strong>
              </div>
            )}
            {!wealthOk && (
              <div className="flex items-center gap-1.5">
                <Lock size={14} /> Débloqué à <strong>{formatEuro(item.unlockThreshold)}</strong> de patrimoine (encore {formatEuroCompact(item.unlockThreshold - netWorth)})
              </div>
            )}
          </div>
        )}

        {/* Recherche immobilière en cours */}
        {unlocked && activeSearch && !searchReady && (
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3 space-y-2.5">
            <div className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
              <Search size={13} /> Recherche en cours...
            </div>
            <ProgressLine
              label="Financement"
              done={now >= activeSearch.financingReadyAtReal}
              timeLeft={fmtTime(activeSearch.financingReadyAtReal)}
              progress={Math.min(1, (now - activeSearch.startedAtReal) / (activeSearch.financingReadyAtReal - activeSearch.startedAtReal))}
              color="bg-brand-500"
            />
            <ProgressLine
              label="Recherche de bien"
              done={now >= activeSearch.propertyReadyAtReal}
              timeLeft={fmtTime(activeSearch.propertyReadyAtReal)}
              progress={Math.min(1, (now - activeSearch.startedAtReal) / (activeSearch.propertyReadyAtReal - activeSearch.startedAtReal))}
              color="bg-violet-500"
            />
          </div>
        )}

        {/* ── Actions ── */}
        <div className="space-y-2">
          {!unlocked ? (
            <Button fullWidth variant="secondary" onClick={() => { onInfo(item); onClose() }}>
              <Info size={15} /> En savoir plus
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
              <Button fullWidth onClick={() => {
                const res = startImmoSearch(item.id as 'parking' | 'lmnp' | 'immo_classique')
                if (!res.success) { onBuy(item) }
                onClose()
              }}>
                <Search size={15} /> Lancer une recherche {isFullyOwned ? '(bien supplémentaire)' : ''}
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
              Investir <ChevronRight size={15} />
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
  label, done, timeLeft, progress, color,
}: {
  label: string; done: boolean; timeLeft: string; progress: number; color: string
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-0.5">
        <span>{label}</span>
        <span className="font-semibold">{done ? '✓ Prêt' : timeLeft}</span>
      </div>
      <div className="h-1.5 bg-white rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', done ? 'bg-emerald-500' : color)} style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}
