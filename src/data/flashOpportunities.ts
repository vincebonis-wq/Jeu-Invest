import type { InvestmentCategory } from '../types'

interface FlashTemplate {
  catalogId: InvestmentCategory
  label: string
  descriptions: string[]
  bonusPct: number
  minAmount: number
  durationMs: number  // durée réelle en ms
}

// Génère des opportunités flash rares (1-2 par semaine de jeu).
// Chaque template peut spawner avec une petite variation de description.
export const FLASH_TEMPLATES: FlashTemplate[] = [
  {
    catalogId: 'livret',
    label: 'Taux boosté — Offre spéciale',
    descriptions: [
      'La banque lance une promo : Livret A à taux majoré pour 5 minutes. Profite !',
      'Opération de collecte bancaire : rendement Livret boosté pour les prochaines minutes.',
    ],
    bonusPct: 0.01,
    minAmount: 500,
    durationMs: 5 * 60_000,
  },
  {
    catalogId: 'bourse_etf',
    label: 'ETF en soldes — Frais offerts',
    descriptions: [
      'Flash sale : frais de transaction offerts + bonus de rendement sur les ETF World. Limité à 5 min.',
      'Courtier partenaire : commissions à zéro + yield boost sur ETF. Maintenant ou jamais.',
    ],
    bonusPct: 0.025,
    minAmount: 1000,
    durationMs: 5 * 60_000,
  },
  {
    catalogId: 'crowdfunding_immo',
    label: 'Projet immo exclusif',
    descriptions: [
      'Un promoteur cherche des financeurs en urgence. Rendement majoré pour les 10 premières minutes.',
      'Crowdfunding en dernier tour : le ticket restant offre un bonus de rendement exceptionnel.',
    ],
    bonusPct: 0.02,
    minAmount: 5000,
    durationMs: 8 * 60_000,
  },
  {
    catalogId: 'or_metaux',
    label: 'Or en dip — Achat groupé',
    descriptions: [
      'Achat groupé de lingots : frais de custody offerts et prime en moins ce soir uniquement.',
      'L\'once d\'or recule légèrement — fenêtre d\'achat avec remise sur les frais (6 min).',
    ],
    bonusPct: 0.015,
    minAmount: 1000,
    durationMs: 6 * 60_000,
  },
  {
    catalogId: 'scpi',
    label: 'Parts SCPI — Offre revendeur',
    descriptions: [
      'Investisseur qui revend ses parts SCPI : pas de délai d\'entrée, rendement majoré.',
      'Cession de parts SCPI de second marché : entrée immédiate sans frais de souscription habituels.',
    ],
    bonusPct: 0.015,
    minAmount: 10000,
    durationMs: 7 * 60_000,
  },
  {
    catalogId: 'assurance_vie',
    label: 'Assurance Vie — Promo entrée',
    descriptions: [
      'Nouvelle compagnie partenaire : bonus de 1 % sur les versements pendant 5 minutes.',
      'Offre de bienvenue : rendement majoré sur fonds euros pour les versements de la journée.',
    ],
    bonusPct: 0.01,
    minAmount: 500,
    durationMs: 5 * 60_000,
  },
]

let flashIdCounter = 0

export function pickRandomFlash(excludeRecent: string[] = []) {
  const available = FLASH_TEMPLATES.filter(
    (t) => !excludeRecent.includes(t.catalogId),
  )
  if (available.length === 0) return FLASH_TEMPLATES[Math.floor(Math.random() * FLASH_TEMPLATES.length)]
  return available[Math.floor(Math.random() * available.length)]
}

export function generateFlashOpportunity(template: FlashTemplate) {
  flashIdCounter += 1
  const desc = template.descriptions[Math.floor(Math.random() * template.descriptions.length)]
  return {
    id: `flash_${Date.now()}_${flashIdCounter}`,
    catalogId: template.catalogId,
    label: template.label,
    description: desc,
    bonusPct: template.bonusPct,
    minAmount: template.minAmount,
    expiresAtReal: Date.now() + template.durationMs,
    claimed: false,
  }
}
