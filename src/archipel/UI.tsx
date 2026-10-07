/**
 * ARCHIPEL — interface (HUD, dock, feuilles, effets).
 */

import { useEffect, useRef, useState } from 'react'
import {
  Hammer, Map as MapIcon, Target, PieChart, LineChart, X, Lock, Unlock, ArrowUpCircle, Coins,
  Volume2, VolumeX, RotateCcw, Check, TrendingUp, Star,
} from 'lucide-react'
import { useArchipel } from './store'
import {
  canUpgrade, currentTaxRate, dateLabel, freedom, isMature, isUnlocked, monthlyProduction, netWorth,
  nextLandCost, passiveIncome, placementCost, questProgress, salePreview, savingsPerMonth, storageCap,
  synergyFor, upgradePrice, yearsHeld, buildingValue, isLand, expenses, expensesFor, atMaxCount,
} from './engine'
import {
  DEFS, BUILDABLE, FREEDOM_TIERS, MONTHS_FR, PHASES, SALARY_BY_LEVEL, type BType,
} from './data'
import { MiniArt } from './art'
import { fmtEur, fmtShort, fmtPct } from './format'
import { sfxTap, sfxTick } from './audio'

const GLASS = 'bg-white/90 backdrop-blur-md shadow-[0_10px_30px_-8px_rgba(10,40,70,0.35)]'

