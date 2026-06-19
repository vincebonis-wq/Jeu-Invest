import type { BadgeId, GameState, EarnedBadge } from '../types'
import { calcNetWorth, calcMonthlyPassiveIncome } from '../utils/calculations'

// Vérifie quels badges doivent être débloqués en fonction de l'état courant.
// Retourne UNIQUEMENT les IDs pas encore dans game.badges.
export function checkBadges(game: GameState): BadgeId[] {
  const earned = new Set((game.badges ?? []).map((b) => b.id))
  const newBadges: BadgeId[] = []

  function award(id: BadgeId) {
    if (!earned.has(id)) { newBadges.push(id); earned.add(id) }
  }

  const netWorth = calcNetWorth(game)
  const passiveIncome = calcMonthlyPassiveIncome(game)
  const investments = game.investments
  const monthIndex = game.monthIndex ?? 0

  // Milestones patrimoine
  if (netWorth >= 10_000) award('net_worth_10k')
  if (netWorth >= 50_000) award('net_worth_50k')
  if (netWorth >= 100_000) award('net_worth_100k')
  if (netWorth >= 500_000) award('net_worth_500k')
  if (netWorth >= 1_000_000) award('millionnaire')

  // Revenus passifs
  if (passiveIncome >= 500) award('passive_income_500')
  if (passiveIncome >= game.player.salary && game.player.salary > 0) award('passive_income_salary')

  // Investissements
  if (investments.length > 0) award('first_investment')
  if (investments.length > 0 && monthIndex <= 1) award('speed_investor')
  if (investments.some((i) => i.catalogId === 'bourse_etf')) award('first_etf')
  if (investments.some((i) => i.catalogId === 'business')) award('first_business')
  if (investments.some((i) => i.catalogId === 'livret' && i.currentValue >= 22_000)) award('livret_full')

  const isRealEstate = investments.some((i) =>
    ['parking', 'lmnp', 'immo_classique'].includes(i.catalogId),
  )
  if (isRealEstate) award('first_real_estate')

  // Diversification : 4 classes d'actifs distinctes
  const categories = new Set(investments.map((i) => {
    if (['bourse_etf', 'crypto', 'or_metaux'].includes(i.catalogId)) return 'bourse'
    if (['parking', 'lmnp', 'immo_classique'].includes(i.catalogId)) return 'immo'
    if (['crowdfunding_immo', 'scpi', 'club_deal_immo'].includes(i.catalogId)) return 'crowdfunding'
    if (i.catalogId === 'business') return 'business'
    return 'epargne'
  }))
  if (categories.size >= 4) award('diversified_4')

  // Dettes
  if (game.mortgages.length === 0 && investments.some((i) => i.catalogId === 'parking' || i.catalogId === 'lmnp' || i.catalogId === 'immo_classique')) {
    award('no_debt')
  }

  // Marché crash
  if (game.economy.marketPhase === 'crash') {
    if (investments.some((i) => i.catalogId === 'bourse_etf')) award('survived_crash')
    if (investments.some((i) => i.catalogId === 'crypto')) award('crypto_survivor')
    const lastBuy = game.behavior?.lastBuyMonthIndex ?? -1
    if (lastBuy === (game.monthIndex ?? 0)) award('buy_in_crash')
  }

  // Streak
  const streak = game.streak
  if (streak) {
    if (streak.currentStreak >= 7) award('streak_7')
    if (streak.currentStreak >= 30) award('streak_30')
  }

  return newBadges
}

export function awardBadges(game: GameState, newIds: BadgeId[]): GameState {
  if (newIds.length === 0) return game
  const now = game.gameDateISO
  const mi = game.monthIndex ?? 0
  const newEarned: EarnedBadge[] = newIds.map((id) => ({
    id,
    earnedAtISO: now,
    earnedAtMonthIndex: mi,
  }))
  return {
    ...game,
    badges: [...(game.badges ?? []), ...newEarned],
    pendingBadges: [...(game.pendingBadges ?? []), ...newIds],
  }
}
