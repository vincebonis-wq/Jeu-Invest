/**
 * Le Rentier — beta autonome (tour par tour).
 *
 * Boucle : investir ton épargne dans des flux de revenus → avancer le temps →
 * faire grossir tes revenus passifs NETS jusqu'à couvrir tes dépenses (LA
 * BASCULE) → quitter ton job → vivre en rentier. La fiscalité de chaque flux
 * change le résultat : c'est le NET qui libère.
 */

import { useState } from 'react'
import {
  Wallet, Briefcase, TrendingUp, X, Plus, FastForward, Feather, Trophy, RotateCcw,
} from 'lucide-react'
import { formatEuroCompact } from '../../utils/formatting'
import {
  STREAMS, STREAM_BY_ID, START, MONTHS_PER_TURN, INFLATION_PER_TURN,
  netMonthlyRate, freedomTier, type StreamId, type RentierEvent,
} from './rentierData'

const BEST_KEY = 'jeu-invest-rentier-best'
const euro = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €'

type Phase = 'intro' | 'play' | 'won' | 'over'
type Streams = Partial<Record<StreamId, number>>   // id → capital investi

function loadBest(): number { try { return Number(localStorage.getItem(BEST_KEY) || 0) } catch { return 0 } }
function saveBest(n: number) { try { localStorage.setItem(BEST_KEY, String(Math.round(n))) } catch { /* ignore */ } }

function passiveOf(streams: Streams): number {
  let sum = 0
  for (const s of STREAMS) sum += (streams[s.id] ?? 0) * netMonthlyRate(s)
  return sum
}

