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
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { RotateCcw, Receipt, Trophy, Share2, Download, Upload } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import {
  MILESTONE_INFO,
  milestoneRank,
  calcNetWorth,
  calcMonthlyCashflow,
  calcMonthlyPassiveIncome,
} from '../../utils/calculations'
import { getInvestmentLevelBonus } from '../../data/upgradeTiers'
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

const BADGE_PLAYER_PCT: Record<string, number> = {
  first_investment: 91, speed_investor: 62, livret_full: 43, first_etf: 54,
  first_real_estate: 29, first_business: 16, diversified_4: 22, survived_crash: 37,
  crypto_survivor: 13, passive_income_500: 24, passive_income_salary: 11,
  net_worth_10k: 72, net_worth_50k: 48, net_worth_100k: 33, net_worth_500k: 12,
  millionnaire: 7, no_debt: 19, streak_7: 51, streak_30: 15,
  buy_in_crash: 27, prestige_1: 9, prestige_3: 3, prestige_5: 1,
}

function BadgesPanel({ game }: { game: GameState }) {
  const earnedSet = new Set((game.badges ?? []).map((b) => b.id))
  const [activeTab, setActiveTab] = useState<'all' | 'earned' | 'locked'>('all')
  const categories = ['special', 'milestone', 'behavior', 'market'] as const
  const catLabels = { special: '⭐ Spéciaux', milestone: '🏆 Paliers', behavior: '🧠 Comportement', market: '📊 Marchés' }

  const filteredBadges = (cat: typeof categories[number]) =>
    BADGES.filter((b) => b.category === cat).filter((b) => {
      if (activeTab === 'earned') return earnedSet.has(b.id)
      if (activeTab === 'locked') return !earnedSet.has(b.id)
      return true
    })

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <CardHeader
          title="Trophées"
          subtitle={`${earnedSet.size} / ${BADGES.length} débloqués`}
          icon={<Trophy size={18} />}
        />
        <div className="flex gap-1 text-xs shrink-0">
          {(['all', 'earned', 'locked'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-2 py-1 rounded-lg font-semibold transition-colors',
                activeTab === tab ? 'bg-brand-100 text-brand-700' : 'text-slate-400 hover:text-slate-600',
              )}
            >
              {tab === 'all' ? 'Tous' : tab === 'earned' ? 'Obtenus' : 'À débloquer'}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-5">
        {categories.map((cat) => {
          const inCat = filteredBadges(cat)
          if (inCat.length === 0) return null
          return (
            <div key={cat}>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{catLabels[cat]}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {inCat.map((badge) => {
                  const isEarned = earnedSet.has(badge.id)
                  const earnedBadge = (game.badges ?? []).find((b) => b.id === badge.id)
                  const pct = BADGE_PLAYER_PCT[badge.id] ?? 50
                  return (
                    <div
                      key={badge.id}
                      className={cn(
                        'flex items-start gap-2.5 p-3 rounded-2xl border transition-all',
                        isEarned
                          ? badge.category === 'special'
                            ? 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200'
                            : 'bg-slate-50 border-slate-200'
                          : 'bg-white border-dashed border-slate-200',
                      )}
                    >
                      <span className={cn('text-2xl shrink-0 leading-none mt-0.5', !isEarned && 'grayscale opacity-40')}>
                        {badge.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <div className={cn('text-xs font-bold truncate', isEarned ? 'text-slate-800' : 'text-slate-400')}>
                            {badge.name}
                          </div>
                          <div className={cn('text-[10px] font-semibold shrink-0', isEarned ? 'text-slate-400' : 'text-slate-300')}>
                            {pct}% joueurs
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-400 leading-tight line-clamp-2">
                          {badge.description}
                        </div>
                        {isEarned && earnedBadge && (
                          <div className="text-[10px] text-emerald-500 font-semibold mt-1">
                            ✓ Obtenu au mois {earnedBadge.earnedAtMonthIndex}
                          </div>
                        )}
                        {!isEarned && (
                          <div className="mt-1.5 h-1 rounded-full bg-slate-100">
                            <div
                              className="h-1 rounded-full bg-slate-200"
                              style={{ width: `${pct}%` }}
                            />
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

  const projectionData = useMemo(() => {
    const currentNW = calcNetWorth(game)
    const monthlySavings = Math.max(0, calcMonthlyCashflow(game))

    // Taux annuel moyen pondéré par la valeur des investissements
    const totalVal = game.investments.reduce((s, inv) => s + inv.currentValue, 0)
    const avgRate = totalVal > 0
      ? game.investments.reduce((s, inv) => {
          const eff = inv.annualReturnRate + getInvestmentLevelBonus(inv.catalogId, inv.level ?? 1)
          return s + eff * inv.currentValue
        }, 0) / totalVal
      : 0.05

    function project(nw: number, annualRate: number, monthlyContrib: number, years: number): number {
      if (years === 0) return nw
      let val = nw
      const mr = Math.pow(1 + Math.max(0, annualRate), 1 / 12) - 1
      for (let m = 0; m < years * 12; m++) {
        val = val * (1 + mr) + monthlyContrib
      }
      return Math.round(val)
    }

    return [0, 3, 5, 10, 15, 20].map((y) => ({
      label: y === 0 ? 'Auj.' : `+${y}a`,
      base: project(currentNW, avgRate, monthlySavings, y),
      optimiste: project(currentNW, avgRate + 0.03, monthlySavings, y),
      prudent: project(currentNW, Math.max(0.01, avgRate - 0.03), monthlySavings, y),
    }))
  }, [game])

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

      {/* Projection long terme */}
      <Card className="p-5">
        <CardHeader
          title="Projection sur 20 ans"
          subtitle="Si tu continues à ce rythme (taux actuel ±3%)"
        />
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={projectionData} margin={{ left: -8, right: 8 }}>
            <defs>
              <linearGradient id="projBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1c84f5" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#1c84f5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatEuroCompact(v)} width={56} />
            <Tooltip
              formatter={(v, name) => [
                formatEuro(Number(v)),
                name === 'base' ? 'Scénario actuel' : name === 'optimiste' ? 'Optimiste (+3%)' : 'Prudent (−3%)',
              ]}
              contentStyle={tooltipStyle}
            />
            <ReferenceLine y={projectionData[0]?.base ?? 0} stroke="#94a3b8" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="prudent" name="prudent" stroke="#f97316" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
            <Line type="monotone" dataKey="base" name="base" stroke="#1c84f5" strokeWidth={2.5} dot={{ fill: '#1c84f5', r: 4 }} />
            <Line type="monotone" dataKey="optimiste" name="optimiste" stroke="#22c55e" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs justify-center">
          <span className="flex items-center gap-1 text-emerald-600"><span className="w-4 h-0.5 bg-emerald-500 inline-block" /> Optimiste</span>
          <span className="flex items-center gap-1 text-brand-600 font-semibold"><span className="w-4 h-0.5 bg-brand-500 inline-block" /> Actuel</span>
          <span className="flex items-center gap-1 text-orange-500"><span className="w-4 h-0.5 bg-orange-400 inline-block" /> Prudent</span>
        </div>
      </Card>

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

      {/* Moi vs Français moyen */}
      <FrenchBenchmarkCard game={game} />

      {/* Partager */}
      <Card className="p-5">
        <CardHeader title="Partager ta progression" subtitle="Montre à tes amis où tu en es" icon={<Share2 size={18} />} />
        <p className="text-sm text-slate-500 mb-3">Génère une carte de résumé à partager sur les réseaux.</p>
        <Button variant="primary" onClick={() => setShareOpen(true)}>
          <Share2 size={16} /> Partager ma progression
        </Button>
      </Card>

      {/* Export / Import */}
      <SaveBackupCard />

      {/* Notifications */}
      <NotificationToggleCard />

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

function SaveBackupCard() {
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function handleExport() {
    const raw = localStorage.getItem('jeu-invest-save-v1')
    if (!raw) { setMsg({ ok: false, text: 'Aucune sauvegarde trouvée.' }); return }
    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jeu-invest-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg({ ok: true, text: 'Sauvegarde exportée !' })
    setTimeout(() => setMsg(null), 3000)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const parsed = JSON.parse(text)
        if (!parsed?.player || !parsed?.investments) throw new Error('Format invalide')
        localStorage.setItem('jeu-invest-save-v1', text)
        setMsg({ ok: true, text: 'Sauvegarde importée ! Rechargement…' })
        setTimeout(() => window.location.reload(), 1200)
      } catch {
        setMsg({ ok: false, text: 'Fichier invalide ou corrompu.' })
      } finally {
        setImporting(false)
        e.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  return (
    <Card className="p-5">
      <CardHeader
        title="Sauvegarde & restauration"
        subtitle="Exporte ou importe ta progression"
        icon={<Download size={18} />}
      />
      <p className="text-sm text-slate-500 mb-4">
        Conserve une copie de ta partie sur ton appareil ou transfère-la vers un autre navigateur.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={handleExport}>
          <Download size={15} /> Exporter (.json)
        </Button>
        <label className={cn(
          'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm cursor-pointer transition-colors',
          importing ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
        )}>
          <Upload size={15} />
          {importing ? 'Importation…' : 'Importer un fichier'}
          <input type="file" accept=".json" className="hidden" onChange={handleImport} disabled={importing} />
        </label>
      </div>
      {msg && (
        <div className={cn(
          'mt-3 text-sm font-semibold px-3 py-2 rounded-xl',
          msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600',
        )}>
          {msg.text}
        </div>
      )}
    </Card>
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

function FrenchBenchmarkCard({ game }: { game: GameState }) {
  const netWorth = calcNetWorth(game)
  const passiveIncome = calcMonthlyPassiveIncome(game)
  const annualPassive = passiveIncome * 12
  const annualSalary = game.player.salary * 12
  const savingsRatePct = annualSalary > 0 ? Math.round((annualPassive / annualSalary) * 100) : 0
  const hasStocks = game.investments.some((i) => i.catalogId === 'bourse_etf')
  const hasProperty = game.investments.some((i) =>
    ['lmnp', 'immo_classique', 'parking'].includes(i.catalogId),
  )

  const rows = [
    {
      emoji: '🏛️',
      label: 'Patrimoine médian',
      yours: netWorth,
      ref: 177_200,
      format: (v: number) => formatEuroCompact(v),
    },
    {
      emoji: '🐷',
      label: 'Taux d\'épargne annuel',
      yours: savingsRatePct,
      ref: 17,
      format: (v: number) => `${v} %`,
    },
    {
      emoji: '📈',
      label: 'Investisseurs en bourse',
      yours: hasStocks ? 100 : 0,
      ref: 7,
      format: (v: number) => (v === 100 ? 'Oui ✓' : 'Non'),
    },
    {
      emoji: '🏡',
      label: 'Propriétaires bailleurs',
      yours: hasProperty ? 100 : 0,
      ref: 20,
      format: (v: number) => (v === 100 ? 'Oui ✓' : 'Non'),
    },
  ]

  return (
    <Card className="p-5">
      <CardHeader
        title="Moi vs Français moyen"
        subtitle="Données INSEE / Banque de France 2023"
        icon={<span className="text-lg">🇫🇷</span>}
      />
      <div className="mt-4 space-y-4">
        {rows.map((r) => {
          const ahead = r.yours > r.ref
          const barYours = r.label.includes('%') || r.label.includes('bourse') || r.label.includes('bailleur')
            ? Math.min(100, r.yours)
            : Math.min(100, (r.yours / Math.max(r.ref * 2, 1)) * 100)
          const barRef = r.label.includes('%') || r.label.includes('bourse') || r.label.includes('bailleur')
            ? Math.min(100, r.ref)
            : 50
          return (
            <div key={r.label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-500 font-medium">{r.emoji} {r.label}</span>
                <div className="flex gap-3 text-[11px]">
                  <span className="text-slate-400">Moy. {r.format(r.ref)}</span>
                  <span className={cn('font-bold', ahead ? 'text-emerald-600' : 'text-orange-500')}>
                    Toi : {r.format(r.yours)} {ahead ? '▲' : '▼'}
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden relative">
                <div className="h-2 rounded-full bg-slate-300 absolute" style={{ width: `${barRef}%` }} />
                <div
                  className={cn('h-2 rounded-full absolute', ahead ? 'bg-emerald-500' : 'bg-orange-400')}
                  style={{ width: `${barYours}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function NotificationToggleCard() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  )

  const handleRequest = async () => {
    const { requestNotificationPermission } = await import('../../utils/notifications')
    const granted = await requestNotificationPermission()
    setPermission(granted ? 'granted' : 'denied')
  }

  return (
    <Card className="p-5">
      <CardHeader
        title="Rappels hors connexion"
        subtitle="Reçois une notification quand tes investissements ont bien travaillé"
        icon={<span className="text-lg">🔔</span>}
      />
      <div className="mt-3">
        {permission === 'granted' ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 font-semibold">
            <span>✓</span> Notifications activées — tu seras alerté après 8h d\'absence
          </div>
        ) : permission === 'denied' ? (
          <div className="text-sm text-slate-400">
            Notifications bloquées dans les réglages du navigateur. Active-les manuellement dans les paramètres du site.
          </div>
        ) : (
          <Button variant="secondary" onClick={handleRequest}>
            🔔 Activer les rappels
          </Button>
        )}
      </div>
    </Card>
  )
}

