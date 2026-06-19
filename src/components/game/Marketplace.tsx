import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, Check, Wallet } from 'lucide-react'
import { INVESTMENT_CATALOG, getCatalogItem } from '../../data/investments'
import { SKILL_BY_ID } from '../../data/skills'
import { INVESTMENT_EDU } from '../../data/education'
import type { ImmoSearch, InvestmentCatalogItem, PropertyCandidate } from '../../types'
import { useGameStore } from '../../store/gameStore'
import { PHASE_LABEL } from '../../engine/economy'
import { buildAmortizationSchedule } from '../../engine/immoEngine'
import { monthlyPaymentFor } from '../../engine/investments'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Icon } from '../ui/Icon'
import { MarketplaceMap } from './MarketplaceMap'
import { Portfolio } from './Portfolio'
import { StockMarketWidget } from './StockMarketWidget'
import {
  formatEuro,
  formatEuroCompact,
  formatPercent,
  cn,
} from '../../utils/formatting'

// ============================================================================
// Types pour la sélection de bien immobilier (legacy — pour triggerAutoBuy)
// ============================================================================

interface PropertyOffer {
  id: 'budget' | 'standard' | 'premium'
  label: string
  emoji: string
  city: string
  priceFactor: number
  yieldBonus: number
  maintenanceFactor: number
  pros: string[]
  cons: string[]
  description: string
  stars: number
}

