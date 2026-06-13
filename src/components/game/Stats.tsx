import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { RotateCcw, Receipt, Trophy } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { MILESTONE_INFO, milestoneRank } from '../../utils/calculations'
import type { MilestoneLevel } from '../../types'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Icon } from '../ui/Icon'
import {
  formatEuro,
  formatEuroCompact,
  formatMonthShort,
  cn,
} from '../../utils/formatting'

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
}

export function Stats() {
  const game = useGameStore((s) => s.game)!
  const newGame = useGameStore((s) => s.newGame)
  const [confirmReset, setConfirmReset] = useState(false)

  const data = useMemo(
    () =>
      game.stats.slice(-36).map((s) => ({
        date: formatMonthShort(s.dateISO),
        netWorth: s.netWorth,
        salary: s.salary,
        passive: s.passiveIncome,
        expenses: s.expenses,
        tax: s.tax,
      })),
    [game.stats],
  )

  const currentRank = milestoneRank(game.player.milestone)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Tuiles clés */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          label="Impôts payés"
          value={formatEuroCompact(game.totalTaxPaid)}
          icon={<Receipt size={18} />}
          color="#ef4444"
        />
        <KpiTile
          label="Investissements"
          value={String(game.investments.length)}
          icon={<Icon name="Wallet" size={18} />}
          color="#1c84f5"
        />
        <KpiTile
          label="Crédits en cours"
          value={String(game.mortgages.length)}
          icon={<Icon name="Landmark" size={18} />}
          color="#f59e0b"
        />
        <KpiTile
          label="Âge"
          value={`${game.player.age} ans`}
          icon={<Icon name="User" size={18} />}
          color="#a855f7"
        />
      </div>

      {data.length > 1 ? (
        <>
          {/* Patrimoine */}
          <Card className="p-5">
            <CardHeader title="Patrimoine dans le temps" subtitle="3 dernières années" />
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data} margin={{ left: -8, right: 8 }}>
                <defs>
                  <linearGradient id="statNw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1c84f5" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#1c84f5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatEuroCompact(v)} width={56} />
                <Tooltip formatter={(v) => [formatEuro(Number(v)), 'Patrimoine']} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="netWorth" stroke="#1c84f5" strokeWidth={2.5} fill="url(#statNw)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Revenus salaire vs passif */}
          <Card className="p-5">
            <CardHeader title="Salaire vs revenus passifs" subtitle="L'objectif : que le passif dépasse le salaire" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} margin={{ left: -8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatEuroCompact(v)} width={56} />
                <Tooltip formatter={(v) => formatEuro(Number(v))} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="salary" name="Salaire" stackId="a" fill="#cbd5e1" radius={[0, 0, 0, 0]} />
                <Bar dataKey="passive" name="Revenus passifs" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Charges & impôts */}
          <Card className="p-5">
            <CardHeader title="Charges & impôts" subtitle="Tes sorties d'argent mensuelles" />
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data} margin={{ left: -8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatEuroCompact(v)} width={56} />
                <Tooltip formatter={(v) => formatEuro(Number(v))} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="expenses" name="Charges" stroke="#f97316" strokeWidth={2} fill="#f9731620" />
                <Line type="monotone" dataKey="tax" name="Impôts" stroke="#ef4444" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </>
      ) : (
        <Card className="p-10 text-center text-sm text-slate-400">
          Les statistiques détaillées apparaîtront après quelques mois de jeu.
        </Card>
      )}

      {/* Parcours des paliers */}
      <Card className="p-5">
        <CardHeader title="Ton parcours" subtitle="Les paliers de la richesse" icon={<Trophy size={18} />} />
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MILESTONE_INFO) as MilestoneLevel[]).map((level) => {
            const info = MILESTONE_INFO[level]
            const reached = milestoneRank(level) <= currentRank
            return (
              <div
                key={level}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all',
                  reached ? 'border-transparent' : 'border-dashed border-slate-200 opacity-50',
                )}
                style={reached ? { backgroundColor: `${info.color}18` } : undefined}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${info.color}25`, color: info.color }}
                >
                  <Icon name={info.icon} size={15} />
                </div>
                <span
                  className="text-sm font-semibold"
                  style={{ color: reached ? info.color : '#94a3b8' }}
                >
                  {info.label}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Réglages */}
      <Card className="p-5">
        <CardHeader title="Réglages" subtitle="Gestion de la partie" />
        <Button variant="danger" onClick={() => setConfirmReset(true)}>
          <RotateCcw size={16} /> Nouvelle partie
        </Button>
      </Card>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Recommencer ?" size="sm">
        <p className="text-sm text-slate-500 mb-4">
          Cette action efface définitivement ta partie actuelle et ta progression.
          Es-tu sûr ?
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setConfirmReset(false)}>
            Annuler
          </Button>
          <Button variant="danger" fullWidth onClick={newGame}>
            Tout effacer
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function KpiTile({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <Card className="p-4">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
        style={{ backgroundColor: `${color}18`, color }}
      >
        {icon}
      </div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-display font-bold text-lg text-slate-800">{value}</div>
    </Card>
  )
}
