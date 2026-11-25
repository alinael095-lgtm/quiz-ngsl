# Quiz de vocabulaire NGSL

Application web locale, légère et 100 % hors ligne pour apprendre et réviser le vocabulaire anglais de la **New General Service List 1.2** (NGSL).

## Lancer l’application

Aucun serveur ni installation n’est nécessaire :
1. Ouvrez simplement `index.html` en double-clic dans votre navigateur (protocole `file://`).
2. Votre progression est sauvegardée localement dans le navigateur (`localStorage`, clé `ngslQuiz.v1`).

*(Note : l’interface `index.html` est implémentée dans l’Issue #3.)*

## Préparer et valider les données

Le fichier `data/words.js` utilisé par l’application est généré à partir du fichier source `data/ngsl_words.json` grâce au script `prepare_data.py` (Python 3 standard, sans dépendance externe).

### Phase 1 (échantillon de 50 mots relus)
```bash
python3 prepare_data.py
```

### Phase 2 (corpus complet de 2 809 mots)
```bash
python3 prepare_data.py --phase 2
```

Le script s’arrête en cas d’erreur sans écraser `data/words.js` si une règle de validation échoue (nombre d’entrées, rangs uniques/continus, `pos` autorisé, `fr` non vide, `fr_main` présent dans `fr`, aucun doublon de mot anglais).

## Tests unitaires (à partir de l’Issue #2)

```bash
node logic.test.js
```

## Licence des données

> Browne, C., Culligan, B. & Phillips, J. (2013). The New General Service List. CC BY-SA 4.0.

Les fichiers de données dérivés contenant les traductions françaises (`data/ngsl_words.json` et `data/words.js`) sont distribués sous la même licence **CC BY-SA 4.0**.
