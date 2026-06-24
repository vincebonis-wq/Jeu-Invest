/**
 * LivingCity — métropole isométrique vivante (SVG procédural).
 *
 * Chaque actif financier = une parcelle sur UNE seule grande ville.
 * Les bâtiments grandissent physiquement (niveau visuel 1→20) selon la
 * valeur investie et le niveau d'amélioration. L'architecture et la couleur
 * dépendent du district :
 *
 *   🏦 Finance     — tours de verre élancées (bleu)
 *   🏠 Immobilier  — résidences & parkings qui se densifient (ambre)
 *   🏭 Industrie   — usines & logistique (violet)
 *   🛡️ Épargne     — banques classiques à colonnes (vert)
 *   ⚡ Crypto      — datacenter néon (rose)
 *
 * Tout est dessiné en SVG : pas d'assets externes requis. Le rendu est un
 * isométrique « flat design » net et intemporel.
 */

import { useGameStore } from '../store/gameStore'
import { getCatalogItem } from '../data/investments'
import { formatEuroCompact } from '../utils/formatting'
import type { InvestmentCategory } from '../types'

// ─── Géométrie iso ────────────────────────────────────────────────────────────

const TW = 32          // demi-largeur de tuile
const TH = 16          // demi-hauteur de tuile
const SPREAD = 1.5     // espacement entre parcelles (>1 = plus aéré, des « rues » apparaissent)

function isoPos(col: number, row: number) {
  // Les bâtiments gardent leur taille (basée sur TW), mais on écarte les
  // positions → la ville respire et chaque parcelle se détache.
  return { x: (col - row) * TW * SPREAD, y: (col + row) * TH * SPREAD }
}

// ─── Districts ────────────────────────────────────────────────────────────────

export type DistrictId = 'finance' | 'immobilier' | 'industrie' | 'epargne' | 'crypto'

export interface DistrictDef {
  id: DistrictId
  label: string
  short: string
  emoji: string
  hex: string
}

export const DISTRICTS: Record<DistrictId, DistrictDef> = {
  finance:    { id: 'finance',    label: 'Quartier Financier', short: 'Finance',    emoji: '🏦', hex: '#3b82f6' },
  immobilier: { id: 'immobilier', label: 'Zone Immobilière',   short: 'Immobilier', emoji: '🏠', hex: '#f59e0b' },
  industrie:  { id: 'industrie',  label: 'Pôle Industriel',    short: 'Industrie',  emoji: '🏭', hex: '#a855f7' },
  epargne:    { id: 'epargne',    label: "Village d'Épargne",  short: 'Épargne',    emoji: '🛡️', hex: '#22c55e' },
  crypto:     { id: 'crypto',     label: 'Cyber District',     short: 'Crypto',     emoji: '⚡', hex: '#ec4899' },
}

// ─── Archétypes de bâtiment ───────────────────────────────────────────────────

type Archetype = 'tower' | 'classical' | 'residential' | 'industrial' | 'datacenter'

interface ArchConfig {
  baseH: number       // hauteur de base (px iso)
  stepH: number       // gain de hauteur par niveau visuel
  fwFactor: number    // largeur d'emprise (× TW)
  maxFloors: number   // nb max d'étages de fenêtres
}

const ARCH: Record<Archetype, ArchConfig> = {
  tower:       { baseH: 20, stepH: 3.6, fwFactor: 0.60, maxFloors: 14 },
  classical:   { baseH: 22, stepH: 2.0, fwFactor: 0.84, maxFloors: 4  },
  residential: { baseH: 16, stepH: 2.6, fwFactor: 0.72, maxFloors: 9  },
  industrial:  { baseH: 14, stepH: 1.6, fwFactor: 0.90, maxFloors: 3  },
  datacenter:  { baseH: 18, stepH: 3.0, fwFactor: 0.68, maxFloors: 7  },
}

