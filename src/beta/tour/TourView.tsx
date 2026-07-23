/**
 * TourView — beta « LA TOUR · L'Empire Vertical ».
 *
 * Ta fortune EST une tour qui monte à chaque achat. Le portrait du téléphone
 * devient une force : on scrolle comme dans un ascenseur. Chaque placement réel
 * est un étage (généré, jamais pré-dessiné) ; acheter ajoute un étage, la tour
 * grandit. On tape la capsule de billets pour récolter ; taper l'étage ouvre la
 * gestion (retirer + cadenas fiscal + aperçu d'impôt). Le ciel réagit au marché.
 *
 * 100 % procédural (CSS/SVG), local. Réutilise le moteur fiscal partagé.
 */

import { useMemo, useState } from 'react'
import {
  Coins, X, Lock, Unlock, ShieldCheck, ArrowDownToLine, Hammer, TrendingUp,
  Hourglass, ChevronRight, Building2, Plus,
} from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { getCatalogItem, INVESTMENT_CATALOG } from '../../data/investments'
import { getVisualLevel } from '../LivingCity'
import { getBuildingSprite } from '../buildingSprites'
import { Icon } from '../../components/ui/Icon'
import { BetaShell, useDrawer } from '../BetaShell'
import { euro, fiscalStatus, previewWithdraw } from '../shared/fiscalHelpers'
import { floorMeta, SKY, type FloorArchetype } from './towerData'
import type { GameState, Investment, InvestmentCategory } from '../../types'

// ── Style d'un étage selon l'archétype ───────────────────────────────────────
function floorStyle(arch: FloorArchetype, color: string): { bg: string; windows: string; extra: React.CSSProperties } {
  switch (arch) {
    case 'foundation':
      return {
        bg: `linear-gradient(180deg, ${color}55, ${color}22), linear-gradient(180deg, #1c2436, #131a28)`,
        windows: `repeating-linear-gradient(90deg, transparent 0 14px, rgba(0,0,0,0.25) 14px 16px)`,
        extra: { borderTop: `2px solid ${color}88`, borderRadius: 6 },
      }
    case 'residential':
      return {
        bg: `linear-gradient(180deg, ${color}44, ${color}18), linear-gradient(180deg, #24211c, #1a1713)`,
        windows: `repeating-linear-gradient(90deg, transparent 0 10px, rgba(253,224,150,0.18) 10px 15px), repeating-linear-gradient(180deg, transparent 0 12px, rgba(0,0,0,0.2) 12px 14px)`,
        extra: { borderRadius: 5 },
      }
    case 'office':
    case 'trading':
      return {
        bg: `linear-gradient(180deg, ${color}3a, ${color}14), linear-gradient(180deg, #0e1726, #0a1120)`,
        windows: `repeating-linear-gradient(90deg, rgba(125,211,252,0.14) 0 3px, transparent 3px 11px)`,
        extra: { borderRadius: 4, boxShadow: `inset 0 0 0 1px ${color}44` },
      }
    case 'venture':
      return {
        bg: `linear-gradient(180deg, ${color}44, ${color}18), linear-gradient(180deg, #241a24, #17111a)`,
        windows: `repeating-linear-gradient(90deg, transparent 0 18px, rgba(255,255,255,0.08) 18px 20px)`,
        extra: { borderRadius: 5 },
      }
    case 'penthouse':
      return {
        bg: `linear-gradient(180deg, ${color}66, ${color}22), linear-gradient(180deg, #1a1030, #120a24)`,
        windows: `repeating-linear-gradient(90deg, ${color}55 0 2px, transparent 2px 9px)`,
        extra: { borderRadius: 12, boxShadow: `0 0 22px ${color}66, inset 0 0 0 1px ${color}77` },
      }
  }
}

interface FloorItem { inv: Investment; meta: ReturnType<typeof floorMeta>; color: string }

