/**
 * MOGUL — jeu de décisions à balayer (beta, gameplay alternatif).
 *
 * Concept : chaque carte est un dilemme financier. Le joueur balaie à gauche
 * ou à droite pour choisir. Chaque choix déplace 4 jauges d'équilibre. Le but :
 * bâtir la plus grosse fortune et survivre le plus longtemps. Une jauge au fond
 * (0) ou au plafond (100) met fin à la partie — chacune avec sa « mort » thématique.
 *
 * 100 % hors-ligne, autonome : ce mode n'utilise ni la simulation patrimoniale
 * ni les lingots. Contenu et équilibrage vivent ici.
 */

export type MeterKey = 'cash' | 'expo' | 'rep' | 'energy'

export interface Meter {
  key: MeterKey
  emoji: string
  label: string
  color: string
  lowDeath: string   // texte de fin si la jauge tombe à 0
  highDeath: string  // texte de fin si la jauge atteint 100
}

export const METERS: Meter[] = [
  {
    key: 'cash', emoji: '💵', label: 'Trésorerie', color: '#34d399',
    lowDeath: 'Faillite. Plus un centime pour honorer tes engagements — tout est saisi.',
    highDeath: 'Capital dormant. Lassés de te voir thésauriser sans oser, tes associés te débarquent.',
  },
  {
    key: 'expo', emoji: '📊', label: 'Exposition', color: '#38bdf8',
    lowDeath: "Trop frileux. Pendant que tu hésitais, l'inflation a dévoré ton patrimoine immobile.",
    highDeath: 'Surexposition. Un krach soudain emporte ton empire sur-endetté en une séance.',
  },
  {
    key: 'rep', emoji: '🤝', label: 'Réputation', color: '#a78bfa',
    lowDeath: 'Paria. Plus une banque, plus un partenaire ne veut traiter avec toi.',
    highDeath: 'Trop en vue. Un contrôle fiscal retentissant fait de toi un exemple national.',
  },
  {
    key: 'energy', emoji: '🔥', label: 'Énergie', color: '#fbbf24',
    lowDeath: "Burnout. Tu plaques tout pour élever des chèvres dans le Larzac.",
    highDeath: "Hubris. Grisé par le succès, tu fais le pari de trop et tu te brûles les ailes.",
  },
]

export const METER_BY_KEY: Record<MeterKey, Meter> =
  Object.fromEntries(METERS.map((m) => [m.key, m])) as Record<MeterKey, Meter>

export type Effects = Partial<Record<MeterKey, number>>

export interface Choice {
  label: string                 // action affichée en balayant
  effects: Effects              // deltas jauges (−100..+100), appliqués et clampés
  fortune?: number              // delta € sur la fortune (score)
  result: string                // courte conséquence narrative après le choix
}

export interface MogulCard {
  id: string
  emoji: string
  speaker: string               // qui te parle
  prompt: string                // le dilemme
  left: Choice
  right: Choice
  minFortune?: number           // ne sort qu'au-dessus de ce niveau de fortune
  maxFortune?: number           // ne sort qu'en-dessous
  once?: boolean                // une seule fois par partie
  weight?: number               // fréquence relative (défaut 1)
}

// Départ de partie
export const START_METERS: Record<MeterKey, number> = { cash: 55, expo: 45, rep: 50, energy: 60 }
export const START_FORTUNE = 20_000
export const START_AGE = 25
export const CARDS_PER_QUARTER = 1   // 1 carte = 1 trimestre
export const QUARTERS_PER_YEAR = 4

// ── Le deck ────────────────────────────────────────────────────────────────
// Deltas typiques : ±8 à ±20. La plupart des cartes touchent 2 jauges (un
// arbitrage : on gagne quelque part, on paie ailleurs).

