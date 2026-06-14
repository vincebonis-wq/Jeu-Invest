import type { Investment, PropertyDetails } from '../types'
import { getCatalogItem } from '../data/investments'

export const FLAT_TAX_RATE = 0.3
export const FONCIER_RATE = 0.3
export const BIC_RATE = 0.25
export const AV_FAVORABLE_RATE = 0.247 // 7.5% IR + 17.2% PS après 8 ans
export const AV_ALLOWANCE = 4600 // abattement annuel AV après 8 ans (célibataire)

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
      const monthlyDepreciation = lmnpMonthlyDepreciation(inv.propertyDetails)
      const taxable = Math.max(0, grossIncome - monthlyDepreciation)
      return taxable * FONCIER_RATE
    }
    default:
      return 0
  }
}

export function lmnpMonthlyDepreciation(prop?: PropertyDetails): number {
  if (!prop) return 0
  const buildingYearly = prop.depreciationBaseBuilding / 25
  const furnitureYearly = prop.furnitureCost / 7
  return (buildingYearly + furnitureYearly) / 12
}

export interface AVFiscalDetails {
  yearsHeld: number
  monthsHeld: number
  isFavorable: boolean
  yearsToFavorable: number
  gain: number
  allowance: number
  taxableGain: number
  taxRate: number
  tax: number
  regime: string
}

export function getAVFiscalDetails(inv: Investment, currentDateISO: string): AVFiscalDetails {
  const purchaseDate = new Date(inv.purchaseDateISO)
  const currentDate = new Date(currentDateISO)
  const msHeld = currentDate.getTime() - purchaseDate.getTime()
  const yearsHeld = msHeld / (365.25 * 24 * 3600 * 1000)
  const monthsHeld = Math.floor(yearsHeld * 12)
  const gain = Math.max(0, inv.currentValue - inv.totalInvested)

  if (yearsHeld >= 8) {
    const taxableGain = Math.max(0, gain - AV_ALLOWANCE)
    return {
      yearsHeld: Math.floor(yearsHeld),
      monthsHeld,
      isFavorable: true,
      yearsToFavorable: 0,
      gain,
      allowance: AV_ALLOWANCE,
      taxableGain,
      taxRate: AV_FAVORABLE_RATE,
      tax: Math.round(taxableGain * AV_FAVORABLE_RATE),
      regime: 'Régime 8 ans — 7.5% IR + 17.2% PS (après abattement 4 600 €)',
    }
  } else {
    const yearsToGo = 8 - yearsHeld
    return {
      yearsHeld: Math.floor(yearsHeld),
      monthsHeld,
      isFavorable: false,
      yearsToFavorable: Math.ceil(yearsToGo * 10) / 10,
      gain,
      allowance: 0,
      taxableGain: gain,
      taxRate: FLAT_TAX_RATE,
      tax: Math.round(gain * FLAT_TAX_RATE),
      regime: 'PFU 30% (flat tax) — avant 8 ans',
    }
  }
}

export function capitalGainsTax(inv: Investment, currentDateISO?: string): number {
  const item = getCatalogItem(inv.catalogId)
  const gain = inv.currentValue - inv.totalInvested
  if (gain <= 0) return 0
  if (item.taxRegime === 'exonere') return 0

  if (inv.catalogId === 'assurance_vie' && currentDateISO) {
    return getAVFiscalDetails(inv, currentDateISO).tax
  }

  if (item.isRealEstate) return gain * FONCIER_RATE * 0.5
  return gain * FLAT_TAX_RATE
}
