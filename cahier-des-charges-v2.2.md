# Cahier des charges v2.2 — Quiz de vocabulaire NGSL

Version corrigée du 25/11/2026. Les changements par rapport à la v1 sont signalés par **[v2]**, **[v2.1]** et **[v2.2]**.

## 1. Objectif

Créer une application web locale, légère et 100 % autonome (aucun backend, aucune base de données serveur, **fonctionne hors ligne [v2]**), pour apprendre et réviser le vocabulaire anglais de la **New General Service List 1.2 (2 809 mots, avril 2023) [v2]**.

Hors périmètre : comptes utilisateurs, synchronisation entre appareils, audio, application mobile.

## 2. Données source et licence [v2]

- Source : newgeneralservicelist.com, fichier « NGSL 1.2 list with basic statistics » (il contient le rang de fréquence).
- **La liste officielle ne contient aucune traduction française** : il faut la produire (voir section 7).
- Licence : Creative Commons BY-SA 4.0 (indiquée aussi par une source secondaire, le package R word.lists). Afficher dans l'appli : « Browne, C., Culligan, B. & Phillips, J. (2013). The New General Service List. CC BY-SA 4.0 ». Le fichier de données dérivé (avec traductions) doit rester sous la même licence.

## 3. Architecture et stack [v2]

| Élément | Choix v2 | Pourquoi |
| --- | --- | --- |
| Fichiers | index.html, style.css, app.js, data/words.js | Simple, sans build |
| Données | words.js : `window.NGSL_WORDS = [...]`, chargé par une balise script | Un fetch() d'un .json est bloqué par le navigateur quand on ouvre index.html en double-clic (file://) |
| Style | CSS écrit à la main (variables CSS), ou Tailwind compilé une fois en style.css avec le CLI | Le Play CDN de Tailwind est réservé au développement selon sa doc officielle, et ne marche pas hors ligne |
| Persistance | localStorage, une seule clé versionnée `ngslQuiz.v1` | Permet de migrer le format plus tard |
| JS | Vanilla JS, sans framework ni dépendance | Exigence d'origine |

Option : garder aussi un ngsl_words.json comme fichier source, et générer words.js à partir de lui avec le script Python.

**[v2.1]** Pas de modules ES (`import`/`export`, `<script type="module">`) : en file://, ils sont bloqués comme fetch(). La logique (logic.js) s'expose à la fois sur `window.NGSL_LOGIC` et, si `module` existe, via `module.exports`, pour pouvoir la tester avec Node en ligne de commande.

## 4. Format des données [v2]

Un objet par mot :

```json
{ "rank": 25, "en": "can", "pos": "modal", "fr": ["pouvoir", "savoir (faire)"], "fr_main": "pouvoir", "checked": true }
```

- `rank` : entier unique de 1 à 2 809.
- `pos` : nature grammaticale (noun, verb, adj, adv, modal, prep, det, pron, conj…), utilisée pour choisir les distracteurs.
- `fr` : toutes les traductions acceptées. `fr_main` : celle affichée dans le QCM.
- `checked` : vrai si la traduction a été relue par un humain.

**[v2.2]** Un seul `pos` par mot : celui du sens dominant. `fr` ne contient que des sens de cette nature grammaticale. `fr_main` est court et naturel, sans parenthèse si possible : une réponse plus longue que les autres se repère sans connaître le mot. Les nuances vont dans `fr`.

## 5. Fonctionnalités

### 5.1 Paliers de difficulté

Top 1–500, 501–1 000, 1 001–2 000, **2 001–2 809 [v2]**, ou tous les mots. Les bornes sont définies dans une seule constante du code, pour pouvoir les changer.

### 5.2 QCM

