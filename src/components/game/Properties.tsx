import { useState } from 'react'
import { Building2, MapPin, TrendingUp, TrendingDown, Users } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { getCatalogItem } from '../../data/investments'
import type { Investment } from '../../types'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Modal'
import { Icon } from '../ui/Icon'
import {
  formatEuro,
  formatEuroCompact,
  formatPercent,
  cn,
} from '../../utils/formatting'

// ============================================================================
// Profils locataires
// ============================================================================

const TENANT_PROFILES = [
  {
    id: 'professional',
    emoji: '👔',
    label: 'Professionnel(le)',
    subtitle: 'CDI, revenus stables',
    description: 'Le choix sûr. Peu de turnover, faibles impayés, bon entretien.',
    rentMultiplier: 1.0,
    maintenanceFactor: 1.0,
    pros: ['Très faible risque d\'impayé', 'Entretien soigné du logement', 'Bail long, peu de vacance'],
    cons: ['Loyer au prix du marché'],
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-50 border-blue-200',
    badge: 'success' as const,
    badgeLabel: 'Recommandé',
  },
  {
    id: 'student',
    emoji: '🎓',
    label: 'Étudiant(e)',
    subtitle: 'Location meublée, rotation annuelle',
    description: 'Loyer plus élevé grâce au meublé, mais changement chaque année scolaire.',
    rentMultiplier: 1.15,
    maintenanceFactor: 1.35,
    pros: ['Loyer +15% (bail meublé)', 'Forte demande dans les villes uni.', 'Garant souvent disponible'],
    cons: ['Changement de locataire chaque année', 'Usure plus rapide du mobilier', 'Vacance locative estivale'],
    color: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-50 border-violet-200',
    badge: null,
    badgeLabel: '',
  },
  {
    id: 'family',
    emoji: '👨‍👩‍👧',
    label: 'Famille',
    subtitle: 'Stabilité maximale, bail 3 ans',
    description: 'Reste longtemps, entretient bien. Légèrement moins de loyer mais aucun souci.',
    rentMultiplier: 0.92,
    maintenanceFactor: 0.75,
    pros: ['Bail 3 ans renouvelable', 'Entretien exemplaire du logement', 'Taux d\'impayé quasi nul'],
    cons: ['Loyer −8% vs marché', 'Congé difficile à donner'],
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-emerald-50 border-emerald-200',
    badge: null,
    badgeLabel: '',
  },
]

// ============================================================================
// Composant principal
// ============================================================================

export function Properties() {
  const game = useGameStore((s) => s.game)!
  const setScreen = useGameStore((s) => s.setScreen)
  const [tenantTarget, setTenantTarget] = useState<Investment | null>(null)

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
              <PropertyCard
                key={p.instanceId}
                inv={p}
                onManageTenant={() => setTenantTarget(p)}
              />
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

      {tenantTarget && (
        <TenantSelectionModal
          inv={tenantTarget}
          onClose={() => setTenantTarget(null)}
        />
      )}
    </div>
  )
}

// ============================================================================
// PropertyCard
// ============================================================================

function PropertyCard({ inv, onManageTenant }: { inv: Investment; onManageTenant: () => void }) {
  const item = getCatalogItem(inv.catalogId)
  const prop = inv.propertyDetails!
  const gain = inv.currentValue - inv.totalInvested
  const positive = gain >= 0

  const currentProfile = TENANT_PROFILES.find((p) => p.id === prop.tenantProfile) ?? TENANT_PROFILES[0]

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

        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
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

        {/* Section locataire */}
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Users size={12} />
              <span className="font-semibold">Locataire actuel :</span>
              <span>{currentProfile.emoji} {currentProfile.label}</span>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={onManageTenant}
          >
            <Users size={13} /> Changer de locataire
          </Button>
        </div>

        {inv.mortgageId && (
          <div className="mt-2">
            <Badge tone="brand">Financé à crédit</Badge>
          </div>
        )}
      </div>
    </Card>
  )
}

// ============================================================================
// TenantSelectionModal
// ============================================================================

function TenantSelectionModal({ inv, onClose }: { inv: Investment; onClose: () => void }) {
  const selectTenant = useGameStore((s) => s.selectTenant)
  const prop = inv.propertyDetails!
  const currentProfile = prop.tenantProfile

  const baseRent = prop.baseMonthlyRent ?? prop.monthlyRent

  function handleSelect(profile: typeof TENANT_PROFILES[0]) {
    selectTenant(inv.instanceId, profile.id, profile.rentMultiplier, profile.maintenanceFactor)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Choisir un locataire — ${inv.name}`} size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Le profil locataire influence le loyer, l'entretien du bien et le risque de vacance.
          Le loyer de référence est de <strong>{formatEuro(baseRent)}/mois</strong>.
        </p>

        <div className="space-y-3">
          {TENANT_PROFILES.map((profile) => {
            const isSelected = currentProfile === profile.id
            const estimatedRent = Math.round(baseRent * profile.rentMultiplier)

            return (
              <button
                key={profile.id}
                onClick={() => handleSelect(profile)}
                className={cn(
                  'w-full text-left rounded-2xl border-2 transition-all overflow-hidden',
                  isSelected
                    ? 'border-brand-400 shadow-md'
                    : 'border-slate-100 hover:border-brand-200 hover:shadow-sm',
                )}
              >
                {/* Header coloré */}
                <div className={cn('h-16 bg-gradient-to-r flex items-center px-4 gap-3', profile.color)}>
                  <span className="text-3xl">{profile.emoji}</span>
                  <div>
                    <div className="font-display font-bold text-white text-base">{profile.label}</div>
                    <div className="text-white/80 text-xs">{profile.subtitle}</div>
                  </div>
                  {isSelected && (
                    <div className="ml-auto bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      ✓ Actuel
                    </div>
                  )}
                  {profile.badgeLabel && !isSelected && (
                    <div className="ml-auto bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      {profile.badgeLabel}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-3.5">
                  <p className="text-xs text-slate-500 mb-2.5">{profile.description}</p>

                  {/* Loyer estimé */}
                  <div className={cn('rounded-xl p-2.5 mb-2.5 border', profile.bgColor)}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Loyer estimé avec ce profil</span>
                      <span className="font-display font-bold text-slate-800">
                        {formatEuro(estimatedRent)}/mois
                        {profile.rentMultiplier !== 1 && (
                          <span className={cn('ml-1 text-xs font-semibold', profile.rentMultiplier > 1 ? 'text-emerald-600' : 'text-amber-600')}>
                            ({profile.rentMultiplier > 1 ? '+' : ''}{Math.round((profile.rentMultiplier - 1) * 100)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Avantages / inconvénients */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      {profile.pros.slice(0, 2).map((p, i) => (
                        <div key={i} className="text-xs text-emerald-700 flex gap-1">
                          <span className="shrink-0">✅</span>{p}
                        </div>
                      ))}
                    </div>
                    <div>
                      {profile.cons.map((c, i) => (
                        <div key={i} className="text-xs text-red-500 flex gap-1">
                          <span className="shrink-0">⚠️</span>{c}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <Button variant="secondary" fullWidth onClick={onClose}>Annuler</Button>
      </div>
    </Modal>
  )
}

// ============================================================================
// BusinessCard
// ============================================================================

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

// ============================================================================
// Metric helper
// ============================================================================

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
