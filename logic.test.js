"use strict";

const assert = require("assert");
const logic = require("./logic.js");
const sampleWords = require("./data/words.js");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Générateur pseudo-aléatoire déterministe pour des tests reproductibles
function createSeededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

console.log("Exécution des tests unitaires logic.test.js...\n");

test("Les paliers couvrent exactement les rangs 1 à 2 809 sans trou ni chevauchement", () => {
  let expectedMin = 1;
  for (const id of logic.TIER_ORDER) {
    const tier = logic.TIERS[id];
    assert.strictEqual(tier.min, expectedMin);
    assert.ok(tier.max >= tier.min);
    expectedMin = tier.max + 1;
  }
  assert.strictEqual(expectedMin - 1, 2809);
  assert.strictEqual(logic.getTierIdForRank(1), "1-500");
  assert.strictEqual(logic.getTierIdForRank(500), "1-500");
  assert.strictEqual(logic.getTierIdForRank(501), "501-1000");
  assert.strictEqual(logic.getTierIdForRank(1000), "501-1000");
  assert.strictEqual(logic.getTierIdForRank(1001), "1001-2000");
  assert.strictEqual(logic.getTierIdForRank(2000), "1001-2000");
  assert.strictEqual(logic.getTierIdForRank(2001), "2001-2809");
  assert.strictEqual(logic.getTierIdForRank(2809), "2001-2809");
});

test("Normalisation : casse, accents, espaces et parenthèses", () => {
  assert.strictEqual(logic.normalizeText("  Éviter   vite "), "eviter vite");
  assert.strictEqual(logic.translationsMatch("pouvoir", "pouvoir (faire)"), true);
  assert.strictEqual(logic.translationsMatch("Savoir", "savoir (faire)"), true);
  assert.strictEqual(logic.translationsMatch("temps", "temps (climat)"), true);
  assert.strictEqual(logic.translationsMatch("pouvoir", "vouloir"), false);
});

test("Distracteurs EN -> FR : jamais deux réponses valables ni de doublons d'affichage", () => {
  const rng = createSeededRng(42);
  const passes = sampleWords.length > 200 ? 2 : 20;
  for (let i = 0; i < passes; i++) {
    for (const word of sampleWords) {
      const q = logic.buildQuestion(word, sampleWords, { direction: "en-fr", rng });
      assert.strictEqual(q.choices.length, 4);
      assert.strictEqual(q.choices.filter((c) => c.isCorrect).length, 1);

      const seenLabels = new Set();
      for (const choice of q.choices) {
        const norm = logic.normalizeText(choice.label);
        assert.strictEqual(seenLabels.has(norm), false, `Doublon d'affichage pour ${word.en}`);
        seenLabels.add(norm);

        if (!choice.isCorrect) {
          assert.strictEqual(
            logic.wordsShareTranslation(word, choice.word),
            false,
            `Distracteur synonyme ${choice.word.en} proposé pour ${word.en}`
          );
        }
      }
    }
  }
});

test("Distracteurs EN -> FR : exclut spécifiquement les paires synonymes (big/large, work/run)", () => {
  const big = sampleWords.find((w) => w.en === "big");
  const work = sampleWords.find((w) => w.en === "work");
  const rng = createSeededRng(123);

  for (let i = 0; i < 50; i++) {
    const qBig = logic.buildQuestion(big, sampleWords, { direction: "en-fr", rng });
    assert.strictEqual(
      qBig.choices.some((c) => c.word.en === "large"),
      false,
      "large ne doit jamais être distracteur de big"
    );

    const qWork = logic.buildQuestion(work, sampleWords, { direction: "en-fr", rng });
    assert.strictEqual(
      qWork.choices.some((c) => c.word.en === "run"),
      false,
      "run ne doit jamais être distracteur de work (recoupement sur 'fonctionner')"
    );
  }
});

