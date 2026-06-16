import type { BusinessDecision } from '../types'

// ============================================================================
// Décisions stratégiques business — temps réel.
// Chaque business "vivant" propose périodiquement une décision à prendre.
// Le délai entre deux décisions est RÉEL (horloge du joueur), pas accéléré
// par la vitesse de jeu : un business demande une attention régulière mais
// non spammable, à l'image d'un jeu de gestion comme Sim Companies.
// ============================================================================

const HOUR = 3_600_000

/** Délai réel avant la prochaine décision, croissant avec la maturité du business. */
export function rollBusinessDecisionDelayMs(growthStage: number): number {
  const base = 18 * HOUR + growthStage * 6 * HOUR
  const jitter = (Math.random() - 0.5) * 8 * HOUR
  return Math.max(6 * HOUR, Math.round(base + jitter))
}

export const BUSINESS_DECISIONS: BusinessDecision[] = [
  {
    id: 'marketing_push',
    emoji: '📣',
    title: 'Campagne publicitaire',
    prompt: 'Une agence te propose une campagne pour booster ta visibilité. Quelle stratégie adoptes-tu ?',
    minGrowthStage: 0,
    options: [
      {
        id: 'invest_big',
        label: 'Investir massivement',
        description: 'Grosse campagne, gros risque, gros potentiel.',
        cost: 800,
        revenueMultiplier: 1.25,
        riskOfFailure: 0.3,
        failureRevenueMultiplier: 0.95,
      },
      {
        id: 'invest_modest',
        label: 'Budget mesuré',
        description: 'Une campagne ciblée, résultat plus modeste mais sûr.',
        cost: 250,
        revenueMultiplier: 1.08,
        riskOfFailure: 0.05,
        failureRevenueMultiplier: 1.0,
      },
      {
        id: 'skip',
        label: 'Ne rien faire',
        description: 'Tu gardes ton cash, mais sans croissance ce mois-ci.',
        cost: 0,
      },
    ],
  },
  {
    id: 'hire_employee',
    emoji: '🧑‍💼',
    title: 'Recruter quelqu\'un',
    prompt: 'Ton activité déborde. Faut-il embaucher pour soulager la charge ?',
    minGrowthStage: 0,
    options: [
      {
        id: 'hire',
        label: 'Recruter à temps plein',
        description: 'Charges fixes en hausse, mais capacité et qualité accrues.',
        cost: 0,
        revenueMultiplier: 1.18,
        costMultiplier: 1.25,
        growthStageDelta: 1,
      },
      {
        id: 'freelance',
        label: 'Sous-traiter ponctuellement',
        description: 'Solution flexible, gain plus limité.',
        cost: 300,
        revenueMultiplier: 1.07,
        costMultiplier: 1.05,
      },
      {
        id: 'skip',
        label: 'Gérer seul(e)',
        description: 'Pas de risque, mais pas de croissance.',
        cost: 0,
      },
    ],
  },
  {
    id: 'automation',
    emoji: '⚙️',
    title: 'Automatiser un processus',
    prompt: 'Un outil pourrait automatiser une partie de ton activité et réduire les coûts.',
    minGrowthStage: 1,
    options: [
      {
        id: 'full_automation',
        label: 'Automatisation complète',
        description: 'Investissement initial élevé, charges fortement réduites ensuite.',
        cost: 1500,
        costMultiplier: 0.78,
        growthStageDelta: 1,
      },
      {
        id: 'partial',
        label: 'Automatisation partielle',
        description: 'Compromis raisonnable.',
        cost: 500,
        costMultiplier: 0.92,
      },
      {
        id: 'skip',
        label: 'Garder le fonctionnement actuel',
        description: 'Aucun changement.',
        cost: 0,
      },
    ],
  },
  {
    id: 'new_product',
    emoji: '🚀',
    title: 'Lancer une nouvelle offre',
    prompt: 'Une opportunité de diversifier ton offre se présente. Tentes-tu le coup ?',
    minGrowthStage: 1,
    options: [
      {
        id: 'launch',
        label: 'Lancer le produit',
        description: 'Pari risqué mais potentiel de forte croissance du CA.',
        cost: 1000,
        revenueMultiplier: 1.35,
        riskOfFailure: 0.4,
        failureRevenueMultiplier: 0.9,
        growthStageDelta: 1,
      },
      {
        id: 'pilot',
        label: 'Tester en petit comité',
        description: 'Test à petite échelle, résultat limité mais peu risqué.',
        cost: 350,
        revenueMultiplier: 1.1,
        riskOfFailure: 0.1,
        failureRevenueMultiplier: 1.0,
      },
      {
        id: 'skip',
        label: 'Pas maintenant',
        description: 'Tu restes sur ton offre actuelle.',
        cost: 0,
      },
    ],
  },
  {
    id: 'supplier_negotiation',
    emoji: '🤝',
    title: 'Renégocier avec un fournisseur',
    prompt: 'Ton principal fournisseur ouvre la porte à une renégociation des tarifs.',
    minGrowthStage: 0,
    options: [
      {
        id: 'hard_negotiate',
        label: 'Négocier fermement',
        description: 'Tu pourrais obtenir une belle réduction… ou braquer ton fournisseur.',
        cost: 0,
        costMultiplier: 0.82,
        riskOfFailure: 0.25,
        failureRevenueMultiplier: 0.92,
      },
      {
        id: 'soft_negotiate',
        label: 'Négocier en douceur',
        description: 'Petite réduction garantie, relation préservée.',
        cost: 0,
        costMultiplier: 0.94,
      },
      {
        id: 'skip',
        label: 'Garder le contrat actuel',
        description: 'Aucun changement.',
        cost: 0,
      },
    ],
  },
  {
    id: 'competitor_response',
    emoji: '⚔️',
    title: 'Un concurrent baisse ses prix',
    prompt: 'Un concurrent direct casse les prix. Comment réagis-tu ?',
    minGrowthStage: 1,
    options: [
      {
        id: 'price_war',
        label: 'Baisser tes prix aussi',
        description: 'Tu protèges ta clientèle, mais ta marge en pâtit.',
        cost: 0,
        revenueMultiplier: 1.05,
        costMultiplier: 1.0,
        riskOfFailure: 0.2,
        failureRevenueMultiplier: 0.85,
      },
      {
        id: 'differentiate',
        label: 'Te différencier par la qualité',
        description: 'Tu investis dans la valeur perçue plutôt que le prix.',
        cost: 600,
        revenueMultiplier: 1.12,
      },
      {
        id: 'ignore',
        label: 'Ignorer la menace',
        description: 'Tu fais le pari que tes clients resteront fidèles.',
        cost: 0,
        riskOfFailure: 0.35,
        failureRevenueMultiplier: 0.88,
      },
    ],
  },
  {
    id: 'fundraising',
    emoji: '💰',
    title: 'Lever des fonds',
    prompt: 'Un investisseur s\'intéresse à ton business et propose un apport de capital.',
    minGrowthStage: 2,
    options: [
      {
        id: 'accept',
        label: 'Accepter l\'investissement',
        description: 'Capital frais immédiat, mais charges (reporting, attentes) en hausse.',
        cost: 0,
        revenueMultiplier: 1.3,
        costMultiplier: 1.15,
        growthStageDelta: 1,
      },
      {
        id: 'counter_offer',
        label: 'Contre-proposer des conditions plus dures',
        description: 'Tu tentes d\'obtenir mieux, au risque que l\'investisseur se retire.',
        cost: 0,
        revenueMultiplier: 1.2,
        riskOfFailure: 0.4,
        failureRevenueMultiplier: 1.0,
      },
      {
        id: 'decline',
        label: 'Rester indépendant',
        description: 'Tu gardes le contrôle total, croissance plus lente.',
        cost: 0,
      },
    ],
  },
  {
    id: 'international_expansion',
    emoji: '🌍',
    title: 'Expansion internationale',
    prompt: 'Ton activité a atteint une taille qui permet d\'envisager une expansion à l\'étranger.',
    minGrowthStage: 3,
    options: [
      {
        id: 'expand',
        label: 'Se lancer à l\'international',
        description: 'Gros investissement, potentiel de revenus très élevé.',
        cost: 4000,
        revenueMultiplier: 1.45,
        costMultiplier: 1.2,
        riskOfFailure: 0.3,
        failureRevenueMultiplier: 0.85,
        growthStageDelta: 1,
      },
      {
        id: 'regional',
        label: 'Étendre régionalement d\'abord',
        description: 'Approche progressive, risque limité.',
        cost: 1200,
        revenueMultiplier: 1.18,
      },
      {
        id: 'stay_local',
        label: 'Rester sur ton marché actuel',
        description: 'Tu consolides ta position plutôt que de t\'étendre.',
        cost: 0,
      },
    ],
  },
]

export const BUSINESS_DECISION_BY_ID: Record<string, BusinessDecision> = BUSINESS_DECISIONS.reduce(
  (acc, d) => { acc[d.id] = d; return acc },
  {} as Record<string, BusinessDecision>,
)

/** Choisit une décision adaptée au stade de croissance, en évitant les répétitions récentes. */
export function pickBusinessDecision(growthStage: number, history: string[]): BusinessDecision | null {
  const eligible = BUSINESS_DECISIONS.filter(
    (d) => d.minGrowthStage <= growthStage && !history.includes(d.id),
  )
  const pool = eligible.length > 0
    ? eligible
    : BUSINESS_DECISIONS.filter((d) => d.minGrowthStage <= growthStage)
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}
