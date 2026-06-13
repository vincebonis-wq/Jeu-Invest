import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import {
  calcAssetBreakdown,
  calcMonthlyCashflow,
  calcMonthlyPassiveIncome,
  calcNetWorth,
  totalMortgagePayments,
  MILESTONE_INFO,
} from '../../utils/calculations'
import { Card, CardHeader } from '../ui/Card'
import { ProgressBar } from '../ui/ProgressBar'
import { Icon } from '../ui/Icon'
import {
  formatEuro,
  formatEuroCompact,
  formatEuroSigned,
  formatMonthShort,
  cn,
} from '../../utils/formatting'
import type { AssetBreakdown } from '../../types'

const ALLOCATION_LABELS: Record<keyof AssetBreakdown, { label: string; color: string }> = {
  cash: { label: 'Liquidités', color: '#10b981' },
  livret: { label: 'Livret A', color: '#38bdf8' },
  assurance_vie: { label: 'Assurance Vie', color: '#22c55e' },
  bourse_etf: { label: 'Bourse', color: '#6366f1' },
  crowdfunding_immo: { label: 'Crowdfunding', color: '#f97316' },
  scpi: { label: 'SCPI', color: '#14b8a6' },
  business: { label: 'Business', color: '#a855f7' },
  parking: { label: 'Parking', color: '#64748b' },
  lmnp: { label: 'LMNP', color: '#ec4899' },
  immo_classique: { label: 'Locatif', color: '#eab308' },
}

