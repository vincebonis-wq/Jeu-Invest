/**
 * CityMapView — Empire Tycoon MMO
 *
 * Boucle principale : investir → collecter → débloquer → construire → rivaliser
 *
 * Onglets :
 *   🗺️  VILLE     — carte iso avec bâtiments et collecte
 *   🏆  CLASSEMENT — ranking parmi 1 200+ joueurs simulés
 *   📰  MARCHÉ    — événements économiques mondiaux
 */

import { useState, useEffect, useMemo } from 'react'
import {
  Lock, Plus, ArrowUpCircle, Clock, X, ChevronRight,
  Hammer, Coins, Sparkles, TrendingUp, TrendingDown,
  Trophy, Globe, MapPin, Zap, Building2,
} from 'lucide-react'
import { useGameStore } from '../store/gameStore'
import { calcNetWorth } from '../utils/calculations'
import { getCatalogItem } from '../data/investments'
import {
  getInvestmentLevelBonus, getUpgradeCost, TIER_LABELS, LEVEL_LABELS,
} from '../data/upgradeTiers'
import { formatEuroCompact } from '../utils/formatting'
import type { InvestmentCategory } from '../types'
import { Icon } from '../components/ui/Icon'
import { BetaShell, useDrawer } from './BetaShell'
import { getBuildingSprite } from './buildingSprites'

// ─── Empire tiers ─────────────────────────────────────────────────────────────

const EMPIRE_TIERS = [
  { min: 0,           label: 'Débutant',    badge: '🏚️', color: '#64748b' },
  { min: 10_000,      label: 'Épargnant',   badge: '🏘️', color: '#10b981' },
  { min: 50_000,      label: 'Investisseur', badge: '🏢', color: '#38bdf8' },
  { min: 200_000,     label: 'Manager',     badge: '🏛️', color: '#8b5cf6' },
  { min: 500_000,     label: 'Directeur',   badge: '🏙️', color: '#f59e0b' },
  { min: 1_000_000,   label: 'Magnat',      badge: '🌆', color: '#f97316' },
  { min: 5_000_000,   label: 'Tycoon',      badge: '🌃', color: '#ef4444' },
  { min: 20_000_000,  label: 'Oligarque',   badge: '🌇', color: '#eab308' },
] as const

function getEmpireTier(netWorth: number) {
  let idx = 0
  for (let i = 0; i < EMPIRE_TIERS.length; i++) {
    if (netWorth >= EMPIRE_TIERS[i].min) idx = i
  }
  const tier = EMPIRE_TIERS[idx]
  const next = EMPIRE_TIERS[idx + 1]
  const progress = next ? (netWorth - tier.min) / (next.min - tier.min) : 1
  return { tier, next, progress, idx }
}

// ─── World events ─────────────────────────────────────────────────────────────

const WORLD_EVENTS = [
  { id: 1,  emoji: '📈', cat: 'Marchés',    impact: +0.8,  text: 'Le CAC 40 franchit un nouveau record historique' },
  { id: 2,  emoji: '🏦', cat: 'Taux',       impact: -0.3,  text: 'La BCE maintient ses taux directeurs à 3,5%' },
  { id: 3,  emoji: '🏠', cat: 'Immobilier', impact: +0.5,  text: "L'immobilier parisien progresse de +1,8% au T3" },
  { id: 4,  emoji: '⚡', cat: 'Crypto',     impact: +2.1,  text: 'Le Bitcoin dépasse 72 000 $ pour la première fois depuis 2 ans' },
  { id: 5,  emoji: '📉', cat: 'Marchés',    impact: -1.2,  text: "Sell-off technologique : -4% sur le Nasdaq cette semaine" },
  { id: 6,  emoji: '🏗️', cat: 'Immo',       impact: +0.4,  text: 'Hausse des permis de construire : +12% sur un an' },
  { id: 7,  emoji: '🌍', cat: 'Géo',        impact: -0.6,  text: 'Tensions géopolitiques : les investisseurs fuient vers l\'or' },
  { id: 8,  emoji: '💰', cat: 'Épargne',    impact: +0.2,  text: 'Le Livret A reste plafonné à 3% — rentrée record des dépôts' },
  { id: 9,  emoji: '🚀', cat: 'Startups',   impact: +1.5,  text: "Boom du crowdfunding : +38% de projets financés en 2025" },
  { id: 10, emoji: '🛢️', cat: 'Énergie',    impact: -0.9,  text: "Le pétrole chute sous 70$ — impact sur les fonds diversifiés" },
  { id: 11, emoji: '💎', cat: 'Alternatif', impact: +0.7,  text: "L'or atteint 2 450$/oz — valeur refuge en hausse" },
  { id: 12, emoji: '🏭', cat: 'Business',   impact: +0.3,  text: "Les PME françaises affichent une rentabilité record en 2025" },
  { id: 13, emoji: '📊', cat: 'SCPI',       impact: +0.6,  text: "Les SCPI de bureaux se redressent après 18 mois de baisse" },
  { id: 14, emoji: '🌿', cat: 'ESG',        impact: +0.4,  text: "Fonds verts : collecte record de 12 Md€ sur le trimestre" },
  { id: 15, emoji: '⚖️', cat: 'Fiscal',     impact: -0.2,  text: "Projet de loi : possible hausse de la flat tax à 32%" },
]

