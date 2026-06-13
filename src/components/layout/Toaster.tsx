import { useEffect } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import type { EventSeverity } from '../../types'
import { cn } from '../../utils/formatting'

const SEVERITY_STYLE: Record<
  EventSeverity,
  { icon: React.ComponentType<{ size?: number }>; bar: string; iconColor: string }
> = {
  good: { icon: CheckCircle2, bar: 'bg-emerald-500', iconColor: 'text-emerald-500' },
  info: { icon: Info, bar: 'bg-brand-500', iconColor: 'text-brand-500' },
  warning: { icon: AlertTriangle, bar: 'bg-orange-500', iconColor: 'text-orange-500' },
  bad: { icon: XCircle, bar: 'bg-red-500', iconColor: 'text-red-500' },
}

export function Toaster() {
  const toasts = useGameStore((s) => s.toasts)
  const dismiss = useGameStore((s) => s.dismissToast)

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((t) => (
        <ToastItem
          key={t.id}
          id={t.id}
          title={t.title}
          description={t.description}
          severity={t.severity}
          onDismiss={() => dismiss(t.id)}
        />
      ))}
    </div>
  )
}

function ToastItem({
  id,
  title,
  description,
  severity,
  onDismiss,
}: {
  id: string
  title: string
  description: string
  severity: EventSeverity
  onDismiss: () => void
}) {
  const style = SEVERITY_STYLE[severity]
  const IconComp = style.icon

  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return (
    <div className="pointer-events-auto bg-white rounded-2xl shadow-card-hover border border-slate-100 overflow-hidden animate-slide-in-right flex">
      <div className={cn('w-1.5 shrink-0', style.bar)} />
      <div className="flex items-start gap-3 p-3 flex-1 min-w-0">
        <div className={cn('shrink-0 mt-0.5', style.iconColor)}>
          <IconComp size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold text-sm text-slate-800 leading-tight">
            {title}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
            {description}
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
