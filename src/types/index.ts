// ============================================================================
// Types centraux du jeu Patrimoine
// Tout le reste du code importe depuis ce fichier.
// Les dates de jeu sont stockées en ISO string (sérialisable dans localStorage).
// ============================================================================

// ----------------------------------------------------------------------------
// Joueur & progression
// ----------------------------------------------------------------------------

export type MilestoneLevel =
  | 'debutant'
  | 'epargnant' // patrimoine >= 10k
  | 'investisseur' // >= 50k
  | 'rentier_partiel' // >= 200k
  | 'rentier' // revenus passifs >= salaire
  | 'millionnaire' // >= 1M
  | 'multimillionnaire' // >= 5M

export interface PlayerProfile {
  name: string
  age: number // âge de jeu, +1 chaque année de jeu
  jobId: string
  jobTitle: string
  salary: number // salaire net mensuel
  ownsResidence: boolean // si vrai, pas de loyer
  milestone: MilestoneLevel
  jobChangeCooldownMonths?: number  // mois restants avant de pouvoir changer de poste
  learnedSkillIds: string[]         // compétences maîtrisées
  activeTraining?: ActiveTraining   // formation en cours
  lifeGoalId?: LifeGoalId           // rêve de vie choisi à la création
  goalStartMonthIndex?: number      // monthIndex au démarrage du compteur d'objectif
  dependents?: number               // nombre d'enfants à charge (impacte les charges)
}

// ----------------------------------------------------------------------------
// Objectifs de vie — donnent un sens et une deadline émotionnelle
// ----------------------------------------------------------------------------

export type LifeGoalId =
  | 'early_retirement'
  | 'kids_education'
  | 'beach_house'
  | 'family_legacy'

export interface LifeGoal {
  id: LifeGoalId
  title: string
  emoji: string
  tagline: string
  description: string
  targetNetWorth: number
  deadlineMonths: number // mois de jeu pour atteindre l'objectif
  successMessage: string
}

// ----------------------------------------------------------------------------
// Posture stratégique — choisie au bilan trimestriel
// ----------------------------------------------------------------------------

export type StrategicStance = 'secure' | 'growth' | 'income'

export interface QuarterlyReview {
  quarter: number       // 1-4
  year: number
  monthIndex: number
  netWorthDelta: number
  netWorthDeltaPct: number
  cashflow: number
  passiveIncome: number
  highlight: string     // fait marquant du trimestre
  inflationLost: number // cash grignoté par l'inflation ce trimestre
}

// ----------------------------------------------------------------------------
// Suivi comportemental — alimente le « miroir » du joueur
// ----------------------------------------------------------------------------

export interface BehaviorStats {
  buysInBull: number
  buysInBear: number
  buysInCrash: number
  buysInNeutral: number
  totalBuys: number
  totalSells: number
  lastSellMonthIndex: number
  lastBuyMonthIndex: number
  inflationLostTotal: number  // cumul du cash grignoté par l'inflation
}

export interface ReturnBonus {
  category: InvestmentCategory
  bonus: number
}

export interface GameSkill {
  id: string
  name: string
  category: 'professional' | 'financial' | 'entrepreneurial'
  tier: number             // 0-6, pour l'affichage en grille/arbre
  description: string
  prerequisiteIds: string[]
  trainingMonths: number   // flaveur narrative (durée "in-fiction")
  realDurationMs: number   // durée RÉELLE requise (horloge du joueur, indépendante de la vitesse de jeu)
  cost: number             // upfront €
  benefits: string[]       // human-readable
  unlocks?: InvestmentCategory[]
  salaryBonus?: number    // e.g. 0.12 = +12% salary
  expenseReduction?: number
  returnBonus?: ReturnBonus[]
  taxReduction?: number
  mortgageRateReduction?: number
  minNetWorth?: number
}

export interface ActiveTraining {
  skillId: string
  startDateISO: string    // date de jeu au moment du lancement (flaveur)
  startedAtReal: number   // conservé pour compatibilité historique
  monthsCompleted: number // mois de jeu écoulés depuis le début de la formation
}

// ----------------------------------------------------------------------------
// Investissements
// ----------------------------------------------------------------------------

export type InvestmentCategory =
  | 'livret'
  | 'assurance_vie'
  | 'obligations_etat'
  | 'bourse_etf'
  | 'or_metaux'
  | 'crowdfunding_immo'
  | 'scpi'
  | 'produit_structure'
  | 'business'
  | 'parking'
  | 'lmnp'
  | 'crypto'
  | 'immo_classique'
  | 'club_deal_immo'

