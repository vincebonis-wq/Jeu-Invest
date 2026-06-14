import type { GameEvent, GameState, Investment, Toast } from '../types'
import {
  MAX_INDEX_HISTORY,
  dailyStockDrift,
  driftInterestRate,
  randRange,
  stepMarketPhase,
} from './economy'
import {
  applyDailyYield,
  applyMonthlyIncome,
  processMortgagePayment,
  pushValueHistory,
} from './investments'
import {
  createMilestoneEvent,
  createTaxEvent,
  randomVacancyMonths,
  rollMonthlyEvents,
} from './events'
import {
  MILESTONE_INFO,
  evaluateMilestone,
  milestoneRank,
} from '../utils/calculations'
import { FLAT_TAX_RATE } from './fiscal'

// ============================================================================
// Orchestrateur du temps de jeu.
// advanceDays() est la SEULE fonction de progression : utilisée en live ET
// pour la progression offline. Renvoie le nouvel état + les toasts à afficher.
// ============================================================================

export const MAX_STATS = 72 // 6 ans de snapshots
export const MAX_EVENTS = 120

export interface AdvanceResult {
  state: GameState
  toasts: Toast[]
}

let toastCounter = 0
function toast(
  title: string,
  description: string,
  severity: Toast['severity'],
): Toast {
  toastCounter += 1
  return { id: `toast_${Date.now()}_${toastCounter}`, title, description, severity }
}

/**
 * Avance le jeu de `days` jours. Cœur de la simulation.
 */
export function advanceDays(input: GameState, days: number): AdvanceResult {
  if (days <= 0) return { state: input, toasts: [] }

  // Travail sur une copie superficielle ; les tableaux sont remplacés au besoin.
  let state: GameState = { ...input }
  const toasts: Toast[] = []

  let gameDate = new Date(state.gameDateISO)
  let economy = { ...state.economy }
  let investments = state.investments
  let mortgages = state.mortgages
  let cash = state.cashBalance
  let events = state.events
  let stats = state.stats
  let player = { ...state.player }
  let monthlyExpenses = { ...state.monthlyExpenses }
  let taxLiability = { ...state.taxLiability }
  let eventCooldowns = { ...state.eventCooldowns }
  let totalTaxPaid = state.totalTaxPaid

  for (let d = 0; d < days; d++) {
    const prevMonth = gameDate.getUTCMonth()
    const prevYear = gameDate.getUTCFullYear()
    gameDate = new Date(gameDate)
    gameDate.setUTCDate(gameDate.getUTCDate() + 1)
    const newMonth = gameDate.getUTCMonth()
    const newYear = gameDate.getUTCFullYear()

    // --- TICK QUOTIDIEN ---
    // Indice boursier (graphique fluide).
    economy.stockIndex = economy.stockIndex * dailyStockDrift(economy.marketPhase)
    economy.stockIndexHistory = [
      ...economy.stockIndexHistory,
      {
        dateISO: gameDate.toISOString(),
        value: Math.round(economy.stockIndex * 100) / 100,
        phase: economy.marketPhase,
      },
    ]
    if (economy.stockIndexHistory.length > MAX_INDEX_HISTORY) {
      economy.stockIndexHistory = economy.stockIndexHistory.slice(-MAX_INDEX_HISTORY)
    }

    // Rendements quotidiens (croissance fluide du patrimoine).
    investments = investments.map((inv) => applyDailyYield(inv, economy))

    // --- FRONTIÈRE DE MOIS ---
    const monthChanged = newMonth !== prevMonth || newYear !== prevYear
    if (monthChanged) {
      const monthResult = processMonth({
        gameDate,
        player,
        economy,
        investments,
        mortgages,
        cash,
        events,
        eventCooldowns,
        taxLiability,
        monthlyExpenses,
        stats,
        totalTaxPaid,
      })
      player = monthResult.player
      economy = monthResult.economy
      investments = monthResult.investments
      mortgages = monthResult.mortgages
      cash = monthResult.cash
      events = monthResult.events
      eventCooldowns = monthResult.eventCooldowns
      taxLiability = monthResult.taxLiability
      monthlyExpenses = monthResult.monthlyExpenses
      stats = monthResult.stats
      totalTaxPaid = monthResult.totalTaxPaid
      toasts.push(...monthResult.toasts)

      // --- FRONTIÈRE D'ANNÉE ---
      if (newYear !== prevYear) {
        const yearResult = processYear({
          gameDate,
          player,
          cash,
          events,
          taxLiability,
          economy,
          totalTaxPaid,
        })
        player = yearResult.player
        cash = yearResult.cash
        events = yearResult.events
        taxLiability = yearResult.taxLiability
        economy = yearResult.economy
        totalTaxPaid = yearResult.totalTaxPaid
        toasts.push(...yearResult.toasts)
      }
    }
  }

  // Cap des événements.
  if (events.length > MAX_EVENTS) {
    events = events.slice(-MAX_EVENTS)
  }

  const newState: GameState = {
    ...state,
    gameDateISO: gameDate.toISOString(),
    player,
    economy,
    investments,
    mortgages,
    cashBalance: cash,
    events,
    stats,
    monthlyExpenses,
    taxLiability,
    eventCooldowns,
    totalTaxPaid,
    lastRealTimestamp: Date.now(),
  }

  // Détection de palier (après toute la progression du batch).
  const newMilestone = evaluateMilestone(newState)
  if (milestoneRank(newMilestone) > milestoneRank(newState.player.milestone)) {
    newState.player = { ...newState.player, milestone: newMilestone }
    const info = MILESTONE_INFO[newMilestone]
    newState.events = [
      ...newState.events,
      createMilestoneEvent(
        `Palier atteint : ${info.label} !`,
        info.description,
        newState.gameDateISO,
      ),
    ]
    toasts.push(toast(`🏆 ${info.label} !`, info.description, 'good'))
  }

  return { state: newState, toasts }
}

