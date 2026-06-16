import { create } from 'zustand'
import type {
  GameEvent,
  GameState,
  InvestmentCategory,
  JobProfile,
  MortgageQuote,
  Screen,
  SpeedMultiplier,
  Toast,
} from '../types'
import { getCatalogItem } from '../data/investments'
import { advanceDays, checkRealTimeProgress } from '../engine/gameLoop'
import {
  capitalGainsTax,
} from '../engine/fiscal'
import {
  createInvestment,
  createMortgage,
  getMortgageQuote,
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
  createCharacter: (job: JobProfile, name: string, age: number, savings: number, ownsResidence: boolean) => void
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
  getMortgageQuoteFor: (catalogId: InvestmentCategory, price: number) => MortgageQuote
  changeJob: (jobId: string) => { success: boolean; message: string }
  startSkillTraining: (skillId: string) => { success: boolean; message: string }

  // Événements
  resolveEvent: (eventId: string, actionIndex: number) => void
  markEventRead: (eventId: string) => void
  markAllEventsRead: () => void
  dismissToast: (id: string) => void
  dismissOnboarding: () => void

  // Tutoriel guidé & missions express
  triggerAutoBuy: (catalogId: InvestmentCategory) => void
  clearAutoBuy: () => void
  dismissTutorial: () => void
  claimGig: (gigId: string) => { success: boolean; message: string; reward?: number }

  // Gestion locataires
  selectTenant: (instanceId: string, profile: string, rentMultiplier: number, maintenanceFactor: number) => void

  // Décisions business
  resolveBusinessDecision: (instanceId: string, optionId: string) => { success: boolean; message: string }
}

// --- État de la boucle (hors store pour éviter les re-renders) ---
let intervalId: ReturnType<typeof setInterval> | null = null
let accumulator = 0
let lastTick = 0
let saveAccumulator = 0

function createInitialState(
  job: JobProfile,
  name: string,
  age: number,
  savings: number,
  ownsResidence: boolean,
): GameState {
  // Date de départ : 1er janvier d'une année "ronde".
  const startDate = new Date(Date.UTC(2025, 0, 1))
  const baseExpense = 750 + (job.monthlySalary * 0.08) // charges proportionnelles légères
  const rent = ownsResidence ? 0 : Math.round(450 + job.monthlySalary * 0.18)

  return {
    player: {
      name: name || 'Joueur',
      age,
      jobId: job.id,
      jobTitle: job.title,
      salary: job.monthlySalary,
      ownsResidence,
      milestone: 'debutant',
      learnedSkillIds: [...AUTO_SKILLS],
      activeTraining: undefined,
    },
    gameDateISO: startDate.toISOString(),
    lastRealTimestamp: Date.now(),
    speedMultiplier: 1,
    isPaused: false,
    cashBalance: savings,
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
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  screen: 'dashboard',
  selectedInvestmentId: null,
  toasts: [],
  isRunning: false,
  pendingAutoBuy: null,

  createCharacter: (job, name, age, savings, ownsResidence) => {
    const game = createInitialState(job, name, age, savings, ownsResidence)
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
      let pendingToasts: Toast[] = realCheck.toasts
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

      const { state: newGame, toasts } = advanceDays(game, wholeDays)
      set((s) => ({
        game: newGame,
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

      // Progression offline : même moteur que le live.
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
      const inv = createInvestment(catalogId, quote.downPayment, game.gameDateISO, null, amount)
      const mortgage = createMortgage(inv.instanceId, quote)
      inv.mortgageId = mortgage.id
      const furnitureCost = inv.propertyDetails?.furnitureCost ?? 0

      set((s) => ({
        game: {
          ...s.game!,
          cashBalance: s.game!.cashBalance - quote.downPayment - furnitureCost,
          investments: [...s.game!.investments, inv],
          mortgages: [...s.game!.mortgages, mortgage],
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
    const inv = createInvestment(catalogId, amount, game.gameDateISO, null)
    set((s) => ({
      game: {
        ...s.game!,
        cashBalance: s.game!.cashBalance - totalNeeded,
        investments: [...s.game!.investments, inv],
      },
    }))
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
      },
      selectedInvestmentId: null,
    }))
    get().saveGame()
    return {
      success: true,
      message: `Vendu pour ${Math.round(proceeds).toLocaleString('fr-FR')} € net${tax > 0 ? ` (impôt : ${Math.round(tax).toLocaleString('fr-FR')} €)` : ''}.`,
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
      // Report : le coût (déjà dans financialImpact) est doublé plus tard, ici simplifié : +50%.
      cashDelta += evt.financialImpact * 1.5
    } else if (action.effect === 'pay_repair') {
      cashDelta += evt.financialImpact // financialImpact négatif = coût
    } else if (action.effect === 'business_neglect') {
      investments = investments.map((i) =>
        i.businessDetails
          ? {
              ...i,
              businessDetails: {
                ...i.businessDetails,
                monthlyRevenue: Math.round(i.businessDetails.monthlyRevenue * 0.8),
              },
            }
          : i,
      )
    } else if (action.effect === 'business_boost') {
      investments = investments.map((i) =>
        i.businessDetails
          ? {
              ...i,
              businessDetails: {
                ...i.businessDetails,
                monthlyRevenue: Math.round(i.businessDetails.monthlyRevenue * 1.15),
                attentionMonthsLeft: 5,
              },
            }
          : i,
      )
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
}))

// Sélecteurs utilitaires (évitent de recalculer dans chaque composant).
export const selectUnreadCount = (s: GameStore): number =>
  s.game ? s.game.events.filter((e) => !e.isRead).length : 0

export const selectPendingAction = (s: GameStore): GameEvent | null =>
  s.game
    ? s.game.events.find((e) => e.requiresAction && !e.resolved) ?? null
    : null
