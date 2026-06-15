import { useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { PHASE_LABEL } from '../../engine/economy'
import { cn } from '../../utils/formatting'

export function StockMarketWidget() {
  const game = useGameStore((s) => s.game)!
  const { economy } = game
  const phase = economy.marketPhase
  const phaseInfo = PHASE_LABEL[phase]

  const history = economy.stockIndexHistory || []
  const data = useMemo(
    () => history.slice(-120).map((p, i) => ({ i, v: p.value })),
    [history],
  )

  const current = economy.stockIndex
  const first = data.length > 0 ? data[0].v : 100
  const prev = data.length > 1 ? data[data.length - 2].v : current
  const windowChangePct = first > 0 ? ((current - first) / first) * 100 : 0
  const dailyChangePct = prev > 0 ? ((current - prev) / prev) * 100 : 0
  const windowUp = windowChangePct >= 0
  const dailyUp = dailyChangePct >= 0

  // Couleur de la courbe selon la tendance de la fenêtre.
  const lineColor = windowUp ? '#16a34a' : '#dc2626'

  return (
    <div className="rounded-2xl overflow-hidden bg-slate-900 text-white shadow-sm">
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">
              <Activity size={13} /> Indice Bourse Monde
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-extrabold text-3xl tracking-tight">
                {current.toFixed(1)}
              </span>
              <span
                className={cn(
                  'flex items-center gap-0.5 text-sm font-bold',
                  windowUp ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {windowUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {windowUp ? '+' : ''}
                {windowChangePct.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Aujourd'hui :{' '}
              <span className={dailyUp ? 'text-emerald-400' : 'text-red-400'}>
                {dailyUp ? '+' : ''}
                {dailyChangePct.toFixed(2)}%
              </span>
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${phaseInfo.color}25`, color: phaseInfo.color }}
          >
            <span>{phaseInfo.emoji}</span>
            {phaseInfo.label}
          </div>
        </div>
      </div>

      {/* Mini graphique boursier */}
      <div className="h-24 w-full">
        {data.length > 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={lineColor}
                strokeWidth={2}
                fill="url(#stockGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-600">
            Le marché se met en route…
          </div>
        )}
      </div>

      {/* Bandeau pédagogique selon la phase */}
      <div className="px-4 py-2.5 bg-slate-800/60 text-xs text-slate-300">
        {phase === 'crash'
          ? '💥 Krach : les prix s\'effondrent. Pour un investisseur long terme, c\'est le moment d\'acheter en soldes.'
          : phase === 'bear'
            ? '📉 Marché baissier : prudence, mais les bonnes affaires se préparent.'
            : phase === 'bull'
              ? '📈 Marché haussier : tout monte. Reste discipliné, n\'investis pas à crédit par euphorie.'
              : '➡️ Marché stable : un bon moment pour investir régulièrement, sans précipitation.'}
      </div>
    </div>
  )
}
