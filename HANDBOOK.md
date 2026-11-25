# HANDBOOK — Projet `quiz-ngsl`

Manuel d’équipe court (mémoire permanente du projet).  
Spécification de référence : [`cahier-des-charges-v2.2.md`](./cahier-des-charges-v2.2.md).

## 1. Principe de fonctionnement

On travaille avec un **seul agent en mode prudent** (Sandbox actif).  
L’agent prépare le travail sur des branches dédiées et ouvre des Pull Requests ; **l’utilisateur garde la validation finale** sur les critères d’acceptation et sur toute fusion dans `main`.

## 2. Règles d’or et garde-fous

- **Mode prudent** : travailler uniquement sur des branches dédiées + Pull Requests. **Ne jamais pousser directement sur `main`.**
- **Pédagogie** : chaque Pull Request contient un résumé clair en français :
  1. Ce qui a changé
  2. Pourquoi
  3. Comment tester
- **Actions soumises à accord explicite** : interdiction sans validation préalable de l’utilisateur de :
  - supprimer des fichiers ;
  - modifier la configuration ou la CI ;
  - ajouter des dépendances ;
  - toucher à des secrets (`.env`, clés API, jetons).
- **Critères d’acceptation** : les critères de réussite de chaque Issue GitHub sont validés par l’utilisateur (pas d’auto-validation circulaire).
- **Cadrage vs Exécution** : réserver `/grill-me` aux échanges directs avec l’utilisateur (ne jamais l’inclure dans un prompt de relance autonome).
- **Reprise après coupure** (issue `in-progress`) : vérifier d’abord l’état réel de la branche (`git status`, `git log`, exécution des tests locaux) avant de continuer.

## 3. Boucle d’exécution (Phase 1)

1. Créer une branche dédiée depuis `main` (ex. `issue-1-sample-data`).
2. Implémenter et lancer les tests locaux (`node logic.test.js` et/ou `python3 prepare_data.py`).
3. Ouvrir une Pull Request avec une explication simple en français.
4. Attendre le test et la validation de l’utilisateur avant fusion sur `main`.

## 4. Contraintes techniques clés

- **100 % hors ligne (`file://`)** : ouvrable en double-clic, aucun backend, aucune dépendance CDN, **aucun module ES** (`import`/`export`, `<script type="module">`).
- **Exposition JS** : `data/words.js` expose `window.NGSL_WORDS` ; `logic.js` expose `window.NGSL_LOGIC` et `module.exports` (pour tests Node).
- **Persistance** : `localStorage`, clé unique `ngslQuiz.v1`.
- **Licence** : NGSL 1.2 sous **CC BY-SA 4.0** (mention obligatoire dans l’interface et les données dérivées).
