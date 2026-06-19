import {
  Bell,
  Building2,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Target,
  TrendingUp,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { useGameStore, selectUnreadCount, selectCompletedChallenges } from '../../store/gameStore'
import type { Screen } from '../../types'
import { cn } from '../../utils/formatting'
import { formatEuroCompact } from '../../utils/formatting'

interface NavItem {
  screen: Screen
  label: string
  icon: React.ComponentType<LucideProps>
}

const NAV: NavItem[] = [
  { screen: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
  { screen: 'marketplace', label: 'Investissements', icon: TrendingUp },
  { screen: 'properties', label: 'Biens', icon: Building2 },
  { screen: 'skills', label: 'Carrière', icon: GraduationCap },
  { screen: 'events', label: 'Actualités', icon: Bell },
  { screen: 'challenges', label: 'Défis', icon: Target },
]

export function Sidebar() {
  const screen = useGameStore((s) => s.screen)
  const setScreen = useGameStore((s) => s.setScreen)
  const cash = useGameStore((s) => s.game?.cashBalance ?? 0)
  const unread = useGameStore(selectUnreadCount)
  const challengeCount = useGameStore(selectCompletedChallenges)
  const activeTraining = useGameStore((s) => s.game?.player.activeTraining)
  const reopenOnboarding = useGameStore((s) => s.reopenOnboarding)

  return (
    <>
      {/* Desktop : sidebar verticale */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-slate-900 border-r border-slate-700/50 p-4">
        <div className="flex items-center gap-2 px-2 mb-6">
          <div className="w-9 h-9 rounded-xl stat-gradient flex items-center justify-center text-white font-display font-extrabold text-lg">
            P
          </div>
          <span className="font-display font-extrabold text-lg text-white">
            Patrimoine
          </span>
        </div>

        {/* Cash dispo */}
        <div className="mb-4 p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30">
          <div className="text-xs text-emerald-400 font-semibold mb-0.5">
            Liquidités
          </div>
          <div className="font-display font-extrabold text-xl text-emerald-300">
            {formatEuroCompact(cash)}
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavButton
              key={item.screen}
              item={item}
              active={screen === item.screen || (item.screen === 'marketplace' && (screen === 'portfolio')) || (item.screen === 'skills' && screen === 'job')}
              badge={item.screen === 'events' ? unread : item.screen === 'challenges' ? challengeCount : 0}
              pulse={item.screen === 'skills' && !!activeTraining}
              onClick={() => setScreen(item.screen)}
            />
          ))}
        </nav>

        <button
          onClick={reopenOnboarding}
          className="mt-auto flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all"
        >
          <HelpCircle size={20} />
          <span>Revoir le guide</span>
        </button>
      </aside>

      {/* Mobile : barre de navigation en bas */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex justify-around px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = screen === item.screen
            || (item.screen === 'marketplace' && screen === 'portfolio')
            || (item.screen === 'skills' && screen === 'job')
          return (
            <button
              key={item.screen}
              onClick={() => setScreen(item.screen)}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors',
                active ? 'text-brand-600' : 'text-slate-400',
              )}
            >
              <Icon size={22} />
              <span className="text-[10px] font-semibold">{item.label.split(' ')[0]}</span>
              {item.screen === 'events' && unread > 0 && (
                <span className="absolute top-0 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
              {item.screen === 'challenges' && challengeCount > 0 && (
                <span className="absolute top-0 right-1 w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {challengeCount > 9 ? '9+' : challengeCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </>
  )
}

function NavButton({
  item,
  active,
  badge,
  pulse,
  onClick,
}: {
  item: NavItem
  active: boolean
  badge: number
  pulse?: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all',
        active
          ? 'bg-brand-500/20 text-brand-300'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
      )}
    >
      <Icon size={20} />
      <span>{item.label}</span>
      {badge > 0 && (
        <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {pulse && badge === 0 && (
        <span className="ml-auto w-2.5 h-2.5 rounded-full bg-brand-400 animate-pulse" />
      )}
    </button>
  )
}
