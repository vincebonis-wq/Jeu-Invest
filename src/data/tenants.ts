import { pickOne, randInt } from '../engine/economy'

// ============================================================================
// Locataires nommés — transforment un bien immobilier (un chiffre) en une
// présence à laquelle le joueur s'attache. Quand un locataire part, on le ressent.
// ============================================================================

interface TenantTemplate {
  name: string
  job: string
  profile: 'professional' | 'student' | 'family'
}

const TENANT_TEMPLATES: TenantTemplate[] = [
  { name: 'Sophie', job: 'infirmière', profile: 'professional' },
  { name: 'Marc', job: 'ingénieur', profile: 'professional' },
  { name: 'Léa', job: 'étudiante en médecine', profile: 'student' },
  { name: 'Thomas', job: 'développeur web', profile: 'professional' },
  { name: 'Camille', job: 'professeure des écoles', profile: 'professional' },
  { name: 'la famille Durand', job: 'avec deux enfants', profile: 'family' },
  { name: 'Hugo', job: 'apprenti cuisinier', profile: 'student' },
  { name: 'Inès', job: 'graphiste freelance', profile: 'professional' },
  { name: 'la famille Moreau', job: 'jeunes parents', profile: 'family' },
  { name: 'Antoine', job: 'commercial', profile: 'professional' },
  { name: 'Sarah', job: 'étudiante en droit', profile: 'student' },
  { name: 'la famille Petit', job: 'trois enfants', profile: 'family' },
  { name: 'Julien', job: 'kinésithérapeute', profile: 'professional' },
  { name: 'Manon', job: 'doctorante', profile: 'student' },
  { name: 'Karim', job: 'chef de projet', profile: 'professional' },
]

const STORY_FRAGMENTS = [
  'Paye toujours à l\'heure.',
  'Aime beaucoup le quartier.',
  'Vient d\'emménager, tout neuf dans sa vie.',
  'Cherche la stabilité pour quelques années.',
  'Soigne le logement comme le sien.',
  'Discret et sans histoires.',
  'A signé pour un bail longue durée.',
  'Recommandé par l\'ancien locataire.',
]

export interface NamedTenant {
  tenantName: string
  tenantProfile: 'professional' | 'student' | 'family'
  tenantStory: string
}

/** Génère un locataire nommé avec une petite histoire. */
export function generateTenant(): NamedTenant {
  const t = pickOne(TENANT_TEMPLATES)
  const months = randInt(2, 30)
  const tenure =
    months < 12
      ? `Locataire depuis ${months} mois.`
      : `Locataire depuis ${Math.floor(months / 12)} an(s).`
  const article = t.name.startsWith('la ') ? '' : ', '
  return {
    tenantName: t.name,
    tenantProfile: t.profile,
    tenantStory: `${t.name}${article}${t.job}. ${tenure} ${pickOne(STORY_FRAGMENTS)}`.replace('  ', ' '),
  }
}
