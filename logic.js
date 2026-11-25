/*
 * Moteur logique pur du Quiz NGSL (sans dépendance au DOM ni aux modules ES).
 * Exposé à la fois sur window.NGSL_LOGIC (navigateur, file://)
 * et via module.exports (tests unitaires Node).
 */
(function (root) {
  "use strict";

  const STORAGE_KEY = "ngslQuiz.v1";
  const DATA_VERSION = 1;

  // Bornes des paliers de difficulté définies dans une seule constante (section 5.1)
  const TIERS = Object.freeze({
    "1-500": Object.freeze({ id: "1-500", label: "Top 1–500", min: 1, max: 500 }),
    "501-1000": Object.freeze({ id: "501-1000", label: "501–1 000", min: 501, max: 1000 }),
    "1001-2000": Object.freeze({ id: "1001-2000", label: "1 001–2 000", min: 1001, max: 2000 }),
    "2001-2809": Object.freeze({ id: "2001-2809", label: "2 001–2 809", min: 2001, max: 2809 }),
    all: Object.freeze({ id: "all", label: "Tous les mots", min: 1, max: 2809 }),
  });

  const TIER_ORDER = Object.freeze(["1-500", "501-1000", "1001-2000", "2001-2809"]);

  // Seuils de maîtrise et paramètres du quiz regroupés dans CONFIG (section 5.2 et 5.3)
  const CONFIG = Object.freeze({
    MASTERY_STREAK: 3, // 3 bonnes réponses d'affilée -> maîtrisé
    REVIEW_CLEAR_STREAK: 2, // 2 bonnes réponses d'affilée en mode révision -> retiré des erreurs
    RECENT_HISTORY_SIZE: 8, // Ne pas reposer un des 8 derniers mots
    CHOICES_COUNT: 4, // 1 bonne réponse + 3 distracteurs
  });

  /**
   * Normalise une chaîne pour comparaison : minuscules, sans accents, espaces normalisés.
   */
  function normalizeText(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Retourne les formes normalisées d'une traduction :
   * avec parenthèses et sans le texte entre parenthèses (section 5.2 v2.1).
   */
  function getComparisonVariants(value) {
    const full = normalizeText(value);
    const variants = new Set();
    if (full) {
      variants.add(full);
    }
    const withoutParens = normalizeText(
      typeof value === "string" ? value.replace(/\([^)]*\)/g, " ") : ""
    );
    if (withoutParens) {
      variants.add(withoutParens);
    }
    return variants;
  }

  /**
   * Vrai si deux traductions sont équivalentes après normalisation (avec ou sans parenthèses).
   */
  function translationsMatch(a, b) {
    const varsA = getComparisonVariants(a);
    const varsB = getComparisonVariants(b);
    for (const v of varsA) {
      if (varsB.has(v)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Vrai si deux mots partagent au moins une traduction dans leur tableau `fr`.
   */
  function wordsShareTranslation(wordA, wordB) {
    if (!wordA || !wordB || !Array.isArray(wordA.fr) || !Array.isArray(wordB.fr)) {
      return false;
    }
    for (const tA of wordA.fr) {
      for (const tB of wordB.fr) {
        if (translationsMatch(tA, tB)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Vrai si une traduction donnée figure n'importe où dans `word.fr`.
   */
  function translationInWord(frText, word) {
    if (!word || !Array.isArray(word.fr)) {
      return false;
    }
    return word.fr.some((t) => translationsMatch(frText, t));
  }

  /**
   * Retourne l'identifiant du palier auquel appartient un rang donné.
   */
  function getTierIdForRank(rank) {
    for (const id of TIER_ORDER) {
      const tier = TIERS[id];
      if (rank >= tier.min && rank <= tier.max) {
        return id;
      }
    }
    return "all";
  }

  /**
   * Filtre les mots appartenant au palier demandé.
   */
  function getWordsForTier(allWords, tierId) {
    if (!Array.isArray(allWords)) {
      return [];
    }
    const tier = TIERS[tierId] || TIERS.all;
    if (tier.id === "all") {
      return allWords.slice();
    }
    return allWords.filter((w) => w.rank >= tier.min && w.rank <= tier.max);
  }

  /**
   * Crée un état initial vide conforme au schéma ngslQuiz.v1 (section 6).
   */
  function createInitialState() {
    return {
      version: DATA_VERSION,
      settings: {
        tier: "1-500",
        direction: "en-fr",
      },
      words: {},
      stats: {
        bestStreak: 0,
      },
    };
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  /**
   * Valide et assainit un objet importé (fichier JSON ou localStorage).
   * Vérifie version === 1, présence de words et stats (section 5.4 v2.2).
   */
  function validateImportedData(data) {
    if (!isPlainObject(data)) {
      return { valid: false, error: "Le fichier ne contient pas un objet JSON valide." };
    }
    if (data.version !== DATA_VERSION) {
      return {
        valid: false,
        error: "Version de sauvegarde non prise en charge (version 1 attendue).",
      };
    }
    if (!isPlainObject(data.words)) {
      return { valid: false, error: "Champ 'words' manquant ou invalide." };
    }
    if (!isPlainObject(data.stats)) {
      return { valid: false, error: "Champ 'stats' manquant ou invalide." };
    }

    const base = createInitialState();

    // Paramètres optionnels
    if (isPlainObject(data.settings)) {
      if (typeof data.settings.tier === "string" && TIERS[data.settings.tier]) {
        base.settings.tier = data.settings.tier;
      }
      if (data.settings.direction === "en-fr" || data.settings.direction === "fr-en") {
        base.settings.direction = data.settings.direction;
      }
    }

    // Mots
    for (const [rankKey, entry] of Object.entries(data.words)) {
      if (!isPlainObject(entry)) {
        continue;
      }
      base.words[String(rankKey)] = {
        seen: Number.isFinite(entry.seen) && entry.seen >= 0 ? Math.floor(entry.seen) : 0,
        correct:
          Number.isFinite(entry.correct) && entry.correct >= 0 ? Math.floor(entry.correct) : 0,
        streak: Number.isFinite(entry.streak) && entry.streak >= 0 ? Math.floor(entry.streak) : 0,
        inErrors: Boolean(entry.inErrors),
        reviewStreak:
          Number.isFinite(entry.reviewStreak) && entry.reviewStreak >= 0
            ? Math.floor(entry.reviewStreak)
            : 0,
      };
    }

    // Statistiques
    base.stats.bestStreak =
      Number.isFinite(data.stats.bestStreak) && data.stats.bestStreak >= 0
        ? Math.floor(data.stats.bestStreak)
        : 0;

    return { valid: true, state: base };
  }

  /**
   * Parse une chaîne JSON issue du localStorage.
   * Si illisible ou invalide, repart d'un état vide sans planter (section 6).
   */
  function parseStoredState(rawJson) {
    if (typeof rawJson !== "string" || !rawJson.trim()) {
      return createInitialState();
    }
    try {
      const parsed = JSON.parse(rawJson);
      const result = validateImportedData(parsed);
      return result.valid ? result.state : createInitialState();
    } catch (_err) {
      return createInitialState();
    }
  }

  /**
   * Retourne la progression d'un mot donné (avec valeurs par défaut).
   */
  function getWordProgress(state, rank) {
    const entry = state && state.words ? state.words[String(rank)] : null;
    if (!entry) {
      return { seen: 0, correct: 0, streak: 0, inErrors: false, reviewStreak: 0 };
    }
    return {
      seen: entry.seen || 0,
      correct: entry.correct || 0,
      streak: entry.streak || 0,
      inErrors: Boolean(entry.inErrors),
      reviewStreak: entry.reviewStreak || 0,
    };
  }

  /**
   * Vrai si un mot est considéré comme maîtrisé (section 5.3).
   */
  function isWordMastered(state, rank) {
    return getWordProgress(state, rank).streak >= CONFIG.MASTERY_STREAK;
  }

  /**
   * Retourne la liste des mots actuellement dans les erreurs à réviser.
   */
  function getErrorWords(allWords, state) {
    if (!Array.isArray(allWords) || !state || !state.words) {
      return [];
    }
    return allWords.filter((w) => {
      const entry = state.words[String(w.rank)];
      return Boolean(entry && entry.inErrors);
    });
  }

  /**
   * Enregistre une réponse utilisateur et retourne le nouvel état et les métadonnées.
   */
  function recordAnswer(state, rank, isCorrect, options) {
    const opts = options || {};
    const isReviewMode = Boolean(opts.isReviewMode);
    const currentSessionStreak = Number.isFinite(opts.currentSessionStreak)
      ? opts.currentSessionStreak
      : 0;

    const prev = getWordProgress(state, rank);
    const wasMastered = prev.streak >= CONFIG.MASTERY_STREAK;
    const wasInErrors = prev.inErrors;

    const nextEntry = {
      seen: prev.seen + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
      streak: isCorrect ? prev.streak + 1 : 0,
      inErrors: isCorrect ? prev.inErrors : true,
      reviewStreak: prev.reviewStreak,
    };

    if (isCorrect) {
      if (isReviewMode && prev.inErrors) {
        nextEntry.reviewStreak = prev.reviewStreak + 1;
        if (nextEntry.reviewStreak >= CONFIG.REVIEW_CLEAR_STREAK) {
          nextEntry.inErrors = false;
          nextEntry.reviewStreak = 0;
        }
      }
    } else {
      nextEntry.reviewStreak = 0;
    }

    const nextSessionStreak = isCorrect ? currentSessionStreak + 1 : 0;
    const prevBest = state && state.stats && Number.isFinite(state.stats.bestStreak)
      ? state.stats.bestStreak
      : 0;

    const nextState = {
      version: DATA_VERSION,
      settings: {
        tier: (state && state.settings && state.settings.tier) || "1-500",
        direction: (state && state.settings && state.settings.direction) || "en-fr",
      },
      words: Object.assign({}, state && state.words ? state.words : {}, {
        [String(rank)]: nextEntry,
      }),
      stats: {
        bestStreak: Math.max(prevBest, nextSessionStreak),
      },
    };

    return {
      state: nextState,
      nextSessionStreak,
      becameMastered: !wasMastered && nextEntry.streak >= CONFIG.MASTERY_STREAK,
      clearedFromErrors: wasInErrors && !nextEntry.inErrors,
    };
  }

  /**
   * Mélange de Fisher-Yates (non destructif).
   */
  function shuffle(array, rng) {
    const randomFn = typeof rng === "function" ? rng : Math.random;
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  /**
   * Choisit le prochain mot à poser (section 5.2 v2.2) :
   * - ne pas reposer un des 8 derniers mots ;
   * - tirer en priorité parmi les mots non maîtrisés ;
   * - signaler quand tout le palier est maîtrisé.
   */
  function selectNextWord(poolWords, state, recentRanks, options) {
    const opts = options || {};
    const allowMastered = Boolean(opts.allowMastered);
    const isReviewMode = Boolean(opts.isReviewMode);
    const rng = typeof opts.rng === "function" ? opts.rng : Math.random;

    if (!Array.isArray(poolWords) || poolWords.length === 0) {
      return { word: null, allMastered: false, empty: true };
    }

    let candidates = poolWords;
    let allMastered = false;

    if (!isReviewMode) {
      const unmastered = poolWords.filter((w) => !isWordMastered(state, w.rank));
      allMastered = unmastered.length === 0;
      if (allMastered && !allowMastered) {
        return { word: null, allMastered: true, empty: false };
      }
      candidates = unmastered.length > 0 ? unmastered : poolWords;
    }

    const recentList = Array.isArray(recentRanks)
      ? recentRanks.slice(-CONFIG.RECENT_HISTORY_SIZE)
      : [];
    const recentSet = new Set(recentList);

    let eligible = candidates.filter((w) => !recentSet.has(w.rank));

    // Si tous les candidats figurent dans les 8 derniers (petit pool),
    // éviter au minimum le tout dernier mot si possible.
    if (eligible.length === 0) {
      const lastRank = recentList.length > 0 ? recentList[recentList.length - 1] : null;
      const notLast = candidates.filter((w) => w.rank !== lastRank);
      eligible = notLast.length > 0 ? notLast : candidates;
    }

    const chosen = eligible[Math.floor(rng() * eligible.length)];
    return { word: chosen, allMastered, empty: false };
  }

  /**
   * Construit une question QCM (1 bonne réponse + 3 distracteurs) selon toutes les règles
   * de la section 5.2 (v2 et v2.1).
   */
  function buildQuestion(targetWord, allWords, options) {
    const opts = options || {};
    const direction = opts.direction === "fr-en" ? "fr-en" : "en-fr";
    const rng = typeof opts.rng === "function" ? opts.rng : Math.random;

    const targetTierId = getTierIdForRank(targetWord.rank);
    const isEnToFr = direction === "en-fr";

    const correctLabel = isEnToFr ? targetWord.fr_main : targetWord.en;
    const prompt = isEnToFr ? targetWord.en : targetWord.fr_main;

    const usedDisplayLabels = new Set([normalizeText(correctLabel)]);
    const usedFrMainNormalized = new Set([normalizeText(targetWord.fr_main)]);
    const selectedDistractors = [];
    const selectedRanks = new Set([targetWord.rank]);

    function isValidDistractor(candidate) {
      if (!candidate || selectedRanks.has(candidate.rank)) {
        return false;
      }

      // Règle 3 : exclure tout distracteur dont une traduction recoupe celles du mot cible
      if (wordsShareTranslation(targetWord, candidate)) {
        return false;
      }

      // Règle v2.1 FR -> EN : exclure si le fr_main du mot cible figure n'importe où dans candidate.fr
      if (!isEnToFr && translationInWord(targetWord.fr_main, candidate)) {
        return false;
      }

      // Règle 4 : exclure les doublons d'affichage
      const candidateDisplay = isEnToFr ? candidate.fr_main : candidate.en;
      const normDisplay = normalizeText(candidateDisplay);
      if (!normDisplay || usedDisplayLabels.has(normDisplay)) {
        return false;
      }

      // Règle FR -> EN : si plusieurs mots anglais partagent fr_main, n'en garder qu'un seul
      if (!isEnToFr) {
        const normFrMain = normalizeText(candidate.fr_main);
        if (usedFrMainNormalized.has(normFrMain)) {
          return false;
        }
      }

      return true;
    }

    function pickFrom(bucket) {
      const shuffled = shuffle(bucket, rng);
      for (const candidate of shuffled) {
        if (selectedDistractors.length >= CONFIG.CHOICES_COUNT - 1) {
          break;
        }
        if (isValidDistractor(candidate)) {
          selectedDistractors.push(candidate);
          selectedRanks.add(candidate.rank);
          usedDisplayLabels.add(normalizeText(isEnToFr ? candidate.fr_main : candidate.en));
          if (!isEnToFr) {
            usedFrMainNormalized.add(normalizeText(candidate.fr_main));
          }
        }
      }
    }

    const sameTier = allWords.filter(
      (w) => w.rank !== targetWord.rank && getTierIdForRank(w.rank) === targetTierId
    );
    const otherTiers = allWords.filter(
      (w) => w.rank !== targetWord.rank && getTierIdForRank(w.rank) !== targetTierId
    );

    // Ordre de priorité :
    // 1. Même palier + même pos
    pickFrom(sameTier.filter((w) => w.pos === targetWord.pos));
    // 2. Même palier + autre pos
    if (selectedDistractors.length < CONFIG.CHOICES_COUNT - 1) {
      pickFrom(sameTier.filter((w) => w.pos !== targetWord.pos));
    }
    // 3. Tout le corpus + même pos
    if (selectedDistractors.length < CONFIG.CHOICES_COUNT - 1) {
      pickFrom(otherTiers.filter((w) => w.pos === targetWord.pos));
    }
    // 4. Tout le corpus + autre pos
    if (selectedDistractors.length < CONFIG.CHOICES_COUNT - 1) {
      pickFrom(otherTiers.filter((w) => w.pos !== targetWord.pos));
    }

    const rawChoices = [
      {
        label: correctLabel,
        rank: targetWord.rank,
        isCorrect: true,
        word: targetWord,
      },
      ...selectedDistractors.map((d) => ({
        label: isEnToFr ? d.fr_main : d.en,
        rank: d.rank,
        isCorrect: false,
        word: d,
      })),
    ];

    return {
      targetWord,
      direction,
      prompt,
      choices: shuffle(rawChoices, rng),
    };
  }

  /**
   * Calcule les statistiques globales et du palier courant.
   * Le % global est toujours calculé sur allWords.length (section 5.4 v2.2).
   */
  function computeStats(allWords, state, tierId) {
    const totalWords = Array.isArray(allWords) ? allWords.length : 0;
    const masteredGlobalCount = totalWords
      ? allWords.filter((w) => isWordMastered(state, w.rank)).length
      : 0;
    const masteredGlobalPercent = totalWords
      ? Math.round((masteredGlobalCount / totalWords) * 100)
      : 0;

    const tierWords = getWordsForTier(allWords, tierId);
    const tierTotal = tierWords.length;
    const masteredTierCount = tierTotal
      ? tierWords.filter((w) => isWordMastered(state, w.rank)).length
      : 0;
    const masteredTierPercent = tierTotal
      ? Math.round((masteredTierCount / tierTotal) * 100)
      : 0;

    const errorsCount = getErrorWords(allWords, state).length;
    const bestStreak =
      state && state.stats && Number.isFinite(state.stats.bestStreak)
        ? state.stats.bestStreak
        : 0;

    return {
      totalWords,
      masteredGlobalCount,
      masteredGlobalPercent,
      tierTotal,
      masteredTierCount,
      masteredTierPercent,
      errorsCount,
      bestStreak,
    };
  }

  const api = {
    STORAGE_KEY,
    DATA_VERSION,
    TIERS,
    TIER_ORDER,
    CONFIG,
    normalizeText,
    getComparisonVariants,
    translationsMatch,
    wordsShareTranslation,
    translationInWord,
    getTierIdForRank,
    getWordsForTier,
    createInitialState,
    validateImportedData,
    parseStoredState,
    getWordProgress,
    isWordMastered,
    getErrorWords,
    recordAnswer,
    selectNextWord,
    buildQuestion,
    computeStats,
  };

  if (typeof root !== "undefined") {
    root.NGSL_LOGIC = api;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