// ── Racine ───────────────────────────────────────────────────────────────────
export function TourView() {
  const { drawerScreen, open, close } = useDrawer()
  const game = useGameStore((s) => s.game)!
  const collectAll = useGameStore((s) => s.collectAllRevenue)
  const [selected, setSelected] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [flash, setFlash] = useState(false)

  const netWorth = calcNetWorth(game)
  const phase = game.economy.marketPhase
  const sky = SKY[phase] ?? SKY.neutral

  const floors: FloorItem[] = useMemo(() => {
    return game.investments
      .map((inv) => ({ inv, meta: floorMeta(inv.catalogId), color: getCatalogItem(inv.catalogId).color }))
      .sort((a, b) => (b.meta.tier - a.meta.tier) || (b.inv.currentValue - a.inv.currentValue))
  }, [game.investments])

  const totalPending = game.investments.reduce((s, i) => s + (i.pendingRevenue ?? 0), 0)
  const readyCount = game.investments.filter((i) => (i.pendingRevenue ?? 0) > 0).length

  function harvestAll() {
    const { total } = collectAll()
    if (total > 0) { setFlash(true); setTimeout(() => setFlash(false), 800) }
  }

  const selectedInv = game.investments.find((i) => i.instanceId === selected) ?? null

  return (
    <BetaShell accent="#0b1226" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      {/* Ciel fixe piloté par le marché */}
      <div className="absolute inset-0" style={{ background: sky.bg }} />
      <div className="absolute top-2 right-3 z-20 px-2 py-1 rounded-full flex items-center gap-1 text-[10px] font-bold"
        style={{ background: 'rgba(0,0,0,0.35)', color: '#cbd5e1' }}>
        <span>{sky.emoji}</span>{sky.label}
      </div>

      {/* Colonne scrollable — l'ascenseur */}
      <div className="absolute inset-0 overflow-y-auto hide-scrollbar">
        <div className="min-h-full flex flex-col items-center justify-end pt-6 pb-0 px-4">

          {/* Chantier (sommet) — construire */}
          <ConstructionSite onBuild={() => setBuilding(true)} floors={floors.length} />

          {/* Étages (penthouse en haut → fondations en bas) */}
          {floors.map(({ inv, meta, color }) => (
            <Floor key={inv.instanceId} inv={inv} meta={meta} color={color}
              onManage={() => setSelected(inv.instanceId)} />
          ))}

          {floors.length === 0 && (
            <div className="text-center text-slate-400 text-sm my-8 max-w-xs">
              Ta tour est vide. Touche le chantier tout en haut pour poser ton premier étage.
            </div>
          )}

          {/* Sol */}
          <div className="w-full max-w-[360px] h-6 rounded-b-lg mt-[-2px]"
            style={{ background: 'linear-gradient(180deg,#0b1220,#05070f)', boxShadow: '0 -1px 0 rgba(255,255,255,0.06)' }} />
        </div>
      </div>

      {/* Récolte globale */}
      {readyCount > 0 && (
        <button onClick={harvestAll}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-30 rounded-full flex items-center gap-2 px-4 py-2 active:scale-95 transition-transform"
          style={{ background: flash ? 'linear-gradient(135deg,#22c55e,#15803d)' : 'linear-gradient(135deg,#fbbf24,#d97706)', boxShadow: '0 4px 18px rgba(251,191,36,0.5)', transition: 'background .3s' }}>
          <Coins size={15} style={{ color: flash ? '#fff' : '#431407' }} />
          <span className="font-black text-sm" style={{ color: flash ? '#fff' : '#431407' }}>
            {flash ? '✓ Récolté !' : `Tout récolter · +${euro(totalPending)}`}
          </span>
        </button>
      )}

      {selectedInv && <AssetSheet inv={selectedInv} game={game} onClose={() => setSelected(null)} />}
      {building && <BuildSheet game={game} netWorth={netWorth} onClose={() => setBuilding(false)} onGotoInvest={() => { setBuilding(false); open('marketplace') }} />}
    </BetaShell>
  )
}

// ── Chantier ─────────────────────────────────────────────────────────────────
function ConstructionSite({ onBuild, floors }: { onBuild: () => void; floors: number }) {
  return (
    <div className="w-full max-w-[300px] flex flex-col items-center mb-1">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
        <Building2 size={11} /> {floors} étage{floors > 1 ? 's' : ''}
      </div>
      <button onClick={onBuild}
        className="w-full py-3 rounded-xl flex items-center justify-center gap-2 active:scale-97 transition-transform"
        style={{ background: 'repeating-linear-gradient(45deg,#facc1533 0 10px,#00000022 10px 20px)', border: '1.5px dashed rgba(250,204,21,0.6)' }}>
        <Plus size={16} className="text-amber-300" />
        <span className="font-black text-sm text-amber-200">Construire un étage</span>
      </button>
    </div>
  )
}

