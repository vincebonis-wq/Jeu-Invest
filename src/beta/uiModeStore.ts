import { create } from 'zustand'

// Mode d'affichage de l'app — totalement isolé de la sauvegarde de jeu.
// 'classic' = app actuelle (défaut, intacte)
// 'base'    = beta "Base à construire" (style Boom Beach)
// 'city'    = beta "Ville / Empire" (skyline qui grandit)
export type UiMode = 'classic' | 'base' | 'city'

const KEY = 'jeu-invest-uimode'

function loadMode(): UiMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'base' || v === 'city' || v === 'classic') return v
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
