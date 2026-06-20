import { INVESTMENT_CATALOG } from '../data/investments'
import { getInvestmentLevelBonus } from '../data/upgradeTiers'
import { calcNetWorth } from '../utils/calculations'
import type { GameState, InvestmentCatalogItem } from '../types'

export interface BetaNode {
  item: InvestmentCatalogItem
  unlocked: boolean
  skillOk: boolean
  wealthOk: boolean
  isOwned: boolean
  level: number
  value: number
  isUpgrading: boolean
  upgradeReadyAtReal?: number
  hasActiveSearch: boolean
  searchReady: boolean
  returnRate: number
}

const IMMO_SEARCHABLE = ['parking', 'lmnp', 'immo_classique']

// Calcule l'état d'affichage de chaque investissement pour les vues beta.
// Ordonné du plus accessible au plus avancé (par seuil de déblocage).
export function computeBetaNodes(game: GameState): BetaNode[] {
  const netWorth = calcNetWorth(game)
  const learned = game.player.learnedSkillIds || []

  return [...INVESTMENT_CATALOG]
    .sort((a, b) => a.unlockThreshold - b.unlockThreshold)
    .map((item) => {
      const skillOk = !item.skillRequired || learned.includes(item.skillRequired)
      const wealthOk = netWorth >= item.unlockThreshold
      const unlocked = skillOk && wealthOk

      const owned = game.investments.filter((inv) => inv.catalogId === item.id)
      const isOwned = owned.length > 0
      const level = owned[0]?.level ?? 1
      const value = owned.reduce((s, i) => s + i.currentValue, 0)
      const upgradeReadyAtReal = owned[0]?.upgradeReadyAtReal
      const isUpgrading = !!upgradeReadyAtReal && upgradeReadyAtReal > Date.now()

      const search = IMMO_SEARCHABLE.includes(item.id)
        ? (game.immoSearches ?? []).find((s) => s.catalogId === item.id)
        : undefined

      return {
        item,
        unlocked,
        skillOk,
        wealthOk,
        isOwned,
        level,
        value,
        isUpgrading,
        upgradeReadyAtReal,
        hasActiveSearch: !!search && !search.candidates,
        searchReady: !!search?.candidates,
        returnRate: item.baseAnnualReturn * (1 + (isOwned ? getInvestmentLevelBonus(item.id, level) : 0)),
      }
    })
}

export function formatCountdown(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m < 60) return `${m}m${sec > 0 ? ` ${sec}s` : ''}`
  const h = Math.floor(m / 60)
  return `${h}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`
}
