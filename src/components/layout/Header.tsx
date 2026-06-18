import { Settings, Wallet, TrendingUp } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth, calcMonthlyPassiveIncome, totalInvestmentValue } from '../../utils/calculations'
import { MILESTONE_INFO } from '../../utils/calculations'
import { NumberTicker } from '../ui/NumberTicker'
import { Icon } from '../ui/Icon'
import { GameClock } from './GameClock'
import { formatEuroCompact, formatMonthYear } from '../../utils/formatting'

export function Header() {
  const game = useGameStore((s) => s.game)
  const setScreen = useGameStore((s) => s.setScreen)
  if (!game) return null

  const netWorth = calcNetWorth(game)
  const investedValue = totalInvestmentValue(game.investments)
  const passiveIncome = calcMonthlyPassiveIncome(game)
  const milestone = MILESTONE_INFO[game.player.milestone]

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
      <div className="px-3 sm:px-4 lg:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Gauche : identité + patrimoine net */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 shrink-0">
          <div
            className="hidden sm:flex w-11 h-11 rounded-2xl items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: `${milestone.color}20`, color: milestone.color }}
            title={milestone.label}
          >
            <Icon name={milestone.icon} size={22} />
          </div>
          <div className="min-w-0">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium">
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
              className="font-display font-extrabold text-lg sm:text-xl lg:text-2xl text-slate-800"
            />
            <div className="sm:hidden text-[10px] text-slate-400 font-medium leading-none mt-0.5">
              {formatMonthYear(game.gameDateISO)} · {game.player.age} ans
            </div>
          </div>
        </div>

        {/* Centre : cash + investissements — TOUJOURS visibles, à tout breakpoint */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1 sm:gap-1.5 bg-emerald-50 rounded-xl px-2 sm:px-3 py-1.5 shrink-0">
            <Wallet size={13} className="text-emerald-500 shrink-0" />
            <span className="font-display font-bold text-emerald-700 text-xs sm:text-sm whitespace-nowrap">
              {formatEuroCompact(game.cashBalance)}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 bg-indigo-50 rounded-xl px-2 sm:px-3 py-1.5 shrink-0">
            <TrendingUp size={13} className="text-indigo-500 shrink-0" />
            <span className="font-display font-bold text-indigo-700 text-xs sm:text-sm whitespace-nowrap">
              {formatEuroCompact(investedValue)}
            </span>
          </div>
          {passiveIncome > 0 && (
            <div className="hidden md:flex items-center gap-1.5 bg-amber-50 rounded-xl px-3 py-1.5 shrink-0">
              <span className="text-amber-500 text-xs">+</span>
              <span className="font-display font-bold text-amber-700 text-sm whitespace-nowrap">
                {formatEuroCompact(passiveIncome)}/mois
              </span>
            </div>
          )}
        </div>

        {/* Droite : réglages + horloge */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => setScreen('stats')}
            className="hidden md:flex w-9 h-9 rounded-xl items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Réglages"
          >
            <Settings size={18} />
          </button>
          <GameClock />
        </div>
      </div>
    </header>
  )
}
