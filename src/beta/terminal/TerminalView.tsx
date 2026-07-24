/**
 * TerminalView — beta « LE TERMINAL · Salle des marchés ».
 *
 * Ancrée sur Capitalism Lab + les simulateurs boursiers : une COURBE de prix
 * pilotée par le vrai moteur économique (phases bull/bear/krach, stockIndex),
 * du trading ACTIF sur les actifs sensibles au marché, et la macro qui te
 * touche. Court terme taxé, long terme optimisé (la fiscalité enseigne la
 * patience).
 *
 * Connectée au vrai jeu et au cœur unifié (AssetSheet / previewWithdraw).
 */

import { useState } from 'react'
import { Activity, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { getCatalogItem, INVESTMENT_CATALOG } from '../../data/investments'
import { getBuildingSprite } from '../buildingSprites'
import { Icon } from '../../components/ui/Icon'
import { BetaShell, useDrawer } from '../BetaShell'
import { euro, previewWithdraw } from '../shared/fiscalHelpers'
import { AssetSheet } from '../shared/ManageSheets'
import type { MarketPhase, EventSeverity } from '../../types'

const PHASE: Record<MarketPhase, { label: string; color: string; emoji: string }> = {
  bull:    { label: 'Marché haussier', color: '#34d399', emoji: '🐂' },
  neutral: { label: 'Marché stable',   color: '#38bdf8', emoji: '➖' },
  bear:    { label: 'Marché baissier', color: '#fbbf24', emoji: '🐻' },
  crash:   { label: 'Krach',           color: '#f87171', emoji: '⛈️' },
}
const SEV: Record<EventSeverity, string> = { good: '#34d399', info: '#38bdf8', warning: '#fbbf24', bad: '#f87171' }

export function TerminalView() {
  const { drawerScreen, open, close } = useDrawer()
  const game = useGameStore((s) => s.game)!
  const buyInvestment = useGameStore((s) => s.buyInvestment)
  const deposit = useGameStore((s) => s.depositToInvestment)
  const partialSell = useGameStore((s) => s.partialSellInvestment)
  const [selected, setSelected] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const netWorth = calcNetWorth(game)
  const eco = game.economy
  const ph = PHASE[eco.marketPhase] ?? PHASE.neutral

  // Courbe : historique de l'indice
  const hist = eco.stockIndexHistory ?? []
  const pts = hist.slice(-40).map((p) => p.value)
  if (pts.length < 2) pts.unshift(...Array(2 - pts.length).fill(eco.stockIndex))
  const min = Math.min(...pts), max = Math.max(...pts)
  const span = Math.max(1, max - min)
  const W = 320, H = 120
  const path = pts.map((v, i) => `${(i / (pts.length - 1)) * W},${H - ((v - min) / span) * (H - 10) - 5}`).join(' ')
  const first = pts[0], last = pts[pts.length - 1]
  const chg = first > 0 ? ((last - first) / first) * 100 : 0

  // Actifs sensibles au marché
  const marketCats = INVESTMENT_CATALOG.filter((it) => it.reactsToMarket)

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 1600) }
  function buy(catId: string) {
    const item = getCatalogItem(catId as never)
    const owned = game.investments.find((i) => i.catalogId === catId)
    if (owned) { const r = deposit(owned.instanceId, Math.min(1000, item.minAmount * 2)); flash(r.message) }
    else { const r = buyInvestment(catId as never, item.minAmount, false); flash(r.message) }
  }
  function sell(instanceId: string) {
    const inv = game.investments.find((i) => i.instanceId === instanceId)!
    const amt = Math.round(inv.currentValue * 0.25)
    const pv = previewWithdraw(inv, game, amt)
    const r = partialSell(instanceId, amt)
    flash(r.success ? `Vendu ${euro(amt)} · net ${euro(pv.net)}${pv.tax > 0 ? ` (−${euro(pv.tax)} impôt)` : ''}` : r.message)
  }

  const selectedInv = game.investments.find((i) => i.instanceId === selected) ?? null
  const events = [...game.events].slice(-5).reverse()

  return (
    <BetaShell accent="#04121a" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div className="absolute inset-0 overflow-y-auto hide-scrollbar" style={{ background: 'radial-gradient(120% 70% at 50% 0%, #06202b 0%, #04121a 55%, #020a10 100%)' }}>
        <div className="max-w-md mx-auto px-4 pt-3 pb-4">

          {/* Indice + phase */}
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${ph.color}44` }}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Activity size={12} /> Indice marché</div>
              <div className="text-[11px] font-black flex items-center gap-1" style={{ color: ph.color }}>{ph.emoji} {ph.label}</div>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-white font-black leading-none" style={{ fontSize: 30 }}>{eco.stockIndex.toFixed(0)}</div>
              <div className="font-black text-sm flex items-center gap-0.5" style={{ color: chg >= 0 ? '#34d399' : '#f87171' }}>
                {chg >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{chg >= 0 ? '+' : ''}{chg.toFixed(1)}%
              </div>
            </div>
            {/* Courbe */}
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-2" style={{ height: 120 }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ph.color} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={ph.color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={`0,${H} ${path} ${W},${H}`} fill="url(#tg)" />
              <polyline points={path} fill="none" stroke={ph.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <div className="text-[10px] text-slate-500 flex justify-between mt-1">
              <span>Inflation {(eco.inflationRate * 100).toFixed(1)}%</span>
              <span>Taux crédit {(eco.interestRateBase * 100).toFixed(1)}%</span>
              <span>Immo ×{eco.realEstateIndex.toFixed(2)}</span>
            </div>
          </div>

          {toast && <div className="mb-3 text-center text-xs font-bold text-sky-300 animate-fade-in-up">{toast}</div>}

          {/* Positions / trading */}
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1"><Zap size={12} /> Trading</div>
          <div className="space-y-2">
            {marketCats.map((it) => {
              const owned = game.investments.find((i) => i.catalogId === it.id)
              const unlocked = netWorth >= it.unlockThreshold
              const gain = owned ? owned.currentValue - owned.totalInvested : 0
              const sprite = getBuildingSprite(it.id)
              return (
                <div key={it.id} className="rounded-2xl p-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${it.color}33` }}>
                  <button onClick={() => owned && setSelected(owned.instanceId)} className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${it.color}1e`, border: `1px solid ${it.color}55` }}>
                    {sprite ? <img src={sprite} alt="" className="w-full h-full object-contain p-0.5" /> : <Icon name={it.icon} size={19} style={{ color: it.color } as React.CSSProperties} />}
                  </button>
                  <button onClick={() => owned && setSelected(owned.instanceId)} className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-black text-white leading-tight truncate">{it.shortName}</div>
                    {owned ? (
                      <div className="text-[11px] font-bold text-slate-300">{euro(owned.currentValue)} <span style={{ color: gain >= 0 ? '#34d399' : '#fb7185' }}>{gain >= 0 ? '+' : ''}{euro(gain)}</span></div>
                    ) : (
                      <div className="text-[10px] text-slate-500">{unlocked ? `dès ${euro(it.minAmount)}` : `débloqué à ${(it.unlockThreshold / 1000).toFixed(0)}k`}</div>
                    )}
                  </button>
                  <div className="flex gap-1.5 shrink-0">
                    {owned && (
                      <button onClick={() => sell(owned.instanceId)} disabled={owned.isLocked}
                        className="w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30"
                        style={{ background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.4)' }} title="Vendre 25%">
                        <ArrowDownRight size={16} className="text-rose-400" />
                      </button>
                    )}
                    <button onClick={() => buy(it.id)} disabled={!unlocked}
                      className="w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30"
                      style={{ background: 'rgba(52,211,153,0.14)', border: '1px solid rgba(52,211,153,0.4)' }} title="Acheter">
                      <ArrowUpRight size={16} className="text-emerald-400" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Fil marché */}
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mt-5 mb-2">Fil marché</div>
          <div className="space-y-1.5">
            {events.length === 0 && <div className="text-xs text-slate-600 text-center py-3">Pas d'actualité pour l'instant.</div>}
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-2.5 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `2.5px solid ${SEV[e.severity]}` }}>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-white leading-tight">{e.title}</div>
                  <div className="text-[10px] text-slate-500 leading-snug line-clamp-1">{e.description}</div>
                </div>
                {e.financialImpact !== 0 && <span className="text-[11px] font-black shrink-0" style={{ color: e.financialImpact > 0 ? '#34d399' : '#fb7185' }}>{e.financialImpact > 0 ? '+' : ''}{euro(e.financialImpact)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedInv && <AssetSheet inv={selectedInv} game={game} onClose={() => setSelected(null)} />}
    </BetaShell>
  )
}
