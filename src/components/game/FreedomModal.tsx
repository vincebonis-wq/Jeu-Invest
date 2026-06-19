import { useGameStore } from '../../store/gameStore'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { calcMonthlyPassiveIncome } from '../../utils/calculations'
import { formatEuro } from '../../utils/formatting'

// ============================================================================
// Point de bascule — le moment peak du jeu : les revenus passifs couvrent
// les charges. Pause forcée, célébration mémorable.
// ============================================================================

export function FreedomModal() {
  const pending = useGameStore((s) => s.game?.pendingFreedom)
  const game = useGameStore((s) => s.game)
  const dismiss = useGameStore((s) => s.dismissFreedom)

  if (!pending || !game) return null

  const passive = Math.round(calcMonthlyPassiveIncome(game))
  const expenses = Math.round(game.monthlyExpenses.total)
  const surplus = passive - expenses

  return (
    <Modal open onClose={() => {}} closable={false} size="md">
      <div className="text-center space-y-5 py-2">
        <div className="text-6xl animate-pop-in">🕊️</div>

        <div>
          <h2 className="font-display font-extrabold text-2xl bg-gradient-to-r from-emerald-500 to-brand-600 bg-clip-text text-transparent">
            Indépendance financière
          </h2>
          <p className="text-slate-600 mt-2 leading-relaxed max-w-sm mx-auto">
            Tes revenus passifs couvrent désormais toutes tes charges.
            <br />
            <strong className="text-slate-800">
              Tu n'as plus <em>besoin</em> de travailler pour vivre.
            </strong>
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-brand-50 border border-emerald-100 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Revenus passifs</span>
            <span className="font-bold text-emerald-600">{formatEuro(passive)}/mois</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Charges</span>
            <span className="font-bold text-slate-700">{formatEuro(expenses)}/mois</span>
          </div>
          <div className="flex justify-between text-sm border-t border-emerald-200 pt-2">
            <span className="font-semibold text-slate-700">Surplus mensuel libre</span>
            <span className="font-display font-extrabold text-emerald-600">
              +{formatEuro(surplus)}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 italic px-4">
          « À partir de maintenant, chaque euro de salaire est un bonus, plus une obligation.
          Tu joues désormais pour bâtir, plus pour survivre. »
        </p>

        <Button fullWidth size="lg" variant="gold" onClick={dismiss}>
          Savourer ce moment ✨
        </Button>
      </div>
    </Modal>
  )
}
