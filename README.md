# 💰 Patrimoine — Jeu de gestion d'investissement

Un jeu de gestion de ressources où tu pars de zéro et fais fructifier ton argent
pour devenir **rentier** puis **millionnaire**. Temps réel accéléré, vraies
décisions, vraies difficultés.

![Stack](https://img.shields.io/badge/React-18-61dafb) ![Stack](https://img.shields.io/badge/TypeScript-5-3178c6) ![Stack](https://img.shields.io/badge/Vite-8-646cff)

## 🎮 Le concept

Tu choisis ta situation de départ (métier, salaire, épargne, âge), puis tu
investis intelligemment pour faire grossir ton patrimoine. Le temps s'écoule en
accéléré (**1 seconde réelle ≈ 1 jour de jeu**) et tout continue même quand tu
fermes le jeu : à ton retour, tes investissements ont fructifié.

### Caractéristiques

- ⏱️ **Temps réel accéléré** — vitesses ×1, ×5, ×10, ×50 + pause
- 📈 **9 types d'investissements** débloqués progressivement selon ton patrimoine
- 🏦 **Effet de levier** — crédit immobilier avec apport, taux et endettement réalistes
- 🎲 **Événements aléatoires** — promotions, licenciements, krachs, héritages, réparations…
- 📊 **Marché vivant** — cycles haussiers / baissiers / krachs qui impactent tes actifs
- 🏆 **7 paliers de richesse** — de Débutant à Multimillionnaire
- 💾 **Sauvegarde automatique** + progression hors-ligne
- 🧾 **Fiscalité** — flat tax, revenus fonciers, amortissement LMNP

### Les placements

| Placement | Débloqué à | Rendement | Risque |
|---|---|---|---|
| Livret A | départ | 1,5% | très faible |
| Assurance Vie | 500 € | 4% | très faible |
| Bourse / ETF | 1 000 € | 5–12% | modéré |
| Crowdfunding immo | 5 000 € | 8–10% | modéré |
| SCPI | 10 000 € | 4–6% | faible |
| Business automatisé | 15 000 € | variable | élevé |
| Parking / Box | 25 000 € | 6–8% | faible |
| Location meublée (LMNP) | 50 000 € | loyers | modéré |
| Locatif classique | 80 000 € | loyers | modéré |

## 🚀 Lancer le jeu

```bash
npm install
npm run dev        # → http://localhost:5173
```

Build de production :

```bash
npm run build
npm run preview
```

## 🧱 Architecture

```
src/
  types/        Modèles TypeScript (source de vérité)
  data/         Catalogues : investissements, métiers, événements
  engine/       Moteur pur : gameLoop, economy, investments, events, fiscal
  store/        Store Zustand : état + boucle de temps + sauvegarde
  components/   ui · layout · game (écrans)
  utils/        Formatage & calculs (patrimoine, cashflow, paliers)
```

Le cœur du jeu est `engine/gameLoop.ts` → `advanceDays(state, n)`, une fonction
pure utilisée **à la fois** pour la progression en direct et hors-ligne.

## 📦 Stack

React 18 · TypeScript · Vite · Tailwind CSS · Zustand · Recharts · Lucide
