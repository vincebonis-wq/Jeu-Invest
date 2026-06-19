import { useMemo, useState } from 'react'
import { PrestigeModal } from './PrestigeModal'
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
import { RotateCcw, Receipt, Trophy, Share2 } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { MILESTONE_INFO, milestoneRank } from '../../utils/calculations'
import type { GameState, MilestoneLevel } from '../../types'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { ShareModal } from './ShareModal'
import { Icon } from '../ui/Icon'
import { BADGES } from '../../data/badges'
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

function BadgesPanel({ game }: { game: GameState }) {
  const earned = new Set((game.badges ?? []).map((b) => b.id))
  const categories = ['special', 'milestone', 'behavior', 'market'] as const
  const catLabels = { special: '⭐ Spéciaux', milestone: '🏆 Paliers', behavior: '🧠 Comportement', market: '📊 Marchés' }

  return (
    <Card className="p-5">
      <CardHeader title="Trophées" subtitle={`${earned.size} / ${BADGES.length} débloqués`} icon={<Trophy size={18} />} />
      <div className="space-y-4 mt-3">
        {categories.map((cat) => {
          const inCat = BADGES.filter((b) => b.category === cat)
          return (
            <div key={cat}>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{catLabels[cat]}</div>
              <div className="grid grid-cols-2 gap-2">
                {inCat.map((badge) => {
                  const isEarned = earned.has(badge.id)
                  const earnedBadge = (game.badges ?? []).find((b) => b.id === badge.id)
                  return (
                    <div
                      key={badge.id}
                      className={cn(
                        'flex items-start gap-2.5 p-3 rounded-2xl border transition-all',
                        isEarned
                          ? badge.category === 'special'
                            ? 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200'
                            : 'bg-slate-50 border-slate-200'
                          : 'bg-white border-dashed border-slate-200 opacity-40',
                      )}
                    >
                      <span className={cn('text-2xl shrink-0 leading-none', !isEarned && 'grayscale')}>
                        {badge.emoji}
                      </span>
                      <div className="min-w-0">
                        <div className={cn('text-xs font-bold truncate', isEarned ? 'text-slate-800' : 'text-slate-400')}>
                          {badge.name}
                        </div>
                        <div className="text-[11px] text-slate-400 leading-tight mt-0.5 line-clamp-2">
                          {isEarned ? badge.description : '???'}
                        </div>
                        {earnedBadge && (
                          <div className="text-[10px] text-slate-300 mt-1">
                            Mois {earnedBadge.earnedAtMonthIndex}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export function Stats() {
  const game = useGameStore((s) => s.game)!
  const newGame = useGameStore((s) => s.newGame)
  const [confirmReset, setConfirmReset] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [prestigeOpen, setPrestigeOpen] = useState(false)

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
    <div className="space-y-4 animate-screen-in">
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

      {/* Trophées */}
      <BadgesPanel game={game} />

      {/* Partager */}
      <Card className="p-5">
        <CardHeader title="Partager ta progression" subtitle="Montre à tes amis où tu en es" icon={<Share2 size={18} />} />
        <p className="text-sm text-slate-500 mb-3">Génère une carte de résumé à partager sur les réseaux.</p>
        <Button variant="primary" onClick={() => setShareOpen(true)}>
          <Share2 size={16} /> Partager ma progression
        </Button>
      </Card>

      {/* Prestige */}
      {(game.player.milestone === 'millionnaire' || game.player.milestone === 'multimillionnaire') && (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xl shrink-0">
              {game.prestige ? `×${game.prestige.level}` : '👑'}
            </div>
            <div className="flex-1">
              <div className="font-display font-bold text-slate-800">
                {game.prestige ? `Prestige niveau ${game.prestige.level}` : 'Prestige disponible !'}
              </div>
              <div className="text-sm text-slate-500">
                {game.prestige
                  ? `+${Math.round(game.prestige.heritageBonus.returnBonusPct * 100)}% rendements actifs`
                  : 'Recommence avec des avantages permanents'}
              </div>
            </div>
            <Button variant="primary" onClick={() => setPrestigeOpen(true)}>
              {game.prestige ? 'Monter' : 'Activer'}
            </Button>
          </div>
        </Card>
      )}
      {prestigeOpen && <PrestigeModal onClose={() => setPrestigeOpen(false)} />}

      {/* Réglages */}
      <Card className="p-5">
        <CardHeader title="Réglages" subtitle="Gestion de la partie" />
        <div className="rounded-2xl bg-red-50 border border-red-100 p-4 mb-4">
          <div className="font-bold text-red-800 mb-1 flex items-center gap-2">
            <RotateCcw size={16} /> Nouvelle partie
          </div>
          <p className="text-sm text-red-600 mb-3">
            Efface définitivement ta progression actuelle et recommence depuis zéro.
            Toutes tes compétences, investissements et économies seront perdus.
          </p>
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={16} /> Recommencer depuis zéro
          </Button>
        </div>
      </Card>

      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}

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
