import { create } from 'zustand'
import type {
  BadgeId,
  DailyStreak,
  EarnedBadge,
  GameEvent,
  GameState,
  ImmoSearch,
  Investment,
  InvestmentCategory,
  JobProfile,
  LifeGoalId,
  MortgageQuote,
  OfflineGains,
  PrestigeRecord,
  Screen,
  SpeedMultiplier,
  StrategicStance,
  Toast,
} from '../types'
import { generateWeeklyChallenges, getCurrentWeekISO } from '../data/weeklyChallenges'
import { QUEST_CHAINS, QUEST_CHAIN_BY_ID } from '../data/questChains'
import type { QuestChainProgress, QuestStep } from '../types'
import { getCatalogItem } from '../data/investments'
import { advanceDays, checkRealTimeProgress, createInitialBehavior } from '../engine/gameLoop'
import { checkBadges, awardBadges } from '../engine/badges'
import {
  capitalGainsTax,
  getAVFiscalDetails,
} from '../engine/fiscal'
import {
  createInvestment,
  createMortgage,
  getMortgageQuote,
  monthlyPaymentFor,
} from '../engine/investments'
import { JOB_BY_ID } from '../data/jobs'
import { SKILL_BY_ID, AUTO_SKILLS } from '../data/skills'
import { GIG_BY_ID, GIG_COOLDOWN_MS } from '../data/gigs'
import { BUSINESS_DECISION_BY_ID, rollBusinessDecisionDelayMs } from '../data/businessDecisions'
import {
  calcMonthlyPassiveIncome,
  calcNetWorth,
  totalMortgagePayments,
} from '../utils/calculations'
import { IMMO_SEARCH_DURATIONS } from '../engine/immoEngine'
import { pickRandomFlash, generateFlashOpportunity } from '../data/flashOpportunities'
import { COST_MULTIPLIERS, TIER_SECS, TIER_LABELS } from '../data/upgradeTiers'

// ============================================================================
// Store principal : état du jeu + UI + boucle de temps + sauvegarde.
// ============================================================================

const SAVE_KEY = 'jeu-invest-save-v1'
const GAME_VERSION = 1
const TICK_MS = 100 // fréquence de la boucle
const MAX_CATCHUP_DAYS = 120 // jours max traités par tick (anti-freeze)
const OFFLINE_CAP_DAYS = 365 // progression offline max
const SAVE_INTERVAL_MS = 2500 // throttle sauvegarde

interface BuyResult {
  success: boolean
  message: string
}

interface GameStore {
  game: GameState | null
  screen: Screen
  selectedInvestmentId: string | null
  toasts: Toast[]
  isRunning: boolean
  pendingAutoBuy: InvestmentCategory | null

  // Cycle de vie
  createCharacter: (job: JobProfile, name: string, age: number, savings: number, ownsResidence: boolean, lifeGoalId?: LifeGoalId) => void
  startLoop: () => void
  stopLoop: () => void
  newGame: () => void
  loadGame: () => boolean
  saveGame: () => void

  // Contrôles temps
  setSpeed: (speed: SpeedMultiplier) => void
  togglePause: () => void

  // Navigation
  setScreen: (screen: Screen) => void
  selectInvestment: (id: string | null) => void

  // Investissements
  buyInvestment: (catalogId: InvestmentCategory, amount: number, useMortgage: boolean) => BuyResult
  sellInvestment: (instanceId: string) => BuyResult
  partialSellInvestment: (instanceId: string, sellAmount: number) => BuyResult
  getMortgageQuoteFor: (catalogId: InvestmentCategory, price: number) => MortgageQuote
  changeJob: (jobId: string) => { success: boolean; message: string }
  startSkillTraining: (skillId: string) => { success: boolean; message: string }

  // Événements
  resolveEvent: (eventId: string, actionIndex: number) => void
  markEventRead: (eventId: string) => void
  markAllEventsRead: () => void
  dismissToast: (id: string) => void
  dismissOnboarding: () => void
  reopenOnboarding: () => void

  // Tutoriel guidé & missions express
  triggerAutoBuy: (catalogId: InvestmentCategory) => void
  clearAutoBuy: () => void
  dismissTutorial: () => void
  claimGig: (gigId: string) => { success: boolean; message: string; reward?: number }

  // Gestion locataires
  selectTenant: (instanceId: string, profile: string, rentMultiplier: number, maintenanceFactor: number) => void

  // Décisions business
  resolveBusinessDecision: (instanceId: string, optionId: string) => { success: boolean; message: string }

  // Recherche immobilière
  startImmoSearch: (catalogId: 'parking' | 'lmnp' | 'immo_classique') => { success: boolean; message: string }
  dismissImmoSearch: (searchId: string) => void
  selectPropertyAndBuy: (searchId: string, candidateId: string, downPaymentPct: number, termMonths: number) => BuyResult

  // Remboursement anticipé
  earlyRepayMortgage: (mortgageId: string) => BuyResult

  // Revente
  listPropertyForSale: (instanceId: string, listingPrice: number) => void
  cancelSaleListing: (instanceId: string) => void
  respondToSaleOffer: (instanceId: string, offerId: string, accept: boolean) => BuyResult

  // Bilan trimestriel & point de bascule
  resolveQuarterlyReview: (stance: StrategicStance) => void
  dismissFreedom: () => void

  // Rétention — gains offline, badges, flash, streak
  collectOfflineGains: () => void
  dismissBadge: (id: BadgeId) => void
  claimFlashOpportunity: (id: string) => void
  prestige: () => void
  claimChallengeReward: (challengeId: string) => void
  claimComboBonus: () => void
  claimQuestStepReward: (chainId: string, stepIndex: number) => void
  dismissYearRecap: () => void
  upgradeInvestment: (instanceId: string) => { success: boolean; message: string }
  depositToInvestment: (instanceId: string, amount: number) => BuyResult
  renovateProperty: (instanceId: string) => BuyResult
}

// --- État de la boucle (hors store pour éviter les re-renders) ---
let intervalId: ReturnType<typeof setInterval> | null = null
let accumulator = 0
let lastTick = 0
let saveAccumulator = 0
let lastFlashGeneratedAt = 0
const FLASH_INTERVAL_MS = 12 * 60_000 // 12 min réelles entre chaque opportunité flash

function checkQuestCondition(step: QuestStep, game: GameState, passiveIncome: number, netWorth: number): boolean {
  switch (step.conditionType) {
    case 'net_worth':
      return netWorth >= step.conditionTarget
    case 'passive_income_monthly':
      return passiveIncome >= step.conditionTarget
    case 'n_investments':
      return game.investments.length >= step.conditionTarget
    case 'buy_real_estate':
      return game.investments.filter((i) => ['parking', 'lmnp', 'immo_classique'].includes(i.catalogId)).length >= step.conditionTarget
    case 'renovated_count':
      return game.investments.filter((i) => (i.propertyDetails?.renovationLevel ?? 0) >= 1).length >= step.conditionTarget
    case 'investment_class_count': {
      const classes = new Set(game.investments.map((i) => {
        if (['bourse_etf', 'crypto', 'or_metaux'].includes(i.catalogId)) return 'bourse'
        if (['parking', 'lmnp', 'immo_classique'].includes(i.catalogId)) return 'immo'
        if (['crowdfunding_immo', 'scpi', 'club_deal_immo'].includes(i.catalogId)) return 'crowd'
        if (i.catalogId === 'business') return 'business'
        return 'epargne'
      }))
      return classes.size >= step.conditionTarget
    }
  }
}

/** Met à jour le suivi comportemental après un achat (selon la phase de marché). */
function recordBuy(game: GameState): GameState['behavior'] {
  const b = game.behavior ?? createInitialBehavior()
  const phase = game.economy.marketPhase
  const mi = game.monthIndex ?? 0
  return {
    ...b,
    totalBuys: b.totalBuys + 1,
    lastBuyMonthIndex: mi,
    buysInBull: b.buysInBull + (phase === 'bull' ? 1 : 0),
    buysInBear: b.buysInBear + (phase === 'bear' ? 1 : 0),
    buysInCrash: b.buysInCrash + (phase === 'crash' ? 1 : 0),
    buysInNeutral: b.buysInNeutral + (phase === 'neutral' ? 1 : 0),
  }
}

/** Met à jour le suivi comportemental après une vente. */
function recordSell(game: GameState): GameState['behavior'] {
  const b = game.behavior ?? createInitialBehavior()
  return {
    ...b,
    totalSells: b.totalSells + 1,
    lastSellMonthIndex: game.monthIndex ?? 0,
  }
}

