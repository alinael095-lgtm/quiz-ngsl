# Changelog — Quiz NGSL

Toutes les évolutions notables du projet sont documentées dans ce fichier.

## [2.1.0] — 2026-11-25 — Refonte design & publication en ligne
### Ajouté
- **Design « Language App »** inspiré de Duolingo / Babbel / Quizlet : boutons tactiles 3D, barre de progression pilule avec reflet, badge `🔥 Série`, mode sombre ardoise profond (`#131f24`) et mode clair doux.
- **Indicateur visuel de maîtrise** du mot en cours (`●○○ 1/3` → `●●● 3/3 maîtrisé`) et **rang de fréquence** (`#349`) révélés uniquement après la réponse.
- **Taux de réussite en direct** dans la session (`Session : X / Y · Z %`) et micro-animations courtes (≤ 150 ms) respectant `prefers-reduced-motion`.
- **Mise en page compacte zéro-scroll** sur écran d’ordinateur (`focus({ preventScroll: true })`).
- **Publication GitHub Pages** en HTTPS : https://nizar02.github.io/quiz-ngsl/
- **Relecture prioritaire** de 64 mots polysémiques fréquents (109 mots `checked: true`).

### Corrigé
- Masquage strict du badge `MODE RÉVISION` via `[hidden] { display: none !important; }`.

## [2.0.0] — 2026-11-25 — Phase 2 (Corpus complet NGSL 1.2 + Confort + CI)
### Ajouté
- **Corpus complet officiel NGSL 1.2** (`data/NGSL_12_stats.csv`, `data/ngsl_words.json`, `data/words.js`) : 2 809 mots, rangs continus 1 à 2 809, licence CC BY-SA 4.0.
- **Thème sombre automatique** (`prefers-color-scheme: dark`) avec bouton de bascule Clair / Sombre mémorisé dans `ngslQuiz.v1` (rétrocompatible).
- **CI GitHub Actions** (`.github/workflows/ci.yml`) : validation Python `prepare_data.py`, synchronisation `data/words.js`, vérification de syntaxe JS (`node --check`) et exécution de `node logic.test.js` sur chaque PR et push sur `main`.

## [1.0.0] — 2026-11-25 — Phase 1 (Prototype 50 mots)
### Ajouté
- Échantillon de 50 mots relus à la main répartis sur les 4 paliers + script de validation `prepare_data.py`.
- Moteur logique pur `logic.js` (`window.NGSL_LOGIC` + `module.exports`) et 11 tests unitaires Node (`logic.test.js`).
- Interface autonome 100 % hors ligne (`index.html`, `style.css`, `app.js`), raccourcis clavier `1–4` et `Entrée`, mode Révision ambre, persistance `localStorage` (`ngslQuiz.v1`), export/import JSON validé et mention de licence CC BY-SA 4.0.
