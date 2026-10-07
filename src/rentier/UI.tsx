/**
 * RENTIER INC. — interface.
 */

import { useEffect, useRef, useState } from 'react'
import { Hammer, Target, PieChart, FlaskConical, Users, X, Lock, Coins, Volume2, VolumeX, RotateCcw, ArrowUpCircle, Wrench, Sofa, Star, Check } from 'lucide-react'
import { useRentier } from './store'
import {
  monthlyRent, monthlyNet, freedom, charges, shopAverage, isUnlocked, taxRate, questProgress, tenantCount,
  avgSat, netWorth, parkingStatus, canRenovate, renovateCost, repairCost, liftCost, buildingValue,
  NEED_ICON, NEED_LABEL, roomCost, stationCount, stationsOf, serviceTime, salaries, dirtOf, canResearch, liftNeeds, desksOf,
  type Game, type Room, type Agent,
} from './sim'
import { ROOMS, BUILD_ORDER, SW, FH, LIFESTYLE, FREEDOM_TIERS, FURNISH_COST, TAX, STAFF, CLEAN_COST, RESEARCH, RP_RATE, liftInstallCost, type RoomType, type Need, type StaffRole } from './data'
import { Interior } from './Tower'
import { fmtEur, fmtShort } from '../archipel/format'
import { sfxTap, sfxTick } from '../archipel/audio'

const GLASS = 'bg-white/90 backdrop-blur-md shadow-[0_10px_30px_-8px_rgba(10,20,50,0.4)]'
const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']
const needRoom: Record<Need, RoomType> = { food: 'cafe', laundry: 'laverie', sport: 'sport', fun: 'bar' }

