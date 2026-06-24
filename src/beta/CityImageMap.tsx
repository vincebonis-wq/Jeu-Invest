/**
 * CityImageMap — dashboard beta : la métropole photoréaliste interactive.
 *
 * L'image de la ville sert de fond. Des « hotspots » sont posés sur les
 * bâtiments réels (tours de verre → Bourse, banque à colonnes → Obligations,
 * port → Or, entrepôt → Crowdfunding, parcelles cadenassées → actifs
 * verrouillés…). Taper un hotspot ouvre la même modale construire/collecter/
 * améliorer que le reste du jeu.
 *
 * Note : l'image est statique — les bâtiments ne grandissent pas. La
 * progression se lit via les marqueurs superposés (niveau, halo, revenu prêt).
 */

import { Lock, Plus, Coins } from 'lucide-react'
import { useGameStore } from '../store/gameStore'
import { getCatalogItem } from '../data/investments'
import { formatEuroCompact } from '../utils/formatting'
import type { InvestmentCategory } from '../types'
import { type DistrictId } from './LivingCity'
import cityImg from './assets/metropolis.jpg'

// ─── Hotspots ─────────────────────────────────────────────────────────────────

export interface Hotspot {
  id: string
  catalogId: InvestmentCategory
  slotIndex: number
  district: DistrictId
  x: number   // % largeur image
  y: number   // % hauteur image
}

// Positions calibrées sur src/beta/assets/metropolis.jpg
export const HOTSPOTS: Hotspot[] = [
  // ── Bâtiments visibles (construits d'aspect) ──
  { id: 'h-bourse',  catalogId: 'bourse_etf',        slotIndex: 0, district: 'finance',    x: 22, y: 8  }, // tours de verre
  { id: 'h-struct',  catalogId: 'produit_structure', slotIndex: 0, district: 'finance',    x: 35, y: 9  }, // immeuble moderne
  { id: 'h-oblig',   catalogId: 'obligations_etat',  slotIndex: 0, district: 'finance',    x: 22, y: 21 }, // banque à colonnes
  { id: 'h-immoA',   catalogId: 'immo_classique',    slotIndex: 0, district: 'immobilier', x: 73, y: 9  }, // résidence brique
  { id: 'h-lmnpA',   catalogId: 'lmnp',              slotIndex: 0, district: 'immobilier', x: 88, y: 10 }, // résidence droite
  { id: 'h-immoB',   catalogId: 'immo_classique',    slotIndex: 1, district: 'immobilier', x: 60, y: 22 }, // résidences centre
  { id: 'h-parkA',   catalogId: 'parking',           slotIndex: 0, district: 'immobilier', x: 30, y: 31 }, // parking voitures
  { id: 'h-crowd',   catalogId: 'crowdfunding_immo', slotIndex: 0, district: 'industrie',  x: 20, y: 43 }, // entrepôt + camions
  { id: 'h-business',catalogId: 'business',          slotIndex: 0, district: 'industrie',  x: 52, y: 38 }, // tour HUB centrale
  { id: 'h-lmnpB',   catalogId: 'lmnp',              slotIndex: 1, district: 'immobilier', x: 40, y: 55 }, // centre commercial
  { id: 'h-parkB',   catalogId: 'parking',           slotIndex: 1, district: 'immobilier', x: 43, y: 62 }, // parking centre
  { id: 'h-scpi',    catalogId: 'scpi',              slotIndex: 0, district: 'immobilier', x: 67, y: 78 }, // petit bâtiment classique
  { id: 'h-or',      catalogId: 'or_metaux',         slotIndex: 0, district: 'epargne',    x: 17, y: 85 }, // port / conteneurs

  // ── Parcelles cadenassées / à bâtir (alignées sur les lots verts) ──
  { id: 'h-livret',  catalogId: 'livret',            slotIndex: 0, district: 'epargne',    x: 52, y: 6  },
  { id: 'h-crypto',  catalogId: 'crypto',            slotIndex: 0, district: 'crypto',     x: 46, y: 27 },
  { id: 'h-club',    catalogId: 'club_deal_immo',    slotIndex: 0, district: 'immobilier', x: 92, y: 35 },
  { id: 'h-immoC',   catalogId: 'immo_classique',    slotIndex: 2, district: 'immobilier', x: 79, y: 50 },
  { id: 'h-parkC',   catalogId: 'parking',           slotIndex: 2, district: 'immobilier', x: 58, y: 66 },
  { id: 'h-assur',   catalogId: 'assurance_vie',     slotIndex: 0, district: 'epargne',    x: 38, y: 79 },
]