function createInitialState(
  job: JobProfile,
  name: string,
  age: number,
  savings: number,
  ownsResidence: boolean,
  lifeGoalId?: LifeGoalId,
  prestige?: PrestigeRecord,
): GameState {
  // Date de départ : 1er janvier d'une année "ronde".
  const startDate = new Date(Date.UTC(2025, 0, 1))
  const baseExpense = 750 + (job.monthlySalary * 0.08) // charges proportionnelles légères
  const rent = ownsResidence ? 0 : Math.round(450 + job.monthlySalary * 0.18)
  const extraCash = prestige?.heritageBonus.extraStartingCash ?? 0
  const salaryMult = 1 + (prestige?.heritageBonus.salaryBonusPct ?? 0)

  return {
    player: {
      name: name || 'Joueur',
      age,
      jobId: job.id,
      jobTitle: job.title,
      salary: Math.round(job.monthlySalary * salaryMult),
      ownsResidence,
      milestone: 'debutant',
      learnedSkillIds: [...AUTO_SKILLS],
      activeTraining: undefined,
      lifeGoalId,
      goalStartMonthIndex: 0,
      dependents: 0,
    },
    gameDateISO: startDate.toISOString(),
    lastRealTimestamp: Date.now(),
    speedMultiplier: 1,
    isPaused: false,
    cashBalance: savings + extraCash,
    investments: [],
    mortgages: [],
    events: [
      {
        id: 'evt_welcome',
        dateISO: startDate.toISOString(),
        category: 'personal',
        severity: 'info',
        title: 'Bienvenue dans ta nouvelle vie !',
        description: `Tu démarres comme ${job.title} avec ${savings} € d'épargne. Objectif : devenir rentier. Commence par le Livret A, puis débloque des placements plus ambitieux !`,
        financialImpact: 0,
        isRead: false,
        requiresAction: false,
        resolved: true,
      },
    ],
    economy: {
      marketPhase: 'neutral',
      phaseMonthsElapsed: 0,
      interestRateBase: 0.032,
      inflationRate: 0.02,
      realEstateIndex: 1,
      stockIndex: 100,
      stockIndexHistory: [
        { dateISO: startDate.toISOString(), value: 100, phase: 'neutral' },
      ],
    },
    stats: [],
    monthlyExpenses: {
      base: Math.round(baseExpense),
      rent,
      insurance: 60,
      total: Math.round(baseExpense) + rent + 60,
    },
    taxLiability: {
      year: 2025,
      flatTaxBase: 0,
      revenusFonciers: 0,
      bic: 0,
      lmnpNetTaxable: 0,
    },
    eventCooldowns: {},
    totalTaxPaid: 0,
    gameVersion: GAME_VERSION,
    immoSearches: [],
    monthIndex: 0,
    strategicStance: undefined,
    pendingReview: undefined,
    behavior: createInitialBehavior(),
    hasReachedFreedom: false,
    pendingFreedom: false,
    lastInflationCost: 0,
    streak: {
      currentStreak: 1,
      longestStreak: 1,
      lastLoginISO: new Date().toISOString().split('T')[0],
      shieldActive: false,
    },
    badges: [],
    pendingBadges: [],
    flashOpportunities: [],
    prestige: prestige,
    weeklyChallenges: generateWeeklyChallenges(savings + extraCash, 0),
    questProgress: QUEST_CHAINS.map((chain) => ({
      chainId: chain.id,
      nextStepIndex: 0,
      claimableStepIndex: undefined,
      claimedStepIndices: [] as number[],
    })),
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  screen: 'dashboard',
  selectedInvestmentId: null,
  toasts: [],
  isRunning: false,
  pendingAutoBuy: null,

  createCharacter: (job, name, age, savings, ownsResidence, lifeGoalId) => {
    const game = createInitialState(job, name, age, savings, ownsResidence, lifeGoalId)
    set({ game, screen: 'dashboard' })
    get().saveGame()
    get().startLoop()
  },

  startLoop: () => {
    if (intervalId) clearInterval(intervalId)
    lastTick = Date.now()
    accumulator = 0
    saveAccumulator = 0
    set({ isRunning: true })
    intervalId = setInterval(() => {
      const state = get()
      let game = state.game
      if (!game) {
        lastTick = Date.now()
        return
      }

      // Progression en temps RÉEL (formations, décisions business) : tourne
      // TOUJOURS, même en pause ou à vitesse ×1 — impossible à accélérer.
      const realCheck = checkRealTimeProgress(game)
      let pendingToasts: Toast[] = [...realCheck.toasts]
      if (realCheck.toasts.length > 0) {
        game = realCheck.state
      }

      if (game.isPaused) {
        lastTick = Date.now()
        if (pendingToasts.length > 0) {
          set((s) => ({ game, toasts: [...s.toasts, ...pendingToasts].slice(-5) }))
          get().saveGame()
        }
        return
      }

      const now = Date.now()
      const deltaMs = now - lastTick
      lastTick = now

      // 1 seconde réelle = 0,25 jour de jeu à ×1 (4 secondes par jour de jeu), scalé par la vitesse.
      accumulator += (deltaMs / 4000) * game.speedMultiplier
      let wholeDays = Math.floor(accumulator)
      if (wholeDays <= 0) {
        if (pendingToasts.length > 0) {
          set((s) => ({ game, toasts: [...s.toasts, ...pendingToasts].slice(-5) }))
        }
        return
      }
      accumulator -= wholeDays
      if (wholeDays > MAX_CATCHUP_DAYS) wholeDays = MAX_CATCHUP_DAYS

      const prevYear = new Date(game.gameDateISO).getUTCFullYear()
      const { state: rawGame, toasts } = advanceDays(game, wholeDays)
      const newYear = new Date(rawGame.gameDateISO).getUTCFullYear()

      // Badges gagnés pendant le tick
      const tickBadgeIds = checkBadges(rawGame)
      let newGame = tickBadgeIds.length > 0 ? awardBadges(rawGame, tickBadgeIds) : rawGame

      // Récap annuel au passage de l'année (uniquement si pas déjà un recap en attente)
      if (newYear !== prevYear && !newGame.pendingYearRecap) {
        const prevSnap = newGame.stats.length >= 13 ? newGame.stats[newGame.stats.length - 13] : newGame.stats[0]
        const lastSnap = newGame.stats.length > 0 ? newGame.stats[newGame.stats.length - 1] : null
        const nwStart = prevSnap?.netWorth ?? 0
        const nwEnd = lastSnap?.netWorth ?? calcNetWorth(newGame)
        const passiveStart = prevSnap?.passiveIncome ?? 0
        const passiveEnd = lastSnap?.passiveIncome ?? calcMonthlyPassiveIncome(newGame)
        newGame = {
          ...newGame,
          pendingYearRecap: {
            year: prevYear,
            netWorthStart: nwStart,
            netWorthEnd: nwEnd,
            passiveIncomeStart: passiveStart,
            passiveIncomeEnd: passiveEnd,
            totalTaxPaid: newGame.totalTaxPaid ?? 0,
            investmentCount: newGame.investments.length,
            milestone: newGame.player.milestone,
            gainPct: nwStart > 0 ? Math.round(((nwEnd - nwStart) / nwStart) * 1000) / 10 : 0,
          },
        }
      }

      // Update passive income & net worth challenges each tick
      const passiveNow = calcMonthlyPassiveIncome(newGame)
      const netWorthNow = calcNetWorth(newGame)
      const wcState = newGame.weeklyChallenges
      if (wcState) {
        const updatedCh = wcState.challenges.map((ch) => {
          if (ch.completed) return ch
          if (ch.id.startsWith('earn_passive_day') || ch.id.startsWith('passive_500') || ch.id.startsWith('passive_1000')) {
            const p = Math.min(ch.target, passiveNow)
            return { ...ch, progress: p, completed: p >= ch.target }
          }
          if (ch.id.startsWith('passive_ratio')) {
            const p = Math.min(ch.target, Math.round((passiveNow / (newGame.player.salary || 1)) * 100))
            return { ...ch, progress: p, completed: p >= ch.target }
          }
          if (ch.id.startsWith('reach_net_worth')) {
            const p = Math.min(ch.target, netWorthNow)
            return { ...ch, progress: p, completed: p >= ch.target }
          }
          if (ch.id.startsWith('hold_day')) {
            const lastSell = newGame.behavior?.lastSellMonthIndex ?? 0
            const currentMonth = newGame.monthIndex ?? 0
            const p = lastSell < currentMonth ? ch.target : 0
            return { ...ch, progress: p, completed: p >= ch.target }
          }
          if (ch.id.startsWith('three_investments') || ch.id.startsWith('five_investments')) {
            const p = Math.min(ch.target, newGame.investments.length)
            return { ...ch, progress: p, completed: p >= ch.target }
          }
          if (ch.id.startsWith('save_cash_buffer')) {
            const p = Math.min(ch.target, newGame.cashBalance)
            return { ...ch, progress: p, completed: p >= ch.target }
          }
          if (ch.id.startsWith('diversify_4classes')) {
            const classes = new Set(newGame.investments.map((i) => {
              if (['bourse_etf','crypto','or_metaux'].includes(i.catalogId)) return 'bourse'
              if (['parking','lmnp','immo_classique'].includes(i.catalogId)) return 'immo'
              if (['crowdfunding_immo','scpi','club_deal_immo'].includes(i.catalogId)) return 'crowd'
              if (i.catalogId === 'business') return 'business'
              return 'epargne'
            }))
            const p = Math.min(ch.target, classes.size)
            return { ...ch, progress: p, completed: p >= ch.target }
          }
          return ch
        })
        if (updatedCh.some((ch, i) => ch.progress !== wcState.challenges[i].progress || ch.completed !== wcState.challenges[i].completed)) {
          newGame = { ...newGame, weeklyChallenges: { ...wcState, challenges: updatedCh } }
        }
      }

      // Update quest chain progress each tick
      const qp = newGame.questProgress ?? []
      let qpChanged = false
      const updatedQp: QuestChainProgress[] = qp.map((progress) => {
        const chain = QUEST_CHAIN_BY_ID[progress.chainId]
        if (!chain) return progress
        if (progress.claimableStepIndex !== undefined) return progress
        const step = chain.steps[progress.nextStepIndex]
        if (!step) return progress
        const conditionMet = checkQuestCondition(step, newGame, passiveNow, netWorthNow)
        if (conditionMet) {
          qpChanged = true
          return { ...progress, claimableStepIndex: progress.nextStepIndex }
        }
        return progress
      })
      if (qpChanged) {
        newGame = { ...newGame, questProgress: updatedQp }
      }

      // Génération opportunités flash (12 min réelles entre chaque)
      const nowMs = Date.now()
      const hasActiveFlash = (newGame.flashOpportunities ?? []).some(
        (o) => !o.claimed && o.expiresAtReal > nowMs,
      )
      if (!hasActiveFlash && nowMs - lastFlashGeneratedAt > FLASH_INTERVAL_MS && Math.random() < 0.5) {
        const recentCatalogIds = (newGame.flashOpportunities ?? []).map((o) => o.catalogId)
        const template = pickRandomFlash(recentCatalogIds)
        const flash = generateFlashOpportunity(template)
        lastFlashGeneratedAt = nowMs
        newGame = {
          ...newGame,
          flashOpportunities: [
            ...(newGame.flashOpportunities ?? []).filter((o) => o.expiresAtReal > nowMs),
            flash,
          ],
        }
        // Toast discret pour signaler l'opportunité
        pendingToasts = [...pendingToasts, {
          id: `flash_${flash.id}`,
          title: `⚡ ${flash.label}`,
          description: `Expire dans ${Math.round((flash.expiresAtReal - nowMs) / 60_000)} min — consulte le Dashboard !`,
          severity: 'good' as const,
        }]
      }

      // Un bilan trimestriel ou un point de bascule impose une pause : on
      // force le joueur à s'arrêter et à réfléchir avant que le temps reprenne.
      const mustPause = !!newGame.pendingReview || !!newGame.pendingFreedom
      set((s) => ({
        game: mustPause ? { ...newGame, isPaused: true } : newGame,
        toasts: [...s.toasts, ...pendingToasts, ...toasts].slice(-5),
      }))

      // Sauvegarde throttlée.
      saveAccumulator += deltaMs
      if (saveAccumulator >= SAVE_INTERVAL_MS) {
        saveAccumulator = 0
        get().saveGame()
      }
    }, TICK_MS)
  },

  stopLoop: () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    set({ isRunning: false })
  },

  newGame: () => {
    get().stopLoop()
    localStorage.removeItem(SAVE_KEY)
    set({ game: null, screen: 'dashboard', toasts: [], selectedInvestmentId: null })
  },

  loadGame: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const saved = JSON.parse(raw) as GameState
      if (!saved.player) return false

      // Backward compat: initialize skills if missing
      if (!saved.player.learnedSkillIds) {
        saved.player.learnedSkillIds = [...AUTO_SKILLS]
      }

      // Backward compat : anciennes sauvegardes avec cooldowns/formation en date de jeu (ISO).
      if (saved.gigCooldowns) {
        const fixed: Record<string, number> = {}
        for (const [k, v] of Object.entries(saved.gigCooldowns)) {
          fixed[k] = typeof v === 'string' ? new Date(v).getTime() : v
        }
        saved.gigCooldowns = fixed
      }
      if (saved.player.activeTraining && !saved.player.activeTraining.startedAtReal) {
        saved.player.activeTraining = { ...saved.player.activeTraining, startedAtReal: Date.now() }
      }
      if (saved.player.activeTraining && saved.player.activeTraining.monthsCompleted === undefined) {
        saved.player.activeTraining = { ...saved.player.activeTraining, monthsCompleted: 0 }
      }
      saved.investments = saved.investments.map((inv) =>
        inv.businessDetails && inv.businessDetails.growthStage === undefined
          ? {
              ...inv,
              businessDetails: {
                ...inv.businessDetails,
                growthStage: 0,
                decisionAvailableAtReal: Date.now() + 12 * 3_600_000,
                decisionHistory: [],
              },
            }
          : inv,
      )

      // Backward compat : nouveaux champs optionnels
      if (!saved.immoSearches) saved.immoSearches = []
      if (saved.monthIndex === undefined) {
        // Estime le monthIndex depuis la date de jeu (départ jan 2025).
        const d = new Date(saved.gameDateISO)
        saved.monthIndex = Math.max(0, (d.getUTCFullYear() - 2025) * 12 + d.getUTCMonth())
      }
      if (!saved.behavior) saved.behavior = createInitialBehavior()
      if (saved.hasReachedFreedom === undefined) saved.hasReachedFreedom = false
      if (saved.player.dependents === undefined) saved.player.dependents = 0
      saved.pendingFreedom = false // ne pas ré-afficher au chargement
      saved.investments = saved.investments.map((inv) => {
        const cat = getCatalogItem(inv.catalogId)
        // Repair corrupted annualReturnRate: old code permanently wrote level bonuses
        // into the stored rate. Cap to catalog base + variance to sanitize.
        const maxLegitRate = cat.baseAnnualReturn + cat.returnVariance + 0.01
        return {
          ...inv,
          level: inv.level ?? 1,
          saleListingPrice: inv.saleListingPrice ?? undefined,
          pendingOffers: inv.pendingOffers ?? undefined,
          nextOfferAtReal: inv.nextOfferAtReal ?? undefined,
          annualReturnRate: inv.annualReturnRate > maxLegitRate ? cat.baseAnnualReturn : inv.annualReturnRate,
        }
      })

      // Backward compat : champs de rétention manquants
      if (!saved.badges) saved.badges = []
      if (!saved.pendingBadges) saved.pendingBadges = []
      if (!saved.flashOpportunities) saved.flashOpportunities = []
      saved.pendingOfflineGains = undefined // jamais ré-afficher au rechargement si déjà affiché

      // ── Streak quotidien ──────────────────────────────────────────────
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
      const savedStreak: DailyStreak = saved.streak ?? {
        currentStreak: 1, longestStreak: 1, lastLoginISO: yesterday, shieldActive: false,
      }
      let newStreak: DailyStreak
      let streakContinued = false
      let streakBroken = false
      const lastLogin = savedStreak.lastLoginISO

      if (lastLogin === today) {
        newStreak = savedStreak // même jour, rien ne change
      } else if (lastLogin === yesterday) {
        const next = savedStreak.currentStreak + 1
        newStreak = {
          currentStreak: next,
          longestStreak: Math.max(savedStreak.longestStreak, next),
          lastLoginISO: today,
          shieldActive: savedStreak.shieldActive,
          streakBonusActiveUntilReal: next >= 7 ? Date.now() + 4 * 3_600_000 : undefined,
        }
        streakContinued = true
      } else if (savedStreak.shieldActive) {
        // Le shield absorbe 1 jour manqué
        const next = savedStreak.currentStreak + 1
        newStreak = {
          currentStreak: next,
          longestStreak: Math.max(savedStreak.longestStreak, next),
          lastLoginISO: today,
          shieldActive: false,
          streakBonusActiveUntilReal: next >= 7 ? Date.now() + 4 * 3_600_000 : undefined,
        }
        streakContinued = true
      } else {
        newStreak = { currentStreak: 1, longestStreak: savedStreak.longestStreak, lastLoginISO: today, shieldActive: false }
        streakBroken = true
      }
      saved.streak = newStreak

      // Reset weekly challenges if new week
      const thisWeek = getCurrentWeekISO()
      if (!saved.weeklyChallenges || saved.weeklyChallenges.weekISO !== thisWeek) {
        saved.weeklyChallenges = generateWeeklyChallenges(
          calcNetWorth(saved),
          calcMonthlyPassiveIncome(saved),
          saved.player.salary,
        )
      }

      // Init quest progress for existing saves that don't have it
      if (!saved.questProgress) {
        saved.questProgress = QUEST_CHAINS.map((chain) => ({
          chainId: chain.id,
          nextStepIndex: 0,
          claimableStepIndex: undefined,
          claimedStepIndices: [] as number[],
        }))
      } else {
        // Add any new chains added after a previous save
        const existingChainIds = new Set(saved.questProgress.map((p) => p.chainId))
        const missingChains = QUEST_CHAINS.filter((c) => !existingChainIds.has(c.id))
        if (missingChains.length > 0) {
          saved.questProgress = [
            ...saved.questProgress,
            ...missingChains.map((chain) => ({
              chainId: chain.id,
              nextStepIndex: 0,
              claimableStepIndex: undefined,
              claimedStepIndices: [] as number[],
            })),
          ]
        }
      }

      // ── Progression offline ───────────────────────────────────────────
      const savedNetWorth = calcNetWorth(saved)
      const savedPassiveIncome = calcMonthlyPassiveIncome(saved)
      const elapsedMs = Date.now() - saved.lastRealTimestamp
      const offlineDays = Math.min(
        OFFLINE_CAP_DAYS,
        Math.floor((elapsedMs / 1000) * saved.speedMultiplier),
      )
      let game = saved
      let offlineToasts: Toast[] = []
      if (offlineDays > 0 && !saved.isPaused) {
        const result = advanceDays(saved, offlineDays)
        game = result.state
        offlineToasts = result.toasts.slice(-3)
      }
      // Rattrape les formations/décisions business débloquées pendant l'absence.
      const realCheck = checkRealTimeProgress(game)
      game = realCheck.state
      offlineToasts = [...offlineToasts, ...realCheck.toasts].slice(-3)

      // ── Badges gagnés pendant l'absence ──────────────────────────────
      const newBadgeIds = checkBadges(game)
      // Ajouter les badges streak
      if (newStreak.currentStreak >= 7 && !(game.badges ?? []).some((b) => b.id === 'streak_7')) newBadgeIds.push('streak_7')
      if (newStreak.currentStreak >= 30 && !(game.badges ?? []).some((b) => b.id === 'streak_30')) newBadgeIds.push('streak_30')
      if (newBadgeIds.length > 0) {
        const newEarned: EarnedBadge[] = newBadgeIds.map((id) => ({
          id, earnedAtISO: game.gameDateISO, earnedAtMonthIndex: game.monthIndex ?? 0,
        }))
        game = {
          ...game,
          badges: [...(game.badges ?? []), ...newEarned],
          pendingBadges: [...(game.pendingBadges ?? []), ...newBadgeIds],
        }
      }

      // ── Offline gains à révéler ───────────────────────────────────────
      const newNetWorth = calcNetWorth(game)
      if (offlineDays >= 1) {
        const elapsedMonths = offlineDays / 30
        const passiveIncomeEarned = Math.round(savedPassiveIncome * elapsedMonths)
        const offlineGains: OfflineGains = {
          daysElapsed: offlineDays,
          netWorthGain: Math.round(newNetWorth - savedNetWorth),
          cashGain: Math.round(game.cashBalance - saved.cashBalance),
          passiveIncomeEarned,
          streakContinued,
          streakBroken,
          newStreakCount: newStreak.currentStreak,
          newBadges: newBadgeIds,
          returnBonusPct: (newStreak.currentStreak >= 7 && streakContinued) ? 0.05 : 0,
        }
        game = { ...game, pendingOfflineGains: offlineGains }
      }

      set({ game, toasts: offlineToasts })
      get().startLoop()
      return true
    } catch (e) {
      console.error('Échec du chargement de la sauvegarde', e)
      return false
    }
  },

  saveGame: () => {
    const game = get().game
    if (!game) return
    try {
      const toSave: GameState = { ...game, lastRealTimestamp: Date.now() }
      localStorage.setItem(SAVE_KEY, JSON.stringify(toSave))
    } catch (e) {
      console.error('Échec de la sauvegarde', e)
    }
  },

  setSpeed: (speed) => {
    set((s) => (s.game ? { game: { ...s.game, speedMultiplier: speed } } : s))
    get().saveGame()
  },

  togglePause: () => {
    set((s) => (s.game ? { game: { ...s.game, isPaused: !s.game.isPaused } } : s))
    get().saveGame()
  },

  setScreen: (screen) => set({ screen }),
  selectInvestment: (id) => set({ selectedInvestmentId: id }),

  getMortgageQuoteFor: (_catalogId, price) => {
    const game = get().game!
    const monthlyIncome =
      game.player.salary + calcMonthlyPassiveIncome(game)
    const learned = game.player.learnedSkillIds || []
    let rateReduction = 0
    for (const skillId of learned) {
      const s = SKILL_BY_ID[skillId]
      if (s?.mortgageRateReduction) rateReduction += s.mortgageRateReduction
    }
    return getMortgageQuote(
      price,
      game.cashBalance,
      monthlyIncome,
      totalMortgagePayments(game),
      game.economy,
      20,
      rateReduction,
    )
  },

  changeJob: (jobId) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie.' }
    const newJob = JOB_BY_ID[jobId]
    if (!newJob) return { success: false, message: 'Poste introuvable.' }
    if (newJob.id === game.player.jobId) return { success: false, message: 'Tu occupes déjà ce poste.' }

    // Check required skills
    const requiredSkills = newJob.requiredSkillIds || []
    const learned = game.player.learnedSkillIds || []
    const missingSkills = requiredSkills.filter((id) => !learned.includes(id))
    if (missingSkills.length > 0) {
      const names = missingSkills.map((id) => SKILL_BY_ID[id]?.name ?? id).join(', ')
      return { success: false, message: `Compétences requises : ${names}` }
    }

    set((s) => ({
      game: {
        ...s.game!,
        player: {
          ...s.game!.player,
          jobId: newJob.id,
          jobTitle: newJob.title,
          salary: newJob.monthlySalary,
          jobChangeCooldownMonths: 0,
        },
      },
    }))
    get().saveGame()
    return { success: true, message: `Nouveau poste : ${newJob.title} — ${newJob.monthlySalary.toLocaleString('fr-FR')} €/mois.` }
  },

  startSkillTraining: (skillId) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie.' }

    const skill = SKILL_BY_ID[skillId]
    if (!skill) return { success: false, message: 'Compétence introuvable.' }

    const learned = game.player.learnedSkillIds || []
    if (learned.includes(skillId)) {
      return { success: false, message: 'Compétence déjà apprise.' }
    }
    if (game.player.activeTraining) {
      const current = SKILL_BY_ID[game.player.activeTraining.skillId]?.name
      return { success: false, message: `Formation en cours : ${current ?? game.player.activeTraining.skillId}. Termine-la d'abord.` }
    }

    // Vérifier prérequis
    for (const prereq of skill.prerequisiteIds) {
      if (!learned.includes(prereq)) {
        const prereqSkill = SKILL_BY_ID[prereq]
        return { success: false, message: `Prérequis manquant : ${prereqSkill?.name ?? prereq}` }
      }
    }

    // Vérifier patrimoine minimum
    if (skill.minNetWorth) {
      const nw = calcNetWorth(game)
      if (nw < skill.minNetWorth) {
        return { success: false, message: `Patrimoine insuffisant. Requis : ${skill.minNetWorth.toLocaleString('fr-FR')} €` }
      }
    }

    // Vérifier cash pour le coût
    if (skill.cost > 0 && game.cashBalance < skill.cost) {
      return { success: false, message: `Fonds insuffisants. Coût de la formation : ${skill.cost.toLocaleString('fr-FR')} €` }
    }

    // Si formation instantanée (0 mois), l'appliquer immédiatement
    if (skill.trainingMonths === 0) {
      const newSkills = [...learned, skill.id]
      set((s) => ({
        game: {
          ...s.game!,
          cashBalance: s.game!.cashBalance - skill.cost,
          player: {
            ...s.game!.player,
            learnedSkillIds: newSkills,
            activeTraining: undefined,
          },
        },
      }))
      get().saveGame()
      return { success: true, message: `Compétence obtenue immédiatement — ${skill.name}` }
    }

    set((s) => ({
      game: {
        ...s.game!,
        cashBalance: s.game!.cashBalance - skill.cost,
        player: {
          ...s.game!.player,
          activeTraining: {
            skillId,
            startDateISO: s.game!.gameDateISO,
            startedAtReal: Date.now(),
            monthsCompleted: 0,
          },
        },
      },
    }))
    get().saveGame()

    return { success: true, message: `Formation démarrée — ${skill.name}` }
  },

  buyInvestment: (catalogId, amount, useMortgage) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie en cours.' }

    const item = getCatalogItem(catalogId)

    // Un seul investissement par type (sauf immo = 3 max)
    const isRealEstate = ['parking', 'lmnp', 'immo_classique', 'club_deal_immo'].includes(catalogId)
    const maxInstances = isRealEstate ? 3 : 1
    const existingCount = game.investments.filter((i) => i.catalogId === catalogId).length
    if (existingCount >= maxInstances) {
      return {
        success: false,
        message: isRealEstate
          ? `Tu possèdes déjà ${maxInstances} biens de ce type.`
          : 'Tu possèdes déjà cet investissement. Monte-le en niveau depuis ton portefeuille.',
      }
    }

    const netWorth = calcNetWorth(game)

    if (netWorth < item.unlockThreshold) {
      return {
        success: false,
        message: `Patrimoine insuffisant. Il te faut ${item.unlockThreshold.toLocaleString('fr-FR')} € de patrimoine pour débloquer ${item.name}.`,
      }
    }
    if (amount < item.minAmount) {
      return {
        success: false,
        message: `Montant minimum : ${item.minAmount.toLocaleString('fr-FR')} €.`,
      }
    }

    // Vérifier la compétence requise
    if (item.skillRequired) {
      const learned = game.player.learnedSkillIds || []
      if (!learned.includes(item.skillRequired)) {
        const skillName = SKILL_BY_ID[item.skillRequired]?.name ?? item.skillRequired
        return { success: false, message: `Compétence requise : "${skillName}". Apprends-la dans l'onglet Compétences.` }
      }
    }

    // Cas immobilier avec crédit.
    if (useMortgage && item.canUseMortgage) {
      const quote = get().getMortgageQuoteFor(catalogId, amount)
      if (!quote.approved) {
        return { success: false, message: quote.reason }
      }
      const totalCashNeeded =
        quote.downPayment + (catalogId === 'lmnp' ? Math.max(4000, amount * 0.06) : 0)
      if (game.cashBalance < totalCashNeeded) {
        return {
          success: false,
          message: `Cash insuffisant. Il te faut ${Math.round(totalCashNeeded).toLocaleString('fr-FR')} € (apport + frais).`,
        }
      }
      // Pass amount (full property price) so createInvestment knows the real value
      const inv = { ...createInvestment(catalogId, quote.downPayment, game.gameDateISO, null, amount), level: 1 }
      const mortgage = createMortgage(inv.instanceId, quote)
      inv.mortgageId = mortgage.id
      const furnitureCost = inv.propertyDetails?.furnitureCost ?? 0

      set((s) => ({
        game: {
          ...s.game!,
          cashBalance: s.game!.cashBalance - quote.downPayment - furnitureCost,
          investments: [...s.game!.investments, inv],
          mortgages: [...s.game!.mortgages, mortgage],
          behavior: recordBuy(s.game!),
        },
      }))
      get().saveGame()
      return { success: true, message: `${item.name} acquis avec un crédit de ${Math.round(quote.principal).toLocaleString('fr-FR')} € !` }
    }

    // Achat comptant.
    const furnitureCost =
      catalogId === 'lmnp' ? Math.max(4000, Math.round(amount * 0.06)) : 0
    const totalNeeded = amount + furnitureCost
    if (game.cashBalance < totalNeeded) {
      return {
        success: false,
        message: `Cash insuffisant. Disponible : ${Math.round(game.cashBalance).toLocaleString('fr-FR')} €${furnitureCost ? ` (mobilier LMNP : +${furnitureCost} €)` : ''}.`,
      }
    }
    const inv = { ...createInvestment(catalogId, amount, game.gameDateISO, null), level: 1 }
    set((s) => {
      if (!s.game) return s
      let nextGame: GameState = {
        ...s.game,
        cashBalance: s.game.cashBalance - totalNeeded,
        investments: [...s.game.investments, inv],
        behavior: recordBuy(s.game),
      }
      const newInvs = nextGame.investments
      // Update weekly challenge progress
      const wc = nextGame.weeklyChallenges
      if (wc) {
        const updated = wc.challenges.map((ch) => {
          if (ch.completed) return ch
          let progress = ch.progress
          if (ch.id.startsWith('invest_day') || ch.id.startsWith('big_invest_day')) {
            progress = Math.min(ch.target, ch.progress + amount)
          } else if (ch.id.startsWith('buy_investments_day')) {
            progress = Math.min(ch.target, ch.progress + 1)
          } else if (ch.id.startsWith('diversify_2') || ch.id.startsWith('diversify_challenge') || ch.id.startsWith('diversify_4classes')) {
            const classes = new Set(newInvs.map((i: Investment) => {
              if (['bourse_etf','crypto','or_metaux'].includes(i.catalogId)) return 'bourse'
              if (['parking','lmnp','immo_classique'].includes(i.catalogId)) return 'immo'
              if (['crowdfunding_immo','scpi','club_deal_immo'].includes(i.catalogId)) return 'crowd'
              if (i.catalogId === 'business') return 'business'
              return 'epargne'
            }))
            progress = Math.min(ch.target, classes.size)
          } else if (ch.id.startsWith('invest_etf') && catalogId === 'bourse_etf') {
            progress = 1
          } else if (ch.id.startsWith('three_investments') || ch.id.startsWith('five_investments')) {
            progress = Math.min(ch.target, newInvs.length)
          }
          return { ...ch, progress, completed: progress >= ch.target }
        })
        nextGame = { ...nextGame, weeklyChallenges: { ...wc, challenges: updated } }
      }
      const newBadgeIds = checkBadges(nextGame)
      return { game: newBadgeIds.length > 0 ? awardBadges(nextGame, newBadgeIds) : nextGame }
    })
    get().saveGame()
    return { success: true, message: `${item.name} acquis pour ${amount.toLocaleString('fr-FR')} € !` }
  },

  sellInvestment: (instanceId) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie.' }
    const inv = game.investments.find((i) => i.instanceId === instanceId)
    if (!inv) return { success: false, message: 'Investissement introuvable.' }
    if (inv.isLocked) {
      return {
        success: false,
        message: `Bloqué jusqu'au ${inv.unlockDateISO ? new Date(inv.unlockDateISO).toLocaleDateString('fr-FR') : '...'}.`,
      }
    }

    const mortgage = inv.mortgageId
      ? game.mortgages.find((m) => m.id === inv.mortgageId)
      : null
    const debt = mortgage ? mortgage.outstandingBalance : 0
    const tax = capitalGainsTax(inv, game.gameDateISO)
    const proceeds = inv.currentValue - debt - tax

    if (proceeds < 0) {
      // Vente possible mais coûte de l'argent (dette > valeur) — rare.
    }

    set((s) => ({
      game: {
        ...s.game!,
        cashBalance: s.game!.cashBalance + proceeds,
        investments: s.game!.investments.filter((i) => i.instanceId !== instanceId),
        mortgages: s.game!.mortgages.filter((m) => m.id !== inv.mortgageId),
        behavior: recordSell(s.game!),
      },
      selectedInvestmentId: null,
    }))
    get().saveGame()
    return {
      success: true,
      message: `Vendu pour ${Math.round(proceeds).toLocaleString('fr-FR')} € net${tax > 0 ? ` (impôt : ${Math.round(tax).toLocaleString('fr-FR')} €)` : ''}.`,
    }
  },

  partialSellInvestment: (instanceId, sellAmount) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie.' }
    const inv = game.investments.find((i) => i.instanceId === instanceId)
    if (!inv) return { success: false, message: 'Investissement introuvable.' }
    if (inv.isLocked) {
      return {
        success: false,
        message: `Bloqué jusqu'au ${inv.unlockDateISO ? new Date(inv.unlockDateISO).toLocaleDateString('fr-FR') : '...'}.`,
      }
    }
    if (sellAmount <= 0) return { success: false, message: 'Montant invalide.' }
    // Full sale — déléguer à sellInvestment
    if (sellAmount >= inv.currentValue) return get().sellInvestment(instanceId)

    const fraction = sellAmount / inv.currentValue
    const gain = Math.max(0, inv.currentValue - inv.totalInvested)
    const gainPortion = fraction * gain
    const investedPortion = fraction * inv.totalInvested

    let tax = 0
    const item = getCatalogItem(inv.catalogId)
    if (inv.catalogId === 'assurance_vie') {
      const avDetails = getAVFiscalDetails(inv, game.gameDateISO)
      tax = Math.round(gainPortion * avDetails.taxRate)
    } else if (item.taxRegime !== 'exonere') {
      tax = Math.round(gainPortion * 0.3)
    }

    const net = Math.round(sellAmount - tax)

    set((s) => ({
      game: {
        ...s.game!,
        cashBalance: s.game!.cashBalance + net,
        investments: s.game!.investments.map((i) =>
          i.instanceId === instanceId
            ? {
                ...i,
                currentValue: Math.round((i.currentValue - sellAmount) * 100) / 100,
                totalInvested: Math.max(0, Math.round((i.totalInvested - investedPortion) * 100) / 100),
                realizedReturn: Math.round((i.realizedReturn ?? 0) + Math.max(0, gainPortion - tax)),
              }
            : i,
        ),
        behavior: recordSell(s.game!),
      },
    }))
    get().saveGame()
    return {
      success: true,
      message: `${Math.round(sellAmount).toLocaleString('fr-FR')} € cédés — net : ${net.toLocaleString('fr-FR')} €${tax > 0 ? ` (impôt : ${tax.toLocaleString('fr-FR')} €)` : ''}.`,
    }
  },

  resolveEvent: (eventId, actionIndex) => {
    const game = get().game
    if (!game) return
    const evt = game.events.find((e) => e.id === eventId)
    if (!evt || !evt.actionOptions) return
    const action = evt.actionOptions[actionIndex]
    if (!action) return

    let cashDelta = -action.cost
    let investments = game.investments

    // Effets d'action.
    if (action.effect === 'defer_repair') {
      cashDelta += evt.financialImpact * 1.5
    } else if (action.effect === 'pay_repair') {
      cashDelta += evt.financialImpact
    } else if (action.effect === 'business_neglect') {
      investments = investments.map((i) =>
        i.businessDetails
          ? { ...i, businessDetails: { ...i.businessDetails, monthlyRevenue: Math.round(i.businessDetails.monthlyRevenue * 0.8) } }
          : i,
      )
    } else if (action.effect === 'business_boost') {
      investments = investments.map((i) =>
        i.businessDetails
          ? { ...i, businessDetails: { ...i.businessDetails, monthlyRevenue: Math.round(i.businessDetails.monthlyRevenue * 1.15), attentionMonthsLeft: 5 } }
          : i,
      )
    } else if (action.effect === 'no_effect') {
      // Rien — résolution sans conséquence financière.
    } else if (action.effect === 'accept_severance') {
      // Indemnité = 4 mois de salaire
      cashDelta += game.player.salary * 4
    } else if (action.effect === 'sell_business') {
      // Vente du business : encaisse 1,5× la valeur actuelle
      const biz = investments.find((i) => i.businessDetails)
      if (biz) {
        cashDelta += Math.round(biz.currentValue * 1.5)
        investments = investments.filter((i) => i.instanceId !== biz.instanceId)
      }
    } else if (action.effect === 'speculative_big') {
      // 40% de chance de doubler, 60% de perdre 80%
      const win = Math.random() < 0.40
      cashDelta += win ? action.cost * 2 : -Math.round(action.cost * 0.8)
    } else if (action.effect === 'speculative_small') {
      // 50% de chance de ×1,6, 50% de perdre 50%
      const win = Math.random() < 0.50
      cashDelta += win ? Math.round(action.cost * 0.6) : -Math.round(action.cost * 0.5)
    } else if (action.effect === 'renegotiate_rent') {
      // Loyer baisse de 8% sur tous les biens immo loués
      investments = investments.map((i) =>
        i.propertyDetails && !i.propertyDetails.isVacant
          ? { ...i, propertyDetails: { ...i.propertyDetails, monthlyRent: Math.round(i.propertyDetails.monthlyRent * 0.92) } }
          : i,
      )
    } else if (action.effect === 'accept_vacancy') {
      // Locataire part : vacance de 2 mois sur un bien aléatoire
      const rentedProp = investments.find((i) => i.propertyDetails && !i.propertyDetails.isVacant)
      if (rentedProp) {
        investments = investments.map((i) =>
          i.instanceId === rentedProp.instanceId
            ? { ...i, propertyDetails: { ...i.propertyDetails!, isVacant: true, vacancyMonthsLeft: 2 } }
            : i,
        )
      }
    } else if (action.effect === 'buy_the_dip') {
      // Achat au creux : boost de 12% sur tous les ETF/bourse
      investments = investments.map((i) =>
        i.catalogId === 'bourse_etf'
          ? { ...i, currentValue: Math.round(i.currentValue * 1.12) }
          : i,
      )
    } else if (action.effect === 'panic_sell') {
      // Vente panique : -10% valeur ETF
      investments = investments.map((i) =>
        i.catalogId === 'bourse_etf'
          ? { ...i, currentValue: Math.round(i.currentValue * 0.90) }
          : i,
      )
    } else if (action.effect === 'invest_heritage') {
      cashDelta += 12000
    } else if (action.effect === 'half_heritage') {
      cashDelta += 6000
    } else if (action.effect === 'enjoy_heritage') {
      cashDelta += 3000
    } else if (action.effect === 'dpe_now') {
      // Isolation anticipée : boost loyer +6% + valeur +4% sur le premier bien immo
      const prop = investments.find((i) => i.propertyDetails)
      if (prop) {
        investments = investments.map((i) =>
          i.instanceId === prop.instanceId
            ? {
                ...i,
                currentValue: Math.round(i.currentValue * 1.04),
                propertyDetails: {
                  ...i.propertyDetails!,
                  monthlyRent: Math.round(i.propertyDetails!.monthlyRent * 1.06),
                  baseMonthlyRent: Math.round((i.propertyDetails!.baseMonthlyRent ?? i.propertyDetails!.monthlyRent) * 1.06),
                },
              }
            : i,
        )
      }
    } else if (action.effect === 'crypto_hodl') {
      // HODL crypto : valeur chute de 55% mais on tient
      investments = investments.map((i) =>
        i.catalogId === 'crypto'
          ? { ...i, currentValue: Math.round(i.currentValue * 0.45) }
          : i,
      )
    } else if (action.effect === 'crypto_sell_crash') {
      // Vente en catastrophe : -60% valeur mais on récupère le cash restant
      const cryptos = investments.filter((i) => i.catalogId === 'crypto')
      const crashedValue = cryptos.reduce((s, i) => s + Math.round(i.currentValue * 0.40), 0)
      cashDelta += crashedValue
      investments = investments.filter((i) => i.catalogId !== 'crypto')
    } else if (action.effect === 'crypto_hodl_halving') {
      // Halving — rien à faire, le jeu applique naturellement les gains
    }

    set((s) => ({
      game: {
        ...s.game!,
        cashBalance: s.game!.cashBalance + cashDelta,
        investments,
        events: s.game!.events.map((e) =>
          e.id === eventId ? { ...e, resolved: true, isRead: true } : e,
        ),
      },
    }))
    get().saveGame()
  },

  markEventRead: (eventId) => {
    set((s) =>
      s.game
        ? {
            game: {
              ...s.game,
              events: s.game.events.map((e) =>
                e.id === eventId ? { ...e, isRead: true } : e,
              ),
            },
          }
        : s,
    )
  },

  markAllEventsRead: () => {
    set((s) =>
      s.game
        ? {
            game: {
              ...s.game,
              events: s.game.events.map((e) => ({ ...e, isRead: true })),
            },
          }
        : s,
    )
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  dismissOnboarding: () => {
    set((s) => s.game ? { game: { ...s.game, hasSeenOnboarding: true } } : s)
    get().saveGame()
  },

  reopenOnboarding: () => {
    set((s) => s.game ? { game: { ...s.game, hasSeenOnboarding: false }, screen: 'dashboard' } : s)
    get().saveGame()
  },

  triggerAutoBuy: (catalogId) => set({ pendingAutoBuy: catalogId, screen: 'marketplace' }),

  clearAutoBuy: () => set({ pendingAutoBuy: null }),

  dismissTutorial: () => {
    set((s) => s.game ? { game: { ...s.game, tutorialDismissed: true } } : s)
    get().saveGame()
  },

  claimGig: (gigId) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie.' }
    const gig = GIG_BY_ID[gigId]
    if (!gig) return { success: false, message: 'Mission introuvable.' }

    const cooldowns = game.gigCooldowns || {}
    const now = Date.now()
    const availableAt = cooldowns[gigId] ?? 0
    if (now < availableAt) {
      const minutesLeft = Math.ceil((availableAt - now) / 60000)
      const label = minutesLeft >= 60 ? `${Math.ceil(minutesLeft / 60)} h` : `${minutesLeft} min`
      return { success: false, message: `Encore ${label} avant de pouvoir refaire cette mission.` }
    }

    const reward = Math.round(gig.minReward + Math.random() * (gig.maxReward - gig.minReward))
    const cooldownMs = GIG_COOLDOWN_MS[gigId] ?? gig.cooldownHours * 3_600_000

    set((s) => ({
      game: {
        ...s.game!,
        cashBalance: s.game!.cashBalance + reward,
        gigCooldowns: { ...(s.game!.gigCooldowns || {}), [gigId]: now + cooldownMs },
      },
    }))
    get().saveGame()
    return { success: true, message: `${gig.emoji} +${reward} € — ${gig.label} !`, reward }
  },

  resolveBusinessDecision: (instanceId, optionId) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie.' }
    const inv = game.investments.find((i) => i.instanceId === instanceId)
    if (!inv || !inv.businessDetails || !inv.businessDetails.pendingDecisionId) {
      return { success: false, message: 'Aucune décision en attente.' }
    }
    const decision = BUSINESS_DECISION_BY_ID[inv.businessDetails.pendingDecisionId]
    if (!decision) return { success: false, message: 'Décision introuvable.' }
    const option = decision.options.find((o) => o.id === optionId)
    if (!option) return { success: false, message: 'Option introuvable.' }
    if (option.cost > 0 && game.cashBalance < option.cost) {
      return { success: false, message: `Fonds insuffisants. Coût : ${option.cost.toLocaleString('fr-FR')} €` }
    }

    const failed = option.riskOfFailure ? Math.random() < option.riskOfFailure : false
    const biz = inv.businessDetails

    const newRevenue = failed && option.failureRevenueMultiplier !== undefined
      ? Math.round(biz.monthlyRevenue * option.failureRevenueMultiplier)
      : option.revenueMultiplier !== undefined
        ? Math.round(biz.monthlyRevenue * option.revenueMultiplier)
        : biz.monthlyRevenue
    const newCosts = option.costMultiplier !== undefined
      ? Math.round(biz.monthlyCosts * option.costMultiplier)
      : biz.monthlyCosts
    const newGrowthStage = (biz.growthStage ?? 0) + (!failed && option.growthStageDelta ? option.growthStageDelta : 0)

    const message = failed
      ? `${decision.emoji} Résultat décevant... le pari n'a pas payé.`
      : `${decision.emoji} Décision appliquée — ${option.label}.`

    set((s) => ({
      game: {
        ...s.game!,
        cashBalance: s.game!.cashBalance - option.cost,
        investments: s.game!.investments.map((i) =>
          i.instanceId === instanceId && i.businessDetails
            ? {
                ...i,
                businessDetails: {
                  ...i.businessDetails,
                  monthlyRevenue: Math.max(0, newRevenue),
                  monthlyCosts: Math.max(0, newCosts),
                  growthStage: newGrowthStage,
                  attentionMonthsLeft: 5,
                  pendingDecisionId: undefined,
                  decisionAvailableAtReal: Date.now() + rollBusinessDecisionDelayMs(newGrowthStage),
                  decisionHistory: [...(i.businessDetails.decisionHistory || []), decision.id].slice(-5),
                },
              }
            : i,
        ),
      },
    }))
    get().saveGame()
    return { success: true, message }
  },

  selectTenant: (instanceId, profile, rentMultiplier, maintenanceFactor) => {
    set((s) => ({
      game: {
        ...s.game!,
        investments: s.game!.investments.map((inv) => {
          if (inv.instanceId !== instanceId || !inv.propertyDetails) return inv
          const base = inv.propertyDetails.baseMonthlyRent ?? inv.propertyDetails.monthlyRent
          const baseMaintenance = Math.round(inv.currentValue * 0.008)
          return {
            ...inv,
            propertyDetails: {
              ...inv.propertyDetails,
              monthlyRent: Math.round(base * rentMultiplier),
              baseMonthlyRent: base,
              tenantProfile: profile,
              isVacant: false,
              vacancyMonthsLeft: 0,
              maintenanceCostYearly: Math.round(baseMaintenance * maintenanceFactor),
            },
          }
        }),
      },
    }))
    get().saveGame()
  },

  startImmoSearch: (catalogId) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie.' }

    const item = getCatalogItem(catalogId)
    const netWorth = calcNetWorth(game)
    if (netWorth < item.unlockThreshold) {
      return { success: false, message: `Patrimoine insuffisant. Requis : ${item.unlockThreshold.toLocaleString('fr-FR')} €` }
    }
    if (item.skillRequired) {
      const learned = game.player.learnedSkillIds || []
      if (!learned.includes(item.skillRequired)) {
        const skillName = SKILL_BY_ID[item.skillRequired]?.name ?? item.skillRequired
        return { success: false, message: `Compétence requise : "${skillName}".` }
      }
    }

    // Bloquer si une recherche existe déjà (en cours OU complétée non résolue)
    const existing = (game.immoSearches ?? []).find((s) => s.catalogId === catalogId)
    if (existing) {
      return existing.candidates
        ? { success: false, message: 'Des biens ont déjà été trouvés. Achetez ou écartez les résultats avant de relancer.' }
        : { success: false, message: 'Une recherche est déjà en cours pour ce type de bien.' }
    }

    const now = Date.now()
    const durations = IMMO_SEARCH_DURATIONS[catalogId]
    const search: ImmoSearch = {
      id: `search_${now}_${catalogId}`,
      catalogId,
      startedAtReal: now,
      financingReadyAtReal: now + durations.financing,
      propertyReadyAtReal: now + durations.property,
    }

    set((s) => ({
      game: {
        ...s.game!,
        immoSearches: [...(s.game!.immoSearches ?? []), search],
      },
    }))
    get().saveGame()
    return { success: true, message: `Recherche lancée pour ${item.name}. Résultats dans quelques heures.` }
  },

  dismissImmoSearch: (searchId) => {
    set((s) => ({
      game: s.game
        ? { ...s.game, immoSearches: (s.game.immoSearches ?? []).filter((sr) => sr.id !== searchId) }
        : s.game,
    }))
    get().saveGame()
  },

  selectPropertyAndBuy: (searchId, candidateId, downPaymentPct, termMonths) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie.' }

    const search = (game.immoSearches ?? []).find((s) => s.id === searchId)
    if (!search) return { success: false, message: 'Recherche introuvable.' }
    const candidate = search.candidates?.find((c) => c.id === candidateId)
    if (!candidate) return { success: false, message: 'Bien introuvable.' }

    const price = candidate.price
    const downPayment = Math.round(price * downPaymentPct)
    const principal = price - downPayment

    if (game.cashBalance < downPayment) {
      return { success: false, message: `Cash insuffisant. Il te faut ${downPayment.toLocaleString('fr-FR')} € d'apport.` }
    }

    const learned = game.player.learnedSkillIds || []
    let rateReduction = 0
    for (const skillId of learned) {
      const s = SKILL_BY_ID[skillId]
      if (s?.mortgageRateReduction) rateReduction += s.mortgageRateReduction
    }
    const annualRate = Math.max(0.01, game.economy.interestRateBase + 0.005 - rateReduction)
    const monthlyPayment = monthlyPaymentFor(principal, annualRate, termMonths)

    // Vérifier taux d'endettement
    const monthlyIncome = game.player.salary + calcMonthlyPassiveIncome(game)
    const existingPayments = totalMortgagePayments(game)
    const dti = (existingPayments + monthlyPayment) / Math.max(1, monthlyIncome)
    if (dti > 0.40) {
      return { success: false, message: `Taux d'endettement trop élevé (${Math.round(dti * 100)}%). Augmente l'apport ou réduis la durée.` }
    }

    // Créer l'investissement
    const catalogId = search.catalogId
    const inv = { ...createInvestment(catalogId, downPayment, game.gameDateISO, null, price), level: 1 }
    // Override details with candidate data
    if (inv.propertyDetails) {
      inv.propertyDetails.address = candidate.address
      inv.propertyDetails.city = candidate.city
      inv.propertyDetails.squareMeters = candidate.squareMeters
      inv.propertyDetails.monthlyRent = candidate.monthlyRent
      inv.propertyDetails.baseMonthlyRent = candidate.monthlyRent
      inv.propertyDetails.maintenanceCostYearly = Math.round(candidate.monthlyCharges * 12)
    }

    let mortgage = null
    let mortgageObj = null
    if (principal > 0) {
      const quote: MortgageQuote = {
        approved: true,
        reason: '',
        principal,
        downPayment,
        monthlyPayment,
        annualRate,
        termMonths,
        maxLoan: principal,
      }
      mortgageObj = createMortgage(inv.instanceId, quote)
      inv.mortgageId = mortgageObj.id
      mortgage = mortgageObj
    }

    const furnitureCost = catalogId === 'lmnp' ? Math.max(4000, Math.round(price * 0.06)) : 0
    const totalCash = downPayment + furnitureCost

    set((s) => ({
      game: {
        ...s.game!,
        cashBalance: s.game!.cashBalance - totalCash,
        investments: [...s.game!.investments, inv],
        mortgages: mortgage ? [...s.game!.mortgages, mortgage] : s.game!.mortgages,
        immoSearches: (s.game!.immoSearches ?? []).filter((sr) => sr.id !== searchId),
        behavior: recordBuy(s.game!),
      },
    }))
    get().saveGame()
    return { success: true, message: `${candidate.address}, ${candidate.city} acquis pour ${price.toLocaleString('fr-FR')} € !` }
  },

  resolveQuarterlyReview: (stance) => {
    set((s) =>
      s.game
        ? {
            game: {
              ...s.game,
              strategicStance: stance,
              pendingReview: undefined,
              isPaused: false,
            },
          }
        : s,
    )
    get().saveGame()
  },

  dismissFreedom: () => {
    set((s) =>
      s.game ? { game: { ...s.game, pendingFreedom: false, isPaused: false } } : s,
    )
    get().saveGame()
  },

  collectOfflineGains: () => {
    set((s) => s.game ? { game: { ...s.game, pendingOfflineGains: undefined } } : s)
    get().saveGame()
  },

  dismissBadge: (id) => {
    set((s) =>
      s.game
        ? { game: { ...s.game, pendingBadges: (s.game.pendingBadges ?? []).filter((b) => b !== id) } }
        : s,
    )
  },

  claimFlashOpportunity: (flashId) => {
    const game = get().game
    if (!game) return
    const opp = (game.flashOpportunities ?? []).find((o) => o.id === flashId)
    if (!opp || opp.claimed || opp.expiresAtReal < Date.now()) return
    if (game.cashBalance < opp.minAmount) return

    const catalog = getCatalogItem(opp.catalogId)
    const existingInv = game.investments.find((i) => i.catalogId === opp.catalogId)
    const bonusAmount = Math.round(opp.minAmount * opp.bonusPct)
    const invested = opp.minAmount
    const credited = invested + bonusAmount  // invested capital + immediate bonus yield

    set((s) => {
      if (!s.game) return s
      let newInvestments: Investment[]

      if (existingInv) {
        // Depot dans l'investissement existant avec rendement flash appliqué immédiatement
        newInvestments = s.game.investments.map((i) =>
          i.instanceId === existingInv.instanceId
            ? { ...i, currentValue: i.currentValue + credited, totalInvested: i.totalInvested + invested }
            : i,
        )
      } else {
        // Créer l'investissement avec la mise + le bonus en valeur initiale
        const newInv: Investment = {
          ...createInvestment(opp.catalogId, invested, s.game.gameDateISO, null),
          currentValue: credited,
          level: 1,
        }
        newInvestments = [...s.game.investments, newInv]
      }

      return {
        game: {
          ...s.game,
          cashBalance: s.game.cashBalance - invested,
          investments: newInvestments,
          flashOpportunities: (s.game.flashOpportunities ?? []).map((o) =>
            o.id === flashId ? { ...o, claimed: true } : o,
          ),
        },
        toasts: [
          ...s.toasts,
          {
            id: `flash_claimed_${flashId}`,
            title: '⚡ Opportunité saisie !',
            description: `${invested.toLocaleString('fr-FR')} € investis sur ${catalog.shortName} + ${bonusAmount.toLocaleString('fr-FR')} € de bonus offert !`,
            severity: 'good' as const,
          },
        ].slice(-5),
      }
    })
    get().saveGame()
  },

  prestige: () => {
    const { game } = get()
    if (!game) return
    const currentLevel = (game.prestige?.level ?? 0) + 1
    const bonusTable = [
      { extraStartingCash: 5000, returnBonusPct: 0.05, salaryBonusPct: 0, earlyUnlock: false },
      { extraStartingCash: 15000, returnBonusPct: 0.10, salaryBonusPct: 0.05, earlyUnlock: false },
      { extraStartingCash: 30000, returnBonusPct: 0.15, salaryBonusPct: 0.10, earlyUnlock: true },
      { extraStartingCash: 60000, returnBonusPct: 0.20, salaryBonusPct: 0.15, earlyUnlock: true },
      { extraStartingCash: 100000, returnBonusPct: 0.25, salaryBonusPct: 0.20, earlyUnlock: true },
    ]
    const bonusIdx = Math.min(currentLevel - 1, bonusTable.length - 1)
    const heritageBonus = bonusTable[bonusIdx]

    const newPrestige: PrestigeRecord = {
      level: currentLevel,
      heritageBonus,
      allTimeBadges: [
        ...(game.prestige?.allTimeBadges ?? []),
        ...(game.badges ?? []).filter(b => !(game.prestige?.allTimeBadges ?? []).some(ab => ab.id === b.id)),
      ],
      allTimeLongestStreak: Math.max(
        game.prestige?.allTimeLongestStreak ?? 0,
        game.streak?.longestStreak ?? 0,
      ),
      allTimeNetWorthPeak: Math.max(
        game.prestige?.allTimeNetWorthPeak ?? 0,
        calcNetWorth(game),
      ),
    }

    get().stopLoop()
    localStorage.removeItem(SAVE_KEY)

    const job = JOB_BY_ID[game.player.jobId] ?? Object.values(JOB_BY_ID)[0]
    const newGame = createInitialState(
      job,
      game.player.name,
      game.player.age,
      job.startingSavings,
      game.player.ownsResidence,
      game.player.lifeGoalId,
      newPrestige,
    )

    set({ game: newGame, screen: 'dashboard', toasts: [], selectedInvestmentId: null })
    get().saveGame()
    get().startLoop()
  },

  claimChallengeReward: (challengeId: string) => {
    set((s) => {
      if (!s.game?.weeklyChallenges) return s
      const wc = s.game.weeklyChallenges
      const ch = wc.challenges.find((c) => c.id === challengeId)
      if (!ch || !ch.completed) return s
      if (wc.claimedChallengeIds.includes(challengeId)) return s

      let game = s.game
      if (ch.rewardType === 'cash_bonus') {
        game = { ...game, cashBalance: game.cashBalance + ch.rewardValue }
      } else if (ch.rewardType === 'return_bonus') {
        game = {
          ...game,
          weeklyChallenges: {
            ...wc,
            bonusActiveUntilReal: Date.now() + 4 * 60 * 60 * 1000,
          },
        }
      }

      game = {
        ...game,
        weeklyChallenges: {
          ...(game.weeklyChallenges ?? wc),
          claimedChallengeIds: [...wc.claimedChallengeIds, challengeId],
        },
      }

      return { game }
    })
    get().saveGame()
  },

  claimComboBonus: () => {
    set((s) => {
      if (!s.game?.weeklyChallenges) return s
      const wc = s.game.weeklyChallenges
      if (wc.comboClaimed) return s
      if (!wc.challenges.every((c) => c.completed)) return s
      const netWorth = calcNetWorth(s.game)
      const comboBonus = Math.round(Math.max(2000, netWorth * 0.005))
      return {
        game: {
          ...s.game,
          cashBalance: s.game.cashBalance + comboBonus,
          weeklyChallenges: {
            ...wc,
            comboClaimed: true,
            bonusActiveUntilReal: Math.max(wc.bonusActiveUntilReal ?? 0, Date.now() + 8 * 60 * 60 * 1000),
          },
        },
      }
    })
    get().saveGame()
  },

  dismissYearRecap: () => {
    set((s) => s.game ? { game: { ...s.game, pendingYearRecap: undefined } } : s)
    get().saveGame()
  },

  claimQuestStepReward: (chainId: string, stepIndex: number) => {
    set((s) => {
      if (!s.game) return s
      const chain = QUEST_CHAIN_BY_ID[chainId]
      if (!chain) return s
      const qp = s.game.questProgress ?? []
      const progress = qp.find((p) => p.chainId === chainId)
      if (!progress || progress.claimableStepIndex !== stepIndex) return s
      const step = chain.steps[stepIndex]
      if (!step) return s
      const updatedQp: QuestChainProgress[] = qp.map((p) => {
        if (p.chainId !== chainId) return p
        return {
          ...p,
          nextStepIndex: stepIndex + 1,
          claimableStepIndex: undefined,
          claimedStepIndices: [...p.claimedStepIndices, stepIndex],
        }
      })
      return {
        game: {
          ...s.game,
          cashBalance: s.game.cashBalance + step.rewardCash,
          questProgress: updatedQp,
        },
      }
    })
    get().saveGame()
  },

  upgradeInvestment: (instanceId: string) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie.' }

    const inv = game.investments.find((i) => i.instanceId === instanceId)
    if (!inv) return { success: false, message: 'Investissement introuvable.' }
    if ((inv.level ?? 1) >= 5) return { success: false, message: 'Déjà au niveau maximum.' }
    if (inv.upgradeReadyAtReal) return { success: false, message: 'Mise à niveau déjà en cours.' }

    const targetLevel = (inv.level ?? 1) + 1
    const catalogItem = getCatalogItem(inv.catalogId)
    const cost = Math.round(catalogItem.minAmount * COST_MULTIPLIERS[targetLevel])

    if (game.cashBalance < cost) {
      return { success: false, message: `Il te faut ${cost.toLocaleString('fr-FR')} € pour monter au niveau ${targetLevel}.` }
    }

    const tierSecs = TIER_SECS[targetLevel]
    const completesAt = Date.now() + tierSecs * 1000

    set((s) => {
      if (!s.game) return s
      const wc = s.game.weeklyChallenges
      const updatedChallenges = wc
        ? wc.challenges.map((ch) => {
            if (ch.completed || !ch.id.startsWith('upgrade_investment')) return ch
            const p = 1
            return { ...ch, progress: p, completed: true }
          })
        : undefined
      return {
        game: {
          ...s.game,
          cashBalance: s.game.cashBalance - cost,
          investments: s.game.investments.map((i) =>
            i.instanceId === instanceId ? { ...i, upgradeReadyAtReal: completesAt } : i,
          ),
          weeklyChallenges: wc && updatedChallenges ? { ...wc, challenges: updatedChallenges } : wc,
        },
      }
    })
    get().saveGame()

    const tierLabel = TIER_LABELS[targetLevel]
    return { success: true, message: `Mise à niveau vers le palier ${targetLevel} lancée ! (${tierLabel})` }
  },

  depositToInvestment: (instanceId, amount) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie.' }

    const inv = game.investments.find((i) => i.instanceId === instanceId)
    if (!inv) return { success: false, message: 'Investissement introuvable.' }

    const catalogItem = getCatalogItem(inv.catalogId)
    if (catalogItem.isRealEstate) {
      return { success: false, message: 'Impossible d\'ajouter des fonds à un bien immobilier.' }
    }
    if (amount < 10) {
      return { success: false, message: 'Montant minimum : 10 €.' }
    }
    if (game.cashBalance < amount) {
      return { success: false, message: `Solde insuffisant (${game.cashBalance.toLocaleString('fr-FR')} €).` }
    }
    // Livret A : plafond légal 22 950 €
    if (inv.catalogId === 'livret' && inv.currentValue + amount > 22_950) {
      return {
        success: false,
        message: `Plafond Livret A atteint. Solde actuel : ${Math.round(inv.currentValue).toLocaleString('fr-FR')} € / 22 950 €.`,
      }
    }

    set((s) => ({
      game: {
        ...s.game!,
        cashBalance: s.game!.cashBalance - amount,
        investments: s.game!.investments.map((i) =>
          i.instanceId === instanceId
            ? { ...i, currentValue: i.currentValue + amount, totalInvested: i.totalInvested + amount }
            : i,
        ),
      },
    }))
    get().saveGame()
    return { success: true, message: `${amount.toLocaleString('fr-FR')} € versés dans ${inv.name}.` }
  },

  renovateProperty: (instanceId) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie.' }

    const inv = game.investments.find((i) => i.instanceId === instanceId)
    if (!inv?.propertyDetails) return { success: false, message: 'Bien introuvable.' }

    const prop = inv.propertyDetails
    const level = prop.renovationLevel ?? 0
    if (level >= 3) return { success: false, message: 'Ce bien est déjà au niveau de rénovation maximum (3/3).' }

    const monthsSinceLast = (game.monthIndex ?? 0) - (prop.lastRenovationMonthIndex ?? -999)
    if (prop.lastRenovationMonthIndex !== undefined && monthsSinceLast < 12) {
      return { success: false, message: `Attends encore ${12 - monthsSinceLast} mois avant la prochaine rénovation.` }
    }

    const cost = Math.max(3000, Math.round(inv.currentValue * 0.12))
    if (game.cashBalance < cost) {
      return { success: false, message: `Il te faut ${cost.toLocaleString('fr-FR')} € pour rénover ce bien.` }
    }

    const newRent = Math.round(prop.monthlyRent * 1.10)
    const newBase = Math.round((prop.baseMonthlyRent ?? prop.monthlyRent) * 1.10)
    const newValue = Math.round(inv.currentValue * 1.08)

    set((s) => ({
      game: {
        ...s.game!,
        cashBalance: s.game!.cashBalance - cost,
        investments: s.game!.investments.map((i) =>
          i.instanceId === instanceId
            ? {
                ...i,
                currentValue: newValue,
                propertyDetails: {
                  ...i.propertyDetails!,
                  monthlyRent: newRent,
                  baseMonthlyRent: newBase,
                  renovationLevel: level + 1,
                  lastRenovationMonthIndex: s.game!.monthIndex,
                },
              }
            : i,
        ),
      },
    }))
    get().saveGame()
    return { success: true, message: `Rénovation terminée ! Loyer +10 %, valeur +8 %.` }
  },

  earlyRepayMortgage: (mortgageId) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie.' }

    const mortgage = game.mortgages.find((m) => m.id === mortgageId)
    if (!mortgage) return { success: false, message: 'Crédit introuvable.' }

    const penalty = Math.round(mortgage.outstandingBalance * 0.02)
    const total = mortgage.outstandingBalance + penalty

    if (game.cashBalance < total) {
      return {
        success: false,
        message: `Cash insuffisant. Il te faut ${total.toLocaleString('fr-FR')} € (solde ${mortgage.outstandingBalance.toLocaleString('fr-FR')} € + pénalité ${penalty.toLocaleString('fr-FR')} €).`,
      }
    }

    set((s) => ({
      game: {
        ...s.game!,
        cashBalance: s.game!.cashBalance - total,
        mortgages: s.game!.mortgages.filter((m) => m.id !== mortgageId),
        investments: s.game!.investments.map((inv) =>
          inv.mortgageId === mortgageId ? { ...inv, mortgageId: null } : inv,
        ),
      },
    }))
    get().saveGame()
    return {
      success: true,
      message: `Crédit remboursé par anticipation. Pénalité : ${penalty.toLocaleString('fr-FR')} €. Total décaissé : ${total.toLocaleString('fr-FR')} €.`,
    }
  },

  listPropertyForSale: (instanceId, listingPrice) => {
    const now = Date.now()
    set((s) => ({
      game: {
        ...s.game!,
        investments: s.game!.investments.map((inv) =>
          inv.instanceId === instanceId
            ? {
                ...inv,
                saleListingPrice: listingPrice,
                pendingOffers: [],
                nextOfferAtReal: now + 4 * 3_600_000, // première offre dans 4h
              }
            : inv,
        ),
      },
    }))
    get().saveGame()
  },

  cancelSaleListing: (instanceId) => {
    set((s) => ({
      game: {
        ...s.game!,
        investments: s.game!.investments.map((inv) =>
          inv.instanceId === instanceId
            ? {
                ...inv,
                saleListingPrice: undefined,
                pendingOffers: undefined,
                nextOfferAtReal: undefined,
              }
            : inv,
        ),
      },
    }))
    get().saveGame()
  },

  respondToSaleOffer: (instanceId, offerId, accept) => {
    const game = get().game
    if (!game) return { success: false, message: 'Aucune partie.' }

    const inv = game.investments.find((i) => i.instanceId === instanceId)
    if (!inv) return { success: false, message: 'Investissement introuvable.' }

    const offer = (inv.pendingOffers ?? []).find((o) => o.id === offerId)
    if (!offer) return { success: false, message: 'Offre introuvable.' }

    if (accept) {
      const mortgage = inv.mortgageId
        ? game.mortgages.find((m) => m.id === inv.mortgageId)
        : null
      const mortgageBalance = mortgage ? mortgage.outstandingBalance : 0
      const proceeds = offer.offeredPrice - mortgageBalance

      set((s) => ({
        game: {
          ...s.game!,
          cashBalance: s.game!.cashBalance + proceeds,
          investments: s.game!.investments.filter((i) => i.instanceId !== instanceId),
          mortgages: s.game!.mortgages.filter((m) => m.id !== inv.mortgageId),
        },
      }))
      get().saveGame()
      return {
        success: true,
        message: `Bien vendu pour ${offer.offeredPrice.toLocaleString('fr-FR')} € ! Net perçu : ${Math.round(proceeds).toLocaleString('fr-FR')} €.`,
      }
    } else {
      // Refus : supprimer l'offre, programmer la prochaine dans 4h
      const now = Date.now()
      set((s) => ({
        game: {
          ...s.game!,
          investments: s.game!.investments.map((i) =>
            i.instanceId === instanceId
              ? {
                  ...i,
                  pendingOffers: (i.pendingOffers ?? []).filter((o) => o.id !== offerId),
                  nextOfferAtReal: now + 4 * 3_600_000,
                }
              : i,
          ),
        },
      }))
      get().saveGame()
      return { success: true, message: 'Offre refusée. Prochaine offre dans environ 4 heures.' }
    }
  },
}))

// Sélecteurs utilitaires (évitent de recalculer dans chaque composant).
export const selectUnreadCount = (s: GameStore): number =>
  s.game ? s.game.events.filter((e) => !e.isRead).length : 0

export const selectPendingAction = (s: GameStore): GameEvent | null =>
  s.game
    ? s.game.events.find((e) => e.requiresAction && !e.resolved) ?? null
    : null

export const selectCompletedChallenges = (s: GameStore): number =>
  s.game?.weeklyChallenges?.challenges.filter(c => c.completed && !s.game!.weeklyChallenges!.claimedChallengeIds.includes(c.id)).length ?? 0
