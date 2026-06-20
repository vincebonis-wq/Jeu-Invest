import type { QuestChainTemplate } from '../types'

export const QUEST_CHAINS: QuestChainTemplate[] = [
  {
    id: 'premiers_pas',
    title: 'Les Premiers Pas',
    description: 'Pose les fondations de ton empire financier',
    emoji: '🌱',
    steps: [
      {
        id: 'pp_1',
        label: 'Ouvre ton premier placement',
        narrative: 'Tout voyage commence par un premier pas. L\'argent qui dort perd 2 % par an à cause de l\'inflation.',
        conditionType: 'n_investments',
        conditionTarget: 1,
        rewardCash: 500,
      },
      {
        id: 'pp_2',
        label: 'Atteins 5 000 € de patrimoine',
        narrative: 'La règle des petits ruisseaux : 5k€, c\'est le début de l\'effet boule de neige.',
        conditionType: 'net_worth',
        conditionTarget: 5000,
        rewardCash: 1000,
      },
      {
        id: 'pp_3',
        label: 'Diversifie sur 2 classes d\'actifs',
        narrative: 'Ne mets pas tous tes œufs dans le même panier. La diversification réduit le risque global.',
        conditionType: 'investment_class_count',
        conditionTarget: 2,
        rewardCash: 1500,
      },
      {
        id: 'pp_4',
        label: 'Génère 100 €/mois en passif',
        narrative: 'Tes actifs travaillent pendant que tu dors. 100 € passifs / mois = 1 200 € offerts par an.',
        conditionType: 'passive_income_monthly',
        conditionTarget: 100,
        rewardCash: 2000,
      },
    ],
  },
  {
    id: 'voie_immo',
    title: 'La Voie de l\'Immobilier',
    description: 'Bâtis ton patrimoine sur la pierre',
    emoji: '🏠',
    steps: [
      {
        id: 'vi_1',
        label: 'Achète ton premier bien immobilier',
        narrative: 'L\'immobilier, valeur refuge depuis des siècles. Parking, LMNP ou locatif classique — l\'important, c\'est de commencer.',
        conditionType: 'buy_real_estate',
        conditionTarget: 1,
        rewardCash: 2000,
      },
      {
        id: 'vi_2',
        label: '500 €/mois de revenus locatifs',
        narrative: 'Les loyers rentrent régulièrement. La machine à cash immobilière est lancée.',
        conditionType: 'passive_income_monthly',
        conditionTarget: 500,
        rewardCash: 2000,
      },
      {
        id: 'vi_3',
        label: 'Rénove un bien (niveau 1)',
        narrative: 'Un bien rénové se valorise et attire de meilleurs locataires. C\'est l\'investissement dans l\'investissement.',
        conditionType: 'renovated_count',
        conditionTarget: 1,
        rewardCash: 1500,
      },
      {
        id: 'vi_4',
        label: '1 500 €/mois de revenus locatifs',
        narrative: 'Tu es maintenant un propriétaire bailleur professionnel. L\'immobilier fait partie intégrante de ton plan de liberté.',
        conditionType: 'passive_income_monthly',
        conditionTarget: 1500,
        rewardCash: 5000,
      },
    ],
  },
  {
    id: 'vers_liberte',
    title: 'Vers la Liberté',
    description: 'Le chemin de la liberté financière totale',
    emoji: '🦅',
    steps: [
      {
        id: 'vl_1',
        label: 'Cap 50 000 € de patrimoine',
        narrative: '50k€ : le seuil psychologique. Tu n\'es plus un débutant. Les intérêts composés commencent à vraiment jouer.',
        conditionType: 'net_worth',
        conditionTarget: 50000,
        rewardCash: 3000,
      },
      {
        id: 'vl_2',
        label: 'Possède 5 placements actifs',
        narrative: 'Un portefeuille diversifié est un portefeuille résilient. 5 sources de rendement, 5 fois moins de risque concentré.',
        conditionType: 'n_investments',
        conditionTarget: 5,
        rewardCash: 3000,
      },
      {
        id: 'vl_3',
        label: 'Cap 200 000 € de patrimoine',
        narrative: '200k€ : à ce stade, chaque point de rendement représente 2 000 €/an. Les intérêts font le gros du travail.',
        conditionType: 'net_worth',
        conditionTarget: 200000,
        rewardCash: 10000,
      },
      {
        id: 'vl_4',
        label: 'Deviens millionnaire',
        narrative: 'Tu as rejoint le club des millionnaires. Et ce n\'est que le début — à 1M€, le patrimoine s\'auto-entretient.',
        conditionType: 'net_worth',
        conditionTarget: 1000000,
        rewardCash: 50000,
      },
    ],
  },
]

export const QUEST_CHAIN_BY_ID: Record<string, QuestChainTemplate> = Object.fromEntries(
  QUEST_CHAINS.map((c) => [c.id, c]),
)