// ----------------------------------------------------------------------------
// Traitement mensuel
// ----------------------------------------------------------------------------

interface MonthContext {
  gameDate: Date
  player: GameState['player']
  economy: GameState['economy']
  investments: Investment[]
  mortgages: GameState['mortgages']
  cash: number
  events: GameEvent[]
  eventCooldowns: Record<string, number>
  taxLiability: GameState['taxLiability']
  monthlyExpenses: GameState['monthlyExpenses']
  stats: GameState['stats']
  totalTaxPaid: number
}

function processMonth(ctx: MonthContext) {
  const gameDateISO = ctx.gameDate.toISOString()
  let player = { ...ctx.player }
  let economy = { ...ctx.economy }
  let investments = ctx.investments
  let mortgages = ctx.mortgages
  let cash = ctx.cash
  let events = ctx.events
  let eventCooldowns = { ...ctx.eventCooldowns }
  let taxLiability = { ...ctx.taxLiability }
  const monthlyExpenses = { ...ctx.monthlyExpenses }
  let stats = ctx.stats
  let totalTaxPaid = ctx.totalTaxPaid
  const toasts: Toast[] = []

  // 1. Phase de marché.
  const phaseStep = stepMarketPhase(economy)
  if (phaseStep.changed) {
    economy.marketPhase = phaseStep.phase
    economy.phaseMonthsElapsed = phaseStep.phaseMonthsElapsed
    if (phaseStep.phase === 'crash') {
      toasts.push(
        toast('💥 Krach boursier !', 'Les marchés s\'effondrent. Tes actifs risqués chutent.', 'bad'),
      )
    } else if (phaseStep.phase === 'bull') {
      toasts.push(
        toast('📈 Marché haussier', 'L\'économie repart : tes placements profitent.', 'good'),
      )
    }
  } else {
    economy.phaseMonthsElapsed = phaseStep.phaseMonthsElapsed
  }
  economy.interestRateBase = driftInterestRate(economy.interestRateBase)

  // 2. Salaire.
  cash += player.salary

  // 3. Charges (avec inflation lissée).
  monthlyExpenses.base *= 1 + economy.inflationRate / 12
  monthlyExpenses.total =
    monthlyExpenses.base + monthlyExpenses.rent + monthlyExpenses.insurance
  cash -= monthlyExpenses.total

  // 4. Revenus mensuels des investissements.
  let monthlyTax = 0
  investments = investments.map((inv) => {
    const { investment, netCash, tax } = applyMonthlyIncome(inv, economy)
    cash += netCash
    monthlyTax += tax
    return investment
  })
  totalTaxPaid += monthlyTax
  taxLiability.flatTaxBase += monthlyTax / FLAT_TAX_RATE // approximation base

  // 5. Crédits immobiliers.
  let mortgagePaid = 0
  const survivingMortgages: typeof mortgages = []
  for (const m of mortgages) {
    cash -= m.monthlyPayment
    mortgagePaid += m.monthlyPayment
    const updated = processMortgagePayment(m)
    if (updated) {
      survivingMortgages.push(updated)
    } else {
      // Crédit soldé : on retire le lien sur l'investissement.
      investments = investments.map((inv) =>
        inv.mortgageId === m.id ? { ...inv, mortgageId: null } : inv,
      )
      toasts.push(
        toast('🎉 Crédit remboursé', 'Un de tes crédits immobiliers est totalement soldé !', 'good'),
      )
    }
  }
  mortgages = survivingMortgages

  // 6. Déblocage des investissements arrivés à échéance.
  investments = investments.map((inv) => {
    if (inv.isLocked && inv.unlockDateISO && new Date(inv.unlockDateISO) <= ctx.gameDate) {
      return { ...inv, isLocked: false }
    }
    return inv
  })

  // 7. Historique de valeur (sparklines).
  investments = investments.map(pushValueHistory)

  // 8. Décrément des cooldowns d'événements.
  for (const key of Object.keys(eventCooldowns)) {
    eventCooldowns[key] = Math.max(0, eventCooldowns[key] - 1)
  }

  // 8b. Décrément du cooldown de changement de poste.
  if (player.jobChangeCooldownMonths && player.jobChangeCooldownMonths > 0) {
    player = { ...player, jobChangeCooldownMonths: player.jobChangeCooldownMonths - 1 }
  }

  // 9. Événements aléatoires.
  const netWorthNow =
    cash + investments.reduce((s, i) => s + i.currentValue, 0) -
    mortgages.reduce((s, m) => s + m.outstandingBalance, 0)
  const rolled = rollMonthlyEvents(
    { ...createPseudoState(player, investments, mortgages, eventCooldowns) },
    netWorthNow,
    gameDateISO,
  )
  for (const evt of rolled) {
    // Applique effets structurels + impact cash.
    const applied = applyEventEffects(evt, {
      player,
      investments,
      cash,
    })
    player = applied.player
    investments = applied.investments
    cash = applied.cash
    if (evt.templateId) {
      const cd = templateCooldown(evt.templateId)
      if (cd) eventCooldowns[evt.templateId] = cd
    }
    events = [...events, evt]
    // Toast pour événements notables.
    if (evt.severity === 'bad' || evt.severity === 'good') {
      toasts.push(toast(evt.title, evt.description, evt.severity))
    }
  }

  // 10. Snapshot statistique.
  const passiveIncome = investments.reduce((s, i) => s + i.monthlyIncome, 0)
  const lockedValue = investments.filter(i => i.isLocked).reduce((s, i) => s + i.currentValue, 0)
  const unlockedValue = investments.filter(i => !i.isLocked).reduce((s, i) => s + i.currentValue, 0)
  stats = [
    ...stats,
    {
      dateISO: gameDateISO,
      netWorth: Math.round(netWorthNow),
      cash: Math.round(cash),
      lockedValue: Math.round(lockedValue),
      unlockedValue: Math.round(unlockedValue),
      passiveIncome: Math.round(passiveIncome),
      salary: Math.round(player.salary),
      expenses: Math.round(monthlyExpenses.total + mortgagePaid),
      tax: Math.round(monthlyTax),
    },
  ]
  if (stats.length > MAX_STATS) stats = stats.slice(-MAX_STATS)

  return {
    player,
    economy,
    investments,
    mortgages,
    cash,
    events,
    eventCooldowns,
    taxLiability,
    monthlyExpenses,
    stats,
    totalTaxPaid,
    toasts,
  }
}

