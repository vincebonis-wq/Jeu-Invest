import { create } from 'zustand'

// Mode d'affichage de l'app — totalement isolé de la sauvegarde de jeu.
// 'classic'  = app actuelle (défaut, intacte)
// 'citymap'  = beta "Carte Patrimoine" — vue visuelle par zones et slots
// 'mogul'    = beta "MOGUL" — jeu de décisions à balayer (gameplay alternatif, hors-ligne)
// 'coffres'  = beta "Coffres" — patrimoine tangible : récolter / retirer avec fiscalité réelle
// 'rentier'  = beta "Le Rentier" — atteindre la liberté par le cash-flow net d'impôt (tour par tour)
// 'tour'     = beta "La Tour" — empire vertical qui monte à chaque achat (patrimoine tangible)
// 'flux'     = beta "Le Flux" — raffinerie à capital : l'argent coule, l'impôt est une vanne (mode eau)
// 'ratrace'  = beta "Rat Race" — un seul but : sortir de la course (passifs nets > dépenses)
export type UiMode = 'classic' | 'citymap' | 'mogul' | 'coffres' | 'rentier' | 'tour' | 'flux' | 'ratrace'

const KEY = 'jeu-invest-uimode'

function loadMode(): UiMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'citymap' || v === 'classic' || v === 'mogul' || v === 'coffres' || v === 'rentier' || v === 'tour' || v === 'flux' || v === 'ratrace') return v
  } catch {
    /* ignore */
  }
  return 'classic'
}

interface UiModeStore {
  mode: UiMode
  setMode: (m: UiMode) => void
}

export const useUiMode = create<UiModeStore>((set) => ({
  mode: loadMode(),
  setMode: (mode) => {
    try {
      localStorage.setItem(KEY, mode)
    } catch {
      /* ignore */
    }
    set({ mode })
  },
}))
