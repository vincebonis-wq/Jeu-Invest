import { useState } from 'react'
import { Check, Copy, Share2, X } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth, calcMonthlyPassiveIncome, MILESTONE_INFO } from '../../utils/calculations'
import { formatEuroCompact } from '../../utils/formatting'

// Carte de partage virale — apparaît sur Stats et après la liberté financière.
export function ShareModal({ onClose }: { onClose: () => void }) {
  const game = useGameStore((s) => s.game)!
  const [copied, setCopied] = useState(false)

  const netWorth = calcNetWorth(game)
  const passiveIncome = calcMonthlyPassiveIncome(game)
  const milestoneInfo = MILESTONE_INFO[game.player.milestone]
  const yearsPlayed = Math.round((game.monthIndex ?? 0) / 12 * 10) / 10
  const passiveRatio = game.player.salary > 0
    ? Math.round((passiveIncome / game.player.salary) * 100)
    : 0

  const shareText = [
    `🏆 J'ai atteint le statut "${milestoneInfo.label}" dans Patrimoine !`,
    ``,
    `💰 Patrimoine : ${formatEuroCompact(netWorth)}`,
    `💸 Revenus passifs : ${formatEuroCompact(passiveIncome)}/mois${passiveRatio > 0 ? ` (${passiveRatio} % de mon salaire)` : ''}`,
    `📈 ${game.investments.length} investissement${game.investments.length > 1 ? 's' : ''} en portefeuille`,
    `⏱️ En ${yearsPlayed < 1 ? `${game.monthIndex ?? 0} mois` : `${yearsPlayed} an${yearsPlayed > 1 ? 's' : ''}`} de jeu`,
    ``,
    `Joue aussi → https://patrimoine.game`,
  ].join('\n')

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ text: shareText }); return } catch { /* ignore */ }
    }
    await navigator.clipboard.writeText(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* Carte visuelle */}
        <div className="bg-gradient-to-br from-brand-500 via-indigo-600 to-purple-700 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X size={16} />
          </button>

          <div className="text-center mb-4">
            <div className="text-4xl mb-1">{milestoneInfo.icon ? '🏆' : '⭐'}</div>
            <div className="font-display font-extrabold text-xl">{milestoneInfo.label}</div>
            <div className="text-white/70 text-sm mt-0.5">
              en {yearsPlayed < 1 ? `${game.monthIndex ?? 0} mois` : `${yearsPlayed} an${yearsPlayed > 1 ? 's' : ''}`} de jeu
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <div className="text-xs text-white/60 mb-0.5">Patrimoine</div>
              <div className="font-display font-extrabold text-lg">{formatEuroCompact(netWorth)}</div>
            </div>
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <div className="text-xs text-white/60 mb-0.5">Rev. passifs</div>
              <div className="font-display font-extrabold text-lg">{formatEuroCompact(passiveIncome)}/m</div>
            </div>
          </div>

          <div className="mt-3 text-center text-white/50 text-xs font-medium tracking-wide">
            patrimoine.game
          </div>
        </div>

        {/* Texte à partager */}
        <div className="p-4">
          <pre className="text-xs text-slate-600 bg-slate-50 rounded-2xl p-3 whitespace-pre-wrap font-sans leading-relaxed select-all">
            {shareText}
          </pre>
        </div>

        {/* Boutons */}
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
            {copied ? 'Copié !' : 'Copier'}
          </button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-brand-500 to-indigo-600 text-white font-bold rounded-2xl text-sm hover:from-brand-600 hover:to-indigo-700 transition-all active:scale-95"
            >
              <Share2 size={16} />
              Partager
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