export type TaxRegime =
  | 'exonere' // Livret A
  | 'flat_tax' // PFU 30%
  | 'lmnp' // BIC avec amortissement
  | 'revenus_fonciers'
  | 'bic'

/** Comment le rendement se matérialise. */
export type YieldMode =
  | 'compound' // la valeur grossit (ETF, assurance vie capitalisée)
  | 'income' // verse un revenu mensuel en cash (loyers, dividendes, livret)

/** Catégorie d'actif pour la répartition / fiscalité. */
export interface InvestmentCatalogItem {
  id: InvestmentCategory
  name: string
  shortName: string
  description: string
  minAmount: number
  unlockThreshold: number // patrimoine net requis pour l'achat
  riskLevel: 1 | 2 | 3 | 4 | 5
  liquidityLevel: 1 | 2 | 3 | 4 | 5
  baseAnnualReturn: number // ex: 0.015 pour 1,5%
  returnVariance: number // 0 = fixe, 0.08 = ±8%
  lockPeriodMonths: number | null
  taxRegime: TaxRegime
  yieldMode: YieldMode
  reactsToMarket: boolean // sensible aux phases bull/bear/crash
  isRealEstate: boolean
  canUseMortgage: boolean
  icon: string // nom d'icône lucide
  color: string // couleur hex pour graphiques/cartes
  gradient: string // classes tailwind pour le dégradé de carte
  purchaseCostPct: number  // transaction/notaire fees — baked into initial value loss
  skillRequired?: string   // skill ID required to unlock
}

export interface PropertyDetails {
  address: string
  city: string
  squareMeters: number
  furnitureCost: number // LMNP
  monthlyRent: number
  baseMonthlyRent?: number  // loyer de référence avant profil locataire
  tenantProfile?: string    // 'professional' | 'student' | 'family'
  tenantName?: string       // locataire nommé (attachement émotionnel)
  tenantStory?: string      // courte histoire du locataire
  tenantSinceMonthIndex?: number // depuis combien de mois il occupe le bien
  isVacant: boolean
  vacancyMonthsLeft: number
  maintenanceCostYearly: number
  depreciationBaseBuilding: number // LMNP : 70% du prix
}

export interface BusinessDetails {
  businessType: string
  monthlyRevenue: number
  monthlyCosts: number
  attentionMonthsLeft: number // si 0 → événement pénalité
  growthStage: number              // niveau de développement (0 = jeune pousse)
  pendingDecisionId?: string       // décision en attente de résolution
  decisionAvailableAtReal?: number // epoch ms réel — prochaine décision dispo
  decisionHistory?: string[]       // ids déjà résolus (anti-répétition)
}

// ----------------------------------------------------------------------------
// Décisions business — choix stratégiques périodiques (temps réel)
// ----------------------------------------------------------------------------

export interface BusinessDecisionOption {
  id: string
  label: string
  description: string
  cost: number                       // coût immédiat en cash (0 = gratuit)
  revenueMultiplier?: number         // appliqué à monthlyRevenue
  costMultiplier?: number            // appliqué à monthlyCosts
  growthStageDelta?: number          // évolution du stade de croissance
  riskOfFailure?: number             // 0-1 — probabilité d'un résultat négatif
  failureRevenueMultiplier?: number  // appliqué à la place si échec
}

export interface BusinessDecision {
  id: string
  emoji: string
  title: string
  prompt: string
  minGrowthStage: number
  options: BusinessDecisionOption[]
}

// ----------------------------------------------------------------------------
// Immobilier — recherche, candidats, offres de revente
// ----------------------------------------------------------------------------

export interface PropertyCandidate {
  id: string
  address: string
  city: string
  squareMeters: number
  price: number
  monthlyRent: number
  monthlyCharges: number
  grossYieldPct: number
  netYieldPct: number
  propertyType: 'studio' | 'T2' | 'T3' | 'T4' | 'maison' | 'parking' | 'box'
  condition: 'neuf' | 'bon' | 'à rénover'
}

export interface ImmoSearch {
  id: string
  catalogId: 'parking' | 'lmnp' | 'immo_classique'
  startedAtReal: number
  financingReadyAtReal: number
  propertyReadyAtReal: number
  candidates?: PropertyCandidate[]
}

export interface SaleOffer {
  id: string
  offeredPrice: number
  expiresAtReal: number
}