test("Distracteurs FR -> EN : exclut un mot si le fr_main cible figure dans son tableau fr (même hors fr_main)", () => {
  const timeWord = sampleWords.find((w) => w.en === "time"); // fr_main = "temps"
  const weatherWord = sampleWords.find((w) => w.en === "weather"); // fr = ["météo", "temps (climat)"]
  assert.ok(timeWord && weatherWord);

  // Petit corpus forcé contenant time, weather et 3 autres mots
  const miniCorpus = [
    timeWord,
    weatherWord,
    sampleWords.find((w) => w.en === "house"),
    sampleWords.find((w) => w.en === "world"),
    sampleWords.find((w) => w.en === "water"),
  ];

  const rng = createSeededRng(7);
  for (let i = 0; i < 30; i++) {
    const q = logic.buildQuestion(timeWord, miniCorpus, { direction: "fr-en", rng });
    assert.strictEqual(q.choices.length, 4);
    assert.strictEqual(
      q.choices.some((c) => c.word.en === "weather"),
      false,
      "weather doit être exclu en FR -> EN pour 'temps'"
    );
  }
});

test("Distracteurs FR -> EN : ne garde qu'un seul mot anglais si deux partagent fr_main", () => {
  const rng = createSeededRng(99);
  for (const word of sampleWords) {
    const q = logic.buildQuestion(word, sampleWords, { direction: "fr-en", rng });
    const frMains = q.choices.map((c) => logic.normalizeText(c.word.fr_main));
    assert.strictEqual(
      new Set(frMains).size,
      frMains.length,
      `Deux choix partagent le même fr_main pour ${word.en}`
    );
  }
});

test("Distracteurs : priorité au même palier et même pos, avec repli si pas assez de candidats", () => {
  // Un verbe dans un palier disposant d'au moins 4 verbes distincts
  const borrow = sampleWords.find((w) => w.en === "borrow");
  const expectedTier = logic.getTierIdForRank(borrow.rank);
  const qBorrow = logic.buildQuestion(borrow, sampleWords, {
    direction: "en-fr",
    rng: createSeededRng(5),
  });
  for (const choice of qBorrow.choices) {
    assert.strictEqual(logic.getTierIdForRank(choice.word.rank), expectedTier);
    assert.strictEqual(choice.word.pos, "verb");
  }

  // Repli sur un mini-corpus où le mot cible est seul de son pos
  const can = sampleWords.find((w) => w.en === "can");
  const miniCorpus = [
    can,
    sampleWords.find((w) => w.en === "house"),
    sampleWords.find((w) => w.en === "world"),
    sampleWords.find((w) => w.en === "water"),
  ];
  const qCan = logic.buildQuestion(can, miniCorpus, {
    direction: "en-fr",
    rng: createSeededRng(5),
  });
  assert.strictEqual(qCan.choices.length, 4);
});

test("Sélection du mot : exclut les 8 derniers mots, privilégie les non maîtrisés et détecte la maîtrise totale", () => {
  const tier1 = logic.getWordsForTier(sampleWords, "1-500"); // 13 mots
  const state = logic.createInitialState();
  const recentRanks = tier1.slice(0, 8).map((w) => w.rank);
  const rng = createSeededRng(11);

  for (let i = 0; i < 30; i++) {
    const res = logic.selectNextWord(tier1, state, recentRanks, { rng });
    assert.ok(res.word);
    assert.strictEqual(
      recentRanks.includes(res.word.rank),
      false,
      "Un mot des 8 derniers ne doit pas être reposé"
    );
  }

  // Marquer tous les mots du palier 1 comme maîtrisés
  for (const w of tier1) {
    state.words[String(w.rank)] = { seen: 3, correct: 3, streak: 3, inErrors: false };
  }

  const resStopped = logic.selectNextWord(tier1, state, [], { allowMastered: false, rng });
  assert.strictEqual(resStopped.allMastered, true);
  assert.strictEqual(resStopped.word, null);

  const resContinue = logic.selectNextWord(tier1, state, [], { allowMastered: true, rng });
  assert.strictEqual(resContinue.allMastered, true);
  assert.ok(resContinue.word);
});

