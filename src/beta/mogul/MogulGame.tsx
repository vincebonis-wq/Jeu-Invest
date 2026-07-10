/**
 * MOGUL — jeu de décisions à balayer (beta, gameplay alternatif).
 *
 * Une carte = un dilemme. Balaie à gauche/droite pour choisir. Chaque choix
 * déplace 4 jauges ; l'une au fond ou au plafond met fin à la partie. Objectif :
 * bâtir la plus grosse fortune et survivre le plus de trimestres.
 *
 * Autonome et hors-ligne : n'utilise ni la simulation patrimoniale, ni les lingots.
 */

import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatEuroCompact } from '../../utils/formatting'
import {
  DECK, METERS, METER_BY_KEY, START_METERS, START_FORTUNE, START_AGE,
  getMogulRank, type MeterKey, type MogulCard, type Choice,
} from './mogulCards'

const BEST_KEY = 'jeu-invest-mogul-best'
const COMMIT_PX = 90     // distance de balayage pour valider
const PREVIEW_PX = 28    // distance à partir de laquelle on prévisualise le choix

type Phase = 'intro' | 'play' | 'over'
type Side = 'left' | 'right'
type Meters = Record<MeterKey, number>

function clamp(n: number) { return Math.max(0, Math.min(100, n)) }

function loadBest(): number {
  try { return Number(localStorage.getItem(BEST_KEY) || 0) } catch { return 0 }
}
function saveBest(n: number) {
  try { localStorage.setItem(BEST_KEY, String(Math.round(n))) } catch { /* ignore */ }
}

function drawCard(fortune: number, usedOnce: Set<string>, recent: string[]): MogulCard {
  let pool = DECK.filter((c) =>
    (c.minFortune === undefined || fortune >= c.minFortune) &&
    (c.maxFortune === undefined || fortune <= c.maxFortune) &&
    !(c.once && usedOnce.has(c.id)) &&
    !recent.includes(c.id),
  )
  if (pool.length === 0) {
    pool = DECK.filter((c) => !(c.once && usedOnce.has(c.id)) && !recent.includes(c.id))
  }
  if (pool.length === 0) pool = DECK
  const totalW = pool.reduce((s, c) => s + (c.weight ?? 1), 0)
  let r = Math.random() * totalW
  for (const c of pool) {
    r -= c.weight ?? 1
    if (r <= 0) return c
  }
  return pool[pool.length - 1]
}

interface Death { meter: MeterKey; side: 'low' | 'high' }