// ─── Leaderboard NPC data ─────────────────────────────────────────────────────

const NPC_PLAYERS = [
  { name: 'Alexandre D.', city: 'Empire Doré',     nw: 24_800_000 },
  { name: 'Marie-Claire B.',city: 'Cité des As',   nw: 18_200_000 },
  { name: 'Thomas R.',    city: 'Mont Capital',     nw: 12_500_000 },
  { name: 'Sophie L.',    city: 'Argent Vif',       nw:  9_400_000 },
  { name: 'Hugo M.',      city: 'Fortune City',     nw:  7_800_000 },
  { name: 'Emma P.',      city: 'Métropole Alpha',  nw:  6_200_000 },
  { name: 'Lucas B.',     city: 'Wealth Peak',      nw:  5_100_000 },
  { name: 'Chloé V.',     city: 'Cité Dorée',       nw:  4_300_000 },
  { name: 'Nathan G.',    city: 'Profit Island',    nw:  3_800_000 },
  { name: 'Inès F.',      city: 'Capital Sud',      nw:  3_200_000 },
  { name: 'Romain C.',    city: 'Grand Palais',     nw:  2_900_000 },
  { name: 'Lucie D.',     city: 'Silver Tower',     nw:  2_400_000 },
  { name: 'Maxime T.',    city: 'L\'Éclipse',       nw:  2_100_000 },
  { name: 'Sarah M.',     city: 'Aether Corp',      nw:  1_850_000 },
  { name: 'Julien K.',    city: 'Nexus Finance',    nw:  1_600_000 },
  { name: 'Camille H.',   city: 'Lumière Bleue',    nw:  1_400_000 },
  { name: 'Antoine S.',   city: 'Fortis Hub',       nw:  1_150_000 },
  { name: 'Manon L.',     city: 'Crescendo',        nw:    980_000 },
  { name: 'Théo J.',      city: 'Apex District',    nw:    820_000 },
  { name: 'Laura N.',     city: 'Riviera Invest',   nw:    720_000 },
  { name: 'Nicolas P.',   city: 'Horizon Tower',    nw:    650_000 },
  { name: 'Zoé R.',       city: 'Aurore City',      nw:    590_000 },
  { name: 'Pierre A.',    city: 'Vertex Corp',      nw:    520_000 },
  { name: 'Pauline V.',   city: 'Lyon Capital',     nw:    480_000 },
  { name: 'Kevin B.',     city: 'Marseille Invest', nw:    420_000 },
  { name: 'Clara F.',     city: 'Bordeaux Trade',   nw:    370_000 },
  { name: 'Alexis M.',    city: 'Nantes Finance',   nw:    330_000 },
  { name: 'Amandine T.',  city: 'Toulouse Hub',     nw:    280_000 },
  { name: 'Florian C.',   city: 'Rennes Capital',   nw:    240_000 },
  { name: 'Julie D.',     city: 'Strasbourg Eco',   nw:    210_000 },
  { name: 'Bastien R.',   city: 'Alpha Base',       nw:    185_000 },
  { name: 'Éléonore M.',  city: 'Gold Harbor',      nw:    160_000 },
  { name: 'Sébastien G.', city: 'Delta Corp',       nw:    140_000 },
  { name: 'Clémence L.',  city: 'Sigma Tower',      nw:    118_000 },
  { name: 'Adrien B.',    city: 'Beta City',        nw:     98_000 },
  { name: 'Océane P.',    city: 'First Steps',      nw:     82_000 },
  { name: 'Vincent H.',   city: 'Omega Start',      nw:     68_000 },
  { name: 'Mélanie C.',   city: 'Nouveau Départ',   nw:     55_000 },
  { name: 'Quentin D.',   city: 'Starter Pack',     nw:     44_000 },
  { name: 'Anaïs V.',     city: 'Petit Empire',     nw:     36_000 },
  { name: 'Mathieu R.',   city: 'Base Camp',        nw:     28_000 },
  { name: 'Carla T.',     city: 'In Progress',      nw:     21_000 },
  { name: 'Dylan F.',     city: 'Rookie Zone',      nw:     15_000 },
  { name: 'Margot S.',    city: 'Level Up',         nw:     11_000 },
  { name: 'Enzo B.',      city: 'Débutant Plus',    nw:      8_000 },
  { name: 'Coline M.',    city: 'Zéro à Un',        nw:      5_500 },
  { name: 'Raphaël D.',   city: 'Première Pierre',  nw:      3_200 },
  { name: 'Lou C.',       city: 'Just Started',     nw:      1_800 },
  { name: 'Titouan R.',   city: 'Day One',          nw:        900 },
  { name: 'Jade F.',      city: 'Fresh Start',      nw:        400 },
]

const TOTAL_PLAYERS = 1_247

// ─── Map layout ───────────────────────────────────────────────────────────────

type DistrictId = 'finance' | 'realestate' | 'business' | 'alternative' | 'savings'

