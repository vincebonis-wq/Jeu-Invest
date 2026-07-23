/**
 * La Tour — table des archétypes d'étage.
 *
 * Chaque type d'actif a : un TIER (position verticale, 0 = fondations en bas,
 * 3 = penthouse flottant en haut), un ARCHÉTYPE (style visuel de l'étage), et
 * une largeur relative (les fondations sont larges, le penthouse est étroit).
 */

import type { InvestmentCategory } from '../../types'

export type FloorArchetype = 'foundation' | 'residential' | 'office' | 'trading' | 'venture' | 'penthouse'

export interface FloorMeta {
  tier: number        // 0 (bas) → 3 (haut)
  archetype: FloorArchetype
  width: number       // % de la largeur de la tour
}

export const FLOOR_META: Record<InvestmentCategory, FloorMeta> = {
  // Tier 0 — fondations (coffres, base solide)
  parking:          { tier: 0, archetype: 'foundation',  width: 112 }, // sous-sol le plus large
  livret:           { tier: 0, archetype: 'foundation',  width: 104 },
  assurance_vie:    { tier: 0, archetype: 'foundation',  width: 100 },
  obligations_etat: { tier: 0, archetype: 'foundation',  width: 100 },
  or_metaux:        { tier: 0, archetype: 'foundation',  width: 96  },
  // Tier 1 — immobilier / rendement
  immo_classique:   { tier: 1, archetype: 'residential', width: 92 },
  lmnp:             { tier: 1, archetype: 'residential', width: 90 },
  club_deal_immo:   { tier: 1, archetype: 'residential', width: 94 },
  scpi:             { tier: 1, archetype: 'office',      width: 86 },
  crowdfunding_immo:{ tier: 1, archetype: 'office',      width: 84 },
  // Tier 2 — finance / business
  business:         { tier: 2, archetype: 'venture',     width: 88 },
  bourse_etf:       { tier: 2, archetype: 'trading',     width: 82 },
  produit_structure:{ tier: 2, archetype: 'trading',     width: 80 },
  // Tier 3 — crypto (penthouse néon flottant)
  crypto:           { tier: 3, archetype: 'penthouse',   width: 72 },
}

export function floorMeta(id: InvestmentCategory): FloorMeta {
  return FLOOR_META[id] ?? { tier: 1, archetype: 'residential', width: 90 }
}

// Ciel dynamique selon la phase de marché (economy.ts)
export const SKY: Record<string, { bg: string; label: string; emoji: string }> = {
  bull:    { bg: 'linear-gradient(180deg, #f59e0b33 0%, #7c3aed22 22%, #0f1e3d 55%, #070d1e 100%)', label: 'Marché haussier', emoji: '🌅' },
  neutral: { bg: 'linear-gradient(180deg, #1e3a8a55 0%, #0f1e3d 50%, #070d1e 100%)',                 label: 'Marché stable',    emoji: '🌆' },
  bear:    { bg: 'linear-gradient(180deg, #33415577 0%, #1e293b 45%, #070d1e 100%)',                 label: 'Marché baissier',  emoji: '🌧️' },
  crash:   { bg: 'linear-gradient(180deg, #7f1d1d66 0%, #18181b 40%, #000000 100%)',                 label: 'Krach',            emoji: '⛈️' },
}