export function MogulGame() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [meters, setMeters] = useState<Meters>({ ...START_METERS })
  const [fortune, setFortune] = useState(START_FORTUNE)
  const [quarter, setQuarter] = useState(0)
  const [card, setCard] = useState<MogulCard>(() => DECK[0])
  const [death, setDeath] = useState<Death | null>(null)
  const [best, setBest] = useState(loadBest)
  const [result, setResult] = useState<string | null>(null)

  const usedOnce = useRef<Set<string>>(new Set())
  const recent = useRef<string[]>([])

  // Drag
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [flyOff, setFlyOff] = useState<Side | null>(null)
  const startX = useRef(0)
  const busy = useRef(false)

  const previewSide: Side | null =
    Math.abs(dx) > PREVIEW_PX ? (dx > 0 ? 'right' : 'left') : null
  const previewChoice: Choice | null =
    previewSide ? (previewSide === 'right' ? card.right : card.left) : null

  function reset() {
    usedOnce.current = new Set()
    recent.current = []
    setMeters({ ...START_METERS })
    setFortune(START_FORTUNE)
    setQuarter(0)
    setDeath(null)
    setResult(null)
    setDx(0)
    setFlyOff(null)
    busy.current = false
    setCard(drawCard(START_FORTUNE, usedOnce.current, recent.current))
    setPhase('play')
  }

  function commit(side: Side) {
    if (busy.current) return
    busy.current = true
    const choice = side === 'right' ? card.right : card.left

    // 1) La carte s'envole
    setDragging(false)
    setFlyOff(side)

    // 2) Après l'animation, on applique les effets
    window.setTimeout(() => {
      // Jauges (détection de mort sur les bornes brutes)
      let dead: Death | null = null
      const next: Meters = { ...meters }
      for (const m of METERS) {
        const delta = choice.effects[m.key] ?? 0
        const raw = meters[m.key] + delta
        if (!dead && raw <= 0) dead = { meter: m.key, side: 'low' }
        else if (!dead && raw >= 100) dead = { meter: m.key, side: 'high' }
        next[m.key] = clamp(raw)
      }

      // Fortune : delta du choix + capitalisation trimestrielle liée à l'exposition
      const growth = 1 + (next.expo - 50) / 900
      const newFortune = Math.max(0, Math.round((fortune + (choice.fortune ?? 0)) * growth))

      setMeters(next)
      setFortune(newFortune)
      setQuarter((q) => q + 1)
      setResult(choice.result)

      if (dead) {
        if (newFortune > best) { setBest(newFortune); saveBest(newFortune) }
        setDeath(dead)
        setPhase('over')
        return
      }

      // Carte suivante
      usedOnce.current.add(card.id)
      recent.current = [card.id, ...recent.current].slice(0, 5)
      const nextCard = drawCard(newFortune, usedOnce.current, recent.current)
      setCard(nextCard)
      setDx(0)
      setFlyOff(null)
      busy.current = false
    }, 260)
  }

  // Efface la ligne de conséquence après un court instant
  useEffect(() => {
    if (!result) return
    const t = window.setTimeout(() => setResult(null), 2200)
    return () => window.clearTimeout(t)
  }, [result])

  // ── Handlers de balayage ──
  function onDown(e: React.PointerEvent) {
    if (busy.current || phase !== 'play') return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    startX.current = e.clientX
    setDragging(true)
  }
  function onMove(e: React.PointerEvent) {
    if (!dragging) return
    setDx(Math.max(-260, Math.min(260, e.clientX - startX.current)))
  }
  function onUp() {
    if (!dragging) return
    setDragging(false)
    if (Math.abs(dx) >= COMMIT_PX) commit(dx > 0 ? 'right' : 'left')
    else setDx(0) // retour au centre
  }

  const rank = getMogulRank(fortune)
  const age = START_AGE + Math.floor(quarter / 4)

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: 'radial-gradient(120% 80% at 50% 0%, #101d3a 0%, #070d1e 60%, #05091a 100%)' }}>

      {/* ── HUD ── */}
      <div className="shrink-0 px-4 pt-3 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 18 }}>{rank.emoji}</span>
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">{rank.title}</span>
          </div>
          <button onClick={reset} className="text-slate-600 hover:text-slate-300 transition-colors p-1" title="Recommencer">
            <RotateCcw size={15} />
          </button>
        </div>
        <div className="flex items-end justify-between mt-1">
          <div>
            <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Fortune</div>
            <div className="text-white font-black leading-none" style={{ fontSize: 26 }}>
              {formatEuroCompact(fortune)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Âge · Trimestre</div>
            <div className="text-slate-300 font-black leading-none" style={{ fontSize: 15 }}>
              {age} ans · T{quarter + 1}
            </div>
          </div>
        </div>
      </div>

      {/* ── Jauges ── */}
      <div className="shrink-0 px-4 pt-2.5 pb-1 flex justify-between gap-2">
        {METERS.map((m) => {
          const val = meters[m.key]
          const delta = previewChoice?.effects[m.key] ?? 0
          const near = val <= 20 || val >= 80
          return (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
              <div className="relative flex items-center gap-1">
                <span style={{ fontSize: 13, opacity: near ? 1 : 0.8 }}>{m.emoji}</span>
                {delta !== 0 && (
                  <span className="absolute -right-3 -top-1 text-[10px] font-black"
                    style={{ color: delta > 0 ? '#4ade80' : '#f87171' }}>
                    {delta > 0 ? '▲' : '▼'}
                  </span>
                )}
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${val}%`,
                    background: m.color,
                    opacity: near ? 1 : 0.75,
                    boxShadow: near ? `0 0 8px ${m.color}` : 'none',
                  }} />
              </div>
              <span className="text-[7px] font-bold uppercase tracking-wider"
                style={{ color: previewChoice && delta !== 0 ? m.color : '#475569' }}>
                {m.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Zone carte ── */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center px-6">
        {/* Étiquettes de choix (fond) */}
        {phase === 'play' && (
          <>
            <ChoiceGhost side="left"  active={previewSide === 'left'}  label={card.left.label} />
            <ChoiceGhost side="right" active={previewSide === 'right'} label={card.right.label} />
          </>
        )}

        {phase === 'play' && (
          <div
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="relative w-full max-w-[340px] touch-none cursor-grab active:cursor-grabbing"
            style={{
              transform: flyOff
                ? `translateX(${flyOff === 'right' ? 140 : -140}vw) rotate(${flyOff === 'right' ? 22 : -22}deg)`
                : `translateX(${dx}px) rotate(${dx / 18}deg)`,
              transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            <div className="rounded-3xl p-6 pb-7"
              style={{
                background: 'linear-gradient(165deg, #16233f 0%, #0c1730 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 24px 60px -12px rgba(0,0,0,0.7)',
                minHeight: 300,
              }}>
              <div className="text-[10px] font-black uppercase tracking-widest text-sky-400/80 mb-4">
                {card.speaker}
              </div>
              <div className="flex justify-center my-3" style={{ fontSize: 58 }}>{card.emoji}</div>
              <p className="text-white text-[17px] font-semibold leading-snug text-center mt-4"
                style={{ textWrap: 'balance' } as React.CSSProperties}>
                {card.prompt}
              </p>

              {/* Teinte de bord selon le côté prévisualisé */}
              <div className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-150"
                style={{
                  opacity: previewSide ? 1 : 0,
                  boxShadow: previewSide === 'right'
                    ? 'inset 0 0 0 2px rgba(56,189,248,0.7)'
                    : 'inset 0 0 0 2px rgba(167,139,250,0.7)',
                }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Bas : indices de balayage + conséquence ── */}
      {phase === 'play' && (
        <div className="shrink-0 px-5 pb-5 pt-1">
          <div className="h-5 text-center mb-2">
            {result && (
              <span className="text-[12px] text-slate-400 italic animate-fade-in-up">{result}</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-1 min-w-0"
              style={{ opacity: previewSide === 'left' ? 1 : 0.5 }}>
              <ChevronLeft size={16} className="text-violet-400 shrink-0" />
              <span className="text-[12px] font-bold text-slate-300 truncate">{card.left.label}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end text-right"
              style={{ opacity: previewSide === 'right' ? 1 : 0.5 }}>
              <span className="text-[12px] font-bold text-slate-300 truncate">{card.right.label}</span>
              <ChevronRight size={16} className="text-sky-400 shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* ── Overlays ── */}
      {phase === 'intro' && <IntroOverlay best={best} onStart={reset} />}
      {phase === 'over' && death && (
        <GameOverOverlay
          death={death} fortune={fortune} best={best} quarter={quarter} onRestart={reset}
        />
      )}
    </div>
  )
}

// ── Étiquette fantôme derrière la carte ──
function ChoiceGhost({ side, active, label }: { side: Side; active: boolean; label: string }) {
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 max-w-[38%] pointer-events-none transition-all duration-150"
      style={{
        [side]: 12,
        opacity: active ? 1 : 0,
        transform: `translateY(-50%) scale(${active ? 1 : 0.9})`,
      } as React.CSSProperties}
    >
      <div className="px-3 py-2 rounded-2xl text-[12px] font-black text-white"
        style={{
          background: side === 'right' ? 'rgba(56,189,248,0.22)' : 'rgba(167,139,250,0.22)',
          border: `1.5px solid ${side === 'right' ? 'rgba(56,189,248,0.8)' : 'rgba(167,139,250,0.8)'}`,
        }}>
        {label}
      </div>
    </div>
  )
}

// ── Intro ──
function IntroOverlay({ best, onStart }: { best: number; onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-8 text-center"
      style={{ background: 'rgba(5,9,20,0.92)', backdropFilter: 'blur(3px)' }}>
      <div style={{ fontSize: 52 }}>🎩</div>
      <h1 className="text-white font-black text-2xl mt-2 tracking-tight">MOGUL</h1>
      <p className="text-slate-400 text-sm mt-3 max-w-xs leading-relaxed">
        Chaque carte est une décision. <span className="text-violet-400 font-bold">Balaie à gauche</span> ou
        <span className="text-sky-400 font-bold"> à droite</span> pour choisir.
        Chaque choix déplace tes quatre jauges — n'en laisse aucune tomber à zéro ni saturer.
      </p>
      <div className="flex gap-3 mt-5">
        {METERS.map((m) => (
          <div key={m.key} className="flex flex-col items-center gap-1">
            <span style={{ fontSize: 20 }}>{m.emoji}</span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">{m.label}</span>
          </div>
        ))}
      </div>
      <p className="text-slate-500 text-xs mt-5 max-w-xs">
        Bâtis la plus grosse <span className="text-emerald-400 font-bold">fortune</span> et survis
        le plus de trimestres possible.
      </p>
      {best > 0 && (
        <div className="text-amber-400 text-sm font-bold mt-3">
          🏆 Record : {formatEuroCompact(best)}
        </div>
      )}
      <button onClick={onStart}
        className="mt-6 px-10 py-3.5 rounded-2xl font-black text-white text-base active:scale-95 transition-transform"
        style={{ background: 'linear-gradient(135deg, #38bdf8, #8b5cf6)', boxShadow: '0 10px 30px rgba(56,189,248,0.35)' }}>
        Jouer
      </button>
    </div>
  )
}

// ── Game over ──
function GameOverOverlay({
  death, fortune, best, quarter, onRestart,
}: {
  death: Death; fortune: number; best: number; quarter: number; onRestart: () => void
}) {
  const meter = METER_BY_KEY[death.meter]
  const cause = death.side === 'low' ? meter.lowDeath : meter.highDeath
  const rank = getMogulRank(fortune)
  const years = Math.floor(quarter / 4)
  const isRecord = fortune >= best && fortune > START_FORTUNE
  const percentile = Math.min(99, Math.round(100 * (1 - 1 / (1 + fortune / 60_000))))

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-8 text-center animate-fade-in-up"
      style={{ background: 'rgba(5,9,20,0.94)', backdropFilter: 'blur(4px)' }}>
      <div style={{ fontSize: 56 }}>{meter.emoji}</div>
      <div className="text-[11px] font-black uppercase tracking-widest mt-2" style={{ color: meter.color }}>
        {meter.label} {death.side === 'low' ? 'à sec' : 'saturée'}
      </div>
      <p className="text-white text-[15px] font-semibold mt-3 max-w-xs leading-relaxed">{cause}</p>

      <div className="mt-6 w-full max-w-xs rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Fortune finale</div>
        <div className="text-white font-black text-3xl leading-none mt-1">{formatEuroCompact(fortune)}</div>
        <div className="text-sm font-bold mt-1" style={{ color: '#7dd3fc' }}>{rank.emoji} {rank.title}</div>
        <div className="flex justify-center gap-4 mt-3 text-[11px] text-slate-400">
          <span>{years} an{years > 1 ? 's' : ''} de règne</span>
          <span>·</span>
          <span>Tu bats {percentile}% des joueurs</span>
        </div>
        {isRecord && (
          <div className="text-amber-400 text-xs font-black mt-2 animate-fade-in-up">🏆 Nouveau record !</div>
        )}
        {!isRecord && best > 0 && (
          <div className="text-slate-500 text-[11px] mt-2">Record : {formatEuroCompact(best)}</div>
        )}
      </div>

      <button onClick={onRestart}
        className="mt-6 px-10 py-3.5 rounded-2xl font-black text-white text-base active:scale-95 transition-transform"
        style={{ background: 'linear-gradient(135deg, #38bdf8, #8b5cf6)', boxShadow: '0 10px 30px rgba(56,189,248,0.35)' }}>
        Rejouer
      </button>
    </div>
  )
}
