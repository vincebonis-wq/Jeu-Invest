/**
 * Modales de gestion partagées par les betas « patrimoine tangible ».
 *  - AssetSheet : récolter les revenus + retirer du capital avec cadenas fiscal
 *    et aperçu d'impôt en direct.
 *  - BuildSheet : construire un nouvel actif depuis le catalogue.
 * Utilisées par La Tour et Le Flux.
 */

import { useMemo, useState } from 'react'
import {
  Coins, X, Lock, ShieldCheck, ArrowDownToLine, Hammer, TrendingUp, Hourglass, ChevronRight,
} from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { getCatalogItem, INVESTMENT_CATALOG } from '../../data/investments'
import { getBuildingSprite } from '../buildingSprites'
import { Icon } from '../../components/ui/Icon'
import { euro, fiscalStatus, previewWithdraw } from './fiscalHelpers'
import type { GameState, Investment, InvestmentCategory } from '../../types'

export function AssetSheet({ inv, game, onClose }: { inv: Investment; game: GameState; onClose: () => void }) {
  const collectRevenue = useGameStore((s) => s.collectRevenue)
  const sellInvestment = useGameStore((s) => s.sellInvestment)
  const partialSell = useGameStore((s) => s.partialSellInvestment)
  const item = getCatalogItem(inv.catalogId)
  const sprite = getBuildingSprite(inv.catalogId)
  const isRealEstate = item.isRealEstate
  const fs = fiscalStatus(inv, game)
  const pending = inv.pendingRevenue ?? 0
  const gain = inv.currentValue - inv.totalInvested
  const [pct, setPct] = useState(isRealEstate ? 100 : 50)
  const [msg, setMsg] = useState<string | null>(null)
  const [collected, setCollected] = useState(false)

  const amount = Math.round((inv.currentValue * pct) / 100)
  const pv = previewWithdraw(inv, game, amount)

  function harvest() {
    const { collected: c } = collectRevenue(inv.instanceId)
    if (c > 0) { setCollected(true); setTimeout(() => setCollected(false), 900) }
  }
  function withdraw() {
    const r = pv.isFull ? sellInvestment(inv.instanceId) : partialSell(inv.instanceId, amount)
    setMsg(r.message)
    if (r.success) setTimeout(onClose, 1100)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative rounded-t-3xl pb-10"
        style={{ background: `linear-gradient(165deg, ${item.color}1c 0%, #070c18 55%)`, border: `1px solid ${item.color}30`, borderBottom: 'none', animation: 'slideUpPanel 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3" />

        <div className="flex items-start gap-3 px-5 pt-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${item.color}1a`, border: `1.5px solid ${item.color}45` }}>
            {sprite ? <img src={sprite} alt={item.name} className="w-full h-full object-contain p-1" draggable={false} /> : <Icon name={item.icon} size={28} style={{ color: item.color } as React.CSSProperties} />}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="font-black text-white text-base leading-tight">{item.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">Valeur : {euro(inv.currentValue)}{(inv.level ?? 1) > 1 ? ` · Niv.${inv.level}` : ''}</div>
          </div>
          <button onClick={onClose} className="text-slate-600 p-1 shrink-0"><X size={18} /></button>
        </div>

        {pending > 0 && (
          <div className="mx-5 mt-4">
            <button onClick={harvest} className="w-full py-4 rounded-2xl flex items-center justify-between px-5 active:scale-98 transition-transform"
              style={{ background: collected ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#fbbf24,#d97706)', boxShadow: '0 6px 20px rgba(251,191,36,0.4)' }}>
              <span className="flex items-center gap-2">
                <Coins size={20} style={{ color: '#431407' }} />
                <span className="font-black text-sm" style={{ color: '#431407' }}>{collected ? '✓ Encaissé !' : 'Récolter les revenus'}</span>
              </span>
              {!collected && <span className="font-black text-2xl" style={{ color: '#431407' }}>+{euro(pending)}</span>}
            </button>
          </div>
        )}

        <div className="mx-5 mt-4 rounded-2xl p-3.5"
          style={{ background: fs.kind === 'open' ? 'rgba(52,211,153,0.08)' : 'rgba(251,191,36,0.07)', border: `1px solid ${fs.kind === 'open' ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.3)'}` }}>
          <div className="flex items-center gap-2">
            {fs.kind === 'open' ? <ShieldCheck size={16} className="text-emerald-400" /> : <Lock size={15} className="text-amber-400" />}
            <span className="font-black text-sm" style={{ color: fs.kind === 'open' ? '#34d399' : '#fbbf24' }}>{fs.label}</span>
          </div>
          <p className="text-[12px] text-slate-300 mt-1.5 leading-snug">
            {fs.kind === 'fiscal' && inv.catalogId === 'assurance_vie' && (
              <>Sors maintenant → taxé à <b className="text-amber-300">{Math.round(fs.rate * 100)} %</b>. Attends <b className="text-emerald-300">{fs.yearsToFav} an{(fs.yearsToFav ?? 0) > 1 ? 's' : ''}</b> (8 ans) : l'abattement ramène l'impôt à <b className="text-emerald-300">presque 0</b>.</>
            )}
            {fs.kind === 'open' && <>Retrait dans les meilleures conditions. {fs.sub}.</>}
            {fs.kind === 'taxed' && <>Plus-value taxée à <b className="text-amber-300">{Math.round(fs.rate * 100)} %</b>. Le capital investi sort sans impôt.</>}
            {fs.kind === 'hard' && <>Capital bloqué — {fs.sub.toLowerCase()}.</>}
          </p>
        </div>

        <div className="mx-5 mt-3 flex items-center gap-1.5">
          <TrendingUp size={13} className={gain >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
          <span className="text-sm font-black" style={{ color: gain >= 0 ? '#34d399' : '#fb7185' }}>{gain >= 0 ? '+' : ''}{euro(gain)}</span>
          <span className="text-xs text-slate-500">de plus-value</span>
        </div>

        {fs.kind === 'hard' ? (
          <div className="mx-5 mt-3 py-3.5 rounded-2xl text-center text-sm font-bold text-slate-400 flex items-center justify-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Hourglass size={14} /> Retrait indisponible — {fs.sub.toLowerCase()}
          </div>
        ) : (
          <>
            {!isRealEstate && (
              <div className="mx-5 mt-3 flex gap-2">
                {[25, 50, 100].map((c) => (
                  <button key={c} onClick={() => setPct(c)} className="flex-1 py-2 rounded-xl font-black text-xs transition-all active:scale-95"
                    style={{ background: pct === c ? `${item.color}22` : 'rgba(255,255,255,0.05)', color: pct === c ? item.color : '#94a3b8', border: `1px solid ${pct === c ? `${item.color}66` : 'rgba(255,255,255,0.08)'}` }}>
                    {c === 100 ? 'Tout' : `${c}%`}
                  </button>
                ))}
              </div>
            )}
            <div className="mx-5 mt-3 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <Row label="Montant retiré" value={euro(pv.gross)} />
              {pv.debt > 0 && <Row label="Crédit remboursé" value={`− ${euro(pv.debt)}`} muted />}
              <Row label="Impôt prélevé" value={pv.tax > 0 ? `− ${euro(pv.tax)}` : '0 € 🎉'} danger={pv.tax > 0} />
              <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(52,211,153,0.1)' }}>
                <span className="text-sm font-black text-emerald-300">Net perçu</span>
                <span className="text-lg font-black text-emerald-300">{euro(pv.net)}</span>
              </div>
            </div>
            <div className="mx-5 mt-3">
              <button onClick={withdraw} className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform"
                style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}99)`, boxShadow: `0 6px 20px ${item.color}35` }}>
                <ArrowDownToLine size={16} /> {pv.isFull ? 'Tout retirer' : `Retirer ${euro(pv.gross)}`} · net {euro(pv.net)}
              </button>
            </div>
          </>
        )}
        {msg && <p className="text-center text-xs mt-2.5 font-semibold px-5" style={{ color: msg.includes('€') || msg.startsWith('Vendu') ? '#4ade80' : '#94a3b8' }}>{msg}</p>}
      </div>
    </div>
  )
}

export function BuildSheet({ game, netWorth, onClose, onGotoInvest, title = 'Construire un actif' }: {
  game: GameState; netWorth: number; onClose: () => void; onGotoInvest: () => void; title?: string
}) {
  const buyInvestment = useGameStore((s) => s.buyInvestment)
  const [msg, setMsg] = useState<string | null>(null)

  const options = useMemo(() => {
    return INVESTMENT_CATALOG.map((item) => {
      const isRE = item.isRealEstate
      const owned = game.investments.filter((i) => i.catalogId === item.id).length
      const max = isRE ? 3 : 1
      const unlocked = netWorth >= item.unlockThreshold
      return { item, isRE, canBuild: owned < max, unlocked, owned, max }
    }).sort((a, b) => a.item.unlockThreshold - b.item.unlockThreshold)
  }, [game.investments, netWorth])

  function build(id: InvestmentCategory) {
    const item = getCatalogItem(id)
    if (item.isRealEstate) { onGotoInvest(); return }
    const r = buyInvestment(id, item.minAmount, false)
    if (r.success) onClose(); else setMsg(r.message)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative rounded-t-3xl pb-10" style={{ background: 'linear-gradient(165deg,#131a2e,#070c18 60%)', border: '1px solid rgba(250,204,21,0.2)', borderBottom: 'none', animation: 'slideUpPanel 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3" />
        <div className="flex items-center justify-between px-5 pt-3">
          <div className="font-black text-white text-base flex items-center gap-2"><Hammer size={17} className="text-amber-300" /> {title}</div>
          <button onClick={onClose} className="text-slate-600 p-1"><X size={18} /></button>
        </div>
        <div className="text-xs text-slate-500 px-5 mt-0.5">Cash : {euro(game.cashBalance)}</div>

        <div className="px-4 mt-3 space-y-1.5 max-h-[62vh] overflow-y-auto hide-scrollbar">
          {options.map(({ item, isRE, canBuild, unlocked, owned, max }) => {
            const disabled = !unlocked || !canBuild || (!isRE && game.cashBalance < item.minAmount)
            const sprite = getBuildingSprite(item.id)
            return (
              <button key={item.id} onClick={() => !disabled && build(item.id)} disabled={disabled}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${item.color}33` }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}1a`, border: `1px solid ${item.color}44` }}>
                  {sprite ? <img src={sprite} alt="" className="w-full h-full object-contain p-0.5" draggable={false} /> : <Icon name={item.icon} size={19} style={{ color: item.color } as React.CSSProperties} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-white leading-tight truncate">{item.shortName}{max > 1 && owned > 0 ? ` (${owned}/${max})` : ''}</div>
                  <div className="text-[10px] text-slate-500">{(item.baseAnnualReturn * 100).toFixed(1)} %/an{item.isRealEstate ? ' · immobilier' : ''}</div>
                </div>
                <div className="text-right shrink-0">
                  {!unlocked ? (
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Lock size={10} /> {(item.unlockThreshold / 1000).toFixed(0)}k</span>
                  ) : !canBuild ? (
                    <span className="text-[10px] font-bold text-slate-600">Max</span>
                  ) : (
                    <span className="text-sm font-black flex items-center gap-1" style={{ color: item.color }}>
                      {euro(item.minAmount)}{isRE && <ChevronRight size={12} className="opacity-70" />}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        {msg && <p className="text-center text-xs mt-2.5 font-semibold px-5 text-slate-400">{msg}</p>}
      </div>
    </div>
  )
}

export function Row({ label, value, muted, danger }: { label: string; value: string; muted?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span className="text-xs font-semibold" style={{ color: muted ? '#64748b' : '#94a3b8' }}>{label}</span>
      <span className="text-sm font-black" style={{ color: danger ? '#fbbf24' : muted ? '#94a3b8' : '#e2e8f0' }}>{value}</span>
    </div>
  )
}
