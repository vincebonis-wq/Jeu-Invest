import { useGameStore } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { MILESTONE_INFO } from '../../utils/calculations'
import { NumberTicker } from '../ui/NumberTicker'
import { Icon } from '../ui/Icon'
import { GameClock } from './GameClock'
import { formatEuroCompact } from '../../utils/formatting'

export function Header() {
  const game = useGameStore((s) => s.game)
  if (!game) return null

  const netWorth = calcNetWorth(game)
  const milestone = MILESTONE_INFO[game.player.milestone]

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
      <div className="px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
        {/* Gauche : patrimoine */}
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="hidden sm:flex w-11 h-11 rounded-2xl items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: `${milestone.color}20`, color: milestone.color }}
            title={milestone.label}
          >
            <Icon name={milestone.icon} size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span className="truncate">{game.player.name}</span>
              <span
                className="px-1.5 py-0.5 rounded-md font-bold"
                style={{ backgroundColor: `${milestone.color}20`, color: milestone.color }}
              >
                {milestone.label}
              </span>
            </div>
            <NumberTicker
              value={netWorth}
              format={(n) => formatEuroCompact(n)}
              className="font-display font-extrabold text-xl lg:text-2xl text-slate-800"
            />
          </div>
        </div>

        {/* Droite : horloge */}
        <GameClock />
      </div>
    </header>
  )
}
