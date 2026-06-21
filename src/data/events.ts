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
    educationTip: '💡 Astuce : chaque augmentation est une opportunité. Si tu investis la totalité de la hausse dès le début, tu ne remarqueras pas la différence sur ton train de vie — mais ton patrimoine, lui, s\'en souviendra.',
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
    educationTip: '💡 Résilience financière : 3 à 6 mois de dépenses en épargne de précaution protègent contre les aléas professionnels. Des revenus passifs couvrant ne serait-ce que 20 % des dépenses réduisent considérablement le stress.',
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
    educationTip: '💡 Les ETF World/S&P 500 captent automatiquement la croissance des plus grandes entreprises mondiales. Depuis 1950, le S&P 500 a affiché un rendement annuel moyen de ~10 % (avant inflation).',
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
    educationTip: '💡 Les dividendes et revenus SCPI sont imposés à la flat tax de 30 % (PFU : 12,8 % d\'IR + 17,2 % de prélèvements sociaux). L\'option barème peut être plus avantageuse si tu es faiblement imposé.',
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
    educationTip: '💡 La vacance locative est le principal risque de l\'immobilier locatif. Un rendement brut ≥ 6 % permet d\'absorber 1 à 2 mois de vacance par an sans impact négatif sur le cashflow.',
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
    educationTip: '💡 En LMNP (Location Meublée Non Professionnelle), les travaux de réparation et d\'entretien sont déductibles des revenus locatifs. Garde toujours tes justificatifs de dépenses.',
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
    educationTip: '💡 La révision annuelle du loyer est encadrée par l\'IRL (Indice de Référence des Loyers), publié trimestriellement par l\'INSEE. En 2023, il était de +3,5 %. Hors IRL, toute hausse est illégale.',
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
    educationTip: '💡 La plus-value immobilière est imposée à 36,2 % (19 % d\'IR + 17,2 % de prélèvements sociaux). Des abattements s\'appliquent selon la durée de détention : exonération totale après 22 ans (IR) et 30 ans (PS).',
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
    educationTip: '💡 En cas de contrôle fiscal, la charge de la preuve appartient à l\'administration pour les revenus déclarés. Conserve tous tes justificatifs 6 ans (durée de prescription fiscale en France).',
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
    educationTip: '💡 Le crédit d\'impôt est une réduction directe de l\'impôt dû (et peut générer un remboursement s\'il dépasse l\'impôt). À ne pas confondre avec la déduction fiscale, qui réduit uniquement la base imposable.',
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
    educationTip: '💡 Les héritages entre parents et enfants bénéficient d\'un abattement de 100 000 € tous les 15 ans avant taxation. Stratégie pro : les donations de son vivant permettent de transmettre à moindre coût fiscal.',
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
    educationTip: '💡 Une mutuelle bien calibrée et une épargne de précaution de 3 à 6 mois de dépenses évitent de devoir liquider tes investissements en cas de coup dur. L\'assurance est un outil de gestion du risque, pas un luxe.',
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
    educationTip: '💡 Les primes sont fiscalisées comme le salaire. Stratégie gagnante : investir immédiatement avant de s\'y habituer (lifestyle creep). +200 €/mois placés à 7 %/an = +100 000 € en 20 ans.',
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

  // ----- LOCATIF NARRATIF -----
  {
    id: 'loyer_impaye',
    category: 'property',
    severity: 'bad',
    title: 'Loyer impayé ce mois 😰',
    description:
      'Ton locataire n\'a pas réglé son loyer ce mois-ci. Il dit traverser une période difficile. Que fais-tu ?',
    monthlyProbability: 0.03,
    conditions: [{ type: 'hasRealEstate', value: 1 }],
    impactRange: [0, 0],
    cooldownMonths: 10,
    actionOptions: [
      { label: 'Lui laisser du temps (perte ce mois)', cost: 0, effect: 'accept_vacancy' },
      { label: 'Relance officielle (risque de conflit)', cost: 0, effect: 'no_effect' },
    ],
    educationTip: '💡 La garantie loyers impayés (GLI) coûte 2 à 4 % du loyer annuel mais couvre impayés et dégradations. Alternative : caution simple ou caution solidaire. La GLI se rentabilise dès le premier mois impayé.',
  },
  {
    id: 'travaux_copropriete',
    category: 'property',
    severity: 'warning',
    title: 'Travaux de copropriété votés 🏗️',
    description:
      'L\'assemblée générale a voté des travaux de ravalement de façade. Ta quote-part obligatoire est prélevée. En contrepartie, la valeur du bâtiment progresse.',
    monthlyProbability: 0.025,
    conditions: [{ type: 'hasRealEstate', value: 1 }],
    impactRange: [-4500, -1500],
    cooldownMonths: 18,
  },
  {
    id: 'dpe_renovation',
    category: 'property',
    severity: 'warning',
    title: 'DPE F/G — obligation de travaux 🌡️',
    description:
      'Ton bien est classé F ou G. La loi imposera des travaux d\'isolation dans les prochaines années. Anticiper coûte moins cher et booste le loyer. Attendre, c\'est prendre un risque légal.',
    monthlyProbability: 0.02,
    conditions: [{ type: 'hasRealEstate', value: 1 }],
    impactRange: [0, 0],
    cooldownMonths: 24,
    actionOptions: [
      { label: 'Anticiper les travaux maintenant (2 500 €)', cost: 2500, effect: 'dpe_now' },
      { label: 'Attendre la mise en demeure', cost: 0, effect: 'no_effect' },
    ],
    educationTip: '💡 Les biens classés G seront interdits à la location dès 2025, F en 2028. Rénover augmente la valeur du bien et permet une majoration du loyer. MaPrimeRénov\' peut couvrir jusqu\'à 70 % des travaux.',
  },

  // ----- ÉVÉNEMENTS INTERACTIFS -----
  {
    id: 'rupture_conventionnelle',
    category: 'job',
    severity: 'warning',
    title: 'Proposition de rupture conventionnelle',
    description:
      'Ton employeur te propose une rupture conventionnelle à l\'amiable avec une indemnité de départ. C\'est une opportunité : prendre l\'argent et rebondir, ou rester en poste ?',
    monthlyProbability: 0.012,
    conditions: [{ type: 'isEmployed', value: 1 }, { type: 'minNetWorth', value: 15000 }],
    impactRange: [0, 0],
    cooldownMonths: 30,
    actionOptions: [
      { label: 'Accepter (indemnité 4 mois de salaire)', cost: 0, effect: 'accept_severance' },
      { label: 'Refuser et rester en poste', cost: 0, effect: 'no_effect' },
    ],
  },
  {
    id: 'rachat_business',
    category: 'business',
    severity: 'good',
    title: 'Offre de rachat de ton business 💼',
    description:
      'Un groupe industriel a repéré ton business automatisé et propose de le racheter. L\'offre est solide. Vendre maintenant ou continuer à encaisser les revenus ?',
    monthlyProbability: 0.015,
    conditions: [{ type: 'hasBusiness', value: 1 }, { type: 'minNetWorth', value: 30000 }],
    impactRange: [0, 0],
    cooldownMonths: 24,
    actionOptions: [
      { label: 'Vendre le business (×1,5 valeur actuelle)', cost: 0, effect: 'sell_business' },
      { label: 'Refuser — les revenus récurrents valent plus', cost: 0, effect: 'no_effect' },
    ],
  },
  {
    id: 'co_investissement_ami',
    category: 'market',
    severity: 'warning',
    title: 'Ton ami te propose un co-investissement 🤝',
    description:
      'Un ami de confiance a repéré une opportunité spéculative. Les chiffres sont séduisants mais le risque est réel. Mise petite, mise grande, ou décline ?',
    monthlyProbability: 0.018,
    conditions: [{ type: 'minNetWorth', value: 8000 }],
    impactRange: [0, 0],
    cooldownMonths: 10,
    actionOptions: [
      { label: 'Investir 3 000 € (risque élevé, gain potentiel ×2)', cost: 3000, effect: 'speculative_big' },
      { label: 'Investir 1 000 € (risque modéré)', cost: 1000, effect: 'speculative_small' },
      { label: 'Décliner poliment', cost: 0, effect: 'no_effect' },
    ],
  },
  {
    id: 'renegociation_loyer',
    category: 'property',
    severity: 'warning',
    title: 'Ton locataire veut renégocier 🏠',
    description:
      'Ton locataire te demande une baisse de loyer de 8%, menaçant de partir sinon. Tu as un candidat en attente mais une vacance de 2 mois serait inévitable.',
    monthlyProbability: 0.04,
    conditions: [{ type: 'hasRealEstate', value: 1 }],
    impactRange: [0, 0],
    cooldownMonths: 12,
    actionOptions: [
      { label: 'Accepter −8% (zéro vacance)', cost: 0, effect: 'renegotiate_rent' },
      { label: 'Refuser — il part, tu reloues dans 2 mois', cost: 0, effect: 'accept_vacancy' },
    ],
  },
  {
    id: 'dip_marche',
    category: 'market',
    severity: 'warning',
    title: 'Correction de marché — occasion ou piège ?',
    description:
      'Les marchés ont corrigé de 15% ce mois-ci. Certains y voient le début d\'un krach, d\'autres une fenêtre d\'achat historique. Ton instinct dit quoi ?',
    monthlyProbability: 0.025,
    conditions: [{ type: 'minNetWorth', value: 5000 }],
    impactRange: [0, 0],
    cooldownMonths: 8,
    actionOptions: [
      { label: 'Acheter le creux — injecter 3 000 €', cost: 3000, effect: 'buy_the_dip' },
      { label: 'Attendre et observer', cost: 0, effect: 'no_effect' },
      { label: 'Sécuriser — vendre 10% de mes ETF', cost: 0, effect: 'panic_sell' },
    ],
  },
  {
    id: 'heritage_choix',
    category: 'personal',
    severity: 'good',
    title: 'Héritage — investir ou profiter ? 💌',
    description:
      'Tu reçois un héritage de 12 000 €. Deux options : tout investir immédiatement pour maximiser les intérêts composés, ou en profiter pour améliorer ton cadre de vie.',
    monthlyProbability: 0.005,
    conditions: [],
    impactRange: [0, 0],
    cooldownMonths: 48,
    actionOptions: [
      { label: 'Tout investir (12 000 € en portefeuille)', cost: 0, effect: 'invest_heritage' },
      { label: 'Moitié investie, moitié plaisir (6 000 €)', cost: 0, effect: 'half_heritage' },
      { label: 'Profiter — réduire les charges 3 mois', cost: 0, effect: 'enjoy_heritage' },
    ],
  },

  // ----- CRYPTO -----
  {
    id: 'crypto_crash',
    category: 'market',
    severity: 'bad',
    title: 'Crypto : effondrement brutal 🔴',
    description:
      'Le marché des cryptos s\'effondre — BTC plonge de 60% en quelques heures. Panique généralisée. Vendre en catastrophe ou tenir la position ?',
    monthlyProbability: 0.04,
    conditions: [{ type: 'hasCategory', value: 'crypto' }],
    impactRange: [0, 0],
    cooldownMonths: 18,
    actionOptions: [
      { label: 'HODL — tenir la position (perte latente ~60%)', cost: 0, effect: 'crypto_hodl' },
      { label: 'Vendre maintenant — limiter les dégâts', cost: 0, effect: 'crypto_sell_crash' },
    ],
    educationTip: '💡 Le Bitcoin a perdu plus de 80 % de sa valeur à trois reprises depuis 2010. Règle de base : n\'investir en crypto que ce qu\'on peut se permettre de perdre intégralement (max 5-10 % du portefeuille).',
  },
  {
    id: 'crypto_halving',
    category: 'market',
    severity: 'good',
    title: 'Bitcoin Halving 📈',
    description:
      'Le halving Bitcoin vient de se produire — l\'émission est divisée par 2. Historiquement, cette réduction d\'offre déclenche un bull run de 12 à 18 mois.',
    monthlyProbability: 0.015,
    conditions: [{ type: 'hasCategory', value: 'crypto' }],
    impactRange: [0, 0],
    cooldownMonths: 48,
    educationTip: '💡 Le halving divise par 2 la récompense des mineurs de Bitcoin, réduisant l\'offre nouvelle. Historiquement, les cours ont progressé dans les 12-18 mois suivants — mais les performances passées ne garantissent pas les performances futures.',
  },
  {
    id: 'crypto_regulation',
    category: 'market',
    severity: 'warning',
    title: 'Régulation crypto — taxation renforcée 📋',
    description:
      'L\'UE annonce un durcissement de la fiscalité sur les plus-values crypto : taux effectif rehaussé à 37%. À prendre en compte dans ta stratégie d\'allocation.',
    monthlyProbability: 0.025,
    conditions: [{ type: 'hasCategory', value: 'crypto' }],
    impactRange: [-1200, -600],
    cooldownMonths: 24,
  },

  // ----- SAISONNIERS -----
  {
    id: 'tax_declaration',
    category: 'tax',
    severity: 'info',
    title: '📋 Déclaration d\'impôts — c\'est le moment',
    description: 'Mai arrive : c\'est la saison de la déclaration fiscale. Tous tes revenus de l\'année passée sont à déclarer en ligne avant la date limite.',
    monthlyProbability: 1.0,
    conditions: [],
    impactRange: [0, 0],
    triggerMonth: 5,
    cooldownMonths: 11,
    educationTip: '💡 La déclaration pré-remplie couvre les salaires mais PAS les revenus du capital (dividendes, loyers, plus-values). Vérifier les cases 2DC, 2TR et 3VG te permettra d\'éviter un redressement fiscal.',
  },
  {
    id: 'prime_fin_annee',
    category: 'job',
    severity: 'good',
    title: '🎁 Prime de fin d\'année',
    description: 'La direction verse une prime exceptionnelle de fin d\'année à l\'ensemble des salariés.',
    monthlyProbability: 0.7,
    conditions: [{ type: 'isEmployed', value: 1 }],
    impactRange: [800, 2500],
    triggerMonth: 12,
    cooldownMonths: 11,
    educationTip: '💡 Stratégie gagnante : investir immédiatement la prime avant de s\'y habituer (lifestyle creep). +1 500 € investis à 7 %/an chaque décembre = +65 000 € en 20 ans.',
  },
  {
    id: 'soldes_hiver',
    category: 'personal',
    severity: 'warning',
    title: '🛍️ Soldes d\'hiver — attention au budget',
    description: 'Les soldes battent leur plein en janvier. La tentation de dépenser est forte, mais chaque euro non dépensé peut travailler pour toi.',
    monthlyProbability: 0.8,
    conditions: [],
    impactRange: [-500, -100],
    triggerMonth: 1,
    cooldownMonths: 11,
    educationTip: '💡 Le marketing des soldes crée un sentiment d\'urgence artificiel. Règle des 48h : attendre 2 jours avant tout achat non planifié élimine 80 % des achats impulsifs. L\'argent non dépensé s\'investit.',
  },
  {
    id: 'remboursement_impots',
    category: 'tax',
    severity: 'good',
    title: '💰 Remboursement d\'impôts',
    description: 'L\'administration fiscale te rembourse un trop-perçu suite à ta déclaration. Une belle somme disponible pour investir.',
    monthlyProbability: 0.6,
    conditions: [],
    impactRange: [300, 1500],
    triggerMonth: 7,
    cooldownMonths: 11,
    educationTip: '💡 Un remboursement d\'impôts signifie que tu as trop payé en acomptes tout au long de l\'année. Idéalement, ajuste tes acomptes pour que cet argent soit disponible toute l\'année (et investi).',
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