test("Règles de maîtrise et de révision des erreurs", () => {
  let state = logic.createInitialState();
  let streak = 0;

  // 3 bonnes réponses d'affilée -> maîtrisé
  for (let i = 0; i < 3; i++) {
    const res = logic.recordAnswer(state, 25, true, {
      isReviewMode: false,
      currentSessionStreak: streak,
    });
    state = res.state;
    streak = res.nextSessionStreak;
  }
  assert.strictEqual(logic.isWordMastered(state, 25), true);
  assert.strictEqual(state.stats.bestStreak, 3);

  // 1 mauvaise réponse -> streak = 0, ajouté aux erreurs
  let res = logic.recordAnswer(state, 25, false, {
    isReviewMode: false,
    currentSessionStreak: streak,
  });
  state = res.state;
  streak = res.nextSessionStreak;
  assert.strictEqual(logic.isWordMastered(state, 25), false);
  assert.strictEqual(logic.getWordProgress(state, 25).inErrors, true);
  assert.strictEqual(streak, 0);
  assert.strictEqual(state.stats.bestStreak, 3);

  // 1 bonne réponse en mode normal ne retire pas le mot des erreurs
  res = logic.recordAnswer(state, 25, true, { isReviewMode: false, currentSessionStreak: streak });
  state = res.state;
  streak = res.nextSessionStreak;
  assert.strictEqual(logic.getWordProgress(state, 25).inErrors, true);

  // 2 bonnes réponses d'affilée en mode révision -> retiré des erreurs
  res = logic.recordAnswer(state, 25, true, { isReviewMode: true, currentSessionStreak: streak });
  state = res.state;
  streak = res.nextSessionStreak;
  assert.strictEqual(logic.getWordProgress(state, 25).inErrors, true);

  res = logic.recordAnswer(state, 25, true, { isReviewMode: true, currentSessionStreak: streak });
  state = res.state;
  assert.strictEqual(logic.getWordProgress(state, 25).inErrors, false);
  assert.strictEqual(res.clearedFromErrors, true);
});

test("Statistiques calculées sur allWords.length (jamais 2 809 codé en dur)", () => {
  // Sous-ensemble de 50 mots : 5 maîtrisés = 10 %
  const subset50 = sampleWords.slice(0, 50);
  const state = logic.createInitialState();
  for (const w of subset50.slice(0, 5)) {
    state.words[String(w.rank)] = { seen: 3, correct: 3, streak: 3, inErrors: false };
  }
  const statsSubset = logic.computeStats(subset50, state, "1-500");
  assert.strictEqual(statsSubset.totalWords, 50);
  assert.strictEqual(statsSubset.masteredGlobalCount, 5);
  assert.strictEqual(statsSubset.masteredGlobalPercent, 10);

  // Sur le corpus complet courant (2 809 mots en phase 2)
  const statsFull = logic.computeStats(sampleWords, state, "1-500");
  assert.strictEqual(statsFull.totalWords, sampleWords.length);
  assert.strictEqual(statsFull.masteredGlobalCount, 5);
  assert.strictEqual(
    statsFull.tierTotal,
    logic.getWordsForTier(sampleWords, "1-500").length
  );
});

test("Persistance et validation de l'import JSON", () => {
  // Données corrompues -> état vide sans planter
  const fallback = logic.parseStoredState("{json cassé");
  assert.strictEqual(fallback.version, 1);
  assert.deepStrictEqual(fallback.words, {});

  // Import invalide : mauvaise version
  const badVersion = logic.validateImportedData({ version: 2, words: {}, stats: {} });
  assert.strictEqual(badVersion.valid, false);

  // Import invalide : stats manquant
  const noStats = logic.validateImportedData({ version: 1, words: {} });
  assert.strictEqual(noStats.valid, false);

  // Import valide
  const valid = logic.validateImportedData({
    version: 1,
    settings: { tier: "501-1000", direction: "fr-en", theme: "dark" },
    words: { "25": { seen: 4, correct: 3, streak: 2, inErrors: false } },
    stats: { bestStreak: 14 },
  });
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.state.settings.tier, "501-1000");
  assert.strictEqual(valid.state.settings.theme, "dark");
  assert.strictEqual(valid.state.stats.bestStreak, 14);

  // Rétrocompatibilité : ancienne sauvegarde sans champ theme -> "auto"
  const legacy = logic.validateImportedData({
    version: 1,
    settings: { tier: "1-500", direction: "en-fr" },
    words: {},
    stats: { bestStreak: 0 },
  });
  assert.strictEqual(legacy.valid, true);
  assert.strictEqual(legacy.state.settings.theme, "auto");

  // Préservation du thème après recordAnswer
  const afterAnswer = logic.recordAnswer(valid.state, 25, true, {
    isReviewMode: false,
    currentSessionStreak: 0,
  });
  assert.strictEqual(afterAnswer.state.settings.theme, "dark");
});

console.log(`\nRésultat : ${passed} réussi(s), ${failed} échoué(s).`);
if (failed > 0) {
  process.exit(1);
}