// ----------------------------------------------------------------------------
// Traitement annuel
// ----------------------------------------------------------------------------

interface YearContext {
  gameDate: Date
  player: GameState['player']
  cash: number
  events: GameEvent[]
  taxLiability: GameState['taxLiability']
  economy: GameState['economy']
  totalTaxPaid: number
}

function processYear(ctx: YearContext) {
  let player = { ...ctx.player }
  let cash = ctx.cash
  let events = ctx.events
  const taxLiability = { ...ctx.taxLiability }
  const economy = ctx.economy
  let totalTaxPaid = ctx.totalTaxPaid
  const toasts: Toast[] = []

  // Vieillissement.
  player = { ...player, age: player.age + 1 }

  // Régularisation fiscale simplifiée : petit ajustement aléatoire
  // (l'essentiel de l'impôt est déjà prélevé à la source).
  const adjustment = Math.round(randRange(-800, 400))
  if (Math.abs(adjustment) > 50) {
    cash += adjustment
    totalTaxPaid -= Math.min(0, adjustment)
    events = [
      ...events,
      createTaxEvent(adjustment, ctx.gameDate.getUTCFullYear(), ctx.gameDate.toISOString()),
    ]
  }

  taxLiability.year = ctx.gameDate.getUTCFullYear()
  taxLiability.flatTaxBase = 0
  taxLiability.revenusFonciers = 0
  taxLiability.bic = 0
  taxLiability.lmnpNetTaxable = 0

  return { player, cash, events, taxLiability, economy, totalTaxPaid, toasts }
}

