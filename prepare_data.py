#!/usr/bin/env python3
"""
Script de validation et de génération des données pour le Quiz NGSL.

Lit le fichier source JSON (par défaut data/ngsl_words.json), vérifie toutes
les règles de qualité définies dans cahier-des-charges-v2.2.md, puis génère
data/words.js (compatible file:// sans modules ES).

Usage :
    python3 prepare_data.py
    python3 prepare_data.py --phase 2 --input data/ngsl_words.json --output data/words.js
"""

import argparse
import json
import sys
from pathlib import Path

# Nombre d'entrées attendu selon la phase du projet
EXPECTED_COUNT = {
    1: 50,
    2: 2809,
}

MIN_RANK = 1
MAX_RANK = 2809

# Liste fermée des natures grammaticales autorisées (section 4 et 7 du cahier des charges)
ALLOWED_POS = {
    "noun",
    "verb",
    "adj",
    "adv",
    "modal",
    "prep",
    "det",
    "pron",
    "conj",
    "interj",
}

REQUIRED_FIELDS = {"rank", "en", "pos", "fr", "fr_main", "checked"}

LICENSE_HEADER = """\
/*
 * Données du Quiz NGSL (générées automatiquement par prepare_data.py).
 * Source : Browne, C., Culligan, B. & Phillips, J. (2013).
 *          The New General Service List (NGSL 1.2). CC BY-SA 4.0.
 * Licence des données dérivées (traductions françaises) : CC BY-SA 4.0.
 */
"""


def validate_words(words, phase):
    """Valide la liste de mots et retourne une liste de messages d'erreur."""
    errors = []

    if not isinstance(words, list):
        return ["Le fichier JSON doit contenir un tableau d'objets."]

    expected = EXPECTED_COUNT[phase]
    if len(words) != expected:
        errors.append(
            f"Nombre d'entrées invalide pour la phase {phase} : "
            f"{len(words)} trouvé(s), {expected} attendu(s)."
        )

    seen_ranks = set()
    seen_en = set()

    for idx, item in enumerate(words, start=1):
        prefix = f"Entrée #{idx}"

        if not isinstance(item, dict):
            errors.append(f"{prefix} : doit être un objet JSON.")
            continue

        missing = REQUIRED_FIELDS - set(item.keys())
        if missing:
            errors.append(f"{prefix} : champ(s) manquant(s) : {sorted(missing)}.")
            continue

        rank = item["rank"]
        en = item["en"]
        pos = item["pos"]
        fr = item["fr"]
        fr_main = item["fr_main"]
        checked = item["checked"]

        # Validation du rang
        if isinstance(rank, bool) or not isinstance(rank, int):
            errors.append(f"{prefix} : 'rank' doit être un entier (reçu : {rank!r}).")
        else:
            if not (MIN_RANK <= rank <= MAX_RANK):
                errors.append(
                    f"{prefix} (rank={rank}) : 'rank' doit être compris entre "
                    f"{MIN_RANK} et {MAX_RANK}."
                )
            if rank in seen_ranks:
                errors.append(f"{prefix} : 'rank' en doublon ({rank}).")
            seen_ranks.add(rank)

        # Validation du mot anglais
        if not isinstance(en, str) or not en.strip():
            errors.append(f"{prefix} : 'en' doit être une chaîne non vide.")
        else:
            en_key = en.strip().lower()
            if en_key in seen_en:
                errors.append(f"{prefix} : mot anglais en doublon ({en!r}).")
            seen_en.add(en_key)

        # Validation de la nature grammaticale (pos)
        if not isinstance(pos, str) or pos not in ALLOWED_POS:
            errors.append(
                f"{prefix} ({en!r}) : 'pos' invalide ({pos!r}). "
                f"Valeurs autorisées : {sorted(ALLOWED_POS)}."
            )

        # Validation du tableau fr
        if not isinstance(fr, list) or len(fr) == 0:
            errors.append(f"{prefix} ({en!r}) : 'fr' doit être une liste non vide.")
        else:
            for t_idx, trad in enumerate(fr, start=1):
                if not isinstance(trad, str) or not trad.strip():
                    errors.append(
                        f"{prefix} ({en!r}) : 'fr[{t_idx - 1}]' est vide ou invalide."
                    )

        # Validation de fr_main
        if not isinstance(fr_main, str) or not fr_main.strip():
            errors.append(f"{prefix} ({en!r}) : 'fr_main' doit être une chaîne non vide.")
        elif isinstance(fr, list) and fr_main not in fr:
            errors.append(
                f"{prefix} ({en!r}) : 'fr_main' ({fr_main!r}) doit être présent dans 'fr' ({fr!r})."
            )

        # Validation de checked
        if not isinstance(checked, bool):
            errors.append(f"{prefix} ({en!r}) : 'checked' doit être un booléen.")

        # Validation optionnelle de ai_reviewed (audit IA distinct de la relecture humaine)
        if "ai_reviewed" in item and not isinstance(item["ai_reviewed"], bool):
            errors.append(f"{prefix} ({en!r}) : 'ai_reviewed' doit être un booléen.")

    # En phase 2, les rangs doivent être continus de 1 à 2 809
    if phase == 2 and len(seen_ranks) == MAX_RANK:
        expected_ranks = set(range(MIN_RANK, MAX_RANK + 1))
        if seen_ranks != expected_ranks:
            missing_ranks = sorted(expected_ranks - seen_ranks)[:10]
            errors.append(
                f"Rangs non continus en phase 2. Premiers rangs manquants : {missing_ranks}."
            )

    return errors


def write_words_js(words, output_path):
    """Écrit le fichier data/words.js (trié par rang croissant)."""
    sorted_words = sorted(words, key=lambda w: w["rank"])
    json_payload = json.dumps(sorted_words, ensure_ascii=False, indent=2)

    content = (
        f"{LICENSE_HEADER}"
        "(function (root) {\n"
        f"  const NGSL_WORDS = {json_payload};\n"
        "\n"
        "  if (typeof root !== \"undefined\") {\n"
        "    root.NGSL_WORDS = NGSL_WORDS;\n"
        "  }\n"
        "  if (typeof module !== \"undefined\" && module.exports) {\n"
        "    module.exports = NGSL_WORDS;\n"
        "  }\n"
        "})(typeof window !== \"undefined\" ? window : globalThis);\n"
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(
        description="Valide data/ngsl_words.json et génère data/words.js."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/ngsl_words.json"),
        help="Chemin du fichier JSON source (défaut : data/ngsl_words.json).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/words.js"),
        help="Chemin du fichier JS généré (défaut : data/words.js).",
    )
    parser.add_argument(
        "--phase",
        type=int,
        choices=[1, 2],
        default=1,
        help="Phase de validation : 1 (50 mots) ou 2 (2 809 mots continus).",
    )
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Erreur : fichier introuvable : {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        words = json.loads(args.input.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"Erreur JSON dans {args.input} : {exc}", file=sys.stderr)
        sys.exit(1)

    errors = validate_words(words, phase=args.phase)
    if errors:
        print(f"Validation échouée ({len(errors)} erreur(s)) :", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)

    write_words_js(words, args.output)
    print(f"OK : {len(words)} mots validés (phase {args.phase}) -> {args.output}")


if __name__ == "__main__":
    main()