interface District {
  id: DistrictId; label: string; short: string; emoji: string; hex: string
  // SVG polygon points on viewBox "0 0 380 420"
  poly: string
  // Label anchor
  lx: number; ly: number
}

const DISTRICTS: District[] = [
  {
    id: 'finance', label: 'Financial District', short: 'Finance', emoji: '📈', hex: '#38bdf8',
    poly: '170,12 285,72 170,132 55,72',
    lx: 170, ly: 52,
  },
  {
    id: 'realestate', label: 'Real Estate Quarter', short: 'Immobilier', emoji: '🏠', hex: '#fbbf24',
    poly: '315,22 378,67 315,112 252,67',
    lx: 315, ly: 52,
  },
  {
    id: 'business', label: 'Business Park', short: 'Business', emoji: '🏭', hex: '#a78bfa',
    poly: '190,138 355,220 190,302 25,220',
    lx: 190, ly: 198,
  },
  {
    id: 'alternative', label: 'Alternative Zone', short: 'Alternatif', emoji: '⚡', hex: '#fb923c',
    poly: '100,305 178,343 100,381 22,343',
    lx: 100, ly: 323,
  },
  {
    id: 'savings', label: 'Savings Village', short: 'Épargne', emoji: '🛡️', hex: '#34d399',
    poly: '285,305 363,343 285,381 207,343',
    lx: 285, ly: 323,
  },
]

interface MapSlot {
  id: string; catalogId: InvestmentCategory; slotIndex: number
  district: DistrictId; x: number; y: number // % of SVG viewBox
}

// Positions calibrées pour chaque emplacement sur le canvas 380×420
const MAP_SLOTS: MapSlot[] = [
  // Financial District
  { id: 'f1', catalogId: 'bourse_etf',        slotIndex: 0, district: 'finance',     x: 44.7, y: 14.0 },
  { id: 'f2', catalogId: 'scpi',              slotIndex: 0, district: 'finance',     x: 60.5, y: 10.0 },
  { id: 'f3', catalogId: 'obligations_etat',  slotIndex: 0, district: 'finance',     x: 44.7, y: 23.3 },
  { id: 'f4', catalogId: 'produit_structure', slotIndex: 0, district: 'finance',     x: 29.2, y: 17.1 },

  // Real Estate Quarter
  { id: 'r1', catalogId: 'immo_classique',    slotIndex: 0, district: 'realestate',  x: 79.7, y:  8.1 },
  { id: 'r2', catalogId: 'immo_classique',    slotIndex: 1, district: 'realestate',  x: 93.2, y: 14.3 },
  { id: 'r3', catalogId: 'lmnp',              slotIndex: 0, district: 'realestate',  x: 80.5, y: 20.7 },
  { id: 'r4', catalogId: 'parking',           slotIndex: 0, district: 'realestate',  x: 93.2, y: 24.3 },
  { id: 'r5', catalogId: 'club_deal_immo',    slotIndex: 0, district: 'realestate',  x: 71.1, y: 15.5 },

  // Business Park
  { id: 'b1', catalogId: 'business',          slotIndex: 0, district: 'business',    x: 38.2, y: 40.0 },
  { id: 'b2', catalogId: 'business',          slotIndex: 1, district: 'business',    x: 56.6, y: 37.1 },
  { id: 'b3', catalogId: 'crowdfunding_immo', slotIndex: 0, district: 'business',    x: 47.4, y: 49.0 },
  { id: 'b4', catalogId: 'crowdfunding_immo', slotIndex: 1, district: 'business',    x: 66.1, y: 46.0 },

  // Alternative Zone
  { id: 'a1', catalogId: 'crypto',            slotIndex: 0, district: 'alternative', x: 21.1, y: 72.1 },
  { id: 'a2', catalogId: 'crypto',            slotIndex: 1, district: 'alternative', x: 37.1, y: 77.1 },
  { id: 'a3', catalogId: 'or_metaux',         slotIndex: 0, district: 'alternative', x: 19.7, y: 82.4 },

  // Savings Village
  { id: 's1', catalogId: 'livret',            slotIndex: 0, district: 'savings',     x: 71.8, y: 72.4 },
  { id: 's2', catalogId: 'assurance_vie',     slotIndex: 0, district: 'savings',     x: 86.6, y: 76.2 },
  { id: 's3', catalogId: 'assurance_vie',     slotIndex: 1, district: 'savings',     x: 75.0, y: 83.3 },
  { id: 's4', catalogId: 'livret',            slotIndex: 1, district: 'savings',     x: 93.4, y: 79.3 },
]

type Tab = 'map' | 'rank' | 'events'

// ─── Root ─────────────────────────────────────────────────────────────────────