// ─── Marqueur ─────────────────────────────────────────────────────────────────

function HotspotMarker({
  hotspot, netWorth, isSelected, onTap,
}: {
  hotspot: Hotspot; netWorth: number; isSelected: boolean; onTap: () => void
}) {
  const game = useGameStore(s => s.game)!
  const item = getCatalogItem(hotspot.catalogId)
  const inv = game.investments.filter(i => i.catalogId === hotspot.catalogId)[hotspot.slotIndex] ?? null
  const unlocked = netWorth >= item.unlockThreshold
  const pending = inv?.pendingRevenue ?? 0
  const isReady = pending > 0
  const level = inv?.level ?? 1

  return (
    <button
      onClick={onTap}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%`, zIndex: isSelected ? 40 : isReady ? 30 : 10 }}
    >
      {/* Badge revenu prêt */}
      {isReady && (
        <div
          className="mb-0.5 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-black"
          style={{
            background: '#fbbf24', color: '#431407', fontSize: 9,
            boxShadow: '0 2px 8px rgba(251,191,36,0.7)',
            animation: 'badgeBob 1.8s ease-in-out infinite',
          }}
        >
          <Coins size={8} /> +{formatEuroCompact(pending)}
        </div>
      )}

      {/* Pastille principale */}
      <div
        className="rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
        style={{
          width: inv ? 34 : 30,
          height: inv ? 34 : 30,
          background: inv
            ? `radial-gradient(circle at 35% 30%, ${item.color}dd, ${item.color}88)`
            : unlocked
            ? 'rgba(15,23,42,0.7)'
            : 'rgba(15,23,42,0.78)',
          border: isSelected
            ? `2.5px solid #fff`
            : isReady
            ? '2.5px solid #fbbf24'
            : inv
            ? `2px solid ${item.color}`
            : unlocked
            ? `2px solid ${item.color}aa`
            : '2px solid rgba(148,163,184,0.6)',
          boxShadow: isSelected
            ? `0 0 0 4px ${item.color}55, 0 2px 12px rgba(0,0,0,0.6)`
            : isReady
            ? '0 0 14px rgba(251,191,36,0.6), 0 2px 8px rgba(0,0,0,0.5)'
            : inv
            ? `0 0 10px ${item.color}66, 0 2px 8px rgba(0,0,0,0.5)`
            : '0 2px 8px rgba(0,0,0,0.5)',
        }}
      >
        {inv
          ? <span className="font-black text-white" style={{ fontSize: 13, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{level}</span>
          : unlocked
          ? <Plus size={15} style={{ color: item.color }} strokeWidth={3} />
          : <Lock size={12} className="text-slate-300" />
        }
      </div>

      {/* Anneau de pulsation si revenu prêt */}
      {isReady && (
        <div className="absolute top-0 mt-[14px] w-[34px] h-[34px] rounded-full pointer-events-none"
          style={{ animation: 'pulseRing 1.8s ease-out infinite' }} />
      )}
    </button>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function CityImageMap({
  netWorth, selectedId, onSelect,
}: {
  netWorth: number
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="absolute inset-0 overflow-auto hide-scrollbar" style={{ background: '#0a1424' }}>
      <div className="relative w-full">
        {/* Fond ville */}
        <img src={cityImg} alt="Ma métropole" className="w-full block select-none" draggable={false} />

        {/* Hotspots */}
        {HOTSPOTS.map(h => (
          <HotspotMarker
            key={h.id}
            hotspot={h}
            netWorth={netWorth}
            isSelected={selectedId === h.id}
            onTap={() => onSelect(h.id)}
          />
        ))}
      </div>
    </div>
  )
}
