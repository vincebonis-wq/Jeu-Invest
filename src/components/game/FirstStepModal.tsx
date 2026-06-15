import { PiggyBank, ArrowRight } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { formatEuro } from '../../utils/formatting'

export function FirstStepModal() {
  const game = useGameStore((s) => s.game)
  const triggerAutoBuy = useGameStore((s) => s.triggerAutoBuy)
  const dismissTutorial = useGameStore((s) => s.dismissTutorial)

  if (!game) return null
  // Apparaît au tout début, tant qu'aucun placement n'a été fait.
  if (game.tutorialDismissed || game.investments.length > 0) return null

  function handleGo() {
    dismissTutorial()
    triggerAutoBuy('livret')
  }

  return (
    <Modal open onClose={() => {}} title="Ton tout premier pas 👣" size="sm" closable={false}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white p-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
            <PiggyBank size={30} />
          </div>
          <div className="font-display font-extrabold text-lg mb-1">
            Commençons par le Livret A
          </div>
          <p className="text-sm text-white/85 leading-relaxed">
            C'est l'épargne sans risque, disponible à tout moment, qui rapporte 1,5 %/an.
            Le réflexe de tout bon investisseur : sécuriser son argent avant de viser plus haut.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4 text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Ton cash disponible</span>
            <span className="font-bold text-slate-800">{formatEuro(game.cashBalance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Rendement Livret A</span>
            <span className="font-semibold text-emerald-600">1,5 % / an · 0 impôt</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center">
          Clique ci-dessous : on t'emmène directement au bon endroit.
        </p>

        <Button fullWidth size="lg" variant="primary" onClick={handleGo}>
          <PiggyBank size={18} /> Placer mon argent sur le Livret A <ArrowRight size={16} />
        </Button>
      </div>
    </Modal>
  )
}