export function CityMapView() {
  const { drawerScreen, open, close } = useDrawer()
  const game = useGameStore(s => s.game)!
  const collectAll = useGameStore(s => s.collectAllRevenue)

  const [tab, setTab] = useState<Tab>('map')
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [collectFlash, setCollectFlash] = useState(false)

  const netWorth = calcNetWorth(game)
  const { tier, next, progress } = getEmpireTier(netWorth)

  const totalPending = game.investments.reduce((s, i) => s + (i.pendingRevenue ?? 0), 0)
  const readyCount   = game.investments.filter(i => (i.pendingRevenue ?? 0) > 0).length

  // Revenue per hour based on annual return rates
  const revenuePerHour = game.investments.reduce((s, i) => {
    return s + i.currentValue * i.annualReturnRate / 8760
  }, 0)

  // Leaderboard position
  const lbData = useMemo(() => {
    const all = [...NPC_PLAYERS, { name: 'Vous', city: 'Mon Empire', nw: netWorth, isMe: true }]
    all.sort((a, b) => b.nw - a.nw)
    const myRank = all.findIndex(p => 'isMe' in p) + 1
    return { all, myRank }
  }, [netWorth])

  function handleCollectAll() {
    const { total } = collectAll()
    if (total > 0) {
      setCollectFlash(true)
      setTimeout(() => setCollectFlash(false), 600)
    }
  }

  const selectedSlot = MAP_SLOTS.find(s => s.id === selectedSlotId) ?? null

  return (
    <BetaShell accent="#050b18" openScreen={open} drawerScreen={drawerScreen} onCloseDrawer={close}>
      <div className="h-full flex flex-col overflow-hidden" style={{ background: '#060d1e' }}>

        {/* ─── Empire HUD ─── */}
        <div
          className="shrink-0 px-4 pt-2.5 pb-1.5"
          style={{ background: 'rgba(6,13,30,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3">
            {/* Tier badge */}
            <div className="flex flex-col items-center shrink-0">
              <span style={{ fontSize: 26 }}>{tier.badge}</span>
              <span className="text-[9px] font-black uppercase tracking-widest"
                style={{ color: tier.color }}>{tier.label}</span>
            </div>

            {/* Progress + stats */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-extrabold text-sm">Mon Empire</span>
                <div className="flex items-center gap-2">
                  {/* Revenue/h */}
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}>
                    <Zap size={9} className="text-emerald-400" />
                    <span className="text-[10px] font-black text-emerald-400">
                      +{formatEuroCompact(revenuePerHour)}/h
                    </span>
                  </div>
                  {/* Rank */}
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}>
                    <Trophy size={9} className="text-amber-400" />
                    <span className="text-[10px] font-black text-amber-400">
                      #{lbData.myRank}
                    </span>
                  </div>
                </div>
              </div>
              {/* Progress bar to next tier */}
              {next && (
                <div>
                  <div className="relative h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, progress * 100).toFixed(1)}%`, background: tier.color }} />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[8px] text-slate-500">
                      {formatEuroCompact(netWorth)}
                    </span>
                    <span className="text-[8px] text-slate-500">
                      {next.label} → {formatEuroCompact(next.min)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Sub-tabs ─── */}
        <div className="shrink-0 flex" style={{ background: '#070e1c', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {([
            { id: 'map',    icon: MapPin,  label: 'VILLE'       },
            { id: 'rank',   icon: Trophy,  label: 'CLASSEMENT'  },
            { id: 'events', icon: Globe,   label: 'MARCHÉ'      },
          ] as const).map(({ id, icon: Icon2, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors relative"
              style={{ color: tab === id ? '#38bdf8' : '#475569' }}
            >
              <Icon2 size={13} />
              <span className="text-[10px] font-black tracking-wider">{label}</span>
              {tab === id && (
                <div className="absolute bottom-0 inset-x-4 h-0.5 rounded-full"
                  style={{ background: '#38bdf8' }} />
              )}
            </button>
          ))}
        </div>

        {/* ─── CARTE ─── */}
        {tab === 'map' && (
          <>
            {/* Collect banner */}
            {readyCount > 0 && (
              <button
                onClick={handleCollectAll}
                className="mx-3 mt-2 rounded-2xl flex items-center justify-between px-4 py-2.5 shrink-0 active:scale-98 transition-transform"
                style={{
                  background: collectFlash
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : 'linear-gradient(135deg, #fbbf24, #d97706)',
                  boxShadow: '0 4px 18px rgba(251,191,36,0.4)',
                  transition: 'background 0.3s',
                }}
              >
                <div className="flex items-center gap-2">
                  <Coins size={16} style={{ color: collectFlash ? '#fff' : '#78350f' }} />
                  <span className="font-extrabold text-sm" style={{ color: collectFlash ? '#fff' : '#431407' }}>
                    {collectFlash ? '✓ Collecté !' : `${readyCount} bâtiment${readyCount > 1 ? 's' : ''} prêt${readyCount > 1 ? 's' : ''}`}
                  </span>
                </div>
                {!collectFlash && (
                  <span className="font-black text-sm" style={{ color: '#431407' }}>
                    +{formatEuroCompact(totalPending)} →
                  </span>
                )}
              </button>
            )}

            {/* City canvas */}
            <div className="flex-1 min-h-0 relative mx-3 mt-2 mb-1 rounded-2xl overflow-hidden"
              style={{ background: '#060c1a' }}>
              <CityCanvas
                netWorth={netWorth}
                selectedId={selectedSlotId}
                onSelect={id => setSelectedSlotId(prev => prev === id ? null : id)}
              />
            </div>
          </>
        )}

        {/* ─── CLASSEMENT ─── */}
        {tab === 'rank' && (
          <LeaderboardView data={lbData} netWorth={netWorth} tier={tier} />
        )}

        {/* ─── MARCHÉ ─── */}
        {tab === 'events' && (
          <WorldEventsView />
        )}
      </div>

      {/* Building modal */}
      {selectedSlot && (
        <BuildingModal
          slot={selectedSlot}
          netWorth={netWorth}
          onClose={() => setSelectedSlotId(null)}
          onGotoPortfolio={() => { setSelectedSlotId(null); open('portfolio') }}
        />
      )}
    </BetaShell>
  )
}

// ─── City canvas ──────────────────────────────────────────────────────────────

function CityCanvas({
  netWorth, selectedId, onSelect,
}: {
  netWorth: number
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="relative w-full h-full">
      {/* SVG: district zones + roads */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 380 420"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background grid */}
        <defs>
          <pattern id="isogrid" width="44" height="25" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
            <line x1="0" y1="0" x2="0" y2="25" stroke="#0d1e35" strokeWidth="0.6"/>
            <line x1="0" y1="0" x2="44" y2="0" stroke="#0d1e35" strokeWidth="0.6"/>
          </pattern>
          {/* Glow filters per district */}
          {DISTRICTS.map(d => (
            <filter key={d.id} id={`glow-${d.id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          ))}
        </defs>

        <rect width="380" height="420" fill="url(#isogrid)" />

        {/* District polygons */}
        {DISTRICTS.map(d => (
          <g key={d.id}>
            {/* Zone fill */}
            <polygon
              points={d.poly}
              fill={`${d.hex}0e`}
              stroke={`${d.hex}45`}
              strokeWidth="1.5"
            />
            {/* Zone glow */}
            <polygon
              points={d.poly}
              fill="none"
              stroke={`${d.hex}25`}
              strokeWidth="6"
              filter={`url(#glow-${d.id})`}
            />
            {/* District label */}
            <text
              x={d.lx}
              y={d.ly}
              textAnchor="middle"
              fill={d.hex}
              fontSize="8"
              fontWeight="800"
              fontFamily="system-ui"
              opacity="0.75"
              letterSpacing="1"
            >
              {d.emoji} {d.short.toUpperCase()}
            </text>
          </g>
        ))}

        {/* Roads between zones */}
        <line x1="170" y1="132" x2="170" y2="138" stroke="#040a14" strokeWidth="14"/>
        <line x1="315" y1="112" x2="315" y2="138" stroke="#040a14" strokeWidth="14"/>
        <line x1="100" y1="302" x2="190" y2="302" stroke="#040a14" strokeWidth="14"/>
        <line x1="190" y1="302" x2="285" y2="302" stroke="#040a14" strokeWidth="14"/>
      </svg>

      {/* Buildings (absolutely positioned over SVG) */}
      {MAP_SLOTS.map(slot => (
        <BuildingPin
          key={slot.id}
          slot={slot}
          netWorth={netWorth}
          isSelected={selectedId === slot.id}
          onTap={() => onSelect(slot.id)}
        />
      ))}
    </div>
  )
}

// ─── Building pin ─────────────────────────────────────────────────────────────

function BuildingPin({
  slot, netWorth, isSelected, onTap,
}: {
  slot: MapSlot; netWorth: number; isSelected: boolean; onTap: () => void
}) {
  const game = useGameStore(s => s.game)!
  const item = getCatalogItem(slot.catalogId)
  const inv = game.investments.filter(i => i.catalogId === slot.catalogId)[slot.slotIndex] ?? null
  const unlocked = netWorth >= item.unlockThreshold
  const sprite = getBuildingSprite(slot.catalogId)
  const pending = inv?.pendingRevenue ?? 0
  const isReady = pending > 0
  const level = inv?.level ?? 1
  const district = DISTRICTS.find(d => d.id === slot.district)!

  // Building size grows with level
  const size = inv ? 48 + level * 6 : 40

  return (
    <button
      onClick={onTap}
      className="absolute flex flex-col items-center"
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isSelected ? 50 : isReady ? 30 : 10,
        border: 'none', background: 'none', padding: 0,
      }}
    >
      {/* Revenue badge */}
      {isReady && (
        <div
          className="mb-0.5 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-black shrink-0"
          style={{
            background: '#fbbf24',
            color: '#431407',
            fontSize: 7,
            boxShadow: '0 2px 10px rgba(251,191,36,0.6)',
            animation: 'floatBadge 1.8s ease-in-out infinite',
            lineHeight: 1.2,
          }}
        >
          <Coins size={6} />
          {formatEuroCompact(pending)}
        </div>
      )}

      {/* Building */}
      <div
        className="flex items-center justify-center rounded-xl relative transition-all duration-200"
        style={{
          width: size,
          height: size,
          background: inv
            ? `radial-gradient(circle at 30% 30%, ${item.color}40, ${item.color}10)`
            : 'rgba(255,255,255,0.03)',
          border: isSelected
            ? `2px solid ${inv ? item.color : district.hex}`
            : isReady
            ? `2px solid #fbbf24`
            : inv
            ? `1.5px solid ${item.color}60`
            : unlocked
            ? `1.5px dashed ${district.hex}35`
            : `1.5px dashed rgba(71,85,105,0.3)`,
          boxShadow: isSelected
            ? `0 0 0 3px ${inv ? item.color : district.hex}40, 0 0 24px ${inv ? item.color : district.hex}35`
            : isReady
            ? `0 0 14px rgba(251,191,36,0.5)`
            : inv
            ? `0 4px 12px ${item.color}25, 0 0 6px ${item.color}15`
            : 'none',
        }}
      >
        {inv ? (
          sprite ? (
            <img src={sprite} alt={item.name} draggable={false}
              className="object-contain p-1 w-full h-full"
              style={{
                filter: `drop-shadow(0 2px 6px ${item.color}88)`,
                animation: isReady ? 'floatBadge 2.5s ease-in-out infinite' : undefined,
              }}
            />
          ) : (
            <Icon name={item.icon} size={Math.round(size * 0.45)}
              style={{ color: item.color } as React.CSSProperties} />
          )
        ) : unlocked ? (
          <Plus size={14} style={{ color: district.hex, opacity: 0.45 }} />
        ) : (
          <Lock size={11} className="text-slate-700" />
        )}

        {/* Level badge */}
        {inv && (
          <div
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black shadow-lg"
            style={{ background: item.color, color: '#000', lineHeight: 1 }}
          >
            {level}
          </div>
        )}
      </div>

      {/* Pulse ring when ready */}
      {isReady && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ animation: 'pulseRing 1.8s ease-out infinite' }}
        />
      )}
    </button>
  )
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function LeaderboardView({
  data, netWorth, tier,
}: {
  data: ReturnType<typeof buildLeaderboard>
  netWorth: number
  tier: (typeof EMPIRE_TIERS)[number]
}) {
  const myRank = data.myRank
  const players = data.all

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header card */}
      <div className="mx-3 mt-3 mb-2 rounded-2xl p-4 shrink-0"
        style={{ background: `linear-gradient(135deg, ${tier.color}20, rgba(6,13,30,0.9))`, border: `1px solid ${tier.color}40` }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 36 }}>{tier.badge}</span>
          <div>
            <div className="text-white font-black text-lg leading-tight">Classement #{myRank}</div>
            <div className="text-slate-400 text-xs mt-0.5">
              sur {TOTAL_PLAYERS.toLocaleString('fr-FR')} joueurs actifs
            </div>
            <div className="text-xs font-bold mt-1" style={{ color: tier.color }}>
              {tier.label} · {formatEuroCompact(netWorth)}
            </div>
          </div>
        </div>
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-4">
        {players.map((p, i) => {
          const isMe = 'isMe' in p
          const rank = i + 1
          const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
          const isTier = getEmpireTier(p.nw)

          return (
            <div
              key={isMe ? 'me' : p.name + i}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5"
              style={{
                background: isMe
                  ? `linear-gradient(135deg, rgba(251,191,36,0.18), rgba(6,13,30,0.95))`
                  : 'rgba(255,255,255,0.03)',
                border: isMe ? '1.5px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {/* Rank */}
              <div className="w-7 text-center shrink-0">
                {rankEmoji ? (
                  <span style={{ fontSize: 16 }}>{rankEmoji}</span>
                ) : (
                  <span className="text-xs font-black" style={{ color: isMe ? '#fbbf24' : '#475569' }}>
                    #{rank}
                  </span>
                )}
              </div>

              {/* Tier badge */}
              <span style={{ fontSize: 18 }}>{isTier.tier.badge}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm leading-tight" style={{ color: isMe ? '#fbbf24' : '#e2e8f0' }}>
                  {p.name} {isMe && '(Vous)'}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <Building2 size={9} />
                  {'city' in p ? p.city : ''}
                </div>
              </div>

              {/* Net worth */}
              <div className="text-right shrink-0">
                <div className="font-black text-sm" style={{ color: isMe ? '#fbbf24' : '#94a3b8' }}>
                  {formatEuroCompact(p.nw)}
                </div>
                <div className="text-[9px] text-slate-600 mt-0.5">patrimoine</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Helper type for buildLeaderboard (needed by LeaderboardView)
type LBData = { all: (typeof NPC_PLAYERS[0] & { isMe?: boolean; city?: string })[]; myRank: number }

function buildLeaderboard(_nw: number): LBData { // unused, inlined in root
  return { all: [], myRank: 0 }
}

// ─── World events ─────────────────────────────────────────────────────────────

function WorldEventsView() {
  const [filter, setFilter] = useState<string | null>(null)

  const cats = [...new Set(WORLD_EVENTS.map(e => e.cat))]
  const filtered = filter ? WORLD_EVENTS.filter(e => e.cat === filter) : WORLD_EVENTS

  const positive = WORLD_EVENTS.filter(e => e.impact > 0).length
  const negative = WORLD_EVENTS.filter(e => e.impact < 0).length

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Summary bar */}
      <div className="mx-3 mt-3 mb-2 rounded-2xl p-3 shrink-0 grid grid-cols-3 gap-2"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="text-center">
          <div className="text-emerald-400 font-black text-lg leading-tight">{positive}</div>
          <div className="text-[9px] text-slate-500 font-semibold">Positifs</div>
        </div>
        <div className="text-center">
          <div className="text-rose-400 font-black text-lg leading-tight">{negative}</div>
          <div className="text-[9px] text-slate-500 font-semibold">Négatifs</div>
        </div>
        <div className="text-center">
          <div className="text-amber-400 font-black text-lg leading-tight">
            {WORLD_EVENTS.length}
          </div>
          <div className="text-[9px] text-slate-500 font-semibold">Événements</div>
        </div>
      </div>

      {/* Category filters */}
      <div className="px-3 mb-2 flex gap-1.5 overflow-x-auto hide-scrollbar shrink-0">
        <button
          onClick={() => setFilter(null)}
          className="px-3 py-1 rounded-full text-[10px] font-bold shrink-0 transition-all"
          style={{
            background: !filter ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.05)',
            color: !filter ? '#38bdf8' : '#64748b',
            border: !filter ? '1px solid rgba(56,189,248,0.35)' : '1px solid rgba(255,255,255,0.07)',
          }}
        >
          Tous
        </button>
        {cats.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(filter === cat ? null : cat)}
            className="px-3 py-1 rounded-full text-[10px] font-bold shrink-0 transition-all"
            style={{
              background: filter === cat ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)',
              color: filter === cat ? '#a78bfa' : '#64748b',
              border: filter === cat ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-4">
        {filtered.map(evt => (
          <div
            key={evt.id}
            className="flex items-start gap-3 rounded-2xl p-3.5 mb-2"
            style={{
              background: evt.impact > 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${evt.impact > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}
          >
            <span style={{ fontSize: 22 }}>{evt.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white font-semibold leading-snug">{evt.text}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                  {evt.cat}
                </span>
                <span className="text-[10px] font-black flex items-center gap-0.5"
                  style={{ color: evt.impact > 0 ? '#4ade80' : '#f87171' }}>
                  {evt.impact > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {evt.impact > 0 ? '+' : ''}{evt.impact.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Building modal ───────────────────────────────────────────────────────────

function BuildingModal({
  slot, netWorth, onClose, onGotoPortfolio,
}: {
  slot: MapSlot; netWorth: number; onClose: () => void; onGotoPortfolio: () => void
}) {
  const game = useGameStore(s => s.game)!
  const buyInvestment = useGameStore(s => s.buyInvestment)
  const upgradeInvestment = useGameStore(s => s.upgradeInvestment)
  const collectRevenue = useGameStore(s => s.collectRevenue)
  const cash = game.cashBalance

  const item = getCatalogItem(slot.catalogId)
  const inv = game.investments.filter(i => i.catalogId === slot.catalogId)[slot.slotIndex] ?? null
  const unlocked = netWorth >= item.unlockThreshold
  const sprite = getBuildingSprite(slot.catalogId)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [collected, setCollected] = useState(false)
  const [now, setNow] = useState(Date.now())

  const level = inv?.level ?? 1
  const isMax = level >= 5
  const isUpgrading = !!inv?.upgradeReadyAtReal && inv.upgradeReadyAtReal > now
  const targetLevel = level + 1
  const upgradeCost = isMax ? 0 : getUpgradeCost(item.minAmount, targetLevel)
  const isRealEstate = ['parking', 'lmnp', 'immo_classique', 'club_deal_immo'].includes(slot.catalogId)
  const pending = inv?.pendingRevenue ?? 0
  const district = DISTRICTS.find(d => d.id === slot.district)!

  const secsLeft = isUpgrading ? Math.max(0, Math.round((inv!.upgradeReadyAtReal! - now) / 1000)) : 0
  const timer = secsLeft > 3600
    ? `${Math.floor(secsLeft / 3600)}h${String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0')}`
    : secsLeft > 60 ? `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`
    : `${secsLeft}s`

  useEffect(() => {
    if (!isUpgrading) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [isUpgrading])

  const rate = inv
    ? inv.annualReturnRate + getInvestmentLevelBonus(slot.catalogId, level)
    : item.baseAnnualReturn

  function handleCollect() {
    if (!inv) return
    const { collected: amount } = collectRevenue(inv.instanceId)
    if (amount > 0) { setCollected(true); setTimeout(onClose, 1000) }
  }

  function handleBuild() {
    const r = buyInvestment(slot.catalogId, item.minAmount, false)
    if (r.success) onClose(); else setFeedback(r.message)
  }

  function handleUpgrade() {
    if (!inv) return
    const r = upgradeInvestment(inv.instanceId)
    setFeedback(r.message)
    if (r.success) setTimeout(onClose, 700)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative rounded-t-3xl pb-10"
        style={{
          background: `linear-gradient(165deg, ${item.color}1c 0%, #070e1c 55%)`,
          border: `1px solid ${item.color}30`,
          borderBottom: 'none',
          animation: 'slideUpPanel 0.2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3" />

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `${item.color}1a`, border: `1.5px solid ${item.color}45` }}>
            {sprite
              ? <img src={sprite} alt={item.name} className="w-full h-full object-contain p-1" draggable={false} />
              : <Icon name={item.icon} size={28} style={{ color: item.color } as React.CSSProperties} />
            }
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="text-[10px] font-black uppercase tracking-wider mb-0.5"
              style={{ color: district.hex }}>
              {district.emoji} {district.short}
            </div>
            <div className="font-black text-white text-base leading-tight">{item.name}</div>
            {inv && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-1.5 w-4 rounded-full"
                      style={{ background: i < level ? item.color : 'rgba(255,255,255,0.1)' }} />
                  ))}
                </div>
                <span className="text-[10px] font-bold" style={{ color: item.color }}>
                  {LEVEL_LABELS[level]}
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-slate-600 p-1 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Collect section (prominent when ready) */}
        {pending > 0 && (
          <div className="mx-5 mt-4">
            <button
              onClick={handleCollect}
              className="w-full py-4 rounded-2xl flex items-center justify-between px-5 active:scale-98 transition-transform"
              style={{
                background: collected
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : 'linear-gradient(135deg, #fbbf24, #d97706)',
                boxShadow: collected ? '0 6px 20px rgba(34,197,94,0.4)' : '0 6px 20px rgba(251,191,36,0.4)',
              }}
            >
              <div className="flex items-center gap-2">
                <Coins size={20} style={{ color: '#431407' }} />
                <div>
                  <div className="font-black text-sm" style={{ color: '#431407' }}>
                    {collected ? '✓ Encaissé !' : 'Revenus disponibles'}
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: '#78350f' }}>
                    {collected ? 'Retour à la carte…' : 'Tape pour collecter'}
                  </div>
                </div>
              </div>
              {!collected && (
                <div className="font-black text-2xl" style={{ color: '#431407' }}>
                  +{formatEuroCompact(pending)}
                </div>
              )}
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mx-5 mt-3">
          {inv ? (
            <>
              <StatPill label="Valeur" value={formatEuroCompact(inv.currentValue)} color={item.color} />
              <StatPill label="Rendement" value={`${(rate * 100).toFixed(1)}%`} color="#34d399" />
              {inv.monthlyIncome > 0
                ? <StatPill label="Revenu/mois" value={`+${formatEuroCompact(inv.monthlyIncome)}`} color="#fbbf24" />
                : <StatPill label="Niveau" value={`${level}/5`} color={item.color} />}
            </>
          ) : (
            <>
              <StatPill label="Investissement" value={formatEuroCompact(item.minAmount)} color={item.color} />
              <StatPill label="Rendement/an" value={`${(item.baseAnnualReturn * 100).toFixed(1)}%`} color="#34d399" />
              <StatPill label="Déblocage" value={formatEuroCompact(item.unlockThreshold)} color="#94a3b8" />
            </>
          )}
        </div>

        {/* Actions */}
        <div className="mx-5 mt-3 space-y-2">
          {!inv ? (
            !unlocked ? (
              <div className="w-full py-3.5 rounded-2xl text-center text-sm font-bold text-slate-500 flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Lock size={14} /> Débloquer à {formatEuroCompact(item.unlockThreshold)}
              </div>
            ) : isRealEstate ? (
              <button onClick={onGotoPortfolio}
                className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform"
                style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}99)`, boxShadow: `0 6px 20px ${item.color}35` }}>
                <Hammer size={16} /> Acheter · {formatEuroCompact(item.minAmount)}
                <ChevronRight size={14} className="opacity-70" />
              </button>
            ) : (
              <button onClick={handleBuild} disabled={cash < item.minAmount}
                className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}99)`, boxShadow: `0 6px 20px ${item.color}35` }}>
                <Hammer size={16} /> Construire · {formatEuroCompact(item.minAmount)}
              </button>
            )
          ) : isUpgrading ? (
            <div className="w-full py-3.5 rounded-2xl font-bold text-sm text-amber-300 flex items-center justify-center gap-2"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <Clock size={16} /> Amélioration en cours — {timer}
            </div>
          ) : isMax ? (
            <div className="w-full py-3 rounded-2xl text-center text-sm font-extrabold flex items-center justify-center gap-2"
              style={{ background: 'rgba(255,255,255,0.05)', color: item.color }}>
              <Sparkles size={14} /> Niveau maximum atteint
            </div>
          ) : (
            <button onClick={handleUpgrade} disabled={cash < upgradeCost}
              className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 6px 20px rgba(245,158,11,0.35)' }}>
              <ArrowUpCircle size={16} />
              Améliorer → Niv.{targetLevel} · {formatEuroCompact(upgradeCost)}
              <span className="text-[10px] opacity-70">({TIER_LABELS[targetLevel]})</span>
            </button>
          )}

          {inv && (
            <button onClick={onGotoPortfolio}
              className="w-full py-2.5 rounded-2xl font-semibold text-xs text-white/50 flex items-center justify-center gap-1 active:scale-98"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              Gérer dans le portefeuille <ChevronRight size={11} />
            </button>
          )}
        </div>

        {feedback && (
          <p className="text-center text-xs mt-2 pb-1 font-semibold px-5"
            style={{ color: feedback.startsWith('+') ? '#4ade80' : '#94a3b8' }}>
            {feedback}
          </p>
        )}
      </div>
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm font-extrabold leading-tight" style={{ color }}>{value}</div>
    </div>
  )
}