function generatePropertyOffers(item: InvestmentCatalogItem, baseAmount: number, gameDateISO: string): PropertyOffer[] {
  const cities = ['Lyon', 'Bordeaux', 'Toulouse', 'Nantes', 'Lille', 'Montpellier', 'Strasbourg', 'Rennes']
  const seed = new Date(gameDateISO).getMonth()
  const c1 = cities[seed % cities.length]
  const c2 = cities[(seed + 3) % cities.length]
  const c3 = cities[(seed + 6) % cities.length]
  const isParking = item.id === 'parking'
  const isLmnp = item.id === 'lmnp'
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
  const phase = game.economy.marketPhase
  const phaseInfo = PHASE_LABEL[phase]
  const pendingAutoBuy = useGameStore((s) => s.pendingAutoBuy)
  const clearAutoBuy = useGameStore((s) => s.clearAutoBuy)
  const [buyTarget, setBuyTarget] = useState<InvestmentCatalogItem | null>(null)
  const [eduTarget, setEduTarget] = useState<InvestmentCatalogItem | null>(null)
  const [depositTarget, setDepositTarget] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'invest' | 'portfolio'>('invest')
  const [comparisonSearch, setComparisonSearch] = useState<ImmoSearch | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<{ search: ImmoSearch; candidate: PropertyCandidate } | null>(null)

  useEffect(() => {
    if (!pendingAutoBuy) return
    const item = INVESTMENT_CATALOG.find((i) => i.id === pendingAutoBuy)
    if (item) {
      setActiveTab('invest')
      setBuyTarget(item)
    }
    clearAutoBuy()
  }, [pendingAutoBuy, clearAutoBuy])

  return (
    <div className="space-y-4 animate-screen-in">
      {/* Onglets */}
      <div className="flex gap-2 bg-slate-100 rounded-2xl p-1">
        <button
          onClick={() => setActiveTab('invest')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
            activeTab === 'invest'
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <TrendingUp size={16} /> Investir
        </button>
        <button
          onClick={() => setActiveTab('portfolio')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
            activeTab === 'portfolio'
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <Wallet size={16} /> Mon Portefeuille
          {game.investments.length > 0 && (
            <span className="bg-brand-100 text-brand-600 text-xs px-1.5 py-0.5 rounded-full font-bold">
              {game.investments.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'portfolio' ? (
        <Portfolio />
      ) : (
      <>
      <StockMarketWidget />

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

      <MarketplaceMap
        onBuy={(item) => setBuyTarget(item)}
        onInfo={(item) => setEduTarget(item)}
        onDeposit={(instanceId) => setDepositTarget(instanceId)}
        onShowCandidates={(search) => setComparisonSearch(search)}
      />

      {buyTarget && (
        <BuyModal item={buyTarget} onClose={() => setBuyTarget(null)} />
      )}
      {eduTarget && (
        <EduModal item={eduTarget} onClose={() => setEduTarget(null)} />
      )}
      {depositTarget && (
        <DepositModal instanceId={depositTarget} onClose={() => setDepositTarget(null)} />
      )}
      {comparisonSearch && (
        <PropertyComparisonModal
          search={comparisonSearch}
          onClose={() => setComparisonSearch(null)}
          onSelect={(candidate) => {
            setSelectedCandidate({ search: comparisonSearch, candidate })
            setComparisonSearch(null)
          }}
        />
      )}
      {selectedCandidate && (
        <CreditSimulationModal
          search={selectedCandidate.search}
          candidate={selectedCandidate.candidate}
          onClose={() => setSelectedCandidate(null)}
          onBack={() => {
            setComparisonSearch(selectedCandidate.search)
            setSelectedCandidate(null)
          }}
        />
      )}
      </>
      )}
    </div>
  )
}

// ============================================================================
// PropertyComparisonModal
// ============================================================================

function PropertyComparisonModal({
  search,
  onClose,
  onSelect,
}: {
  search: ImmoSearch
  onClose: () => void
  onSelect: (candidate: PropertyCandidate) => void
}) {
  const candidates = search.candidates ?? []
  const typeLabel = search.catalogId === 'parking' ? 'Parking' : search.catalogId === 'lmnp' ? 'LMNP' : 'Locatif Classique'

  const conditionColor = (c: PropertyCandidate['condition']) => {
    if (c === 'neuf') return 'text-emerald-600 bg-emerald-50'
    if (c === 'bon') return 'text-blue-600 bg-blue-50'
    return 'text-amber-600 bg-amber-50'
  }

  return (
    <Modal open onClose={onClose} title={`Biens disponibles — ${typeLabel}`} size="lg">
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          {candidates.length} biens trouvés lors de votre recherche. Sélectionnez celui qui vous convient.
        </p>
        <div className="grid gap-3">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              onClick={() => onSelect(candidate)}
              className="w-full text-left rounded-2xl border-2 border-slate-100 hover:border-brand-300 hover:shadow-md transition-all p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-display font-bold text-slate-800 mb-0.5">
                    {candidate.address}, {candidate.city}
                  </div>
                  <div className="text-xs text-slate-400 mb-2">
                    {candidate.squareMeters} m² · {candidate.propertyType}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-slate-400">Prix</div>
                      <div className="font-bold text-slate-800">{formatEuro(candidate.price)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Loyer brut</div>
                      <div className="font-bold text-slate-800">{formatEuro(candidate.monthlyRent)}/mois</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Rendement brut</div>
                      <div className="font-bold text-emerald-600">{formatPercent(candidate.grossYieldPct)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Rendement net</div>
                      <div className="font-bold text-emerald-700">{formatPercent(candidate.netYieldPct)}</div>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 space-y-1.5">
                  <span className={cn('block text-xs font-semibold px-2 py-0.5 rounded-full', conditionColor(candidate.condition))}>
                    {candidate.condition}
                  </span>
                  <span className="block text-xs text-slate-400 text-right">
                    Charges: {formatEuro(candidate.monthlyCharges)}/mois
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
        <Button variant="secondary" fullWidth onClick={onClose}>Annuler</Button>
      </div>
    </Modal>
  )
}

// ============================================================================
// CreditSimulationModal
// ============================================================================

const DOWN_PAYMENT_OPTIONS = [0.10, 0.20, 0.30, 0.50]
const TERM_OPTIONS = [10 * 12, 15 * 12, 20 * 12, 25 * 12]

function CreditSimulationModal({
  search,
  candidate,
  onClose,
  onBack,
}: {
  search: ImmoSearch
  candidate: PropertyCandidate
  onClose: () => void
  onBack: () => void
}) {
  const game = useGameStore((s) => s.game)!
  const selectPropertyAndBuy = useGameStore((s) => s.selectPropertyAndBuy)
  const [downPct, setDownPct] = useState(0.20)
  const [termMonths, setTermMonths] = useState(20 * 12)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const learned = game.player.learnedSkillIds || []
  let rateReduction = 0
  for (const skillId of learned) {
    const sk = SKILL_BY_ID[skillId]
    if (sk?.mortgageRateReduction) rateReduction += sk.mortgageRateReduction
  }
  const annualRate = Math.max(0.01, game.economy.interestRateBase + 0.005 - rateReduction)

  const price = candidate.price
  const downPayment = Math.round(price * downPct)
  const principal = price - downPayment
  const payment = useMemo(
    () => monthlyPaymentFor(principal, annualRate, termMonths),
    [principal, annualRate, termMonths]
  )
  const totalInterest = payment * termMonths - principal

  const monthlyIncome = game.player.salary + game.investments.reduce((s, i) => s + i.monthlyIncome, 0)
  const existingPayments = game.mortgages.reduce((s, m) => s + m.monthlyPayment, 0)
  const debtRatio = (existingPayments + payment) / Math.max(1, monthlyIncome)

  const amortRows = useMemo(
    () => buildAmortizationSchedule(principal, annualRate, termMonths, 6),
    [principal, annualRate, termMonths]
  )

  function handleConfirm() {
    const res = selectPropertyAndBuy(search.id, candidate.id, downPct, termMonths)
    setResult(res)
    if (res.success) setTimeout(onClose, 1600)
  }

  const debtColor = debtRatio > 0.35 ? 'text-red-600' : debtRatio > 0.25 ? 'text-amber-600' : 'text-emerald-600'

  return (
    <Modal open onClose={onClose} title="Simulation de crédit" size="lg">
      {result?.success ? (
        <div className="py-8 text-center animate-pop-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Check size={32} />
          </div>
          <p className="font-display font-bold text-slate-800">{result.message}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            &larr; Changer de bien
          </button>

          <div className="rounded-xl bg-slate-50 p-3">
            <div className="font-bold text-sm text-slate-700">{candidate.address}, {candidate.city}</div>
            <div className="text-xs text-slate-400">{candidate.squareMeters} m² · {candidate.propertyType} · {candidate.condition}</div>
            <div className="text-sm font-bold text-slate-800 mt-1">{formatEuro(price)}</div>
          </div>

          {/* Apport */}
          <div>
            <div className="text-sm font-semibold text-slate-600 mb-2">Apport personnel</div>
            <div className="flex gap-2">
              {DOWN_PAYMENT_OPTIONS.map((pct) => (
                <button
                  key={pct}
                  onClick={() => setDownPct(pct)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all',
                    downPct === pct
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-100 text-slate-500 hover:border-slate-300',
                  )}
                >
                  {Math.round(pct * 100)}%
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-400 mt-1 text-center">
              Apport : {formatEuro(downPayment)} · Emprunt : {formatEuro(principal)}
            </div>
          </div>

          {/* Durée */}
          <div>
            <div className="text-sm font-semibold text-slate-600 mb-2">Durée du crédit</div>
            <div className="flex gap-2">
              {TERM_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTermMonths(t)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all',
                    termMonths === t
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-100 text-slate-500 hover:border-slate-300',
                  )}
                >
                  {t / 12} ans
                </button>
              ))}
            </div>
          </div>

          {/* Résumé crédit */}
          <div className="rounded-2xl bg-slate-50 p-4 space-y-1.5 text-sm">
            <Row label="Taux annuel" value={formatPercent(annualRate)} />
            <Row label="Mensualité" value={formatEuro(Math.round(payment))} bold />
            <Row label="Coût total intérêts" value={formatEuro(Math.round(totalInterest))} />
            <div className="flex justify-between pt-1.5 border-t border-slate-200">
              <span className="text-slate-500">Taux d'endettement</span>
              <span className={cn('font-bold', debtColor)}>
                {Math.round(debtRatio * 100)}%
              </span>
            </div>
            {debtRatio > 0.35 && (
              <div className="text-xs text-red-600 bg-red-50 rounded-lg p-2 mt-1">
                Attention : taux d'endettement élevé ({Math.round(debtRatio * 100)}%), risque de refus bancaire.
              </div>
            )}
          </div>

          {/* Preview amortissement */}
          <div>
            <div className="text-sm font-semibold text-slate-600 mb-2">Premiers mois d'amortissement</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-left py-1 pr-2">Mois</th>
                    <th className="text-right py-1 pr-2">Mensualité</th>
                    <th className="text-right py-1 pr-2">Intérêts</th>
                    <th className="text-right py-1 pr-2">Capital</th>
                    <th className="text-right py-1">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {amortRows.map((row) => (
                    <tr key={row.month} className="border-b border-slate-50">
                      <td className="py-1 pr-2 text-slate-500">{row.month}</td>
                      <td className="py-1 pr-2 text-right font-mono text-slate-700">{formatEuro(row.payment)}</td>
                      <td className="py-1 pr-2 text-right font-mono text-red-500">{formatEuro(row.interest)}</td>
                      <td className="py-1 pr-2 text-right font-mono text-emerald-600">{formatEuro(row.principal)}</td>
                      <td className="py-1 text-right font-mono text-slate-600">{formatEuro(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {game.cashBalance < downPayment && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">
              Cash insuffisant. Disponible : {formatEuro(game.cashBalance)} · Requis : {formatEuro(downPayment)}
            </div>
          )}

          {result && !result.success && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{result.message}</div>
          )}

          <Button
            fullWidth
            size="lg"
            variant="gold"
            onClick={handleConfirm}
            disabled={game.cashBalance < downPayment}
          >
            Confirmer l'achat
          </Button>
        </div>
      )}
    </Modal>
  )
}

// ============================================================================
// EduModal
// ============================================================================

function EduModal({
  item,
  onClose,
}: {
  item: InvestmentCatalogItem
  onClose: () => void
}) {
  const edu = INVESTMENT_EDU[item.id]
  if (!edu) {
    return (
      <Modal open onClose={onClose} title={item.name} size="md">
        <div className="space-y-4">
          <div className={cn('rounded-2xl p-4 bg-gradient-to-br text-white', item.gradient)}>
            <p className="text-sm text-white/90">{item.description}</p>
          </div>
          <Button fullWidth variant="secondary" onClick={onClose}>Fermer</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title={item.name} size="md">
      <div className="space-y-4">
        <div className={cn('rounded-2xl p-4 bg-gradient-to-br text-white', item.gradient)}>
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Icon name={item.icon} size={22} />
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-tight">{item.shortName}</div>
              <div className="text-sm text-white/85">{edu.tagline}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-2.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wide">Rendement</div>
            <div className="font-display font-bold text-slate-800 text-sm">
              {item.returnVariance > 0 ? '~' : ''}{formatPercent(item.baseAnnualReturn)}/an
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wide">Risque</div>
            <div className="font-display font-bold text-slate-800 text-sm">{item.riskLevel}/5</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wide">Liquidité</div>
            <div className="font-display font-bold text-slate-800 text-sm">{item.liquidityLevel}/5</div>
          </div>
        </div>

        <EduSection emoji="⚙️" title="Comment ça marche" text={edu.howItWorks} tone="slate" />
        <EduSection emoji="✅" title="Quand l'utiliser" text={edu.whenToUse} tone="emerald" />
        <EduSection emoji="⚠️" title="À surveiller" text={edu.watchOut} tone="amber" />

        <div className="rounded-2xl bg-brand-50 border border-brand-100 p-3.5 text-sm text-brand-800">
          <span className="font-bold">💡 Exemple : </span>
          {edu.example}
        </div>

        <Button fullWidth variant="secondary" onClick={onClose}>
          J'ai compris
        </Button>
      </div>
    </Modal>
  )
}

function EduSection({
  emoji,
  title,
  text,
  tone,
}: {
  emoji: string
  title: string
  text: string
  tone: 'slate' | 'emerald' | 'amber'
}) {
  const toneClass = {
    slate: 'bg-slate-50 text-slate-600',
    emerald: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800',
  }[tone]
  return (
    <div className={cn('rounded-2xl p-3.5', toneClass)}>
      <div className="font-bold text-sm mb-1">
        {emoji} {title}
      </div>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  )
}

// ============================================================================
// PropertyOfferCard (legacy — BuyModal)
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
          {offer.city}
        </div>
      </div>
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
// BuyModal (legacy — pour non-immo et triggerAutoBuy)
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
        <div className="space-y-4">
          {item.isRealEstate && (
            <button
              onClick={() => setOfferStep('select')}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-2"
            >
              ← Changer de bien
            </button>
          )}

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

function DepositModal({ instanceId, onClose }: { instanceId: string; onClose: () => void }) {
  const game = useGameStore((s) => s.game)!
  const depositToInvestment = useGameStore((s) => s.depositToInvestment)
  const inv = game.investments.find((i) => i.instanceId === instanceId)
  const [amount, setAmount] = useState(() => {
    if (!inv) return 100
    const catalogItem = getCatalogItem(inv.catalogId)
    return Math.min(Math.round(game.cashBalance * 0.5), Math.max(catalogItem.minAmount, 100))
  })
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  if (!inv) return null
  const catalogItem = getCatalogItem(inv.catalogId)
  const maxDeposit = inv.catalogId === 'livret'
    ? Math.max(0, 22_950 - inv.currentValue)
    : game.cashBalance

  function handleDeposit() {
    const res = depositToInvestment(instanceId, amount)
    setResult(res)
    if (res.success) setTimeout(onClose, 1400)
  }

  return (
    <Modal open onClose={onClose} title={`Ajouter des fonds — ${inv.name}`} size="sm">
      {result?.success ? (
        <div className="py-8 text-center animate-pop-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Check size={32} />
          </div>
          <p className="font-display font-bold text-slate-800">{result.message}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={cn('rounded-2xl p-3 bg-gradient-to-br text-white', catalogItem.gradient)}>
            <div className="flex items-center gap-2">
              <Icon name={catalogItem.icon} size={16} />
              <span className="font-display font-bold text-sm">{inv.name}</span>
            </div>
            <div className="text-xs text-white/80 mt-0.5">
              Valeur actuelle : {formatEuro(Math.round(inv.currentValue))}
            </div>
          </div>

          <div>
            <label className="flex justify-between text-sm font-semibold text-slate-600 mb-1.5">
              <span>Montant à verser</span>
              <span className="text-brand-600">{formatEuro(amount)}</span>
            </label>
            <input
              type="range"
              min={10}
              max={Math.max(10, Math.min(game.cashBalance, maxDeposit))}
              step={catalogItem.minAmount >= 1000 ? 500 : 10}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>min 10 €</span>
              <span>dispo {formatEuroCompact(game.cashBalance)}</span>
            </div>
            <input
              type="number"
              value={amount}
              min={10}
              max={Math.min(game.cashBalance, maxDeposit)}
              onChange={(e) => setAmount(Number(e.target.value) || 10)}
              className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-brand-400 outline-none text-sm"
            />
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm space-y-1.5">
            <Row label="Valeur actuelle" value={formatEuro(Math.round(inv.currentValue))} />
            <Row label="Versement" value={`+${formatEuro(amount)}`} />
            <div className="flex justify-between pt-1.5 border-t border-slate-200">
              <span className="text-slate-500">Valeur après</span>
              <span className="font-display font-bold text-slate-800">{formatEuro(Math.round(inv.currentValue + amount))}</span>
            </div>
            {inv.catalogId === 'livret' && (
              <div className="text-xs text-slate-400">Plafond Livret A : 22 950 € (reste {formatEuro(Math.round(maxDeposit))})</div>
            )}
          </div>

          {result && !result.success && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{result.message}</div>
          )}

          <Button
            fullWidth
            size="lg"
            variant="gold"
            onClick={handleDeposit}
            disabled={amount < 10 || amount > game.cashBalance || amount > maxDeposit}
          >
            Verser {formatEuro(amount)}
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
