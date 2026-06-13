import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Pas de StrictMode : la boucle de jeu en temps réel doit être montée une seule
// fois (StrictMode double-monte les effets en dev et fausserait la progression).
createRoot(document.getElementById('root')!).render(<App />)
