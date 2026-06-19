import type { GameEvent, GameState, Investment, SaleOffer, Toast } from '../types'
import { getLevelReturnBonus } from '../data/upgradeTiers'
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
  calcMonthlyPassiveIncome,
  evaluateMilestone,
  milestoneRank,
} from '../utils/calculations'
import { analyzeDiversification } from '../utils/strategy'
import { FLAT_TAX_RATE } from './fiscal'
import { SKILL_BY_ID } from '../data/skills'
import { getCatalogItem } from '../data/investments'
import { pickBusinessDecision } from '../data/businessDecisions'
import { generatePropertyCandidates } from './immoEngine'

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
  let monthIndex = state.monthIndex ?? 0
  let behavior = state.behavior ?? createInitialBehavior()
  let pendingReview = state.pendingReview
  let lastInflationCost = state.lastInflationCost ?? 0

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
    const prestigeReturnBonus = state.prestige?.heritageBonus.returnBonusPct ?? 0
    investments = investments.map((inv) => {
      const levelBonus = getLevelReturnBonus(inv.level ?? 1)
      const boostedInv = (levelBonus > 0 || prestigeReturnBonus > 0)
        ? { ...inv, annualReturnRate: inv.annualReturnRate * (1 + levelBonus + prestigeReturnBonus) }
        : inv
      return applyDailyYield(boostedInv, economy, state.strategicStance)
    })

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
        monthIndex,
        stance: state.strategicStance,
        behavior,
        pendingReview,
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
      monthIndex = monthResult.monthIndex
      behavior = monthResult.behavior
      pendingReview = monthResult.pendingReview
      lastInflationCost = monthResult.lastInflationCost
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
    monthIndex,
    behavior,
    pendingReview,
    lastInflationCost,
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

  // Point de bascule : revenus passifs >= charges pour la première fois.
  const passiveNow = calcMonthlyPassiveIncome(newState)
  if (
    !newState.hasReachedFreedom &&
    passiveNow > 0 &&
    passiveNow >= newState.monthlyExpenses.total
  ) {
    newState.hasReachedFreedom = true
    newState.pendingFreedom = true
    newState.events = [
      ...newState.events,
      {
        id: `freedom_${Date.now()}`,
        dateISO: newState.gameDateISO,
        category: 'milestone',
        severity: 'good',
        title: '🕊️ Indépendance financière atteinte !',
        description:
          'Tes revenus passifs couvrent désormais toutes tes charges. Travailler devient un choix, plus une nécessité.',
        financialImpact: 0,
        isRead: false,
        requiresAction: false,
        resolved: true,
      },
    ]
  }

  return { state: newState, toasts }
}

export function createInitialBehavior(): import('../types').BehaviorStats {
  return {
    buysInBull: 0,
    buysInBear: 0,
    buysInCrash: 0,
    buysInNeutral: 0,
    totalBuys: 0,
    totalSells: 0,
    lastSellMonthIndex: 0,
    lastBuyMonthIndex: 0,
    inflationLostTotal: 0,
  }
}

/**
 * Vérifie la progression liée au temps RÉEL (horloge du joueur) :
 * complétion de formation, apparition de nouvelles décisions business.
 * Totalement indépendant de `advanceDays` / de la vitesse de jeu / de la pause —
 * appelé à chaque tick de la boucle pour empêcher tout contournement par la vitesse.
 */