// ----------------------------------------------------------------------------
// Effets des événements
// ----------------------------------------------------------------------------

function applyEventEffects(
  evt: GameEvent,
  ctx: { player: GameState['player']; investments: Investment[]; cash: number },
) {
  let player = ctx.player
  let investments = ctx.investments
  let cash = ctx.cash

  // Impact cash direct.
  cash += evt.financialImpact

  switch (evt.templateId) {
    case 'promotion':
      player = { ...player, salary: Math.round(player.salary * 1.12) }
      break
    case 'raise':
      player = { ...player, salary: Math.round(player.salary * 1.04) }
      break
    case 'new_job':
      player = { ...player, salary: Math.round(player.salary * 1.08) }
      break
    case 'layoff':
      player = { ...player, salary: Math.round(player.salary * 0.65) }
      break
    case 'tenant_leaves': {
      // Met un bien aléatoire en vacance.
      const rentals = investments.filter(
        (i) => i.propertyDetails && !i.propertyDetails.isVacant && i.catalogId !== 'parking',
      )
      if (rentals.length > 0) {
        const target = rentals[Math.floor(Math.random() * rentals.length)]
        investments = investments.map((i) =>
          i.instanceId === target.instanceId && i.propertyDetails
            ? {
                ...i,
                propertyDetails: {
                  ...i.propertyDetails,
                  isVacant: true,
                  vacancyMonthsLeft: randomVacancyMonths(),
                },
              }
            : i,
        )
      }
      break
    }
    case 'rent_increase':
      investments = investments.map((i) =>
        i.propertyDetails
          ? {
              ...i,
              propertyDetails: {
                ...i.propertyDetails,
                monthlyRent: Math.round(i.propertyDetails.monthlyRent * 1.03),
              },
            }
          : i,
      )
      break
    case 'property_boom': {
      const realEstate = investments.filter((i) => i.propertyDetails)
      if (realEstate.length > 0) {
        const target = realEstate[Math.floor(Math.random() * realEstate.length)]
        investments = investments.map((i) =>
          i.instanceId === target.instanceId
            ? { ...i, currentValue: Math.round(i.currentValue * 1.08) }
            : i,
        )
      }
      break
    }
    case 'business_boost':
      investments = investments.map((i) =>
        i.businessDetails
          ? {
              ...i,
              businessDetails: {
                ...i.businessDetails,
                monthlyRevenue: Math.round(i.businessDetails.monthlyRevenue * 1.1),
                attentionMonthsLeft: 5,
              },
            }
          : i,
      )
      break
    default:
      break
  }

  return { player, investments, cash }
}

function templateCooldown(templateId: string): number {
  // importé paresseusement pour éviter dépendance circulaire
  const t = TEMPLATE_COOLDOWNS[templateId]
  return t ?? 0
}

// On copie les cooldowns depuis les templates au chargement du module.
import { EVENT_TEMPLATES } from '../data/events'
const TEMPLATE_COOLDOWNS: Record<string, number> = EVENT_TEMPLATES.reduce(
  (acc, t) => {
    if (t.cooldownMonths) acc[t.id] = t.cooldownMonths
    return acc
  },
  {} as Record<string, number>,
)

/** Construit un état partiel suffisant pour le filtrage des événements. */
function createPseudoState(
  player: GameState['player'],
  investments: Investment[],
  mortgages: GameState['mortgages'],
  eventCooldowns: Record<string, number>,
): GameState {
  return {
    player,
    investments,
    mortgages,
    eventCooldowns,
  } as GameState
}
