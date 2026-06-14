import { useEffect, useState } from 'react'
import {
  Bell,
  Briefcase,
  CheckCheck,
  Coins,
  Heart,
  Home,
  Landmark,
  Receipt,
  RotateCcw,
  TrendingUp,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import type { EventCategory, EventSeverity, GameEvent } from '../../types'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import {
  formatEuroSigned,
  formatGameDate,
  cn,
} from '../../utils/formatting'

const CATEGORY_ICON: Record<EventCategory, React.ComponentType<LucideProps>> = {
  market: TrendingUp,
  property: Home,
  job: Briefcase,
  tax: Receipt,
  personal: Heart,
  business: Coins,
  milestone: Landmark,
}

const SEVERITY_COLOR: Record<EventSeverity, string> = {
  good: 'border-l-emerald-500',
  info: 'border-l-brand-500',
  warning: 'border-l-orange-500',
  bad: 'border-l-red-500',
}

const SEVERITY_ICON_BG: Record<EventSeverity, string> = {
  good: 'bg-emerald-100 text-emerald-600',
  info: 'bg-brand-100 text-brand-600',
  warning: 'bg-orange-100 text-orange-600',
  bad: 'bg-red-100 text-red-600',
}

type Filter = 'all' | 'unread' | EventCategory

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'unread', label: 'Non lu' },
  { id: 'market', label: 'Marché' },
  { id: 'property', label: 'Immo' },
  { id: 'job', label: 'Emploi' },
  { id: 'personal', label: 'Perso' },
  { id: 'tax', label: 'Fiscal' },
]

export function Events() {
  const game = useGameStore((s) => s.game)!
  const markAllRead = useGameStore((s) => s.markAllEventsRead)
  const newGame = useGameStore((s) => s.newGame)
  const [filter, setFilter] = useState<Filter>('all')
  const [confirmReset, setConfirmReset] = useState(false)

  // Marque tout comme lu en quittant l'écran.
  useEffect(() => {
    return () => markAllRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const events = [...game.events].reverse()
  const filtered = events.filter((e) => {
    if (filter === 'all') return true
    if (filter === 'unread') return !e.isRead
    return e.category === filter
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors',
                filter === f.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={markAllRead} className="shrink-0">
          <CheckCheck size={16} /> <span className="hidden sm:inline">Tout lire</span>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Bell size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">Aucune actualité ici pour l'instant.</p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((evt) => (
            <EventItem key={evt.id} evt={evt} />
          ))}
        </div>
      )}

      {/* Restart zone */}
      <div className="mt-6 rounded-2xl bg-red-50 border border-red-100 p-4">
        <div className="font-bold text-red-800 mb-1 flex items-center gap-2 text-sm">
          <RotateCcw size={15} /> Recommencer depuis zéro
        </div>
        <p className="text-xs text-red-600 mb-3">
          Efface définitivement ta progression actuelle — compétences, investissements et économies.
        </p>
        <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
          <RotateCcw size={14} /> Nouvelle partie
        </Button>
      </div>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Recommencer ?" size="sm">
        <p className="text-sm text-slate-500 mb-4">
          Cette action efface définitivement ta partie actuelle. Es-tu sûr ?
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setConfirmReset(false)}>
            Annuler
          </Button>
          <Button variant="danger" fullWidth onClick={newGame}>
            Tout effacer
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function EventItem({ evt }: { evt: GameEvent }) {
  const resolveEvent = useGameStore((s) => s.resolveEvent)
  const IconComp = CATEGORY_ICON[evt.category]
  const needsAction = evt.requiresAction && !evt.resolved

  return (
    <Card
      className={cn(
        'p-4 border-l-4',
        SEVERITY_COLOR[evt.severity],
        !evt.isRead && 'ring-1 ring-brand-100',
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            SEVERITY_ICON_BG[evt.severity],
          )}
        >
          <IconComp size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="font-display font-bold text-slate-800 leading-tight">
              {evt.title}
            </span>
            {evt.financialImpact !== 0 && (
              <span
                className={cn(
                  'font-display font-bold text-sm shrink-0',
                  evt.financialImpact > 0 ? 'text-emerald-600' : 'text-red-500',
                )}
              >
                {formatEuroSigned(evt.financialImpact)}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{evt.description}</p>
          <div className="text-xs text-slate-300 mt-1">
            {formatGameDate(evt.dateISO)}
          </div>

          {needsAction && evt.actionOptions && (
            <div className="flex flex-wrap gap-2 mt-3">
              {evt.actionOptions.map((action, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={i === 0 ? 'primary' : 'secondary'}
                  onClick={() => resolveEvent(evt.id, i)}
                >
                  {action.label}
                  {action.cost > 0 && ` (-${action.cost} €)`}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
