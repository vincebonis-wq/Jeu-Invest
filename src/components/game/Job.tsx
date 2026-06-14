import { useState } from 'react'
import { Briefcase, ChevronRight, Clock, TrendingDown, TrendingUp } from 'lucide-react'
import { JOBS } from '../../data/jobs'
import { useGameStore } from '../../store/gameStore'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Modal } from '../ui/Modal'
import { formatEuro, cn } from '../../utils/formatting'

export function Job() {
  const game = useGameStore((s) => s.game)!
  const changeJob = useGameStore((s) => s.changeJob)
  const [confirmJob, setConfirmJob] = useState<(typeof JOBS)[0] | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const cooldown = game.player.jobChangeCooldownMonths ?? 0

  function handleChangeJob() {
    if (!confirmJob) return
    const res = changeJob(confirmJob.id)
    setResult(res)
    if (res.success) {
      setTimeout(() => {
        setConfirmJob(null)
        setResult(null)
      }, 2000)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Poste actuel */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <Briefcase size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-0.5">
              Poste actuel
            </div>
            <div className="font-display font-extrabold text-2xl text-slate-800">
              {game.player.jobTitle}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-emerald-600 font-bold text-lg">
                {formatEuro(game.player.salary)}
                <span className="text-sm font-normal text-slate-400">/mois</span>
              </span>
              {cooldown > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-semibold">
                  <Clock size={11} />
                  Disponible dans {cooldown} mois
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Conseil emploi */}
      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
        <div className="font-bold mb-1">💡 Stratégie emploi</div>
        <p>
          Augmenter ton salaire est le levier le plus puissant au départ. Chaque euro
          mensuel de plus se transforme en capital investi. Une fois rentier, le salaire
          devient secondaire — tes actifs travaillent à ta place.
        </p>
      </div>

      {/* Liste des postes */}
      <Card className="p-5">
        <CardHeader
          title="Changer de poste"
          subtitle="Transition possible tous les 3 mois · Immédiat · Salaire ajusté"
        />
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        {JOBS.map((job) => {
          const isCurrent = job.id === game.player.jobId
          const salaryDelta = job.monthlySalary - game.player.salary
          return (
            <Card
              key={job.id}
              className={cn(
                'p-4 flex flex-col transition-all',
                isCurrent ? 'ring-2 ring-brand-400 bg-brand-50/30' : '',
              )}
            >
              <div className="flex items-start gap-3 flex-1">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${job.color}18`, color: job.color }}
                >
                  <Icon name={job.icon} size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-display font-bold text-slate-800">{job.title}</span>
                    {isCurrent && (
                      <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-semibold">
                        Actuel
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                    {job.description}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-slate-700">
                      {formatEuro(job.monthlySalary)}/mois
                    </span>
                    {!isCurrent && (
                      <span
                        className={cn(
                          'text-xs font-semibold flex items-center gap-0.5',
                          salaryDelta >= 0 ? 'text-emerald-600' : 'text-red-500',
                        )}
                      >
                        {salaryDelta >= 0 ? (
                          <TrendingUp size={11} />
                        ) : (
                          <TrendingDown size={11} />
                        )}
                        {salaryDelta >= 0 ? '+' : ''}
                        {formatEuro(salaryDelta)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!isCurrent && (
                <Button
                  fullWidth
                  variant={cooldown > 0 ? 'secondary' : 'primary'}
                  size="sm"
                  className="mt-3"
                  disabled={cooldown > 0}
                  onClick={() => setConfirmJob(job)}
                >
                  {cooldown > 0 ? (
                    `Disponible dans ${cooldown} mois`
                  ) : (
                    <>
                      Postuler <ChevronRight size={14} />
                    </>
                  )}
                </Button>
              )}
            </Card>
          )
        })}
      </div>

      {confirmJob && (
        <Modal
          open
          onClose={() => {
            setConfirmJob(null)
            setResult(null)
          }}
          title={`Passer à : ${confirmJob.title}`}
          size="sm"
        >
          {result?.success ? (
            <div className="py-6 text-center animate-pop-in">
              <p className="font-display font-bold text-emerald-600 text-lg">{result.message}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Salaire actuel</span>
                  <span className="font-semibold">{formatEuro(game.player.salary)}/mois</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nouveau salaire</span>
                  <span className="font-bold text-emerald-600">
                    {formatEuro(confirmJob.monthlySalary)}/mois
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Différence</span>
                  <span
                    className={cn(
                      'font-bold',
                      confirmJob.monthlySalary >= game.player.salary
                        ? 'text-emerald-600'
                        : 'text-red-500',
                    )}
                  >
                    {confirmJob.monthlySalary >= game.player.salary ? '+' : ''}
                    {formatEuro(confirmJob.monthlySalary - game.player.salary)}/mois
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center">
                Prochain changement de poste possible dans 3 mois.
              </p>
              {result && !result.success && (
                <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">
                  {result.message}
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    setConfirmJob(null)
                    setResult(null)
                  }}
                >
                  Annuler
                </Button>
                <Button variant="primary" fullWidth onClick={handleChangeJob}>
                  Confirmer
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
