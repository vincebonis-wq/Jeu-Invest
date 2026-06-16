import { useEffect, useState } from 'react'
import { GraduationCap, CheckCircle2, Clock, Lock, Zap, Briefcase, Sparkles } from 'lucide-react'
import { SKILLS, SKILL_BY_ID } from '../../data/skills'
import type { GameSkill } from '../../types'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Job } from './Job'
import { formatEuro, formatDuration, cn } from '../../utils/formatting'

type SkillStatus = 'learned' | 'training' | 'available' | 'locked'
type CareerTab = 'skills' | 'job'

const TIER_INFO: Record<number, { label: string; emoji: string }> = {
  0: { label: 'Départ', emoji: '🌱' },
  1: { label: 'Fondamentaux', emoji: '📘' },
  2: { label: 'Premiers outils', emoji: '🛠️' },
  3: { label: 'Expansion', emoji: '📊' },
  4: { label: 'Expert', emoji: '🎯' },
  5: { label: 'Ultra-fortune', emoji: '💎' },
  6: { label: 'Légende', emoji: '👑' },
}

export function Skills() {
  const game = useGameStore((s) => s.game)!
  const startSkillTraining = useGameStore((s) => s.startSkillTraining)
  const [confirmSkill, setConfirmSkill] = useState<GameSkill | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<CareerTab>('skills')
  const [now, setNow] = useState(() => Date.now())

  // La progression de formation est RÉELLE : on rafraîchit chaque seconde.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

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
    if (!skill || skill.realDurationMs === 0) return 100
    const elapsed = now - activeTraining.startedAtReal
    return Math.min(99.9, (elapsed / skill.realDurationMs) * 100)
  }

  function getTrainingTimeRemaining(): number {
    if (!activeTraining) return 0
    const skill = SKILL_BY_ID[activeTraining.skillId]
    if (!skill) return 0
    const elapsed = now - activeTraining.startedAtReal
    return Math.max(0, skill.realDurationMs - elapsed)
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

  const trainingProgress = getTrainingProgress()
  const trainingTimeRemaining = getTrainingTimeRemaining()
  const tiers = [0, 1, 2, 3, 4, 5, 6]
  const learnedCount = learned.length
  const totalCount = SKILLS.length

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
      {/* En-tête de progression globale */}
      <Card className="p-4 flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <Sparkles size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-slate-800">Arbre de compétences</div>
          <div className="text-xs text-slate-400">
            {learnedCount}/{totalCount} compétences maîtrisées — chaque formation prend un temps RÉEL, indépendant de la vitesse de jeu.
          </div>
        </div>
        <div className="font-display font-extrabold text-xl text-brand-600 shrink-0">
          {Math.round((learnedCount / totalCount) * 100)}%
        </div>
      </Card>

      {/* Formation en cours */}
      {activeTraining && (
        <Card className="p-5 border-2 border-brand-200 bg-brand-50/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0">
              <GraduationCap size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-brand-600 uppercase tracking-wide">
                Formation en cours (temps réel)
              </div>
              <div className="font-display font-bold text-slate-800">
                {SKILL_BY_ID[activeTraining.skillId]?.name ?? activeTraining.skillId}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display font-extrabold text-2xl text-brand-600">
                {Math.round(trainingProgress)}%
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
              Durée totale : {formatDuration(SKILL_BY_ID[activeTraining.skillId]?.realDurationMs ?? 0)} (réel)
            </div>
            <div className="text-xs font-semibold text-brand-600">
              {trainingTimeRemaining > 0 ? `Encore ${formatDuration(trainingTimeRemaining)}` : 'Presque terminé !'}
            </div>
          </div>
        </Card>
      )}

      {/* Arbre de compétences par palier (tier) */}
      {tiers.map((tier) => {
        const tierSkills = SKILLS.filter((s) => s.tier === tier)
        if (tierSkills.length === 0) return null
        const info = TIER_INFO[tier]
        const tierLearned = tierSkills.filter((s) => learned.includes(s.id)).length
        return (
          <Card key={tier} className="p-5">
            <CardHeader
              title={`${info.emoji} Palier ${tier} — ${info.label}`}
              subtitle={`${tierLearned}/${tierSkills.length} compétences de ce palier`}
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-3">
              {tierSkills.map((skill) => {
                const status = getStatus(skill)
                return (
                  <SkillTile
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
                  <span className="text-slate-500">Durée de formation (réelle)</span>
                  <span className="font-semibold">
                    {confirmSkill.realDurationMs === 0 ? 'Immédiat' : formatDuration(confirmSkill.realDurationMs)}
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
              {confirmSkill.realDurationMs > 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
                  ⏳ Cette formation se déroule en temps réel, même si tu quittes le jeu ou changes la vitesse.
                  Reviens dans {formatDuration(confirmSkill.realDurationMs)} pour la voir terminée.
                </div>
              )}
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

function SkillTile({
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
      icon: <CheckCircle2 size={16} />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      ring: 'border-emerald-200',
    },
    training: {
      icon: <Clock size={16} />,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
      ring: 'border-brand-200',
    },
    available: {
      icon: <Sparkles size={16} />,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      ring: 'border-amber-200',
    },
    locked: {
      icon: <Lock size={16} />,
      color: 'text-slate-400',
      bg: 'bg-slate-50',
      ring: 'border-slate-100',
    },
  }
  const cfg = statusConfig[status]

  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-3 rounded-2xl border-2 transition-all',
        cfg.ring,
        status === 'available' ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : '',
        status === 'locked' ? 'opacity-60' : '',
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', cfg.bg, cfg.color)}>
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('font-semibold text-sm leading-tight', status === 'locked' ? 'text-slate-400' : 'text-slate-800')}>
            {skill.name}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {skill.realDurationMs === 0 ? 'Instantané' : formatDuration(skill.realDurationMs)}
            {skill.cost > 0 ? ` · ${formatEuro(skill.cost)}` : ' · Gratuit'}
          </div>
        </div>
      </div>
      {skill.minNetWorth ? (
        <div className="text-[11px] text-slate-400">
          Patrimoine requis : {(skill.minNetWorth / 1000).toFixed(0)}k€
        </div>
      ) : null}
      <div className="text-xs">
        {status === 'available' && (
          <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-semibold">
            Démarrer →
          </span>
        )}
        {status === 'learned' && <span className="text-emerald-600 font-semibold">✓ Maîtrisée</span>}
        {status === 'training' && <span className="text-brand-600 font-semibold">En cours...</span>}
        {status === 'locked' && <span className="text-slate-400">Verrouillée</span>}
      </div>
    </div>
  )
}