- Sens EN → FR par défaut, avec un bouton pour passer en FR → EN.
- 4 propositions : 1 bonne réponse + 3 distracteurs.
- **Règles des distracteurs [v2]**, dans cet ordre :
  1. Piochés dans le même palier que le mot cible.
  2. De préférence de même nature grammaticale (`pos`).
  3. Exclus : tout distracteur dont une traduction recoupe celles du mot cible (par exemple « big » et « large » pour « grand »).
  4. Exclus : les doublons d'affichage.
  5. S'il n'y a pas assez de candidats (petit palier, liste d'erreurs courte), compléter avec des mots de tout le corpus.
- En FR → EN, si plusieurs mots anglais partagent `fr_main`, en garder un seul dans les propositions.
- Retour immédiat : bonne réponse en vert, mauvaise en rouge, avec affichage de la bonne réponse et de toutes ses traductions (`fr`).
- **Clavier [v2]** : touches 1 à 4 pour répondre, Entrée pour passer à la question suivante.

**[v2.1] Normalisation des comparaisons** : avant de comparer des traductions, tout passer en minuscules, retirer les accents et les espaces en trop, puis comparer avec et sans le texte entre parenthèses (« pouvoir » = « pouvoir (faire) »). En FR → EN, un distracteur est exclu si le `fr_main` du mot cible figure n'importe où dans son tableau `fr`, pas seulement dans son `fr_main`.

**[v2.2] Choix du mot posé** : ne pas reposer un des 8 derniers mots ; tirer en priorité parmi les mots non maîtrisés ; si tout le palier est maîtrisé, afficher un message et un bouton « Continuer quand même ».

**[v2.2] Verrouillage** : dès qu'une réponse est choisie (clic ou touche), les 4 boutons sont bloqués jusqu'à « Suivant », pour qu'un double appui ne fausse pas les statistiques.

### 5.3 Maîtrise et révision des erreurs [v2]

| Règle | Valeur par défaut |
| --- | --- |
| Mot « maîtrisé » | 3 bonnes réponses d'affilée |
| Mot ajouté aux erreurs | dès une mauvaise réponse (le compteur d'affilée repart à 0) |
| Mot retiré des erreurs | 2 bonnes réponses d'affilée en mode révision |
| Session de révision vide | message « Aucune erreur à réviser » et bouton désactivé |

Ces seuils sont regroupés dans une constante `CONFIG`.

### 5.4 Tableau de bord

- Session : bonnes réponses sur nombre de questions, série en cours.
- Global : % de mots maîtrisés (sur 2 809, et sur le palier choisi), nombre de mots à réviser, meilleure série.
- Bouton « Réinitialiser ma progression », avec une confirmation.
- Recommandé [v2.1] : exporter et importer la progression en fichier JSON (sauvegarde, changement de navigateur).

**[v2.2]** Le % global se calcule sur `NGSL_WORDS.length`, jamais sur 2 809 écrit en dur (l'échantillon de la phase 1 fait 50 mots). L'import vérifie le fichier (`version` = 1, présence de `words` et `stats`) avant d'écraser quoi que ce soit, et affiche une erreur claire sinon.

## 6. Données enregistrées (localStorage) [v2]

```json
{ "version": 1, "settings": { "tier": "1-500", "direction": "en-fr" }, "words": { "25": { "seen": 4, "correct": 3, "streak": 2, "inErrors": false } }, "stats": { "bestStreak": 14 } }
```

Les mots sont indexés par `rank`. Si les données sont illisibles, repartir d'un état vide sans planter l'appli.

## 7. Préparation des données (script Python) [v2]

1. Lire le fichier CSV officiel, puis normaliser les colonnes (mot, rang).
2. [v2.1] Générer avec une IA, en sortie JSON structurée, la nature grammaticale (pos) et les sens courants (fr, fr_main). Sur un mot isolé, DeepL ne donne qu'une traduction sans contexte et pas de nature grammaticale : ne l'utiliser qu'en vérification, si besoin (offre gratuite : 500 000 caractères par mois).
3. Écrire ngsl_words.json et générer words.js.
4. Les mots non relus ont `checked: false`. Relire en priorité les mots polysémiques (can, like, set, run, fine, mean, right…).

**[v2.2] Validation avant d'écrire words.js** (le script s'arrête en cas d'erreur) : nombre d'entrées attendu (50 en phase 1, 2 809 ensuite) ; rangs uniques, compris entre 1 et 2 809 (et continus de 1 à 2 809 en phase 2 seulement) ; `pos` dans une liste fermée ; `fr` non vide, `fr_main` présent dans `fr` ; aucune chaîne vide ; aucun doublon de `en`.

Le script n'est pas exécuté par l'appli : c'est un outil de préparation, lancé une fois.

## 8. Livrables

- index.html, style.css, app.js, logic.js [v2.2], data/words.js, avec du code commenté, plus des tests Node pour logic.js.
- prepare_data.py et un README (comment lancer l'appli et préparer les données).
- **Un échantillon de 50 mots relus à la main (`checked: true`) pris dans les 4 paliers (12 à 13 par palier) [v2]**, pour pouvoir tester les distracteurs dans chaque palier.

**[v2.1] Deux phases** : 1) prototype avec les 50 mots relus, pour valider le moteur de QCM et les distracteurs ; 2) génération puis relecture des 2 809 mots.

## 9. Critères d'acceptation [v2]

- [ ] index.html s'ouvre en double-clic, sans Internet, et l'appli fonctionne.
- [ ] Une question n'affiche jamais deux réponses valables.
- [ ] Les paliers couvrent exactement les rangs 1 à 2 809.
- [ ] La progression est conservée après fermeture du navigateur.
- [ ] La réinitialisation vide bien la progression.
- [ ] Mention de licence visible dans l'appli.
- [ ] Fonctions de logique (choix des distracteurs, règles de maîtrise) testables séparément de l'affichage.

## 10. Interface [v2.2]

**Phase 1 (indispensable)**

- Une carte centrée (environ 600 px de large) ; en haut : palier, sens EN/FR, bouton « Révision (N) ».
- Le mot en très gros. Le `pos` n'apparaît qu'après la réponse, sinon il sert d'indice.
- Réponses en grille 2×2 (une colonne sur mobile), boutons d'au moins 48 px de haut, avec un petit repère 1 à 4 pour le clavier.
- Retour visuel par la couleur et par une icône (✓ / ✗), pour les daltoniens. Zone de résultat de hauteur fixe, pour que la carte ne saute pas.
- Mode Révision signalé par une couleur d'accent différente (ambre).
- Pendant le quiz : barre de progression du palier, score de la session et série en cours. Le reste (stats globales, export, import, réinitialisation) dans un panneau repliable ; la licence en pied de page.

**Phase 2 (confort)**

- Thème sombre automatique (`prefers-color-scheme`) avec un bouton pour basculer.
- Transitions courtes (150 ms maximum) qui ne ralentissent pas l'enchaînement au clavier.

## Sources

- newgeneralservicelist.com : NGSL 1.2, 2 809 mots, version d'avril 2023, licence Creative Commons.
- Documentation Tailwind (Play CDN) : réservé au développement, pas à la production.
- MDN, « CORS request not HTTP » : les fichiers ouverts en file:// bloquent fetch().
- DeepL, aide en ligne : API Free limitée à 500 000 caractères par mois.
