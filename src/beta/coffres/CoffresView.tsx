/**
 * CoffresView — beta « Coffres » : le patrimoine rendu tangible.
 *
 * Chaque placement de la vraie partie devient un coffre vivant. Deux gestes :
 *   • RÉCOLTER — encaisser les revenus accumulés (loyers, intérêts, dividendes),
 *     déjà nets d'impôt → satisfaisant et gratuit.
 *   • RETIRER — sortir du capital (vente). Là, la fiscalité entre en jeu :
 *     un cadenas indique si le retrait est taxé, avec un aperçu d'impôt EN DIRECT,
 *     et il s'ouvre quand le bon délai fiscal est atteint (assurance-vie 8 ans…).
 *
 * Connecté au moteur : utilise les vraies fonctions fiscales et les vraies
 * actions du store (collectRevenue / sellInvestment / partialSellInvestment).
 */

import { useState } from 'react'
import {
  Lock, Unlock, Coins, X, TrendingUp, Sparkles, ArrowDownToLine, Hourglass, ShieldCheck,
} from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { getCatalogItem } from '../../data/investments'
import {
  getAVFiscalDetails, capitalGainsTax, FLAT_TAX_RATE, AV_ALLOWANCE,
} from '../../engine/fiscal'
import { formatEuroCompact } from '../../utils/formatting'
import { Icon } from '../../components/ui/Icon'
import { BetaShell, useDrawer } from '../BetaShell'
import type { GameState, Investment } from '../../types'

const euro = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €'

// ── Statut fiscal d'un coffre ────────────────────────────────────────────────
type FiscalKind = 'hard' | 'fiscal' | 'taxed' | 'open'

interface FiscalStatus {
  kind: FiscalKind
  label: string
  sub: string
  rate: number            // taux appliqué sur la plus-value en cas de retrait
  daysToUnlock?: number   // blocage dur (temps de jeu)
  yearsToFav?: number     // assurance-vie : années avant le régime 8 ans
}

function daysBetween(fromISO: string, toISO: string) {
  return Math.ceil((new Date(toISO).getTime() - new Date(fromISO).getTime()) / 86_400_000)
}

function fiscalStatus(inv: Investment, game: GameState): FiscalStatus {
  const item = getCatalogItem(inv.catalogId)

  // Blocage dur (période de lock : crowdfunding, SCPI…)
  if (inv.isLocked && inv.unlockDateISO) {
    const d = Math.max(0, daysBetween(game.gameDateISO, inv.unlockDateISO))
    const txt = d > 60 ? `${Math.round(d / 30)} mois` : `${d} j`
    return { kind: 'hard', label: 'Capital bloqué', sub: `Se libère dans ${txt}`, rate: FLAT_TAX_RATE, daysToUnlock: d }
  }

  // Assurance-vie : cadenas fiscal 8 ans
  if (inv.catalogId === 'assurance_vie') {
    const av = getAVFiscalDetails(inv, game.gameDateISO)
    if (av.isFavorable) {
      return { kind: 'open', label: 'Fiscalité optimisée', sub: `Abattement ${euro(AV_ALLOWANCE)}/an`, rate: av.taxRate }
    }
    return {
      kind: 'fiscal',
      label: `Cadenas fiscal · ${Math.round(av.taxRate * 100)} %`,
      sub: `S'ouvre dans ${av.yearsToFavorable} an${av.yearsToFavorable > 1 ? 's' : ''} (8 ans)`,
      rate: av.taxRate,
      yearsToFav: av.yearsToFavorable,
    }
  }

  // Exonéré (Livret)
  if (item.taxRegime === 'exonere') {
    return { kind: 'open', label: 'Exonéré d\'impôt', sub: 'Retrait libre et net', rate: 0 }
  }

  // Immobilier — plus-value foncière (abattement simplifié)
  if (item.isRealEstate) {
    return { kind: 'taxed', label: 'Plus-value taxée', sub: 'Impôt sur la plus-value à la vente', rate: 0.19 }
  }

  // Défaut : flat tax 30 % sur la plus-value (ETF, or, crypto, obligations…)
  return { kind: 'taxed', label: 'Flat tax · 30 %', sub: 'Sur la plus-value au retrait', rate: FLAT_TAX_RATE }
}

// ── Aperçu d'un retrait (miroir des actions du store) ────────────────────────
interface WithdrawPreview {
  gross: number; gain: number; tax: number; net: number; isFull: boolean; debt: number
}