export function RentierGame() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [age, setAge] = useState(START.age)
  const [month, setMonth] = useState(0)
  const [cash, setCash] = useState(START.cash)
  const [salary, setSalary] = useState(START.salary)
  const [expenses, setExpenses] = useState(START.expenses)
  const [employed, setEmployed] = useState(true)
  const [streams, setStreams] = useState<Streams>({})
  const [freed, setFreed] = useState(false)
  const [event, setEvent] = useState<RentierEvent | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const [investOpen, setInvestOpen] = useState(false)
  const [best, setBest] = useState(loadBest)

  const passive = passiveOf(streams)
  const coverage = passive / expenses
  const tier = freedomTier(coverage)
  const cashflow = (employed ? salary : 0) + passive - expenses

  function reset() {
    setAge(START.age); setMonth(0); setCash(START.cash); setSalary(START.salary)
    setExpenses(START.expenses); setEmployed(true); setStreams({}); setFreed(false)
    setEvent(null); setCelebrate(false); setInvestOpen(false); setPhase('play')
  }

  function invest(id: StreamId, amount: number) {
    if (amount <= 0 || amount > cash) return
    setCash((c) => c - amount)
    setStreams((s) => ({ ...s, [id]: (s[id] ?? 0) + amount }))
    setInvestOpen(false)
  }

  function rollEvent(st: Streams, sal: number): { ev: RentierEvent | null; cashDelta: number; expMult: number; salMult: number; capMult: Partial<Record<StreamId, number>> } {
    if (Math.random() > 0.4) return { ev: null, cashDelta: 0, expMult: 1, salMult: 1, capMult: {} }
    const hasVolatile = (st.etf ?? 0) + (st.business ?? 0) > 0
    const hasRent = (st.lmnp ?? 0) + (st.scpi ?? 0) > 0
    const pool: (() => ReturnType<typeof rollEvent>)[] = []

    if (hasVolatile) pool.push(() => ({ ev: { kind: 'krach', emoji: '📉', text: 'Krach boursier — tes actifs volatils encaissent le choc (−12 %).' }, cashDelta: 0, expMult: 1, salMult: 1, capMult: { etf: 0.88, business: 0.85 } }))
    pool.push(() => ({ ev: { kind: 'depense', emoji: '🔧', text: 'Imprévu (santé, voiture, toiture). Ça pique la trésorerie.' }, cashDelta: -(900 + Math.floor(Math.random() * 1700)), expMult: 1, salMult: 1, capMult: {} }))
    if (employed) pool.push(() => ({ ev: { kind: 'prime', emoji: '🎉', text: 'Prime exceptionnelle au travail !' }, cashDelta: Math.round(sal * 1.4), expMult: 1, salMult: 1, capMult: {} }))
    if (employed) pool.push(() => ({ ev: { kind: 'raise', emoji: '📈', text: 'Augmentation de salaire (+5 %).' }, cashDelta: 0, expMult: 1, salMult: 1.05, capMult: {} }))
    if (hasRent) pool.push(() => ({ ev: { kind: 'vacance', emoji: '🚪', text: 'Locataire parti — quelques mois sans loyer.' }, cashDelta: -Math.round(((st.lmnp ?? 0) + (st.scpi ?? 0)) * 0.01), expMult: 1, salMult: 1, capMult: {} }))
    pool.push(() => ({ ev: { kind: 'optim', emoji: '🧾', text: 'Tu optimises tes charges (−3 % de dépenses).' }, cashDelta: 0, expMult: 0.97, salMult: 1, capMult: {} }))

    return pool[Math.floor(Math.random() * pool.length)]()
  }

  function advance() {
    // Flux de trésorerie du trimestre
    let c = cash + MONTHS_PER_TURN * ((employed ? salary : 0) + passive - expenses)
    let exp = expenses * (1 + INFLATION_PER_TURN)
    let sal = salary
    const st = { ...streams }

    const { ev, cashDelta, expMult, salMult, capMult } = rollEvent(st, sal)
    c += cashDelta
    exp *= expMult
    sal *= salMult
    for (const k of Object.keys(capMult) as StreamId[]) {
      if (st[k]) st[k] = Math.round((st[k] as number) * (capMult[k] as number))
    }

    const newMonth = month + MONTHS_PER_TURN
    setMonth(newMonth)
    setAge(START.age + Math.floor(newMonth / 12))
    setCash(c)
    setExpenses(exp)
    setSalary(Math.round(sal))
    setStreams(st)
    setEvent(ev)

    if (c < 0) { finishOver(); return }

    const newCoverage = passiveOf(st) / exp
    if (newCoverage >= 1 && !freed) {
      setFreed(true)
      setCelebrate(true)
    }
  }

  function quitJob() {
    setEmployed(false)
    setCelebrate(true)
  }

  function retire() {
    const finalPassive = Math.round(passive)
    if (finalPassive > best) { setBest(finalPassive); saveBest(finalPassive) }
    setPhase('won')
  }

  function finishOver() {
    const finalPassive = Math.round(passive)
    if (finalPassive > best) { setBest(finalPassive); saveBest(finalPassive) }
    setPhase('over')
  }

  const owned = STREAMS.filter((s) => (streams[s.id] ?? 0) > 0)

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: 'radial-gradient(120% 80% at 50% 0%, #10241c 0%, #071410 60%, #050d0a 100%)' }}>

      {/* HUD */}
      <div className="shrink-0 px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 18 }}>{tier.emoji}</span>
          <span className="text-[11px] font-black uppercase tracking-widest text-emerald-300">{tier.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-slate-400">{age} ans</span>
          <button onClick={reset} className="text-slate-600 hover:text-slate-300 p-1" title="Recommencer"><RotateCcw size={14} /></button>
        </div>
      </div>

      {/* Jauge de bascule */}
      <div className="shrink-0 px-4 pt-2">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="text-[9px] text-emerald-400/80 font-black uppercase tracking-widest">Revenus passifs nets</div>
              <div className="text-white font-black text-2xl leading-none">{euro(passive)}<span className="text-sm text-slate-500 font-bold">/mois</span></div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Dépenses</div>
              <div className="text-slate-300 font-black text-lg leading-none">{euro(expenses)}<span className="text-xs text-slate-600 font-bold">/mois</span></div>
            </div>
          </div>

          {/* Barre */}
          <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, coverage * 100)}%`,
                background: coverage >= 1 ? 'linear-gradient(90deg,#34d399,#22c55e)' : 'linear-gradient(90deg,#0ea5e9,#34d399)',
                boxShadow: coverage >= 1 ? '0 0 12px #34d399' : 'none',
              }} />
            {/* Repère 100 % */}
            <div className="absolute inset-y-0" style={{ left: '100%', transform: 'translateX(-2px)', width: 2, background: 'rgba(255,255,255,0.4)' }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] font-black" style={{ color: coverage >= 1 ? '#34d399' : '#7dd3fc' }}>
              {Math.round(coverage * 100)}% de tes dépenses couvertes
            </span>
            {coverage >= 1 && <span className="text-[10px] font-black text-emerald-400">🕊️ LIBRE</span>}
          </div>
        </div>

        {/* Chips trésorerie */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <MiniStat icon={<Wallet size={12} />} label="Épargne" value={formatEuroCompact(cash)} color={cash < 2000 ? '#fb7185' : '#e2e8f0'} />
          <MiniStat icon={<Briefcase size={12} />} label={employed ? 'Salaire' : 'Job'} value={employed ? `${formatEuroCompact(salary)}/m` : 'Quitté'} color={employed ? '#e2e8f0' : '#34d399'} />
          <MiniStat icon={<TrendingUp size={12} />} label="Cashflow" value={`${cashflow >= 0 ? '+' : ''}${formatEuroCompact(cashflow)}/m`} color={cashflow >= 0 ? '#34d399' : '#fb7185'} />
        </div>
      </div>

      {/* Flux possédés */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-2 hide-scrollbar">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Tes flux de revenus</div>
        {owned.length === 0 ? (
          <div className="text-center text-slate-600 text-sm py-8">
            Aucun flux. Investis ton épargne pour créer tes premiers revenus passifs.
          </div>
        ) : (
          <div className="space-y-1.5">
            {owned.map((s) => {
              const cap = streams[s.id] ?? 0
              const net = cap * netMonthlyRate(s)
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 20 }}>{s.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-white leading-tight">{s.short}</div>
                    <div className="text-[10px] text-slate-500">{euro(cap)} placés · {s.taxLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-emerald-400">+{euro(net)}</div>
                    <div className="text-[9px] text-slate-600">net/mois</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Barre d'actions */}
      <div className="shrink-0 px-4 pb-5 pt-1">
        {event && (
          <div className="mb-2 text-center text-[12px] text-slate-300 flex items-center justify-center gap-1.5 animate-fade-in-up">
            <span>{event.emoji}</span><span className="italic">{event.text}</span>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => setInvestOpen(true)}
            className="flex-1 py-3 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-1.5 active:scale-98 transition-transform"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <Plus size={16} /> Investir
          </button>
          {employed && coverage >= 1 ? (
            <button onClick={quitJob}
              className="flex-1 py-3 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-1.5 active:scale-98 transition-transform"
              style={{ background: 'linear-gradient(135deg,#34d399,#059669)', boxShadow: '0 6px 20px rgba(52,211,153,0.4)', animation: 'badgeBob 1.6s ease-in-out infinite' }}>
              <Feather size={16} /> Quitter mon job
            </button>
          ) : !employed && coverage >= 1 ? (
            <button onClick={retire}
              className="flex-1 py-3 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-1.5 active:scale-98 transition-transform"
              style={{ background: 'linear-gradient(135deg,#fbbf24,#d97706)', boxShadow: '0 6px 20px rgba(251,191,36,0.35)' }}>
              <Trophy size={16} /> Prendre ma retraite
            </button>
          ) : (
            <button onClick={advance}
              className="flex-1 py-3 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-1.5 active:scale-98 transition-transform"
              style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', boxShadow: '0 6px 20px rgba(14,165,233,0.35)' }}>
              <FastForward size={16} /> Avancer 3 mois
            </button>
          )}
        </div>
        {(coverage >= 1 && employed) && (
          <button onClick={advance} className="w-full mt-2 py-2 text-[11px] font-bold text-slate-500 active:scale-98">
            ou continuer à travailler (avancer 3 mois) →
          </button>
        )}
      </div>

      {/* Overlays */}
      {investOpen && (
        <InvestSheet cash={cash} onInvest={invest} onClose={() => setInvestOpen(false)} />
      )}
      {phase === 'intro' && <Intro best={best} onStart={reset} />}
      {celebrate && phase === 'play' && (
        <Celebrate freedomOnly={employed} onClose={() => setCelebrate(false)} passive={passive} />
      )}
      {phase === 'won' && <EndScreen won age={age} passive={passive} coverage={coverage} best={best} onRestart={reset} />}
      {phase === 'over' && <EndScreen won={false} age={age} passive={passive} coverage={coverage} best={best} onRestart={reset} />}
    </div>
  )
}

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-1 text-slate-500">{icon}<span className="text-[8px] font-bold uppercase tracking-wider">{label}</span></div>
      <div className="text-sm font-black leading-tight mt-0.5" style={{ color }}>{value}</div>
    </div>
  )
}

// ── Feuille d'investissement ─────────────────────────────────────────────────
function InvestSheet({ cash, onInvest, onClose }: { cash: number; onInvest: (id: StreamId, amt: number) => void; onClose: () => void }) {
  const [sel, setSel] = useState<StreamId | null>(null)
  const arch = sel ? STREAM_BY_ID[sel] : null
  const [pct, setPct] = useState(50)
  const amount = Math.round((cash * pct) / 100)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative rounded-t-3xl pb-10" style={{ background: 'linear-gradient(165deg,#0d211a,#06120d 60%)', border: '1px solid rgba(52,211,153,0.2)', borderBottom: 'none', animation: 'slideUpPanel 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3" />
        <div className="flex items-center justify-between px-5 pt-3">
          <div className="font-black text-white text-base">Investir ton épargne</div>
          <button onClick={onClose} className="text-slate-600 p-1"><X size={18} /></button>
        </div>
        <div className="text-xs text-slate-500 px-5 mt-0.5">Disponible : {euro(cash)}</div>

        {/* Choix du flux */}
        <div className="px-4 mt-3 space-y-1.5 max-h-[38vh] overflow-y-auto hide-scrollbar">
          {STREAMS.map((s) => {
            const active = sel === s.id
            const yearlyNet = (netMonthlyRate(s) * 12 * 100).toFixed(1)
            return (
              <button key={s.id} onClick={() => setSel(s.id)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all"
                style={{ background: active ? `${s.color}1e` : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? `${s.color}77` : 'rgba(255,255,255,0.07)'}` }}>
                <span style={{ fontSize: 22 }}>{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-white leading-tight">{s.name}</div>
                  <div className="text-[10px] text-slate-500 leading-snug">{s.note}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-black" style={{ color: s.color }}>{yearlyNet}%</div>
                  <div className="text-[8px] text-slate-600">net/an</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Montant + confirmation */}
        {arch && (
          <div className="px-5 mt-3">
            <div className="flex gap-2">
              {[25, 50, 100].map((c) => (
                <button key={c} onClick={() => setPct(c)}
                  className="flex-1 py-2 rounded-xl font-black text-xs transition-all active:scale-95"
                  style={{ background: pct === c ? `${arch.color}22` : 'rgba(255,255,255,0.05)', color: pct === c ? arch.color : '#94a3b8', border: `1px solid ${pct === c ? `${arch.color}66` : 'rgba(255,255,255,0.08)'}` }}>
                  {c === 100 ? 'Tout' : `${c}%`}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-xs text-slate-400">Revenu net ajouté</span>
              <span className="text-sm font-black text-emerald-400">+{euro(amount * netMonthlyRate(arch))}/mois</span>
            </div>
            <button onClick={() => onInvest(arch.id, amount)} disabled={amount <= 0}
              className="w-full mt-3 py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${arch.color}, ${arch.color}99)`, boxShadow: `0 6px 20px ${arch.color}35` }}>
              Investir {euro(amount)}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Overlays plein écran ─────────────────────────────────────────────────────
function Intro({ best, onStart }: { best: number; onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-8 text-center" style={{ background: 'rgba(5,13,10,0.94)', backdropFilter: 'blur(3px)' }}>
      <div style={{ fontSize: 52 }}>🕊️</div>
      <h1 className="text-white font-black text-2xl mt-2">Le Rentier</h1>
      <p className="text-slate-400 text-sm mt-3 max-w-xs leading-relaxed">
        Investis ton épargne dans des flux de revenus. Fais grossir tes revenus passifs
        <b className="text-emerald-400"> nets d'impôt</b> jusqu'à couvrir tes dépenses : c'est
        <b className="text-emerald-400"> la bascule</b>. Alors tu pourras quitter ton job et vivre libre.
      </p>
      <p className="text-slate-500 text-xs mt-4 max-w-xs">
        Attention : c'est le <b className="text-slate-300">net</b> qui compte. Un immo LMNP peu taxé
        peut libérer plus vite qu'un ETF rentable mais taxé à 30 %.
      </p>
      {best > 0 && <div className="text-amber-400 text-sm font-bold mt-4">🏆 Record : {euro(best)}/mois de passifs</div>}
      <button onClick={onStart} className="mt-6 px-10 py-3.5 rounded-2xl font-black text-white text-base active:scale-95 transition-transform"
        style={{ background: 'linear-gradient(135deg,#34d399,#0ea5e9)', boxShadow: '0 10px 30px rgba(52,211,153,0.35)' }}>
        Commencer
      </button>
    </div>
  )
}

function Celebrate({ freedomOnly, passive, onClose }: { freedomOnly: boolean; passive: number; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-8 text-center animate-fade-in-up" style={{ background: 'rgba(5,13,10,0.92)', backdropFilter: 'blur(4px)' }}>
      <div style={{ fontSize: 60 }}>🕊️</div>
      <h1 className="text-emerald-400 font-black text-2xl mt-2">
        {freedomOnly ? 'La bascule !' : 'Tu es libre !'}
      </h1>
      <p className="text-white text-sm mt-3 max-w-xs leading-relaxed">
        {freedomOnly
          ? <>Tes revenus passifs couvrent désormais tes dépenses ({euro(passive)}/mois). Tu peux quitter ton job quand tu veux.</>
          : <>Tu vis de tes rentes. Continue à bâtir ta marge, ou prends ta retraite pour figer ton score.</>}
      </p>
      <button onClick={onClose} className="mt-6 px-10 py-3.5 rounded-2xl font-black text-white text-base active:scale-95 transition-transform"
        style={{ background: 'linear-gradient(135deg,#34d399,#059669)', boxShadow: '0 10px 30px rgba(52,211,153,0.35)' }}>
        Continuer
      </button>
    </div>
  )
}

function EndScreen({ won, age, passive, coverage, best, onRestart }: { won: boolean; age: number; passive: number; coverage: number; best: number; onRestart: () => void }) {
  const tier = freedomTier(coverage)
  const isRecord = Math.round(passive) >= best && passive > 0
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-8 text-center animate-fade-in-up" style={{ background: 'rgba(5,13,10,0.95)', backdropFilter: 'blur(4px)' }}>
      <div style={{ fontSize: 56 }}>{won ? tier.emoji : '💸'}</div>
      <h1 className="font-black text-2xl mt-2" style={{ color: won ? '#34d399' : '#fb7185' }}>
        {won ? 'Retraite bien méritée' : 'Faillite'}
      </h1>
      <p className="text-slate-300 text-sm mt-2 max-w-xs">
        {won ? `Tu prends ta retraite à ${age} ans, ${tier.title.toLowerCase()}.` : `Ton épargne s'est effondrée à ${age} ans. La liberté attendra.`}
      </p>
      <div className="mt-5 w-full max-w-xs rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Revenus passifs nets</div>
        <div className="text-white font-black text-3xl leading-none mt-1">{euro(passive)}<span className="text-base text-slate-500">/mois</span></div>
        <div className="text-sm font-bold mt-1 text-emerald-300">{Math.round(coverage * 100)}% des dépenses · {tier.emoji} {tier.title}</div>
        {isRecord && passive > 0 && <div className="text-amber-400 text-xs font-black mt-2">🏆 Nouveau record !</div>}
        {!isRecord && best > 0 && <div className="text-slate-500 text-[11px] mt-2">Record : {euro(best)}/mois</div>}
      </div>
      <button onClick={onRestart} className="mt-6 px-10 py-3.5 rounded-2xl font-black text-white text-base active:scale-95 transition-transform"
        style={{ background: 'linear-gradient(135deg,#34d399,#0ea5e9)', boxShadow: '0 10px 30px rgba(52,211,153,0.35)' }}>
        Rejouer
      </button>
    </div>
  )
}