// ── Étage ────────────────────────────────────────────────────────────────────
function Floor({ inv, meta, color, onManage }: { inv: Investment; meta: ReturnType<typeof floorMeta>; color: string; onManage: () => void }) {
  const collectRevenue = useGameStore((s) => s.collectRevenue)
  const game = useGameStore((s) => s.game)!
  const item = getCatalogItem(inv.catalogId)
  const fs = fiscalStatus(inv, game)
  const pending = inv.pendingRevenue ?? 0
  const sprite = getBuildingSprite(inv.catalogId)
  const [burst, setBurst] = useState<number | null>(null)

  const vlvl = getVisualLevel(inv.currentValue, inv.level ?? 1, item.minAmount)
  const height = 74 + Math.min(20, vlvl) * 1.7
  const st = floorStyle(meta.archetype, color)
  const lockColor = fs.kind === 'open' ? '#34d399' : fs.kind === 'hard' ? '#f87171' : '#fbbf24'
  const isPenthouse = meta.archetype === 'penthouse'

  function collect(e: React.MouseEvent) {
    e.stopPropagation()
    if (pending <= 0) return
    const { collected } = collectRevenue(inv.instanceId)
    if (collected > 0) { setBurst(collected); setTimeout(() => setBurst(null), 850) }
  }

  return (
    <div className="relative flex justify-center w-full" style={{ marginTop: isPenthouse ? 10 : 0, marginBottom: isPenthouse ? 10 : 0 }}>
      {/* Capsule de billets à récolter */}
      {pending > 0 && burst === null && (
        <button onClick={collect}
          className="absolute -top-2 right-3 z-20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-black active:scale-90 transition-transform"
          style={{ background: '#fbbf24', color: '#431407', fontSize: 10, boxShadow: '0 2px 10px rgba(251,191,36,0.8)', animation: 'badgeBob 1.5s ease-in-out infinite' }}>
          <Coins size={9} /> +{euro(pending)}
        </button>
      )}
      {burst !== null && (
        <div className="absolute -top-2 right-4 z-20 pointer-events-none font-black whitespace-nowrap"
          style={{ color: '#fde68a', fontSize: 13, textShadow: '0 2px 6px rgba(0,0,0,0.7)', animation: 'income-float 0.85s ease-out forwards' }}>
          +{euro(burst)}
        </div>
      )}

      <button onClick={onManage}
        className="relative flex items-center gap-2.5 px-3 active:brightness-110 transition-all overflow-hidden"
        style={{ width: `${meta.width}%`, maxWidth: 360, height, ...st.extra, backgroundImage: st.bg, backgroundBlendMode: 'normal' }}>
        {/* Fenêtres */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: st.windows, opacity: 0.5 }} />
        {/* Halo si revenu prêt */}
        {pending > 0 && <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 20px ${'#fbbf2466'}` }} />}

        {/* Icône / sprite */}
        <div className="relative w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}22`, border: `1px solid ${color}55` }}>
          {sprite ? <img src={sprite} alt="" className="w-full h-full object-contain p-0.5" draggable={false} />
            : <Icon name={item.icon} size={20} style={{ color: '#fff' } as React.CSSProperties} />}
        </div>

        {/* Infos */}
        <div className="relative flex-1 min-w-0 text-left">
          <div className="text-[13px] font-black text-white leading-tight truncate flex items-center gap-1.5">
            {item.shortName}
            {(inv.level ?? 1) > 1 && <span className="text-[9px] px-1 rounded" style={{ background: `${color}44`, color: '#fff' }}>Niv.{inv.level}</span>}
          </div>
          <div className="text-[11px] font-black" style={{ color: '#e2e8f0' }}>{euro(inv.currentValue)}</div>
        </div>

        {/* Cadenas fiscal (porte de chambre forte) */}
        <div className="relative shrink-0 flex flex-col items-center gap-0.5">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: `${lockColor}22`, border: `1.5px solid ${lockColor}` }}>
            {fs.kind === 'open' ? <Unlock size={11} style={{ color: lockColor }} /> : <Lock size={11} style={{ color: lockColor }} />}
          </div>
          {fs.kind === 'fiscal' && fs.yearsToFav != null && (
            <span className="text-[8px] font-black leading-none" style={{ color: lockColor }}>{fs.yearsToFav}a</span>
          )}
        </div>
      </button>
    </div>
  )
}

// ── Gestion d'un étage (récolter / retirer / fiscal) ─────────────────────────
function AssetSheet({ inv, game, onClose }: { inv: Investment; game: GameState; onClose: () => void }) {
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

        {/* Cadenas fiscal */}
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
              <Row label="Impôt estimé" value={pv.tax > 0 ? `− ${euro(pv.tax)}` : '0 € 🎉'} danger={pv.tax > 0} />
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

// ── Construire un nouvel étage ───────────────────────────────────────────────
function BuildSheet({ game, netWorth, onClose, onGotoInvest }: { game: GameState; netWorth: number; onClose: () => void; onGotoInvest: () => void }) {
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
          <div className="font-black text-white text-base flex items-center gap-2"><Hammer size={17} className="text-amber-300" /> Construire un étage</div>
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

function Row({ label, value, muted, danger }: { label: string; value: string; muted?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span className="text-xs font-semibold" style={{ color: muted ? '#64748b' : '#94a3b8' }}>{label}</span>
      <span className="text-sm font-black" style={{ color: danger ? '#fbbf24' : muted ? '#94a3b8' : '#e2e8f0' }}>{value}</span>
    </div>
  )
}
