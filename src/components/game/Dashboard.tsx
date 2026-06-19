import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Cell,
  Legend,
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
  Flame,
  TrendingUp,
} from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import {
  calcAssetBreakdown,
  calcDebtRatio,
  calcMonthlyCashflow,
  calcMonthlyPassiveIncome,
  calcNetWorth,
  totalMortgagePayments,
  MILESTONE_INFO,
} from '../../utils/calculations'
import { PHASE_LABEL } from '../../engine/economy'
import type { Screen } from '../../types'
import { SKILLS, SKILL_BY_ID } from '../../data/skills'
import { CATALOG_BY_ID, INVESTMENT_CATALOG } from '../../data/investments'
import { Card, CardHeader } from '../ui/Card'
import { ProgressBar } from '../ui/ProgressBar'
import { NumberTicker } from '../ui/NumberTicker'
import { OnboardingGuide } from '../ui/OnboardingGuide'
import { GigsCard } from './GigsCard'
import { LifeGoalCard, BehaviorMirrorCard } from './StrategyCards'
import { FlashOpportunityCard } from './FlashOpportunityCard'
import { Icon } from '../ui/Icon'
import {
  formatEuro,
  formatEuroCompact,
  formatEuroSigned,
  formatMonthShort,
  cn,
} from '../../utils/formatting'
import type { AssetBreakdown, GameState } from '../../types'

