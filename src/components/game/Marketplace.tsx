import { useMemo, useState } from 'react'
import { Lock, TrendingUp, Droplets, Clock, Check, GraduationCap } from 'lucide-react'
import { INVESTMENT_CATALOG } from '../../data/investments'
import { SKILL_BY_ID } from '../../data/skills'
import type { InvestmentCatalogItem } from '../../types'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { PHASE_LABEL } from '../../engine/economy'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Badge, RiskBadge } from '../ui/Badge'
import { Icon } from '../ui/Icon'
import {
  formatEuro,
  formatEuroCompact,
  formatPercent,
  cn,
} from '../../utils/formatting'

// ============================================================================
// Types pour la sélection de bien immobilier
// ============================================================================

interface PropertyOffer {
  id: 'budget' | 'standard' | 'premium'
  label: string
  emoji: string
  city: string
  priceFactor: number        // multiplier on base price
  yieldBonus: number         // additive to base yield
  maintenanceFactor: number  // multiplier on maintenance
  pros: string[]
  cons: string[]
  description: string
  stars: number // 1-5 location quality
}

function generatePropertyOffers(item: InvestmentCatalogItem, baseAmount: number, gameDateISO: string): PropertyOffer[] {
  const cities = ['Lyon', 'Bordeaux', 'Toulouse', 'Nantes', 'Lille', 'Montpellier', 'Strasbourg', 'Rennes']
  const seed = new Date(gameDateISO).getMonth()
  const c1 = cities[seed % cities.length]
  const c2 = cities[(seed + 3) % cities.length]
  const c3 = cities[(seed + 6) % cities.length]

  const isParking = item.id === 'parking'
  const isLmnp = item.id === 'lmnp'

  // Suppress unused warning — baseAmount is used in callers via priceFactor
  void baseAmount

  return [
    {
      id: 'budget',
      label: 'Affaire à saisir',
      emoji: isParking ? '🅿️' : isLmnp ? '🛏️' : '🏠',
      city: c1,
      priceFactor: 0.78,
      yieldBonus: 0.008,
      maintenanceFactor: 1.5,
      pros: ['Prix −22% sous le marché', 'Rendement locatif élevé', 'Fort potentiel de plus-value'],
      cons: ['Travaux de rénovation à prévoir', 'Charges d\'entretien élevées', 'Risque locatif plus important'],
      description: isParking ? 'Box vieillissant, idéal pour un investisseur bricoleur.' : 'Appartement à rénover dans un quartier en transition.',
      stars: 2,
    },
    {
      id: 'standard',
      label: 'Rapport qualité/prix',
      emoji: isParking ? '🏢' : isLmnp ? '🛋️' : '🏡',
      city: c2,
      priceFactor: 1.0,
      yieldBonus: 0,
      maintenanceFactor: 1.0,
      pros: ['Équilibre rendement/risque', 'Locataire stable', 'Entretien raisonnable'],
      cons: ['Prix de marché', 'Rendement standard'],
      description: 'Le choix sûr et équilibré. Pas de surprise, pas d\'exploit.',
      stars: 3,
    },
    {
      id: 'premium',
      label: 'Emplacement prime',
      emoji: isParking ? '🌟' : isLmnp ? '🏨' : '🏛️',
      city: c3,
      priceFactor: 1.3,
      yieldBonus: -0.004,
      maintenanceFactor: 0.6,
      pros: ['Centre-ville, forte demande', 'Vacance locative quasi nulle', 'Très faibles charges'],
      cons: ['Prix élevé (+30%)', 'Rendement légèrement inférieur', 'Capital immobilisé plus important'],
      description: 'L\'emplacement numéro 1. Moins rentable à court terme mais patrimoine solide.',
      stars: 5,
    },
  ]
}

// ============================================================================
// Composant principal
// ============================================================================