export const DECK: MogulCard[] = [
  // ——— Amorce / petits arbitrages ———
  {
    id: 'side_hustle', emoji: '💼', speaker: 'Ton ancien camarade',
    prompt: '« Je monte une petite activité le week-end. Tu mets 2 000 € et on partage ? »',
    left:  { label: 'Je passe mon tour', effects: { rep: -4, energy: +6 }, result: 'Il réussira sans toi. Tu dormiras bien, au moins.' },
    right: { label: 'Je mise dessus',    effects: { cash: -10, expo: +8, energy: -6 }, fortune: 4_000, result: 'Les premiers clients arrivent. Ça bosse dur mais ça rentre.' },
  },
  {
    id: 'livret_vs_etf', emoji: '🏦', speaker: 'Ton conseiller bancaire',
    prompt: '« Vous laissez 15 000 € dormir sur le compte courant. On les place ? »',
    left:  { label: 'Livret sécurisé', effects: { cash: +4, expo: -8 }, fortune: 500, result: 'Sûr, tiède. Ton argent respire à peine.' },
    right: { label: 'ETF monde',       effects: { expo: +12, cash: -4 }, fortune: 3_000, result: 'Marché haussier ce trimestre — bien joué.' },
  },
  {
    id: 'crypto_friend', emoji: '🪙', speaker: 'Un ami surexcité',
    prompt: '« Ce token va x10, je te jure. Faut rentrer MAINTENANT. »',
    left:  { label: 'Trop risqué', effects: { expo: -4, rep: +4 }, result: 'Deux semaines plus tard, le token s\'effondre de 80 %. Ouf.' },
    right: { label: 'Un petit ticket', effects: { cash: -8, expo: +14, energy: -4 }, fortune: -3_000, result: 'Rouge vif. Tu apprends à tes dépens.' },
    weight: 1,
  },
  {
    id: 'first_flat', emoji: '🏠', speaker: 'Une agence immobilière',
    prompt: '« Un studio à louer, bon rendement, mais il faut se décider ce soir. »',
    left:  { label: 'Je réfléchis', effects: { expo: -6, energy: +4 }, result: 'Parti en une nuit. La prochaine fois, peut-être.' },
    right: { label: "J'achète à crédit", effects: { cash: -12, expo: +10, rep: +4 }, fortune: 8_000, result: 'Premier locataire installé. Les loyers tombent.' },
  },
  {
    id: 'burnout_warning', emoji: '😮‍💨', speaker: 'Ton corps',
    prompt: 'Trois nuits blanches d\'affilée. La tension monte.',
    left:  { label: 'Je lève le pied', effects: { energy: +18, cash: -4, expo: -4 }, result: 'Un vrai week-end off. Le monde ne s\'est pas écroulé.' },
    right: { label: 'Je serre les dents', effects: { energy: -14, cash: +6, expo: +4 }, fortune: 2_000, result: 'Productif… mais tu joues avec le feu.' },
  },
  {
    id: 'tax_optim', emoji: '🧾', speaker: 'Ton comptable',
    prompt: '« Il y a un montage parfaitement légal pour réduire l\'impôt. Un peu gris, mais légal. »',
    left:  { label: 'On reste carré', effects: { cash: -6, rep: +8 }, result: 'Tu paies plein pot. Ta conscience est nette.' },
    right: { label: 'On optimise', effects: { cash: +12, rep: -8 }, fortune: 5_000, result: 'Le fisc n\'a rien dit… cette année.' },
  },
  {
    id: 'angel_pitch', emoji: '🚀', speaker: 'Deux fondateurs de 22 ans',
    prompt: '« Notre app va révolutionner la livraison. On cherche un premier investisseur. »',
    left:  { label: 'Trop tôt', effects: { expo: -4, cash: +2 }, result: 'Ils lèveront ailleurs. Tu verras leur logo partout dans 2 ans.' },
    right: { label: 'Je prends 5 %', effects: { cash: -14, expo: +10, energy: -4 }, fortune: -2_000, result: 'Pari sur l\'avenir. On verra bien.' },
    minFortune: 30_000,
  },

  // ——— Milieu de partie ———
  {
    id: 'partner_greedy', emoji: '🤨', speaker: 'Ton associé',
    prompt: '« Je veux 60 % des parts, sinon je pars avec les clients. »',
    left:  { label: 'Je le laisse partir', effects: { cash: -8, rep: +6, energy: -8 }, fortune: -6_000, result: 'Rupture douloureuse mais tu gardes ta dignité — et le contrôle.' },
    right: { label: 'Je cède les parts', effects: { rep: -6, expo: +6, energy: +4 }, fortune: 4_000, result: 'La paix a un prix. Tu n\'es plus tout à fait maître chez toi.' },
    minFortune: 40_000,
  },
  {
    id: 'media_offer', emoji: '📸', speaker: 'Une journaliste',
    prompt: '« Portrait en une du magazine éco : le nouveau visage de la réussite. Ça vous tente ? »',
    left:  { label: 'Je reste discret', effects: { rep: -4, energy: +6 }, result: 'L\'ombre te va bien. Les vrais deals se font en coulisses.' },
    right: { label: "J'accepte la une", effects: { rep: +16, expo: +4, energy: -6 }, fortune: 3_000, result: 'Tout le monde te reconnaît. Y compris des gens que tu voudrais éviter.' },
  },
  {
    id: 'insider_tip', emoji: '🤫', speaker: 'Un cadre un peu trop bavard',
    prompt: '« Rachat annoncé demain. Achète les actions ce soir. Entre nous. »',
    left:  { label: 'Je refuse net', effects: { rep: +10, cash: -2 }, result: 'Délit d\'initié refusé. Ta réputation vaut plus que ça.' },
    right: { label: "J'en profite", effects: { cash: +18, rep: -14, energy: -4 }, fortune: 12_000, result: 'Gros gain immédiat. Et un secret qui pèse lourd.' },
    minFortune: 50_000,
  },
  {
    id: 'leverage_deal', emoji: '🏗️', speaker: 'Ton banquier d\'affaires',
    prompt: '« On peut financer l\'acquisition à 80 % par la dette. Effet de levier maximal. »',
    left:  { label: 'Apport prudent', effects: { cash: -10, expo: +4, rep: +6 }, fortune: 3_000, result: 'Solide. Tu dors tranquille.' },
    right: { label: 'Levier maximal', effects: { expo: +18, cash: +6, energy: -6 }, fortune: 15_000, result: 'Si le marché tient, tu décuples. S\'il tourne… aïe.' },
    minFortune: 60_000,
  },
  {
    id: 'charity_gala', emoji: '🎗️', speaker: 'Une fondation',
    prompt: '« Un don généreux ferait beaucoup de bien — et beaucoup parler. »',
    left:  { label: 'Don anonyme modeste', effects: { cash: -4, rep: +6, energy: +4 }, result: 'Le geste juste, sans tapage.' },
    right: { label: 'Grand don médiatisé', effects: { cash: -12, rep: +14 }, fortune: -4_000, result: 'Ton nom sur le fronton. La générosité, ça se remarque.' },
  },
  {
    id: 'vacation', emoji: '🏝️', speaker: 'Ta famille',
    prompt: '« Ça fait deux ans qu\'on n\'est pas partis. Tu viens, cette fois ? »',
    left:  { label: 'Le travail d\'abord', effects: { energy: -10, cash: +4, rep: -4 }, fortune: 2_000, result: 'Encore un deal bouclé. Encore une absence.' },
    right: { label: 'Je pars déconnecter', effects: { energy: +20, cash: -6, expo: -4 }, result: 'Deux semaines sans écran. Tu reviens neuf.' },
  },
  {
    id: 'startup_equity', emoji: '📄', speaker: 'Une pépite en hypercroissance',
    prompt: '« On vous veut comme conseiller. Salaire cash, ou equity qui vaudra peut-être une fortune ? »',
    left:  { label: 'Salaire cash', effects: { cash: +12, expo: -4 }, fortune: 4_000, result: 'Sûr et net, chaque mois. Pas de rêve, pas de cauchemar.' },
    right: { label: 'Equity', effects: { cash: -4, expo: +14, energy: -4 }, fortune: 9_000, result: 'Des parts au chaud. Rendez-vous à la sortie… si sortie il y a.' },
    minFortune: 45_000,
  },
  {
    id: 'rival_buyout', emoji: '⚔️', speaker: 'Ton principal concurrent',
    prompt: '« Rachetez-moi avant que je vous écrase. Prix… négociable. »',
    left:  { label: 'Je le laisse couler', effects: { rep: -4, expo: +6, energy: -6 }, fortune: 3_000, result: 'Guerre de tranchées. Épuisant, mais tu tiens.' },
    right: { label: 'Je l\'absorbe', effects: { cash: -16, expo: +12, rep: +8 }, fortune: 14_000, result: 'Le marché est à toi. La dette aussi.' },
    minFortune: 80_000,
  },

  // ——— Événements de marché (aléas) ———
  {
    id: 'market_crash', emoji: '📉', speaker: 'Le marché',
    prompt: 'Krach soudain. −20 % en trois jours. Tout le monde panique.',
    left:  { label: 'Je vends tout', effects: { expo: -16, cash: +10, energy: -6 }, fortune: -8_000, result: 'Tu limites la casse. Et tu rates le rebond.' },
    right: { label: 'J\'achète le creux', effects: { cash: -12, expo: +12, energy: -8 }, fortune: 10_000, result: 'Sang-froid récompensé quand le marché remonte.' },
    weight: 1,
  },
  {
    id: 'bull_euphoria', emoji: '🐂', speaker: 'Le marché',
    prompt: 'Euphorie générale. Tout monte. Tes proches se croient tous géniaux.',
    left:  { label: 'Je prends mes gains', effects: { expo: -8, cash: +12, rep: +4 }, fortune: 6_000, result: 'Discipline. Tu sécurises pendant que d\'autres rêvent.' },
    right: { label: 'Je réinvestis tout', effects: { expo: +14, energy: -4 }, fortune: 8_000, result: 'Tant que la musique joue, tu danses.' },
  },
  {
    id: 'audit', emoji: '🔍', speaker: "L'administration fiscale",
    prompt: '« Contrôle de routine. Vos comptes des trois dernières années, s\'il vous plaît. »',
    left:  { label: 'Je coopère pleinement', effects: { cash: -8, rep: +10, energy: -6 }, result: 'Long, pénible, mais rien à te reprocher. Dossier clos.' },
    right: { label: 'Je traîne des pieds', effects: { rep: -12, cash: +4, energy: -8 }, fortune: -5_000, result: 'Mauvaise idée. Ils reviendront, plus tatillons.' },
    minFortune: 50_000,
  },

  // ——— Gros jeu / fin de partie ———
  {
    id: 'ipo', emoji: '🔔', speaker: 'Ta banque d\'introduction',
    prompt: '« Le moment est venu : on introduit votre société en Bourse. Prêt à sonner la cloche ? »',
    left:  { label: 'Je reste privé', effects: { rep: -6, expo: -4, energy: +8 }, fortune: 5_000, result: 'Maître à bord, loin du regard des marchés.' },
    right: { label: 'IPO !', effects: { cash: +20, rep: +12, expo: +8, energy: -10 }, fortune: 40_000, result: 'La cloche résonne. Ta fortune sur papier explose — et le compte à rebours médiatique commence.' },
    minFortune: 120_000, once: true,
  },
  {
    id: 'political_favor', emoji: '🏛️', speaker: 'Un élu influent',
    prompt: '« Un petit coup de pouce à ma campagne, et vos marchés publics deviennent… plus fluides. »',
    left:  { label: 'Je décline poliment', effects: { rep: +8, cash: -2, expo: -4 }, result: 'Intègre. Certaines portes resteront fermées, tant pis.' },
    right: { label: 'On s\'arrange', effects: { cash: +16, expo: +8, rep: -16 }, fortune: 18_000, result: 'Les contrats pleuvent. Et une épée de Damoclès s\'installe.' },
    minFortune: 100_000,
  },
  {
    id: 'family_office', emoji: '🏛️', speaker: 'Ton entourage',
    prompt: '« Tu as réussi. Structure un family office et lève le pied, tu l\'as mérité. »',
    left:  { label: 'Encore un cycle', effects: { energy: -10, expo: +8 }, fortune: 12_000, result: 'L\'appétit vient en mangeant. Tu repars pour un tour.' },
    right: { label: 'Je consolide', effects: { energy: +16, expo: -10, cash: +8, rep: +6 }, fortune: 6_000, result: 'Gestion patrimoniale sereine. La course folle est derrière toi.' },
    minFortune: 150_000,
  },
  {
    id: 'legacy_bet', emoji: '🎲', speaker: 'Ton intuition',
    prompt: 'Une occasion générationnelle. Énorme. Il faudrait tout remettre en jeu.',
    left:  { label: 'Je protège l\'acquis', effects: { expo: -8, energy: +6, rep: +4 }, fortune: 4_000, result: 'La sagesse plutôt que la gloire. Ton empire tient bon.' },
    right: { label: 'Je mise l\'empire', effects: { expo: +20, energy: -12, cash: -10 }, fortune: 30_000, result: 'Quitte ou double. Tu sauras vite si c\'était du génie ou de la folie.' },
    minFortune: 130_000,
  },
]

// Fortune → titre honorifique (affiché dans le HUD et l\'écran de fin).
export const MOGUL_RANKS: { min: number; title: string; emoji: string }[] = [
  { min: 0,           title: 'Débutant',      emoji: '🐣' },
  { min: 50_000,      title: 'Investisseur',  emoji: '📈' },
  { min: 120_000,     title: 'Entrepreneur',  emoji: '💼' },
  { min: 300_000,     title: 'Magnat',        emoji: '🏙️' },
  { min: 800_000,     title: 'Tycoon',        emoji: '🌆' },
  { min: 2_000_000,   title: 'Légende',       emoji: '👑' },
]

export function getMogulRank(fortune: number) {
  let r = MOGUL_RANKS[0]
  for (const rank of MOGUL_RANKS) if (fortune >= rank.min) r = rank
  return r
}
