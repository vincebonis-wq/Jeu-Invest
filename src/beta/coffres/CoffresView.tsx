/**
 * CoffresView — beta « Coffres », design Boom Beach.
 *
 * La métropole photo sert de plateau. Chaque placement est un bâtiment :
 *   • une PIÈCE flotte au-dessus quand un revenu est prêt → on la tape pour
 *     récolter (déjà net d'impôt), avec une petite gerbe de pièces.
 *   • taper le bâtiment ouvre la gestion : retirer du capital avec cadenas
 *     fiscal + aperçu d'impôt en direct, ou investir sur une parcelle vide.
 *
 * Connecté au moteur : vraies fonctions fiscales, vraies actions du store.
 */

import { useState } from 'react'
import {
  Lock, Unlock, Coins, X, TrendingUp, ArrowDownToLine, Hammer, ShieldCheck,
  Hourglass, ChevronRight,
} from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { getCatalogItem } from '../../data/investments'
import {
  getAVFiscalDetails, capitalGainsTax, FLAT_TAX_RATE, AV_ALLOWANCE,
} from '../../engine/fiscal'
import { formatEuroCompact } from '../../utils/formatting'
import { calcNetWorth } from '../../utils/calculations'
import { Icon } from '../../components/ui/Icon'
import { BetaShell, useDrawer } from '../BetaShell'
import { getBuildingSprite } from '../buildingSprites'
import { HOTSPOTS, type Hotspot } from '../CityImageMap'
import { DISTRICTS } from '../LivingCity'
import cityImg from '../assets/metropolis.jpg'
import type { GameState, Investment } from '../../types'

const euro = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €'

function invForHotspot(h: Hotspot, game: GameState): Investment | null {
  return game.investments.filter((i) => i.catalogId === h.catalogId)[h.slotIndex] ?? null
}

// ── Statut fiscal ────────────────────────────────────────────────────────────
type FiscalKind = 'hard' | 'fiscal' | 'taxed' | 'open'
interface FiscalStatus { kind: FiscalKind; label: string; sub: string; rate: number; yearsToFav?: number }

function daysBetween(a: string, b: string) { return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) }

function fiscalStatus(inv: Investment, game: GameState): FiscalStatus {
  const item = getCatalogItem(inv.catalogId)
  if (inv.isLocked && inv.unlockDateISO) {
    const d = Math.max(0, daysBetween(game.gameDateISO, inv.unlockDateISO))
    return { kind: 'hard', label: 'Capital bloqué', sub: `Se libère dans ${d > 60 ? Math.round(d / 30) + ' mois' : d + ' j'}`, rate: FLAT_TAX_RATE }
  }
  if (inv.catalogId === 'assurance_vie') {
    const av = getAVFiscalDetails(inv, game.gameDateISO)
    if (av.isFavorable) return { kind: 'open', label: 'Fiscalité optimisée', sub: `Abattement ${euro(AV_ALLOWANCE)}/an`, rate: av.taxRate }
    return { kind: 'fiscal', label: `Cadenas fiscal · ${Math.round(av.taxRate * 100)} %`, sub: `S'ouvre dans ${av.yearsToFavorable} an${av.yearsToFavorable > 1 ? 's' : ''}`, rate: av.taxRate, yearsToFav: av.yearsToFavorable }
  }
  if (item.taxRegime === 'exonere') return { kind: 'open', label: 'Exonéré d\'impôt', sub: 'Retrait libre', rate: 0 }
  if (item.isRealEstate) return { kind: 'taxed', label: 'Plus-value taxée', sub: 'À la revente', rate: 0.19 }
  return { kind: 'taxed', label: 'Flat tax · 30 %', sub: 'Sur la plus-value', rate: FLAT_TAX_RATE }
}

interface WithdrawPreview { gross: number; gain: number; tax: number; net: number; isFull: boolean; debt: number }
function previewWithdraw(inv: Investment, game: GameState, amount: number): WithdrawPreview {
  const item = getCatalogItem(inv.catalogId)
  const isFull = amount >= inv.currentValue - 0.5
  if (isFull) {
    const mortgage = inv.mortgageId ? game.mortgages.find((m) => m.id === inv.mortgageId) : null
    const debt = mortgage ? mortgage.outstandingBalance : 0
    const tax = capitalGainsTax(inv, game.gameDateISO)
    return { gross: inv.currentValue, gain: Math.max(0, inv.currentValue - inv.totalInvested), tax, net: inv.currentValue - debt - tax, isFull: true, debt }
  }
  const fraction = amount / inv.currentValue
  const gainPortion = fraction * Math.max(0, inv.currentValue - inv.totalInvested)
  let tax = 0
  if (inv.catalogId === 'assurance_vie') tax = Math.round(gainPortion * getAVFiscalDetails(inv, game.gameDateISO).taxRate)
  else if (item.taxRegime !== 'exonere') tax = Math.round(gainPortion * FLAT_TAX_RATE)
  return { gross: amount, gain: gainPortion, tax, net: amount - tax, isFull: false, debt: 0 }
}

