import { create } from 'zustand'

// Mode d'affichage de l'app — totalement isolé de la sauvegarde de jeu.
// 'classic'  = app actuelle (défaut, intacte)
// 'citymap'  = beta "Carte Patrimoine" — vue visuelle par zones et slots
// 'mogul'    = beta "MOGUL" — jeu de décisions à balayer (gameplay alternatif, hors-ligne)
// 'coffres'  = beta "Coffres" — patrimoine tangible : récolter / retirer avec fiscalité réelle
// 'rentier'  = beta "Le Rentier" — atteindre la liberté par le cash-flow net d'impôt (tour par tour)
export type UiMode = 'classic' | 'citymap' | 'mogul' | 'coffres' | 'rentier'

const KEY = 'jeu-invest-uimode'

function loadMode(): UiMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'citymap' || v === 'classic' || v === 'mogul' || v === 'coffres' || v === 'rentier') return v
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
