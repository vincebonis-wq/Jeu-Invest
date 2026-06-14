import type { JobProfile } from '../types'

// ============================================================================
// 8 profils de métiers pour la création de personnage.
// Le salaire et l'épargne de départ définissent la difficulté.
// ============================================================================

export const JOBS: JobProfile[] = [
  {
    id: 'employe',
    title: 'Employé',
    monthlySalary: 1600,
    startingSavings: 1500,
    savingsMin: 0,
    savingsMax: 4000,
    startingAge: 25,
    description:
      'Salaire modeste, départ difficile. Le vrai défi : épargner avant de pouvoir investir. La voie du self-made.',
    icon: 'User',
    color: '#64748b',
    requiredSkillIds: [],
  },
  {
    id: 'professeur',
    title: 'Professeur',
    monthlySalary: 2200,
    startingSavings: 4000,
    savingsMin: 1000,
    savingsMax: 10000,
    startingAge: 28,
    description:
      'Revenu stable et sécurité de l\'emploi. Une base solide pour construire patiemment son patrimoine.',
    icon: 'GraduationCap',
    color: '#0ea5e9',
    requiredSkillIds: ['gestion_budgetaire'],
  },
  {
    id: 'commercant',
    title: 'Commerçant',
    monthlySalary: 3500,
    startingSavings: 8000,
    savingsMin: 2000,
    savingsMax: 20000,
    startingAge: 32,
    description:
      'Revenus corrects mais variables. Sens des affaires et goût du risque pour saisir les opportunités.',
    icon: 'Store',
    color: '#f59e0b',
    requiredSkillIds: ['gestion_locative'],
  },
  {
    id: 'freelance',
    title: 'Freelance',
    monthlySalary: 2900,
    startingSavings: 6000,
    savingsMin: 1000,
    savingsMax: 15000,
    startingAge: 29,
    description:
      'Indépendant et flexible. Bons revenus mais sans filet : la gestion du risque est essentielle.',
    icon: 'Laptop',
    color: '#8b5cf6',
    requiredSkillIds: ['investissement_101'],
  },
  {
    id: 'cadre',
    title: 'Cadre',
    monthlySalary: 4300,
    startingSavings: 12000,
    savingsMin: 5000,
    savingsMax: 30000,
    startingAge: 30,
    description:
      'Salaire confortable et progression de carrière. Capacité d\'épargne élevée dès le départ.',
    icon: 'Briefcase',
    color: '#1c84f5',
    requiredSkillIds: ['investissement_101', 'negociation'],
  },
  {
    id: 'ingenieur',
    title: 'Ingénieur',
    monthlySalary: 5200,
    startingSavings: 18000,
    savingsMin: 8000,
    savingsMax: 40000,
    startingAge: 28,
    description:
      'Excellent salaire et esprit analytique. Idéal pour optimiser sa stratégie d\'investissement.',
    icon: 'Cpu',
    color: '#06b6d4',
    requiredSkillIds: ['analyse_financiere'],
  },
  {
    id: 'entrepreneur',
    title: 'Entrepreneur',
    monthlySalary: 6500,
    startingSavings: 25000,
    savingsMin: 5000,
    savingsMax: 60000,
    startingAge: 33,
    description:
      'Le fruit d\'années d\'effort. Tes businesses génèrent des revenus confortables en plus de ta liberté totale.',
    icon: 'Rocket',
    color: '#a855f7',
    requiredSkillIds: ['entrepreneuriat'],
  },
  {
    id: 'medecin',
    title: 'Médecin / Expert',
    monthlySalary: 8500,
    startingSavings: 35000,
    savingsMin: 15000,
    savingsMax: 80000,
    startingAge: 32,
    description:
      'Hauts revenus et belle épargne. Le mode facile : tu peux investir gros rapidement. Reste discipliné !',
    icon: 'Stethoscope',
    color: '#ec4899',
    requiredSkillIds: ['optimisation_fiscale'],
  },
]

export const JOB_BY_ID: Record<string, JobProfile> = JOBS.reduce(
  (acc, job) => {
    acc[job.id] = job
    return acc
  },
  {} as Record<string, JobProfile>,
)
