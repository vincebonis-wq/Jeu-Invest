import { useGameStore } from '../../store/gameStore'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { formatEuro, formatEuroCompact, formatEuroSigned } from '../../utils/formatting'
import { MILESTONE_INFO } from '../../utils/calculations'
import { Icon } from '../ui/Icon'
import type { AnnualRecap } from '../../types'

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <div className="text-right">
        <span className="font-display font-bold text-slate-800 text-sm">{value}</span>
        {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
      </div>
    </div>
  )
}

function RecapContent({ recap }: { recap: AnnualRecap }) {
  const nwDelta = recap.netWorthEnd - recap.netWorthStart
  const passiveDelta = recap.passiveIncomeEnd - recap.passiveIncomeStart
  const milestoneInfo = MILESTONE_INFO[recap.milestone]

  const tone = recap.gainPct >= 10 ? '🚀' : recap.gainPct >= 0 ? '📈' : '📉'
  const headline = recap.gainPct >= 20
    ? `Excellente année — +${recap.gainPct}% de patrimoine !`
    : recap.gainPct >= 5
      ? `Bonne année — +${recap.gainPct}% de croissance`
      : recap.gainPct >= 0
        ? `Année stable — progression de ${recap.gainPct}%`
        : `Année difficile — ${recap.gainPct}% de variation`

  return (
    <div className="space-y-5">
      {/* Headline */}
      <div className="text-center py-4">
        <div className="text-4xl mb-2">{tone}</div>
        <div className="font-display font-extrabold text-xl text-slate-800">{recap.year} en chiffres</div>
        <div className="text-sm text-slate-500 mt-1">{headline}</div>
      </div>

      {/* Palier actuel */}
      <div
        className="flex items-center gap-3 p-4 rounded-2xl"
        style={{ backgroundColor: `${milestoneInfo.color}12` }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${milestoneInfo.color}25`, color: milestoneInfo.color }}
        >
          <Icon name={milestoneInfo.icon} size={20} />
        </div>
        <div>
          <div className="font-bold text-slate-800">{milestoneInfo.label}</div>
          <div className="text-xs text-slate-500">{milestoneInfo.description}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-slate-50 rounded-2xl p-4 space-y-0">
        <StatRow
          label="Patrimoine début d'année"
          value={formatEuroCompact(recap.netWorthStart)}
        />
        <StatRow
          label="Patrimoine fin d'année"
          value={formatEuroCompact(recap.netWorthEnd)}
          sub={`${nwDelta >= 0 ? '+' : ''}${formatEuroCompact(nwDelta)} (${recap.gainPct >= 0 ? '+' : ''}${recap.gainPct}%)`}
        />
        <StatRow
          label="Revenus passifs"
          value={formatEuroCompact(recap.passiveIncomeEnd) + '/mois'}
          sub={passiveDelta !== 0 ? `${formatEuroSigned(passiveDelta)}/mois vs an dernier` : undefined}
        />
        <StatRow
          label="Impôts payés"
          value={formatEuro(recap.totalTaxPaid)}
        />
        <StatRow
          label="Placements actifs"
          value={`${recap.investmentCount} investissement${recap.investmentCount > 1 ? 's' : ''}`}
        />
      </div>

      {/* Conseil pour l'année suivante */}
      <div className="bg-brand-50 rounded-2xl p-4 text-sm text-brand-700 leading-snug">
        <div className="font-bold mb-1">💡 Pour {recap.year + 1}</div>
        {nwDelta > 0
          ? `Continue sur cette lancée : chaque euro réinvesti va travailler en intérêts composés toute l'année. L'objectif : faire mieux que ${recap.gainPct}%.`
          : `L'essentiel, c'est de rester investi. Les marchés se redressent sur la durée. Diversifie si ce n'est pas encore fait.`}
      </div>
    </div>
  )
}

export function YearRecapModal() {
  const recap = useGameStore((s) => s.game?.pendingYearRecap)
  const dismissYearRecap = useGameStore((s) => s.dismissYearRecap)

  if (!recap) return null

  return (
    <Modal open onClose={dismissYearRecap} size="sm">
      <RecapContent recap={recap} />
      <div className="mt-6">
        <Button variant="primary" fullWidth onClick={dismissYearRecap}>
          En avant pour {recap.year + 1} ! 🎯
        </Button>
      </div>
    </Modal>
  )
}
