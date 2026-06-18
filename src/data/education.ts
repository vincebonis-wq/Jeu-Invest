import type { InvestmentCategory } from '../types'

// ============================================================================
// Contenu pédagogique pour chaque type d'investissement.
// Affiché dans une pop-up "En savoir plus" depuis la Marketplace.
// ============================================================================

export interface InvestmentEdu {
  tagline: string
  howItWorks: string
  whenToUse: string
  watchOut: string
  example: string
}

export const INVESTMENT_EDU: Record<InvestmentCategory, InvestmentEdu> = {
  livret: {
    tagline: 'Ton coffre-fort de départ',
    howItWorks:
      'Tu déposes ton argent, il rapporte 1,5 %/an sans aucun risque. Disponible à tout moment, zéro impôt.',
    whenToUse:
      "Dès le tout début, et toujours : garde ici 3 à 6 mois de charges comme épargne de précaution avant d'investir ailleurs.",
    watchOut:
      "Le rendement est faible : l'inflation grignote ton pouvoir d'achat. N'y laisse pas dormir tout ton capital sur le long terme.",
    example:
      '10 000 € sur le Livret A → +150 €/an, garantis. Parfait pour ne jamais être pris au dépourvu.',
  },
  assurance_vie: {
    tagline: 'Le couteau suisse du patrimoine',
    howItWorks:
      "Une enveloppe qui capitalise ~4 %/an (fonds euros, capital garanti). Les intérêts s'ajoutent au capital chaque année.",
    whenToUse:
      "Pour une épargne de moyen/long terme plus rentable que le Livret A, avec une fiscalité très douce après 8 ans de détention.",
    watchOut:
      "Si tu retires avant 8 ans, les gains sont taxés à 30 %. Au-delà, un abattement de 4 600 € s'applique : la patience paie.",
    example:
      'Ouvre-la tôt même avec peu : le compteur des 8 ans démarre, et tu débloques l\'avantage fiscal plus vite.',
  },
  bourse_etf: {
    tagline: 'Le moteur de croissance long terme',
    howItWorks:
      "Un ETF World suit des milliers d'entreprises mondiales. Rendement historique ~8 %/an, mais la valeur monte ET descend.",
    whenToUse:
      "Pour faire croître ton capital sur 5 ans et plus. C'est l'actif clé pour battre l'inflation et viser la liberté financière.",
    watchOut:
      "Volatil : en krach, ta valeur peut chuter de 30 %. Ne mets que de l'argent dont tu n'as pas besoin à court terme, et ne vends jamais en panique.",
    example:
      "Acheter pendant un krach, c'est acheter en soldes. Les marchés finissent toujours par repartir.",
  },
  crowdfunding_immo: {
    tagline: 'Prêter aux promoteurs immobiliers',
    howItWorks:
      "Tu finances un chantier immobilier et touches 8 à 10 %/an d'intérêts. L'argent est bloqué jusqu'à la fin du projet (3-5 ans).",
    whenToUse:
      "Quand tu as déjà une épargne solide et que tu cherches un rendement élevé sur une somme que tu peux immobiliser.",
    watchOut:
      "Argent bloqué : impossible de récupérer avant l'échéance. Et si le promoteur fait faillite, tu peux perdre ta mise.",
    example:
      '5 000 € à 9 % bloqués 4 ans → environ +1 800 € d\'intérêts. Diversifie sur plusieurs projets.',
  },
  scpi: {
    tagline: "L'immobilier sans les soucis",
    howItWorks:
      "Tu achètes des parts d'un parc immobilier géré par des pros. Tu touches des loyers (dividendes) réguliers, ~5 %/an.",
    whenToUse:
      "Pour des revenus passifs immobiliers sans gérer de locataires, dès quelques milliers d'euros disponibles.",
    watchOut:
      "Frais d'entrée élevés (~10 %) : c'est un placement de long terme. La revente des parts peut prendre du temps.",
    example:
      '10 000 € de SCPI → ~500 €/an de loyers versés sans rien gérer.',
  },
  business: {
    tagline: 'Créer une machine à cash',
    howItWorks:
      "Tu lances un business en ligne (e-commerce, SaaS...). Potentiel de revenus très élevé, mais variable et exigeant.",
    whenToUse:
      "Quand tu as du capital, des compétences entrepreneuriales et l'envie de viser de gros revenus actifs.",
    watchOut:
      "Très risqué et volatil : un business peut exploser comme s'effondrer. Il demande de l'attention régulière.",
    example:
      'Un business qui marche peut rapporter plus que tout le reste — mais beaucoup échouent. À diversifier.',
  },
  parking: {
    tagline: "La porte d'entrée de l'immobilier",
    howItWorks:
      "Tu achètes une place de parking ou un box et le loues. Rendement stable 6-8 %/an, gestion minimale.",
    whenToUse:
      "Pour débuter dans l'immobilier locatif avec un petit budget, et tester l'effet de levier du crédit.",
    watchOut:
      "Frais de notaire (~8 %) à l'achat. Le marché de revente est local et parfois lent.",
    example:
      'Avec un crédit, tu peux acheter un parking en n\'apportant que 20 % : la banque finance le reste.',
  },
  lmnp: {
    tagline: 'Louer meublé, payer moins d\'impôts',
    howItWorks:
      "Tu achètes et meubles un logement pour le louer. Les loyers sont réguliers, et l'amortissement réduit fortement tes impôts.",
    whenToUse:
      "Quand tu maîtrises la fiscalité immobilière et veux des revenus locatifs peu ou pas imposés.",
    watchOut:
      "Capital important, gestion d'un vrai logement et de locataires. Frais de notaire et mobilier à prévoir.",
    example:
      "L'amortissement LMNP peut rendre tes loyers quasi non imposables pendant des années.",
  },
  immo_classique: {
    tagline: 'Le pilier du patrimoine français',
    howItWorks:
      "Tu achètes un appartement loué nu. Revenus locatifs stables et fort effet de levier grâce au crédit immobilier.",
    whenToUse:
      "Pour construire un gros patrimoine sur le long terme en faisant travailler l'argent de la banque.",
    watchOut:
      "Fiscalité des revenus fonciers plus lourde, gestion locative, vacance possible. Engagement de long terme.",
    example:
      "Un bien à 100 000 € financé à crédit : tes locataires remboursent l'emprunt, et le bien t'appartient au final.",
  },
  produit_structure: {
    tagline: 'Le compromis rendement/protection',
    howItWorks:
      "Un produit financier structuré par une banque : ton capital est partiellement protégé (barrière à −60%), et tu bénéficies d'un rendement annuel plafonné à 10 %. Durée fixe de 3 ans.",
    whenToUse:
      "Quand tu veux un rendement supérieur aux fonds euros (4 %) sans prendre le risque total de la bourse. Idéal avec un patrimoine de 30 000 € et plus.",
    watchOut:
      "En cas de chute des marchés de plus de 60 %, la protection saute et tu peux perdre en capital. Argent bloqué 3 ans sans possibilité de sortie anticipée.",
    example:
      "100 000 € investis : si les marchés progressent, tu touches 6 à 10 %/an. Si les marchés baissent mais restent au-dessus de −60 %, ton capital est protégé.",
  },
}
