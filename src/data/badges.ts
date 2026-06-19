import type { BadgeId, Badge } from '../types'

export const BADGES: Badge[] = [
  { id: 'first_investment', name: 'Premier pas', emoji: '🌱', description: 'Tu as réalisé ton premier investissement !', category: 'milestone' },
  { id: 'speed_investor', name: 'Lancé !', emoji: '⚡', description: 'Investi dès le premier mois. Tu n\'hésites pas !', category: 'special' },
  { id: 'livret_full', name: 'Livret saturé', emoji: '💰', description: 'Livret A au plafond — le moment de diversifier.', category: 'milestone' },
  { id: 'first_etf', name: 'Boursier', emoji: '📈', description: 'Premier pied dans la bourse mondiale.', category: 'milestone' },
  { id: 'first_real_estate', name: 'Propriétaire', emoji: '🏠', description: 'Premier bien immobilier acquis.', category: 'milestone' },
  { id: 'first_business', name: 'Entrepreneur', emoji: '🚀', description: 'Premier business automatisé lancé.', category: 'milestone' },
  { id: 'diversified_4', name: 'Diversifié', emoji: '🎯', description: '4 classes d\'actifs différentes en portefeuille.', category: 'behavior' },
  { id: 'survived_crash', name: 'Tempête essuyée', emoji: '⛈️', description: 'Tu as tenu tes positions pendant un krach. Bravo.', category: 'market' },
  { id: 'crypto_survivor', name: 'HODL', emoji: '🪙', description: 'Tu as gardé ta crypto pendant un krach sans paniquer.', category: 'market' },
  { id: 'passive_income_500', name: 'Rentier junior', emoji: '💸', description: '500 €/mois de revenus passifs. La machine tourne.', category: 'milestone' },
  { id: 'passive_income_salary', name: 'Liberté financière', emoji: '🕊️', description: 'Revenus passifs ≥ salaire. Tu es libre.', category: 'special' },
  { id: 'net_worth_10k', name: 'Épargnant', emoji: '⭐', description: 'Patrimoine franchi 10 000 €.', category: 'milestone' },
  { id: 'net_worth_50k', name: 'Investisseur', emoji: '⭐⭐', description: 'Patrimoine franchi 50 000 €.', category: 'milestone' },
  { id: 'net_worth_100k', name: 'Cent millier', emoji: '🌟', description: 'Patrimoine franchi 100 000 €.', category: 'milestone' },
  { id: 'net_worth_500k', name: 'Demi-million', emoji: '💎', description: 'Patrimoine franchi 500 000 €.', category: 'milestone' },
  { id: 'millionnaire', name: 'Millionnaire', emoji: '👑', description: 'Patrimoine > 1 000 000 €. L\'élite du patrimoine.', category: 'special' },
  { id: 'no_debt', name: 'Sans dette', emoji: '✅', description: 'Tous tes crédits sont remboursés.', category: 'behavior' },
  { id: 'streak_7', name: 'Habitué', emoji: '🔥', description: '7 jours de connexion consécutifs.', category: 'behavior' },
  { id: 'streak_30', name: 'Investisseur acharné', emoji: '🔥🔥', description: '30 jours de connexion consécutifs !', category: 'special' },
  { id: 'buy_in_crash', name: 'Contrarian', emoji: '🦅', description: 'Tu as acheté pendant un krach. Pensée à long terme.', category: 'market' },
]

export const BADGE_BY_ID: Record<BadgeId, Badge> = BADGES.reduce(
  (acc, b) => { acc[b.id] = b; return acc },
  {} as Record<BadgeId, Badge>,
)
