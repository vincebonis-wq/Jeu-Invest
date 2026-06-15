import type {
  EconomyState,
  Investment,
  InvestmentCategory,
  Mortgage,
  MortgageQuote,
} from '../types'
import {
  BUSINESS_TYPES,
  FRENCH_CITIES,
  STREET_NAMES,
  getCatalogItem,
} from '../data/investments'
import {
  PHASE_RETURN_MULTIPLIER,
  pickOne,
  randInt,
  randRange,
} from './economy'
import { taxOnMonthlyIncome } from './fiscal'

// ============================================================================
// Opérations et calculs sur les investissements.
// ============================================================================

let idCounter = 0
function uid(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`
}

const MAX_VALUE_HISTORY = 60

/**
 * Crée une nouvelle instance d'investissement.
 * `amount` = capital propre engagé (down payment si crédit).
 * `mortgage` éventuel pour l'immobilier.
 * `propertyPrice` = prix total du bien (override pour achat avec crédit).
 */
export function createInvestment(
  catalogId: InvestmentCategory,
  amount: number,
  gameDateISO: string,
  mortgage: Mortgage | null,
  propertyPrice?: number,
): Investment {
  const item = getCatalogItem(catalogId)
  const gameDate = new Date(gameDateISO)

  let unlockDateISO: string | null = null
  if (item.lockPeriodMonths) {
    const d = new Date(gameDate)
    d.setUTCMonth(d.getUTCMonth() + item.lockPeriodMonths)
    unlockDateISO = d.toISOString()
  }

  // Valeur totale du bien = prix fourni, ou apport + capital emprunté (immobilier).
  const assetValue = propertyPrice ?? (amount + (mortgage ? mortgage.principal : 0))

  // Applique les frais d'achat (frais notaire, spread, etc.)
  const purchaseCostPct = item.purchaseCostPct ?? 0
  const effectiveValue = assetValue * (1 - purchaseCostPct)

  const rawCurrentValue = item.isRealEstate ? effectiveValue : (
    item.yieldMode === 'compound'
      ? amount * (1 - purchaseCostPct)
      : amount * (1 - purchaseCostPct)
  )

  const inv: Investment = {
    instanceId: uid('inv'),
    catalogId,
    name: item.name,
    purchaseDateISO: gameDateISO,
    purchasePrice: amount,
    totalInvested: amount,
    currentValue: rawCurrentValue,
    annualReturnRate: effectiveAnnualRate(item.baseAnnualReturn, item.returnVariance),
    monthlyIncome: 0,
    realizedReturn: 0,
    isLocked: item.lockPeriodMonths !== null,
    unlockDateISO,
    mortgageId: mortgage ? mortgage.id : null,
    valueHistory: [Math.round(rawCurrentValue)],
  }

  // Détails spécifiques immobilier — rent based on full asset value (before fees).
  if (catalogId === 'lmnp' || catalogId === 'immo_classique' || catalogId === 'parking') {
    const price = assetValue  // full price for rent calculations
    const isParking = catalogId === 'parking'
    const sqm = isParking ? randInt(12, 18) : Math.round(price / randRange(2800, 4200))
    const yearlyYield = item.baseAnnualReturn
    const monthlyRent = Math.round((price * yearlyYield) / 12 / (isParking ? 1 : 0.85))
    const furnitureCost = catalogId === 'lmnp' ? Math.max(4000, Math.round(price * 0.06)) : 0

    inv.name = isParking
      ? `Parking ${pickOne(FRENCH_CITIES)}`
      : `${sqm} m² ${pickOne(FRENCH_CITIES)}`
    inv.propertyDetails = {
      address: `${randInt(1, 120)} ${pickOne(STREET_NAMES)}`,
      city: pickOne(FRENCH_CITIES),
      squareMeters: sqm,
      furnitureCost,
      monthlyRent,
      baseMonthlyRent: monthlyRent,
      tenantProfile: 'professional',
      isVacant: false,
      vacancyMonthsLeft: 0,
      maintenanceCostYearly: Math.round(price * 0.008),
      depreciationBaseBuilding: price * 0.7,
    }
    // Le coût du mobilier LMNP s'ajoute au capital investi.
    if (furnitureCost > 0) {
      inv.totalInvested += furnitureCost
    }
  }

  // Détails business.
  if (catalogId === 'business') {
    const monthlyRevenue = Math.round((amount * randRange(0.12, 0.22)) / 12 + randRange(400, 1200))
    inv.name = pickOne(BUSINESS_TYPES)
    inv.businessDetails = {
      businessType: inv.name,
      monthlyRevenue,
      monthlyCosts: Math.round(monthlyRevenue * randRange(0.2, 0.4)),
      attentionMonthsLeft: randInt(3, 6),
    }
  }

  return inv
}

/** Taux annuel effectif tiré aléatoirement dans la variance. */
function effectiveAnnualRate(base: number, variance: number): number {
  if (variance === 0) return base
  return base + randRange(-variance, variance)
}

/**
 * Applique le rendement QUOTIDIEN à un investissement (mutation d'une copie).
 * Met à jour currentValue (mode compound) — l'income mensuel est géré ailleurs.
 * Renvoie un nouvel objet Investment.
 */
export function applyDailyYield(inv: Investment, economy: EconomyState): Investment {
  const item = getCatalogItem(inv.catalogId)
  const updated = { ...inv }

  if (item.yieldMode === 'compound') {
    let dailyRate = Math.pow(1 + inv.annualReturnRate, 1 / 365) - 1
    if (item.reactsToMarket) {
      const mult = PHASE_RETURN_MULTIPLIER[economy.marketPhase]
      // On module la tendance, avec un peu de bruit quotidien.
      dailyRate = dailyRate * mult + randRange(-0.0006, 0.0006)
    }
    updated.currentValue = Math.max(0, inv.currentValue * (1 + dailyRate))
  } else if (item.isRealEstate) {
    // L'immobilier prend de la valeur via l'indice (géré dans le tick).
    // Ici on applique une légère dérive quotidienne propre au bien.
    const daily = item.baseAnnualReturn * 0.4 / 365 // appréciation du bien
    const phaseAdj =
      economy.marketPhase === 'crash'
        ? -0.0002
        : economy.marketPhase === 'bull'
          ? 0.0001
          : 0
    updated.currentValue = Math.max(0, inv.currentValue * (1 + daily + phaseAdj))
  }
  // income non-immo (livret, scpi, business) : valeur stable, revenu mensuel.

  return updated
}

/**
 * Calcule et applique le revenu MENSUEL d'un investissement.
 * Renvoie { investment, netCash, tax } — netCash crédité au joueur.
 */
export function applyMonthlyIncome(
  inv: Investment,
  economy: EconomyState,
): { investment: Investment; netCash: number; tax: number } {
  const item = getCatalogItem(inv.catalogId)
  const updated = { ...inv }
  let gross = 0

  if (item.yieldMode === 'income') {
    if (item.isRealEstate && inv.propertyDetails) {
      const prop = { ...inv.propertyDetails }
      // Gestion de la vacance locative.
      if (prop.isVacant) {
        prop.vacancyMonthsLeft -= 1
        if (prop.vacancyMonthsLeft <= 0) {
          prop.isVacant = false
        }
        gross = 0
      } else {
        gross = prop.monthlyRent
      }
      // Coût d'entretien lissé mensuellement.
      gross -= prop.maintenanceCostYearly / 12
      updated.propertyDetails = prop
    } else if (inv.businessDetails) {
      const biz = { ...inv.businessDetails }
      let revenue = biz.monthlyRevenue
      // Marché influe sur le business.
      if (item.reactsToMarket) {
        const mult = PHASE_RETURN_MULTIPLIER[economy.marketPhase]
        revenue *= 0.6 + 0.4 * Math.max(0, mult)
      }
      // Dégradation si pas d'attention.
      biz.attentionMonthsLeft -= 1
      if (biz.attentionMonthsLeft <= 0) {
        biz.monthlyRevenue = Math.max(300, Math.round(biz.monthlyRevenue * 0.95))
      }
      gross = revenue - biz.monthlyCosts
      updated.businessDetails = biz
    } else {
      // Livret, SCPI : intérêt mensuel sur la valeur.
      let rate = inv.annualReturnRate
      if (item.reactsToMarket) {
        rate *= 0.7 + 0.3 * Math.max(0, PHASE_RETURN_MULTIPLIER[economy.marketPhase])
      }
      gross = inv.currentValue * (rate / 12)
    }
  }

  const tax = taxOnMonthlyIncome(updated, gross)
  const netCash = gross - tax
  updated.monthlyIncome = Math.round(netCash)
  updated.realizedReturn += netCash

  return { investment: updated, netCash, tax: Math.max(0, tax) }
}

/** Pousse un point dans l'historique de valeur (cappé). */
export function pushValueHistory(inv: Investment): Investment {
  const history = [...inv.valueHistory, Math.round(inv.currentValue)]
  if (history.length > MAX_VALUE_HISTORY) history.shift()
  return { ...inv, valueHistory: history }
}

// ----------------------------------------------------------------------------
// Crédit immobilier
// ----------------------------------------------------------------------------

export const MAX_LTV = 0.8
export const MAX_DTI = 0.35 // taux d'endettement max

/** Mensualité d'un crédit amortissable (formule annuité). */
export function monthlyPaymentFor(
  principal: number,
  annualRate: number,
  termMonths: number,
): number {
  const r = annualRate / 12
  if (r === 0) return principal / termMonths
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths))
}

/**
 * Génère un devis de crédit pour un bien immobilier.
 * `propertyPrice` = prix du bien, `availableCash` = cash dispo (apport),
 * `monthlyIncome` = salaire + passif net pour le calcul DTI,
 * `existingPayments` = mensualités de crédits en cours.
 * `rateReduction` = réduction du taux grâce aux compétences.
 */
export function getMortgageQuote(
  propertyPrice: number,
  availableCash: number,
  monthlyIncome: number,
  existingPayments: number,
  economy: EconomyState,
  termYears = 20,
  rateReduction = 0,
): MortgageQuote {
  const termMonths = termYears * 12
  const annualRate = Math.max(0.01, economy.interestRateBase + 0.01 - rateReduction) // marge banque
  const minDownPayment = propertyPrice * (1 - MAX_LTV)
  const maxLoan = propertyPrice * MAX_LTV

  // Apport fixe à 20% du prix. L'acquéreur emprunte toujours les 80% restants.
  const downPayment = minDownPayment
  const principal = propertyPrice - downPayment
  const monthlyPayment = monthlyPaymentFor(principal, annualRate, termMonths)

  const dti = (existingPayments + monthlyPayment) / Math.max(1, monthlyIncome)

  let approved = true
  let reason = 'Crédit accordé ✓'

  if (availableCash < minDownPayment) {
    approved = false
    reason = `Apport insuffisant : il faut au moins ${Math.round(minDownPayment)} € (20%).`
  } else if (dti > MAX_DTI) {
    approved = false
    reason = `Taux d'endettement trop élevé (${Math.round(dti * 100)}% > 35%). Réduis le montant ou augmente tes revenus.`
  }

  return {
    approved,
    reason,
    principal,
    downPayment,
    monthlyPayment,
    annualRate,
    termMonths,
    maxLoan,
  }
}

export function createMortgage(
  investmentId: string,
  quote: MortgageQuote,
): Mortgage {
  return {
    id: uid('mortgage'),
    investmentId,
    principal: quote.principal,
    outstandingBalance: quote.principal,
    annualRate: quote.annualRate,
    monthlyPayment: quote.monthlyPayment,
    termMonths: quote.termMonths,
    remainingMonths: quote.termMonths,
  }
}

/**
 * Traite une mensualité de crédit : intérêts + amortissement.
 * Renvoie le crédit mis à jour (ou null si soldé).
 */
export function processMortgagePayment(m: Mortgage): Mortgage | null {
  if (m.remainingMonths <= 0 || m.outstandingBalance <= 0) return null
  const interest = m.outstandingBalance * (m.annualRate / 12)
  const principalPaid = Math.min(m.outstandingBalance, m.monthlyPayment - interest)
  const newBalance = m.outstandingBalance - principalPaid
  const remaining = m.remainingMonths - 1
  if (newBalance <= 1 || remaining <= 0) return null // soldé
  return { ...m, outstandingBalance: newBalance, remainingMonths: remaining }
}