const CATEGORY_ARCH: Record<InvestmentCategory, Archetype> = {
  // Finance — tours
  bourse_etf:        'tower',
  produit_structure: 'tower',
  obligations_etat:  'classical',
  // Épargne — banques classiques
  livret:            'classical',
  assurance_vie:     'classical',
  or_metaux:         'classical',
  // Immobilier — résidences / parking
  immo_classique:    'residential',
  lmnp:              'residential',
  scpi:              'residential',
  club_deal_immo:    'tower',
  parking:           'industrial',
  crowdfunding_immo: 'residential',
  // Industrie
  business:          'industrial',
  // Crypto
  crypto:            'datacenter',
}

// ─── Parcelles (une seule métropole) ──────────────────────────────────────────

export interface Parcel {
  id: string
  catalogId: InvestmentCategory
  slotIndex: number       // 0 pour actif unique, 0..2 pour immobilier (max 3)
  district: DistrictId
  col: number
  row: number
}

// Layout pensé comme UNE ville connectée. Districts = régions contiguës.
// (col-row) = axe X, (col+row) = axe Y. (0,0) en haut.
export const PARCELS: Parcel[] = [
  // 🏦 FINANCE — haut gauche
  { id: 'fin-bourse',  catalogId: 'bourse_etf',        slotIndex: 0, district: 'finance', col: 2, row: 0 },
  { id: 'fin-oblig',   catalogId: 'obligations_etat',  slotIndex: 0, district: 'finance', col: 3, row: 0 },
  { id: 'fin-struct',  catalogId: 'produit_structure', slotIndex: 0, district: 'finance', col: 3, row: 1 },

  // ⚡ CRYPTO — haut droite
  { id: 'cry-btc',     catalogId: 'crypto',            slotIndex: 0, district: 'crypto',  col: 4, row: 0 },

  // 🛡️ ÉPARGNE — droite
  { id: 'epa-assur',   catalogId: 'assurance_vie',     slotIndex: 0, district: 'epargne', col: 4, row: 1 },
  { id: 'epa-livret',  catalogId: 'livret',            slotIndex: 0, district: 'epargne', col: 4, row: 2 },
  { id: 'epa-or',      catalogId: 'or_metaux',         slotIndex: 0, district: 'epargne', col: 3, row: 2 },

  // 🏭 INDUSTRIE — centre
  { id: 'ind-biz',     catalogId: 'business',          slotIndex: 0, district: 'industrie', col: 2, row: 1 },
  { id: 'ind-crowd',   catalogId: 'crowdfunding_immo', slotIndex: 0, district: 'industrie', col: 1, row: 1 },

  // 🏠 IMMOBILIER — bas (le plus dense, se densifie en investissant)
  { id: 'imm-scpi',    catalogId: 'scpi',              slotIndex: 0, district: 'immobilier', col: 2, row: 2 },
  { id: 'imm-classA',  catalogId: 'immo_classique',    slotIndex: 0, district: 'immobilier', col: 1, row: 2 },
  { id: 'imm-classB',  catalogId: 'immo_classique',    slotIndex: 1, district: 'immobilier', col: 0, row: 2 },
  { id: 'imm-classC',  catalogId: 'immo_classique',    slotIndex: 2, district: 'immobilier', col: 1, row: 3 },
  { id: 'imm-lmnpA',   catalogId: 'lmnp',              slotIndex: 0, district: 'immobilier', col: 2, row: 3 },
  { id: 'imm-lmnpB',   catalogId: 'lmnp',              slotIndex: 1, district: 'immobilier', col: 3, row: 3 },
  { id: 'imm-parkA',   catalogId: 'parking',           slotIndex: 0, district: 'immobilier', col: 0, row: 3 },
  { id: 'imm-parkB',   catalogId: 'parking',           slotIndex: 1, district: 'immobilier', col: 2, row: 4 },
  { id: 'imm-club',    catalogId: 'club_deal_immo',    slotIndex: 0, district: 'immobilier', col: 1, row: 4 },
]

