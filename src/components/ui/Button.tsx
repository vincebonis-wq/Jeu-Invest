import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/formatting'

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'gold'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
  fullWidth?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:shadow-md',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
  success: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm',
  danger: 'bg-red-500 hover:bg-red-600 text-white shadow-sm',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-600',
  gold: 'gold-gradient text-amber-950 font-bold shadow-sm hover:shadow-md',
}

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 active:scale-[0.97]',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        disabled && 'opacity-40 cursor-not-allowed active:scale-100 hover:shadow-none',
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
