import { Building2, MapPin, TrendingUp, TrendingDown } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { getCatalogItem } from '../../data/investments'
import type { Investment } from '../../types'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Icon } from '../ui/Icon'
import {
  formatEuro,
  formatEuroCompact,
  formatPercent,
  cn,
} from '../../utils/formatting'

export function Properties() {
  const game = useGameStore((s) => s.game)!
  const setScreen = useGameStore((s) => s.setScreen)

  const properties = game.investments.filter((i) => i.propertyDetails)
  const businesses = game.investments.filter((i) => i.businessDetails)

  if (properties.length === 0 && businesses.length === 0) {
    return (
      <div className="animate-fade-in">
        <Card className="p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
            <Building2 size={32} />
          </div>
          <h3 className="font-display font-bold text-slate-800 text-lg mb-1">
            Aucun bien pour l'instant
          </h3>
          <p className="text-sm text-slate-500 mb-5 max-w-sm mx-auto">
            L'immobilier locatif et les business automatisés apparaîtront ici.
            Débloque-les en augmentant ton patrimoine.
          </p>
          <Button onClick={() => setScreen('marketplace')}>Voir les placements</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {properties.length > 0 && (
        <div>
          <h2 className="font-display font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Building2 size={18} /> Biens immobiliers
          </h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {properties.map((p) => (
              <PropertyCard key={p.instanceId} inv={p} />
            ))}
          </div>
        </div>
      )}

      {businesses.length > 0 && (
        <div>
          <h2 className="font-display font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Icon name="Rocket" size={18} /> Business
          </h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {businesses.map((b) => (
              <BusinessCard key={b.instanceId} inv={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PropertyCard({ inv }: { inv: Investment }) {
  const item = getCatalogItem(inv.catalogId)
  const prop = inv.propertyDetails!
  const gain = inv.currentValue - inv.totalInvested
  const positive = gain >= 0

  return (
    <Card className="overflow-hidden">
      {/* "Photo" stylisée */}
      <div className={cn('h-24 bg-gradient-to-br relative flex items-center justify-center', item.gradient)}>
        <Icon name={item.icon} size={40} className="text-white/40" />
        <div className="absolute top-2 right-2">
          {prop.isVacant ? (
            <Badge tone="danger">Vacant · {prop.vacancyMonthsLeft} mois</Badge>
          ) : (
            <Badge tone="success">Loué</Badge>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="font-display font-bold text-slate-800">{inv.name}</div>
        <div className="flex items-center gap-1 text-xs text-slate-400 mb-3">
          <MapPin size={11} />
          {prop.address}, {prop.city}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="Valeur" value={formatEuroCompact(inv.currentValue)} />
          <Metric
            label="Plus-value"
            value={formatPercent(inv.totalInvested > 0 ? gain / inv.totalInvested : 0, true)}
            tone={positive ? 'up' : 'down'}
          />
          <Metric label="Loyer brut" value={`${formatEuro(prop.monthlyRent)}/mois`} />
          <Metric
            label="Revenu net"
            value={`${inv.monthlyIncome >= 0 ? '+' : ''}${formatEuro(inv.monthlyIncome)}`}
            tone={inv.monthlyIncome >= 0 ? 'up' : 'down'}
          />
        </div>

        {inv.mortgageId && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <Badge tone="brand">Financé à crédit</Badge>
          </div>
        )}
      </div>
    </Card>
  )
}

function BusinessCard({ inv }: { inv: Investment }) {
  const item = getCatalogItem(inv.catalogId)
  const biz = inv.businessDetails!
  const needsAttention = biz.attentionMonthsLeft <= 1

  return (
    <Card className="overflow-hidden">
      <div className={cn('h-24 bg-gradient-to-br relative flex items-center justify-center', item.gradient)}>
        <Icon name={item.icon} size={40} className="text-white/40" />
        <div className="absolute top-2 right-2">
          {needsAttention ? (
            <Badge tone="warning">Besoin d'attention</Badge>
          ) : (
            <Badge tone="success">Actif</Badge>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="font-display font-bold text-slate-800">{inv.name}</div>
        <div className="text-xs text-slate-400 mb-3">{biz.businessType}</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="CA mensuel" value={formatEuro(biz.monthlyRevenue)} />
          <Metric label="Charges" value={formatEuro(biz.monthlyCosts)} />
          <Metric
            label="Bénéfice net"
            value={`${inv.monthlyIncome >= 0 ? '+' : ''}${formatEuro(inv.monthlyIncome)}`}
            tone={inv.monthlyIncome >= 0 ? 'up' : 'down'}
          />
          <Metric label="Valeur" value={formatEuroCompact(inv.currentValue)} />
        </div>
      </div>
    </Card>
  )
}

function Metric({
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
      <div className="text-xs text-slate-400">{label}</div>
      <div
        className={cn(
          'font-semibold flex items-center gap-0.5',
          tone === 'up' && 'text-emerald-600',
          tone === 'down' && 'text-red-500',
          !tone && 'text-slate-700',
        )}
      >
        {tone === 'up' && <TrendingUp size={12} />}
        {tone === 'down' && <TrendingDown size={12} />}
        {value}
      </div>
    </div>
  )
}
