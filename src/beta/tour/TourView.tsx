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
  Coins, Lock, Unlock, Building2, Plus,
} from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { calcNetWorth } from '../../utils/calculations'
import { getCatalogItem } from '../../data/investments'
import { getVisualLevel } from '../LivingCity'
import { getBuildingSprite } from '../buildingSprites'
import { Icon } from '../../components/ui/Icon'
import { BetaShell, useDrawer } from '../BetaShell'
import { euro, fiscalStatus } from '../shared/fiscalHelpers'
import { AssetSheet, BuildSheet } from '../shared/ManageSheets'
import { floorMeta, SKY, type FloorArchetype } from './towerData'
import type { Investment } from '../../types'

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
      {building && <BuildSheet game={game} netWorth={netWorth} title="Construire un étage" onClose={() => setBuilding(false)} onGotoInvest={() => { setBuilding(false); open('marketplace') }} />}
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
