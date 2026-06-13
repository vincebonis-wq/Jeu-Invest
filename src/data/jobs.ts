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
  },
  {
    id: 'commercant',
    title: 'Commerçant',
    monthlySalary: 2800,
    startingSavings: 8000,
    savingsMin: 2000,
    savingsMax: 20000,
    startingAge: 32,
    description:
      'Revenus corrects mais variables. Sens des affaires et goût du risque pour saisir les opportunités.',
    icon: 'Store',
    color: '#f59e0b',
  },
  {
    id: 'freelance',
    title: 'Freelance',
    monthlySalary: 3000,
    startingSavings: 6000,
    savingsMin: 1000,
    savingsMax: 15000,
    startingAge: 29,
    description:
      'Indépendant et flexible. Bons revenus mais sans filet : la gestion du risque est essentielle.',
    icon: 'Laptop',
    color: '#8b5cf6',
  },
  {
    id: 'cadre',
    title: 'Cadre',
    monthlySalary: 3500,
    startingSavings: 12000,
    savingsMin: 5000,
    savingsMax: 30000,
    startingAge: 30,
    description:
      'Salaire confortable et progression de carrière. Capacité d\'épargne élevée dès le départ.',
    icon: 'Briefcase',
    color: '#1c84f5',
  },
  {
    id: 'ingenieur',
    title: 'Ingénieur',
    monthlySalary: 4200,
    startingSavings: 18000,
    savingsMin: 8000,
    savingsMax: 40000,
    startingAge: 28,
    description:
      'Excellent salaire et esprit analytique. Idéal pour optimiser sa stratégie d\'investissement.',
    icon: 'Cpu',
    color: '#06b6d4',
  },
  {
    id: 'entrepreneur',
    title: 'Entrepreneur',
    monthlySalary: 2500,
    startingSavings: 25000,
    savingsMin: 5000,
    savingsMax: 60000,
    startingAge: 33,
    description:
      'Salaire variable mais belle épargne de départ. Prêt à prendre des risques pour viser gros.',
    icon: 'Rocket',
    color: '#a855f7',
  },
  {
    id: 'medecin',
    title: 'Médecin',
    monthlySalary: 6000,
    startingSavings: 35000,
    savingsMin: 15000,
    savingsMax: 80000,
    startingAge: 32,
    description:
      'Hauts revenus et belle épargne. Le mode facile : tu peux investir gros rapidement. Reste discipliné !',
    icon: 'Stethoscope',
    color: '#ec4899',
  },
]

export const JOB_BY_ID: Record<string, JobProfile> = JOBS.reduce(
  (acc, job) => {
    acc[job.id] = job
    return acc
  },
  {} as Record<string, JobProfile>,
)
