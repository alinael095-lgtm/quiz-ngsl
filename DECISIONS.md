# Décisions d’architecture (ADR) — Quiz NGSL

Journal concis des choix techniques structurants du projet.

## ADR-01 — Pas de modules ES ni de `fetch()` pour les données
- **Décision** : `data/words.js` expose `window.NGSL_WORDS` et `logic.js` expose `window.NGSL_LOGIC` + `module.exports` via une IIFE (aucun `import`/`export`, aucun `fetch()`).
- **Pourquoi** : en ouverture locale par double-clic (`file://`), les navigateurs bloquent `fetch()` et `<script type="module">` pour des raisons CORS. Ce choix garantit un fonctionnement 100 % hors ligne sans serveur ni étape de build, tout en restant testable directement avec Node (`node logic.test.js`).

## ADR-02 — Persistance `localStorage` sous clé versionnée `ngslQuiz.v1`
- **Décision** : toute la progression et les préférences (`tier`, `direction`, `theme`) sont stockées dans une unique clé JSON versionnée (`version: 1`), avec validation stricte à l’import et repli sur un état vide si le stockage est corrompu.
- **Pourquoi** : permet de faire évoluer le schéma (ex. ajout rétrocompatible de `settings.theme` en Phase 2) sans casser les sauvegardes existantes et sans backend.

## ADR-03 — Compteur `reviewStreak` distinct de `streak`
- **Décision** : suivre la série de bonnes réponses en mode Révision séparément (`reviewStreak`) de la série globale du mot (`streak`).
- **Pourquoi** : respecter fidèlement la règle du cahier des charges (« 2 bonnes réponses d’affilée **en mode révision** » pour retirer un mot des erreurs) sans qu’une bonne réponse en mode normal ne fausse le décompte de révision.

## ADR-04 — Validation bloquante dans `prepare_data.py` + CI GitHub
- **Décision** : toute génération de `data/words.js` passe par `prepare_data.py` qui bloque en cas d’anomalie (nombre d’entrées, rangs continus en Phase 2, doublons `en`, `pos` hors liste fermée, `fr_main` absent de `fr`). La CI GitHub vérifie en plus que `data/words.js` est identique à la sortie générée depuis `data/ngsl_words.json`.
- **Pourquoi** : garantir l’intégrité du corpus de 2 809 mots et empêcher toute désynchronisation entre le JSON source et le JS chargé par le navigateur.

## ADR-05 — Hébergement statique via GitHub Pages (dépôt public)
- **Décision** : publier l’application sur GitHub Pages (`https://nizar02.github.io/quiz-ngsl/`) depuis `main` avec le dépôt en visibilité publique.
- **Pourquoi** : déploiement automatique gratuit en HTTPS à chaque fusion sur `main`, zéro secret dans le dépôt, données NGSL déjà sous licence libre CC BY-SA 4.0, et déblocage de la protection de la branche `main`.
