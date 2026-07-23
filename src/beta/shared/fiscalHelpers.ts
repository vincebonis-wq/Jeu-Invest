/**
 * Helpers fiscaux partagés par les betas « patrimoine tangible » (Coffres, La Tour…).
 * Centralise le statut fiscal d'un placement et l'aperçu d'un retrait, calés sur
 * le vrai moteur fiscal (fiscal.ts) et le comportement des actions du store.
 */

import { getCatalogItem } from '../../data/investments'
import {
  getAVFiscalDetails, capitalGainsTax, FLAT_TAX_RATE, AV_ALLOWANCE,
} from '../../engine/fiscal'
import type { GameState, Investment } from '../../types'

export const euro = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €'

export type FiscalKind = 'hard' | 'fiscal' | 'taxed' | 'open'
export interface FiscalStatus {
  kind: FiscalKind
  label: string
  sub: string
  rate: number
  yearsToFav?: number
}

function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

/** Statut fiscal d'un placement : cadenas dur, cadenas fiscal (AV 8 ans), taxé, ou ouvert. */
export function fiscalStatus(inv: Investment, game: GameState): FiscalStatus {
  const item = getCatalogItem(inv.catalogId)
  if (inv.isLocked && inv.unlockDateISO) {
    const d = Math.max(0, daysBetween(game.gameDateISO, inv.unlockDateISO))
    return { kind: 'hard', label: 'Capital bloqué', sub: `Se libère dans ${d > 60 ? Math.round(d / 30) + ' mois' : d + ' j'}`, rate: FLAT_TAX_RATE }
  }
  if (inv.catalogId === 'assurance_vie') {
    const av = getAVFiscalDetails(inv, game.gameDateISO)
    if (av.isFavorable) return { kind: 'open', label: 'Fiscalité optimisée', sub: `Abattement ${euro(AV_ALLOWANCE)}/an`, rate: av.taxRate }
    return { kind: 'fiscal', label: `Cadenas fiscal · ${Math.round(av.taxRate * 100)} %`, sub: `S'ouvre dans ${av.yearsToFavorable} an${av.yearsToFavorable > 1 ? 's' : ''}`, rate: av.taxRate, yearsToFav: av.yearsToFavorable }
  }
  if (item.taxRegime === 'exonere') return { kind: 'open', label: 'Exonéré d\'impôt', sub: 'Retrait libre', rate: 0 }
  if (item.isRealEstate) return { kind: 'taxed', label: 'Plus-value taxée', sub: 'À la revente', rate: 0.19 }
  return { kind: 'taxed', label: 'Flat tax · 30 %', sub: 'Sur la plus-value', rate: FLAT_TAX_RATE }
}

export interface WithdrawPreview { gross: number; gain: number; tax: number; net: number; isFull: boolean; debt: number }

/** Aperçu d'un retrait — miroir exact de sellInvestment / partialSellInvestment. */
export function previewWithdraw(inv: Investment, game: GameState, amount: number): WithdrawPreview {
  const item = getCatalogItem(inv.catalogId)
  const isFull = amount >= inv.currentValue - 0.5
  if (isFull) {
    const mortgage = inv.mortgageId ? game.mortgages.find((m) => m.id === inv.mortgageId) : null
    const debt = mortgage ? mortgage.outstandingBalance : 0
    const tax = capitalGainsTax(inv, game.gameDateISO)
    return { gross: inv.currentValue, gain: Math.max(0, inv.currentValue - inv.totalInvested), tax, net: inv.currentValue - debt - tax, isFull: true, debt }
  }
  const fraction = amount / inv.currentValue
  const gainPortion = fraction * Math.max(0, inv.currentValue - inv.totalInvested)
  let tax = 0
  if (inv.catalogId === 'assurance_vie') tax = Math.round(gainPortion * getAVFiscalDetails(inv, game.gameDateISO).taxRate)
  else if (item.taxRegime !== 'exonere') tax = Math.round(gainPortion * FLAT_TAX_RATE)
  return { gross: amount, gain: gainPortion, tax, net: amount - tax, isFull: false, debt: 0 }
}