export function checkRealTimeProgress(input: GameState): AdvanceResult {
  let state = input
  const toasts: Toast[] = []
  const now = Date.now()

  // --- Formation en cours ---
  if (state.player.activeTraining) {
    const training = state.player.activeTraining
    const skill = SKILL_BY_ID[training.skillId]
    const monthsDone = training.monthsCompleted ?? 0
    if (skill && monthsDone >= skill.trainingMonths) {
      const newSkills = [...(state.player.learnedSkillIds || []), skill.id]
      let player = { ...state.player, learnedSkillIds: newSkills, activeTraining: undefined }
      const monthlyExpenses = { ...state.monthlyExpenses }

      if (skill.salaryBonus) {
        player = { ...player, salary: Math.round(player.salary * (1 + skill.salaryBonus)) }
      }
      if (skill.expenseReduction) {
        monthlyExpenses.base = Math.round(monthlyExpenses.base * (1 - skill.expenseReduction))
        monthlyExpenses.total = monthlyExpenses.base + monthlyExpenses.rent + monthlyExpenses.insurance
      }

      const events: GameEvent[] = [...state.events, {
        id: `skill_${skill.id}_${Date.now()}`,
        dateISO: state.gameDateISO,
        category: 'personal',
        severity: 'good',
        title: `Compétence débloquée : ${skill.name}`,
        description: `Formation terminée ! ${skill.benefits.join(', ')}.`,
        financialImpact: 0,
        isRead: false,
        requiresAction: false,
        resolved: true,
      }]
      toasts.push(toast(`🎓 ${skill.name}`, skill.benefits.join(' · '), 'good'))

      state = { ...state, player, monthlyExpenses, events }
    }
  }

  // --- Décisions business disponibles ---
  let businessChanged = false
  let investments = state.investments.map((inv) => {
    if (!inv.businessDetails || inv.businessDetails.pendingDecisionId) return inv
    const availableAt = inv.businessDetails.decisionAvailableAtReal ?? 0
    if (now < availableAt) return inv
    const decision = pickBusinessDecision(
      inv.businessDetails.growthStage ?? 0,
      inv.businessDetails.decisionHistory ?? [],
    )
    if (!decision) return inv
    businessChanged = true
    toasts.push(toast(`${decision.emoji} Décision business`, `${inv.name} : ${decision.title}`, 'info'))
    return {
      ...inv,
      businessDetails: { ...inv.businessDetails, pendingDecisionId: decision.id },
    }
  })
  if (businessChanged) {
    state = { ...state, investments }
  }

  // --- Recherches immobilières : complétion et génération de candidats ---
  const immoSearches = state.immoSearches ?? []
  let immoChanged = false
  const updatedSearches = immoSearches.map((search) => {
    if (search.candidates) return search // déjà complété
    if (now >= search.financingReadyAtReal && now >= search.propertyReadyAtReal) {
      immoChanged = true
      const candidates = generatePropertyCandidates(search.catalogId, state.economy)
      toasts.push(toast('🏠 Recherche terminée', `${candidates.length} biens trouvés pour ${search.catalogId} !`, 'good'))
      return { ...search, candidates }
    }
    return search
  })
  if (immoChanged) {
    state = { ...state, immoSearches: updatedSearches }
  }

  // --- Montées en niveau d'investissement ---
  {
    const now = Date.now()
    let upgradeChanged = false
    const upgradedInvestments = (immoChanged ? state.investments : investments).map((inv) => {
      if (inv.upgradeReadyAtReal && now >= inv.upgradeReadyAtReal) {
        upgradeChanged = true
        const newLevel = Math.min(5, (inv.level ?? 1) + 1)
        toasts.push(toast(
          `Palier ${newLevel} atteint !`,
          `${inv.name} est maintenant au niveau ${newLevel}.`,
          'good',
        ))
        return { ...inv, level: newLevel, upgradeReadyAtReal: undefined }
      }
      return inv
    })
    if (upgradeChanged) {
      state = { ...state, investments: upgradedInvestments }
      investments = upgradedInvestments
    }
  }

  // --- Offres NPC sur biens mis en vente ---
  let saleChanged = false
  const updatedInvestments = (immoChanged ? state.investments : investments).map((inv) => {
    if (!inv.saleListingPrice) return inv

    // Élaguer offres expirées
    const activeOffers = (inv.pendingOffers ?? []).filter(
      (o: SaleOffer) => o.expiresAtReal > now
    )
    let changed = activeOffers.length !== (inv.pendingOffers ?? []).length

    // Spawner une nouvelle offre si le moment est venu
    const nextOfferAt = inv.nextOfferAtReal ?? 0
    if (now >= nextOfferAt && inv.saleListingPrice) {
      const offerFactor = 0.85 + Math.random() * 0.30 // 85–115% du prix affiché
      const offeredPrice = Math.round(inv.saleListingPrice * offerFactor)
      const newOffer: SaleOffer = {
        id: `offer_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        offeredPrice,
        expiresAtReal: now + 4 * 3_600_000, // expire dans 4h
      }
      activeOffers.push(newOffer)
      changed = true
      toasts.push(toast('💼 Offre reçue', `Offre de ${offeredPrice.toLocaleString('fr-FR')} € pour ${inv.name}`, 'info'))
    }

    if (!changed) return inv
    saleChanged = true
    return {
      ...inv,
      pendingOffers: activeOffers,
      // nextOfferAtReal stays until reset by respondToSaleOffer
    }
  })
  if (saleChanged) {
    state = { ...state, investments: updatedInvestments }
  } else if (immoChanged) {
    // immoChanged already updated investments above via state
  }

  return { state, toasts }
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
  monthIndex: number
  stance: GameState['strategicStance']
  behavior: NonNullable<GameState['behavior']>
  pendingReview: GameState['pendingReview']
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
  const monthIndex = ctx.monthIndex + 1
  let behavior = { ...ctx.behavior }
  let pendingReview = ctx.pendingReview
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

  // 1b. Choc de krach : perte immédiate sur les actifs sensibles au marché,
  // amplifiée par la concentration, amortie par la diversification.
  if (phaseStep.changed && phaseStep.phase === 'crash') {
    const div = analyzeDiversification({ investments, cashBalance: cash } as GameState)
    const baseShock = 0.10 // -10% de référence
    const shock = Math.min(0.30, baseShock * div.shockFactor)
    let lost = 0
    investments = investments.map((inv) => {
      const it = getCatalogItem(inv.catalogId)
      if (it.reactsToMarket && it.yieldMode === 'compound') {
        const loss = inv.currentValue * shock
        lost += loss
        return { ...inv, currentValue: Math.max(0, inv.currentValue - loss) }
      }
      return inv
    })
    if (lost > 100) {
      const resilientNote = div.isResilient
        ? ' Ta diversification a amorti le choc.'
        : div.isConcentrated
          ? ' Ton portefeuille concentré a encaissé le choc de plein fouet.'
          : ''
      toasts.push(
        toast(
          '💥 Krach : −' + Math.round(lost).toLocaleString('fr-FR') + ' €',
          `Tes actifs risqués ont chuté en une nuit.${resilientNote}`,
          'bad',
        ),
      )
    }
  }

  // 2. Salaire.
  cash += player.salary

  // 3. Charges (avec inflation lissée).
  monthlyExpenses.base *= 1 + economy.inflationRate / 12
  monthlyExpenses.total =
    monthlyExpenses.base + monthlyExpenses.rent + monthlyExpenses.insurance
  cash -= monthlyExpenses.total

  // 3b. Pouvoir d'achat du cash grignoté par l'inflation (métrique visible,
  // ne déduit pas le cash — c'est une perte silencieuse de valeur réelle).
  const inflationCost = Math.max(0, cash) * (economy.inflationRate / 12)
  behavior = { ...behavior, inflationLostTotal: behavior.inflationLostTotal + inflationCost }

  // 4. Revenus mensuels des investissements.
  let monthlyTax = 0
  investments = investments.map((inv) => {
    const { investment, netCash, tax } = applyMonthlyIncome(inv, economy, ctx.stance)
    cash += netCash
    monthlyTax += tax
    return investment
  })
  totalTaxPaid += monthlyTax
  taxLiability.flatTaxBase += monthlyTax / FLAT_TAX_RATE // approximation base

  // 4b. Risque de défaut sur le crowdfunding immobilier (perte TOTALE, rare).
  // ~0.15%/mois → ~7% de probabilité sur un projet de 4 ans. Le vrai risque.
  const crowdfundingDefaults: Investment[] = []
  investments = investments.filter((inv) => {
    if (inv.catalogId === 'crowdfunding_immo' && Math.random() < 0.0015) {
      crowdfundingDefaults.push(inv)
      return false
    }
    return true
  })
  for (const defaulted of crowdfundingDefaults) {
    events = [...events, {
      id: `default_${defaulted.instanceId}_${Date.now()}`,
      dateISO: gameDateISO,
      category: 'market',
      severity: 'bad',
      title: '🏗️ Faillite du promoteur',
      description: `Le promoteur de "${defaulted.name}" a fait faillite. Ton investissement de ${Math.round(defaulted.totalInvested).toLocaleString('fr-FR')} € est perdu. C'est le risque du crowdfunding : diversifie tes projets.`,
      financialImpact: 0,
      isRead: false,
      requiresAction: false,
      resolved: true,
    }]
    toasts.push(toast('🏗️ Faillite promoteur', `${defaulted.name} : −${Math.round(defaulted.totalInvested).toLocaleString('fr-FR')} € perdus.`, 'bad'))
  }

  // 4c. Surprises de rendement sur les actifs volatils (variable rewards).
  // 15 % de chance par mois par actif à forte variance → sentiment d'imprévisibilité.
  for (const inv of investments) {
    const item = getCatalogItem(inv.catalogId)
    if (item.returnVariance < 0.05 || inv.currentValue < 500) continue
    if (Math.random() > 0.15) continue

    const crashPenalty = economy.marketPhase === 'crash'
    const isPositive = crashPenalty ? Math.random() < 0.25 : Math.random() < 0.68
    const magnitudePct = item.returnVariance * (0.4 + Math.random() * 0.6) * (isPositive ? 1 : -0.6)
    const delta = Math.round(inv.currentValue * magnitudePct)
    if (Math.abs(delta) < 80) continue

    investments = investments.map((i) =>
      i.instanceId === inv.instanceId
        ? { ...i, currentValue: Math.max(0, i.currentValue + delta) }
        : i,
    )

    const SURPRISE_MSGS: Record<string, [string, string]> = {
      bourse_etf:       ['📈 ETF en hausse surprise !',     '🔻 ETF : mois difficile'],
      crypto:           ['🚀 Ta crypto explose !',          '📉 Crypto : forte correction'],
      or_metaux:        ['✨ L\'or brille ce mois !',       '🪙 Or en repli ce mois'],
      business:         ['💼 Business en forme !',          '⚠️ Business : mois creux'],
      crowdfunding_immo:['🏗️ Projet immo performant !',    '🏗️ Projet immo décevant'],
    }
    const [posMsg, negMsg] = SURPRISE_MSGS[inv.catalogId] ?? ['✨ Rendement surprise !', '⚠️ Mois difficile']
    const title = isPositive ? posMsg : negMsg
    const sign = isPositive ? '+' : ''

    if (isPositive) {
      events = [...events, {
        id: `yield_surprise_${inv.instanceId}_${monthIndex}`,
        dateISO: gameDateISO,
        category: 'market' as const,
        severity: 'good' as const,
        title: `${title} (${sign}${Math.round(delta).toLocaleString('fr-FR')} €)`,
        description: `${inv.name} a eu un mois exceptionnel. Continue d'investir régulièrement !`,
        financialImpact: 0,
        isRead: false,
        requiresAction: false,
        resolved: true,
      }]
      if (delta > 200) {
        toasts.push(toast(title, `${sign}${Math.round(delta).toLocaleString('fr-FR')} € sur ${inv.name}`, 'good'))
      }
    }
  }

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

  // 6b. Ancienneté des locataires (attachement).
  investments = investments.map((inv) => {
    if (inv.propertyDetails?.tenantName && !inv.propertyDetails.isVacant) {
      return {
        ...inv,
        propertyDetails: {
          ...inv.propertyDetails,
          tenantSinceMonthIndex: (inv.propertyDetails.tenantSinceMonthIndex ?? 0) + 1,
        },
      }
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

  // 8c. Progression de la formation (liée au temps de jeu, accélérée par la vitesse).
  if (player.activeTraining) {
    player = {
      ...player,
      activeTraining: {
        ...player.activeTraining,
        monthsCompleted: (player.activeTraining.monthsCompleted ?? 0) + 1,
      },
    }
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
      monthlyExpenses,
    })
    player = applied.player
    investments = applied.investments
    cash = applied.cash
    monthlyExpenses.base = applied.monthlyExpenses.base
    monthlyExpenses.rent = applied.monthlyExpenses.rent
    monthlyExpenses.insurance = applied.monthlyExpenses.insurance
    monthlyExpenses.total = applied.monthlyExpenses.total
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

  // 11. Tension de trésorerie : cash sous un mois de charges après ce mois.
  if (cash < monthlyExpenses.total && cash < 1500) {
    const tensionId = 'cash_tension'
    if (!eventCooldowns[tensionId]) {
      events = [...events, {
        id: `tension_${Date.now()}`,
        dateISO: gameDateISO,
        category: 'personal',
        severity: 'warning',
        title: '🚨 Tension de trésorerie',
        description: `Ton cash est tombé à ${Math.round(cash).toLocaleString('fr-FR')} €, sous le niveau d'un mois de charges. Pense à vendre un actif liquide ou à retirer du Livret A avant d'être à découvert.`,
        financialImpact: 0,
        isRead: false,
        requiresAction: false,
        resolved: true,
      }]
      toasts.push(toast('🚨 Trésorerie tendue', 'Ton cash est dangereusement bas.', 'warning'))
      eventCooldowns[tensionId] = 4 // pas plus d'une alerte tous les 4 mois
    }
  }

  // 12. Bilan trimestriel : tous les 3 mois de jeu, on impose une réflexion.
  if (monthIndex > 0 && monthIndex % 3 === 0 && !pendingReview) {
    // Compare au snapshot d'il y a ~3 mois.
    const prevSnap = stats.length >= 4 ? stats[stats.length - 4] : stats[0]
    const nwDelta = Math.round(netWorthNow - (prevSnap?.netWorth ?? netWorthNow))
    const nwDeltaPct = prevSnap && prevSnap.netWorth > 0
      ? nwDelta / prevSnap.netWorth
      : 0
    const cashflow = Math.round(player.salary + passiveIncome - monthlyExpenses.total - mortgagePaid)
    // Fait marquant : dernier événement bad/good du trimestre.
    const recentNotable = [...events].reverse().find(
      (e) => (e.severity === 'bad' || e.severity === 'good') && e.category !== 'milestone',
    )
    const inflationThisQuarter = Math.round(inflationCost * 3) // ~3 mois d'inflation sur le cash
    const date = ctx.gameDate
    pendingReview = {
      quarter: Math.floor(date.getUTCMonth() / 3) + 1,
      year: date.getUTCFullYear(),
      monthIndex,
      netWorthDelta: nwDelta,
      netWorthDeltaPct: nwDeltaPct,
      cashflow,
      passiveIncome: Math.round(passiveIncome),
      highlight: recentNotable
        ? recentNotable.title
        : 'Un trimestre calme, sans événement majeur.',
      inflationLost: inflationThisQuarter,
    }
  }

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
    monthIndex,
    behavior,
    pendingReview,
    lastInflationCost: Math.round(inflationCost),
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
  ctx: {
    player: GameState['player']
    investments: Investment[]
    cash: number
    monthlyExpenses: GameState['monthlyExpenses']
  },
) {
  let player = ctx.player
  let investments = ctx.investments
  let cash = ctx.cash
  const monthlyExpenses = { ...ctx.monthlyExpenses }

  // Impact cash direct.
  cash += evt.financialImpact

  switch (evt.templateId) {
    case 'marriage':
      // Vie à deux : charges de base mutualisées (-8%).
      monthlyExpenses.base = Math.round(monthlyExpenses.base * 0.92)
      monthlyExpenses.total = monthlyExpenses.base + monthlyExpenses.rent + monthlyExpenses.insurance
      break
    case 'have_child':
      // Un enfant : +350 €/mois de charges durables, +1 personne à charge.
      monthlyExpenses.base = Math.round(monthlyExpenses.base + 350)
      monthlyExpenses.total = monthlyExpenses.base + monthlyExpenses.rent + monthlyExpenses.insurance
      player = { ...player, dependents: (player.dependents ?? 0) + 1 }
      break
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
        const name = target.propertyDetails?.tenantName
        const tenure = target.propertyDetails?.tenantSinceMonthIndex ?? 0
        if (name) {
          const yearsPart = tenure >= 12 ? ` après ${Math.floor(tenure / 12)} an(s) chez toi` : ''
          evt.description = `${name} quitte ton bien "${target.name}"${yearsPart}. Le logement sera vacant le temps de retrouver un locataire.`
        }
        investments = investments.map((i) =>
          i.instanceId === target.instanceId && i.propertyDetails
            ? {
                ...i,
                propertyDetails: {
                  ...i.propertyDetails,
                  isVacant: true,
                  vacancyMonthsLeft: randomVacancyMonths(),
                  tenantName: undefined,
                  tenantStory: undefined,
                  tenantSinceMonthIndex: 0,
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

  return { player, investments, cash, monthlyExpenses }
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