// ─── Couleur : éclaircir / assombrir un hex ───────────────────────────────────

function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16)
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const t = pct < 0 ? 0 : 255
  const p = Math.abs(pct)
  r = Math.round(r + (t - r) * p)
  g = Math.round(g + (t - g) * p)
  b = Math.round(b + (t - b) * p)
  return `rgb(${r},${g},${b})`
}

// ─── Niveau visuel 1→20 ───────────────────────────────────────────────────────

export function getVisualLevel(currentValue: number, upgradeLevel: number, minAmount: number): number {
  const ratio = currentValue / Math.max(1, minAmount)
  const valLvl = Math.log10(Math.max(1, ratio)) * 4.2   // chaque ×10 → +4,2
  const upLvl = (upgradeLevel - 1) * 2.2                 // chaque upgrade → +2,2
  return Math.max(1, Math.min(20, Math.round(1 + valLvl + upLvl)))
}

// ─── Bâtiment isométrique (SVG) ───────────────────────────────────────────────

function IsoBuilding({
  cx, cy, color, archetype, visualLevel,
}: {
  cx: number; cy: number; color: string; archetype: Archetype; visualLevel: number
}) {
  const cfg = ARCH[archetype]
  const fw = TW * cfg.fwFactor
  const fh = TH * cfg.fwFactor
  const h = cfg.baseH + (visualLevel - 1) * cfg.stepH
  const roofY = cy - h

  // Sommets du toit
  const rTop = `${cx},${roofY - fh}`
  const rRight = `${cx + fw},${roofY}`
  const rBottom = `${cx},${roofY + fh}`
  const rLeft = `${cx - fw},${roofY}`
  // Sommets de la base (sol)
  const bRight = `${cx + fw},${cy}`
  const bBottom = `${cx},${cy + fh}`
  const bLeft = `${cx - fw},${cy}`

  const roofCol = shade(color, 0.35)
  const leftCol = color
  const rightCol = shade(color, -0.32)

  // Étages (lignes de fenêtres) sur les deux murs avant
  const floors = Math.min(cfg.maxFloors, Math.max(1, Math.round(h / 11)))
  const floorLines: React.ReactNode[] = []
  for (let f = 1; f <= floors; f++) {
    const fy = roofY + (h * f) / (floors + 1)
    // ligne sur mur gauche : de (cx-fw, fy) à (cx, fy+fh)
    floorLines.push(
      <line key={`l${f}`} x1={cx - fw} y1={fy} x2={cx} y2={fy + fh}
        stroke={shade(color, -0.5)} strokeWidth="0.6" opacity="0.5" />,
    )
    // ligne sur mur droit : de (cx, fy+fh) à (cx+fw, fy)
    floorLines.push(
      <line key={`r${f}`} x1={cx} y1={fy + fh} x2={cx + fw} y2={fy}
        stroke={shade(color, -0.5)} strokeWidth="0.6" opacity="0.5" />,
    )
  }

  // Fenêtres éclairées (quelques points lumineux selon le niveau)
  const litWindows: React.ReactNode[] = []
  const litCount = Math.min(10, Math.round(visualLevel * 0.8))
  for (let i = 0; i < litCount; i++) {
    const f = 1 + (i % floors)
    const fy = roofY + (h * f) / (floors + 1)
    const side = i % 2 === 0 ? -1 : 1
    const t = 0.3 + ((i * 0.37) % 0.4)
    const wx = cx + side * fw * t
    const wy = side < 0 ? fy + fh * (1 - t) : fy + fh * t
    litWindows.push(
      <circle key={`w${i}`} cx={wx} cy={wy} r="1.1" fill="#fde68a" opacity="0.9" />,
    )
  }

  // Topper selon l'archétype
  let topper: React.ReactNode = null
  if (archetype === 'tower' && visualLevel >= 4) {
    const antH = 6 + visualLevel * 0.6
    topper = (
      <>
        <line x1={cx} y1={roofY - fh} x2={cx} y2={roofY - fh - antH}
          stroke={shade(color, 0.5)} strokeWidth="1" />
        <circle cx={cx} cy={roofY - fh - antH} r="1.6" fill="#ef4444">
          <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite" />
        </circle>
      </>
    )
  } else if (archetype === 'classical') {
    // Petit dôme / fronton
    topper = (
      <ellipse cx={cx} cy={roofY - fh * 0.2} rx={fw * 0.45} ry={fh * 0.7}
        fill={shade(color, 0.5)} />
    )
  } else if (archetype === 'datacenter' && visualLevel >= 3) {
    // Antenne satellite néon
    topper = (
      <>
        <line x1={cx} y1={roofY - fh} x2={cx + 5} y2={roofY - fh - 8}
          stroke="#ec4899" strokeWidth="1.2" />
        <circle cx={cx + 5} cy={roofY - fh - 8} r="2.2" fill="none"
          stroke="#f472b6" strokeWidth="1">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
        </circle>
      </>
    )
  } else if (archetype === 'industrial') {
    // Cheminée
    topper = (
      <rect x={cx + fw * 0.2} y={roofY - fh - 6} width="3.5" height="8"
        fill={shade(color, -0.2)} />
    )
  }

  return (
    <g>
      {/* Ombre portée au sol */}
      <ellipse cx={cx + 4} cy={cy + fh * 0.6} rx={fw * 1.05} ry={fh * 0.85}
        fill="#000" opacity="0.28" />
      {/* Mur gauche */}
      <polygon points={`${rLeft} ${rBottom} ${bBottom} ${bLeft}`} fill={leftCol} />
      {/* Mur droit */}
      <polygon points={`${rBottom} ${rRight} ${bRight} ${bBottom}`} fill={rightCol} />
      {/* Toit */}
      <polygon points={`${rTop} ${rRight} ${rBottom} ${rLeft}`} fill={roofCol}
        stroke={shade(color, 0.15)} strokeWidth="0.5" />
      {floorLines}
      {litWindows}
      {topper}
    </g>
  )
}