// ── Racine ───────────────────────────────────────────────────────────────────
export function CoffresView() {
  const { drawerScreen, open, close } = useDrawer()
  const game = useGameStore((s) => s.game)!
  const collectAll = useGameStore((s) => s.collectAllRevenue)
  const [selected, setSelected] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)

  const netWorth = calcNetWorth(game)
  const totalPending = game.investments.reduce((s, i) => s + (i.pendingRevenue ?? 0), 0)
  const readyCount = game.investments.filter((i) => (i.pendingRevenue ?? 0) > 0).length

  function harvestAll() {
    const { total } = collectAll()
    if (total > 0) { setFlash(true); setTimeout(() => setFlash(false), 800) }
  }

  const selectedHotspot = HOTSPOTS.find((h) => h.id === selected) ?? null

  return (
    <BetaShell accent="#0a1a12" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div className="absolute inset-0 overflow-auto hide-scrollbar" style={{ background: '#0a1424' }}>
        <div className="relative w-full">
          <img src={cityImg} alt="Ma métropole" className="w-full block select-none" draggable={false} />
          {/* Fondu bas — la ville se dissout dans la nuit */}
          <div className="absolute inset-x-0 bottom-0 h-28 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, #0a1424)' }} />
          {HOTSPOTS.map((h) => (
            <BoomMarker key={h.id} hotspot={h} game={game} netWorth={netWorth}
              isSelected={selected === h.id} onManage={() => setSelected(h.id)} />
          ))}
        </div>
      </div>

      {/* Récolte globale — pilule flottante */}
      {readyCount > 0 && (
        <button
          onClick={harvestAll}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-30 rounded-full flex items-center gap-2 px-4 py-2 active:scale-95 transition-transform"
          style={{
            background: flash ? 'linear-gradient(135deg,#22c55e,#15803d)' : 'linear-gradient(135deg,#fbbf24,#d97706)',
            boxShadow: '0 4px 18px rgba(251,191,36,0.5)', transition: 'background .3s',
          }}
        >
          <Coins size={15} style={{ color: flash ? '#fff' : '#431407' }} />
          <span className="font-black text-sm" style={{ color: flash ? '#fff' : '#431407' }}>
            {flash ? '✓ Récolté !' : `Tout récolter · +${formatEuroCompact(totalPending)}`}
          </span>
        </button>
      )}

      {selectedHotspot && (
        <BuildingSheet hotspot={selectedHotspot} game={game} netWorth={netWorth}
          onClose={() => setSelected(null)} onGotoInvest={() => { setSelected(null); open('marketplace') }} />
      )}
    </BetaShell>
  )
}

