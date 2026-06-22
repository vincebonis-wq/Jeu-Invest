import { useState, type ReactNode } from 'react'
import { X, TrendingUp, Wallet, Target, Bell, BarChart2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useGameStore, selectUnreadCount, selectCompletedChallenges } from '../store/gameStore'
import {
  calcNetWorth,
  calcMonthlyPassiveIncome,
  MILESTONE_INFO,
} from '../utils/calculations'
import type { Screen } from '../types'
import { Icon } from '../components/ui/Icon'
import { Marketplace } from '../components/game/Marketplace'
import { Portfolio } from '../components/game/Portfolio'
import { Properties } from '../components/game/Properties'
import { WeeklyChallenges } from '../components/game/WeeklyChallenges'
import { Skills } from '../components/game/Skills'
import { Events } from '../components/game/Events'
import { Stats } from '../components/game/Stats'
import { Job } from '../components/game/Job'
import { formatEuroCompact, cn } from '../utils/formatting'

const DRAWER_SCREENS: Partial<Record<Screen, { title: string; Comp: React.ComponentType }>> = {
  marketplace: { title: 'Investir', Comp: Marketplace },
  portfolio: { title: 'Portefeuille', Comp: Portfolio },
  properties: { title: 'Mes biens', Comp: Properties },
  challenges: { title: 'Défis', Comp: WeeklyChallenges },
  skills: { title: 'Carrière', Comp: Skills },
  events: { title: 'Actualités', Comp: Events },
  stats: { title: 'Statistiques', Comp: Stats },
  job: { title: 'Mon emploi', Comp: Job },
}

const DOCK: { screen: Screen; label: string; icon: typeof TrendingUp }[] = [
  { screen: 'marketplace', label: 'Investir', icon: TrendingUp },
  { screen: 'portfolio', label: 'Patrimoine', icon: Wallet },
  { screen: 'challenges', label: 'Défis', icon: Target },
  { screen: 'stats', label: 'Stats', icon: BarChart2 },
  { screen: 'events', label: 'Actualités', icon: Bell },
]

interface BetaShellProps {
  /** Couleur d'accent / ambiance pour le HUD. */
  accent: string
  /** Visualisation centrale (base ou ville). */
  children: ReactNode
  /** Ouvre un écran dans le tiroir (passé à la visualisation). */
  openScreen: (s: Screen) => void
  /** Écran actuellement ouvert dans le tiroir, ou null. */
  drawerScreen: Screen | null
  onCloseDrawer: () => void
}

export function BetaShell({ accent, children, openScreen, drawerScreen, onCloseDrawer }: BetaShellProps) {
  const game = useGameStore((s) => s.game)!
  const unread = useGameStore(selectUnreadCount)
  const challengeCount = useGameStore(selectCompletedChallenges)

  const netWorth = calcNetWorth(game)
  const passive = calcMonthlyPassiveIncome(game)
  const milestone = MILESTONE_INFO[game.player.milestone]
  const progress = milestone.progress(game)
  const pct = Math.min(100, Math.round((progress.current / progress.target) * 100))

  const drawer = drawerScreen ? DRAWER_SCREENS[drawerScreen] : null

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      {/* ── HUD haut ── */}
      <div
        className="relative z-20 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${accent} 0%, rgba(15,23,42,0.95) 130%)` }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-white/70 font-medium">Patrimoine net</div>
              <div className="font-display font-extrabold text-2xl leading-tight truncate">
                {formatEuroCompact(netWorth)}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <HudChip label="Cash" value={formatEuroCompact(game.cashBalance)} />
              <HudChip label="Passif/mois" value={formatEuroCompact(passive)} />
            </div>
          </div>

          {/* Palier + progression */}
          <div className="mt-2.5 flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-white/15 shrink-0">
              <Icon name={milestone.icon} size={12} /> {milestone.label}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-white/80 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] font-bold text-white/80 shrink-0">{pct}%</span>
          </div>
        </div>
      </div>

      {/* ── Visualisation ── */}
      <div className="relative flex-1 overflow-hidden">{children}</div>

      {/* ── Dock bas ── */}
      <div className="relative z-20 bg-slate-900/95 backdrop-blur border-t border-white/10 px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto flex justify-around">
          {DOCK.map(({ screen, label, icon: Icon2 }) => {
            const badge =
              screen === 'events' ? unread : screen === 'challenges' ? challengeCount : 0
            return (
              <button
                key={screen}
                onClick={() => openScreen(screen)}
                className="relative flex flex-col items-center gap-0.5 px-3 py-1 text-slate-300 hover:text-white transition-colors"
              >
                <Icon2 size={22} />
                <span className="text-[10px] font-semibold">{label}</span>
                {badge > 0 && (
                  <span className="absolute top-0 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tiroir (écran existant réutilisé) ── */}
      {drawer &&
        createPortal(
          <div className="fixed inset-0 z-40 flex flex-col justify-end">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onCloseDrawer} />
            <div className="relative bg-slate-100 rounded-t-3xl shadow-2xl max-h-[88dvh] flex flex-col animate-slide-up">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
                <h2 className="font-display font-extrabold text-lg text-slate-800">{drawer.title}</h2>
                <button
                  onClick={onCloseDrawer}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="overflow-y-auto p-4 pb-8">
                <drawer.Comp />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function HudChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-2.5 py-1 text-right">
      <div className="text-[9px] text-white/60 leading-none">{label}</div>
      <div className="font-display font-bold text-sm leading-tight">{value}</div>
    </div>
  )
}

// Petite icône notifications réutilisable (pour les vues qui en veulent).
export function BellBadge({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative p-2 rounded-xl bg-white/15 text-white">
      <Bell size={18} />
      {count > 0 && (
        <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}

// Helper pour gérer l'état du tiroir au niveau des vues beta.
export function useDrawer() {
  const setScreen = useGameStore((s) => s.setScreen)
  const [drawerScreen, setDrawerScreen] = useState<Screen | null>(null)
  const open = (s: Screen) => {
    setScreen(s)
    setDrawerScreen(s)
  }
  const close = () => setDrawerScreen(null)
  return { drawerScreen, open, close }
}

export { cn }
