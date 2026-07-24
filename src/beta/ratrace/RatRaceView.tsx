/**
 * RatRaceView — beta « RAT RACE · Sortir de la course ».
 *
 * Ancrée sur Cashflow 101 (Kiyosaki) + BitLife : le jeu tout entier a UN but
 * limpide — atteindre LA BASCULE, quand tes revenus passifs NETS d'impôt
 * dépassent tes dépenses. Alors ton pion quitte la piste intérieure (rat race)
 * pour la « Fast Track » dorée. Une vie qui avance, ponctuée d'imprévus.
 *
 * Connectée au vrai jeu et au cœur économique unifié (fiscalHelpers +
 * AssetSheet / BuildSheet partagés) → chiffres cohérents avec toutes les betas.
 */

import { useState } from 'react'
import {
  Coins, Sparkles, Zap, Wallet, TrendingUp, TrendingDown, Lightbulb, ChevronRight,
} from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth, calcMonthlyPassiveIncome } from '../../utils/calculations'
import { getCatalogItem, INVESTMENT_CATALOG } from '../../data/investments'
import { getBuildingSprite } from '../buildingSprites'
import { Icon } from '../../components/ui/Icon'
import { BetaShell, useDrawer } from '../BetaShell'
import { euro } from '../shared/fiscalHelpers'
import { AssetSheet, BuildSheet } from '../shared/ManageSheets'
import type { EventSeverity } from '../../types'

const CX = 150, CY = 150, R_IN = 98, R_OUT = 130
function pt(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}

const RING_MARKERS = [
  { deg: 40, emoji: '💵', label: 'Paie' },
  { deg: 130, emoji: '💡', label: 'Opportunité' },
  { deg: 220, emoji: '⚡', label: 'Imprévu' },
  { deg: 310, emoji: '🛍️', label: 'Tentation' },
]

const SEV_COLOR: Record<EventSeverity, string> = { good: '#34d399', info: '#38bdf8', warning: '#fbbf24', bad: '#f87171' }

