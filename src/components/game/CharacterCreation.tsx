import { useState } from 'react'
import { ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react'
import { JOBS } from '../../data/jobs'
import { LIFE_GOALS } from '../../data/lifeGoals'
import type { JobProfile, LifeGoalId } from '../../types'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../ui/Icon'
import { Button } from '../ui/Button'
import { formatEuro } from '../../utils/formatting'
import { cn } from '../../utils/formatting'

export function CharacterCreation() {
  const createCharacter = useGameStore((s) => s.createCharacter)
  const [step, setStep] = useState(0)
  const [job, setJob] = useState<JobProfile | null>(null)
  const [name, setName] = useState('')
  const [age, setAge] = useState(28)
  const [savings, setSavings] = useState(0)
  const [ownsResidence, setOwnsResidence] = useState(false)
  const [lifeGoalId, setLifeGoalId] = useState<LifeGoalId | null>(null)

  function selectJob(j: JobProfile) {
    setJob(j)
    setSavings(j.startingSavings)
    setAge(j.startingAge)
    setStep(1)
  }

  function start() {
    if (!job) return
    const finalSavings = ownsResidence ? Math.max(0, savings - 15000) : savings
    createCharacter(job, name, age, finalSavings, ownsResidence, lifeGoalId ?? undefined)
  }

  const monthlyExpensesPreview = job
    ? Math.round(750 + job.monthlySalary * 0.08) +
      (ownsResidence ? 0 : Math.round(450 + job.monthlySalary * 0.18)) +
      60
    : 0
  const cashflowPreview = job ? job.monthlySalary - monthlyExpensesPreview : 0
  const finalSavings = ownsResidence ? Math.max(0, savings - 15000) : savings

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-slate-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* En-tête */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-sm text-brand-600 font-semibold text-sm mb-4">
            <Sparkles size={16} />
            Crée ton personnage
          </div>
          <h1 className="font-display font-extrabold text-4xl text-slate-800 mb-2">
            Patrimoine
          </h1>
          <p className="text-slate-500">
            Pars de zéro et deviens rentier. Chaque décision compte.
          </p>
        </div>

        {/* Étapes */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {['Métier', 'Profil', 'Rêve', 'Départ'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors',
                  i === step
                    ? 'bg-brand-600 text-white'
                    : i < step
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-white text-slate-400',
                )}
              >
                {i < step ? <Check size={14} /> : <span>{i + 1}</span>}
                {label}
              </div>
              {i < 3 && <div className="w-4 h-px bg-slate-300" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-card p-6 animate-pop-in">
          {/* ÉTAPE 0 : MÉTIER */}
          {step === 0 && (
            <div>
              <h2 className="font-display font-bold text-lg text-slate-800 mb-4">
                Choisis ta situation de départ
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {JOBS.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => selectJob(j)}
                    className="text-left p-4 rounded-2xl border-2 border-slate-100 hover:border-brand-300 hover:shadow-card transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${j.color}20`, color: j.color }}
                      >
                        <Icon name={j.icon} size={22} />
                      </div>
                      <div>
                        <div className="font-display font-bold text-slate-800">
                          {j.title}
                        </div>
                        <div className="text-xs text-slate-400">
                          {formatEuro(j.monthlySalary)}/mois · {formatEuro(j.startingSavings)} épargne
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {j.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ÉTAPE 1 : PROFIL */}
          {step === 1 && job && (
            <div className="space-y-5">
              <h2 className="font-display font-bold text-lg text-slate-800">
                Personnalise ton profil
              </h2>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1.5">
                  Ton prénom
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Alex"
                  maxLength={20}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
                />
              </div>

              <div>
                <label className="flex justify-between text-sm font-semibold text-slate-600 mb-1.5">
                  <span>Âge</span>
                  <span className="text-brand-600">{age} ans</span>
                </label>
                <input
                  type="range"
                  min={22}
                  max={45}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full accent-brand-600"
                />
              </div>

              <div>
                <label className="flex justify-between text-sm font-semibold text-slate-600 mb-1.5">
                  <span>Épargne de départ</span>
                  <span className="text-brand-600">{formatEuro(savings)}</span>
                </label>
                <input
                  type="range"
                  min={job.savingsMin}
                  max={job.savingsMax}
                  step={500}
                  value={savings}
                  onChange={(e) => setSavings(Number(e.target.value))}
                  className="w-full accent-brand-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>{formatEuro(job.savingsMin)}</span>
                  <span>{formatEuro(job.savingsMax)}</span>
                </div>
              </div>

              <button
                onClick={() => setOwnsResidence(!ownsResidence)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left',
                  ownsResidence
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-100 hover:border-slate-200',
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0',
                    ownsResidence
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-slate-300',
                  )}
                >
                  {ownsResidence && <Check size={14} className="text-white" />}
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-700">
                    Je suis déjà propriétaire de ma résidence
                  </div>
                  <div className="text-xs text-slate-400">
                    Coûte 15 000 € d'épargne mais supprime ton loyer mensuel
                  </div>
                </div>
              </button>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setStep(0)}>
                  <ArrowLeft size={16} /> Retour
                </Button>
                <Button fullWidth onClick={() => setStep(2)}>
                  Continuer <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 : RÊVE DE VIE */}
          {step === 2 && job && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display font-bold text-lg text-slate-800">
                  Quel est ton rêve ?
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Ton objectif de vie donne un sens à chaque décision. Une cible, une deadline.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {LIFE_GOALS.map((g) => {
                  const active = lifeGoalId === g.id
                  return (
                    <button
                      key={g.id}
                      onClick={() => setLifeGoalId(g.id)}
                      className={cn(
                        'text-left p-4 rounded-2xl border-2 transition-all',
                        active
                          ? 'border-brand-400 bg-brand-50 shadow-card'
                          : 'border-slate-100 hover:border-brand-200',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-2xl">{g.emoji}</span>
                        <div className="font-display font-bold text-slate-800">{g.title}</div>
                      </div>
                      <div className="text-xs font-semibold text-brand-600 mb-1">{g.tagline}</div>
                      <p className="text-xs text-slate-500 leading-relaxed mb-2">{g.description}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold">
                          🎯 {formatEuro(g.targetNetWorth)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold">
                          ⏳ {Math.round(g.deadlineMonths / 12)} ans
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} /> Retour
                </Button>
                <Button fullWidth disabled={!lifeGoalId} onClick={() => setStep(3)}>
                  Continuer <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 : RÉCAP */}
          {step === 3 && job && (
            <div className="space-y-5">
              <h2 className="font-display font-bold text-lg text-slate-800">
                Prêt à démarrer ?
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <RecapTile label="Métier" value={job.title} />
                <RecapTile label="Âge" value={`${age} ans`} />
                <RecapTile label="Salaire net" value={`${formatEuro(job.monthlySalary)}/mois`} />
                <RecapTile label="Épargne" value={formatEuro(finalSavings)} />
                <RecapTile
                  label="Charges mensuelles"
                  value={formatEuro(monthlyExpensesPreview)}
                />
                <RecapTile
                  label="Reste à vivre"
                  value={`${formatEuro(cashflowPreview)}/mois`}
                  positive={cashflowPreview > 0}
                />
              </div>

              <div className="p-4 rounded-2xl bg-brand-50 border border-brand-100">
                <div className="text-sm font-semibold text-brand-700 mb-1">
                  💡 Premier conseil
                </div>
                <p className="text-xs text-brand-600/80 leading-relaxed">
                  Commence par placer ton épargne sur le Livret A (sans risque), puis vise la
                  Bourse dès {formatEuro(1000)} de patrimoine. Surveille les krachs et diversifie !
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} /> Retour
                </Button>
                <Button variant="gold" fullWidth size="lg" onClick={start}>
                  <Sparkles size={18} /> Commencer l'aventure
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RecapTile({
  label,
  value,
  positive,
}: {
  label: string
  value: string
  positive?: boolean
}) {
  return (
    <div className="p-3 rounded-2xl bg-slate-50">
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div
        className={cn(
          'font-display font-bold text-slate-800',
          positive === true && 'text-emerald-600',
          positive === false && 'text-red-500',
        )}
      >
        {value}
      </div>
    </div>
  )
}
