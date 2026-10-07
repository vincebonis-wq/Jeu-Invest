import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ArchipelApp } from './archipel/ArchipelApp'

// ARCHIPEL est le jeu par défaut. L'ancienne version reste accessible via ?classic.
const classic = new URLSearchParams(window.location.search).has('classic')

// Pas de StrictMode : la boucle de jeu en temps réel doit être montée une seule fois.
createRoot(document.getElementById('root')!).render(classic ? <App /> : <ArchipelApp />)