function previewWithdraw(inv: Investment, game: GameState, amount: number): WithdrawPreview {
  const item = getCatalogItem(inv.catalogId)
  const isFull = amount >= inv.currentValue - 0.5

  if (isFull) {
    const mortgage = inv.mortgageId ? game.mortgages.find((m) => m.id === inv.mortgageId) : null
    const debt = mortgage ? mortgage.outstandingBalance : 0
    const tax = capitalGainsTax(inv, game.gameDateISO)
    const gain = Math.max(0, inv.currentValue - inv.totalInvested)
    return { gross: inv.currentValue, gain, tax, net: inv.currentValue - debt - tax, isFull: true, debt }
  }

  const fraction = amount / inv.currentValue
  const gain = Math.max(0, inv.currentValue - inv.totalInvested)
  const gainPortion = fraction * gain
  let tax = 0
  if (inv.catalogId === 'assurance_vie') {
    tax = Math.round(gainPortion * getAVFiscalDetails(inv, game.gameDateISO).taxRate)
  } else if (item.taxRegime !== 'exonere') {
    tax = Math.round(gainPortion * FLAT_TAX_RATE)
  }
  return { gross: amount, gain: gainPortion, tax, net: amount - tax, isFull: false, debt: 0 }
}

// ── Racine ───────────────────────────────────────────────────────────────────
export function CoffresView() {
  const { drawerScreen, open, close } = useDrawer()
  const game = useGameStore((s) => s.game)!
  const collectAll = useGameStore((s) => s.collectAllRevenue)
  const [selected, setSelected] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)

  const totalPending = game.investments.reduce((s, i) => s + (i.pendingRevenue ?? 0), 0)
  const readyCount = game.investments.filter((i) => (i.pendingRevenue ?? 0) > 0).length

  function harvestAll() {
    const { total } = collectAll()
    if (total > 0) { setFlash(true); setTimeout(() => setFlash(false), 700) }
  }

  const selectedInv = game.investments.find((i) => i.instanceId === selected) ?? null

  return (
    <BetaShell accent="#0a1a12" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div className="h-full flex flex-col overflow-hidden" style={{ background: '#07130d' }}>

        {/* Bandeau récolte globale */}
        <div className="shrink-0 px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Mes coffres</div>
              <div className="text-white font-black text-lg leading-tight">
                {game.investments.length} placement{game.investments.length > 1 ? 's' : ''}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">À récolter</div>
              <div className="font-black text-lg leading-tight" style={{ color: readyCount ? '#fbbf24' : '#475569' }}>
                {formatEuroCompact(totalPending)}
              </div>
            </div>
          </div>

          {readyCount > 0 && (
            <button
              onClick={harvestAll}
              className="w-full mt-1.5 rounded-2xl flex items-center justify-between px-4 py-2.5 active:scale-98 transition-transform"
              style={{
                background: flash ? 'linear-gradient(135deg,#22c55e,#15803d)' : 'linear-gradient(135deg,#fbbf24,#d97706)',
                boxShadow: '0 4px 18px rgba(251,191,36,0.35)', transition: 'background .3s',
              }}
            >
              <span className="flex items-center gap-2 font-extrabold text-sm" style={{ color: flash ? '#fff' : '#431407' }}>
                <Coins size={16} /> {flash ? '✓ Récolté !' : `Tout récolter · ${readyCount} coffre${readyCount > 1 ? 's' : ''}`}
              </span>
              {!flash && <span className="font-black text-sm" style={{ color: '#431407' }}>+{formatEuroCompact(totalPending)} →</span>}
            </button>
          )}
        </div>

        {/* Liste des coffres */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-4 hide-scrollbar">
          {game.investments.length === 0 ? (
            <EmptyState onInvest={() => open('marketplace')} />
          ) : (
            <div className="space-y-2">
              {game.investments.map((inv) => (
                <CoffreCard key={inv.instanceId} inv={inv} game={game} onWithdraw={() => setSelected(inv.instanceId)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedInv && (
        <WithdrawModal inv={selectedInv} game={game} onClose={() => setSelected(null)} />
      )}
    </BetaShell>
  )
}

// ── Carte coffre ─────────────────────────────────────────────────────────────
function CoffreCard({ inv, game, onWithdraw }: { inv: Investment; game: GameState; onWithdraw: () => void }) {
  const collectRevenue = useGameStore((s) => s.collectRevenue)
  const item = getCatalogItem(inv.catalogId)
  const fs = fiscalStatus(inv, game)
  const pending = inv.pendingRevenue ?? 0
  const gain = inv.currentValue - inv.totalInvested
  const isIncome = item.yieldMode === 'income'
  const [harvested, setHarvested] = useState(false)

  function harvest() {
    const { collected } = collectRevenue(inv.instanceId)
    if (collected > 0) { setHarvested(true); setTimeout(() => setHarvested(false), 900) }
  }

  const lockColor = fs.kind === 'open' ? '#34d399' : fs.kind === 'hard' ? '#f87171' : '#fbbf24'
  const LockIcon = fs.kind === 'open' ? Unlock : Lock

  return (
    <div className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start gap-3">
        {/* Icône */}
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${item.color}1a`, border: `1.5px solid ${item.color}44` }}>
          <Icon name={item.icon} size={22} style={{ color: item.color } as React.CSSProperties} />
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-white text-sm truncate">{item.shortName}</span>
            <span className="font-black text-white text-sm shrink-0">{formatEuroCompact(inv.currentValue)}</span>
          </div>
          {/* Plus/moins-value */}
          <div className="flex items-center gap-1 mt-0.5">
            <TrendingUp size={11} className={gain >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
            <span className="text-[11px] font-bold" style={{ color: gain >= 0 ? '#34d399' : '#fb7185' }}>
              {gain >= 0 ? '+' : ''}{formatEuroCompact(gain)}
            </span>
            <span className="text-[10px] text-slate-600">de plus-value</span>
          </div>

          {/* Badge fiscal */}
          <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg w-fit"
            style={{ background: `${lockColor}14`, border: `1px solid ${lockColor}33` }}>
            <LockIcon size={11} style={{ color: lockColor }} />
            <span className="text-[10px] font-bold" style={{ color: lockColor }}>{fs.label}</span>
            <span className="text-[9px] text-slate-500">· {fs.sub}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        {isIncome && (
          <button
            onClick={harvest}
            disabled={pending <= 0}
            className="flex-1 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition-all disabled:opacity-35"
            style={{
              background: harvested ? 'linear-gradient(135deg,#22c55e,#15803d)'
                : pending > 0 ? 'linear-gradient(135deg,#fbbf24,#d97706)' : 'rgba(255,255,255,0.05)',
              color: pending > 0 || harvested ? '#431407' : '#64748b',
            }}
          >
            <Coins size={14} />
            {harvested ? '✓ Récolté' : pending > 0 ? `Récolter ${formatEuroCompact(pending)}` : 'Rien à récolter'}
          </button>
        )}
        <button
          onClick={onWithdraw}
          disabled={fs.kind === 'hard'}
          className="flex-1 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition-all disabled:opacity-35"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {fs.kind === 'hard' ? <Hourglass size={13} /> : <ArrowDownToLine size={13} />}
          {fs.kind === 'hard' ? 'Bloqué' : 'Retirer'}
        </button>
      </div>
    </div>
  )
}

// ── Modale de retrait avec aperçu d'impôt ────────────────────────────────────
function WithdrawModal({ inv, game, onClose }: { inv: Investment; game: GameState; onClose: () => void }) {
  const sellInvestment = useGameStore((s) => s.sellInvestment)
  const partialSell = useGameStore((s) => s.partialSellInvestment)
  const item = getCatalogItem(inv.catalogId)
  const fs = fiscalStatus(inv, game)
  const isRealEstate = item.isRealEstate
  const [pct, setPct] = useState(isRealEstate ? 100 : 50)
  const [done, setDone] = useState<string | null>(null)

  const amount = Math.round((inv.currentValue * pct) / 100)
  const pv = previewWithdraw(inv, game, amount)

  function confirm() {
    const r = pv.isFull ? sellInvestment(inv.instanceId) : partialSell(inv.instanceId, amount)
    setDone(r.message)
    if (r.success) setTimeout(onClose, 1100)
  }

  const chips = isRealEstate ? [100] : [25, 50, 100]

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative rounded-t-3xl pb-10"
        style={{ background: `linear-gradient(165deg, ${item.color}1c 0%, #08130d 55%)`, border: `1px solid ${item.color}30`, borderBottom: 'none', animation: 'slideUpPanel 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3" />

        {/* En-tête */}
        <div className="flex items-start gap-3 px-5 pt-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `${item.color}1a`, border: `1.5px solid ${item.color}45` }}>
            <Icon name={item.icon} size={26} style={{ color: item.color } as React.CSSProperties} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="font-black text-white text-base leading-tight">{item.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">Valeur : {euro(inv.currentValue)}</div>
          </div>
          <button onClick={onClose} className="text-slate-600 p-1"><X size={18} /></button>
        </div>

        {/* Encart cadenas fiscal (le cœur pédagogique) */}
        <div className="mx-5 mt-4 rounded-2xl p-3.5"
          style={{
            background: fs.kind === 'open' ? 'rgba(52,211,153,0.08)' : 'rgba(251,191,36,0.07)',
            border: `1px solid ${fs.kind === 'open' ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.3)'}`,
          }}>
          <div className="flex items-center gap-2">
            {fs.kind === 'open'
              ? <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
              : <Lock size={15} className="text-amber-400 shrink-0" />}
            <span className="font-black text-sm" style={{ color: fs.kind === 'open' ? '#34d399' : '#fbbf24' }}>{fs.label}</span>
          </div>
          <p className="text-[12px] text-slate-300 mt-1.5 leading-snug">
            {fs.kind === 'fiscal' && inv.catalogId === 'assurance_vie' && (
              <>Sors maintenant → plus-value taxée à <b className="text-amber-300">{Math.round(fs.rate * 100)} %</b>.
              Attends <b className="text-emerald-300">{fs.yearsToFav} an{(fs.yearsToFav ?? 0) > 1 ? 's' : ''}</b> (8 ans) et l'abattement de {euro(AV_ALLOWANCE)}/an ramène l'impôt à <b className="text-emerald-300">presque 0</b>.</>
            )}
            {fs.kind === 'open' && <>Retrait dans les meilleures conditions fiscales. {fs.sub}.</>}
            {fs.kind === 'taxed' && <>La plus-value sera taxée à <b className="text-amber-300">{Math.round(fs.rate * 100)} %</b> au retrait. Le capital investi, lui, sort sans impôt.</>}
          </p>
        </div>

        {/* Sélecteur de montant */}
        {!isRealEstate && (
          <div className="mx-5 mt-4">
            <div className="flex gap-2">
              {chips.map((c) => (
                <button key={c} onClick={() => setPct(c)}
                  className="flex-1 py-2 rounded-xl font-black text-xs transition-all active:scale-95"
                  style={{
                    background: pct === c ? `${item.color}22` : 'rgba(255,255,255,0.05)',
                    color: pct === c ? item.color : '#94a3b8',
                    border: `1px solid ${pct === c ? `${item.color}66` : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  {c === 100 ? 'Tout' : `${c} %`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Aperçu d'impôt EN DIRECT */}
        <div className="mx-5 mt-4 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <Row label="Montant retiré" value={euro(pv.gross)} />
          <Row label="Dont plus-value" value={euro(pv.gain)} muted />
          {pv.debt > 0 && <Row label="Crédit remboursé" value={`− ${euro(pv.debt)}`} muted />}
          <Row label="Impôt estimé" value={pv.tax > 0 ? `− ${euro(pv.tax)}` : '0 € 🎉'} danger={pv.tax > 0} />
          <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(52,211,153,0.1)' }}>
            <span className="text-sm font-black text-emerald-300">Net perçu</span>
            <span className="text-lg font-black text-emerald-300">{euro(pv.net)}</span>
          </div>
        </div>

        {/* Action */}
        <div className="mx-5 mt-4">
          <button onClick={confirm}
            className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform"
            style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}99)`, boxShadow: `0 6px 20px ${item.color}35` }}>
            <ArrowDownToLine size={16} />
            {pv.isFull ? 'Tout retirer' : `Retirer ${euro(pv.gross)}`} · net {euro(pv.net)}
          </button>
          {done && (
            <p className="text-center text-xs mt-2.5 font-semibold" style={{ color: done.startsWith('Vendu') || done.includes('€') ? '#4ade80' : '#94a3b8' }}>
              {done}
            </p>
          )}
        </div>
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

function EmptyState({ onInvest }: { onInvest: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center pt-16 px-8">
      <div style={{ fontSize: 46 }}>🗄️</div>
      <div className="text-white font-black text-lg mt-3">Aucun coffre pour l'instant</div>
      <p className="text-slate-400 text-sm mt-2 max-w-xs leading-relaxed">
        Investis pour créer ton premier coffre. Il se remplira de gains que tu viendras récolter, et que tu pourras retirer au bon moment fiscal.
      </p>
      <button onClick={onInvest}
        className="mt-5 px-8 py-3 rounded-2xl font-black text-white text-sm active:scale-95 transition-transform"
        style={{ background: 'linear-gradient(135deg,#34d399,#059669)', boxShadow: '0 8px 24px rgba(52,211,153,0.3)' }}>
        <Sparkles size={15} className="inline mr-1.5 -mt-0.5" /> Investir maintenant
      </button>
    </div>
  )
}
