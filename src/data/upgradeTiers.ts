// Cost = catalog.minAmount × costMultiplier
// Timer starts when player pays, benefit applies when timer expires

export interface UpgradeTier {
  targetLevel: 2 | 3 | 4 | 5
  costMultiplier: number          // × catalog.minAmount
  realTimeSecs: number            // real-world seconds
  returnBonusPct: number          // CUMULATIVE bonus vs base rate
  label: string                   // shown in UI
}

export const UPGRADE_TIERS: UpgradeTier[] = [
  { targetLevel: 2, costMultiplier: 1.0,  realTimeSecs: 180,   returnBonusPct: 0.010, label: 'Développé' },
  { targetLevel: 3, costMultiplier: 2.5,  realTimeSecs: 1200,  returnBonusPct: 0.020, label: 'Avancé'    },
  { targetLevel: 4, costMultiplier: 6.0,  realTimeSecs: 7200,  returnBonusPct: 0.035, label: 'Expert'    },
  { targetLevel: 5, costMultiplier: 15.0, realTimeSecs: 43200, returnBonusPct: 0.055, label: 'Maître'    },
]

export function getTierForLevel(targetLevel: number): UpgradeTier | undefined {
  return UPGRADE_TIERS.find((t) => t.targetLevel === targetLevel)
}

export function getUpgradeCost(catalogMinAmount: number, targetLevel: number): number {
  const tier = getTierForLevel(targetLevel)
  if (!tier) return 0
  return Math.round(catalogMinAmount * tier.costMultiplier)
}

export function getLevelReturnBonus(level: number): number {
  if (level <= 1) return 0
  const tier = UPGRADE_TIERS.find((t) => t.targetLevel === level)
  return tier?.returnBonusPct ?? 0
}

// Bonus de niveau — valeur ABSOLUE en points de % à ADDITIONNER au taux de base.
// Les actifs conservateurs ont des plafonds plus bas que les actifs dynamiques.
const CONSERVATIVE_BONUS_PER_LEVEL: Record<string, number> = {
  livret:           0.005, // +0,5 %/niv → max +2 %  (1,5 % → 3,5 %)
  or_metaux:        0.005, // +0,5 %/niv → max +2 %  (5,5 % → 7,5 %)
  obligations_etat: 0.005, // +0,5 %/niv → max +2 %  (3,5 % → 5,5 %)
  assurance_vie:    0.007, // +0,7 %/niv → max +2,8 % (4 % → 6,8 %)
  scpi:             0.008, // +0,8 %/niv → max +3,2 % (5 % → 8,2 %)
}

export function getInvestmentLevelBonus(catalogId: string, level: number): number {
  if (level <= 1) return 0
  const perLevel = CONSERVATIVE_BONUS_PER_LEVEL[catalogId]
  if (perLevel !== undefined) return (level - 1) * perLevel
  return getLevelReturnBonus(level)
}

// Label d'upgrade contextuel selon l'investissement
export function getUpgradeLabel(catalogId: string): string {
  if (catalogId === 'livret') return 'Optimisation bancaire'
  return 'Amélioration'
}

export const LEVEL_LABELS = ['', 'Découverte', 'Développé', 'Avancé', 'Expert', 'Maître']

// Inline lookup arrays (index = targetLevel)
export const COST_MULTIPLIERS = [0, 0, 1.0, 2.5, 6.0, 15.0]
export const TIER_SECS        = [0, 0, 180, 1200, 7200, 43200]
export const TIER_LABELS      = ['', '', '3 min', '20 min', '2h', '12h']