export function Marketplace() {
  const game = useGameStore((s) => s.game)!
  const netWorth = calcNetWorth(game)
  const phase = game.economy.marketPhase
  const phaseInfo = PHASE_LABEL[phase]
  const [buyTarget, setBuyTarget] = useState<InvestmentCatalogItem | null>(null)
  const learned = game.player.learnedSkillIds || []

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Bandeau marché */}
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ backgroundColor: `${phaseInfo.color}15` }}
      >
        <span className="text-2xl">{phaseInfo.emoji}</span>
        <div>
          <div className="font-display font-bold" style={{ color: phaseInfo.color }}>
            {phaseInfo.label}
          </div>
          <div className="text-xs text-slate-500">
            {phase === 'crash' || phase === 'bear'
              ? 'Période risquée pour la bourse, mais les opportunités d\'achat sont là.'
              : phase === 'bull'
                ? 'Les actifs risqués performent. Attention aux excès !'
                : 'Marché calme. Bon moment pour construire progressivement.'}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {INVESTMENT_CATALOG.map((item) => {
          const skillOk = !item.skillRequired || learned.includes(item.skillRequired)
          const wealthOk = netWorth >= item.unlockThreshold
          const unlocked = skillOk && wealthOk
          return (
            <CatalogCard
              key={item.id}
              item={item}
              unlocked={unlocked}
              missingSkill={!skillOk ? item.skillRequired : undefined}
              missingWealth={!wealthOk}
              onBuy={() => setBuyTarget(item)}
            />
          )
        })}
      </div>

      {buyTarget && (
        <BuyModal item={buyTarget} onClose={() => setBuyTarget(null)} />
      )}
    </div>
  )
}

