import type { EventTemplate } from '../types'

// ============================================================================
// Templates d'événements aléatoires.
// Les probabilités sont mensuelles. Les conditions filtrent l'éligibilité.
// impactRange en euros (négatif = coût). impactIsPercentOfSalary recalcule.
// ============================================================================

export const EVENT_TEMPLATES: EventTemplate[] = [
  // ----- EMPLOI -----
  {
    id: 'promotion',
    category: 'job',
    severity: 'good',
    title: 'Promotion ! 🎉',
    description:
      'Ton travail a payé : tu décroches une promotion. Ton salaire augmente de 12%.',
    monthlyProbability: 0.015,
    conditions: [{ type: 'isEmployed', value: 1 }],
    impactRange: [0, 0],
    cooldownMonths: 18,
  },
  {
    id: 'raise',
    category: 'job',
    severity: 'good',
    title: 'Augmentation annuelle',
    description: 'Ton employeur t\'accorde une augmentation de 4%.',
    monthlyProbability: 0.03,
    conditions: [{ type: 'isEmployed', value: 1 }],
    impactRange: [0, 0],
    cooldownMonths: 10,
  },
  {
    id: 'layoff',
    category: 'job',
    severity: 'bad',
    title: 'Licenciement économique 😰',
    description:
      'Mauvaise nouvelle : tu perds ton emploi. Ton salaire est réduit de 35% (chômage) jusqu\'à ce que tu rebondisses.',
    monthlyProbability: 0.003,
    conditions: [{ type: 'isEmployed', value: 1 }],
    impactRange: [0, 0],
    cooldownMonths: 24,
  },

  // ----- MARCHÉ -----
  {
    id: 'market_bonus',
    category: 'market',
    severity: 'good',
    title: 'Rallye boursier 📈',
    description:
      'Les marchés s\'envolent ! Tes placements en bourse profitent d\'un coup de boost exceptionnel.',
    monthlyProbability: 0.04,
    conditions: [{ type: 'hasCategory', value: 'bourse_etf' }],
    impactRange: [200, 2000],
  },
  {
    id: 'dividend_special',
    category: 'market',
    severity: 'good',
    title: 'Dividende exceptionnel',
    description: 'Ta SCPI verse un dividende exceptionnel ce trimestre.',
    monthlyProbability: 0.03,
    conditions: [{ type: 'hasCategory', value: 'scpi' }],
    impactRange: [100, 800],
  },

  // ----- IMMOBILIER -----
  {
    id: 'tenant_leaves',
    category: 'property',
    severity: 'warning',
    title: 'Départ d\'un locataire',
    description:
      'Un de tes locataires donne son préavis. Le logement sera vacant quelques mois, le temps de relouer.',
    monthlyProbability: 0.05,
    conditions: [{ type: 'hasRealEstate', value: 1 }],
    impactRange: [0, 0],
    cooldownMonths: 6,
  },
  {
    id: 'repair',
    category: 'property',
    severity: 'bad',
    title: 'Réparation urgente 🔧',
    description:
      'Une fuite/chaudière en panne dans un de tes biens. Les travaux sont à ta charge.',
    monthlyProbability: 0.04,
    conditions: [{ type: 'hasRealEstate', value: 1 }],
    impactRange: [-6000, -1200],
    cooldownMonths: 8,
    actionOptions: [
      { label: 'Payer la réparation', cost: 0, effect: 'pay_repair' },
      {
        label: 'Reporter (risque d\'aggravation)',
        cost: 0,
        effect: 'defer_repair',
      },
    ],
  },
  {
    id: 'rent_increase',
    category: 'property',
    severity: 'good',
    title: 'Révision de loyer',
    description:
      'Tu peux réviser tes loyers à la hausse (+3%) en accord avec l\'indice de référence.',
    monthlyProbability: 0.03,
    conditions: [{ type: 'hasRealEstate', value: 1 }],
    impactRange: [0, 0],
    cooldownMonths: 12,
  },
  {
    id: 'property_boom',
    category: 'property',
    severity: 'good',
    title: 'Plus-value immobilière',
    description:
      'Le quartier d\'un de tes biens devient très prisé : sa valeur grimpe nettement.',
    monthlyProbability: 0.02,
    conditions: [{ type: 'hasRealEstate', value: 1 }],
    impactRange: [0, 0],
    cooldownMonths: 12,
  },

  // ----- BUSINESS -----
  {
    id: 'viral',
    category: 'business',
    severity: 'good',
    title: 'Coup de buzz viral ! 🚀',
    description:
      'Ton business devient viral. Les revenus explosent ce mois-ci !',
    monthlyProbability: 0.04,
    conditions: [{ type: 'hasBusiness', value: 1 }],
    impactRange: [500, 5000],
  },
  {
    id: 'competitor',
    category: 'business',
    severity: 'warning',
    title: 'Nouveau concurrent',
    description:
      'Un concurrent agressif arrive sur ton marché. Tes marges sont sous pression ce mois-ci.',
    monthlyProbability: 0.04,
    conditions: [{ type: 'hasBusiness', value: 1 }],
    impactRange: [-2500, -400],
    cooldownMonths: 6,
  },
  {
    id: 'business_attention',
    category: 'business',
    severity: 'warning',
    title: 'Ton business a besoin de toi',
    description:
      'Sans suivi, ton business automatisé tourne au ralenti. Investis du temps (et un peu d\'argent) pour le relancer.',
    monthlyProbability: 0.05,
    conditions: [{ type: 'hasBusiness', value: 1 }],
    impactRange: [0, 0],
    cooldownMonths: 5,
    actionOptions: [
      { label: 'Réinvestir 1 000 €', cost: 1000, effect: 'business_boost' },
      { label: 'Ignorer (revenus en baisse)', cost: 0, effect: 'business_neglect' },
    ],
  },

  // ----- FISCAL -----
  {
    id: 'tax_audit',
    category: 'tax',
    severity: 'warning',
    title: 'Contrôle fiscal 📋',
    description:
      'L\'administration vérifie tes déclarations. Un petit redressement est appliqué.',
    monthlyProbability: 0.01,
    conditions: [{ type: 'minNetWorth', value: 100000 }],
    impactRange: [-5000, -800],
    cooldownMonths: 24,
  },
  {
    id: 'tax_credit',
    category: 'tax',
    severity: 'good',
    title: 'Crédit d\'impôt',
    description:
      'Bonne surprise : tu bénéficies d\'un crédit d\'impôt sur tes investissements.',
    monthlyProbability: 0.02,
    conditions: [{ type: 'minNetWorth', value: 20000 }],
    impactRange: [200, 1500],
    cooldownMonths: 12,
  },

  // ----- PERSONNEL -----
  {
    id: 'inheritance',
    category: 'personal',
    severity: 'good',
    title: 'Héritage inattendu 💌',
    description:
      'Un parent éloigné te lègue une somme d\'argent. Une belle opportunité à investir intelligemment.',
    monthlyProbability: 0.006,
    conditions: [],
    impactRange: [5000, 40000],
    cooldownMonths: 36,
  },
  {
    id: 'medical',
    category: 'personal',
    severity: 'bad',
    title: 'Dépense de santé',
    description: 'Des frais médicaux imprévus pèsent sur ton budget ce mois-ci.',
    monthlyProbability: 0.02,
    conditions: [],
    impactRange: [-3000, -500],
    cooldownMonths: 10,
  },
  {
    id: 'big_expense',
    category: 'personal',
    severity: 'warning',
    title: 'Imprévu coûteux',
    description:
      'Voiture en panne, électroménager à remplacer... un imprévu vide un peu ton compte.',
    monthlyProbability: 0.03,
    conditions: [],
    impactRange: [-2500, -400],
    cooldownMonths: 8,
  },
  {
    id: 'bonus',
    category: 'personal',
    severity: 'good',
    title: 'Prime / 13e mois',
    description: 'Tu reçois une prime. De quoi gonfler ton épargne !',
    monthlyProbability: 0.025,
    conditions: [{ type: 'isEmployed', value: 1 }],
    impactRange: [500, 3000],
    cooldownMonths: 11,
  },
  {
    id: 'lottery_small',
    category: 'personal',
    severity: 'good',
    title: 'Petit gain au jeu 🍀',
    description: 'La chance te sourit : un petit gain inattendu.',
    monthlyProbability: 0.008,
    conditions: [],
    impactRange: [200, 2000],
    cooldownMonths: 18,
  },

  // ----- ÉVÉNEMENTS DE VIE (arc narratif) -----
  {
    id: 'marriage',
    category: 'personal',
    severity: 'good',
    title: 'Tu te maries ! 💍',
    description:
      'Une nouvelle étape de vie. Les cadeaux des invités gonflent ton compte, et la vie à deux permet de mutualiser certaines charges.',
    monthlyProbability: 0.006,
    conditions: [{ type: 'minNetWorth', value: 5000 }],
    impactRange: [2000, 8000],
    cooldownMonths: 999, // une seule fois
  },
  {
    id: 'have_child',
    category: 'personal',
    severity: 'warning',
    title: 'Un enfant arrive ! 👶',
    description:
      'Une immense joie... et de nouvelles responsabilités. Tes charges mensuelles augmentent durablement pour subvenir à ses besoins.',
    monthlyProbability: 0.01,
    conditions: [{ type: 'minNetWorth', value: 8000 }],
    impactRange: [-1500, -500],
    cooldownMonths: 30,
  },
  {
    id: 'parent_help',
    category: 'personal',
    severity: 'bad',
    title: 'Aider un parent 🤝',
    description:
      'Un de tes parents traverse une difficulté de santé. Tu choisis de l\'aider financièrement, comme il se doit.',
    monthlyProbability: 0.008,
    conditions: [{ type: 'minNetWorth', value: 30000 }],
    impactRange: [-8000, -2000],
    cooldownMonths: 36,
  },
]

export const TEMPLATE_BY_ID: Record<string, EventTemplate> =
  EVENT_TEMPLATES.reduce(
    (acc, t) => {
      acc[t.id] = t
      return acc
    },
    {} as Record<string, EventTemplate>,
  )
