import { useState } from 'react'
import { FlaskConical, Check } from 'lucide-react'
import { useUiMode, type UiMode } from './uiModeStore'
import { cn } from '../utils/formatting'

const MODES: { id: UiMode; emoji: string; label: string; desc: string }[] = [
  { id: 'classic', emoji: '🏠', label: 'App classique', desc: 'Version stable (défaut)' },
  { id: 'citymap', emoji: '🗺️', label: 'Beta · Carte Patrimoine', desc: 'Ville interactive, tap-to-collect' },
  { id: 'tour',    emoji: '🏙️', label: 'Beta · La Tour', desc: 'Empire vertical qui monte à chaque achat' },
  { id: 'coffres', emoji: '🗄️', label: 'Beta · Coffres', desc: 'Récolter / retirer — fiscalité tangible' },
  { id: 'rentier', emoji: '🕊️', label: 'Beta · Le Rentier', desc: 'Atteindre la liberté par le cash-flow' },
  { id: 'mogul',   emoji: '🎩', label: 'Beta · MOGUL', desc: 'Décisions à balayer — gameplay alternatif' },
]

const PILL: Record<UiMode, string> = {
  classic: 'Beta',
  citymap: '🗺️ Carte',
  tour: '🏙️ Tour',
  coffres: '🗄️ Coffres',
  rentier: '🕊️ Rentier',
  mogul: '🎩 Mogul',
}

export function BetaModeSwitcher() {
  const mode = useUiMode((s) => s.mode)
  const setMode = useUiMode((s) => s.setMode)
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-20 left-3 z-[55] flex flex-col items-start gap-2">
      {open && (
        <div className="bg-slate-800/95 backdrop-blur border border-white/15 rounded-2xl p-1.5 shadow-2xl animate-pop-in w-60">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors',
                mode === m.id ? 'bg-white/15' : 'hover:bg-white/10',
              )}
            >
              <span className="text-xl shrink-0">{m.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-white leading-tight">{m.label}</span>
                <span className="block text-[11px] text-white/55 leading-tight">{m.desc}</span>
              </span>
              {mode === m.id && <Check size={16} className="text-emerald-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 pl-2.5 pr-3 py-2 rounded-full shadow-xl border border-white/15 text-white text-xs font-bold transition-all active:scale-95',
          mode === 'classic' ? 'bg-slate-700/90' : 'bg-gradient-to-r from-violet-600 to-fuchsia-600',
        )}
      >
        <FlaskConical size={15} />
        {PILL[mode]}
      </button>
    </div>
  )
}
