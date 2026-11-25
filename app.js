/*
 * Interface et interactions utilisateur du Quiz NGSL (Phase 1).
 * Fonctionne hors ligne (file://) sans modules ES ni dépendance externe.
 */
(function () {
  "use strict";

  const words = Array.isArray(window.NGSL_WORDS) ? window.NGSL_WORDS : [];
  const logic = window.NGSL_LOGIC;

  if (!logic || words.length === 0) {
    document.body.innerHTML =
      "<p style='font-family:sans-serif;padding:24px;'>Erreur : impossible de charger les données ou la logique du quiz.</p>";
    return;
  }

  // Libellés lisibles pour la nature grammaticale révélée après réponse
  const POS_LABELS = {
    noun: "nom",
    verb: "verbe",
    adj: "adjectif",
    adv: "adverbe",
    modal: "modal",
    prep: "préposition",
    det: "déterminant",
    pron: "pronom",
    conj: "conjonction",
    interj: "interjection",
  };

  // Références DOM
  const els = {
    quizCard: document.getElementById("quiz-card"),
    modeBadge: document.getElementById("mode-badge"),
    themeBtn: document.getElementById("theme-btn"),
    tierSelect: document.getElementById("tier-select"),
    directionBtn: document.getElementById("direction-btn"),
    reviewBtn: document.getElementById("review-btn"),
    reviewEmptyHint: document.getElementById("review-empty-hint"),
    progressLabel: document.getElementById("progress-label"),
    progressPercent: document.getElementById("progress-percent"),
    progressTrack: document.getElementById("progress-track"),
    progressFill: document.getElementById("progress-fill"),
    sessionScore: document.getElementById("session-score"),
    sessionStreak: document.getElementById("session-streak"),
    questionArea: document.getElementById("question-area"),
    targetWord: document.getElementById("target-word"),
    posTag: document.getElementById("pos-tag"),
    rankPill: document.getElementById("rank-pill"),
    masteryIndicator: document.getElementById("mastery-indicator"),
    choicesGrid: document.getElementById("choices-grid"),
    feedbackZone: document.getElementById("feedback-zone"),
    feedbackPlaceholder: document.getElementById("feedback-placeholder"),
    feedbackContent: document.getElementById("feedback-content"),
    feedbackStatus: document.getElementById("feedback-status"),
    feedbackTranslations: document.getElementById("feedback-translations"),
    nextBtn: document.getElementById("next-btn"),
    specialState: document.getElementById("special-state"),
    specialTitle: document.getElementById("special-title"),
    specialSubtitle: document.getElementById("special-subtitle"),
    specialActionBtn: document.getElementById("special-action-btn"),
    statGlobal: document.getElementById("stat-global"),
    statTier: document.getElementById("stat-tier"),
    statErrors: document.getElementById("stat-errors"),
    statBestStreak: document.getElementById("stat-best-streak"),
    exportBtn: document.getElementById("export-btn"),
    importBtn: document.getElementById("import-btn"),
    importFileInput: document.getElementById("import-file-input"),
    resetBtn: document.getElementById("reset-btn"),
    backupMessage: document.getElementById("backup-message"),
  };

  // État en mémoire de la session
  let state = loadState();
  let isReviewMode = false;
  let allowMasteredOverride = false;
  let currentQuestion = null;
  let isLocked = false; // Verrouillage après réponse jusqu'à "Suivant" (section 5.2 v2.2)
  let recentRanks = [];
  let sessionAnswered = 0;
  let sessionCorrect = 0;
  let sessionStreak = 0;

  function loadState() {
    try {
      const raw = window.localStorage.getItem(logic.STORAGE_KEY);
      return logic.parseStoredState(raw);
    } catch (_err) {
      return logic.createInitialState();
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(logic.STORAGE_KEY, JSON.stringify(state));
    } catch (_err) {
      // Ignorer silencieusement si localStorage est indisponible
    }
  }

  const systemDarkQuery = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

  function getEffectiveTheme() {
    const pref = state && state.settings ? state.settings.theme : "auto";
    if (pref === "dark" || pref === "light") {
      return pref;
    }
    return systemDarkQuery && systemDarkQuery.matches ? "dark" : "light";
  }

  function applyTheme() {
    const pref = state && state.settings ? state.settings.theme : "auto";
    if (pref === "dark" || pref === "light") {
      document.documentElement.setAttribute("data-theme", pref);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    const effective = getEffectiveTheme();
    els.themeBtn.textContent = effective === "dark" ? "☀️ Clair" : "🌙 Sombre";
    els.themeBtn.setAttribute(
      "aria-label",
      effective === "dark" ? "Passer au thème clair" : "Passer au thème sombre"
    );
  }

  function populateTierSelect() {
    els.tierSelect.innerHTML = "";
    const orderedIds = [...logic.TIER_ORDER, "all"];
    for (const id of orderedIds) {
      const tier = logic.TIERS[id];
      const option = document.createElement("option");
      option.value = tier.id;
      option.textContent = tier.label;
      els.tierSelect.appendChild(option);
    }
    els.tierSelect.value = state.settings.tier;
  }

  function updateHeaderAndStats() {
    const tierId = state.settings.tier;
    const stats = logic.computeStats(words, state, tierId);

    // Sens EN -> FR ou FR -> EN
    els.directionBtn.textContent =
      state.settings.direction === "en-fr" ? "EN → FR" : "FR → EN";

    // Bouton Révision (N)
    els.reviewBtn.textContent = `Révision (${stats.errorsCount})`;
    if (stats.errorsCount === 0 && !isReviewMode) {
      els.reviewBtn.disabled = true;
      els.reviewEmptyHint.textContent = "Aucune erreur à réviser";
    } else {
      els.reviewBtn.disabled = false;
      els.reviewEmptyHint.textContent = isReviewMode
        ? "Mode révision actif : 2 bonnes réponses d’affilée retirent un mot des erreurs."
        : "";
    }

    els.reviewBtn.classList.toggle("active", isReviewMode);
    els.quizCard.classList.toggle("review-mode", isReviewMode);
    els.modeBadge.hidden = !isReviewMode;
    els.tierSelect.disabled = isReviewMode;

    // Barre de progression
    if (isReviewMode) {
      els.progressLabel.textContent = `Révision : ${stats.errorsCount} erreur(s) restante(s)`;
      els.progressPercent.textContent = "";
      els.progressFill.style.width = stats.errorsCount === 0 ? "100%" : "0%";
      els.progressTrack.setAttribute("aria-valuenow", stats.errorsCount === 0 ? "100" : "0");
    } else {
      els.progressLabel.textContent = `Palier : ${stats.masteredTierCount} / ${stats.tierTotal} maîtrisés`;
      els.progressPercent.textContent = `${stats.masteredTierPercent} %`;
      els.progressFill.style.width = `${stats.masteredTierPercent}%`;
      els.progressTrack.setAttribute("aria-valuenow", String(stats.masteredTierPercent));
    }

    // Score (+ taux de réussite en direct) & série de la session
    if (sessionAnswered > 0) {
      const accuracy = Math.round((sessionCorrect / sessionAnswered) * 100);
      els.sessionScore.textContent = `Session : ${sessionCorrect} / ${sessionAnswered} · ${accuracy} %`;
    } else {
      els.sessionScore.textContent = "Session : 0 / 0";
    }
    els.sessionStreak.textContent = `🔥 Série : ${sessionStreak}`;

    // Panneau Tableau de bord
    els.statGlobal.textContent = `${stats.masteredGlobalPercent} % (${stats.masteredGlobalCount} / ${stats.totalWords})`;
    els.statTier.textContent = `${stats.masteredTierPercent} % (${stats.masteredTierCount} / ${stats.tierTotal})`;
    els.statErrors.textContent = String(stats.errorsCount);
    els.statBestStreak.textContent = String(stats.bestStreak);
  }

  function showSpecialState(title, subtitle, buttonLabel, onClick) {
    currentQuestion = null;
    isLocked = false;
    els.questionArea.hidden = true;
    els.specialState.hidden = false;
    els.specialTitle.textContent = title;
    els.specialSubtitle.textContent = subtitle;
    els.specialActionBtn.textContent = buttonLabel;
    els.specialActionBtn.onclick = onClick;
  }

  function resetFeedbackZone() {
    els.feedbackZone.classList.remove("feedback-correct", "feedback-wrong");
    els.feedbackPlaceholder.hidden = false;
    els.feedbackContent.hidden = true;
    els.posTag.classList.remove("visible");
    els.posTag.setAttribute("aria-hidden", "true");
    els.posTag.textContent = "";
    els.rankPill.classList.remove("visible");
    els.rankPill.setAttribute("aria-hidden", "true");
    els.rankPill.textContent = "";
    els.masteryIndicator.classList.remove("visible", "is-mastered");
    els.masteryIndicator.setAttribute("aria-hidden", "true");
    els.masteryIndicator.innerHTML = "";
  }

  function renderMasteryIndicator(rank) {
    const progress = logic.getWordProgress(state, rank);
    const maxDots = logic.CONFIG.MASTERY_STREAK;
    const filled = Math.min(progress.streak, maxDots);
    const mastered = filled >= maxDots;

    els.masteryIndicator.innerHTML = "";
    const dotsWrap = document.createElement("span");
    dotsWrap.className = "mastery-dots";
    for (let i = 0; i < maxDots; i++) {
      const dot = document.createElement("span");
      dot.className = i < filled ? "mastery-dot filled" : "mastery-dot";
      dotsWrap.appendChild(dot);
    }

    const textSpan = document.createElement("span");
    textSpan.textContent = mastered ? `${filled}/${maxDots} maîtrisé` : `${filled}/${maxDots}`;

    els.masteryIndicator.appendChild(dotsWrap);
    els.masteryIndicator.appendChild(textSpan);
    els.masteryIndicator.classList.toggle("is-mastered", mastered);
    els.masteryIndicator.classList.add("visible");
    els.masteryIndicator.setAttribute("aria-hidden", "false");
  }

  function renderNextQuestion() {
    updateHeaderAndStats();

    const pool = isReviewMode
      ? logic.getErrorWords(words, state)
      : logic.getWordsForTier(words, state.settings.tier);

    if (isReviewMode && pool.length === 0) {
      showSpecialState(
        "Aucune erreur à réviser",
        "Toutes les erreurs de ta liste ont été corrigées.",
        "Retour au quiz",
        function () {
          isReviewMode = false;
          allowMasteredOverride = false;
          renderNextQuestion();
        }
      );
      return;
    }

    const selection = logic.selectNextWord(pool, state, recentRanks, {
      allowMastered: allowMasteredOverride,
      isReviewMode,
    });

    if (selection.allMastered && !allowMasteredOverride && !isReviewMode) {
      showSpecialState(
        "Palier entièrement maîtrisé !",
        "Tu as atteint 3 bonnes réponses d’affilée pour tous les mots de ce palier.",
        "Continuer quand même",
        function () {
          allowMasteredOverride = true;
          renderNextQuestion();
        }
      );
      return;
    }

    if (!selection.word) {
      showSpecialState(
        "Aucun mot disponible",
        "Ce palier ne contient aucun mot dans l’échantillon actuel.",
        "Voir tous les mots",
        function () {
          state.settings.tier = "all";
          els.tierSelect.value = "all";
          saveState();
          renderNextQuestion();
        }
      );
      return;
    }

    // Mémoriser dans l'historique des 8 derniers mots
    recentRanks.push(selection.word.rank);
    if (recentRanks.length > logic.CONFIG.RECENT_HISTORY_SIZE) {
      recentRanks = recentRanks.slice(-logic.CONFIG.RECENT_HISTORY_SIZE);
    }

    currentQuestion = logic.buildQuestion(selection.word, words, {
      direction: state.settings.direction,
    });
    isLocked = false;

    els.specialState.hidden = true;
    els.questionArea.hidden = false;
    els.targetWord.textContent = currentQuestion.prompt;
    resetFeedbackZone();

    // Rendu des 4 boutons en grille 2x2
    els.choicesGrid.innerHTML = "";
    currentQuestion.choices.forEach(function (choice, index) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.dataset.index = String(index);

      const keySpan = document.createElement("span");
      keySpan.className = "choice-key";
      keySpan.textContent = String(index + 1);

      const labelSpan = document.createElement("span");
      labelSpan.className = "choice-label";
      labelSpan.textContent = choice.label;

      const iconSpan = document.createElement("span");
      iconSpan.className = "choice-icon";
      iconSpan.setAttribute("aria-hidden", "true");

      btn.appendChild(keySpan);
      btn.appendChild(labelSpan);
      btn.appendChild(iconSpan);

      btn.addEventListener("click", function () {
        handleAnswer(index);
      });

      els.choicesGrid.appendChild(btn);
    });
  }

  function handleAnswer(choiceIndex) {
    if (!currentQuestion || isLocked) {
      return;
    }
    const chosen = currentQuestion.choices[choiceIndex];
    if (!chosen) {
      return;
    }

    // Verrouillage immédiat des 4 boutons jusqu'à "Suivant" (v2.2)
    isLocked = true;

    const isCorrect = chosen.isCorrect;
    const target = currentQuestion.targetWord;

    sessionAnswered += 1;
    if (isCorrect) {
      sessionCorrect += 1;
    }

    const prevBestStreak = state.stats.bestStreak || 0;
    const result = logic.recordAnswer(state, target.rank, isCorrect, {
      isReviewMode,
      currentSessionStreak: sessionStreak,
    });
    state = result.state;
    sessionStreak = result.nextSessionStreak;
    const isNewRecord =
      isCorrect && sessionStreak >= 3 && sessionStreak > prevBestStreak;
    saveState();

    // Révéler le pos, le rang de fréquence et l'indicateur de maîtrise après réponse (section 10)
    els.posTag.textContent = POS_LABELS[target.pos] || target.pos;
    els.posTag.classList.add("visible");
    els.posTag.setAttribute("aria-hidden", "false");
    els.rankPill.textContent = `#${target.rank}`;
    els.rankPill.classList.add("visible");
    els.rankPill.setAttribute("aria-hidden", "false");
    renderMasteryIndicator(target.rank);

    // Colorer et ajouter les icônes ✓ / ✗ sur les boutons
    const buttons = els.choicesGrid.querySelectorAll(".choice-btn");
    buttons.forEach(function (btn, idx) {
      const choice = currentQuestion.choices[idx];
      const iconEl = btn.querySelector(".choice-icon");
      btn.disabled = true;

      if (choice.isCorrect) {
        btn.classList.add("is-correct");
        iconEl.textContent = "✓";
      } else if (idx === choiceIndex) {
        btn.classList.add("is-wrong");
        iconEl.textContent = "✗";
      } else {
        btn.classList.add("is-dimmed");
      }
    });

    // Zone de résultat de hauteur fixe
    els.feedbackPlaceholder.hidden = true;
    els.feedbackContent.hidden = false;
    els.feedbackZone.classList.toggle("feedback-correct", isCorrect);
    els.feedbackZone.classList.toggle("feedback-wrong", !isCorrect);

    const statusIcon = isCorrect ? "✓" : "✗";
    const statusBase = isCorrect ? "Bonne réponse !" : "Mauvaise réponse.";
    let extra = "";
    if (result.clearedFromErrors) {
      extra = " Mot retiré des erreurs !";
    } else if (result.becameMastered) {
      extra = " Mot maîtrisé !";
    } else if (isNewRecord) {
      extra = " Nouveau record de série !";
    }
    els.feedbackStatus.textContent = `${statusIcon} ${statusBase}${extra}`;

    // Afficher la bonne réponse et toutes ses traductions (fr)
    const allFr = target.fr.join(", ");
    els.feedbackTranslations.textContent = `${target.en} — ${allFr}`;

    updateHeaderAndStats();

    // Micro-animation pop sur le badge série en cas de bonne réponse
    if (isCorrect) {
      els.sessionStreak.classList.remove("is-pop");
      void els.sessionStreak.offsetWidth;
      els.sessionStreak.classList.add("is-pop");
    }

    els.nextBtn.focus({ preventScroll: true });
  }

  function showBackupMessage(text, isError) {
    els.backupMessage.textContent = text;
    els.backupMessage.classList.toggle("msg-err", Boolean(isError));
    els.backupMessage.classList.toggle("msg-ok", !isError);
  }

  // Événements des contrôles
  els.themeBtn.addEventListener("click", function () {
    const effective = getEffectiveTheme();
    state.settings.theme = effective === "dark" ? "light" : "dark";
    saveState();
    applyTheme();
  });

  if (systemDarkQuery && typeof systemDarkQuery.addEventListener === "function") {
    systemDarkQuery.addEventListener("change", function () {
      if (state.settings.theme === "auto") {
        applyTheme();
      }
    });
  }

  els.tierSelect.addEventListener("change", function () {
    state.settings.tier = els.tierSelect.value;
    allowMasteredOverride = false;
    saveState();
    renderNextQuestion();
  });

  els.directionBtn.addEventListener("click", function () {
    state.settings.direction =
      state.settings.direction === "en-fr" ? "fr-en" : "en-fr";
    saveState();
    renderNextQuestion();
  });

  els.reviewBtn.addEventListener("click", function () {
    if (els.reviewBtn.disabled) {
      return;
    }
    isReviewMode = !isReviewMode;
    allowMasteredOverride = false;
    renderNextQuestion();
  });

  els.nextBtn.addEventListener("click", function () {
    if (isLocked) {
      renderNextQuestion();
    }
  });

  // Raccourcis clavier : 1 à 4 pour répondre, Entrée pour question suivante (section 5.2 v2)
  document.addEventListener("keydown", function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
      return;
    }

    if (!currentQuestion) {
      return;
    }

    if (!isLocked && event.key >= "1" && event.key <= "4") {
      event.preventDefault();
      handleAnswer(Number(event.key) - 1);
      return;
    }

    if (isLocked && event.key === "Enter") {
      event.preventDefault();
      renderNextQuestion();
    }
  });

  // Export JSON
  els.exportBtn.addEventListener("click", function () {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ngsl-quiz-progression.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showBackupMessage("Progression exportée (ngsl-quiz-progression.json).", false);
  });

  // Import JSON avec validation stricte avant écrasement (section 5.4 v2.2)
  els.importBtn.addEventListener("click", function () {
    els.importFileInput.value = "";
    els.importFileInput.click();
  });

  els.importFileInput.addEventListener("change", function () {
    const file = els.importFileInput.files && els.importFileInput.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      try {
        const parsed = JSON.parse(String(reader.result));
        const validation = logic.validateImportedData(parsed);
        if (!validation.valid) {
          showBackupMessage(`Import refusé : ${validation.error}`, true);
          return;
        }
        state = validation.state;
        isReviewMode = false;
        allowMasteredOverride = false;
        els.tierSelect.value = state.settings.tier;
        applyTheme();
        saveState();
        showBackupMessage("Progression importée avec succès.", false);
        renderNextQuestion();
      } catch (_err) {
        showBackupMessage("Import refusé : fichier JSON illisible.", true);
      }
    };
    reader.readAsText(file, "utf-8");
  });

  // Réinitialisation avec confirmation (section 5.4)
  els.resetBtn.addEventListener("click", function () {
    const confirmed = window.confirm(
      "Voulez-vous vraiment réinitialiser toute votre progression ?"
    );
    if (!confirmed) {
      return;
    }
    state = logic.createInitialState();
    isReviewMode = false;
    allowMasteredOverride = false;
    recentRanks = [];
    sessionAnswered = 0;
    sessionCorrect = 0;
    sessionStreak = 0;
    els.tierSelect.value = state.settings.tier;
    applyTheme();
    saveState();
    showBackupMessage("Progression réinitialisée.", false);
    renderNextQuestion();
  });

  // Initialisation au démarrage
  applyTheme();
  populateTierSelect();
  renderNextQuestion();
})();
