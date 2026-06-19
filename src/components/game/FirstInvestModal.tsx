import { useGameStore } from '../../store/gameStore'
import { Confetti } from '../ui/Confetti'
import { playFanfare } from '../../utils/sounds'
import { formatEuroCompact } from '../../utils/formatting'
import { useEffect } from 'react'

// Célébration du premier investissement + projection à 10 ans.
// Apparaît une seule fois, juste après le premier achat.
export function FirstInvestModal() {
  const game = useGameStore((s) => s.game)
  const dismissBadge = useGameStore((s) => s.dismissBadge)

  const isPending = (game?.pendingBadges ?? []).includes('first_investment')
  const isFirst = (game?.badges ?? []).length <= 2 // badge tout frais
  const open = isPending && isFirst && (game?.investments?.length ?? 0) >= 1

  useEffect(() => { if (open) playFanfare() }, [open])

  if (!open || !game) return null

  const inv = game.investments[0]
  const annualRate = inv?.annualReturnRate ?? 0.05
  const val = inv?.currentValue ?? 0

  const proj = (years: number) => Math.round(val * Math.pow(1 + annualRate, years))

  function close() { dismissBadge('first_investment') }

  return (
    <>
      <Confetti active duration={4000} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">

          <div className="bg-gradient-to-br from-emerald-400 to-teal-600 p-6 text-white text-center">
            <div className="text-5xl mb-2">🌱</div>
            <div className="font-display font-extrabold text-2xl">Ton argent travaille !</div>
            <div className="text-sm text-white/80 mt-1">Premier investissement réalisé. La machine est lancée.</div>
          </div>

          <div className="p-5 space-y-4">
            {/* Projection */}
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
                Projection à taux constant ({Math.round(annualRate * 100)} %/an)
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[5, 10, 20].map((y) => (
                  <div key={y} className="rounded-xl bg-white border border-slate-200 p-2.5">
                    <div className="text-[11px] text-slate-400 font-medium mb-0.5">{y} ans</div>
                    <div className="font-display font-bold text-brand-600 text-sm">
                      {formatEuroCompact(proj(y))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2.5 text-center">
                Sans investir un centime de plus — grâce aux intérêts composés.
              </p>
            </div>

            <div className="rounded-2xl bg-brand-50 border border-brand-100 p-3 text-sm text-brand-800">
              💡 <strong>Règle des 72 :</strong> à {Math.round(annualRate * 100)} %/an, ton capital double en <strong>{Math.round(72 / (annualRate * 100))} ans</strong>.
            </div>
          </div>

          <div className="px-5 pb-5">
            <button
              onClick={close}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-display font-bold rounded-2xl hover:from-emerald-600 hover:to-teal-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
            >
              Continuer à investir →
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
