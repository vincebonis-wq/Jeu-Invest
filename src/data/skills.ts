import type { GameSkill } from '../types'

// ============================================================================
// Arbre de compétences du joueur.
// Les compétences débloquent des types d'investissements et améliorent
// les rendements, le salaire ou la fiscalité.
// ============================================================================

export const SKILLS: GameSkill[] = [
  // TIER 0 — Auto-appris au démarrage
  {
    id: 'epargne_base',
    name: 'Épargne de base',
    category: 'financial',
    description: 'Maîtriser le Livret A, l\'urgence d\'un matelas de sécurité et les intérêts composés.',
    prerequisiteIds: [],
    trainingMonths: 0,
    cost: 0,
    benefits: ['Accès au Livret A', 'Compréhension des intérêts'],
    unlocks: ['livret'],
  },

  // TIER 1 — Premiers mois
  {
    id: 'gestion_budgetaire',
    name: 'Gestion budgétaire',
    category: 'professional',
    description: 'Construire un budget personnel, réduire les dépenses superflues et maximiser son taux d\'épargne.',
    prerequisiteIds: ['epargne_base'],
    trainingMonths: 1,
    cost: 0,
    benefits: ['Dépenses mensuelles −8%', 'Meilleure maîtrise des finances'],
    expenseReduction: 0.08,
  },
  {
    id: 'investissement_101',
    name: 'Investissement 101',
    category: 'financial',
    description: 'Comprendre la bourse, les ETF, les fonds euros et la diversification. Le passage obligé avant tout investissement sérieux.',
    prerequisiteIds: ['epargne_base'],
    trainingMonths: 2,
    cost: 200,
    benefits: ['Débloque Bourse / ETF', 'Débloque Assurance Vie', 'Base solide en finance'],
    unlocks: ['bourse_etf', 'assurance_vie'],
  },

  // TIER 2 — 6-12 mois
  {
    id: 'analyse_financiere',
    name: 'Analyse financière',
    category: 'financial',
    description: 'Lire les marchés, analyser les performances, construire une allocation optimale.',
    prerequisiteIds: ['investissement_101'],
    trainingMonths: 4,
    cost: 600,
    benefits: ['+15% sur les rendements ETF', 'Débloque Crowdfunding immo'],
    unlocks: ['crowdfunding_immo'],
    returnBonus: [{ category: 'bourse_etf', bonus: 0.015 }],
    minNetWorth: 5000,
  },
  {
    id: 'gestion_locative',
    name: 'Gestion locative',
    category: 'entrepreneurial',
    description: 'Gérer un bien : trouver des locataires, gérer les impayés, optimiser la rentabilité.',
    prerequisiteIds: ['gestion_budgetaire'],
    trainingMonths: 3,
    cost: 500,
    benefits: ['Débloque Parking / Box', 'Débloque SCPI'],
    unlocks: ['parking', 'scpi'],
    minNetWorth: 8000,
  },
  {
    id: 'negociation',
    name: 'Techniques de négociation',
    category: 'professional',
    description: 'Négocier prix d\'achat, conditions de crédit et augmentations salariales.',
    prerequisiteIds: ['gestion_locative'],
    trainingMonths: 3,
    cost: 500,
    benefits: ['Frais notaire −3% sur l\'immo', 'Taux crédit −0.3%', '+8% salaire'],
    mortgageRateReduction: 0.003,
    salaryBonus: 0.08,
    minNetWorth: 20000,
  },

  // TIER 3 — 12-24 mois
  {
    id: 'comptabilite_lmnp',
    name: 'Comptabilité LMNP',
    category: 'financial',
    description: 'Maîtriser le régime BIC, l\'amortissement du bâti et du mobilier, la déclaration LMNP.',
    prerequisiteIds: ['gestion_locative'],
    trainingMonths: 7,
    cost: 1500,
    benefits: ['Débloque LMNP (meublé)', 'Fiscalité LMNP optimisée'],
    unlocks: ['lmnp'],
    minNetWorth: 30000,
  },
  {
    id: 'investissement_immo',
    name: 'Investissement immobilier avancé',
    category: 'entrepreneurial',
    description: 'Maîtriser l\'effet de levier, l\'analyse de rentabilité nette et la gestion d\'un parc locatif.',
    prerequisiteIds: ['negociation', 'comptabilite_lmnp'],
    trainingMonths: 10,
    cost: 3000,
    benefits: ['Débloque Locatif classique', 'Taux crédit −0.5%'],
    unlocks: ['immo_classique'],
    mortgageRateReduction: 0.005,
    minNetWorth: 50000,
  },
  {
    id: 'entrepreneuriat',
    name: 'Entrepreneuriat digital',
    category: 'entrepreneurial',
    description: 'Créer, lancer et automatiser un business en ligne générant des revenus passifs scalables.',
    prerequisiteIds: ['analyse_financiere'],
    trainingMonths: 8,
    cost: 2500,
    benefits: ['Débloque Business Automatisé', 'Revenus variables potentiels'],
    unlocks: ['business'],
    minNetWorth: 25000,
  },
  {
    id: 'optimisation_fiscale',
    name: 'Optimisation fiscale',
    category: 'financial',
    description: 'Défiscalisation, niches fiscales, structure SCI/holding — réduire légalement l\'imposition.',
    prerequisiteIds: ['comptabilite_lmnp', 'analyse_financiere'],
    trainingMonths: 15,
    cost: 5000,
    benefits: ['Tous les impôts −20%'],
    taxReduction: 0.20,
    minNetWorth: 80000,
  },

  // TIER 4 — Expert (18-24 mois)
  {
    id: 'strategie_patrimoniale',
    name: 'Stratégie patrimoniale',
    category: 'financial',
    description: 'Structurer son patrimoine en holding, SCI, optimiser la transmission. Le niveau ultime de la gestion de fortune.',
    prerequisiteIds: ['optimisation_fiscale', 'investissement_immo'],
    trainingMonths: 24,
    cost: 12000,
    benefits: ['+25% salaire (conseil en gestion de patrimoine)', 'Statut Millionnaire facilité'],
    salaryBonus: 0.25,
    minNetWorth: 300000,
  },
]

export const SKILL_BY_ID: Record<string, GameSkill> = SKILLS.reduce(
  (acc, s) => { acc[s.id] = s; return acc },
  {} as Record<string, GameSkill>,
)

// Compétences apprises automatiquement au démarrage
export const AUTO_SKILLS = ['epargne_base']