// ── Marqueur Boom Beach ──────────────────────────────────────────────────────
function BoomMarker({ hotspot, game, netWorth, isSelected, onManage }: {
  hotspot: Hotspot; game: GameState; netWorth: number; isSelected: boolean; onManage: () => void
}) {
  const collectRevenue = useGameStore((s) => s.collectRevenue)
  const item = getCatalogItem(hotspot.catalogId)
  const inv = invForHotspot(hotspot, game)
  const unlocked = netWorth >= item.unlockThreshold
  const pending = inv?.pendingRevenue ?? 0
  const sprite = getBuildingSprite(hotspot.catalogId)
  const [burst, setBurst] = useState<number | null>(null)

  const fs = inv ? fiscalStatus(inv, game) : null
  const lockColor = fs?.kind === 'open' ? '#34d399' : fs?.kind === 'hard' ? '#f87171' : '#fbbf24'

  function collect(e: React.MouseEvent) {
    e.stopPropagation()
    if (!inv || pending <= 0) return
    const { collected } = collectRevenue(inv.instanceId)
    if (collected > 0) { setBurst(collected); setTimeout(() => setBurst(null), 850) }
  }

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%`, zIndex: isSelected ? 40 : pending > 0 ? 30 : 10 }}>

      {/* Gerbe de pièces à la récolte */}
      {burst !== null && (
        <div className="absolute -top-2 pointer-events-none font-black whitespace-nowrap"
          style={{ color: '#fde68a', fontSize: 13, textShadow: '0 2px 6px rgba(0,0,0,0.7)', animation: 'income-float 0.85s ease-out forwards' }}>
          +{formatEuroCompact(burst)}
        </div>
      )}

      {/* Pièce collectable (tap = récolter) */}
      {pending > 0 && burst === null && (
        <button onClick={collect}
          className="mb-0.5 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-black active:scale-90 transition-transform"
          style={{ background: '#fbbf24', color: '#431407', fontSize: 10, boxShadow: '0 2px 10px rgba(251,191,36,0.8)', animation: 'badgeBob 1.5s ease-in-out infinite' }}>
          <Coins size={9} /> +{formatEuroCompact(pending)}
        </button>
      )}

      {/* Bâtiment (tap = gérer) */}
      <button onClick={onManage} className="relative flex items-center justify-center active:scale-95 transition-transform"
        style={{ width: inv ? 42 : 34, height: inv ? 42 : 34 }}>
        {inv && sprite ? (
          <img src={sprite} alt={item.shortName} draggable={false}
            className="w-full h-full object-contain"
            style={{ filter: `drop-shadow(0 3px 5px rgba(0,0,0,0.55)) ${pending > 0 ? 'drop-shadow(0 0 6px rgba(251,191,36,0.5))' : ''}` }} />
        ) : (
          <div className="rounded-full flex items-center justify-center backdrop-blur-sm w-full h-full"
            style={{
              background: inv ? `radial-gradient(circle at 35% 30%, ${item.color}dd, ${item.color}88)`
                : unlocked ? 'rgba(15,23,42,0.7)' : 'rgba(15,23,42,0.78)',
              border: isSelected ? '2.5px solid #fff' : inv ? `2px solid ${item.color}` : unlocked ? `2px solid ${item.color}aa` : '2px solid rgba(148,163,184,0.6)',
              boxShadow: pending > 0 ? '0 0 12px rgba(251,191,36,0.6)' : `0 2px 8px rgba(0,0,0,0.5)`,
            }}>
            {inv ? <Icon name={item.icon} size={18} style={{ color: '#fff' } as React.CSSProperties} />
              : unlocked ? <Hammer size={14} style={{ color: item.color }} strokeWidth={2.5} />
              : <Lock size={12} className="text-slate-300" />}
          </div>
        )}

        {/* Pastille cadenas fiscal (bâtiment possédé) */}
        {inv && fs && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: '#0b1220', border: `1.5px solid ${lockColor}` }}>
            {fs.kind === 'open' ? <Unlock size={7} style={{ color: lockColor }} /> : <Lock size={7} style={{ color: lockColor }} />}
          </span>
        )}
      </button>
    </div>
  )
}

// ── Feuille de gestion (récolter / retirer / construire) ─────────────────────
function BuildingSheet({ hotspot, game, netWorth, onClose, onGotoInvest }: {
  hotspot: Hotspot; game: GameState; netWorth: number; onClose: () => void; onGotoInvest: () => void
}) {
  const collectRevenue = useGameStore((s) => s.collectRevenue)
  const buyInvestment = useGameStore((s) => s.buyInvestment)
  const sellInvestment = useGameStore((s) => s.sellInvestment)
  const partialSell = useGameStore((s) => s.partialSellInvestment)

  const item = getCatalogItem(hotspot.catalogId)
  const district = DISTRICTS[hotspot.district]
  const inv = invForHotspot(hotspot, game)
  const unlocked = netWorth >= item.unlockThreshold
  const sprite = getBuildingSprite(hotspot.catalogId)
  const isRealEstate = item.isRealEstate

  const [pct, setPct] = useState(isRealEstate ? 100 : 50)
  const [msg, setMsg] = useState<string | null>(null)
  const [collected, setCollected] = useState(false)

  const pending = inv?.pendingRevenue ?? 0
  const gain = inv ? inv.currentValue - inv.totalInvested : 0
  const fs = inv ? fiscalStatus(inv, game) : null
  const amount = inv ? Math.round((inv.currentValue * pct) / 100) : 0
  const pv = inv ? previewWithdraw(inv, game, amount) : null

  function harvest() {
    if (!inv) return
    const { collected: c } = collectRevenue(inv.instanceId)
    if (c > 0) { setCollected(true); setTimeout(() => setCollected(false), 900) }
  }
  function build() {
    const r = buyInvestment(hotspot.catalogId, item.minAmount, false)
    if (r.success) onClose(); else setMsg(r.message)
  }
  function withdraw() {
    if (!inv || !pv) return
    const r = pv.isFull ? sellInvestment(inv.instanceId) : partialSell(inv.instanceId, amount)
    setMsg(r.message)
    if (r.success) setTimeout(onClose, 1100)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative rounded-t-3xl pb-10"
        style={{ background: `linear-gradient(165deg, ${item.color}1c 0%, #08130d 55%)`, border: `1px solid ${item.color}30`, borderBottom: 'none', animation: 'slideUpPanel 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3" />

        {/* En-tête */}
        <div className="flex items-start gap-3 px-5 pt-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `${item.color}1a`, border: `1.5px solid ${item.color}45` }}>
            {sprite ? <img src={sprite} alt={item.name} className="w-full h-full object-contain p-1" draggable={false} />
              : <Icon name={item.icon} size={28} style={{ color: item.color } as React.CSSProperties} />}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: district.hex }}>
              {district.emoji} {district.short}
            </div>
            <div className="font-black text-white text-base leading-tight">{item.name}</div>
            {inv && <div className="text-xs text-slate-400 mt-0.5">Valeur : {euro(inv.currentValue)}</div>}
          </div>
          <button onClick={onClose} className="text-slate-600 p-1 shrink-0"><X size={18} /></button>
        </div>

        {/* Récolte (bouton proéminent) */}
        {inv && pending > 0 && (
          <div className="mx-5 mt-4">
            <button onClick={harvest}
              className="w-full py-4 rounded-2xl flex items-center justify-between px-5 active:scale-98 transition-transform"
              style={{ background: collected ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#fbbf24,#d97706)', boxShadow: '0 6px 20px rgba(251,191,36,0.4)' }}>
              <span className="flex items-center gap-2">
                <Coins size={20} style={{ color: '#431407' }} />
                <span className="font-black text-sm" style={{ color: '#431407' }}>{collected ? '✓ Encaissé !' : 'Récolter les revenus'}</span>
              </span>
              {!collected && <span className="font-black text-2xl" style={{ color: '#431407' }}>+{formatEuroCompact(pending)}</span>}
            </button>
          </div>
        )}

        {/* Cas 1 : bâtiment possédé → gérer / retirer */}
        {inv && fs ? (
          <>
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

            {/* Plus-value */}
            <div className="mx-5 mt-3 flex items-center gap-1.5">
              <TrendingUp size={13} className={gain >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
              <span className="text-sm font-black" style={{ color: gain >= 0 ? '#34d399' : '#fb7185' }}>{gain >= 0 ? '+' : ''}{euro(gain)}</span>
              <span className="text-xs text-slate-500">de plus-value</span>
            </div>

            {fs.kind !== 'hard' && (
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
                {pv && (
                  <div className="mx-5 mt-3 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Row label="Montant retiré" value={euro(pv.gross)} />
                    {pv.debt > 0 && <Row label="Crédit remboursé" value={`− ${euro(pv.debt)}`} muted />}
                    <Row label="Impôt estimé" value={pv.tax > 0 ? `− ${euro(pv.tax)}` : '0 € 🎉'} danger={pv.tax > 0} />
                    <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(52,211,153,0.1)' }}>
                      <span className="text-sm font-black text-emerald-300">Net perçu</span>
                      <span className="text-lg font-black text-emerald-300">{euro(pv.net)}</span>
                    </div>
                  </div>
                )}
                <div className="mx-5 mt-3">
                  <button onClick={withdraw}
                    className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform"
                    style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}99)`, boxShadow: `0 6px 20px ${item.color}35` }}>
                    <ArrowDownToLine size={16} /> {pv?.isFull ? 'Tout retirer' : `Retirer ${euro(pv?.gross ?? 0)}`} · net {euro(pv?.net ?? 0)}
                  </button>
                </div>
              </>
            )}
            {fs.kind === 'hard' && (
              <div className="mx-5 mt-3 py-3.5 rounded-2xl text-center text-sm font-bold text-slate-400 flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Hourglass size={14} /> Retrait indisponible — {fs.sub.toLowerCase()}
              </div>
            )}
          </>
        ) : (
          /* Cas 2 : parcelle vide → construire */
          <div className="mx-5 mt-4">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <StatMini label="Ticket d'entrée" value={euro(item.minAmount)} color={item.color} />
              <StatMini label="Rendement/an" value={`${(item.baseAnnualReturn * 100).toFixed(1)} %`} color="#34d399" />
            </div>
            {!unlocked ? (
              <div className="w-full py-3.5 rounded-2xl text-center text-sm font-bold text-slate-500 flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Lock size={14} /> Se débloque à {formatEuroCompact(item.unlockThreshold)} de patrimoine
              </div>
            ) : isRealEstate ? (
              <button onClick={onGotoInvest}
                className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform"
                style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}99)`, boxShadow: `0 6px 20px ${item.color}35` }}>
                <Hammer size={16} /> Construire · {formatEuroCompact(item.minAmount)} <ChevronRight size={14} className="opacity-70" />
              </button>
            ) : (
              <button onClick={build} disabled={game.cashBalance < item.minAmount}
                className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}99)`, boxShadow: `0 6px 20px ${item.color}35` }}>
                <Hammer size={16} /> Construire · {formatEuroCompact(item.minAmount)}
              </button>
            )}
          </div>
        )}

        {msg && <p className="text-center text-xs mt-2.5 font-semibold px-5" style={{ color: msg.includes('€') || msg.startsWith('Vendu') ? '#4ade80' : '#94a3b8' }}>{msg}</p>}
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

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm font-extrabold leading-tight" style={{ color }}>{value}</div>
    </div>
  )
}