function useTween(v: number) {
  const [s, set] = useState(v)
  const ref = useRef({ from: v, t0: 0, raf: 0 })
  useEffect(() => {
    const r = ref.current
    r.from = s; r.t0 = performance.now()
    cancelAnimationFrame(r.raf)
    const tick = (t: number) => {
      const k = Math.min(1, (t - r.t0) / 600)
      set(r.from + (v - r.from) * (1 - Math.pow(1 - k, 3)))
      if (k < 1) r.raf = requestAnimationFrame(tick)
    }
    r.raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(r.raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(v)])
  return s
}

const face = (sat: number) => (sat >= 75 ? '😄' : sat >= 55 ? '🙂' : sat >= 35 ? '😐' : '😠')

// ── HUD ──────────────────────────────────────────────────────────────────────
export function Hud() {
  useRentier((s) => s.rev)
  const g = useRentier.getState().game
  const cash = useTween(g.cash)
  const m = Math.floor(g.month)
  const p = g.month % 1
  const isNight = p < 0.24 || p > 0.88
  const hour = Math.floor(p * 24)
  const net = monthlyNet(g)
  const f = freedom(g)
  const tier = [...FREEDOM_TIERS].reverse().find((t) => f >= t.pct)
  return (
    <div className="absolute top-0 inset-x-0 z-30 px-3 pt-[max(10px,env(safe-area-inset-top))] pointer-events-none">
      <div className="flex items-start gap-2 max-w-md mx-auto">
        <div id="cash-anchor" className={`${GLASS} pointer-events-auto rounded-2xl pl-2 pr-4 py-1.5 flex items-center gap-2`}>
          <span className="coin coin-lg" />
          <div className="font-display font-extrabold text-[24px] text-slate-800 tabular-nums leading-none">{fmtEur(cash)}</div>
        </div>
        <div className="flex-1" />
        <div className={`${GLASS} rounded-2xl px-3 py-1.5 text-right`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">{MONTHS[m % 12]} {2026 + Math.floor(m / 12)}</div>
          <div className="text-[14px] font-extrabold text-slate-700 leading-tight mt-0.5">{isNight ? '🌙' : '☀️'} {String(hour).padStart(2, '0')}h</div>
        </div>
      </div>
      <button onClick={() => useRentier.getState().openSheet('stats')} className={`${GLASS} pointer-events-auto rounded-2xl px-3.5 py-2 mt-2 max-w-md mx-auto w-full block text-left`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">{tier ? `${tier.emoji} ${tier.title}` : '🌱 Liberté financière'}</span>
          <span className="text-[12px] font-extrabold text-slate-600 tabular-nums">{net >= 0 ? '+' : ''}{fmtShort(net)} / {fmtShort(LIFESTYLE)} €<span className="text-slate-400 font-bold">/mois</span></span>
        </div>
        <div className="mt-1.5 h-2.5 rounded-full bg-slate-200/80 overflow-hidden relative">
          <div className="h-full rounded-full bar-shine" style={{ width: `${Math.min(100, f * 100)}%`, background: 'linear-gradient(90deg,#34d399,#10b981)' }} />
        </div>
      </button>
    </div>
  )
}

// ── Dock ─────────────────────────────────────────────────────────────────────
export function Dock() {
  useRentier((s) => s.rev)
  const st = useRentier.getState()
  const g = st.game
  if (st.buildType) return <BuildBar />
  const done = g.quests.filter((q) => q.done).length
  const ready = g.rooms.filter((r) => {
    const k = ROOMS[r.type].kind
    return (k === 'shop' && r.stored >= 20) || ((k === 'home' || k === 'parking' || k === 'office') && r.stored >= Math.max(40, monthlyRent(g, r).net * 0.5))
  }).length
  return (
    <div className="absolute bottom-0 inset-x-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pointer-events-none">
      {ready >= 3 && (
        <div className="flex justify-center mb-9">
          <button onClick={() => st.collectAll()} className="pointer-events-auto rounded-full px-4 py-2 font-display font-extrabold text-amber-900 flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform pop-in"
            style={{ background: 'linear-gradient(180deg,#ffe27a,#f7b733)', border: '2px solid #fff' }}>
            <Coins size={17} /> Tout encaisser · {ready}
          </button>
        </div>
      )}
      <div className={`${GLASS} pointer-events-auto max-w-md mx-auto rounded-[28px] h-[68px] flex items-center px-1 relative`}>
        <DockBtn icon={<Target size={22} />} label="Objectifs" badge={done} onClick={() => { sfxTap(); st.openSheet('quests') }} />
        <DockBtn icon={<FlaskConical size={22} />} label="Recherche" badge={RESEARCH.filter((r) => canResearch(g, r.id)).length} onClick={() => { sfxTap(); st.openSheet('research') }} />
        <div className="w-[88px] shrink-0" />
        <DockBtn icon={<Users size={22} />} label="Personnel" onClick={() => { sfxTap(); st.openSheet('staff') }} />
        <DockBtn icon={<PieChart size={22} />} label="Patrimoine" onClick={() => { sfxTap(); st.openSheet('stats') }} />
        <button onClick={() => { sfxTap(); st.openSheet('build') }}
          className="absolute left-1/2 -translate-x-1/2 -top-6 w-[78px] h-[78px] rounded-full flex flex-col items-center justify-center text-white active:scale-95 transition-transform build-btn"
          style={{ background: 'linear-gradient(180deg,#ffb547,#f2792b)', border: '4px solid #fff', boxShadow: '0 10px 24px -6px rgba(242,121,43,0.7)' }}>
          <Hammer size={28} strokeWidth={2.5} />
          <span className="text-[10px] font-extrabold -mt-0.5">Construire</span>
        </button>
      </div>
    </div>
  )
}

function DockBtn({ icon, label, onClick, badge }: { icon: React.ReactNode; label: string; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick} className="relative flex flex-col items-center gap-0.5 flex-1 text-slate-600 active:scale-90 transition-transform">
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
      {!!badge && <span className="absolute -top-1 left-1/2 translate-x-[5px] min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-extrabold flex items-center justify-center border-2 border-white badge-bounce">{badge}</span>}
    </button>
  )
}

function BuildBar() {
  useRentier((s) => s.rev)
  const st = useRentier.getState()
  const t = st.buildType!
  const d = ROOMS[t]
  const cost = roomCost(st.game, t)
  const afford = st.game.cash >= cost
  return (
    <div className="absolute bottom-0 inset-x-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className={`${GLASS} max-w-md mx-auto rounded-3xl p-3 sheet-up`}>
        <div className="flex items-center gap-3">
          <RoomPreview type={t} w={56} />
          <div className="flex-1 min-w-0">
            <div className="font-display font-extrabold text-slate-800 text-lg leading-tight">{d.name}</div>
            <div className="text-[12px] text-slate-500 leading-snug">{st.target ? 'Touche encore la case, ou valide.' : 'Touche un emplacement libre en pointillés.'}</div>
          </div>
          <button onClick={() => st.cancelBuild()} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><X size={18} /></button>
        </div>
        {st.target && (
          <button onClick={() => st.confirmBuild()} disabled={!afford}
            className="w-full mt-3 rounded-2xl py-3 font-display font-extrabold text-[17px] text-white flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-40"
            style={{ background: 'linear-gradient(180deg,#34d399,#059669)' }}>
            <Check size={20} strokeWidth={3} /> {afford ? `Construire · ${fmtEur(cost)}` : `Il manque ${fmtEur(cost - st.game.cash)}`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Aperçu d'une pièce ───────────────────────────────────────────────────────
function RoomPreview({ type, w = 120, level = 1 }: { type: RoomType; w?: number; level?: number }) {
  const g = useRentier.getState().game
  const d = ROOMS[type]
  const fake: Room = { id: 'p', type, floor: 1, slot: 0, regime: type === 'studio' ? 'lmnp' : 'nu', level, stored: 0, tenants: [], incident: null, builtAt: 0, visits: 0 }
  const pw = d.w * SW
  return (
    <svg viewBox={`0 0 ${pw} ${FH - 8}`} width={w} height={(w * (FH - 8)) / pw} className="rounded-xl shrink-0" style={{ background: d.wall }}>
      <Interior r={fake} w={pw} night={0} skyCol="#bfe7ff" home={false} g={g} />
    </svg>
  )
}

// ── Feuille générique ────────────────────────────────────────────────────────
function Sheet({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/35 fade-in" />
      <div className="relative bg-[#f7f9fc] rounded-t-[32px] shadow-2xl sheet-up flex flex-col max-h-[86%]" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1.5 rounded-full bg-slate-300 mx-auto mt-2.5" />
        <div className="flex items-center justify-between px-5 pt-2 pb-2">
          <div className="font-display font-extrabold text-[22px] text-slate-800">{title}</div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-200/70 text-slate-500 flex items-center justify-center"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

// ── Construire ───────────────────────────────────────────────────────────────
export function BuildSheet() {
  useRentier((s) => s.rev)
  const st = useRentier.getState()
  const g = st.game
  const close = () => st.openSheet(null)
  const kindLabel: Record<string, string> = { home: 'Logement', shop: 'Commerce', parking: 'Sous-sol', service: 'Service', office: 'Bureaux' }
  return (
    <Sheet title="Construire" onClose={close}>
      <div className="space-y-2.5">
        {BUILD_ORDER.map((t) => {
          const d = ROOMS[t]
          const unlocked = isUnlocked(g, t)
          const cost = roomCost(g, t)
          const afford = g.cash >= cost
          const tax = d.kind === 'office' ? 'Fonciers 30 %' : d.kind === 'home' ? (t === 'studio' ? 'LMNP · 2 %' : 'Nu · 30 %') : d.kind === 'shop' ? 'Impôt société 25 %' : d.kind === 'parking' ? 'Fonciers 30 %' : ''
          const yieldLine = d.kind === 'office' ? `Bail ${fmtEur(d.rent ?? 0)}/mois · ${d.capacity} postes` : d.kind === 'home' ? `Loyer ${fmtEur(d.rent ?? 0)}/mois · ${d.capacity} habitant${(d.capacity ?? 1) > 1 ? 's' : ''}`
            : d.kind === 'shop' ? `${fmtEur(d.price ?? 0)} par client`
            : d.kind === 'parking' ? `${d.capacity} places à ${fmtEur(d.rent ?? 0)}/mois`
            : d.staff ? `${STAFF[d.staff].emoji} 1 ${STAFF[d.staff].title.toLowerCase()} · ${fmtEur(STAFF[d.staff].salary)}/mois` : ''
          return (
            <button key={t} disabled={!unlocked} onClick={() => st.chooseBuild(t)}
              className="w-full relative rounded-3xl bg-white p-3 flex items-center gap-3 text-left shadow-[0_4px_14px_-6px_rgba(15,40,80,0.25)] active:scale-[0.98] transition-transform">
              <div className={unlocked ? '' : 'grayscale opacity-40'}><RoomPreview type={t} w={d.w === 1 ? 64 : 104} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-extrabold text-slate-800 text-[16px] leading-tight">{d.name}</span>
                  <span className="text-[9px] font-extrabold uppercase text-slate-400">{kindLabel[d.kind]}</span>
                </div>
                <div className="text-[12px] text-emerald-600 font-bold">{yieldLine}</div>
                <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{d.desc}</div>
                {tax && <span className="inline-block mt-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-slate-100 text-slate-600">{tax}</span>}
              </div>
              <div className={`shrink-0 rounded-xl px-2.5 py-1.5 font-display font-extrabold text-[14px] ${afford ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'}`}>{fmtShort(cost)} €</div>
              {!unlocked && (
                <div className="absolute inset-0 rounded-3xl bg-white/60 flex items-center justify-center gap-2 text-slate-600 font-extrabold text-[13px]">
                  <Lock size={18} /> {d.research && !g.research.includes(d.research) ? `🔬 Recherche : ${RESEARCH.find((x) => x.id === d.research)?.name}` : `Débloqué à ${d.unlockFloors} étages`}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <p className="text-[12px] text-slate-400 text-center mt-3">Pour agrandir l’immeuble, touche « + Étage » sur le toit ou « + Sous-sol » en bas.</p>
    </Sheet>
  )
}

// ── Fiche d'une pièce ────────────────────────────────────────────────────────
export function RoomPanel() {
  useRentier((s) => s.rev)
  const st = useRentier.getState()
  const g = st.game
  const r = g.rooms.find((x) => x.id === st.selected)
  if (!r) return null
  const d = ROOMS[r.type]
  const rent = monthlyRent(g, r)
  const has = (t: RoomType) => g.rooms.some((x) => x.type === t)
  const ps = parkingStatus(g)
  return (
    <div className="absolute bottom-0 inset-x-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className={`${GLASS} max-w-md mx-auto rounded-[28px] p-4 sheet-up max-h-[70vh] overflow-y-auto`}>
        <div className="flex items-start gap-3">
          <RoomPreview type={r.type} w={d.w === 1 ? 60 : 92} level={r.level} />
          <div className="flex-1 min-w-0">
            <div className="font-display font-extrabold text-[19px] text-slate-800 leading-tight">{d.name}</div>
            <div className="text-[11px] text-slate-400 font-bold">{r.floor === 0 ? 'Rez-de-chaussée' : r.floor < 0 ? `Sous-sol ${-r.floor}` : `Étage ${r.floor}`}</div>
            {d.kind !== 'fixed' && <div className="flex gap-0.5 mt-0.5">{[1, 2, 3].map((i) => <Star key={i} size={12} className={i <= r.level ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />)}</div>}
          </div>
          <button onClick={() => st.select(null)} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><X size={18} /></button>
        </div>

        {r.incident && (
          <button onClick={() => st.repair(r.id)} className="w-full mt-3 rounded-2xl bg-rose-50 border-2 border-rose-200 px-3 py-2.5 flex items-center gap-2 active:scale-[0.98]">
            <span className="text-2xl">{r.incident.kind === 'fuite' ? '💧' : '⚡'}</span>
            <div className="flex-1 text-left">
              <div className="font-extrabold text-rose-700 text-[14px]">{r.incident.kind === 'fuite' ? 'Fuite d’eau' : 'Panne électrique'}</div>
              <div className="text-[11px] text-rose-500">Les locataires perdent patience chaque mois.</div>
            </div>
            <span className="rounded-xl bg-rose-500 text-white font-extrabold text-[13px] px-3 py-1.5 flex items-center gap-1"><Wrench size={14} /> {fmtEur(repairCost(r))}</span>
          </button>
        )}

        {/* Logement */}
        {d.kind === 'home' && (
          <>
            <div className="mt-3 rounded-2xl bg-emerald-50 px-3.5 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Loyer net</div>
                <div className="font-display font-extrabold text-[22px] text-emerald-600 leading-none mt-0.5">+{fmtEur(rent.net)}<span className="text-[12px]">/mois</span></div>
              </div>
              <div className="text-right text-[11px] text-slate-500 leading-snug">Brut {fmtEur(rent.gross)}<br /><span className="text-rose-500 font-bold">Impôt {Math.round(taxRate(r) * 100)} % ({r.regime === 'lmnp' ? 'LMNP' : 'location nue'})</span></div>
            </div>
            <div className="mt-2 space-y-1.5">
              {r.tenants.length === 0 && <div className="text-[13px] text-slate-500 text-center py-2">🔑 À louer — un locataire arrive bientôt.</div>}
              {r.tenants.map((t) => (
                <div key={t.id} className="rounded-2xl bg-white border border-slate-100 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{face(t.sat)}</span>
                    <span className="font-extrabold text-slate-700 text-[14px]">{t.name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${t.sat}%`, background: t.sat > 55 ? '#34d399' : t.sat > 35 ? '#fbbf24' : '#f87171' }} /></div>
                    <span className="text-[11px] font-bold text-slate-400 tabular-nums">{Math.round(t.sat)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {t.needs.map((n) => {
                      const ok = has(needRoom[n])
                      return <span key={n} className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{NEED_ICON[n]} {NEED_LABEL[n]} {ok ? '✓' : '✗'}</span>
                    })}
                    {t.car && <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${ps.spots >= ps.cars ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>🚗 Parking {ps.spots >= ps.cars ? '✓' : '✗'}</span>}
                  </div>
                </div>
              ))}
            </div>
            {r.regime === 'nu' && (
              <button onClick={() => st.furnish(r.id)} className="w-full mt-2 rounded-2xl bg-sky-50 border border-sky-200 px-3 py-2 flex items-center gap-2 active:scale-[0.98]">
                <Sofa size={18} className="text-sky-600" />
                <div className="flex-1 text-left text-[12px] text-sky-800"><b>Meubler → LMNP</b> : l’impôt sur ce loyer passe de 30 % à {Math.round(TAX.lmnp * 100)} %.</div>
                <span className="font-extrabold text-[13px] text-sky-700">{fmtShort(FURNISH_COST(r.type))} €</span>
              </button>
            )}
          </>
        )}

        {d.kind === 'shop' && (() => {
          const stations = stationsOf(st.world, r)
          const busy = stations.filter((s) => s.agentId).length
          const queue = st.world.queues[r.id]?.length ?? 0
          const unit = r.type === 'laverie' ? 'machine' : r.type === 'cafe' ? 'table' : r.type === 'bar' ? 'tabouret' : 'appareil'
          return (
            <>
              <div className="mt-3 rounded-2xl bg-emerald-50 px-3.5 py-2.5">
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Recettes</div>
                <div className="font-display font-extrabold text-[20px] text-emerald-600 leading-tight">{fmtEur((d.price ?? 0) * (1 + 0.25 * (r.level - 1)) * (1 - TAX.bic))} <span className="text-[12px]">net par client</span></div>
                <div className="text-[12px] text-slate-500 mt-0.5">{r.visits} clients servis depuis l’ouverture.</div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-white border border-slate-100 py-2"><div className="font-display font-extrabold text-[18px] text-slate-700">{busy}/{stationCount(r)}</div><div className="text-[10px] font-bold text-slate-400">{unit}s occupé{busy > 1 ? 'e' : ''}s</div></div>
                <div className={`rounded-2xl border py-2 ${queue >= 3 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'}`}><div className={`font-display font-extrabold text-[18px] ${queue >= 3 ? 'text-rose-600' : 'text-slate-700'}`}>{queue}</div><div className="text-[10px] font-bold text-slate-400">en attente</div></div>
                <div className="rounded-2xl bg-white border border-slate-100 py-2"><div className="font-display font-extrabold text-[18px] text-slate-700">{serviceTime(g, r.type).toFixed(r.type === 'laverie' ? 0 : 1).replace('.0', '')} s</div><div className="text-[10px] font-bold text-slate-400">{r.type === 'laverie' ? 'par lavage' : 'par client'}</div></div>
              </div>
              {queue >= 2 && <div className="mt-2 text-[12px] text-rose-600 font-bold text-center">Trop d’attente : rénove pour ajouter {unit === 'machine' ? 'une machine' : `un${unit === 'table' ? 'e' : ''} ${unit}`}, ou construis-en un second.</div>}
            </>
          )
        })()}
        {d.kind === 'parking' && (
          <div className="mt-3 rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-[13px] text-slate-600">
            <div className="font-display font-extrabold text-[20px] text-emerald-600">+{fmtEur(rent.net)}/mois</div>
            {ps.cars} voiture{ps.cars > 1 ? 's' : ''} chez tes locataires pour {ps.spots} places.
          </div>
        )}
        {d.staff && (() => {
          const role = d.staff
          const crew = st.world.agents.filter((a) => a.kind === 'staff' && a.homeId === r.id)
          const status = (a: Agent) => {
            const s0 = a.steps[0]
            const tr = a.task ? g.rooms.find((x) => x.id === a.task) : undefined
            const where = tr ? `${ROOMS[tr.type].name} (${tr.floor === 0 ? 'RDC' : tr.floor < 0 ? `S${-tr.floor}` : `ét. ${tr.floor}`})` : ''
            if (role === 'guard' && a.task) return '🚨 Poursuit un cambrioleur'
            if (s0?.t === 'clean') return `🧽 Nettoie : ${where}`
            if (s0?.t === 'fix') return `🔧 Répare : ${where}`
            if (tr) return `${role === 'janitor' ? '🧹' : '🧰'} En route : ${where}`
            if (role === 'guard' && a.steps.length && a.floor !== r.floor) return '🔦 Ronde de nuit'
            return a.steps.length ? '🚶 Se déplace' : '☕ En pause'
          }
          return (
            <div className="mt-3 rounded-2xl bg-white border border-slate-100 px-3.5 py-2.5">
              <div className="text-[12px] text-slate-600">{d.desc}</div>
              <div className="mt-2 space-y-1">
                {crew.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <span className="text-lg">{STAFF[role].emoji}</span>
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-700 text-[13px] leading-tight">{STAFF[role].title} {crew.length > 1 ? i + 1 : ''}</div>
                      <div className="text-[11px] font-bold text-slate-500 truncate">{status(a)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[12px] font-bold text-rose-500">Salaires : −{fmtEur(STAFF[role].salary * r.level)}/mois</div>
            </div>
          )
        })()}
        {dirtOf(r) >= 15 && (
          <div className="mt-2 rounded-2xl bg-amber-50 border border-amber-200 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{dirtOf(r) > 60 ? '🤢' : '🧹'}</span>
              <div className="flex-1">
                <div className="text-[12px] font-extrabold text-amber-800">Propreté {Math.round(100 - dirtOf(r))} %</div>
                <div className="h-1.5 mt-1 rounded-full bg-amber-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${100 - dirtOf(r)}%`, background: dirtOf(r) > 60 ? '#ef4444' : dirtOf(r) > 35 ? '#f59e0b' : '#22c55e' }} /></div>
              </div>
              <button onClick={() => st.clean(r.id)} className="rounded-xl bg-amber-500 text-white font-extrabold text-[12px] px-2.5 py-1.5 active:scale-95">Nettoyer · {fmtEur(CLEAN_COST)}</button>
            </div>
            {!g.rooms.some((x) => x.type === 'menage') && <div className="text-[11px] text-amber-700 mt-1">Un local d’entretien nettoie tout l’immeuble automatiquement.</div>}
          </div>
        )}
        {r.type === 'lobby' && (
          <div className="mt-3 rounded-2xl bg-white border border-slate-100 px-3.5 py-2.5">
            {!g.liftOn ? (
              <>
                <div className="font-extrabold text-slate-700 text-[14px]">🪜 Pas encore d’ascenseur</div>
                <div className="text-[12px] text-slate-500">Tout le monde monte à pied : c’est lent et ça fatigue tes locataires.</div>
                <button onClick={() => st.installLift()} className="w-full mt-2 rounded-xl py-2.5 font-extrabold text-white text-[14px] active:scale-[0.98]" style={{ background: 'linear-gradient(180deg,#ffb547,#f2792b)' }}>
                  🛗 Installer l’ascenseur · {fmtEur(liftInstallCost(g.top - g.bottom))}
                </button>
              </>
            ) : (
              <>
                <div className="font-extrabold text-slate-700 text-[14px]">🛗 Ascenseur niveau {g.liftLevel} · étages {g.liftBottom < 0 ? `S${-g.liftBottom}` : 'RDC'} → {g.liftTop}</div>
                <div className="text-[12px] text-slate-500">Plus rapide et plus grand : moins d’attente, des locataires plus heureux.</div>
                {g.liftLevel < 3 && (g.research.includes(liftNeeds(g.liftLevel)) ? (
                  <button onClick={() => st.upgradeLift()} className="w-full mt-2 rounded-xl py-2.5 font-extrabold text-white text-[14px] active:scale-[0.98]" style={{ background: 'linear-gradient(180deg,#ffb547,#f2792b)' }}>
                    Moderniser · {fmtEur(liftCost(g.liftLevel))}
                  </button>
                ) : <div className="mt-2 text-[12px] font-bold text-indigo-600">🔬 Recherche requise : {RESEARCH.find((x) => x.id === liftNeeds(g.liftLevel))?.name}</div>)}
              </>
            )}
          </div>
        )}
        {r.type === 'bureau' && (() => {
          const d2 = desksOf(st.world, r)
          const ids = new Set(d2.filter(Boolean))
          const workers = st.world.agents.filter((a) => ids.has(a.id))
          const inHouse = workers.filter((a) => a.kind === 'res').length
          return (
            <div className="mt-3 rounded-2xl bg-emerald-50 px-3.5 py-2.5">
              <div className="font-display font-extrabold text-[20px] text-emerald-600">+{fmtEur(rent.net)}/mois</div>
              <div className="text-[12px] text-slate-600">Bail commercial (revenus fonciers 30 %). {workers.length}/{d2.length} postes occupés, dont <b>{inHouse}</b> de tes locataires (pas de transports : ils sont plus heureux).</div>
            </div>
          )
        })()}
        {r.type === 'labo' && (
          <div className="mt-2 rounded-2xl bg-indigo-50 px-3.5 py-2.5 text-[12px] text-indigo-800">
            💡 <b>{Math.floor(g.rp)} points</b> de recherche · {r.level} chercheur{r.level > 1 ? 's' : ''} (+{(RP_RATE * r.level * 15).toFixed(0)} pts par jour de travail)
            <button onClick={() => st.openSheet('research')} className="block w-full mt-2 rounded-xl py-2 font-extrabold text-white bg-indigo-500 active:scale-[0.98]">Ouvrir l’arbre de recherche</button>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          {r.stored >= 1 && d.kind !== 'fixed' && (
            <button onClick={(e) => st.collect(r.id, e.clientX, e.clientY)} className="flex-1 rounded-2xl py-3 font-display font-extrabold text-amber-900 text-[15px] active:scale-[0.97]" style={{ background: 'linear-gradient(180deg,#ffe27a,#f7b733)' }}>
              Encaisser {fmtEur(r.stored)}
            </button>
          )}
          {canRenovate(r) && (
            <button onClick={() => st.renovate(r.id)} disabled={g.cash < renovateCost(r)}
              className="flex-1 rounded-2xl py-3 font-display font-extrabold text-white text-[14px] flex flex-col items-center leading-tight active:scale-[0.97] disabled:opacity-40"
              style={{ background: 'linear-gradient(180deg,#ffb547,#f2792b)' }}>
              <span className="flex items-center gap-1"><ArrowUpCircle size={16} /> Rénover · {fmtShort(renovateCost(r))} €</span>
              <span className="text-[10px] text-white/85">{d.kind === 'home' ? '+18 % de loyer · locataires ravis' : d.kind === 'shop' ? `+1 ${r.type === 'laverie' ? 'machine' : 'poste'} · +25 % par client` : d.staff ? `+1 ${STAFF[d.staff].title.toLowerCase()}` : '+18 % de loyer'}</span>
            </button>
          )}
        </div>
        {r.type !== 'lobby' && (d.kind !== 'home' || r.tenants.length === 0) && (
          <button onClick={() => st.demolish(r.id)} className="w-full mt-2 text-[12px] text-slate-400 underline">Revendre ce local (+{fmtEur(d.cost * 0.5)})</button>
        )}
      </div>
    </div>
  )
}

// ── Recherche ────────────────────────────────────────────────────────────────
export function ResearchSheet() {
  useRentier((s) => s.rev)
  const st = useRentier.getState()
  const g = st.game
  const researchers = st.world.agents.filter((a) => a.role === 'researcher')
  const working = researchers.filter((a) => a.steps[0]?.t === 'work').length
  return (
    <Sheet title="Recherche" onClose={() => st.openSheet(null)}>
      <div className="rounded-3xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
        <div className="text-[12px] font-bold text-white/80 uppercase tracking-wider">Points de recherche</div>
        <div className="font-display font-extrabold text-[34px] leading-none mt-1">💡 {Math.floor(g.rp)}</div>
        <div className="text-[12px] text-white/85 mt-1">
          {researchers.length ? `${researchers.length} chercheur${researchers.length > 1 ? 's' : ''} · ${working} au travail en ce moment` : 'Aucun chercheur : construis un Laboratoire R&D.'}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {[...RESEARCH].sort((a, b) => {
          const rank = (x: typeof a) => (g.research.includes(x.id) ? 2 : x.req && !g.research.includes(x.req) ? 1 : 0)
          return rank(a) - rank(b) || a.cost - b.cost
        }).map((r) => {
          const done = g.research.includes(r.id)
          const locked = !!r.req && !g.research.includes(r.req)
          const ok = canResearch(g, r.id)
          return (
            <div key={r.id} className={`rounded-2xl p-3 flex items-center gap-3 ${done ? 'bg-emerald-50' : 'bg-white shadow-[0_4px_14px_-6px_rgba(15,40,80,0.2)]'} ${locked ? 'opacity-50' : ''}`}>
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl ${done ? 'bg-emerald-200' : 'bg-indigo-50'}`}>{r.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-[14px] text-slate-800 leading-tight">{r.name}</div>
                <div className="text-[11px] text-slate-500 leading-snug">{locked ? `Nécessite : ${RESEARCH.find((x) => x.id === r.req)?.name}` : r.desc}</div>
                {!done && !locked && <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.min(100, (g.rp / r.cost) * 100)}%` }} /></div>}
              </div>
              {done ? <Check className="text-emerald-600" size={22} /> : (
                <button disabled={!ok} onClick={() => st.research(r.id)} className="shrink-0 rounded-xl px-3 py-2 font-extrabold text-[13px] text-white disabled:bg-slate-300 bg-indigo-500 active:scale-95">💡 {r.cost}</button>
              )}
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

// ── Personnel ────────────────────────────────────────────────────────────────
export function staffStatus(g: Game, a: Agent): string {
  const s0 = a.steps[0]
  const tr = a.task ? g.rooms.find((x) => x.id === a.task) : undefined
  const where = tr ? `${ROOMS[tr.type].name} (${tr.floor === 0 ? 'RDC' : tr.floor < 0 ? `S${-tr.floor}` : `ét. ${tr.floor}`})` : ''
  if (a.away) return '🏠 Rentré chez lui'
  if (a.role === 'guard' && a.task) return '🚨 Poursuit un cambrioleur'
  if (s0?.t === 'clean') return `🧽 Nettoie : ${where}`
  if (s0?.t === 'fix') return `🔧 Répare : ${where}`
  if (s0?.t === 'work') return '💡 Fait de la recherche'
  if (s0?.t === 'enter' || s0?.t === 'queue' || s0?.t === 'serve') return '☕ Pause déjeuner'
  if (s0?.t === 'stairs') return '🪜 Dans l’escalier'
  if (s0?.t === 'lift' || a.inLift) return '🛗 Prend l’ascenseur'
  if (tr) return `${a.role === 'janitor' ? '🧹' : '🧰'} En route : ${where}`
  if (a.role === 'guard' && a.steps.length) return '🔦 Ronde'
  return a.steps.length ? '🚶 Se déplace' : '☕ En pause'
}

export function StaffSheet() {
  useRentier((s) => s.rev)
  const st = useRentier.getState()
  const g = st.game
  const roles: StaffRole[] = ['researcher', 'janitor', 'tech', 'guard']
  const roomFor: Record<StaffRole, RoomType> = { researcher: 'labo', janitor: 'menage', tech: 'concierge', guard: 'securite' }
  return (
    <Sheet title="Personnel" onClose={() => st.openSheet(null)}>
      <div className="text-[13px] text-slate-500 mb-2">Salaires : <b className="text-rose-500">−{fmtEur(salaries(g))}/mois</b>. Rénove un local pour embaucher (jusqu’à 3 par local).</div>
      <div className="space-y-2.5">
        {roles.map((role) => {
          const crew = st.world.agents.filter((a) => a.kind === 'staff' && a.role === role)
          const rt = roomFor[role]
          return (
            <div key={role} className="rounded-3xl bg-white p-3 shadow-[0_4px_14px_-6px_rgba(15,40,80,0.2)]">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{STAFF[role].emoji}</span>
                <div className="flex-1">
                  <div className="font-extrabold text-slate-800 text-[15px]">{STAFF[role].title}{crew.length > 1 ? 's' : ''} · {crew.length}</div>
                  <div className="text-[11px] text-slate-400 font-bold">{fmtEur(STAFF[role].salary)}/mois chacun · {ROOMS[rt].name}</div>
                </div>
              </div>
              {crew.length === 0 ? (
                <div className="text-[12px] text-slate-500 mt-1.5">{isUnlocked(g, rt) ? `Construis un ${ROOMS[rt].name.toLowerCase()} pour embaucher.` : `🔒 ${ROOMS[rt].research ? `Recherche : ${RESEARCH.find((x) => x.id === ROOMS[rt].research)?.name}` : `Débloqué à ${ROOMS[rt].unlockFloors} étages`}`}</div>
              ) : (
                <div className="mt-1.5 space-y-1">
                  {crew.map((a, i) => <div key={a.id} className="flex items-center justify-between text-[12px]"><span className="font-bold text-slate-600">#{i + 1}</span><span className="font-bold text-slate-500 truncate ml-2">{staffStatus(g, a)}</span></div>)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

// ── Objectifs ────────────────────────────────────────────────────────────────
export function QuestsSheet() {
  useRentier((s) => s.rev)
  const st = useRentier.getState()
  const g = st.game
  return (
    <Sheet title="Objectifs" onClose={() => st.openSheet(null)}>
      <div className="space-y-2.5">
        {g.quests.map((q) => {
          const ratio = Math.min(1, questProgress(g, q) / q.target)
          return (
            <div key={q.id} className={`rounded-3xl p-3.5 ${q.done ? 'bg-gradient-to-r from-amber-100 to-yellow-50 ring-2 ring-amber-300' : 'bg-white shadow-[0_4px_14px_-6px_rgba(15,40,80,0.2)]'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl ${q.done ? 'bg-amber-400' : 'bg-sky-50'}`}>{q.done ? '🏆' : '🎯'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-[14px] text-slate-800 leading-snug">{q.title}</div>
                  <div className="text-[12px] text-amber-700 font-extrabold flex items-center gap-1 mt-0.5"><span className="coin coin-sm" /> {fmtEur(q.reward)}</div>
                </div>
                {q.done && <button onClick={(e) => st.claim(q.id, e.clientX, e.clientY)} className="rounded-2xl px-3.5 py-2.5 font-display font-extrabold text-white text-[14px] active:scale-95 pop-in" style={{ background: 'linear-gradient(180deg,#34d399,#059669)' }}>Réclamer</button>}
              </div>
              {!q.done && <div className="mt-2.5 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-sky-400" style={{ width: `${ratio * 100}%` }} /></div>}
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

// ── Patrimoine ───────────────────────────────────────────────────────────────
export function StatsSheet() {
  useRentier((s) => s.rev)
  const st = useRentier.getState()
  const g = st.game
  const [confirmReset, setConfirmReset] = useState(false)
  const rents = g.rooms.reduce((a, r) => a + monthlyRent(g, r).net, 0)
  const shops = shopAverage(g)
  const ch = charges(g)
  return (
    <Sheet title="Patrimoine" onClose={() => st.openSheet(null)}>
      <div className="rounded-3xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#10b981)' }}>
        <div className="text-[12px] font-bold text-white/80 uppercase tracking-wider">Patrimoine net</div>
        <div className="font-display font-extrabold text-[34px] leading-none mt-1">{fmtEur(netWorth(g))}</div>
        <div className="text-[12px] text-white/85 mt-1">dont immeuble {fmtEur(buildingValue(g))}</div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <Mini label="Locataires" value={`${tenantCount(g)}`} />
          <Mini label="Satisfaction" value={`${face(avgSat(g))} ${Math.round(avgSat(g))}`} />
          <Mini label="Liberté" value={`${Math.round(freedom(g) * 100)} %`} />
        </div>
      </div>
      <div className="mt-3 rounded-3xl bg-white p-4 shadow-[0_4px_14px_-6px_rgba(15,40,80,0.2)] text-[14px]">
        <div className="font-extrabold text-slate-700 mb-2">Ton budget mensuel</div>
        <Line label="🏠 Loyers nets d’impôt" value={rents} />
        <Line label="🛍️ Recettes des commerces" value={shops} />
        <Line label="🧾 Charges de l’immeuble" value={-(ch - salaries(g))} />
        {salaries(g) > 0 && <Line label="👷 Salaires du personnel" value={-salaries(g)} />}
        <div className="border-t border-slate-100 mt-2 pt-2"><Line label="= Revenus nets" value={monthlyNet(g)} bold /></div>
        <Line label="🎯 Ton train de vie" value={LIFESTYLE} muted />
        <div className="text-[12px] text-slate-400 mt-2">Impôts payés : {fmtEur(g.stats.taxes)} · {g.stats.moves} déménagement{g.stats.moves > 1 ? 's' : ''} · {g.stats.lost ?? 0} client{(g.stats.lost ?? 0) > 1 ? 's' : ''} perdu{(g.stats.lost ?? 0) > 1 ? 's' : ''}{(g.stats.caught || g.stats.stolen) ? ` · ${g.stats.caught ?? 0} cambrioleur${(g.stats.caught ?? 0) > 1 ? 's' : ''} arrêté${(g.stats.caught ?? 0) > 1 ? 's' : ''}, ${fmtEur(g.stats.stolen ?? 0)} volés` : ''}</div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => st.toggleMute()} className="flex-1 rounded-2xl bg-white py-3 font-bold text-slate-600 flex items-center justify-center gap-2 shadow-sm">
          {g.muted ? <VolumeX size={18} /> : <Volume2 size={18} />} Son {g.muted ? 'coupé' : 'activé'}
        </button>
        <button onClick={() => (confirmReset ? (st.reset(), st.openSheet(null)) : setConfirmReset(true))}
          className={`flex-1 rounded-2xl py-3 font-bold flex items-center justify-center gap-2 shadow-sm ${confirmReset ? 'bg-rose-500 text-white' : 'bg-white text-slate-600'}`}>
          <RotateCcw size={18} /> {confirmReset ? 'Confirmer ?' : 'Recommencer'}
        </button>
      </div>
      <div className="text-center mt-4 mb-2 text-[12px] text-slate-400 space-x-3">
        <a href="?archipel" className="underline">Archipel</a><a href="?classic" className="underline">Version classique</a>
      </div>
    </Sheet>
  )
}

function Line({ label, value, bold, muted }: { label: string; value: number; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 ${bold ? 'font-extrabold text-slate-800' : muted ? 'text-slate-400' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${!muted && value < 0 ? 'text-rose-500' : !muted && bold ? 'text-emerald-600' : ''}`}>{value >= 0 && !muted ? '+' : ''}{fmtEur(value)}</span>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/20 py-2"><div className="font-display font-extrabold text-[17px] leading-none">{value}</div><div className="text-[10px] font-bold text-white/80 mt-1">{label}</div></div>
}

// ── Toasts / pièces / modales ────────────────────────────────────────────────
export function Toasts() {
  const toasts = useRentier((s) => s.toasts)
  const dismiss = useRentier((s) => s.dismissToast)
  useEffect(() => {
    if (!toasts.length) return
    const t = setTimeout(() => dismiss(toasts[0].id), 3600)
    return () => clearTimeout(t)
  }, [toasts, dismiss])
  const t = toasts[0]
  if (!t) return null
  const ring = t.tone === 'gold' ? 'ring-amber-300' : t.tone === 'warn' ? 'ring-rose-300' : t.tone === 'good' ? 'ring-emerald-300' : 'ring-sky-200'
  return (
    <div className="absolute inset-x-0 top-[124px] z-40 flex justify-center px-4 pointer-events-none">
      <button key={t.id} onClick={() => dismiss(t.id)} className={`${GLASS} pointer-events-auto rounded-2xl px-4 py-2.5 flex items-center gap-3 max-w-sm ring-2 ${ring} toast-in`}>
        <span className="text-2xl">{t.icon}</span>
        <div className="text-left">
          <div className="font-display font-extrabold text-slate-800 text-[15px] leading-tight">{t.title}</div>
          {t.text && <div className="text-[12px] text-slate-500 leading-snug">{t.text}</div>}
        </div>
      </button>
    </div>
  )
}

export function Flies() {
  const flies = useRentier((s) => s.flies)
  return <>{flies.map((f) => <Fly key={f.id} {...f} />)}</>
}

function Fly({ id, x, y, amount }: { id: number; x: number; y: number; amount: number }) {
  const layer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const anchor = document.getElementById('cash-anchor')?.getBoundingClientRect()
    const tx = anchor ? anchor.left + 22 : 40, ty = anchor ? anchor.top + anchor.height / 2 : 30
    const n = Math.max(5, Math.min(14, Math.round(Math.log10(amount + 10) * 4)))
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div')
      c.className = 'coin fly-coin'
      layer.current!.appendChild(c)
      const sx = x + (Math.random() - 0.5) * 50, sy = y + (Math.random() - 0.5) * 30
      const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 120, my = Math.min(sy, ty) - 60 - Math.random() * 80
      const an = c.animate([
        { transform: `translate(${sx}px,${sy}px) scale(0.4)`, opacity: 0 },
        { transform: `translate(${sx}px,${sy - 40}px) scale(1.1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${mx}px,${my}px) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${tx}px,${ty}px) scale(0.6)`, opacity: 0.9 },
      ], { duration: 750 + i * 45, easing: 'cubic-bezier(.5,0,.6,1)', delay: i * 25 })
      an.onfinish = () => { c.remove(); sfxTick(); const a = document.getElementById('cash-anchor'); a?.classList.remove('cash-bump'); void a?.offsetWidth; a?.classList.add('cash-bump') }
    }
    const t = setTimeout(() => useRentier.getState().removeFly(id), 1600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div ref={layer} className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute float-up" style={{ left: x, top: y - 20 }}>
        <div className="font-display font-extrabold text-[26px] text-amber-400 gain-text whitespace-nowrap">+{fmtEur(amount)}</div>
      </div>
    </div>
  )
}

export function Coach() {
  useRentier((s) => s.rev)
  const st = useRentier.getState()
  const g = st.game
  if (st.buildType || st.sheet || st.selected || g.questCursor > 8) return null
  const q = g.quests.find((x) => !x.done)
  if (!q) return null
  const tips: Partial<Record<string, string>> = {
    collect: '👆 Touche la pièce dorée au-dessus du studio',
    build: `🔨 Touche « Construire » puis ${q.param ? ROOMS[q.param as RoomType].name : 'une pièce'}`,
    count: '🔨 Construis d’autres studios dans les cases libres',
    floors: '⬆️ Touche « + Étage » sur le toit de l’immeuble',
    lift: '🛗 Touche « Installer » dans la cage, à droite de l’immeuble',
    research: '🔬 Ouvre « Recherche » et dépense tes points 💡',
  }
  const tip = tips[q.kind]
  if (!tip) return null
  return (
    <div className="absolute inset-x-0 bottom-[112px] z-20 flex justify-center pointer-events-none px-6">
      <div className="rounded-full bg-slate-900/80 text-white text-[13px] font-bold px-4 py-2 coach-bob text-center">{tip}</div>
    </div>
  )
}

export function Intro() {
  const finish = useRentier((s) => s.finishIntro)
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center p-4 fade-in" style={{ background: 'linear-gradient(180deg, rgba(10,16,40,0.1) 0%, rgba(10,16,40,0.78) 55%)' }}>
      <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl sheet-up">
        <div className="text-center">
          <div className="text-[13px] font-extrabold tracking-[0.3em] text-indigo-500">BIENVENUE CHEZ</div>
          <div className="font-display font-extrabold text-[42px] leading-none text-slate-800 mt-1">RENTIER INC.</div>
          <div className="text-slate-500 mt-2 text-[15px]">Bâtis ton immeuble. Fais vivre tes locataires.</div>
        </div>
        <div className="mt-5 space-y-3">
          <IL icon="🏢" title="Construis vers le haut" text="Ajoute des étages, des sous-sols, et place studios, cafés, laveries, parkings…" />
          <IL icon="🧑‍🤝‍🧑" title="Des locataires bien vivants" text="Ils travaillent, prennent l’ascenseur, ont des besoins. Mécontents, ils paient moins… puis déménagent." />
          <IL icon="🪙" title="Encaisse tes loyers" text="Touche les pièces au-dessus des logements et des commerces." />
          <IL icon="🕊️" title="Deviens libre" text="Quand tes revenus nets couvrent ton train de vie, tu as gagné ta liberté." />
        </div>
        <button onClick={() => { sfxTap(); finish() }} className="w-full mt-6 rounded-2xl py-4 font-display font-extrabold text-[19px] text-white active:scale-[0.97]" style={{ background: 'linear-gradient(180deg,#ffb547,#f2792b)' }}>
          Ouvrir mon immeuble
        </button>
      </div>
    </div>
  )
}

function IL({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl shrink-0">{icon}</div>
      <div><div className="font-extrabold text-slate-800 text-[15px]">{title}</div><div className="text-[13px] text-slate-500 leading-snug">{text}</div></div>
    </div>
  )
}

export function Welcome() {
  const w = useRentier((s) => s.welcome)
  const close = useRentier((s) => s.closeWelcome)
  if (!w) return null
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 fade-in">
      <div className="w-full max-w-sm bg-white rounded-[32px] p-6 text-center shadow-2xl pop-in">
        <div className="text-5xl">🌅</div>
        <div className="font-display font-extrabold text-[28px] text-slate-800 mt-1">Bon retour !</div>
        <div className="text-slate-500 text-[14px]">{Math.round(w.months)} mois de loyers pendant ton absence.</div>
        <div className="my-5 rounded-3xl bg-amber-50 py-4"><div className="font-display font-extrabold text-[38px] text-amber-500 leading-none">+{fmtEur(w.gained)}</div></div>
        <button onClick={close} className="w-full rounded-2xl py-4 font-display font-extrabold text-[18px] text-amber-900" style={{ background: 'linear-gradient(180deg,#ffe27a,#f7b733)' }}>Encaisser</button>
      </div>
    </div>
  )
}

export function Celebrate() {
  const c = useRentier((s) => s.celebrate)
  const close = useRentier((s) => s.closeCelebrate)
  if (c == null) return null
  const tier = FREEDOM_TIERS[c]
  const g: Game = useRentier.getState().game
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 fade-in overflow-hidden">
      {Array.from({ length: 60 }, (_, i) => <span key={i} className="confetti" style={{ left: `${(i * 37) % 100}%`, background: ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'][i % 5], animationDelay: `${(i % 15) / 10}s`, animationDuration: `${2.5 + (i % 7) / 3}s` }} />)}
      <div className="relative w-full max-w-sm bg-white rounded-[32px] p-6 text-center shadow-2xl pop-in">
        <div className="text-6xl">{tier.emoji}</div>
        <div className="font-display font-extrabold text-[30px] leading-tight text-slate-800 mt-2">{tier.title} !</div>
        <div className="text-slate-500 text-[14px] mt-2">Ton immeuble rapporte {fmtEur(monthlyNet(g))} nets par mois : {Math.round(tier.pct * 100)} % de ton train de vie.</div>
        <button onClick={close} className="w-full mt-5 rounded-2xl py-4 font-display font-extrabold text-[18px] text-white" style={{ background: 'linear-gradient(180deg,#34d399,#059669)' }}>Continuer à bâtir</button>
      </div>
    </div>
  )
}
