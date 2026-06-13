import type { Investment, PropertyDetails } from '../types'
import { getCatalogItem } from '../data/investments'

// ============================================================================
// Calculs fiscaux (simplifiés pour le gameplay mais cohérents).
// ============================================================================

export const FLAT_TAX_RATE = 0.3 // PFU 30%
export const FONCIER_RATE = 0.3 // TMI simplifié sur revenus fonciers
export const BIC_RATE = 0.25 // micro-BIC simplifié

/**
 * Taxe appliquée à la source sur un revenu mensuel selon le régime.
 * Renvoie le montant d'impôt (positif) à prélever.
 */
export function taxOnMonthlyIncome(inv: Investment, grossIncome: number): number {
  if (grossIncome <= 0) return 0
  const item = getCatalogItem(inv.catalogId)
  switch (item.taxRegime) {
    case 'exonere':
      return 0
    case 'flat_tax':
      return grossIncome * FLAT_TAX_RATE
    case 'revenus_fonciers':
      return grossIncome * FONCIER_RATE
    case 'bic':
      return grossIncome * BIC_RATE
    case 'lmnp': {
      // L'amortissement réduit fortement la base imposable.
      const monthlyDepreciation = lmnpMonthlyDepreciation(inv.propertyDetails)
      const taxable = Math.max(0, grossIncome - monthlyDepreciation)
      return taxable * FONCIER_RATE
    }
    default:
      return 0
  }
}

/** Amortissement LMNP mensuel : bâti sur 25 ans + mobilier sur 7 ans. */
export function lmnpMonthlyDepreciation(prop?: PropertyDetails): number {
  if (!prop) return 0
  const buildingYearly = prop.depreciationBaseBuilding / 25
  const furnitureYearly = prop.furnitureCost / 7
  return (buildingYearly + furnitureYearly) / 12
}

/**
 * Impôt sur la plus-value lors de la revente (flat tax sur le gain).
 */
export function capitalGainsTax(inv: Investment): number {
  const item = getCatalogItem(inv.catalogId)
  const gain = inv.currentValue - inv.totalInvested
  if (gain <= 0) return 0
  if (item.taxRegime === 'exonere') return 0
  // L'immobilier détenu longtemps bénéficie d'abattements (simplifié : 50%).
  if (item.isRealEstate) return gain * FONCIER_RATE * 0.5
  return gain * FLAT_TAX_RATE
}
