import { create } from 'zustand'

// Mode d'affichage de l'app — totalement isolé de la sauvegarde de jeu.
// 'classic'  = app actuelle (défaut, intacte)
// 'citymap'  = beta "Carte Patrimoine" — vue visuelle par zones et slots
// 'mogul'    = beta "MOGUL" — jeu de décisions à balayer (gameplay alternatif, hors-ligne)
// 'coffres'  = beta "Coffres" — patrimoine tangible : récolter / retirer avec fiscalité réelle
export type UiMode = 'classic' | 'citymap' | 'mogul' | 'coffres'

const KEY = 'jeu-invest-uimode'

function loadMode(): UiMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'citymap' || v === 'classic' || v === 'mogul' || v === 'coffres') return v
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