const ALLOCATION_LABELS: Record<keyof AssetBreakdown, { label: string; color: string }> = {
  cash: { label: 'Liquidités', color: '#10b981' },
  livret: { label: 'Livret A', color: '#38bdf8' },
  assurance_vie: { label: 'Assurance Vie', color: '#22c55e' },
  obligations_etat: { label: 'Obligations', color: '#3b82f6' },
  bourse_etf: { label: 'Bourse', color: '#6366f1' },
  or_metaux: { label: 'Or / Métaux', color: '#eab308' },
  crowdfunding_immo: { label: 'Crowdfunding', color: '#f97316' },
  scpi: { label: 'SCPI', color: '#14b8a6' },
  produit_structure: { label: 'Structuré', color: '#7c3aed' },
  business: { label: 'Business', color: '#a855f7' },
  parking: { label: 'Parking', color: '#64748b' },
  lmnp: { label: 'LMNP', color: '#ec4899' },
  crypto: { label: 'Crypto', color: '#f97316' },
  immo_classique: { label: 'Locatif', color: '#eab308' },
  club_deal_immo: { label: 'Club Deal', color: '#6366f1' },
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
        cash: s.cash ?? 0,
        locked: s.lockedValue ?? 0,
        unlocked: s.unlockedValue ?? 0,
        netWorth: s.netWorth,
      })),
    [game.stats],
  )

  return (
    <div className="space-y-4 animate-screen-in">
      {/* Guide d'onboarding */}
      <OnboardingGuide />

      {/* Hero stats */}
      {(() => {
        const lastSnap = game.stats.length >= 2 ? game.stats[game.stats.length - 2] : null
        const nwDelta = lastSnap ? Math.round(netWorth - lastSnap.netWorth) : 0
        const cashDelta = lastSnap ? Math.round(game.cashBalance - lastSnap.cash) : 0
        const passiveDelta = lastSnap ? Math.round(passiveIncome - (lastSnap.passiveIncome ?? 0)) : 0
        const isPaused = game.isPaused
        const moisCharges = Math.floor(game.cashBalance / Math.max(1, game.monthlyExpenses.total))

        function Delta({ val }: { val: number }) {
          if (Math.abs(val) < 1) return null
          const up = val > 0
          return (
            <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-bold mt-1', up ? 'text-white/90' : 'text-white/60')}>
              {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {formatEuroCompact(Math.abs(val))}
            </span>
          )
        }

        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 stagger">
            {/* Patrimoine net — pleine largeur sur mobile */}
            <div className="col-span-2 sm:col-span-1 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white p-4 relative overflow-hidden">
              <div className="absolute top-3 right-3 flex items-center gap-1">
                <span className={cn('w-2 h-2 rounded-full bg-white', isPaused ? 'opacity-25' : 'animate-live-pulse')} />
              </div>
              <div className="text-xs text-white/70 font-medium mb-1">Patrimoine net</div>
              <NumberTicker value={netWorth} format={formatEuroCompact} className="font-display font-extrabold text-2xl sm:text-xl lg:text-2xl" />
              <Delta val={nwDelta} />
            </div>

            {/* Cash */}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4">
              <div className="text-xs text-white/70 font-medium mb-1">Cash</div>
              <NumberTicker value={game.cashBalance} format={formatEuroCompact} className="font-display font-extrabold text-xl" />
              <div className="text-[11px] text-white/60 mt-0.5">
                {moisCharges} mois de charges
              </div>
              <Delta val={cashDelta} />
            </div>

            {/* Revenus passifs */}
            <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 text-white p-4">
              <div className="text-xs text-white/70 font-medium mb-1">Rev. passifs</div>
              <NumberTicker value={passiveIncome} format={formatEuroCompact} className="font-display font-extrabold text-xl" />
              <div className="text-[11px] text-white/60 mt-0.5">
                {passiveIncome > 0 ? `${Math.round((passiveIncome / game.player.salary) * 100)} % salaire` : `Salaire ${formatEuroCompact(game.player.salary)}`}
              </div>
              <Delta val={passiveDelta} />
            </div>
          </div>
        )
      })()}

      {/* Streak quotidien — affiché dès le 1er jour */}
      {game.streak && (
        <div className="flex items-center gap-2 px-1">
          <div className={cn(
            'flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full',
            game.streak.currentStreak >= 30 ? 'bg-purple-100 text-purple-700' :
            game.streak.currentStreak >= 7  ? 'bg-amber-100 text-amber-700' :
            game.streak.currentStreak >= 2  ? 'bg-orange-50 text-orange-600' :
                                              'bg-slate-100 text-slate-500',
          )}>
            <Flame size={13} />
            <span>
              {game.streak.currentStreak >= 2
                ? `${game.streak.currentStreak} jours`
                : 'Jour 1 — reviens demain !'}
            </span>
          </div>
          {game.streak.streakBonusActiveUntilReal && game.streak.streakBonusActiveUntilReal > Date.now() && (
            <div className="text-xs text-emerald-600 font-semibold">+5% rendement actif 🎯</div>
          )}
          {game.streak.longestStreak > 1 && game.streak.longestStreak > game.streak.currentStreak && (
            <div className="text-xs text-slate-400">Record : {game.streak.longestStreak}j</div>
          )}
        </div>
      )}

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
          shimmer
          barClassName="bg-gradient-to-r from-gold-400 to-gold-600"
        />
      </Card>

      {/* Objectif de vie */}
      <LifeGoalCard game={game} />

      {/* Opportunité flash — priorité max sur le dashboard */}
      <FlashOpportunityCard />

      {/* Copilote patrimonial */}
      <CopiloteCard game={game} netWorth={netWorth} passiveIncome={passiveIncome} cashflow={cashflow} setScreen={setScreen} />

      {/* Miroir comportemental */}
      <BehaviorMirrorCard game={game} />

      {/* Missions express — petit revenu d'appoint */}
      <GigsCard />

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
                  <linearGradient id="gradCash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="gradUnlocked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1c84f5" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#1c84f5" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="gradLocked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={30} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatEuroCompact(v)} width={56} />
                <Tooltip formatter={(v) => [formatEuro(Number(v)), '']} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="locked" name="Bloqués" stackId="1" stroke="#a855f7" fill="url(#gradLocked)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="unlocked" name="Disponibles" stackId="1" stroke="#1c84f5" fill="url(#gradUnlocked)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="cash" name="Cash" stackId="1" stroke="#10b981" fill="url(#gradCash)" strokeWidth={1.5} />
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
        {/* Détail revenus passifs */}
        {game.investments.filter(i => i.monthlyIncome !== 0).length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Détail revenus passifs</div>
            <div className="space-y-1">
              {game.investments.filter(i => i.monthlyIncome !== 0).map(inv => {
                return (
                  <div key={inv.instanceId} className="flex items-center justify-between text-xs px-1">
                    <span className="text-slate-500 truncate flex-1 mr-2">{inv.name}</span>
                    <span className={cn('font-semibold shrink-0', inv.monthlyIncome >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                      {inv.monthlyIncome >= 0 ? '+' : ''}{formatEuro(inv.monthlyIncome)}/mois
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
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

interface Rec {
  level: 'urgent' | 'action' | 'info'
  icon: string
  text: string
  ctaLabel?: string
  ctaScreen?: Screen
}

function CopiloteCard({
  game,
  netWorth,
  passiveIncome,
  cashflow,
  setScreen,
}: {
  game: GameState
  netWorth: number
  passiveIncome: number
  cashflow: number
  setScreen: (s: Screen) => void
}) {
  const { marketPhase, phaseMonthsElapsed } = game.economy
  const phaseInfo = PHASE_LABEL[marketPhase]

  const recs = useMemo((): Rec[] => {
    const result: Rec[] = []
    const learned = game.player.learnedSkillIds || []
    const hasETF = game.investments.some((i) => i.catalogId === 'bourse_etf')
    const hasLivret = game.investments.some((i) => i.catalogId === 'livret')
    const knowsInvesting = learned.includes('investissement_101')
    const knowsMarket = learned.includes('lecture_marche')
    const debtRatio = calcDebtRatio(game)

    // ── URGENT ──────────────────────────────────────────────────────────────
    if (cashflow < -300) {
      result.push({
        level: 'urgent', icon: '🚨',
        text: `Cashflow ${formatEuroSigned(Math.round(cashflow))}/mois — tes sorties dépassent tes rentrées. Vends un actif ou réduis les charges.`,
        ctaLabel: 'Portefeuille →', ctaScreen: 'portfolio',
      })
    }
    if (game.cashBalance < game.monthlyExpenses.total * 2 && game.investments.length > 0) {
      result.push({
        level: 'urgent', icon: '⚠️',
        text: `Moins de 2 mois de charges en cash (${formatEuroCompact(game.cashBalance)}). Garde une réserve avant d'investir davantage.`,
      })
    }
    if (debtRatio > 0.35) {
      result.push({
        level: 'urgent', icon: '🏦',
        text: `Taux d'endettement ${Math.round(debtRatio * 100)} % (limite bancaire : 35 %). Risque de refus pour un nouveau crédit.`,
        ctaLabel: 'Mes biens →', ctaScreen: 'properties',
      })
    }

    // ── ACTION ──────────────────────────────────────────────────────────────
    // Cash idle élevé
    const idleRatio = netWorth > 0 ? game.cashBalance / netWorth : 0
    if (idleRatio > 0.40 && game.cashBalance > 2000 && game.investments.length > 0) {
      result.push({
        level: 'action', icon: '💤',
        text: `${Math.round(idleRatio * 100)} % de ton patrimoine dort en cash (${formatEuroCompact(game.cashBalance)}). L'inflation le grignote à ~2 %/an.`,
        ctaLabel: 'Investir →', ctaScreen: 'marketplace',
      })
    }
    // Opportunité de krach — seulement si ETF est accessible (compétence + mise min)
    const etfItem = CATALOG_BY_ID['bourse_etf']
    const canAccessETF = knowsInvesting && game.cashBalance >= etfItem.minAmount
    if (marketPhase === 'crash' && canAccessETF) {
      result.push({
        level: 'action', icon: '💎',
        text: 'Krach en cours — les ETF sont en soldes. Renforcer progressivement (DCA) est la stratégie des investisseurs qui s\'enrichissent sur les crises.',
        ctaLabel: 'Marketplace →', ctaScreen: 'marketplace',
      })
    }
    // Marché bear : hold
    if (marketPhase === 'bear' && hasETF) {
      result.push({
        level: 'action', icon: '🔥',
        text: 'Marché baissier — ne vends pas tes ETF en panique. Historiquement, les marchés se redressent. Tiens la position.',
      })
    }
    // Bull + ETF dispo — seulement si le joueur peut réellement acheter des ETF
    if (marketPhase === 'bull' && canAccessETF && !hasETF) {
      result.push({
        level: 'action', icon: '📈',
        text: `Marché haussier${knowsMarket ? ` depuis ${phaseMonthsElapsed} mois` : ''} — bon moment pour ouvrir une position ETF à rendement élevé.`,
        ctaLabel: 'Investir →', ctaScreen: 'marketplace',
      })
    }
    // Assurance vie > 7 ans
    const avInv = game.investments.find((i) => i.catalogId === 'assurance_vie')
    if (avInv) {
      const yearsHeld = (new Date(game.gameDateISO).getTime() - new Date(avInv.purchaseDateISO).getTime()) / (365.25 * 86400000)
      if (yearsHeld >= 7 && yearsHeld < 8) {
        result.push({
          level: 'action', icon: '⏰',
          text: `Assurance Vie à ${Math.floor(yearsHeld)} ans (il en faut 8). Attends encore ${Math.ceil((8 - yearsHeld) * 12)} mois : abattement fiscal de 4 600 € à la clé.`,
        })
      }
    }
    // Levier immobilier — seulement si au moins un bien mortgageable est réellement débloqué
    if (debtRatio < 0.05) {
      const unlockedMortgageable = INVESTMENT_CATALOG.filter(
        (item) =>
          item.canUseMortgage &&
          item.isRealEstate &&
          netWorth >= item.unlockThreshold &&
          (!item.skillRequired || learned.includes(item.skillRequired)),
      )
      if (unlockedMortgageable.length > 0) {
        const topItem = unlockedMortgageable[unlockedMortgageable.length - 1]
        result.push({
          level: 'action', icon: '🏗️',
          text: `Taux d'endettement quasi nul — tu peux emprunter pour acheter un ${topItem.shortName} et démultiplier ton rendement avec l'effet de levier.`,
          ctaLabel: 'Chercher →', ctaScreen: 'marketplace',
        })
      }
    }

    // ── INFO ────────────────────────────────────────────────────────────────
    // Premier pas
    if (game.investments.length === 0 && game.cashBalance >= 10) {
      result.push({
        level: 'info', icon: '💡',
        text: 'Commence par le Livret A — sans risque, pas de minimum. Même 100 € génèrent 1,5 %/an.',
        ctaLabel: 'Investir →', ctaScreen: 'marketplace',
      })
    }
    // Déblocage ETF
    if (hasLivret && !hasETF && knowsInvesting && netWorth >= 1000) {
      result.push({
        level: 'info', icon: '📈',
        text: 'Tu peux maintenant investir en ETF (débloqué). Rendement historique ~8 %/an vs 1,5 % pour le Livret A.',
        ctaLabel: 'Voir →', ctaScreen: 'marketplace',
      })
    }
    // Formation suggérée
    if (hasLivret && !knowsInvesting && !game.player.activeTraining) {
      result.push({
        level: 'info', icon: '🎓',
        text: 'Pour accéder à la bourse et à l\'assurance vie, forme-toi d\'abord avec "Investissement 101".',
        ctaLabel: 'Carrière →', ctaScreen: 'skills',
      })
    }
    // Livret A saturé
    const livretVal = game.investments.filter((i) => i.catalogId === 'livret').reduce((s, i) => s + i.currentValue, 0)
    if (livretVal >= 22000) {
      result.push({
        level: 'info', icon: '🏦',
        text: `Livret A presque saturé (${formatEuroCompact(livretVal)} / 22 950 € max). Redirige les versements vers l'assurance vie ou un ETF.`,
        ctaLabel: 'Marketplace →', ctaScreen: 'marketplace',
      })
    }
    // Revenus passifs vs salaire
    if (passiveIncome > 0 && passiveIncome < game.player.salary) {
      const ratio = Math.round((passiveIncome / game.player.salary) * 100)
      result.push({
        level: 'info', icon: '📊',
        text: `Revenus passifs : ${formatEuroCompact(passiveIncome)}/mois (${ratio} % de ton salaire). Objectif : 100 % pour devenir rentier.`,
      })
    }
    // Prochain investissement bientôt débloqué (dans les 20% restants)
    const nearUnlock = INVESTMENT_CATALOG.find((item) => {
      if (item.unlockThreshold <= 0) return false
      if (netWorth >= item.unlockThreshold) return false
      return netWorth / item.unlockThreshold >= 0.80
    })
    if (nearUnlock) {
      const missing = Math.ceil(nearUnlock.unlockThreshold - netWorth)
      result.push({
        level: 'info', icon: '🔓',
        text: `Plus que ${formatEuroCompact(missing)} pour débloquer ${nearUnlock.name} ! Encore un effort.`,
        ctaLabel: 'Marketplace →', ctaScreen: 'marketplace',
      })
    }
    // Signal marché si compétence acquise
    if (knowsMarket && (marketPhase === 'neutral' || marketPhase === 'bear')) {
      const msg = marketPhase === 'neutral'
        ? 'Phase neutre depuis ' + phaseMonthsElapsed + ' mois — idéal pour investir progressivement (DCA). SCPI et crowdfunding peu sensibles aux cycles.'
        : `Phase baissière depuis ${phaseMonthsElapsed} mois. Probabilité de transition vers "neutre" : 20 %/mois. Actifs défensifs conseillés (Livret, SCPI).`
      result.push({ level: 'info', icon: '🎯', text: msg })
    }
    // Formation en cours
    if (game.player.activeTraining) {
      const skill = SKILL_BY_ID[game.player.activeTraining.skillId]
      if (skill) {
        const monthsDone = game.player.activeTraining.monthsCompleted ?? 0
        const totalMonths = skill.trainingMonths
        if (totalMonths > 0) {
          const pct = Math.round(Math.min(100, (monthsDone / totalMonths) * 100))
          const monthsLeft = Math.max(0, totalMonths - monthsDone)
          result.push({
            level: 'info', icon: '🎓',
            text: `"${skill.name}" en cours — ${pct} % (encore ${monthsLeft} mois de jeu). Effet : ${skill.benefits[0]}.`,
            ctaLabel: 'Carrière →', ctaScreen: 'skills',
          })
        } else {
          result.push({
            level: 'info', icon: '🎓',
            text: `"${skill.name}" terminée — ${skill.benefits[0]}.`,
            ctaLabel: 'Carrière →', ctaScreen: 'skills',
          })
        }
      }
    } else {
      const next = SKILLS.find((s) => {
        if (learned.includes(s.id)) return false
        const prereqsMet = s.prerequisiteIds.every((p) => learned.includes(p))
        const wealthMet = !s.minNetWorth || netWorth >= s.minNetWorth
        return prereqsMet && wealthMet
      })
      if (next) {
        const durationLabel = next.trainingMonths > 0 ? `${next.trainingMonths} mois de jeu` : 'instantané'
        result.push({
          level: 'info', icon: '📚',
          text: `Formation disponible : "${next.name}" (${durationLabel}) → ${next.benefits[0]}`,
          ctaLabel: 'Commencer →', ctaScreen: 'skills',
        })
      }
    }

    const order = { urgent: 0, action: 1, info: 2 }
    return result.sort((a, b) => order[a.level] - order[b.level]).slice(0, 3)
  }, [game, netWorth, passiveIncome, cashflow, marketPhase, phaseMonthsElapsed])

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center justify-between gap-2">
          <CardHeader title="Copilote" subtitle="Analyse en temps réel" icon={<span>🧭</span>} />
          <div
            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg shrink-0 whitespace-nowrap"
            style={{ backgroundColor: `${phaseInfo.color}18`, color: phaseInfo.color }}
          >
            {phaseInfo.emoji}
            <span className="hidden sm:inline"> {phaseInfo.label}</span>
            <span className="sm:hidden"> {phaseInfo.label.split(' ')[1] ?? phaseInfo.label}</span>
            {game.player.learnedSkillIds.includes('lecture_marche') && (
              <span className="opacity-60 hidden sm:inline">· {phaseMonthsElapsed} m</span>
            )}
          </div>
        </div>
      </div>
      {recs.length === 0 ? (
        <p className="text-sm text-slate-400 px-1">Tout semble en ordre. Continue à investir régulièrement !</p>
      ) : (
        <div className="space-y-2">
          {recs.map((rec, i) => (
            <div
              key={i}
              className={cn(
                'flex items-start gap-3 rounded-xl px-4 py-3 text-sm',
                rec.level === 'urgent' ? 'bg-red-50 border border-red-100' :
                rec.level === 'action' ? 'bg-amber-50 border border-amber-100' :
                'bg-slate-50',
              )}
            >
              <span className="text-base shrink-0 mt-0.5">{rec.icon}</span>
              <p className={cn(
                'flex-1 leading-relaxed',
                rec.level === 'urgent' ? 'text-red-700' :
                rec.level === 'action' ? 'text-amber-800' :
                'text-slate-600',
              )}>{rec.text}</p>
              {rec.ctaLabel && rec.ctaScreen && (
                <button
                  onClick={() => setScreen(rec.ctaScreen as Screen)}
                  className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 whitespace-nowrap self-center"
                >
                  {rec.ctaLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
