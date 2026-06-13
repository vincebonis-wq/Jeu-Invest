import { Pause, Play } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { formatGameDate } from '../../utils/formatting'
import { PHASE_LABEL } from '../../engine/economy'
import { cn } from '../../utils/formatting'
import type { SpeedMultiplier } from '../../types'

const SPEEDS: SpeedMultiplier[] = [1, 5, 10, 50]

export function GameClock() {
  const gameDateISO = useGameStore((s) => s.game?.gameDateISO)
  const speed = useGameStore((s) => s.game?.speedMultiplier)
  const isPaused = useGameStore((s) => s.game?.isPaused)
  const phase = useGameStore((s) => s.game?.economy.marketPhase)
  const age = useGameStore((s) => s.game?.player.age)
  const setSpeed = useGameStore((s) => s.setSpeed)
  const togglePause = useGameStore((s) => s.togglePause)

  if (!gameDateISO || !phase) return null
  const phaseInfo = PHASE_LABEL[phase]

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Date + âge */}
      <div className="text-right">
        <div className="font-display font-bold text-slate-800 leading-tight">
          {formatGameDate(gameDateISO)}
        </div>
        <div className="text-xs text-slate-400">{age} ans</div>
      </div>

      {/* Phase de marché */}
      <div
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
        style={{ backgroundColor: `${phaseInfo.color}18`, color: phaseInfo.color }}
        title={phaseInfo.label}
      >
        <span>{phaseInfo.emoji}</span>
        <span className="hidden md:inline">{phaseInfo.label}</span>
      </div>

      {/* Contrôles vitesse */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
        <button
          onClick={togglePause}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            isPaused
              ? 'bg-emerald-500 text-white'
              : 'hover:bg-white text-slate-500',
          )}
          title={isPaused ? 'Reprendre' : 'Pause'}
        >
          {isPaused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={cn(
              'px-2 py-1 rounded-lg text-xs font-bold transition-colors min-w-[2rem]',
              speed === s
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-white',
            )}
          >
            ×{s}
          </button>
        ))}
      </div>
    </div>
  )
}
