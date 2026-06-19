import { useEffect, useState } from 'react'
import { Lock, Search } from 'lucide-react'
import { useGameStore } from '../store/gameStore'
import { Icon } from '../components/ui/Icon'
import { BetaShell, useDrawer, cn } from './BetaShell'
import { computeBetaNodes, formatCountdown, type BetaNode } from './betaData'
import { formatEuroCompact, formatPercent } from '../utils/formatting'

const ACCENT = '#4338ca' // indigo urbain

export function BetaCityView() {
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
        className="absolute inset-0 overflow-hidden flex flex-col"
        style={{
          background:
            'linear-gradient(180deg, #312e81 0%, #4f46e5 30%, #818cf8 60%, #c7d2fe 100%)',
        }}
      >
        {/* Soleil + nuages */}
        <div className="absolute top-6 right-8 w-16 h-16 rounded-full bg-amber-200/80 blur-[1px] shadow-[0_0_60px_30px_rgba(254,240,138,0.4)]" />
        <div className="absolute top-12 left-6 w-24 h-6 rounded-full bg-white/30 blur-sm" />
        <div className="absolute top-20 left-24 w-16 h-4 rounded-full bg-white/20 blur-sm" />

        {/* Titre empire */}
        <div className="relative z-10 px-4 pt-4 shrink-0">
          <div className="max-w-2xl mx-auto rounded-2xl bg-white/15 backdrop-blur-sm border border-white/30 px-4 py-2.5 flex items-center justify-between">
            <div>
              <div className="font-display font-extrabold text-white text-base drop-shadow flex items-center gap-1.5">
                🏙️ Ta métropole
              </div>
              <div className="text-white/85 text-xs font-semibold">
                {ownedCount} immeuble{ownedCount > 1 ? 's' : ''} · district en expansion
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/70">Trésorerie</div>
              <div className="font-display font-bold text-white">{formatEuroCompact(game.cashBalance)}</div>
            </div>
          </div>
        </div>

        {/* Skyline — défilement horizontal */}
        <div className="relative flex-1 overflow-x-auto overflow-y-hidden">
          <div className="absolute bottom-0 left-0 right-0 flex items-end gap-2.5 px-5 pb-0 min-w-max h-full">
            {nodes.map((n) => (
              <CityBuilding key={n.item.id} node={n} onTap={() => handleTap(n)} />
            ))}
          </div>
        </div>

        {/* Rue / sol */}
        <div className="relative z-10 h-5 bg-slate-800 shrink-0 border-t-2 border-slate-600">
          <div
            className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2"
            style={{ backgroundImage: 'repeating-linear-gradient(90deg, #fbbf24 0 14px, transparent 14px 30px)' }}
          />
        </div>
      </div>
    </BetaShell>
  )
}

function CityBuilding({ node, onTap }: { node: BetaNode; onTap: () => void }) {
  const { item, unlocked, isOwned, level, isUpgrading, upgradeReadyAtReal, hasActiveSearch, searchReady } = node

  // Hauteur de l'immeuble : base selon le niveau / possession
  const heightPct = isOwned
    ? 40 + level * 11           // 51% → 95%
    : unlocked
      ? 26                       // chantier prêt
      : 18                       // terrain verrouillé bas

  const timeLeft =
    isUpgrading && upgradeReadyAtReal ? formatCountdown(upgradeReadyAtReal - Date.now()) : null

  return (
    <button
      onClick={onTap}
      className="relative flex flex-col items-center justify-end group shrink-0"
      style={{ width: 62, height: '82%' }}
    >
      {/* Étiquette flottante */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center pointer-events-none">
        <span
          className={cn('text-[9px] font-bold whitespace-nowrap px-1 rounded',
            unlocked ? 'text-white' : 'text-white/45')}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
        >
          {item.shortName}
        </span>
        {unlocked && (
          <span className="text-[8px] font-bold text-amber-200" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
            {item.returnVariance > 0 ? '~' : ''}{formatPercent(node.returnRate)}
          </span>
        )}
      </div>

      {/* Corps de l'immeuble */}
      <div
        className={cn(
          'relative w-full rounded-t-lg transition-all duration-300 group-active:scale-y-95 origin-bottom overflow-hidden',
          isOwned ? 'shadow-2xl border-x border-t border-white/20' : 'border-2 border-dashed border-white/40',
        )}
        style={{
          height: `${heightPct}%`,
          background: isOwned
            ? `linear-gradient(180deg, ${item.color} 0%, ${item.color}cc 100%)`
            : unlocked
              ? 'rgba(255,255,255,0.15)'
              : 'rgba(15,23,42,0.25)',
        }}
      >
        {/* Fenêtres */}
        {isOwned && (
          <div
            className="absolute inset-x-1 top-6 bottom-1 opacity-70"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(255,255,255,0.85) 0 4px, transparent 4px 11px), repeating-linear-gradient(90deg, rgba(255,255,255,0.85) 0 4px, transparent 4px 11px)',
              backgroundSize: '11px 11px',
              maskImage: 'linear-gradient(0deg, transparent 4px, black 4px)',
            }}
          />
        )}

        {/* Médaillon toit */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          {isOwned ? (
            <div
              className="w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg border border-white/50 group-hover:scale-110 transition-transform"
              style={{ background: item.color }}
            >
              <Icon name={item.icon} size={16} className="text-white" />
            </div>
          ) : unlocked ? (
            <div className="w-8 h-8 rounded-xl bg-white/20 border-2 border-dashed border-white/60 flex items-center justify-center">
              {hasActiveSearch ? (
                <Search size={13} className="text-white animate-pulse" />
              ) : searchReady ? (
                <span className="text-sm animate-bounce">🏗️</span>
              ) : (
                <span className="text-white font-bold text-sm">+</span>
              )}
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-slate-800/60 flex items-center justify-center">
              <Lock size={13} className="text-white/50" />
            </div>
          )}
        </div>

        {/* Badge niveau */}
        {isOwned && (
          <span
            className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-extrabold text-white bg-black/30 px-1.5 rounded-full"
          >
            N{level}
          </span>
        )}

        {/* Grue d'amélioration */}
        {isUpgrading && (
          <div className="absolute -top-5 right-0 text-xs animate-pulse">🏗️</div>
        )}
      </div>

      {/* Timer / seuil sous l'immeuble */}
      {isUpgrading && timeLeft ? (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-3 bg-amber-400 text-amber-900 text-[8px] font-bold px-1 rounded whitespace-nowrap z-10">
          {timeLeft}
        </span>
      ) : !unlocked ? (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-3 text-[8px] font-semibold text-white/70 whitespace-nowrap z-10">
          {formatEuroCompact(item.unlockThreshold)}
        </span>
      ) : null}
    </button>
  )
}
