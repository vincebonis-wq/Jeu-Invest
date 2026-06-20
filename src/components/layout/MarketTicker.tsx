import { useMemo } from 'react'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth, calcMonthlyPassiveIncome } from '../../utils/calculations'
import { formatEuroCompact } from '../../utils/formatting'
import type { GameState } from '../../types'

function generateNews(game: GameState): string[] {
  const { marketPhase, interestRateBase, realEstateIndex, stockIndexHistory, phaseMonthsElapsed } = game.economy
  const nw = calcNetWorth(game)
  const passive = calcMonthlyPassiveIncome(game)
  const news: string[] = []

  // Phase de marché
  const phaseMap: Record<string, string[]> = {
    bull: [
      `📈 Marchés haussiers depuis ${phaseMonthsElapsed} mois — les ETF surperforment`,
      `🚀 CAC40 en hausse — phase d'expansion confirmée par les analystes`,
      `📊 Euphorie boursière : les indices atteignent de nouveaux sommets`,
    ],
    bear: [
      `📉 Marchés baissiers depuis ${phaseMonthsElapsed} mois — prudence conseillée`,
      `⚠️ Bear market : les valeurs de croissance sous pression`,
      `🏦 Phase baissière — les actifs défensifs (Livret, SCPI) sont à privilégier`,
    ],
    crash: [
      `🔴 KRACH EN COURS — indices en chute libre, volatilité maximale`,
      `💥 Correction historique des marchés — opportunité d'achat pour les audacieux`,
      `⚡ Krach boursier : le moment où se forment les grandes fortunes`,
    ],
    neutral: [
      `🔄 Marchés stables — consolidation en cours, opportunité DCA`,
      `📊 Phase neutre : moment idéal pour construire progressivement son portefeuille`,
      `🧭 Marchés en attente — les SCPI et crowdfunding peu sensibles aux cycles`,
    ],
  }
  news.push(...(phaseMap[marketPhase] ?? []))

  // Taux d'intérêt
  const ratePct = Math.round(interestRateBase * 1000) / 10
  if (ratePct > 4.5) {
    news.push(`🏦 Taux BCE à ${ratePct}% — le crédit immobilier se resserre`)
  } else if (ratePct < 2.5) {
    news.push(`💶 Taux historiquement bas (${ratePct}%) — levier immobilier favorable`)
  } else {
    news.push(`📌 Taux directeur BCE : ${ratePct}% — conditions de crédit normalisées`)
  }

  // Immobilier
  const immoVar = Math.round((realEstateIndex - 1) * 100)
  if (immoVar > 3) {
    news.push(`🏠 Immobilier : +${immoVar}% — marché vendeur dans les grandes villes`)
  } else if (immoVar < -2) {
    news.push(`🏠 Immobilier : ${immoVar}% — correction dans certains marchés`)
  } else {
    news.push(`🏠 Immobilier stable — rendements locatifs entre 4% et 7% nets`)
  }

  // Indice boursier
  if (stockIndexHistory.length >= 2) {
    const last = stockIndexHistory[stockIndexHistory.length - 1].value
    const prev = stockIndexHistory[stockIndexHistory.length - 2].value
    const varPct = Math.round(((last - prev) / prev) * 1000) / 10
    news.push(`📊 Indice boursier ${varPct >= 0 ? '+' : ''}${varPct}% ce mois`)
  }

  // Contexte joueur
  if (nw > 0) {
    news.push(`💼 Ton patrimoine : ${formatEuroCompact(nw)} · ${game.player.age} ans`)
  }
  if (passive > 200) {
    news.push(`💸 Revenus passifs : ${formatEuroCompact(passive)}/mois — ${Math.round((passive / game.player.salary) * 100)}% de ton salaire`)
  }
  if (game.player.milestone !== 'debutant') {
    news.push(`🎯 Statut : ${game.player.milestone === 'epargnant' ? 'Épargnant' : game.player.milestone === 'investisseur' ? 'Investisseur' : game.player.milestone === 'rentier_partiel' ? 'Rentier partiel' : game.player.milestone === 'rentier' ? 'Rentier !' : game.player.milestone === 'millionnaire' ? 'Millionnaire 👑' : 'Multimillionnaire 🏆'}`)
  }

  return news.filter(Boolean)
}

export function MarketTicker() {
  const game = useGameStore((s) => s.game)
  if (!game) return null

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const news = useMemo(() => generateNews(game), [
    game.economy.marketPhase,
    game.economy.phaseMonthsElapsed,
    game.economy.interestRateBase,
    game.economy.realEstateIndex,
    game.player.milestone,
    game.investments.length,
  ])

  const text = news.join('   ·   ')

  return (
    <div className="bg-slate-800 text-white overflow-hidden h-7 flex items-center shrink-0">
      <div className="bg-brand-600 text-white text-[10px] font-bold px-2.5 py-0.5 shrink-0 h-full flex items-center uppercase tracking-wider">
        LIVE
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div
          className="whitespace-nowrap text-[11px] text-slate-200 font-medium animate-ticker"
          style={{ animationDuration: `${Math.max(20, text.length * 0.13)}s` }}
        >
          {text}
          {'   ·   '}
          {text}
        </div>
      </div>
    </div>
  )
}