export function RatRaceView() {
  const { drawerScreen, open, close } = useDrawer()
  const game = useGameStore((s) => s.game)!
  const collectAll = useGameStore((s) => s.collectAllRevenue)
  const [selected, setSelected] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [flash, setFlash] = useState(false)

  const netWorth = calcNetWorth(game)
  const passive = calcMonthlyPassiveIncome(game)
  const expenses = game.monthlyExpenses.total
  const salary = game.player.salary
  const coverage = expenses > 0 ? passive / expenses : 0
  const free = coverage >= 1 && passive > 0
  const cashflow = salary + passive - expenses
  const prog = Math.min(1, coverage)
  const [tx, ty] = free ? pt(R_OUT, 0) : pt(R_IN, prog * 270)

  const totalPending = game.investments.reduce((s, i) => s + (i.pendingRevenue ?? 0), 0)
  const readyCount = game.investments.filter((i) => (i.pendingRevenue ?? 0) > 0).length
  const events = [...game.events].slice(-6).reverse()

  // Opportunités : actifs débloqués et constructibles, non encore possédés en priorité
  const deals = INVESTMENT_CATALOG
    .filter((it) => netWorth >= it.unlockThreshold && !it.isRealEstate)
    .map((it) => ({ it, owned: game.investments.some((i) => i.catalogId === it.id) }))
    .sort((a, b) => Number(a.owned) - Number(b.owned) || b.it.baseAnnualReturn - a.it.baseAnnualReturn)
    .slice(0, 3)

  const owned = game.investments

  function harvestAll() {
    const { total } = collectAll()
    if (total > 0) { setFlash(true); setTimeout(() => setFlash(false), 800) }
  }

  const selectedInv = game.investments.find((i) => i.instanceId === selected) ?? null
  const C = 2 * Math.PI * R_IN
  const dash = `${(prog * 0.75 * C).toFixed(1)} ${C.toFixed(1)}`

  return (
    <BetaShell accent="#0b1020" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div className="absolute inset-0 overflow-y-auto hide-scrollbar"
        style={{ background: free ? 'radial-gradient(120% 80% at 50% 0%, #2a2410 0%, #0b1020 55%)' : 'radial-gradient(120% 80% at 50% 0%, #141c33 0%, #090d1a 60%)' }}>
        <div className="max-w-md mx-auto px-4 pt-3 pb-4">

          {/* ── Piste : la rat race ── */}
          <div className="relative mx-auto" style={{ width: 300, height: 300 }}>
            <svg viewBox="0 0 300 300" className="w-full h-full">
              {/* Fast track (extérieur) */}
              <circle cx={CX} cy={CY} r={R_OUT} fill="none" stroke={free ? '#fbbf24' : '#3f3a25'} strokeWidth={free ? 8 : 5}
                strokeDasharray={free ? undefined : '2 8'} opacity={free ? 1 : 0.5}
                style={free ? { filter: 'drop-shadow(0 0 8px #fbbf24aa)' } : undefined} />
              {/* Rat race (intérieur) — fond */}
              <circle cx={CX} cy={CY} r={R_IN} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={9} />
              {/* Progression vers la bascule */}
              <circle cx={CX} cy={CY} r={R_IN} fill="none" strokeWidth={9} strokeLinecap="round"
                stroke={free ? '#34d399' : '#38bdf8'} strokeDasharray={dash}
                transform={`rotate(-90 ${CX} ${CY})`}
                style={{ transition: 'stroke-dasharray 0.6s ease', filter: `drop-shadow(0 0 6px ${free ? '#34d399' : '#38bdf8'}88)` }} />
              {/* Marqueurs de cases */}
              {RING_MARKERS.map((m) => {
                const [mx, my] = pt(R_IN, m.deg)
                return <text key={m.deg} x={mx} y={my + 5} textAnchor="middle" fontSize="15" opacity={0.85}>{m.emoji}</text>
              })}
              {/* Pion joueur */}
              <circle cx={tx} cy={ty} r={11} fill={free ? '#fbbf24' : '#38bdf8'} stroke="#fff" strokeWidth={2}
                style={{ transition: 'cx 0.6s ease, cy 0.6s ease', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
              <text x={tx} y={ty + 5} textAnchor="middle" fontSize="12">{free ? '🕊️' : '🧑'}</text>
            </svg>
            {/* Centre : les chiffres */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: free ? '#fbbf24' : '#7dd3fc' }}>
                {free ? '🕊️ Fast Track' : 'Rat Race'}
              </div>
              <div className="text-white font-black leading-none my-1" style={{ fontSize: 34 }}>{Math.round(coverage * 100)}%</div>
              <div className="text-[11px] text-emerald-300 font-black leading-tight">{euro(passive)}<span className="text-slate-500 font-bold">/m passif</span></div>
              <div className="text-[10px] text-slate-400 leading-tight">dépenses {euro(expenses)}/m</div>
            </div>
          </div>

          {/* Message d'objectif */}
          <div className="text-center -mt-1 mb-3">
            {free ? (
              <p className="text-sm font-bold text-amber-300">Tu es sorti de la course. Tes rentes te font vivre. 🎉</p>
            ) : (
              <p className="text-xs text-slate-400">Il te manque <b className="text-sky-300">{euro(Math.max(0, expenses - passive))}/mois</b> de revenus passifs nets pour sortir de la rat race.</p>
            )}
          </div>

          {/* Flux du mois */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat icon={<Wallet size={13} />} label="Salaire" value={`+${euro(salary)}`} color="#e2e8f0" />
            <Stat icon={<TrendingUp size={13} />} label="Passifs nets" value={`+${euro(passive)}`} color="#34d399" />
            <Stat icon={<TrendingDown size={13} />} label="Dépenses" value={`−${euro(expenses)}`} color="#fb7185" />
          </div>
          <div className="rounded-xl px-4 py-2 mb-4 flex items-center justify-between"
            style={{ background: cashflow >= 0 ? 'rgba(52,211,153,0.1)' : 'rgba(251,113,133,0.1)', border: `1px solid ${cashflow >= 0 ? 'rgba(52,211,153,0.25)' : 'rgba(251,113,133,0.25)'}` }}>
            <span className="text-xs font-bold text-slate-300">Épargne mensuelle</span>
            <span className="text-sm font-black" style={{ color: cashflow >= 0 ? '#34d399' : '#fb7185' }}>{cashflow >= 0 ? '+' : ''}{euro(cashflow)}/mois</span>
          </div>

          {/* Récolte */}
          {readyCount > 0 && (
            <button onClick={harvestAll}
              className="w-full mb-4 rounded-2xl flex items-center justify-between px-4 py-2.5 active:scale-98 transition-transform"
              style={{ background: flash ? 'linear-gradient(135deg,#22c55e,#15803d)' : 'linear-gradient(135deg,#fbbf24,#d97706)', boxShadow: '0 4px 18px rgba(251,191,36,0.35)', transition: 'background .3s' }}>
              <span className="flex items-center gap-2 font-extrabold text-sm" style={{ color: flash ? '#fff' : '#431407' }}>
                <Coins size={16} /> {flash ? '✓ Récolté !' : `${readyCount} revenu${readyCount > 1 ? 's' : ''} à encaisser`}
              </span>
              {!flash && <span className="font-black text-sm" style={{ color: '#431407' }}>+{euro(totalPending)} →</span>}
            </button>
          )}

          {/* Opportunités (deals) */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Lightbulb size={12} /> Opportunités</div>
            <button onClick={() => setBuilding(true)} className="text-[11px] font-bold text-sky-400 flex items-center gap-0.5">Toutes <ChevronRight size={12} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {deals.map(({ it, owned: isOwned }) => (
              <button key={it.id} onClick={() => setBuilding(true)}
                className="rounded-xl p-2.5 text-center active:scale-95 transition-transform"
                style={{ background: `${it.color}14`, border: `1px solid ${it.color}44` }}>
                <div className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center mb-1" style={{ background: `${it.color}22` }}>
                  {getBuildingSprite(it.id) ? <img src={getBuildingSprite(it.id)} alt="" className="w-full h-full object-contain p-0.5" /> : <Icon name={it.icon} size={17} style={{ color: it.color } as React.CSSProperties} />}
                </div>
                <div className="text-[10px] font-black text-white truncate">{it.shortName}</div>
                <div className="text-[9px] font-bold" style={{ color: it.color }}>{(it.baseAnnualReturn * 100).toFixed(1)}%/an</div>
                <div className="text-[8px] text-slate-500">{isOwned ? 'renforcer' : euro(it.minAmount)}</div>
              </button>
            ))}
          </div>

          {/* Tes actifs */}
          {owned.length > 0 && (
            <>
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Tes actifs</div>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-4 pb-1">
                {owned.map((inv) => {
                  const it = getCatalogItem(inv.catalogId)
                  const pending = inv.pendingRevenue ?? 0
                  return (
                    <button key={inv.instanceId} onClick={() => setSelected(inv.instanceId)}
                      className="relative shrink-0 rounded-xl p-2 flex flex-col items-center gap-1 active:scale-95 transition-transform"
                      style={{ width: 76, background: `${it.color}12`, border: `1px solid ${it.color}44` }}>
                      {pending > 0 && <span className="absolute -top-1.5 -right-1 px-1 py-0.5 rounded-full text-[8px] font-black" style={{ background: '#fbbf24', color: '#431407' }}>+{euro(pending)}</span>}
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${it.color}22` }}>
                        {getBuildingSprite(inv.catalogId) ? <img src={getBuildingSprite(inv.catalogId)} alt="" className="w-full h-full object-contain p-0.5" /> : <Icon name={it.icon} size={15} style={{ color: it.color } as React.CSSProperties} />}
                      </div>
                      <div className="text-[9px] font-black text-white truncate w-full text-center">{it.shortName}</div>
                      <div className="text-[9px] font-bold text-slate-300">{euro(inv.currentValue)}</div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Ta vie (événements) */}
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1"><Zap size={12} /> Ta vie</div>
          <div className="space-y-1.5">
            {events.length === 0 && <div className="text-xs text-slate-600 text-center py-3">Rien à signaler pour l'instant.</div>}
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-2.5 rounded-xl px-3 py-2"
                style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `2.5px solid ${SEV_COLOR[e.severity]}` }}>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-white leading-tight">{e.title}</div>
                  <div className="text-[10px] text-slate-500 leading-snug line-clamp-2">{e.description}</div>
                </div>
                {e.financialImpact !== 0 && (
                  <span className="text-[11px] font-black shrink-0" style={{ color: e.financialImpact > 0 ? '#34d399' : '#fb7185' }}>
                    {e.financialImpact > 0 ? '+' : ''}{euro(e.financialImpact)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {free && (
            <div className="mt-4 rounded-2xl p-4 text-center" style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(11,16,32,0.9))', border: '1px solid rgba(251,191,36,0.4)' }}>
              <Sparkles size={22} className="text-amber-300 mx-auto" />
              <div className="text-amber-200 font-black text-sm mt-1">Bienvenue sur la Fast Track</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Les gros deals t'attendent. Vise maintenant l'abondance : 3× tes dépenses en rentes.</div>
            </div>
          )}
        </div>
      </div>

      {selectedInv && <AssetSheet inv={selectedInv} game={game} onClose={() => setSelected(null)} />}
      {building && <BuildSheet game={game} netWorth={netWorth} title="Saisir une opportunité" onClose={() => setBuilding(false)} onGotoInvest={() => { setBuilding(false); open('marketplace') }} />}
    </BetaShell>
  )
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl px-2 py-2 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-center gap-1 text-slate-500 mb-0.5">{icon}<span className="text-[8px] font-bold uppercase tracking-wider">{label}</span></div>
      <div className="text-[13px] font-black leading-none" style={{ color }}>{value}</div>
    </div>
  )
}
