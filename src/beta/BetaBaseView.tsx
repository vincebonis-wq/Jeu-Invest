import { useEffect, useState } from 'react'
import { Lock, Plus, Search } from 'lucide-react'
import { useGameStore } from '../store/gameStore'
import { Icon } from '../components/ui/Icon'
import { BetaShell, useDrawer, cn } from './BetaShell'
import { computeBetaNodes, formatCountdown, type BetaNode } from './betaData'
import { TIER_SECS } from '../data/upgradeTiers'
import { formatEuroCompact, formatPercent } from '../utils/formatting'

const ACCENT = '#0f766e' // teal tropical

export function BetaBaseView() {
  const game = useGameStore((s) => s.game)!
  const { drawerScreen, open, close } = useDrawer()
  const [, setTick] = useState(0)

  const nodes = computeBetaNodes(game)
  const anyTimer = nodes.some((n) => n.isUpgrading || n.hasActiveSearch)

  useEffect(() => {
    if (!anyTimer) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [anyTimer])

  function handleTap(n: BetaNode) {
    if (!n.unlocked) { open('marketplace'); return }
    if (n.isOwned) open(n.item.isRealEstate ? 'properties' : 'portfolio')
    else open('marketplace')
  }

  const ownedCount = nodes.filter((n) => n.isOwned).length

  return (
    <BetaShell accent={ACCENT} openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div
        className="absolute inset-0 overflow-y-auto"
        style={{
          background:
            'linear-gradient(180deg, #7dd3fc 0%, #bae6fd 22%, #5eead4 45%, #2dd4bf 100%)',
        }}
      >
        {/* Eau scintillante en fond */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, rgba(255,255,255,0.5) 0 2px, transparent 2px 16px)',
          }}
        />

        <div className="relative max-w-2xl mx-auto px-4 py-5">
          {/* Bandeau QG */}
          <div className="rounded-3xl bg-white/25 backdrop-blur-sm border border-white/40 p-4 mb-5 text-center shadow-lg">
            <div className="text-4xl mb-1">🏝️</div>
            <div className="font-display font-extrabold text-white text-lg drop-shadow">Ton île patrimoniale</div>
            <div className="text-white/90 text-sm font-semibold">
              {ownedCount} bâtiment{ownedCount > 1 ? 's' : ''} construit{ownedCount > 1 ? 's' : ''} · {formatEuroCompact(game.cashBalance)} à investir
            </div>
          </div>

          {/* Grille de parcelles */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {nodes.map((n) => (
              <BasePlot key={n.item.id} node={n} onTap={() => handleTap(n)} />
            ))}
          </div>

          <div className="h-6" />
        </div>
      </div>
    </BetaShell>
  )
}

function BasePlot({ node, onTap }: { node: BetaNode; onTap: () => void }) {
  const { item, unlocked, isOwned, level, isUpgrading, upgradeReadyAtReal, hasActiveSearch, searchReady } = node

  const timeLeft =
    isUpgrading && upgradeReadyAtReal
      ? formatCountdown(upgradeReadyAtReal - Date.now())
      : null
  const arc =
    isUpgrading && upgradeReadyAtReal
      ? Math.min(1, (TIER_SECS[level + 1] * 1000 - Math.max(0, upgradeReadyAtReal - Date.now())) / (TIER_SECS[level + 1] * 1000))
      : 0

  return (
    <button onClick={onTap} className="flex flex-col items-center group">
      {/* Plateforme */}
      <div className="relative w-full aspect-square flex items-center justify-center">
        {/* Ombre / socle */}
        <div className="absolute bottom-1 w-[78%] h-3 rounded-full bg-black/15 blur-[2px]" />

        {isOwned ? (
          /* Bâtiment construit */
          <div className="relative">
            <div
              className={cn(
                'w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-xl border-2 border-white/50 transition-transform group-active:scale-95 group-hover:scale-105',
                item.gradient,
              )}
            >
              <Icon name={item.icon} size={28} className="text-white drop-shadow" />
            </div>
            {/* Badge niveau */}
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shadow border border-white/40"
              style={{ backgroundColor: item.color }}
            >
              N{level}
            </span>
            {/* Timer amélioration */}
            {isUpgrading && (
              <>
                <svg className="absolute inset-0 w-16 h-16" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="32" cy="32" r="29" fill="none" stroke="rgba(251,191,36,0.3)" strokeWidth="3" />
                  <circle
                    cx="32" cy="32" r="29" fill="none" stroke="#fbbf24" strokeWidth="3"
                    strokeDasharray={2 * Math.PI * 29}
                    strokeDashoffset={2 * Math.PI * 29 * (1 - arc)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-[9px] font-bold px-1.5 rounded-full whitespace-nowrap shadow">
                  {timeLeft}
                </span>
              </>
            )}
          </div>
        ) : unlocked ? (
          /* Parcelle constructible */
          <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/70 bg-white/15 flex flex-col items-center justify-center transition-transform group-active:scale-95 group-hover:scale-105">
            {hasActiveSearch ? (
              <Search size={20} className="text-white animate-pulse" />
            ) : searchReady ? (
              <span className="text-lg animate-bounce">🏗️</span>
            ) : (
              <Plus size={24} className="text-white/90" />
            )}
          </div>
        ) : (
          /* Parcelle verrouillée */
          <div className="w-16 h-16 rounded-2xl border-2 border-white/20 bg-slate-900/20 flex items-center justify-center grayscale">
            <Lock size={20} className="text-white/50" />
          </div>
        )}
      </div>

      {/* Étiquette */}
      <span
        className={cn(
          'mt-1 text-[10px] font-bold leading-tight text-center px-1',
          unlocked ? 'text-white drop-shadow' : 'text-white/45',
        )}
      >
        {item.shortName}
      </span>
      {unlocked ? (
        <span className="text-[9px] font-bold text-emerald-900/80">
          {item.returnVariance > 0 ? '~' : ''}{formatPercent(node.returnRate)}/an
        </span>
      ) : (
        <span className="text-[9px] font-semibold text-white/60">🔒 {formatEuroCompact(item.unlockThreshold)}</span>
      )}
    </button>
  )
}
