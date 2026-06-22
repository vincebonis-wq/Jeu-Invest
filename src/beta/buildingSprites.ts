// Chargement automatique des sprites de bâtiments.
//
// Vite scanne le dossier ./assets/buildings au build. Dès qu'un fichier
// nommé <catalogId>.png|webp|jpg y est déposé, il devient disponible ici.
// Aucun code à modifier pour ajouter un sprite — il suffit de respecter
// le nom (voir assets/buildings/README.md).

import type { InvestmentCategory } from '../types'

// import.meta.glob avec eager → map { './assets/buildings/livret.png': '/assets/livret-xyz.png' }
const modules = import.meta.glob('./assets/buildings/*.{png,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

// Réindexe par catalogId (nom de fichier sans extension ni chemin).
const SPRITES: Partial<Record<InvestmentCategory, string>> = {}
for (const [path, url] of Object.entries(modules)) {
  const fileName = path.split('/').pop() ?? ''
  const id = fileName.replace(/\.(png|webp|jpe?g)$/i, '') as InvestmentCategory
  SPRITES[id] = url
}

/** Retourne l'URL du sprite pour un type d'investissement, ou undefined si absent. */
export function getBuildingSprite(catalogId: InvestmentCategory): string | undefined {
  return SPRITES[catalogId]
}

/** True si au moins un sprite a été déposé (active le rendu image plutôt qu'icône). */
export function hasAnySprite(): boolean {
  return Object.keys(SPRITES).length > 0
}