export interface Investment {
  instanceId: string
  catalogId: InvestmentCategory
  name: string
  purchaseDateISO: string
  purchasePrice: number // capital investi initial (hors crédit)
  totalInvested: number // capital propre cumulé
  currentValue: number // valeur de marché actuelle
  annualReturnRate: number // taux effectif courant
  monthlyIncome: number // revenu cash mensuel net (income mode)
  realizedReturn: number // gains déjà encaissés
  isLocked: boolean
  unlockDateISO: string | null
  mortgageId: string | null
  propertyDetails?: PropertyDetails
  businessDetails?: BusinessDetails
  valueHistory: number[] // derniers points de valeur (pour sparkline), cappé
  saleListingPrice?: number   // prix de mise en vente (si bien mis en vente)
  pendingOffers?: SaleOffer[] // offres NPC en attente
  nextOfferAtReal?: number    // epoch ms réel de la prochaine offre NPC
}

export interface Mortgage {
  id: string
  investmentId: string
  principal: number
  outstandingBalance: number
  annualRate: number
  monthlyPayment: number
  termMonths: number
  remainingMonths: number
}

// ----------------------------------------------------------------------------
// Économie & marché
// ----------------------------------------------------------------------------

export type MarketPhase = 'bull' | 'neutral' | 'bear' | 'crash'

export interface IndexPoint {
  dateISO: string
  value: number
  phase: MarketPhase
}

export interface EconomyState {
  marketPhase: MarketPhase
  phaseMonthsElapsed: number
  interestRateBase: number // taux crédit immo de base
  inflationRate: number // annuel
  realEstateIndex: number // multiplicateur valeur immo (départ 1.0)
  stockIndex: number // indice cumulé (départ 100)
  stockIndexHistory: IndexPoint[] // cappé
}

// ----------------------------------------------------------------------------
// Charges & fiscalité
// ----------------------------------------------------------------------------

export interface MonthlyExpenses {
  base: number
  rent: number
  insurance: number
  total: number
}

export interface TaxLiability {
  year: number
  flatTaxBase: number // gains soumis au PFU accumulés sur l'année
  revenusFonciers: number
  bic: number
  lmnpNetTaxable: number
}

// ----------------------------------------------------------------------------
// Événements
// ----------------------------------------------------------------------------

export type EventCategory =
  | 'market'
  | 'property'
  | 'job'
  | 'tax'
  | 'personal'
  | 'business'
  | 'milestone'

export type EventSeverity = 'info' | 'good' | 'warning' | 'bad'

export interface EventAction {
  label: string
  cost: number
  effect: string // identifiant d'effet traité par le moteur
}

export interface GameEvent {
  id: string
  templateId?: string // référence au template pour appliquer les effets
  dateISO: string
  category: EventCategory
  severity: EventSeverity
  title: string
  description: string
  financialImpact: number // appliqué au cash (négatif = coût)
  isRead: boolean
  requiresAction: boolean
  resolved: boolean
  actionOptions?: EventAction[]
}

export type EventConditionType =
  | 'hasCategory'
  | 'minNetWorth'
  | 'maxNetWorth'
  | 'hasRealEstate'
  | 'hasBusiness'
  | 'isEmployed'

export interface EventCondition {
  type: EventConditionType
  value: string | number
}

export interface EventTemplate {
  id: string
  category: EventCategory
  severity: EventSeverity
  title: string
  description: string
  monthlyProbability: number
  conditions: EventCondition[]
  impactRange: [number, number] // euros (peut être [0,0])
  impactIsPercentOfSalary?: boolean
  actionOptions?: EventAction[]
  cooldownMonths?: number
}

// ----------------------------------------------------------------------------
// Statistiques
// ----------------------------------------------------------------------------

export interface AssetBreakdown {
  cash: number
  livret: number
  assurance_vie: number
  obligations_etat: number
  bourse_etf: number
  or_metaux: number
  crowdfunding_immo: number
  scpi: number
  produit_structure: number
  business: number
  parking: number
  lmnp: number
  crypto: number
  immo_classique: number
  club_deal_immo: number
}

export interface StatsSnapshot {
  dateISO: string
  netWorth: number
  cash: number
  lockedValue?: number     // valeur des investissements bloqués
  unlockedValue?: number   // valeur des investissements disponibles
  passiveIncome: number
  salary: number
  expenses: number
  tax: number
}

// ----------------------------------------------------------------------------
// État global du jeu
// ----------------------------------------------------------------------------