export function Dashboard() {
  const game = useGameStore((s) => s.game)!
  const setScreen = useGameStore((s) => s.setScreen)

  const netWorth = calcNetWorth(game)
  const passiveIncome = calcMonthlyPassiveIncome(game)
  const cashflow = calcMonthlyCashflow(game)
  const milestone = MILESTONE_INFO[game.player.milestone]
  const progress = milestone.progress(game)
  const progressPct = (progress.current / progress.target) * 100

  const breakdown = useMemo(() => calcAssetBreakdown(game), [game])
  const allocationData = useMemo(
    () =>
      (Object.keys(breakdown) as (keyof AssetBreakdown)[])
        .map((key) => ({
          key,
          name: ALLOCATION_LABELS[key].label,
          value: Math.round(breakdown[key]),
          color: ALLOCATION_LABELS[key].color,
        }))
        .filter((d) => d.value > 0),
    [breakdown],
  )

  const chartData = useMemo(
    () =>
      game.stats.slice(-24).map((s) => ({
        date: formatMonthShort(s.dateISO),
        netWorth: s.netWorth,
      })),
    [game.stats],
  )

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Bandeau patrimoine */}
      <Card className="p-5 overflow-hidden relative">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-brand-50 opacity-60" />
        <div className="relative grid md:grid-cols-3 gap-4">
          <StatBlock
            icon={<TrendingUp size={20} />}
            label="Patrimoine net"
            value={formatEuro(netWorth)}
            accent="brand"
          />
          <StatBlock
            icon={<Banknote size={20} />}
            label="Revenus passifs / mois"
            value={formatEuro(passiveIncome)}
            accent="emerald"
          />
          <StatBlock
            icon={<Wallet size={20} />}
            label="Cashflow mensuel"
            value={formatEuroSigned(cashflow)}
            accent={cashflow >= 0 ? 'emerald' : 'red'}
          />
        </div>
      </Card>

      {/* Progression vers le prochain palier */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${milestone.color}20`, color: milestone.color }}
            >
              <Icon name={milestone.icon} size={18} />
            </div>
            <div>
              <div className="font-display font-bold text-slate-800 text-sm">
                Palier : {milestone.label}
              </div>
              <div className="text-xs text-slate-400">
                {game.player.milestone === 'multimillionnaire'
                  ? 'Tu as atteint le sommet !'
                  : game.player.milestone === 'rentier_partiel'
                    ? `Revenus passifs : ${formatEuroCompact(progress.current)} / ${formatEuroCompact(progress.target)} (salaire)`
                    : `Prochain objectif : ${formatEuroCompact(progress.target)}`}
              </div>
            </div>
          </div>
          <span className="font-display font-bold text-brand-600">
            {Math.min(100, Math.round(progressPct))}%
          </span>
        </div>
        <ProgressBar
          value={progressPct}
          barClassName="bg-gradient-to-r from-gold-400 to-gold-600"
        />
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Évolution du patrimoine */}
        <Card className="p-5 lg:col-span-2">
          <CardHeader
            title="Évolution du patrimoine"
            subtitle="2 dernières années"
            icon={<TrendingUp size={18} />}
          />
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ left: -10, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1c84f5" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#1c84f5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatEuroCompact(v)}
                  width={56}
                />
                <Tooltip
                  formatter={(v) => [formatEuro(Number(v)), 'Patrimoine']}
                  contentStyle={tooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="#1c84f5"
                  strokeWidth={2.5}
                  fill="url(#nwGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart text="Les données apparaîtront après quelques mois de jeu." />
          )}
        </Card>

        {/* Répartition des actifs */}
        <Card className="p-5">
          <CardHeader title="Répartition" subtitle="Allocation de ton capital" />
          {allocationData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {allocationData.map((d) => (
                      <Cell key={d.key} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatEuro(Number(v))}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto">
                {allocationData
                  .sort((a, b) => b.value - a.value)
                  .map((d) => (
                    <button
                      key={d.key}
                      onClick={() =>
                        setScreen(d.key === 'cash' ? 'dashboard' : 'portfolio')
                      }
                      className="w-full flex items-center gap-2 text-xs hover:bg-slate-50 rounded-lg px-1.5 py-1 transition-colors"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-slate-600 truncate flex-1 text-left">
                        {d.name}
                      </span>
                      <span className="font-semibold text-slate-700">
                        {formatEuroCompact(d.value)}
                      </span>
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <EmptyChart text="Aucun actif pour l'instant. Va investir !" />
          )}
        </Card>
      </div>

      {/* Détail du cashflow */}
      <Card className="p-5">
        <CardHeader title="Flux mensuel" subtitle="D'où vient ton argent chaque mois" />
        <div className="grid sm:grid-cols-2 gap-4">
          <FlowColumn
            title="Entrées"
            positive
            rows={[
              { label: 'Salaire', value: game.player.salary },
              { label: 'Revenus passifs', value: passiveIncome },
            ]}
          />
          <FlowColumn
            title="Sorties"
            rows={[
              { label: 'Charges courantes', value: game.monthlyExpenses.total },
              { label: 'Crédits', value: totalMortgagePayments(game) },
            ]}
          />
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="font-display font-bold text-slate-700">Solde net</span>
          <span
            className={cn(
              'font-display font-extrabold text-xl',
              cashflow >= 0 ? 'text-emerald-600' : 'text-red-500',
            )}
          >
            {formatEuroSigned(cashflow)}
          </span>
        </div>
      </Card>
    </div>
  )
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
}

function StatBlock({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: 'brand' | 'emerald' | 'red'
}) {
  const colors = {
    brand: 'text-brand-600 bg-brand-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    red: 'text-red-500 bg-red-50',
  }
  return (
    <div className="flex items-center gap-3">
      <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0', colors[accent])}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-slate-400 font-medium">{label}</div>
        <div className="font-display font-extrabold text-xl text-slate-800">
          {value}
        </div>
      </div>
    </div>
  )
}

function FlowColumn({
  title,
  rows,
  positive,
}: {
  title: string
  rows: { label: string; value: number }[]
  positive?: boolean
}) {
  const total = rows.reduce((s, r) => s + r.value, 0)
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-slate-600">
        {positive ? (
          <ArrowUpRight size={16} className="text-emerald-500" />
        ) : (
          <ArrowDownRight size={16} className="text-red-400" />
        )}
        {title}
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between text-sm">
            <span className="text-slate-500">{r.label}</span>
            <span className="font-semibold text-slate-700">
              {positive ? '+' : '-'}
              {formatEuro(r.value)}
            </span>
          </div>
        ))}
        <div className="flex justify-between text-sm pt-1.5 border-t border-slate-200">
          <span className="font-semibold text-slate-600">Total</span>
          <span
            className={cn(
              'font-display font-bold',
              positive ? 'text-emerald-600' : 'text-red-500',
            )}
          >
            {positive ? '+' : '-'}
            {formatEuro(total)}
          </span>
        </div>
      </div>
    </div>
  )
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-[170px] flex items-center justify-center text-center text-sm text-slate-400 px-6">
      {text}
    </div>
  )
}
