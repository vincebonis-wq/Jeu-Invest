import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ArchipelApp } from './archipel/ArchipelApp'
import { RentierApp } from './rentier/RentierApp'

// RENTIER INC. est le jeu par défaut. ?archipel et ?classic gardent les versions précédentes.
const q = new URLSearchParams(window.location.search)
const root = q.has('classic') ? <App /> : q.has('archipel') ? <ArchipelApp /> : <RentierApp />

// Pas de StrictMode : la boucle de jeu en temps réel doit être montée une seule fois.
createRoot(document.getElementById('root')!).render(root)
