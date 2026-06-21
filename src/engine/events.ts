import type {
  EventCondition,
  EventTemplate,
  GameEvent,
  GameState,
} from '../types'
import { EVENT_TEMPLATES } from '../data/events'
import { randInt, randRange } from './economy'

// ============================================================================
// Tirage et instanciation des événements aléatoires mensuels.
// ============================================================================

let eventCounter = 0
function eventId(): string {
  eventCounter += 1
  return `evt_${Date.now().toString(36)}_${eventCounter}`
}

function checkCondition(cond: EventCondition, state: GameState, netWorth: number): boolean {
  switch (cond.type) {
    case 'hasCategory':
      return state.investments.some((i) => i.catalogId === cond.value)
    case 'minNetWorth':
      return netWorth >= (cond.value as number)
    case 'maxNetWorth':
      return netWorth <= (cond.value as number)
    case 'hasRealEstate':
      return state.investments.some((i) => i.propertyDetails !== undefined)
    case 'hasBusiness':
      return state.investments.some((i) => i.businessDetails !== undefined)
    case 'isEmployed':
      return state.player.salary > 0
    default:
      return true
  }
}

function isEligible(t: EventTemplate, state: GameState, netWorth: number): boolean {
  if ((state.eventCooldowns[t.id] ?? 0) > 0) return false
  return t.conditions.every((c) => checkCondition(c, state, netWorth))
}

/**
 * Tire les événements du mois (max 2). Renvoie les événements instanciés.
 * Le moteur (gameLoop) applique ensuite leurs effets.
 */
export function rollMonthlyEvents(
  state: GameState,
  netWorth: number,
  gameDateISO: string,
): GameEvent[] {
  const currentMonth = new Date(gameDateISO).getMonth() + 1 // 1-12
  const triggered: GameEvent[] = []

  // Événements saisonniers : déclenchement garanti ce mois-ci si éligible
  for (const t of EVENT_TEMPLATES) {
    if (t.triggerMonth !== currentMonth) continue
    if (!isEligible(t, state, netWorth)) continue
    if (Math.random() < t.monthlyProbability) {
      triggered.push(instantiate(t, gameDateISO))
    }
  }

  // Événements aléatoires normaux (max 2 au total)
  const eligible = EVENT_TEMPLATES.filter(
    (t) => !t.triggerMonth && isEligible(t, state, netWorth),
  )
  for (const t of eligible) {
    if (triggered.length >= 2) break
    if (Math.random() < t.monthlyProbability) {
      triggered.push(instantiate(t, gameDateISO))
    }
  }
  return triggered
}

function instantiate(t: EventTemplate, gameDateISO: string): GameEvent {
  let impact = 0
  if (t.impactRange[0] !== 0 || t.impactRange[1] !== 0) {
    impact = Math.round(randRange(t.impactRange[0], t.impactRange[1]))
  }
  return {
    id: eventId(),
    templateId: t.id,
    dateISO: gameDateISO,
    category: t.category,
    severity: t.severity,
    title: t.title,
    description: t.description,
    financialImpact: impact,
    isRead: false,
    requiresAction: !!t.actionOptions && t.actionOptions.length > 0,
    resolved: !t.actionOptions,
    actionOptions: t.actionOptions,
    tip: t.educationTip,
  }
}

/** Crée un événement de palier atteint. */
export function createMilestoneEvent(
  title: string,
  description: string,
  gameDateISO: string,
): GameEvent {
  return {
    id: eventId(),
    dateISO: gameDateISO,
    category: 'milestone',
    severity: 'good',
    title,
    description,
    financialImpact: 0,
    isRead: false,
    requiresAction: false,
    resolved: true,
  }
}

/** Crée un événement de régularisation fiscale annuelle. */
export function createTaxEvent(amount: number, year: number, gameDateISO: string): GameEvent {
  const isRefund = amount > 0
  return {
    id: eventId(),
    dateISO: gameDateISO,
    category: 'tax',
    severity: isRefund ? 'good' : 'warning',
    title: isRefund ? 'Remboursement d\'impôt' : `Régularisation fiscale ${year - 1}`,
    description: isRefund
      ? `L'administration te rembourse un trop-perçu d'impôt.`
      : `Solde d'impôt sur tes revenus et plus-values de l'année écoulée.`,
    financialImpact: amount,
    isRead: false,
    requiresAction: false,
    resolved: true,
  }
}

/** Génère une durée de vacance locative (en mois). */
export function randomVacancyMonths(): number {
  return randInt(1, 4)
}
