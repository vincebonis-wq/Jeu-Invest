/**
 * TycoonView — beta « TYCOON · L'empire qui tourne tout seul ».
 *
 * Ancrée sur AdVenture Capitalist : chaque actif produit des revenus ; on
 * recrute un GESTIONNAIRE qui les encaisse automatiquement → l'empire compose
 * même hors-ligne, gros chiffres, revenu/heure qui grimpe. On peut « passer la
 * main à la génération suivante » (prestige déjà codé) pour repartir avec des
 * bonus permanents.
 *
 * Connectée au vrai jeu et au cœur économique unifié (AssetSheet / BuildSheet
 * partagés). Les gestionnaires auto-collectent le pendingRevenue via le store.
 */

import { useEffect, useRef, useState } from 'react'
import { Coins, Zap, Crown, UserPlus, CheckCircle2, TrendingUp, Sparkles, RotateCcw } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { getCatalogItem } from '../../data/investments'
import { getBuildingSprite } from '../buildingSprites'
import { Icon } from '../../components/ui/Icon'
import { BetaShell, useDrawer } from '../BetaShell'
import { euro } from '../shared/fiscalHelpers'
import { AssetSheet, BuildSheet } from '../shared/ManageSheets'
import type { Investment } from '../../types'

const MGR_KEY = 'jeu-invest-tycoon-managers'
function loadMgrs(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(MGR_KEY) || '[]')) } catch { return new Set() } }
function saveMgrs(s: Set<string>) { try { localStorage.setItem(MGR_KEY, JSON.stringify([...s])) } catch { /* ignore */ } }

export function TycoonView() {
  const { drawerScreen, open, close } = useDrawer()
  const game = useGameStore((s) => s.game)!
  const doPrestige = useGameStore((s) => s.prestige)
  const [managers, setManagers] = useState<Set<string>>(loadMgrs)
  const [selected, setSelected] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const mgrRef = useRef(managers)
  mgrRef.current = managers

  const netWorth = calcNetWorth(game)
  const empireValue = game.investments.reduce((s, i) => s + i.currentValue, 0)
  const revPerMonth = game.investments.reduce((s, i) => s + (i.currentValue * i.annualReturnRate) / 12, 0)
  const totalPending = game.investments.reduce((s, i) => s + (i.pendingRevenue ?? 0), 0)
  const prestigeLvl = game.prestige?.level ?? 0

  // Auto-collecte des gestionnaires
  useEffect(() => {
    const t = setInterval(() => {
      const st = useGameStore.getState()
      const g = st.game
      if (!g) return
      for (const inv of g.investments) {
        if (mgrRef.current.has(inv.instanceId) && (inv.pendingRevenue ?? 0) > 0) st.collectRevenue(inv.instanceId)
      }
    }, 1400)
    return () => clearInterval(t)
  }, [])

  function toggleManager(id: string) {
    setManagers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      saveMgrs(next)
      return next
    })
  }

  const selectedInv = game.investments.find((i) => i.instanceId === selected) ?? null
  const canPrestige = netWorth >= 200_000

  return (
    <BetaShell accent="#12081f" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div className="absolute inset-0 overflow-y-auto hide-scrollbar" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #241436 0%, #0c0718 55%, #070310 100%)' }}>
        <div className="max-w-md mx-auto px-4 pt-3 pb-4">

          {/* Bandeau empire */}
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'linear-gradient(135deg,rgba(168,85,247,0.16),rgba(12,7,24,0.9))', border: '1px solid rgba(168,85,247,0.3)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300 flex items-center gap-1">
                  <Crown size={12} /> Empire {prestigeLvl > 0 && `· Gén. ${prestigeLvl + 1}`}
                </div>
                <div className="text-white font-black leading-none mt-1" style={{ fontSize: 26 }}>{euro(empireValue)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1 justify-end"><Zap size={11} className="text-emerald-400" /> Revenu/mois</div>
                <div className="text-emerald-400 font-black text-xl leading-none">+{euro(revPerMonth)}</div>
              </div>
            </div>
            {totalPending > 0 && (
              <div className="mt-2 text-[11px] text-amber-300 font-bold flex items-center gap-1">
                <Coins size={11} /> {euro(totalPending)} en attente d'encaissement
              </div>
            )}
          </div>

          {/* Développer */}
          <button onClick={() => setBuilding(true)}
            className="w-full mb-4 py-3 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform"
            style={{ background: 'linear-gradient(135deg,#a855f7,#7c3aed)', boxShadow: '0 6px 20px rgba(168,85,247,0.35)' }}>
            <Sparkles size={16} /> Développer l'empire
          </button>

          {/* Business */}
          {game.investments.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-8">Ton empire est vide. Développe-le pour lancer ta première source de revenus.</div>
          ) : (
            <div className="space-y-2">
              {game.investments.map((inv) => (
                <BusinessRow key={inv.instanceId} inv={inv} hasManager={managers.has(inv.instanceId)}
                  onManage={() => setSelected(inv.instanceId)} onToggleManager={() => toggleManager(inv.instanceId)} />
              ))}
            </div>
          )}

          {/* Prestige */}
          <div className="mt-5 rounded-2xl p-4" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <div className="flex items-center gap-2 mb-1">
              <RotateCcw size={15} className="text-amber-300" />
              <span className="font-black text-sm text-amber-200">Génération suivante</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Transmets ton empire et recommence avec un héritage permanent (capital de départ, rendements et salaire boostés). Ton patrimoine actuel : {euro(netWorth)}.
            </p>
            <button onClick={() => { if (canPrestige && confirm('Transmettre ton empire et recommencer avec des bonus permanents ?')) doPrestige() }}
              disabled={!canPrestige}
              className="w-full mt-2.5 py-2.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
              <Crown size={15} /> {canPrestige ? `Prestige → Génération ${prestigeLvl + 2}` : `Débloqué à ${euro(200_000)} de patrimoine`}
            </button>
          </div>
        </div>
      </div>

      {selectedInv && <AssetSheet inv={selectedInv} game={game} onClose={() => setSelected(null)} />}
      {building && <BuildSheet game={game} netWorth={netWorth} title="Développer l'empire" onClose={() => setBuilding(false)} onGotoInvest={() => { setBuilding(false); open('marketplace') }} />}
    </BetaShell>
  )
}

