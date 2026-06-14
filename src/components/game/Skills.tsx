import { useState } from 'react'
import { GraduationCap, CheckCircle2, Clock, Lock, ChevronRight, Zap, Briefcase } from 'lucide-react'
import { SKILLS, SKILL_BY_ID } from '../../data/skills'
import type { GameSkill } from '../../types'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Job } from './Job'
import { formatEuro, formatMonthShort, cn } from '../../utils/formatting'

type SkillStatus = 'learned' | 'training' | 'available' | 'locked'
type CareerTab = 'skills' | 'job'

export function Skills() {
  const game = useGameStore((s) => s.game)!
  const startSkillTraining = useGameStore((s) => s.startSkillTraining)
  const [confirmSkill, setConfirmSkill] = useState<GameSkill | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<CareerTab>('skills')

  const netWorth = calcNetWorth(game)
  const learned = game.player.learnedSkillIds || []
  const activeTraining = game.player.activeTraining

  function getStatus(skill: GameSkill): SkillStatus {
    if (learned.includes(skill.id)) return 'learned'
    if (activeTraining?.skillId === skill.id) return 'training'
    const prereqsMet = skill.prerequisiteIds.every((p) => learned.includes(p))
    const wealthMet = !skill.minNetWorth || netWorth >= skill.minNetWorth
    if (prereqsMet && wealthMet) return 'available'
    return 'locked'
  }

  function getTrainingProgress(): number {
    if (!activeTraining) return 0
    const skill = SKILL_BY_ID[activeTraining.skillId]
    if (!skill || skill.trainingMonths === 0) return 100
    const start = new Date(activeTraining.startDateISO)
    const current = new Date(game.gameDateISO)
    const daysElapsed = (current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    const totalDays = skill.trainingMonths * 30.44
    return Math.min(99.9, (daysElapsed / totalDays) * 100)
  }

  function getTrainingDaysRemaining(): number {
    if (!activeTraining) return 0
    const skill = SKILL_BY_ID[activeTraining.skillId]
    if (!skill || skill.trainingMonths === 0) return 0
    const start = new Date(activeTraining.startDateISO)
    const current = new Date(game.gameDateISO)
    const daysElapsed = (current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    const totalDays = skill.trainingMonths * 30.44
    return Math.max(0, Math.ceil(totalDays - daysElapsed))
  }

  function handleStart() {
    if (!confirmSkill) return
    const res = startSkillTraining(confirmSkill.id)
    setResult(res)
    if (res.success) {
      setTimeout(() => {
        setConfirmSkill(null)
        setResult(null)
      }, 2000)
    }
  }

  const categories = ['financial', 'professional', 'entrepreneurial'] as const
  const catLabels: Record<typeof categories[number], string> = {
    financial: 'Finance',
    professional: 'Carrière',
    entrepreneurial: 'Entrepreneuriat',
  }
  const catEmojis: Record<typeof categories[number], string> = {
    financial: '💹',
    professional: '💼',
    entrepreneurial: '🚀',
  }

  const trainingProgress = getTrainingProgress()
  const trainingDaysRemaining = getTrainingDaysRemaining()

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Onglets Compétences / Emploi */}
      <div className="flex gap-2 bg-slate-100 rounded-2xl p-1">
        <button
          onClick={() => setActiveTab('skills')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
            activeTab === 'skills'
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <GraduationCap size={16} /> Compétences
        </button>
        <button
          onClick={() => setActiveTab('job')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
            activeTab === 'job'
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <Briefcase size={16} /> Mon Emploi
        </button>
      </div>

      {activeTab === 'job' ? (
        <Job />
      ) : (
      <>
      {/* Formation en cours */}
      {activeTraining && (
        <Card className="p-5 border-2 border-brand-200 bg-brand-50/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0">
              <GraduationCap size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-brand-600 uppercase tracking-wide">
                Formation en cours
              </div>
              <div className="font-display font-bold text-slate-800">
                {SKILL_BY_ID[activeTraining.skillId]?.name ?? activeTraining.skillId}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display font-extrabold text-2xl text-brand-600">
                {trainingProgress}%
              </div>
            </div>
          </div>
          <div className="w-full bg-brand-100 rounded-full h-3">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-1000 ease-out relative overflow-hidden"
              style={{ width: `${trainingProgress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs text-brand-500">
              Démarrée le {formatMonthShort(activeTraining.startDateISO)} — durée totale :{' '}
              {SKILL_BY_ID[activeTraining.skillId]?.trainingMonths} mois
            </div>
            <div className="text-xs font-semibold text-brand-600">
              {trainingDaysRemaining > 0 ? `Encore ~${trainingDaysRemaining} jours` : 'Presque terminé !'}
            </div>
          </div>
        </Card>
      )}

      {/* Arbre de compétences par catégorie */}
      {categories.map((cat) => {
        const catSkills = SKILLS.filter((s) => s.category === cat)
        return (
          <Card key={cat} className="p-5">
            <CardHeader
              title={`${catEmojis[cat]} ${catLabels[cat]}`}
              subtitle={`${catSkills.filter((s) => learned.includes(s.id)).length}/${catSkills.length} compétences`}
            />
            <div className="space-y-2 mt-3">
              {catSkills.map((skill) => {
                const status = getStatus(skill)
                return (
                  <SkillRow
                    key={skill.id}
                    skill={skill}
                    status={status}
                    onSelect={status === 'available' ? () => setConfirmSkill(skill) : undefined}
                  />
                )
              })}
            </div>
          </Card>
        )
      })}

      {/* Modal de confirmation */}
      {confirmSkill && (
        <Modal
          open
          onClose={() => {
            setConfirmSkill(null)
            setResult(null)
          }}
          title={confirmSkill.name}
          size="sm"
        >
          {result?.success ? (
            <div className="py-6 text-center animate-pop-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <GraduationCap size={32} />
              </div>
              <p className="font-display font-bold text-emerald-600 text-lg">{result.message}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">{confirmSkill.description}</p>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Durée de formation</span>
                  <span className="font-semibold">
                    {confirmSkill.trainingMonths === 0 ? 'Immédiat' : `${confirmSkill.trainingMonths} mois`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Coût</span>
                  <span className="font-semibold">
                    {confirmSkill.cost === 0 ? 'Gratuit' : formatEuro(confirmSkill.cost)}
                  </span>
                </div>
                {confirmSkill.minNetWorth && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Patrimoine requis</span>
                    <span className="font-semibold">{formatEuro(confirmSkill.minNetWorth)}</span>
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">
                  Bénéfices
                </div>
                {confirmSkill.benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-emerald-800 py-0.5">
                    <Zap size={12} className="shrink-0 text-emerald-500" />
                    {b}
                  </div>
                ))}
              </div>
              {result && !result.success && (
                <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{result.message}</div>
              )}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    setConfirmSkill(null)
                    setResult(null)
                  }}
                >
                  Annuler
                </Button>
                <Button variant="primary" fullWidth onClick={handleStart}>
                  Commencer la formation
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
      </>
      )}
    </div>
  )
}

function SkillRow({
  skill,
  status,
  onSelect,
}: {
  skill: GameSkill
  status: SkillStatus
  onSelect?: () => void
}) {
  const statusConfig = {
    learned: {
      icon: <CheckCircle2 size={18} />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      label: 'Maîtrisée',
    },
    training: {
      icon: <Clock size={18} />,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
      label: 'En cours',
    },
    available: {
      icon: <ChevronRight size={18} />,
      color: 'text-slate-600',
      bg: 'bg-slate-100',
      label: 'Disponible',
    },
    locked: {
      icon: <Lock size={18} />,
      color: 'text-slate-400',
      bg: 'bg-slate-50',
      label: 'Bloquée',
    },
  }
  const cfg = statusConfig[status]

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl transition-all',
        status === 'learned' ? 'bg-emerald-50/50' : '',
        status === 'available' ? 'hover:bg-slate-50 cursor-pointer' : '',
        status === 'locked' ? 'opacity-60' : '',
      )}
      onClick={onSelect}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
          cfg.bg,
          cfg.color,
        )}
      >
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-semibold text-sm',
              status === 'locked' ? 'text-slate-400' : 'text-slate-800',
            )}
          >
            {skill.name}
          </span>
        </div>
        <div className="text-xs text-slate-400 truncate">
          {skill.trainingMonths === 0 ? 'Instantané' : `${skill.trainingMonths} mois`}
          {skill.cost > 0 ? ` · ${formatEuro(skill.cost)}` : ' · Gratuit'}
          {skill.minNetWorth ? ` · ${(skill.minNetWorth / 1000).toFixed(0)}k€ requis` : ''}
        </div>
      </div>
      <div className="text-xs shrink-0">
        {status === 'available' && (
          <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-semibold">
            Démarrer
          </span>
        )}
        {status === 'learned' && <span className="text-emerald-600 font-semibold">✓</span>}
        {status === 'training' && <span className="text-brand-600 font-semibold">...</span>}
      </div>
    </div>
  )
}
