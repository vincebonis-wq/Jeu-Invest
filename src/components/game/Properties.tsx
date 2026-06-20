import { useEffect, useState } from 'react'
import { Building2, MapPin, TrendingUp, TrendingDown, Users, Zap, AlertCircle, Tag, X, CreditCard, Calendar, Banknote } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { getCatalogItem } from '../../data/investments'
import { BUSINESS_DECISION_BY_ID } from '../../data/businessDecisions'
import type { Investment, SaleOffer, Mortgage } from '../../types'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Modal'
import { Icon } from '../ui/Icon'
import {
  formatEuro,
  formatEuroCompact,
  formatPercent,
  formatDuration,
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
  const [decisionTarget, setDecisionTarget] = useState<Investment | null>(null)
  const [earlyRepayTarget, setEarlyRepayTarget] = useState<string | null>(null) // mortgageId
  const [saleTarget, setSaleTarget] = useState<Investment | null>(null)

  const properties = game.investments.filter((i) => i.propertyDetails)
  const businesses = game.investments.filter((i) => i.businessDetails)

  if (properties.length === 0 && businesses.length === 0) {
    return (
      <div className="animate-screen-in">
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

  const earlyRepayMortgage = useGameStore((s) => s.earlyRepayMortgage)

  return (
    <div className="space-y-5 animate-screen-in">
      {properties.length > 0 && (
        <div>
          <h2 className="font-display font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Building2 size={18} /> Biens immobiliers
          </h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 stagger">
            {properties.map((p) => (
              <PropertyCard
                key={p.instanceId}
                inv={p}
                onManageTenant={() => setTenantTarget(p)}
                onEarlyRepay={p.mortgageId ? () => setEarlyRepayTarget(p.mortgageId!) : undefined}
                onSale={() => setSaleTarget(p)}
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
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 stagger">
            {businesses.map((b) => (
              <BusinessCard key={b.instanceId} inv={b} onDecide={() => setDecisionTarget(b)} />
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

      {decisionTarget && (
        <BusinessDecisionModal
          inv={decisionTarget}
          onClose={() => setDecisionTarget(null)}
        />
      )}

      {earlyRepayTarget && (() => {
        const mortgage = game.mortgages.find((m) => m.id === earlyRepayTarget)
        if (!mortgage) return null
        const penalty = Math.round(mortgage.outstandingBalance * 0.02)
        const total = mortgage.outstandingBalance + penalty
        return (
          <EarlyRepayModal
            mortgageId={earlyRepayTarget}
            balance={mortgage.outstandingBalance}
            penalty={penalty}
            total={total}
            canAfford={game.cashBalance >= total}
            onClose={() => setEarlyRepayTarget(null)}
            onConfirm={() => {
              earlyRepayMortgage(earlyRepayTarget)
              setEarlyRepayTarget(null)
            }}
          />
        )
      })()}

      {saleTarget && (
        <SaleModal
          inv={saleTarget}
          onClose={() => setSaleTarget(null)}
        />
      )}
    </div>
  )
}

// ============================================================================
// EarlyRepayModal
// ============================================================================

function EarlyRepayModal({
  balance,
  penalty,
  total,
  canAfford,
  onClose,
  onConfirm,
}: {
  mortgageId: string
  balance: number
  penalty: number
  total: number
  canAfford: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal open onClose={onClose} title="Remboursement anticipé" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Vous souhaitez rembourser ce crédit par anticipation. Des pénalités légales s'appliquent (2% du capital restant dû).
        </p>
        <div className="rounded-2xl bg-slate-50 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Capital restant dû</span>
            <span className="font-semibold text-slate-800">{formatEuro(balance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Pénalité (2%)</span>
            <span className="font-semibold text-amber-600">{formatEuro(penalty)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="text-slate-500 font-semibold">Total à payer</span>
            <span className="font-display font-bold text-slate-800">{formatEuro(total)}</span>
          </div>
        </div>
        {!canAfford && (
          <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">
            Cash insuffisant pour effectuer ce remboursement.
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>Annuler</Button>
          <Button variant="primary" fullWidth onClick={onConfirm} disabled={!canAfford}>
            Confirmer
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================================================
// SaleModal — mise en vente + gestion offres
// ============================================================================

function SaleModal({ inv, onClose }: { inv: Investment; onClose: () => void }) {
  const game = useGameStore((s) => s.game)!
  const listPropertyForSale = useGameStore((s) => s.listPropertyForSale)
  const cancelSaleListing = useGameStore((s) => s.cancelSaleListing)
  const respondToSaleOffer = useGameStore((s) => s.respondToSaleOffer)
  const earlyRepayMortgage = useGameStore((s) => s.earlyRepayMortgage)
  const [listingPrice, setListingPrice] = useState(inv.saleListingPrice ?? Math.round(inv.currentValue))
  const [offerResult, setOfferResult] = useState<{ success: boolean; message: string } | null>(null)
  const [repayResult, setRepayResult] = useState<{ success: boolean; message: string } | null>(null)

  const currentValue = inv.currentValue
  const minPrice = Math.round(currentValue * 0.85)
  const maxPrice = Math.round(currentValue * 1.15)
  const pendingOffers = inv.pendingOffers ?? []
  const isListed = !!inv.saleListingPrice

  const mortgage: Mortgage | null = inv.mortgageId
    ? (game.mortgages.find((m) => m.id === inv.mortgageId) ?? null)
    : null

  function handleList() {
    listPropertyForSale(inv.instanceId, listingPrice)
    onClose()
  }
  function handleCancel() {
    cancelSaleListing(inv.instanceId)
    onClose()
  }
  function handleOffer(offer: SaleOffer, accept: boolean) {
    const res = respondToSaleOffer(inv.instanceId, offer.id, accept)
    setOfferResult(res)
    if (res.success && accept) setTimeout(onClose, 1800)
  }
  function handleEarlyRepay() {
    if (!mortgage) return
    const res = earlyRepayMortgage(mortgage.id)
    setRepayResult(res)
    if (res.success) setTimeout(() => setRepayResult(null), 3000)
  }

  const years = mortgage ? Math.floor(mortgage.remainingMonths / 12) : 0
  const months = mortgage ? mortgage.remainingMonths % 12 : 0
  const remainingLabel = mortgage
    ? [years > 0 ? `${years} an${years > 1 ? 's' : ''}` : '', months > 0 ? `${months} mois` : ''].filter(Boolean).join(' ') || '< 1 mois'
    : ''

  return (
    <Modal open onClose={onClose} title={isListed ? 'Bien en vente' : 'Mettre en vente'} size="md">
      <div className="space-y-4">
        {/* Identité du bien */}
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="font-bold text-sm text-slate-700">{inv.name}</div>
          <div className="text-xs text-slate-400">Valeur actuelle : {formatEuro(currentValue)}</div>
        </div>

        {isListed ? (
          <>
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <div className="font-bold mb-0.5">Bien en vente</div>
              <div>Prix affiché : <strong>{formatEuro(inv.saleListingPrice!)}</strong></div>
              {mortgage && (
                <div className="text-xs text-amber-600 mt-1">
                  Crédit restant : {formatEuro(mortgage.outstandingBalance)} — net perçu à la vente : {formatEuro(inv.saleListingPrice! - mortgage.outstandingBalance)}
                </div>
              )}
            </div>

            {pendingOffers.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-600">Offres reçues :</div>
                {pendingOffers.map((offer) => {
                  const net = mortgage
                    ? offer.offeredPrice - mortgage.outstandingBalance
                    : offer.offeredPrice
                  const pct = Math.round((offer.offeredPrice / inv.saleListingPrice! - 1) * 100)
                  return (
                    <div key={offer.id} className="rounded-2xl border border-slate-100 p-3.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-display font-bold text-slate-800 text-base">
                          {formatEuro(offer.offeredPrice)}
                        </span>
                        <span className={cn('text-xs font-semibold', pct >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                          {pct >= 0 ? '+' : ''}{pct}% du prix affiché
                        </span>
                      </div>
                      {mortgage && (
                        <div className="text-xs text-slate-400 mb-2.5 flex items-center gap-1">
                          <CreditCard size={11} />
                          Après remboursement crédit : <strong className={cn(net >= 0 ? 'text-emerald-600' : 'text-red-500')}>{formatEuro(net)} nets</strong>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" fullWidth onClick={() => handleOffer(offer, false)}>
                          <X size={13} /> Refuser
                        </Button>
                        <Button size="sm" variant="primary" fullWidth onClick={() => handleOffer(offer, true)}>
                          <TrendingUp size={13} /> Accepter {formatEuro(net)}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-500 text-center py-2">
                En attente d'offres… (prochaine dans quelques heures)
              </div>
            )}

            {offerResult && (
              <div className={cn('text-sm rounded-xl p-3', offerResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                {offerResult.message}
              </div>
            )}

            <Button variant="secondary" fullWidth onClick={handleCancel}>
              Annuler la mise en vente
            </Button>
          </>
        ) : (
          <>
            {/* Crédit en cours */}
            {mortgage && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
                  <CreditCard size={14} /> Crédit immobilier en cours
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MortgageStat icon={<Banknote size={13} />} label="Solde restant" value={formatEuro(mortgage.outstandingBalance)} highlight />
                  <MortgageStat icon={<Calendar size={13} />} label="Durée restante" value={remainingLabel} />
                  <MortgageStat icon={<TrendingDown size={13} />} label="Mensualité" value={`${formatEuro(mortgage.monthlyPayment)}/m`} />
                </div>
                <div className="flex items-center justify-between text-xs rounded-xl bg-white/70 border border-amber-100 px-3 py-2">
                  <span className="text-amber-700">Net à ce prix de vente</span>
                  <span className={cn('font-bold', listingPrice - mortgage.outstandingBalance >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                    {formatEuro(listingPrice - mortgage.outstandingBalance)}
                  </span>
                </div>
                <p className="text-xs text-amber-600">
                  Le crédit est automatiquement soldé lors de l'acceptation d'une offre.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={handleEarlyRepay}
                  disabled={game.cashBalance < mortgage.outstandingBalance * 1.02}
                >
                  Rembourser maintenant{' '}
                  <span className="text-slate-400 font-normal">
                    ({formatEuro(Math.round(mortgage.outstandingBalance * 1.02))} · 2% pénalité)
                  </span>
                </Button>
                {repayResult && (
                  <div className={cn('text-xs rounded-xl p-2 text-center', repayResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                    {repayResult.message}
                  </div>
                )}
              </div>
            )}

            {/* Slider prix */}
            <div>
              <label className="flex justify-between text-sm font-semibold text-slate-600 mb-1.5">
                <span>Prix de vente</span>
                <span className="text-brand-600">{formatEuro(listingPrice)}</span>
              </label>
              <input
                type="range"
                min={minPrice}
                max={maxPrice}
                step={500}
                value={listingPrice}
                onChange={(e) => setListingPrice(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>−15% ({formatEuro(minPrice)})</span>
                <span>valeur : {formatEuroCompact(currentValue)}</span>
                <span>+15% ({formatEuro(maxPrice)})</span>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500 space-y-1">
              <p>Des acheteurs feront des offres toutes les ~4 heures.</p>
              <p>Vous pourrez accepter ou refuser chaque offre.</p>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={onClose}>Annuler</Button>
              <Button variant="gold" fullWidth onClick={handleList}>
                <Tag size={14} /> Mettre en vente
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

function MortgageStat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-white/70 border border-amber-100 p-2.5 text-center">
      <div className={cn('flex items-center justify-center gap-1 text-amber-500 mb-1', highlight && 'text-amber-700')}>
        {icon}
      </div>
      <div className="text-[10px] text-amber-500 uppercase tracking-wide">{label}</div>
      <div className={cn('text-xs font-bold mt-0.5', highlight ? 'text-amber-800' : 'text-amber-700')}>{value}</div>
    </div>
  )
}

// ============================================================================
// PropertyCard
// ============================================================================

function PropertyCard({
  inv,
  onManageTenant,
  onEarlyRepay,
  onSale,
}: {
  inv: Investment
  onManageTenant: () => void
  onEarlyRepay?: () => void
  onSale: () => void
}) {
  const item = getCatalogItem(inv.catalogId)
  const prop = inv.propertyDetails!
  const gain = inv.currentValue - inv.totalInvested
  const positive = gain >= 0

  const currentProfile = TENANT_PROFILES.find((p) => p.id === prop.tenantProfile) ?? TENANT_PROFILES[0]
  const isForSale = !!inv.saleListingPrice
  const offerCount = (inv.pendingOffers ?? []).length

  return (
    <Card className="overflow-hidden">
      {/* "Photo" stylisée */}
      <div className={cn('h-24 bg-gradient-to-br relative flex items-center justify-center', item.gradient)}>
        <Icon name={item.icon} size={40} className="text-white/40" />
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {prop.isVacant ? (
            <Badge tone="danger">Vacant · {prop.vacancyMonthsLeft} mois</Badge>
          ) : (
            <Badge tone="success">Loué</Badge>
          )}
          {isForSale && (
            <Badge tone="warning">
              {offerCount > 0 ? `${offerCount} offre${offerCount > 1 ? 's' : ''}` : 'En vente'}
            </Badge>
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
        <div className="border-t border-slate-100 pt-3 space-y-2">
          {!prop.isVacant && prop.tenantName ? (
            <div className="rounded-xl bg-slate-50 p-2.5 mb-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-0.5">
                <span>{currentProfile.emoji}</span>
                <span>{prop.tenantName}</span>
                {prop.tenantSinceMonthIndex !== undefined && prop.tenantSinceMonthIndex >= 1 && (
                  <span className="text-slate-400 font-normal">
                    · {prop.tenantSinceMonthIndex} mois
                  </span>
                )}
              </div>
              {prop.tenantStory && (
                <p className="text-[11px] text-slate-400 leading-snug">{prop.tenantStory}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Users size={12} />
                <span className="font-semibold">Locataire :</span>
                <span>{prop.isVacant ? '🔍 Recherche en cours' : `${currentProfile.emoji} ${currentProfile.label}`}</span>
              </div>
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={onManageTenant}
          >
            <Users size={13} /> Changer de locataire
          </Button>

          {/* Bouton remboursement anticipé */}
          {onEarlyRepay && (
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={onEarlyRepay}
            >
              Rembourser par anticipation
            </Button>
          )}

          {/* Bouton mise en vente */}
          <Button
            variant={isForSale ? 'primary' : 'secondary'}
            size="sm"
            fullWidth
            onClick={onSale}
          >
            <Tag size={13} />
            {isForSale
              ? offerCount > 0
                ? `Voir offres (${offerCount})`
                : 'Gérer la mise en vente'
              : 'Mettre en vente'}
          </Button>
        </div>

        {inv.mortgageId && !onEarlyRepay && (
          <div className="mt-2">
            <Badge tone="brand">Financé à crédit</Badge>
          </div>
        )}
        {inv.mortgageId && onEarlyRepay && (
          <div className="mt-2">
            <Badge tone="brand">Crédit en cours</Badge>
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

                <div className="p-3.5">
                  <p className="text-xs text-slate-500 mb-2.5">{profile.description}</p>

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

function BusinessCard({ inv, onDecide }: { inv: Investment; onDecide: () => void }) {
  const item = getCatalogItem(inv.catalogId)
  const biz = inv.businessDetails!
  const needsAttention = biz.attentionMonthsLeft <= 1
  const hasPendingDecision = !!biz.pendingDecisionId
  const pendingDecision = biz.pendingDecisionId ? BUSINESS_DECISION_BY_ID[biz.pendingDecisionId] : null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const nextDecisionIn = !hasPendingDecision && biz.decisionAvailableAtReal
    ? biz.decisionAvailableAtReal - now
    : 0

  return (
    <Card className="overflow-hidden">
      <div className={cn('h-24 bg-gradient-to-br relative flex items-center justify-center', item.gradient)}>
        <Icon name={item.icon} size={40} className="text-white/40" />
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {hasPendingDecision ? (
            <Badge tone="warning">Décision en attente</Badge>
          ) : needsAttention ? (
            <Badge tone="warning">Besoin d'attention</Badge>
          ) : (
            <Badge tone="success">Actif</Badge>
          )}
          <Badge tone="brand">Stade {biz.growthStage ?? 0}</Badge>
        </div>
      </div>
      <div className="p-4">
        <div className="font-display font-bold text-slate-800">{inv.name}</div>
        <div className="text-xs text-slate-400 mb-3">{biz.businessType}</div>
        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
          <Metric label="CA mensuel" value={formatEuro(biz.monthlyRevenue)} />
          <Metric label="Charges" value={formatEuro(biz.monthlyCosts)} />
          <Metric
            label="Bénéfice net"
            value={`${inv.monthlyIncome >= 0 ? '+' : ''}${formatEuro(inv.monthlyIncome)}`}
            tone={inv.monthlyIncome >= 0 ? 'up' : 'down'}
          />
          <Metric label="Valeur" value={formatEuroCompact(inv.currentValue)} />
        </div>

        <div className="border-t border-slate-100 pt-3">
          {hasPendingDecision && pendingDecision ? (
            <Button variant="primary" size="sm" fullWidth onClick={onDecide}>
              <AlertCircle size={13} /> {pendingDecision.emoji} {pendingDecision.title}
            </Button>
          ) : (
            <div className="text-xs text-slate-400 flex items-center justify-center gap-1.5 py-1.5">
              <Zap size={12} />
              {nextDecisionIn > 0
                ? `Prochaine décision dans ~${formatDuration(nextDecisionIn)}`
                : 'Décision à venir bientôt...'}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// ============================================================================
// BusinessDecisionModal
// ============================================================================

function BusinessDecisionModal({ inv, onClose }: { inv: Investment; onClose: () => void }) {
  const resolveBusinessDecision = useGameStore((s) => s.resolveBusinessDecision)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const biz = inv.businessDetails!
  const decision = biz.pendingDecisionId ? BUSINESS_DECISION_BY_ID[biz.pendingDecisionId] : null

  if (!decision) {
    onClose()
    return null
  }

  function handleChoose(optionId: string) {
    const res = resolveBusinessDecision(inv.instanceId, optionId)
    setResult(res)
    if (res.success) {
      setTimeout(() => onClose(), 1800)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${decision.emoji} ${decision.title}`} size="md">
      {result?.success ? (
        <div className="py-6 text-center animate-pop-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <Zap size={32} />
          </div>
          <p className="font-display font-bold text-emerald-600 text-lg">{result.message}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{decision.prompt}</p>
          <div className="space-y-2.5">
            {decision.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleChoose(opt.id)}
                className="w-full text-left rounded-2xl border-2 border-slate-100 hover:border-brand-300 hover:shadow-sm transition-all p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-slate-800">{opt.label}</span>
                  {opt.cost > 0 && (
                    <span className="text-xs font-bold text-amber-600 shrink-0">{formatEuro(opt.cost)}</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">{opt.description}</p>
                {opt.riskOfFailure ? (
                  <p className="text-xs text-red-400 mt-1">
                    ⚠️ {Math.round(opt.riskOfFailure * 100)}% de risque d'échec
                  </p>
                ) : null}
              </button>
            ))}
          </div>
          {result && !result.success && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{result.message}</div>
          )}
        </div>
      )}
    </Modal>
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