// ─── Parcelle (sol + bâtiment + interactions) ─────────────────────────────────

function ParcelNode({
  parcel, netWorth, isSelected, onTap,
}: {
  parcel: Parcel; netWorth: number; isSelected: boolean; onTap: () => void
}) {
  const game = useGameStore(s => s.game)!
  const item = getCatalogItem(parcel.catalogId)
  const inv = game.investments.filter(i => i.catalogId === parcel.catalogId)[parcel.slotIndex] ?? null
  const unlocked = netWorth >= item.unlockThreshold
  const district = DISTRICTS[parcel.district]
  const { x, y } = isoPos(parcel.col, parcel.row)
  const archetype = CATEGORY_ARCH[parcel.catalogId]

  const pending = inv?.pendingRevenue ?? 0
  const isReady = pending > 0
  const visualLevel = inv
    ? getVisualLevel(inv.currentValue, inv.level ?? 1, item.minAmount)
    : 0

  // Tuile de sol (diamant), teintée par district
  const tileTop = `${x},${y - TH}`
  const tileRight = `${x + TW},${y}`
  const tileBottom = `${x},${y + TH}`
  const tileLeft = `${x - TW},${y}`
  const tilePts = `${tileTop} ${tileRight} ${tileBottom} ${tileLeft}`

  return (
    <g
      onClick={onTap}
      style={{ cursor: 'pointer' }}
      className="parcel-node"
    >
      {/* Sol */}
      <polygon
        points={tilePts}
        fill={inv ? `${district.hex}22` : unlocked ? `${district.hex}12` : 'rgba(15,23,42,0.6)'}
        stroke={isSelected ? district.hex : `${district.hex}40`}
        strokeWidth={isSelected ? 2 : 0.8}
      />

      {/* Anneau de collecte (pulse) */}
      {isReady && (
        <polygon points={tilePts} fill="none" stroke="#fbbf24" strokeWidth="2"
          className="collect-pulse" style={{ transformOrigin: `${x}px ${y}px` }} />
      )}

      {/* Bâtiment ou plot vide */}
      {inv ? (
        <IsoBuilding cx={x} cy={y} color={item.color} archetype={archetype} visualLevel={visualLevel} />
      ) : unlocked ? (
        // Plot constructible
        <g>
          <polygon points={tilePts} fill="none" stroke={district.hex} strokeWidth="1"
            strokeDasharray="3 3" opacity="0.7" />
          <text x={x} y={y + 4} textAnchor="middle" fill={district.hex} fontSize="14"
            fontWeight="700" opacity="0.8">+</text>
        </g>
      ) : (
        // Plot verrouillé
        <g>
          <text x={x} y={y + 1} textAnchor="middle" fontSize="11" opacity="0.6">🔒</text>
          <text x={x} y={y + 11} textAnchor="middle" fill="#64748b" fontSize="6"
            fontWeight="700">{formatEuroCompact(item.unlockThreshold)}</text>
        </g>
      )}

      {/* Badge de revenu à collecter */}
      {isReady && (
        <g className="revenue-badge" style={{ transformOrigin: `${x}px ${y}px` }}>
          <rect x={x - 16} y={y - 56} width="32" height="13" rx="6.5" fill="#fbbf24" />
          <text x={x} y={y - 46.5} textAnchor="middle" fill="#431407" fontSize="7.5"
            fontWeight="800">+{formatEuroCompact(pending)}</text>
        </g>
      )}

      {/* Pastille de niveau */}
      {inv && (
        <g>
          <circle cx={x + TW * 0.5} cy={y + 2} r="6" fill={item.color}
            stroke="#000" strokeWidth="0.5" />
          <text x={x + TW * 0.5} y={y + 4.5} textAnchor="middle" fill="#000"
            fontSize="7" fontWeight="800">{visualLevel}</text>
        </g>
      )}
    </g>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function LivingCity({
  netWorth, selectedId, onSelect,
}: {
  netWorth: number
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  // Tri par profondeur : on dessine du fond (col+row petit) vers l'avant.
  const sorted = [...PARCELS].sort((a, b) => (a.col + a.row) - (b.col + b.row))

  // Centres de district (pour les étiquettes)
  const districtCenters = (Object.keys(DISTRICTS) as DistrictId[]).map(id => {
    const ps = PARCELS.filter(p => p.district === id)
    const avgCol = ps.reduce((s, p) => s + p.col, 0) / ps.length
    const avgRow = ps.reduce((s, p) => s + p.row, 0) / ps.length
    const { x, y } = isoPos(avgCol, avgRow)
    return { ...DISTRICTS[id], x, y }
  })

  return (
    <svg
      className="w-full h-full"
      viewBox="-220 -85 440 258"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="citysky" cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#0f1f3d" />
          <stop offset="100%" stopColor="#060c1a" />
        </radialGradient>
      </defs>

      {/* Ciel / fond */}
      <rect x="-220" y="-85" width="440" height="258" fill="url(#citysky)" />

      {/* Étiquettes de district (sous la ville) */}
      {districtCenters.map(d => (
        <text key={d.id} x={d.x} y={d.y - TH - 6} textAnchor="middle"
          fill={d.hex} fontSize="7" fontWeight="800" opacity="0.5"
          letterSpacing="0.5" style={{ pointerEvents: 'none' }}>
          {d.emoji} {d.short.toUpperCase()}
        </text>
      ))}

      {/* Parcelles */}
      {sorted.map(parcel => (
        <ParcelNode
          key={parcel.id}
          parcel={parcel}
          netWorth={netWorth}
          isSelected={selectedId === parcel.id}
          onTap={() => onSelect(parcel.id)}
        />
      ))}
    </svg>
  )
}
