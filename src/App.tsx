import { useEffect } from 'react'
import { useGameStore, selectPendingAction } from './store/gameStore'
import { CharacterCreation } from './components/game/CharacterCreation'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { Toaster } from './components/layout/Toaster'
import { Dashboard } from './components/game/Dashboard'
import { Marketplace } from './components/game/Marketplace'
import { Portfolio } from './components/game/Portfolio'
import { Properties } from './components/game/Properties'
import { Events } from './components/game/Events'
import { Stats } from './components/game/Stats'
import { Job } from './components/game/Job'
import { Skills } from './components/game/Skills'
import { FirstStepModal } from './components/game/FirstStepModal'
import { Modal } from './components/ui/Modal'
import { Button } from './components/ui/Button'
import { formatEuroSigned } from './utils/formatting'

const SCREENS = {
  dashboard: Dashboard,
  marketplace: Marketplace,
  portfolio: Portfolio,
  properties: Properties,
  events: Events,
  stats: Stats,
  job: Job,
  skills: Skills,
}

const SCREEN_TITLES: Record<string, string> = {
  dashboard: 'Tableau de bord',
  marketplace: 'Investir',
  portfolio: 'Portefeuille',
  properties: 'Mes biens',
  events: 'Actualités',
  stats: 'Statistiques',
  job: 'Mon Emploi',
  skills: 'Compétences',
}

export default function App() {
  const game = useGameStore((s) => s.game)
  const screen = useGameStore((s) => s.screen)
  const loadGame = useGameStore((s) => s.loadGame)
  const saveGame = useGameStore((s) => s.saveGame)
  const stopLoop = useGameStore((s) => s.stopLoop)

  // Chargement initial + sauvegarde sur fermeture/onglet caché.
  useEffect(() => {
    loadGame()
    const onHide = () => {
      if (document.visibilityState === 'hidden') saveGame()
    }
    const onUnload = () => saveGame()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
      stopLoop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!game) {
    return <CharacterCreation />
  }

  const ScreenComponent = SCREENS[screen]

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6">
          <div className="max-w-5xl mx-auto">
            <h1 className="font-display font-extrabold text-2xl text-slate-800 mb-4 hidden lg:block">
              {SCREEN_TITLES[screen]}
            </h1>
            <ScreenComponent />
          </div>
        </main>
      </div>
      <Toaster />
      <PendingActionModal />
      <FirstStepModal />
    </div>
  )
}

/** Modal bloquant pour les événements qui exigent une décision. */
function PendingActionModal() {
  const pending = useGameStore(selectPendingAction)
  const resolveEvent = useGameStore((s) => s.resolveEvent)

  if (!pending || !pending.actionOptions) return null

  return (
    <Modal open onClose={() => {}} title={pending.title} size="sm" closable={false}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{pending.description}</p>
        {pending.financialImpact !== 0 && (
          <div className="text-center font-display font-bold text-lg text-red-500">
            {formatEuroSigned(pending.financialImpact)}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {pending.actionOptions.map((action, i) => (
            <Button
              key={i}
              variant={i === 0 ? 'primary' : 'secondary'}
              fullWidth
              onClick={() => resolveEvent(pending.id, i)}
            >
              {action.label}
              {action.cost > 0 && ` (-${action.cost} €)`}
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
