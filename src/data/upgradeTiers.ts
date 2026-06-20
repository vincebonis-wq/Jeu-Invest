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
  { targetLevel: 2, costMultiplier: 1.0,  realTimeSecs: 180,   returnBonusPct: 0.01,  label: 'Développé'    },
  { targetLevel: 3, costMultiplier: 2.5,  realTimeSecs: 1200,  returnBonusPct: 0.025, label: 'Avancé'       },
  { targetLevel: 4, costMultiplier: 6.0,  realTimeSecs: 7200,  returnBonusPct: 0.04,  label: 'Expert'       },
  { targetLevel: 5, costMultiplier: 15.0, realTimeSecs: 43200, returnBonusPct: 0.06,  label: 'Maître'       },
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

// Certains investissements ont un bonus de niveau différent du standard.
// Livret A : +0,5 %/niveau (renégociation de taux avec la banque).
export function getInvestmentLevelBonus(catalogId: string, level: number): number {
  if (level <= 1) return 0
  if (catalogId === 'livret') return (level - 1) * 0.005
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
