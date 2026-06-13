import { useState } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from 'recharts'
import { Lock, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { getCatalogItem } from '../../data/investments'
import type { Investment } from '../../types'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Badge } from '../ui/Badge'
import { Icon } from '../ui/Icon'
import {
  formatEuro,
  formatEuroCompact,
  formatGameDate,
  formatPercent,
  cn,
} from '../../utils/formatting'

export function Portfolio() {
  const game = useGameStore((s) => s.game)!
  const setScreen = useGameStore((s) => s.setScreen)
  const [sellTarget, setSellTarget] = useState<Investment | null>(null)

  if (game.investments.length === 0) {
    return (
      <div className="animate-fade-in">
        <Card className="p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center mx-auto mb-4">
            <Wallet size={32} />
          </div>
          <h3 className="font-display font-bold text-slate-800 text-lg mb-1">
            Ton portefeuille est vide
          </h3>
          <p className="text-sm text-slate-500 mb-5 max-w-sm mx-auto">
            Commence à faire fructifier ton argent ! Le Livret A est disponible dès le départ.
          </p>
          <Button onClick={() => setScreen('marketplace')}>Découvrir les placements</Button>
        </Card>
      </div>
    )
  }

  const totalValue = game.investments.reduce((s, i) => s + i.currentValue, 0)
  const totalInvested = game.investments.reduce((s, i) => s + i.totalInvested, 0)
  const totalGain = totalValue - totalInvested
  const totalIncome = game.investments.reduce((s, i) => s + i.monthlyIncome, 0)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Résumé */}
      <Card className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryStat label="Valeur totale" value={formatEuro(totalValue)} />
          <SummaryStat label="Capital investi" value={formatEuro(totalInvested)} />
          <SummaryStat
            label="Plus/moins-value"
            value={`${totalGain >= 0 ? '+' : ''}${formatEuroCompact(totalGain)}`}
            tone={totalGain >= 0 ? 'up' : 'down'}
          />
          <SummaryStat
            label="Revenus / mois"
            value={formatEuro(totalIncome)}
            tone="up"
          />
        </div>
      </Card>

      {/* Liste */}
      <div className="space-y-2.5">
        {game.investments.map((inv) => (
          <InvestmentRow
            key={inv.instanceId}
            inv={inv}
            onSell={() => setSellTarget(inv)}
          />
        ))}
      </div>

      {sellTarget && (
        <SellModal inv={sellTarget} onClose={() => setSellTarget(null)} />
      )}
    </div>
  )
}

function InvestmentRow({ inv, onSell }: { inv: Investment; onSell: () => void }) {
  const item = getCatalogItem(inv.catalogId)
  const gain = inv.currentValue - inv.totalInvested
  const gainPct = inv.totalInvested > 0 ? gain / inv.totalInvested : 0
  const positive = gain >= 0

  const sparkData = inv.valueHistory.map((v, i) => ({ i, v }))

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        {/* Icône */}
        <div
          className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shrink-0', item.gradient)}
        >
          <Icon name={item.icon} size={20} />
        </div>

        {/* Infos */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-slate-800 truncate">
              {inv.name}
            </span>
            {inv.isLocked && (
              <Badge tone="warning">
                <Lock size={10} /> Bloqué
              </Badge>
            )}
            {inv.mortgageId && <Badge tone="brand">Crédit</Badge>}
          </div>
          <div className="text-xs text-slate-400">
            {item.shortName} · depuis {formatGameDate(inv.purchaseDateISO)}
          </div>
        </div>

        {/* Sparkline */}
        {sparkData.length > 2 && (
          <div className="hidden sm:block w-20 h-10 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <defs>
                  <linearGradient id={`spark-${inv.instanceId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={positive ? '#16a34a' : '#dc2626'} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={positive ? '#16a34a' : '#dc2626'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={positive ? '#16a34a' : '#dc2626'}
                  strokeWidth={1.5}
                  fill={`url(#spark-${inv.instanceId})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Valeur */}
        <div className="text-right shrink-0">
          <div className="font-display font-bold text-slate-800">
            {formatEuroCompact(inv.currentValue)}
          </div>
          <div
            className={cn(
              'text-xs font-semibold flex items-center gap-0.5 justify-end',
              positive ? 'text-emerald-600' : 'text-red-500',
            )}
          >
            {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {formatPercent(gainPct, true)}
          </div>
        </div>

        {/* Action */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSell}
          className="shrink-0"
          disabled={inv.isLocked}
        >
          Vendre
        </Button>
      </div>

      {/* Revenu mensuel */}
      {inv.monthlyIncome !== 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-400">Revenu mensuel net</span>
          <span className={cn('font-semibold', inv.monthlyIncome >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {inv.monthlyIncome >= 0 ? '+' : ''}
            {formatEuro(inv.monthlyIncome)}
          </span>
        </div>
      )}
    </Card>
  )
}

function SellModal({ inv, onClose }: { inv: Investment; onClose: () => void }) {
  const sellInvestment = useGameStore((s) => s.sellInvestment)
  const game = useGameStore((s) => s.game)!
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const mortgage = inv.mortgageId
    ? game.mortgages.find((m) => m.id === inv.mortgageId)
    : null
  const debt = mortgage?.outstandingBalance ?? 0

  function handleSell() {
    const res = sellInvestment(inv.instanceId)
    setResult(res)
    if (res.success) setTimeout(onClose, 1400)
  }

  return (
    <Modal open onClose={onClose} title={`Vendre — ${inv.name}`} size="sm">
      {result?.success ? (
        <div className="py-6 text-center animate-pop-in">
          <p className="font-display font-bold text-emerald-600">{result.message}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Valeur actuelle</span>
              <span className="font-semibold">{formatEuro(inv.currentValue)}</span>
            </div>
            {debt > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Crédit à rembourser</span>
                <span className="font-semibold text-red-500">-{formatEuro(debt)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 border-t border-slate-200">
              <span className="text-slate-600 font-semibold">Tu récupères ~</span>
              <span className="font-display font-bold text-emerald-600">
                {formatEuro(Math.max(0, inv.currentValue - debt))}
              </span>
            </div>
            <p className="text-xs text-slate-400 pt-1">
              (Hors impôt éventuel sur la plus-value, calculé à la vente)
            </p>
          </div>

          {result && !result.success && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">
              {result.message}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={onClose}>
              Annuler
            </Button>
            <Button variant="danger" fullWidth onClick={handleSell}>
              Confirmer la vente
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'up' | 'down'
}) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div
        className={cn(
          'font-display font-bold text-lg',
          tone === 'up' && 'text-emerald-600',
          tone === 'down' && 'text-red-500',
          !tone && 'text-slate-800',
        )}
      >
        {value}
      </div>
    </div>
  )
}