export interface GameState {
  player: PlayerProfile
  gameDateISO: string
  lastRealTimestamp: number // ms epoch, pour progression offline
  speedMultiplier: SpeedMultiplier
  isPaused: boolean
  cashBalance: number
  investments: Investment[]
  mortgages: Mortgage[]
  events: GameEvent[]
  economy: EconomyState
  stats: StatsSnapshot[]
  monthlyExpenses: MonthlyExpenses
  taxLiability: TaxLiability
  eventCooldowns: Record<string, number> // templateId -> mois restants
  totalTaxPaid: number
  gameVersion: number
  hasSeenOnboarding?: boolean  // optional for backward compat
  tutorialDismissed?: boolean  // 1er pas guidé (Livret A) terminé/passé
  gigCooldowns?: Record<string, number> // gigId -> epoch ms réel de disponibilité
  immoSearches?: ImmoSearch[]  // recherches immobilières en cours
  monthIndex?: number          // nombre de mois de jeu écoulés depuis le début
  strategicStance?: StrategicStance // posture en cours (bilan trimestriel)
  pendingReview?: QuarterlyReview   // bilan trimestriel en attente de réponse
  behavior?: BehaviorStats          // suivi comportemental du joueur
  hasReachedFreedom?: boolean       // a déjà franchi le point de bascule
  pendingFreedom?: boolean          // célébration de bascule à afficher
  lastInflationCost?: number        // cash grignoté par l'inflation au dernier mois
  streak?: DailyStreak              // série de connexions quotidiennes
  badges?: EarnedBadge[]            // badges débloqués (persisté)
  pendingBadges?: BadgeId[]         // badges gagnés mais pas encore affichés
  pendingOfflineGains?: OfflineGains // gains offline à révéler au joueur
  flashOpportunities?: FlashOpportunity[] // opportunités flash en cours
}

export type SpeedMultiplier = 1 | 5 | 10 | 50

// ----------------------------------------------------------------------------
// Streak quotidien — rétention par habitude
// ----------------------------------------------------------------------------

export interface DailyStreak {
  currentStreak: number           // jours consécutifs
  longestStreak: number
  lastLoginISO: string            // date ISO (YYYY-MM-DD) du dernier login
  shieldActive: boolean           // protection 1 jour manqué
  streakBonusActiveUntilReal?: number // epoch ms — boost de rendement actif
}

// ----------------------------------------------------------------------------
// Badges / trophées
// ----------------------------------------------------------------------------

export type BadgeId =
  | 'first_investment'
  | 'speed_investor'
  | 'livret_full'
  | 'first_etf'
  | 'first_real_estate'
  | 'first_business'
  | 'diversified_4'
  | 'survived_crash'
  | 'crypto_survivor'
  | 'passive_income_500'
  | 'passive_income_salary'
  | 'net_worth_10k'
  | 'net_worth_50k'
  | 'net_worth_100k'
  | 'net_worth_500k'
  | 'millionnaire'
  | 'no_debt'
  | 'streak_7'
  | 'streak_30'
  | 'buy_in_crash'

export interface Badge {
  id: BadgeId
  name: string
  emoji: string
  description: string
  category: 'milestone' | 'behavior' | 'market' | 'special'
}

export interface EarnedBadge {
  id: BadgeId
  earnedAtISO: string
  earnedAtMonthIndex: number
}

// ----------------------------------------------------------------------------
// Gains offline révélés au retour du joueur
// ----------------------------------------------------------------------------

export interface OfflineGains {
  daysElapsed: number
  netWorthGain: number
  cashGain: number
  passiveIncomeEarned: number
  streakContinued: boolean
  streakBroken: boolean
  newStreakCount: number
  newBadges: BadgeId[]
  returnBonusPct: number    // 0 ou % si bonus de série actif
}

// ----------------------------------------------------------------------------
// Opportunités flash — expirent en temps réel
// ----------------------------------------------------------------------------

export interface FlashOpportunity {
  id: string
  catalogId: InvestmentCategory
  label: string
  description: string
  bonusPct: number            // bonus de rendement (ex: 0.02 = +2 %)
  minAmount: number
  expiresAtReal: number       // epoch ms
  claimed: boolean
}

// ----------------------------------------------------------------------------
// UI / navigation
// ----------------------------------------------------------------------------

export type Screen =
  | 'dashboard'
  | 'portfolio'
  | 'marketplace'
  | 'properties'
  | 'events'
  | 'stats'
  | 'job'
  | 'skills'

export interface Toast {
  id: string
  title: string
  description: string
  severity: EventSeverity
}

export interface MortgageQuote {
  approved: boolean
  reason: string
  principal: number
  downPayment: number
  monthlyPayment: number
  annualRate: number
  termMonths: number
  maxLoan: number
}

// ----------------------------------------------------------------------------
// Métiers (création de personnage)
// ----------------------------------------------------------------------------

export interface JobProfile {
  id: string
  title: string
  monthlySalary: number
  startingSavings: number
  savingsMin: number
  savingsMax: number
  startingAge: number
  description: string
  icon: string
  color: string
  requiredSkillIds: string[]
}