function CatalogCard({
  item,
  unlocked,
  missingSkill,
  missingWealth,
  onBuy,
}: {
  item: InvestmentCatalogItem
  unlocked: boolean
  missingSkill?: string
  missingWealth?: boolean
  onBuy: () => void
}) {
  return (
    <Card className={cn('overflow-hidden flex flex-col', !unlocked && 'opacity-90')}>
      {/* Bandeau coloré */}
      <div className={cn('h-2 bg-gradient-to-r', item.gradient)} />
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5">
            <div
              className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shrink-0', item.gradient)}
            >
              <Icon name={item.icon} size={22} />
            </div>
            <div>
              <div className="font-display font-bold text-slate-800 leading-tight">
                {item.shortName}
              </div>
              <div className="text-xs text-slate-400">
                dès {formatEuroCompact(item.minAmount)}
              </div>
            </div>
          </div>
          {!unlocked && (
            <div className="flex items-center gap-1 text-slate-400">
              <Lock size={14} />
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-3 flex-1">
          {item.description}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge tone="success">
            <TrendingUp size={11} />
            {item.returnVariance > 0
              ? `~${formatPercent(item.baseAnnualReturn)}`
              : formatPercent(item.baseAnnualReturn)}
            /an
          </Badge>
          <RiskBadge level={item.riskLevel} />
          {item.lockPeriodMonths && (
            <Badge tone="warning">
              <Clock size={11} />
              {item.lockPeriodMonths} mois
            </Badge>
          )}
          <Badge tone="slate">
            <Droplets size={11} />
            Liquidité {item.liquidityLevel}/5
          </Badge>
          {item.purchaseCostPct > 0 && (
            <Badge tone="warning">
              Frais {(item.purchaseCostPct * 100).toFixed(0)}%
            </Badge>
          )}
        </div>

        {unlocked ? (
          <Button fullWidth onClick={onBuy}>
            Investir
          </Button>
        ) : (
          <div className="text-center py-2.5 px-3 rounded-xl bg-slate-50 text-xs font-semibold text-slate-400 space-y-1">
            {missingSkill && (
              <div className="flex items-center gap-1 justify-center text-amber-600">
                <GraduationCap size={11} />
                Requiert : {SKILL_BY_ID[missingSkill]?.name ?? missingSkill}
              </div>
            )}
            {missingWealth && (
              <div className="flex items-center gap-1 justify-center">
                <Lock size={11} />
                Débloqué à {formatEuroCompact(item.unlockThreshold)} de patrimoine
              </div>
            )}
            {!missingSkill && !missingWealth && (
              <div className="flex items-center gap-1 justify-center">
                <Lock size={11} />
                Non disponible
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// ============================================================================
// PropertyOfferCard
// ============================================================================

function PropertyOfferCard({
  offer,
  onSelect,
  baseAmount,
}: {
  offer: PropertyOffer
  onSelect: () => void
  baseAmount: number
}) {
  const price = Math.round(baseAmount * offer.priceFactor)
  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-2xl border-2 border-slate-100 hover:border-brand-300 transition-all overflow-hidden hover:shadow-md"
    >
      {/* Visual header */}
      <div
        className={cn(
          'h-20 flex items-center justify-center relative',
          offer.id === 'budget'
            ? 'bg-gradient-to-br from-slate-600 to-slate-800'
            : offer.id === 'standard'
              ? 'bg-gradient-to-br from-blue-600 to-indigo-700'
              : 'bg-gradient-to-br from-amber-500 to-orange-600',
        )}
      >
        <span className="text-4xl">{offer.emoji}</span>
        <div className="absolute top-2 left-2 bg-black/30 text-white text-xs px-2 py-0.5 rounded-full font-bold">
          {offer.label}
        </div>
        <div className="absolute top-2 right-2 text-yellow-300 text-xs">
          {'★'.repeat(offer.stars)}{'☆'.repeat(5 - offer.stars)}
        </div>
        <div className="absolute bottom-2 right-2 text-white/80 text-xs font-semibold">
          📍 {offer.city}
        </div>
      </div>
      {/* Content */}
      <div className="p-3">
        <div className="font-display font-bold text-slate-800 text-base mb-1">
          {formatEuro(price)}
        </div>
        <p className="text-xs text-slate-500 mb-2">{offer.description}</p>
        <div className="space-y-0.5">
          {offer.pros.slice(0, 2).map((p, i) => (
            <div key={i} className="text-xs text-emerald-700">✅ {p}</div>
          ))}
          {offer.cons.slice(0, 1).map((c, i) => (
            <div key={i} className="text-xs text-red-500">❌ {c}</div>
          ))}
        </div>
      </div>
    </button>
  )
}

// ============================================================================
// BuyModal
// ============================================================================

function BuyModal({
  item,
  onClose,
}: {
  item: InvestmentCatalogItem
  onClose: () => void
}) {
  const game = useGameStore((s) => s.game)!
  const buyInvestment = useGameStore((s) => s.buyInvestment)
  const getQuote = useGameStore((s) => s.getMortgageQuoteFor)

  const cash = game.cashBalance
  const [amount, setAmount] = useState(
    Math.min(Math.max(item.minAmount, Math.round(cash * 0.5)), Math.max(item.minAmount, cash)),
  )
  const [useMortgage, setUseMortgage] = useState(item.canUseMortgage)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [selectedOffer, setSelectedOffer] = useState<PropertyOffer | null>(null)
  const [offerStep, setOfferStep] = useState<'select' | 'buy'>(item.isRealEstate ? 'select' : 'buy')

  const quote = useMemo(() => {
    if (!item.canUseMortgage || !useMortgage) return null
    return getQuote(item.id, amount)
  }, [item, useMortgage, amount, getQuote])

  const furnitureCost =
    item.id === 'lmnp' ? Math.max(4000, Math.round(amount * 0.06)) : 0

  const purchaseCostPct = item.purchaseCostPct ?? 0

  function handleBuy() {
    const res = buyInvestment(item.id, amount, useMortgage)
    setResult(res)
    if (res.success) {
      setTimeout(onClose, 1400)
    }
  }

  // Pour l'immo avec crédit, le slider représente le PRIX du bien.
  const sliderMax = useMortgage && item.canUseMortgage
    ? Math.max(item.minAmount, Math.round(cash * 5))
    : Math.max(item.minAmount, cash + furnitureCost)

  return (
    <Modal open onClose={onClose} title={item.name} size="md">
      {result?.success ? (
        <div className="py-8 text-center animate-pop-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Check size={32} />
          </div>
          <p className="font-display font-bold text-slate-800">{result.message}</p>
        </div>
      ) : offerStep === 'select' ? (
        /* ---- Étape 1 : Sélection du bien ---- */
        <div className="space-y-3">
          <div className={cn('rounded-2xl p-3 bg-gradient-to-br text-white', item.gradient)}>
            <div className="flex items-center gap-2 mb-0.5">
              <Icon name={item.icon} size={16} />
              <span className="font-display font-bold text-sm">{item.shortName}</span>
            </div>
            <p className="text-xs text-white/90">{item.description}</p>
          </div>
          <div className="text-sm font-semibold text-slate-600 mb-2">Choisissez votre bien :</div>
          {generatePropertyOffers(item, amount, game.gameDateISO).map((offer) => (
            <PropertyOfferCard
              key={offer.id}
              offer={offer}
              baseAmount={amount}
              onSelect={() => {
                setSelectedOffer(offer)
                setAmount(Math.round(amount * offer.priceFactor))
                setOfferStep('buy')
              }}
            />
          ))}
        </div>
      ) : (
        /* ---- Étape 2 : Confirmation d'achat ---- */
        <div className="space-y-4">
          {/* Bouton retour (immobilier uniquement) */}
          {item.isRealEstate && (
            <button
              onClick={() => setOfferStep('select')}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-2"
            >
              ← Changer de bien
            </button>
          )}

          {/* Mini-carte du bien sélectionné */}
          {selectedOffer && (
            <div className="rounded-xl bg-slate-50 p-3 flex items-center gap-3">
              <span className="text-2xl">{selectedOffer.emoji}</span>
              <div>
                <div className="font-bold text-sm text-slate-700">
                  {selectedOffer.label} · {selectedOffer.city}
                </div>
                <div className="text-xs text-slate-400">{selectedOffer.description}</div>
              </div>
            </div>
          )}

          {!selectedOffer && (
            <div className={cn('rounded-2xl p-4 bg-gradient-to-br text-white', item.gradient)}>
              <div className="flex items-center gap-2 mb-1">
                <Icon name={item.icon} size={18} />
                <span className="font-display font-bold">{item.shortName}</span>
              </div>
              <p className="text-xs text-white/90">{item.description}</p>
            </div>
          )}

          {/* Montant */}
          <div>
            <label className="flex justify-between text-sm font-semibold text-slate-600 mb-1.5">
              <span>{useMortgage && item.canUseMortgage ? 'Prix du bien' : 'Montant à investir'}</span>
              <span className="text-brand-600">{formatEuro(amount)}</span>
            </label>
            <input
              type="range"
              min={item.minAmount}
              max={sliderMax}
              step={item.minAmount >= 1000 ? 1000 : 10}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>min {formatEuroCompact(item.minAmount)}</span>
              <span>max {formatEuroCompact(sliderMax)}</span>
            </div>
            <input
              type="number"
              value={amount}
              min={item.minAmount}
              onChange={(e) => setAmount(Number(e.target.value) || item.minAmount)}
              className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-brand-400 outline-none text-sm"
            />
          </div>

          {/* Option crédit */}
          {item.canUseMortgage && (
            <button
              onClick={() => setUseMortgage(!useMortgage)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left',
                useMortgage ? 'border-brand-300 bg-brand-50' : 'border-slate-100',
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0',
                  useMortgage ? 'bg-brand-500 border-brand-500' : 'border-slate-300',
                )}
              >
                {useMortgage && <Check size={14} className="text-white" />}
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-700">
                  Financer avec un crédit (effet de levier)
                </div>
                <div className="text-xs text-slate-400">
                  Apport de 20% minimum, le reste emprunté
                </div>
              </div>
            </button>
          )}

          {/* Devis crédit */}
          {quote && (
            <div
              className={cn(
                'rounded-2xl p-4 text-sm space-y-1.5',
                quote.approved ? 'bg-slate-50' : 'bg-red-50',
              )}
            >
              {quote.approved ? (
                <>
                  <Row label="Apport (comptant)" value={formatEuro(quote.downPayment)} />
                  <Row label="Montant emprunté" value={formatEuro(quote.principal)} />
                  <Row
                    label={`Mensualité (${quote.termMonths / 12} ans)`}
                    value={`${formatEuro(quote.monthlyPayment)}/mois`}
                  />
                  <Row label="Taux du crédit" value={formatPercent(quote.annualRate)} />
                </>
              ) : (
                <div className="text-red-600 text-xs font-medium">{quote.reason}</div>
              )}
            </div>
          )}

          {/* Récap comptant */}
          {!useMortgage && (
            <div className="rounded-2xl p-4 bg-slate-50 text-sm space-y-1.5">
              <Row label="Investissement" value={formatEuro(amount)} />
              {purchaseCostPct > 0 && (
                <Row
                  label={`Frais notaire (${Math.round(purchaseCostPct * 100)}%)`}
                  value={`-${formatEuro(Math.round(amount * purchaseCostPct))}`}
                />
              )}
              {purchaseCostPct > 0 && (
                <Row
                  label="Valeur nette initiale"
                  value={formatEuro(Math.round(amount * (1 - purchaseCostPct)))}
                  bold
                />
              )}
              {furnitureCost > 0 && (
                <Row label="Mobilier (LMNP)" value={formatEuro(furnitureCost)} />
              )}
              <Row label="Cash disponible" value={formatEuro(cash)} />
              <div className="pt-1.5 border-t border-slate-200">
                <Row
                  label="Coût total"
                  value={formatEuro(amount + furnitureCost)}
                  bold
                />
              </div>
            </div>
          )}

          {result && !result.success && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">
              {result.message}
            </div>
          )}

          <Button
            fullWidth
            size="lg"
            variant="gold"
            onClick={handleBuy}
            disabled={amount < item.minAmount}
          >
            Confirmer l'investissement
          </Button>
        </div>
      )}
    </Modal>
  )
}

function Row({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={cn('text-slate-700', bold && 'font-display font-bold')}>
        {value}
      </span>
    </div>
  )
}
