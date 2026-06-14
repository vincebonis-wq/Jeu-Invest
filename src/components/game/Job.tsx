import { useState } from 'react'
import { ChevronRight, TrendingDown, TrendingUp, Lock, CheckCircle2 } from 'lucide-react'
import { JOBS } from '../../data/jobs'
import { SKILL_BY_ID } from '../../data/skills'
import type { JobProfile } from '../../types'
import { useGameStore } from '../../store/gameStore'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Modal } from '../ui/Modal'
import { formatEuro, cn } from '../../utils/formatting'

type JobStatus = 'current' | 'available' | 'requires_skills' | 'locked'

export function Job() {
  const game = useGameStore((s) => s.game)!
  const changeJob = useGameStore((s) => s.changeJob)
  const [confirmJob, setConfirmJob] = useState<JobProfile | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const learned = game.player.learnedSkillIds || []

  function getJobStatus(job: JobProfile): JobStatus {
    if (job.id === game.player.jobId) return 'current'
    const allMet = (job.requiredSkillIds || []).every((id) => learned.includes(id))
    if (allMet) return 'available'
    const anyMet = (job.requiredSkillIds || []).some((id) => learned.includes(id))
    if (anyMet) return 'requires_skills'
    return 'locked'
  }

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

  const currentJob = JOBS.find((j) => j.id === game.player.jobId)
  const availableJobs = JOBS.filter((j) => getJobStatus(j) === 'available')
  const progressJobs = JOBS.filter((j) => getJobStatus(j) === 'requires_skills')
  const lockedJobs = JOBS.filter((j) => getJobStatus(j) === 'locked')

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Poste actuel */}
      <Card className="p-5 ring-2 ring-brand-300 bg-brand-50/20">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${currentJob?.color ?? '#1c84f5'}18`, color: currentJob?.color ?? '#1c84f5' }}
          >
            <Icon name={currentJob?.icon ?? 'Briefcase'} size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-brand-600 font-semibold uppercase tracking-wide mb-0.5">
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
              <span className="flex items-center gap-1 text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full font-semibold">
                <CheckCircle2 size={11} />
                En poste
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Conseil emploi */}
      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
        <div className="font-bold mb-1">💡 Stratégie emploi</div>
        <p>
          Les postes se débloquent en apprenant des compétences dans l'onglet Compétences.
          Chaque compétence acquise ouvre de nouvelles opportunités de carrière et augmente ton salaire.
        </p>
      </div>

      {/* Postes disponibles */}
      {availableJobs.length > 0 && (
        <Card className="p-5">
          <CardHeader
            title="Postes disponibles"
            subtitle={`${availableJobs.length} poste${availableJobs.length > 1 ? 's' : ''} accessible${availableJobs.length > 1 ? 's' : ''} dès maintenant`}
          />
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            {availableJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                status="available"
                currentSalary={game.player.salary}
                learned={learned}
                onApply={() => setConfirmJob(job)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* En progression */}
      {progressJobs.length > 0 && (
        <Card className="p-5">
          <CardHeader
            title="En progression"
            subtitle="Il te manque quelques compétences pour accéder à ces postes"
          />
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            {progressJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                status="requires_skills"
                currentSalary={game.player.salary}
                learned={learned}
                onApply={() => setConfirmJob(job)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Postes verrouillés */}
      {lockedJobs.length > 0 && (
        <Card className="p-5">
          <CardHeader
            title="Postes verrouillés"
            subtitle="Développe tes compétences pour les débloquer"
          />
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            {lockedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                status="locked"
                currentSalary={game.player.salary}
                learned={learned}
                onApply={() => {}}
              />
            ))}
          </div>
        </Card>
      )}

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

function JobCard({
  job,
  status,
  currentSalary,
  learned,
  onApply,
}: {
  job: JobProfile
  status: JobStatus
  currentSalary: number
  learned: string[]
  onApply: () => void
}) {
  const salaryDelta = job.monthlySalary - currentSalary
  const requiredSkills = job.requiredSkillIds || []
  const metCount = requiredSkills.filter((id) => learned.includes(id)).length
  const totalCount = requiredSkills.length

  return (
    <Card
      className={cn(
        'p-4 flex flex-col transition-all',
        status === 'locked' ? 'opacity-60' : '',
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
            {status === 'locked' && (
              <Lock size={13} className="text-slate-400 shrink-0" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
            {job.description}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="font-bold text-slate-700">
              {formatEuro(job.monthlySalary)}/mois
            </span>
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
          </div>
        </div>
      </div>

      {/* Compétences requises */}
      {requiredSkills.length > 0 && status !== 'available' && (
        <div className="mt-2 text-xs text-slate-500">
          {status === 'requires_skills' ? (
            <span className="text-amber-600">
              Compétences : {metCount}/{totalCount} — {requiredSkills.filter((id) => !learned.includes(id)).map((id) => SKILL_BY_ID[id]?.name ?? id).join(', ')}
            </span>
          ) : (
            <span>
              Requiert : {requiredSkills.map((id) => SKILL_BY_ID[id]?.name ?? id).join(', ')}
            </span>
          )}
        </div>
      )}

      {status === 'available' && (
        <Button
          fullWidth
          variant="primary"
          size="sm"
          className="mt-3"
          onClick={onApply}
        >
          Postuler <ChevronRight size={14} />
        </Button>
      )}
      {status === 'requires_skills' && (
        <div className="mt-3 text-center py-2 px-3 rounded-xl bg-amber-50 text-xs font-semibold text-amber-700">
          En progression ({metCount}/{totalCount} compétences)
        </div>
      )}
      {status === 'locked' && (
        <div className="mt-3 text-center py-2 px-3 rounded-xl bg-slate-50 text-xs font-semibold text-slate-400">
          Non accessible
        </div>
      )}
    </Card>
  )
}
