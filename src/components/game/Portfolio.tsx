import { useState } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from 'recharts'
import { Lock, PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { getCatalogItem } from '../../data/investments'
import type { Investment } from '../../types'
import { getAVFiscalDetails } from '../../engine/fiscal'
import type { AVFiscalDetails } from '../../engine/fiscal'
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
        {game.investments.map((inv) =>
          inv.catalogId === 'livret' ? (
            <LivretACard key={inv.instanceId} inv={inv} onSell={() => setSellTarget(inv)} />
          ) : (
            <InvestmentRow key={inv.instanceId} inv={inv} onSell={() => setSellTarget(inv)} />
          )
        )}
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

      {/* Revenu / rendement annuel estimé */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs gap-4">
        {inv.monthlyIncome !== 0 ? (
          <>
            <span className="text-slate-400">Revenu mensuel net</span>
            <span className={cn('font-semibold', inv.monthlyIncome >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {inv.monthlyIncome >= 0 ? '+' : ''}
              {formatEuro(inv.monthlyIncome)}
            </span>
          </>
        ) : (
          <>
            <span className="text-slate-400">Rendement annuel estimé</span>
            <span className="font-semibold text-emerald-600">
              ~+{formatEuro(Math.round(inv.currentValue * inv.annualReturnRate))} / an
            </span>
          </>
        )}
      </div>
    </Card>
  )
}

function LivretACard({ inv, onSell }: { inv: Investment; onSell: () => void }) {
  const annualYield = Math.round(inv.currentValue * 0.015)
  const monthlyYield = Math.round(annualYield / 12)

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-sky-100">
      {/* Bandeau carte bancaire */}
      <div className="bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 p-5 text-white relative overflow-hidden">
        {/* Fond décoratif */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-20 translate-x-20" />
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-12 -translate-x-12" />

        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <PiggyBank size={18} />
              </div>
              <span className="font-bold text-sm uppercase tracking-widest">Livret A</span>
            </div>
            <span className="bg-white/20 text-xs font-bold px-2.5 py-1 rounded-full tracking-wide">
              1,50% / an
            </span>
          </div>

          <div className="mb-1">
            <div className="text-sky-200 text-xs font-semibold uppercase tracking-wide mb-0.5">
              Solde disponible
            </div>
            <div className="font-display font-extrabold text-3xl tracking-tight">
              {formatEuro(inv.currentValue)}
            </div>
          </div>

          <div className="text-sky-200 text-xs mt-1">
            Depuis le {formatGameDate(inv.purchaseDateISO)} · Exonéré d'impôt
          </div>
        </div>
      </div>

      {/* Section rendement */}
      <div className="bg-sky-50 border-t border-sky-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sky-700 text-xs font-bold uppercase tracking-wide mb-0.5">
              Rendement annuel estimé
            </div>
            <div className="font-display font-extrabold text-xl text-sky-700">
              +{formatEuro(annualYield)} / an
            </div>
            <div className="text-sky-500 text-xs mt-0.5">
              soit +{formatEuro(monthlyYield)} / mois · {formatEuro(inv.currentValue)} × 1,5%
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSell}
            className="text-slate-500 shrink-0"
          >
            Retirer
          </Button>
        </div>
      </div>
    </div>
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
  const item = getCatalogItem(inv.catalogId)
  const gain = Math.max(0, inv.currentValue - inv.totalInvested)

  // Fiscal details
  let taxAmount = 0
  let avDetails: AVFiscalDetails | null = null
  if (inv.catalogId === 'assurance_vie') {
    avDetails = getAVFiscalDetails(inv, game.gameDateISO)
    taxAmount = avDetails.tax
  } else if (item.taxRegime !== 'exonere') {
    if (item.isRealEstate) {
      taxAmount = gain * 0.3 * 0.5
    } else {
      taxAmount = gain * 0.3
    }
  }

  const proceeds = Math.max(0, inv.currentValue - debt - taxAmount)

  function handleSell() {
    const res = sellInvestment(inv.instanceId)
    setResult(res)
    if (res.success) setTimeout(onClose, 1400)
  }

  return (
    <Modal open onClose={onClose} title={`Vendre — ${inv.name}`} size="md">
      {result?.success ? (
        <div className="py-6 text-center animate-pop-in">
          <p className="font-display font-bold text-emerald-600">{result.message}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Résumé de la vente */}
          <div className="rounded-2xl bg-slate-50 p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Valeur actuelle</span>
              <span className="font-semibold">{formatEuro(inv.currentValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Capital investi</span>
              <span className="font-semibold">{formatEuro(inv.totalInvested)}</span>
            </div>
            <div className="flex justify-between">
              <span className={gain >= 0 ? 'text-emerald-600' : 'text-red-500'}>Plus-value</span>
              <span className={`font-semibold ${gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {gain >= 0 ? '+' : ''}{formatEuro(gain)}
              </span>
            </div>
            {debt > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Crédit restant</span>
                <span className="font-semibold text-red-500">-{formatEuro(debt)}</span>
              </div>
            )}
          </div>

          {/* Fiscalité */}
          {inv.catalogId === 'assurance_vie' && avDetails ? (
            <div className={`rounded-2xl p-4 text-sm space-y-2 ${avDetails.isFavorable ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
              <div className="font-semibold text-slate-700 mb-2">
                {avDetails.isFavorable ? '✅' : '⏳'} Fiscalité Assurance Vie
              </div>
              <div className="text-xs text-slate-500 mb-2">{avDetails.regime}</div>
              <div className="flex justify-between">
                <span className="text-slate-500">Détenue depuis</span>
                <span className="font-semibold">{avDetails.yearsHeld} ans {avDetails.monthsHeld % 12} mois</span>
              </div>
              {!avDetails.isFavorable && (
                <div className="flex justify-between text-amber-700">
                  <span>Avantage fiscal dans</span>
                  <span className="font-semibold">{avDetails.yearsToFavorable.toFixed(1)} ans</span>
                </div>
              )}
              {avDetails.allowance > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Abattement</span>
                  <span className="font-semibold text-emerald-600">-{formatEuro(avDetails.allowance)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Base imposable</span>
                <span className="font-semibold">{formatEuro(avDetails.taxableGain)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-600">Impôt estimé ({Math.round(avDetails.taxRate * 100)}%)</span>
                <span className="font-bold text-red-500">-{formatEuro(avDetails.tax)}</span>
              </div>
              {!avDetails.isFavorable && gain > 0 && (
                <p className="text-xs text-amber-700 mt-2 font-medium">
                  💡 Attendre {avDetails.yearsToFavorable.toFixed(1)} ans économiserait environ {formatEuro(avDetails.tax - Math.max(0, gain - avDetails.allowance) * avDetails.taxRate * 0.8)} d'impôts.
                </p>
              )}
            </div>
          ) : taxAmount > 0 ? (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-2">
              <div className="font-semibold text-slate-700 mb-1">Fiscalité</div>
              <div className="text-xs text-slate-500 mb-2">
                {item.taxRegime === 'exonere' ? 'Exonéré' :
                 item.isRealEstate ? 'Plus-value immobilière (taux réduit après abattement)' :
                 'PFU 30% (Flat Tax)'}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Plus-value imposable</span>
                <span className="font-semibold">{formatEuro(gain)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-600">Impôt estimé</span>
                <span className="font-bold text-red-500">-{formatEuro(taxAmount)}</span>
              </div>
            </div>
          ) : item.taxRegime === 'exonere' ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700 font-semibold">
              ✅ Exonéré d'impôt (Livret A)
            </div>
          ) : null}

          {/* Net à récupérer */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 p-4">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-slate-700">Tu récupères</span>
              <span className="font-display font-extrabold text-2xl text-emerald-600">
                {formatEuro(proceeds)}
              </span>
            </div>
          </div>

          {result && !result.success && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">
              {result.message}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={onClose}>Annuler</Button>
            <Button variant="danger" fullWidth onClick={handleSell}>Confirmer la vente</Button>
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
