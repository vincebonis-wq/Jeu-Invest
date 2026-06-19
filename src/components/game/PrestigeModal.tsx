import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { formatEuroCompact } from '../../utils/formatting'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

interface Props {
  onClose: () => void
}

export function PrestigeModal({ onClose }: Props) {
  const game = useGameStore((s) => s.game)!
  const prestigeAction = useGameStore((s) => s.prestige)
  const [confirming, setConfirming] = useState(false)

  const currentLevel = game.prestige?.level ?? 0
  const nextLevel = currentLevel + 1

  const bonusTable = [
    { extraStartingCash: 5000, returnBonusPct: 0.05, salaryBonusPct: 0, earlyUnlock: false },
    { extraStartingCash: 15000, returnBonusPct: 0.10, salaryBonusPct: 0.05, earlyUnlock: false },
    { extraStartingCash: 30000, returnBonusPct: 0.15, salaryBonusPct: 0.10, earlyUnlock: true },
    { extraStartingCash: 60000, returnBonusPct: 0.20, salaryBonusPct: 0.15, earlyUnlock: true },
    { extraStartingCash: 100000, returnBonusPct: 0.25, salaryBonusPct: 0.20, earlyUnlock: true },
  ]
  const bonusIdx = Math.min(nextLevel - 1, bonusTable.length - 1)
  const nextBonus = bonusTable[bonusIdx]

  const badgeCount = (game.badges ?? []).length
  const longestStreak = game.streak?.longestStreak ?? 0

  function handleConfirm() {
    prestigeAction()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Recommencer avec héritage" size="sm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-600/10 border border-violet-200">
          <div className="text-3xl">🏰</div>
          <div>
            <div className="font-display font-bold text-slate-800">Prestige niveau {nextLevel}</div>
            <div className="text-sm text-slate-500">
              Tu as atteint le Millionnaire. Tu peux tout recommencer avec des avantages permanents.
            </div>
          </div>
        </div>

        {/* Niveau actuel → suivant */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-400 mb-1">Niveau actuel</div>
            <div className="font-display font-bold text-slate-700">{currentLevel === 0 ? 'Aucun' : `Niveau ${currentLevel}`}</div>
          </div>
          <div className="p-3 rounded-xl bg-violet-50 border border-violet-200">
            <div className="text-xs text-violet-400 mb-1">Prochain niveau</div>
            <div className="font-display font-bold text-violet-700">Niveau {nextLevel}</div>
          </div>
        </div>

        {/* Bonus du prochain niveau */}
        <div className="p-4 rounded-2xl bg-violet-50 border border-violet-200">
          <div className="font-semibold text-violet-800 mb-3">Bonus héritage niveau {nextLevel}</div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Cash de départ</span>
              <span className="font-bold text-green-600">+{formatEuroCompact(nextBonus.extraStartingCash)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Bonus rendements</span>
              <span className="font-bold text-green-600">+{Math.round(nextBonus.returnBonusPct * 100)}%</span>
            </div>
            {nextBonus.salaryBonusPct > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Bonus salaire</span>
                <span className="font-bold text-green-600">+{Math.round(nextBonus.salaryBonusPct * 100)}%</span>
              </div>
            )}
            {nextBonus.earlyUnlock && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Déblocage accéléré</span>
                <span className="font-bold text-green-600">Actif</span>
              </div>
            )}
          </div>
        </div>

        {/* Ce que tu perds */}
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
          <div className="font-semibold text-red-700 mb-2">Tu perds</div>
          <ul className="text-sm text-red-600 space-y-1">
            <li>• Tous tes investissements ({formatEuroCompact(calcNetWorth(game))} de patrimoine)</li>
            <li>• Ton cash actuel ({formatEuroCompact(game.cashBalance)})</li>
            <li>• Tes compétences acquises</li>
            <li>• Ta progression actuelle</li>
          </ul>
        </div>

        {/* Ce que tu conserves */}
        <div className="p-4 rounded-2xl bg-green-50 border border-green-200">
          <div className="font-semibold text-green-700 mb-2">Tu conserves</div>
          <ul className="text-sm text-green-600 space-y-1">
            <li>• Tes badges ({badgeCount} trophées)</li>
            <li>• Ton meilleur streak ({longestStreak} jours)</li>
            <li>👑 Niveau de prestige {nextLevel}</li>
          </ul>
        </div>

        <p className="text-xs text-slate-400 text-center font-semibold">
          ⚠️ Cette action est irréversible
        </p>

        {!confirming ? (
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={onClose}>Annuler</Button>
            <Button
              variant="danger"
              fullWidth
              onClick={() => setConfirming(true)}
            >
              Relancer ma lignée →
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-center text-slate-600 font-semibold">Tu es sûr ? Cette action est irréversible.</p>
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setConfirming(false)}>Non, garder</Button>
              <Button
                variant="danger"
                fullWidth
                onClick={handleConfirm}
              >
                Oui, relancer !
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