// ── Valeur animée ────────────────────────────────────────────────────────────
function useTween(value: number, ms = 650) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const start = useRef(0)
  const raf = useRef(0)
  useEffect(() => {
    from.current = shown
    start.current = performance.now()
    cancelAnimationFrame(raf.current)
    const step = (t: number) => {
      const k = Math.min(1, (t - start.current) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      setShown(from.current + (value - from.current) * e)
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return shown
}

// ── HUD ──────────────────────────────────────────────────────────────────────
export function Hud() {
  const g = useArchipel((s) => s.game)
  const openSheet = useArchipel((s) => s.openSheet)
  const cash = useTween(g.cash)
  const { monthIdx, year } = dateLabel(g.month)
  const ph = PHASES[g.market.phase]
  const f = freedom(g)
  const passive = passiveIncome(g)
  const tier = [...FREEDOM_TIERS].reverse().find((t) => f >= t.pct)
  return (
    <div className="absolute top-0 inset-x-0 z-30 px-3 pt-[max(10px,env(safe-area-inset-top))] pointer-events-none">
      <div className="flex items-start gap-2 max-w-md mx-auto">
        <div id="cash-anchor" className={`${GLASS} pointer-events-auto rounded-2xl pl-2 pr-4 py-1.5 flex items-center gap-2`}>
          <span className="coin coin-lg" />
          <div className="leading-none">
            <div className="font-display font-extrabold text-[24px] text-slate-800 tabular-nums tracking-tight">{fmtEur(cash)}</div>
          </div>
        </div>
        <div className="flex-1" />
        <button onClick={() => openSheet('stats')} className={`${GLASS} pointer-events-auto rounded-2xl px-3 py-1.5 text-right`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">{MONTHS_FR[monthIdx]} {year}</div>
          <div className="text-[13px] font-extrabold text-slate-700 leading-tight mt-0.5">{ph.emoji} {ph.label}</div>
        </button>
      </div>
      <button onClick={() => openSheet('stats')} className={`${GLASS} pointer-events-auto rounded-2xl px-3.5 py-2 mt-2 max-w-md mx-auto w-full block text-left`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">{tier ? `${tier.emoji} ${tier.title}` : '🌱 Liberté financière'}</span>
          <span className="text-[12px] font-extrabold text-slate-600 tabular-nums">{fmtShort(passive)} / {fmtShort(expenses(g))} €<span className="text-slate-400 font-bold">/mois</span></span>
        </div>
        <div className="mt-1.5 h-2.5 rounded-full bg-slate-200/80 overflow-hidden relative">
          <div className="h-full rounded-full bar-shine" style={{ width: `${Math.min(100, f * 100)}%`, background: 'linear-gradient(90deg,#34d399,#10b981)' }} />
          {[0.25, 0.5, 0.75].map((m) => <div key={m} className="absolute top-0 bottom-0 w-px bg-white/80" style={{ left: `${m * 100}%` }} />)}
        </div>
      </button>
    </div>
  )
}

// ── Dock ─────────────────────────────────────────────────────────────────────
export function Dock() {
  const g = useArchipel((s) => s.game)
  const mode = useArchipel((s) => s.mode)
  const openSheet = useArchipel((s) => s.openSheet)
  const chooseLand = useArchipel((s) => s.chooseLand)
  const collectAll = useArchipel((s) => s.collectAll)
  if (mode !== 'idle') return <PlacementBar />
  const doneQuests = g.quests.filter((q) => q.done).length
  const ready = g.buildings.filter((b) => b.stored >= Math.max(0.5, monthlyProduction(g, b).net * 0.5)).length
  return (
    <div className="absolute bottom-0 inset-x-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pointer-events-none">
      {ready >= 3 && (
        <div className="flex justify-center mb-9">
          <button onClick={() => collectAll()} className="pointer-events-auto rounded-full px-4 py-2 font-display font-extrabold text-amber-900 flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform pop-in"
            style={{ background: 'linear-gradient(180deg,#ffe27a,#f7b733)', border: '2px solid #fff' }}>
            <Coins size={17} /> Tout récolter · {ready}
          </button>
        </div>
      )}
      <div className={`${GLASS} pointer-events-auto max-w-md mx-auto rounded-[28px] h-[68px] flex items-center justify-between px-1 relative`}>
        <DockBtn icon={<MapIcon size={22} />} label="Terrain" onClick={() => { sfxTap(); chooseLand() }} />
        <DockBtn icon={<Target size={22} />} label="Objectifs" badge={doneQuests} onClick={() => { sfxTap(); openSheet('quests') }} />
        <div className="w-[84px] shrink-0" />
        <DockBtn icon={<LineChart size={22} />} label="Marché" onClick={() => { sfxTap(); openSheet('market') }} />
        <DockBtn icon={<PieChart size={22} />} label="Patrimoine" onClick={() => { sfxTap(); openSheet('stats') }} />
        <button onClick={() => { sfxTap(); openSheet('build') }}
          className="absolute left-1/2 -translate-x-1/2 -top-6 w-[76px] h-[76px] rounded-full flex flex-col items-center justify-center text-white active:scale-95 transition-transform build-btn"
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

// ── Barre de placement ───────────────────────────────────────────────────────
function PlacementBar() {
  const g = useArchipel((s) => s.game)
  const mode = useArchipel((s) => s.mode)
  const t = useArchipel((s) => s.buildType)
  const target = useArchipel((s) => s.target)
  const confirm = useArchipel((s) => s.confirm)
  const cancel = useArchipel((s) => s.cancel)
  const [q, r] = target ? target.split(',').map(Number) : [0, 0]
  const water = target ? !isLand(g, q, r) : false

  let title = '', cost = 0, hint = '', bonus: number | null = null
  if (mode === 'land') {
    cost = nextLandCost(g)
    title = 'Gagner du terrain'
    hint = target ? 'La terre va émerger de la mer.' : 'Touche une case de mer au bord de l’île.'
  } else if (t) {
    cost = target ? placementCost(g, t, q, r) : DEFS[t].cost
    title = DEFS[t].name
    if (target) {
      bonus = synergyFor(g, t, q, r, { type: t, q, r }).total
      hint = water ? `Remblai inclus (+${fmtEur(nextLandCost(g))})` : 'Vérifie les synergies au-dessus des bâtiments.'
    } else hint = 'Touche une case libre… ou la mer, pour gagner du terrain.'
  }
  const afford = g.cash >= cost
  return (
    <div className="absolute bottom-0 inset-x-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className={`${GLASS} max-w-md mx-auto rounded-3xl p-3 sheet-up`}>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 flex items-center justify-center shrink-0">
            {t ? <MiniArt type={t} size={52} /> : <span className="text-3xl">🏝️</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-extrabold text-slate-800 text-lg leading-tight">{title}</div>
            <div className="text-[12px] text-slate-500 leading-snug">{hint}</div>
          </div>
          <button onClick={cancel} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><X size={18} /></button>
        </div>
        {target && (
          <div className="flex items-center gap-2 mt-3">
            {bonus !== null && (
              <div className={`rounded-2xl px-3 py-2.5 font-display font-extrabold text-[15px] ${bonus > 0 ? 'bg-emerald-50 text-emerald-600' : bonus < 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                {bonus > 0 ? '+' : ''}{bonus} %
              </div>
            )}
            <button onClick={confirm} disabled={!afford}
              className="flex-1 rounded-2xl py-3 font-display font-extrabold text-[17px] text-white flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-40"
              style={{ background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 8px 18px -6px rgba(5,150,105,0.6)' }}>
              <Check size={20} strokeWidth={3} /> {afford ? `Construire · ${fmtEur(cost)}` : `Il manque ${fmtEur(cost - g.cash)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Feuille générique ────────────────────────────────────────────────────────
function Sheet({ title, onClose, children, tall }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; tall?: boolean }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/30 fade-in" />
      <div className={`relative bg-[#f7f9fc] rounded-t-[32px] shadow-2xl sheet-up flex flex-col ${tall ? 'max-h-[88%]' : 'max-h-[80%]'}`} onClick={(e) => e.stopPropagation()}>
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
  const g = useArchipel((s) => s.game)
  const close = () => useArchipel.getState().openSheet(null)
  const chooseBuild = useArchipel((s) => s.chooseBuild)
  const chooseLand = useArchipel((s) => s.chooseLand)
  const built = new Set(g.buildings.map((b) => b.type))
  return (
    <Sheet title="Construire" onClose={close} tall>
      <button onClick={() => chooseLand()} className="w-full rounded-3xl bg-gradient-to-r from-sky-400 to-cyan-400 p-3.5 flex items-center gap-3 text-white mb-3 active:scale-[0.98] transition-transform shadow-md">
        <span className="text-3xl">🏝️</span>
        <div className="flex-1 text-left">
          <div className="font-display font-extrabold text-[17px] leading-tight">Gagner du terrain</div>
          <div className="text-[12px] text-white/90">Fais émerger une nouvelle case de la mer</div>
        </div>
        <div className="font-display font-extrabold text-[16px] bg-white/25 rounded-xl px-2.5 py-1">{fmtEur(nextLandCost(g))}</div>
      </button>
      <div className="grid grid-cols-2 gap-2.5">
        {BUILDABLE.map((t) => {
          const d = DEFS[t]
          const unlocked = isUnlocked(g, t)
          const net = d.grossYield * (1 - d.taxRate)
          const netMature = d.matureTaxRate != null ? d.grossYield * (1 - d.matureTaxRate) : null
          const isNew = unlocked && !built.has(t) && d.unlock > 0
          const afford = g.cash >= d.cost
          const maxed = atMaxCount(g, t)
          return (
            <button key={t} disabled={!unlocked || maxed} onClick={() => { sfxTap(); chooseBuild(t) }}
              className="relative rounded-3xl bg-white p-3 pt-2 text-left shadow-[0_4px_14px_-6px_rgba(15,40,80,0.25)] active:scale-[0.97] transition-transform disabled:active:scale-100">
              {isNew && <span className="absolute top-2 right-2 text-[9px] font-extrabold bg-amber-400 text-amber-950 rounded-full px-2 py-0.5 z-10">NOUVEAU</span>}
              <div className={`flex justify-center -mb-1 ${unlocked ? '' : 'grayscale opacity-40'}`}><MiniArt type={t} size={86} /></div>
              <div className="font-display font-extrabold text-slate-800 text-[15px] leading-tight">{d.name}</div>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: `${d.color}22`, color: d.color }}>{d.taxLabel}</span>
              </div>
              <div className="text-[12px] text-emerald-600 font-extrabold mt-1.5 flex items-center gap-1 whitespace-nowrap">
                <TrendingUp size={13} /> {fmtPct(net)} net/an
              </div>
              {netMature != null && <div className="text-[11px] text-amber-600 font-extrabold whitespace-nowrap">🔓 {fmtPct(netMature)} après {d.matureAfterYears} ans</div>}
              <div className={`mt-2 rounded-xl py-1.5 text-center font-display font-extrabold text-[15px] ${maxed ? 'bg-emerald-50 text-emerald-600 text-[12px]' : afford ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'}`}>
                {maxed ? '✓ Déjà ouvert (1 max)' : fmtEur(d.cost)}
              </div>
              {!unlocked && (
                <div className="absolute inset-0 rounded-3xl bg-white/55 flex flex-col items-center justify-center text-slate-600">
                  <Lock size={22} />
                  <div className="text-[11px] font-extrabold mt-1 text-center px-2">Patrimoine<br />{fmtShort(d.unlock)} € requis</div>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

// ── Fiche bâtiment ───────────────────────────────────────────────────────────
export function BuildingPanel() {
  const g = useArchipel((s) => s.game)
  const id = useArchipel((s) => s.selected)
  const select = useArchipel((s) => s.select)
  const upgrade = useArchipel((s) => s.upgrade)
  const sell = useArchipel((s) => s.sell)
  const [confirmSell, setConfirmSell] = useState(false)
  useEffect(() => setConfirmSell(false), [id])
  const b = g.buildings.find((x) => x.id === id)
  if (!b) return null
  const d = DEFS[b.type]
  const prod = monthlyProduction(g, b)
  const syn = synergyFor(g, b.type, b.q, b.r)
  const cap = storageCap(g, b)
  const price = upgradePrice(b)
  const can = canUpgrade(b)
  const isHome = b.type === 'maison'
  const sale = isHome ? null : salePreview(g, b)
  const rate = currentTaxRate(g, b)
  const mature = isMature(g, b)
  const yrs = yearsHeld(g, b)
  const value = buildingValue(g, b)

  return (
    <div className="absolute bottom-0 inset-x-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className={`${GLASS} max-w-md mx-auto rounded-[28px] p-4 sheet-up`}>
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center shrink-0"><MiniArt type={b.type} level={b.level} size={60} /></div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-extrabold text-[19px] text-slate-800 leading-tight">{d.name}</div>
            <div className="flex items-center gap-0.5 mt-0.5">
              {Array.from({ length: d.maxLevel }, (_, i) => <Star key={i} size={13} className={i < b.level ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />)}
              {!isHome && <span className="text-[11px] text-slate-400 font-bold ml-1.5">Valeur {fmtEur(value)}</span>}
            </div>
          </div>
          <button onClick={() => select(null)} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><X size={18} /></button>
        </div>

        {/* Revenu */}
        <div className="mt-3 rounded-2xl bg-emerald-50 px-3.5 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">{isHome ? 'Épargne mensuelle' : 'Revenu net'}</div>
            <div className="font-display font-extrabold text-[24px] text-emerald-600 leading-none mt-0.5">+{fmtEur(prod.net)}<span className="text-[13px] text-emerald-500">/mois</span></div>
          </div>
          <div className="text-right text-[11px] leading-snug text-slate-500">
            {isHome ? (<>Salaire {fmtEur(SALARY_BY_LEVEL[b.level])}<br />Dépenses −{fmtEur(expensesFor(b.level))}</>) : (<>Brut {fmtEur(prod.gross)}<br /><span className="text-rose-500 font-bold">Impôt −{fmtEur(prod.tax)}</span></>)}
          </div>
        </div>

        {/* Fiscalité */}
        {!isHome && (
          <div className="mt-2 rounded-2xl bg-white px-3.5 py-2.5 border border-slate-100">
            <div className="flex items-center gap-2">
              {d.matureAfterYears ? (mature ? <Unlock size={16} className="text-amber-500" /> : <Lock size={16} className="text-violet-500" />) : <span className="text-base">🧾</span>}
              <span className="font-extrabold text-[13px] text-slate-700">{d.taxLabel} · {fmtPct(rate, rate < 0.1 ? 1 : 0)}</span>
            </div>
            {d.matureAfterYears ? (
              mature ? <div className="text-[12px] text-amber-600 font-bold mt-1">🔓 Cadenas d’or : fiscalité allégée débloquée !</div> : (
                <>
                  <div className="mt-1.5 h-2 rounded-full bg-violet-100 overflow-hidden"><div className="h-full bg-violet-500 rounded-full" style={{ width: `${(yrs / d.matureAfterYears) * 100}%` }} /></div>
                  <div className="text-[12px] text-slate-500 mt-1">Encore <b className="text-violet-600">{fmtDuration(d.matureAfterYears - yrs)}</b> avant de passer à {fmtPct(d.matureTaxRate ?? 0)}.</div>
                </>
              )
            ) : <div className="text-[12px] text-slate-500 mt-0.5 leading-snug">{d.regime}</div>}
          </div>
        )}

        {/* Synergies */}
        {syn.lines.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {syn.lines.map((l, i) => (
              <span key={i} className={`text-[11px] font-extrabold rounded-full px-2.5 py-1 ${l.pct > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {l.from === 'diversite' ? '🌈 Quartier diversifié' : l.from === b.type ? '⚠️ Trop concentré' : `${DEFS[l.from].emoji} ${DEFS[l.from].name}`} {l.pct > 0 ? '+' : ''}{l.pct} %
              </span>
            ))}
          </div>
        )}

        {/* Stockage */}
        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-500 font-bold">
          <span>Réserve</span>
          <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (b.stored / cap) * 100)}%` }} /></div>
          <span className="tabular-nums">{fmtShort(b.stored)} / {fmtShort(cap)} €</span>
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          {can ? (
            <button onClick={() => upgrade(b.id)} disabled={g.cash < price}
              className="flex-1 rounded-2xl py-3 font-display font-extrabold text-white text-[15px] flex flex-col items-center leading-tight active:scale-[0.97] transition-transform disabled:opacity-40"
              style={{ background: 'linear-gradient(180deg,#ffb547,#f2792b)' }}>
              <span className="flex items-center gap-1.5"><ArrowUpCircle size={17} /> {isHome ? 'Carrière' : 'Améliorer'} · {fmtEur(price)}</span>
              <span className="text-[11px] text-white/85">{isHome ? `Salaire ${fmtShort(SALARY_BY_LEVEL[b.level + 1])} € · train de vie ${fmtShort(expensesFor(b.level + 1))} €` : '+12 % de revenus · plus de réserve'}</span>
            </button>
          ) : <div className="flex-1 rounded-2xl py-3 text-center font-extrabold text-amber-600 bg-amber-50">Niveau maximum ⭐</div>}
          {sale && (
            <button onClick={() => (confirmSell ? sell(b.id) : setConfirmSell(true))}
              className={`rounded-2xl px-3 py-3 font-extrabold text-[12px] leading-tight active:scale-[0.97] transition-all ${confirmSell ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {confirmSell ? <>Confirmer<br />+{fmtShort(sale.net)} €</> : <>Vendre<br /><span className="text-slate-400 font-bold">{fmtShort(sale.net)} € net</span></>}
            </button>
          )}
        </div>
        {sale && confirmSell && sale.tax > 1 && <div className="text-[11px] text-rose-500 font-bold text-center mt-1.5">Impôt sur la plus-value : −{fmtEur(sale.tax)}{d.matureAfterYears && !mature ? ' (attends le cadenas d’or pour payer moins !)' : ''}</div>}
        {isHome && <div className="text-[11px] text-slate-400 text-center mt-2">Épargne actuelle : {fmtEur(savingsPerMonth(b.level))}/mois avant synergies</div>}
      </div>
    </div>
  )
}

function fmtDuration(years: number) {
  const m = Math.ceil(years * 12)
  const y = Math.floor(m / 12), mm = m % 12
  return [y ? `${y} an${y > 1 ? 's' : ''}` : '', mm ? `${mm} mois` : ''].filter(Boolean).join(' ') || 'quelques jours'
}

// ── Objectifs ────────────────────────────────────────────────────────────────
export function QuestsSheet() {
  const g = useArchipel((s) => s.game)
  const claim = useArchipel((s) => s.claim)
  const close = () => useArchipel.getState().openSheet(null)
  return (
    <Sheet title="Objectifs" onClose={close}>
      <div className="space-y-2.5">
        {g.quests.map((q) => {
          const p = questProgress(g, q)
          const ratio = Math.min(1, p / q.target)
          return (
            <div key={q.id} className={`rounded-3xl p-3.5 ${q.done ? 'bg-gradient-to-r from-amber-100 to-yellow-50 ring-2 ring-amber-300' : 'bg-white shadow-[0_4px_14px_-6px_rgba(15,40,80,0.2)]'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl ${q.done ? 'bg-amber-400' : 'bg-sky-50'}`}>{q.done ? '🏆' : '🎯'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-[14px] text-slate-800 leading-snug">{q.title}</div>
                  <div className="text-[12px] text-amber-700 font-extrabold flex items-center gap-1 mt-0.5"><span className="coin coin-sm" /> {fmtEur(q.reward)}</div>
                </div>
                {q.done && (
                  <button onClick={(e) => claim(q.id, e.clientX, e.clientY)} className="rounded-2xl px-3.5 py-2.5 font-display font-extrabold text-white text-[14px] active:scale-95 transition-transform pop-in"
                    style={{ background: 'linear-gradient(180deg,#34d399,#059669)' }}>Réclamer</button>
                )}
              </div>
              {!q.done && (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-sky-400" style={{ width: `${ratio * 100}%` }} /></div>
                  <span className="text-[11px] font-bold text-slate-400 tabular-nums">{Math.round(ratio * 100)} %</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-[12px] text-slate-400 text-center mt-4 mb-1">De nouveaux objectifs arrivent à chaque victoire.</p>
    </Sheet>
  )
}

// ── Patrimoine & réglages ────────────────────────────────────────────────────
export function StatsSheet() {
  const g = useArchipel((s) => s.game)
  const toggleMute = useArchipel((s) => s.toggleMute)
  const reset = useArchipel((s) => s.reset)
  const close = () => useArchipel.getState().openSheet(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const nw = netWorth(g)
  const passive = passiveIncome(g)
  const ph = PHASES[g.market.phase]
  const groups = new Map<BType, { value: number; net: number; n: number }>()
  for (const b of g.buildings) {
    if (b.type === 'maison') continue
    const cur = groups.get(b.type) ?? { value: 0, net: 0, n: 0 }
    cur.value += buildingValue(g, b); cur.net += monthlyProduction(g, b).net; cur.n++
    groups.set(b.type, cur)
  }
  const invested = [...groups.values()].reduce((a, x) => a + x.value, 0)
  return (
    <Sheet title="Patrimoine" onClose={close} tall>
      <div className="rounded-3xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#0ea5e9,#10b981)' }}>
        <div className="text-[12px] font-bold text-white/80 uppercase tracking-wider">Patrimoine net</div>
        <div className="font-display font-extrabold text-[34px] leading-none mt-1">{fmtEur(nw)}</div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <Mini label="Rentes/mois" value={`+${fmtShort(passive)} €`} />
          <Mini label="Liberté" value={fmtPct(freedom(g), 0)} />
          <Mini label="Impôts payés" value={`${fmtShort(g.stats.taxes)} €`} />
        </div>
      </div>

      <div className="mt-3 rounded-3xl bg-white p-4 shadow-[0_4px_14px_-6px_rgba(15,40,80,0.2)]">
        <div className="font-extrabold text-slate-700 text-[14px] mb-2">Répartition</div>
        {groups.size === 0 && <div className="text-[13px] text-slate-400">Encore rien d’investi. Construis ton premier bâtiment !</div>}
        {[...groups.entries()].sort((a, b) => b[1].value - a[1].value).map(([t, v]) => (
          <div key={t} className="mb-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-bold text-slate-700">{DEFS[t].emoji} {DEFS[t].name}{v.n > 1 ? ` ×${v.n}` : ''}</span>
              <span className="font-extrabold text-slate-800 tabular-nums">{fmtEur(v.value)} <span className="text-emerald-600 text-[11px]">+{fmtShort(v.net)}/m</span></span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(v.value / Math.max(1, invested)) * 100}%`, background: DEFS[t].color }} /></div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-3xl bg-white p-4 shadow-[0_4px_14px_-6px_rgba(15,40,80,0.2)]">
        <div className="flex items-center justify-between">
          <div className="font-extrabold text-slate-700 text-[14px]">{ph.emoji} {ph.label}</div>
          <div className="text-[12px] font-bold text-slate-400">Actions ×{g.market.stock.toFixed(2)} · Crypto ×{g.market.crypto.toFixed(2)}</div>
        </div>
        <div className="text-[13px] text-slate-500 mt-1">{ph.desc}</div>
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={toggleMute} className="flex-1 rounded-2xl bg-white py-3 font-bold text-slate-600 flex items-center justify-center gap-2 shadow-sm">
          {g.muted ? <VolumeX size={18} /> : <Volume2 size={18} />} Son {g.muted ? 'coupé' : 'activé'}
        </button>
        <button onClick={() => (confirmReset ? (reset(), close()) : setConfirmReset(true))}
          className={`flex-1 rounded-2xl py-3 font-bold flex items-center justify-center gap-2 shadow-sm ${confirmReset ? 'bg-rose-500 text-white' : 'bg-white text-slate-600'}`}>
          <RotateCcw size={18} /> {confirmReset ? 'Confirmer ?' : 'Recommencer'}
        </button>
      </div>
      <a href="?classic" className="block text-center text-[12px] text-slate-400 mt-4 mb-2 underline">Ancienne version du jeu</a>
    </Sheet>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/20 py-2">
      <div className="font-display font-extrabold text-[17px] leading-none">{value}</div>
      <div className="text-[10px] font-bold text-white/80 mt-1">{label}</div>
    </div>
  )
}

// ── Toasts ───────────────────────────────────────────────────────────────────
export function Toasts() {
  const toasts = useArchipel((s) => s.toasts)
  const dismiss = useArchipel((s) => s.dismissToast)
  useEffect(() => {
    if (!toasts.length) return
    const t = setTimeout(() => dismiss(toasts[0].id), 3800)
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

// ── Pièces volantes ──────────────────────────────────────────────────────────
export function Flies() {
  const flies = useArchipel((s) => s.flies)
  return <>{flies.map((f) => <Fly key={f.id} id={f.id} x={f.x} y={f.y} amount={f.amount} tax={f.tax} />)}</>
}

function Fly({ id, x, y, amount, tax }: { id: number; x: number; y: number; amount: number; tax: number }) {
  const layer = useRef<HTMLDivElement>(null)
  const removeFly = useArchipel((s) => s.removeFly)
  useEffect(() => {
    const anchor = document.getElementById('cash-anchor')?.getBoundingClientRect()
    const tx = anchor ? anchor.left + 22 : 40
    const ty = anchor ? anchor.top + anchor.height / 2 : 30
    const n = Math.max(5, Math.min(14, Math.round(Math.log10(amount + 10) * 4)))
    const el = layer.current!
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div')
      c.className = 'coin fly-coin'
      el.appendChild(c)
      const sx = x + (Math.random() - 0.5) * 50, sy = y + (Math.random() - 0.5) * 30
      const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 120, my = Math.min(sy, ty) - 60 - Math.random() * 80
      const anim = c.animate([
        { transform: `translate(${sx}px,${sy}px) scale(0.4)`, opacity: 0 },
        { transform: `translate(${sx + (Math.random() - 0.5) * 40}px,${sy - 30 - Math.random() * 30}px) scale(1.1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${mx}px,${my}px) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${tx}px,${ty}px) scale(0.6)`, opacity: 0.9 },
      ], { duration: 750 + i * 45, easing: 'cubic-bezier(.5,0,.6,1)', delay: i * 25 })
      anim.onfinish = () => {
        c.remove(); sfxTick()
        const a = document.getElementById('cash-anchor')
        a?.classList.remove('cash-bump'); void a?.offsetWidth; a?.classList.add('cash-bump')
      }
    }
    const t = setTimeout(() => removeFly(id), 1600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div ref={layer} className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute float-up text-center" style={{ left: x, top: y - 20 }}>
        <div className="font-display font-extrabold text-[26px] text-amber-400 gain-text">+{fmtEur(amount)}</div>
        {tax > 1 && <div className="text-[12px] font-extrabold text-white/90 -mt-1 tax-text">impôts −{fmtEur(tax)}</div>}
      </div>
    </div>
  )
}

// ── Coach (prise en main) ────────────────────────────────────────────────────
export function Coach() {
  const g = useArchipel((s) => s.game)
  const mode = useArchipel((s) => s.mode)
  const sheet = useArchipel((s) => s.sheet)
  const selected = useArchipel((s) => s.selected)
  if (mode !== 'idle' || sheet || selected || g.questCursor > 6) return null
  const q = g.quests.find((x) => !x.done)
  if (!q) return null
  const tips: Partial<Record<string, string>> = {
    collect_home: '👆 Touche la pièce dorée au-dessus de ta maison',
    build: `🔨 Touche « Construire » puis choisis ${q.param ? DEFS[q.param as BType].name : 'un bâtiment'}`,
    collects: '💰 Récolte les pièces dès qu’elles apparaissent',
    passive: '📈 Construis des bâtiments qui rapportent des rentes',
  }
  const tip = tips[q.kind]
  if (!tip) return null
  return (
    <div className="absolute inset-x-0 bottom-[112px] z-20 flex justify-center pointer-events-none px-6">
      <div className="rounded-full bg-slate-900/80 text-white text-[13px] font-bold px-4 py-2 coach-bob text-center">{tip}</div>
    </div>
  )
}

// ── Modales ──────────────────────────────────────────────────────────────────
export function Intro() {
  const finish = useArchipel((s) => s.finishIntro)
  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-4 fade-in" style={{ background: 'linear-gradient(180deg, rgba(8,47,73,0.15) 0%, rgba(8,47,73,0.75) 60%)' }}>
      <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl sheet-up">
        <div className="text-center">
          <div className="text-[13px] font-extrabold tracking-[0.3em] text-sky-500">BIENVENUE SUR</div>
          <div className="font-display font-extrabold text-[44px] leading-none text-slate-800 mt-1">ARCHIPEL</div>
          <div className="text-slate-500 mt-2 text-[15px]">Bâtis ta fortune, île après île.</div>
        </div>
        <div className="mt-5 space-y-3">
          <IntroLine icon="🪙" title="Récolte" text="Tes bâtiments produisent des revenus. Touche les pièces pour les encaisser." />
          <IntroLine icon="🧩" title="Place malin" text="Les voisins se boostent : un studio adore un parking. Diversifie tes quartiers." />
          <IntroLine icon="🏝️" title="Agrandis l’île" text="Gagne du terrain sur la mer. Chaque parking construit ses propres accès." />
          <IntroLine icon="🕊️" title="Deviens libre" text="Quand tes rentes nettes d’impôts couvrent tes dépenses, tu as gagné ta liberté." />
        </div>
        <button onClick={() => { sfxTap(); finish() }} className="w-full mt-6 rounded-2xl py-4 font-display font-extrabold text-[19px] text-white active:scale-[0.97] transition-transform"
          style={{ background: 'linear-gradient(180deg,#ffb547,#f2792b)', boxShadow: '0 12px 24px -8px rgba(242,121,43,0.7)' }}>
          Commencer l’aventure
        </button>
      </div>
    </div>
  )
}

function IntroLine({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-11 h-11 rounded-2xl bg-sky-50 flex items-center justify-center text-2xl shrink-0">{icon}</div>
      <div>
        <div className="font-extrabold text-slate-800 text-[15px]">{title}</div>
        <div className="text-[13px] text-slate-500 leading-snug">{text}</div>
      </div>
    </div>
  )
}

export function Welcome() {
  const w = useArchipel((s) => s.welcome)
  const close = useArchipel((s) => s.closeWelcome)
  if (!w) return null
  const m = Math.round(w.months)
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 fade-in">
      <div className="w-full max-w-sm bg-white rounded-[32px] p-6 text-center shadow-2xl pop-in">
        <div className="text-5xl">🌅</div>
        <div className="font-display font-extrabold text-[28px] text-slate-800 mt-1">Bon retour !</div>
        <div className="text-slate-500 text-[14px]">{m} mois se sont écoulés sur ton île.</div>
        <div className="my-5 rounded-3xl bg-amber-50 py-4">
          <div className="text-[12px] font-bold text-amber-700 uppercase tracking-wider">Revenus accumulés</div>
          <div className="font-display font-extrabold text-[38px] text-amber-500 leading-none mt-1">+{fmtEur(w.gained)}</div>
        </div>
        <button onClick={close} className="w-full rounded-2xl py-4 font-display font-extrabold text-[18px] text-amber-900 active:scale-[0.97] transition-transform"
          style={{ background: 'linear-gradient(180deg,#ffe27a,#f7b733)' }}>Récupérer</button>
      </div>
    </div>
  )
}

export function Celebrate() {
  const c = useArchipel((s) => s.celebrate)
  const close = useArchipel((s) => s.closeCelebrate)
  const g = useArchipel((s) => s.game)
  if (c == null) return null
  const tier = FREEDOM_TIERS[c]
  const { year } = dateLabel(g.month)
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 fade-in overflow-hidden">
      {Array.from({ length: 60 }, (_, i) => (
        <span key={i} className="confetti" style={{ left: `${Math.random() * 100}%`, background: ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'][i % 5], animationDelay: `${Math.random() * 1.5}s`, animationDuration: `${2.5 + Math.random() * 2}s` }} />
      ))}
      <div className="relative w-full max-w-sm bg-white rounded-[32px] p-6 text-center shadow-2xl pop-in">
        <div className="text-6xl">{tier.emoji}</div>
        <div className="font-display font-extrabold text-[30px] leading-tight text-slate-800 mt-2">{tier.title} !</div>
        <div className="text-slate-500 text-[14px] mt-2">Tes rentes nettes couvrent {Math.round(tier.pct * 100)} % de tes dépenses. Tu pourrais vivre de ton patrimoine depuis {year}.</div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-emerald-50 py-3"><div className="font-display font-extrabold text-emerald-600 text-[20px]">+{fmtShort(passiveIncome(g))} €</div><div className="text-[11px] font-bold text-emerald-700">rentes / mois</div></div>
          <div className="rounded-2xl bg-sky-50 py-3"><div className="font-display font-extrabold text-sky-600 text-[20px]">{fmtShort(netWorth(g))} €</div><div className="text-[11px] font-bold text-sky-700">patrimoine</div></div>
        </div>
        <button onClick={close} className="w-full mt-5 rounded-2xl py-4 font-display font-extrabold text-[18px] text-white active:scale-[0.97] transition-transform"
          style={{ background: 'linear-gradient(180deg,#34d399,#059669)' }}>Continuer à bâtir</button>
      </div>
    </div>
  )
}

// ── Marché ───────────────────────────────────────────────────────────────────
export function MarketSheet() {
  const g = useArchipel((s) => s.game)
  const close = () => useArchipel.getState().openSheet(null)
  const ph = PHASES[g.market.phase]
  const hist = g.market.hist && g.market.hist.length > 1 ? g.market.hist : [[1, 1], [g.market.stock, g.market.crypto]] as [number, number][]
  const W = 320, H = 130
  const path = (idx: 0 | 1) => {
    const vals = hist.map((h) => h[idx])
    const mn = Math.min(...hist.flat()), mx = Math.max(...hist.flat())
    return vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - mn) / Math.max(0.0001, mx - mn)) * (H - 16) - 8}`).join(' ')
  }
  const tips: Record<string, string> = {
    calme: 'Les marchés avancent doucement. Idéal pour construire sereinement.',
    euphorie: 'Tes tours ETF et fermes crypto produisent beaucoup plus. Attention : l’euphorie précède souvent le krach.',
    krach: 'Les cours s’effondrent. Mais c’est les soldes : chaque € investi en ETF ou crypto achète plus de parts. Ne vends pas en panique !',
    reprise: 'Ceux qui ont tenu pendant le krach récupèrent leurs gains. La patience paie.',
  }
  return (
    <Sheet title="Marché" onClose={close}>
      <div className="rounded-3xl p-4 text-white" style={{ background: g.market.phase === 'krach' ? 'linear-gradient(135deg,#475569,#1e293b)' : g.market.phase === 'euphorie' ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>
        <div className="flex items-center gap-3">
          <span className="text-5xl">{ph.emoji}</span>
          <div>
            <div className="font-display font-extrabold text-[26px] leading-none">{ph.label}</div>
            <div className="text-[13px] text-white/85 mt-1">Production : ETF ×{ph.stockProd.toFixed(2).replace('.', ',')} · Crypto ×{ph.cryptoProd.toFixed(2).replace('.', ',')}</div>
          </div>
        </div>
        <div className="text-[14px] mt-3 leading-snug text-white/95">{tips[g.market.phase]}</div>
      </div>
      <div className="mt-3 rounded-3xl bg-white p-4 shadow-[0_4px_14px_-6px_rgba(15,40,80,0.2)]">
        <div className="flex items-center justify-between mb-2">
          <span className="font-extrabold text-slate-700 text-[14px]">Indices (5 dernières années)</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }} preserveAspectRatio="none">
          <polyline points={path(1)} fill="none" stroke="#9b5de5" strokeWidth={2.5} strokeLinejoin="round" />
          <polyline points={path(0)} fill="none" stroke="#2bb3c0" strokeWidth={3} strokeLinejoin="round" />
        </svg>
        <div className="flex gap-4 mt-2 text-[13px] font-bold">
          <span className="text-[#2bb3c0]">● Actions ×{g.market.stock.toFixed(2).replace('.', ',')}</span>
          <span className="text-[#9b5de5]">● Crypto ×{g.market.crypto.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>
      <p className="text-[12px] text-slate-400 text-center mt-3 mb-1">Les cycles alternent : calme, euphorie, krach, reprise. Personne ne sait quand.</p>
    </Sheet>
  )
}
