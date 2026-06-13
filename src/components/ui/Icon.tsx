import {
  BedDouble,
  Briefcase,
  Building,
  CarFront,
  Cpu,
  Crown,
  Gem,
  GraduationCap,
  Home,
  Landmark,
  Laptop,
  LineChart,
  PiggyBank,
  Rocket,
  ShieldCheck,
  Sprout,
  Stethoscope,
  Store,
  Trophy,
  TrendingUp,
  User,
  Wallet,
  HelpCircle,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

// Mappe les noms d'icônes (strings dans les données) vers les composants.
const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  PiggyBank,
  ShieldCheck,
  LineChart,
  Building,
  Landmark,
  Rocket,
  CarFront,
  BedDouble,
  Home,
  User,
  GraduationCap,
  Store,
  Laptop,
  Briefcase,
  Cpu,
  Stethoscope,
  Sprout,
  TrendingUp,
  Wallet,
  Crown,
  Gem,
  Trophy,
}

interface IconProps extends LucideProps {
  name: string
}

export function Icon({ name, ...props }: IconProps) {
  const Component = ICONS[name] ?? HelpCircle
  return <Component {...props} />
}