function BusinessRow({ inv, hasManager, onManage, onToggleManager }: { inv: Investment; hasManager: boolean; onManage: () => void; onToggleManager: () => void }) {
  const collectRevenue = useGameStore((s) => s.collectRevenue)
  const item = getCatalogItem(inv.catalogId)
  const sprite = getBuildingSprite(inv.catalogId)
  const isIncome = item.yieldMode === 'income'
  const pending = inv.pendingRevenue ?? 0
  const gain = inv.currentValue - inv.totalInvested
  const cap = Math.max(1, inv.monthlyIncome || inv.currentValue * item.baseAnnualReturn / 12)
  const fill = Math.min(1, pending / cap)
  const [pop, setPop] = useState(false)

  function collect(e: React.MouseEvent) {
    e.stopPropagation()
    const { collected } = collectRevenue(inv.instanceId)
    if (collected > 0) { setPop(true); setTimeout(() => setPop(false), 500) }
  }

  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${item.color}33` }}>
      <div className="flex items-center gap-3">
        <button onClick={onManage} className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform" style={{ background: `${item.color}1e`, border: `1px solid ${item.color}55` }}>
          {sprite ? <img src={sprite} alt="" className="w-full h-full object-contain p-0.5" draggable={false} /> : <Icon name={item.icon} size={22} style={{ color: item.color } as React.CSSProperties} />}
        </button>
        <button onClick={onManage} className="flex-1 min-w-0 text-left">
          <div className="text-sm font-black text-white leading-tight truncate">{item.shortName}{(inv.level ?? 1) > 1 ? ` · Niv.${inv.level}` : ''}</div>
          <div className="text-[11px] font-bold text-slate-300">{euro(inv.currentValue)}
            {gain !== 0 && <span className="ml-1.5" style={{ color: gain > 0 ? '#34d399' : '#fb7185' }}>{gain > 0 ? '+' : ''}{euro(gain)}</span>}
          </div>
        </button>
        {/* Gestionnaire */}
        <button onClick={(e) => { e.stopPropagation(); onToggleManager() }}
          className="shrink-0 flex flex-col items-center gap-0.5 px-1"
          title={hasManager ? 'Gestionnaire actif' : 'Recruter un gestionnaire'}>
          {hasManager ? <CheckCircle2 size={20} className="text-emerald-400" /> : <UserPlus size={19} className="text-slate-500" />}
          <span className="text-[7px] font-black uppercase tracking-wide" style={{ color: hasManager ? '#34d399' : '#64748b' }}>{hasManager ? 'Auto' : 'Gérant'}</span>
        </button>
      </div>

      {/* Barre de production + collecte */}
      {isIncome ? (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 h-3 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${fill * 100}%`, background: `linear-gradient(90deg,${item.color}aa,${item.color})` }} />
            {hasManager && <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white/70 uppercase tracking-widest">auto</div>}
          </div>
          <button onClick={collect} disabled={pending <= 0}
            className="shrink-0 px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1 active:scale-95 transition-transform disabled:opacity-30"
            style={{ background: pop ? 'linear-gradient(135deg,#22c55e,#15803d)' : pending > 0 ? 'linear-gradient(135deg,#fbbf24,#d97706)' : 'rgba(255,255,255,0.05)', color: pending > 0 || pop ? '#431407' : '#64748b' }}>
            <Coins size={12} /> {pop ? '✓' : pending > 0 ? euro(pending) : '—'}
          </button>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
          <TrendingUp size={12} className="text-emerald-400" /> Capitalise en valeur — développe ou retire depuis la fiche.
        </div>
      )}
    </div>
  )
}
