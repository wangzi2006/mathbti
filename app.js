(() => {
  "use strict";

  const data = window.MATHBTI_DATA;
  if (!data) {
    document.body.innerHTML = '<main class="fatal-error"><h1>MathBTI 暂时没有收敛</h1><p>题库载入失败，请刷新页面重试。</p></main>';
    return;
  }

  const storageKey = "mathbti-progress-v2";
  const screens = {
    home: document.querySelector("#home-screen"),
    quiz: document.querySelector("#quiz-screen"),
    result: document.querySelector("#result-screen"),
    gallery: document.querySelector("#gallery-screen"),
    about: document.querySelector("#about-screen"),
  };
  const els = {
    start: document.querySelector("#start-button"),
    resume: document.querySelector("#resume-button"),
    back: document.querySelector("#back-button"),
    quit: document.querySelector("#quit-button"),
    progressLabel: document.querySelector("#progress-label"),
    progressPercent: document.querySelector("#progress-percent"),
    progressBar: document.querySelector("#progress-bar"),
    questionKicker: document.querySelector("#question-kicker"),
    questionTitle: document.querySelector("#question-title"),
    questionStem: document.querySelector("#question-stem"),
    options: document.querySelector("#options"),
    skip: document.querySelector("#skip-button"),
    resultName: document.querySelector("#result-name"),
    resultFormula: document.querySelector("#result-formula"),
    resultDefinition: document.querySelector("#result-definition"),
    resultTagline: document.querySelector("#result-tagline"),
    resultPortrait: document.querySelector("#result-portrait"),
    resultNote: document.querySelector("#result-note"),
    coordinateBars: document.querySelector("#coordinate-bars"),
    neighborName: document.querySelector("#neighbor-name"),
    neighborTagline: document.querySelector("#neighbor-tagline"),
    share: document.querySelector("#share-button"),
    restart: document.querySelector("#restart-button"),
    shareStatus: document.querySelector("#share-status"),
    gallery: document.querySelector("#gallery-grid"),
  };

  let state = {
    current: 0,
    answers: Array(data.questions.length).fill(null),
  };
  let currentResult = null;
  let currentScores = null;
  let advanceTimer = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const escapeHtml = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function formatText(value) {
    return escapeHtml(value)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function formatStem(value) {
    const chunks = String(value).split(/\r?\n\s*\r?\n/).map((part) => part.trim()).filter(Boolean);
    return chunks.map((chunk) => {
      const lines = chunk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.every((line) => line.startsWith(">"))) {
        return `<blockquote>${lines.map((line) => formatText(line.replace(/^>\s?/, ""))).join("<br>")}</blockquote>`;
      }
      return `<p>${lines.map(formatText).join("<br>")}</p>`;
    }).join("");
  }

  function renderMath(root = document.body) {
    if (typeof window.renderMathInElement !== "function") return;
    window.renderMathInElement(root, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }

  function showScreen(name, { focus = true } = {}) {
    Object.entries(screens).forEach(([key, screen]) => screen.classList.toggle("is-hidden", key !== name));
    document.body.dataset.screen = name;
    if (focus) {
      window.scrollTo({ top: 0, behavior: "instant" });
      document.querySelector("#app").focus({ preventScroll: true });
    }
  }

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved || !Array.isArray(saved.answers) || saved.answers.length !== data.questions.length) return;
      state.answers = saved.answers.map((answer, index) => {
        const valid = Number.isInteger(answer) && answer >= -1 && answer < data.questions[index].options.length;
        return valid ? answer : null;
      });
      const firstBlank = state.answers.findIndex((answer) => answer === null);
      state.current = firstBlank === -1 ? data.questions.length - 1 : firstBlank;
      els.resume.classList.remove("is-hidden");
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  function saveProgress() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function resetProgress() {
    localStorage.removeItem(storageKey);
    state = { current: 0, answers: Array(data.questions.length).fill(null) };
    els.resume.classList.add("is-hidden");
  }

  function startQuiz({ resume = false } = {}) {
    clearTimeout(advanceTimer);
    if (!resume) resetProgress();
    showScreen("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const question = data.questions[state.current];
    const displayNumber = String(state.current + 1).padStart(2, "0");
    const completed = state.answers.filter((answer) => answer !== null).length;
    const progress = Math.round((completed / data.questions.length) * 100);

    els.questionKicker.textContent = `Q${displayNumber}`;
    els.questionTitle.textContent = question.title;
    els.questionStem.innerHTML = formatStem(question.stem);
    els.progressLabel.textContent = `${displayNumber} / ${data.questions.length}`;
    els.progressPercent.textContent = `${progress}%`;
    els.progressBar.style.width = `${progress}%`;
    els.back.disabled = state.current === 0;
    els.options.replaceChildren();

    question.options.forEach((option, optionIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      if (state.answers[state.current] === optionIndex) button.classList.add("is-selected");
      button.innerHTML = `<span class="option-label">${escapeHtml(option.label)}</span><span>${formatText(option.text)}</span>`;
      button.addEventListener("click", () => selectOption(optionIndex));
      els.options.append(button);
    });
    els.skip.classList.toggle("is-selected", state.answers[state.current] === -1);
    renderMath(els.questionStem);
  }

  function advanceAfterAnswer() {
    advanceTimer = window.setTimeout(() => {
      if (state.current < data.questions.length - 1) {
        state.current += 1;
        renderQuestion();
      } else {
        finishQuiz();
      }
    }, 230);
  }

  function selectOption(optionIndex) {
    clearTimeout(advanceTimer);
    state.answers[state.current] = optionIndex;
    saveProgress();
    [...els.options.children].forEach((button, index) => button.classList.toggle("is-selected", index === optionIndex));
    els.skip.classList.remove("is-selected");
    advanceAfterAnswer();
  }

  function skipQuestion() {
    clearTimeout(advanceTimer);
    state.answers[state.current] = -1;
    saveProgress();
    [...els.options.children].forEach((button) => button.classList.remove("is-selected"));
    els.skip.classList.add("is-selected");
    advanceAfterAnswer();
  }

  function calculateScores() {
    const dimensionCount = data.axisOrder.length;
    const raw = Array(dimensionCount).fill(0);
    const min = Array(dimensionCount).fill(0);
    const max = Array(dimensionCount).fill(0);
    state.answers.forEach((optionIndex, questionIndex) => {
      if (optionIndex === -1) return;
      const question = data.questions[questionIndex];
      const answer = data.questions[questionIndex].options[optionIndex];
      answer.delta.forEach((value, axis) => { raw[axis] += value; });
      for (let axis = 0; axis < dimensionCount; axis += 1) {
        const values = question.options.map((option) => option.delta[axis]);
        min[axis] += Math.min(...values);
        max[axis] += Math.max(...values);
      }
    });
    return raw.map((value, axis) => {
      if (value < 0) {
        const extent = Math.abs(min[axis]);
        return extent === 0 ? 0 : clamp(value / extent, -1, 0);
      }
      if (value > 0) {
        const extent = max[axis];
        return extent === 0 ? 0 : clamp(value / extent, 0, 1);
      }
      return 0;
    });
  }

  function closestResult(scores) {
    let bestDistance = Infinity;
    let candidates = [];
    for (const result of data.results.filter((item) => !item.special)) {
      const distance = result.coordinates.reduce((sum, coordinate, axis) => sum + ((scores[axis] - coordinate) ** 2), 0);
      if (distance < bestDistance - 1e-9) {
        bestDistance = distance;
        candidates = [result];
      } else if (Math.abs(distance - bestDistance) < 1e-9) {
        candidates.push(result);
      }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function finishQuiz() {
    if (state.answers.some((answer) => answer === null)) {
      state.current = state.answers.findIndex((answer) => answer === null);
      renderQuestion();
      return;
    }
    const scores = calculateScores();
    let totalSkipped = 0;
    let consecutiveSkipped = 0;
    let longestSkipStreak = 0;
    state.answers.forEach((answer) => {
      if (answer === -1) {
        totalSkipped += 1;
        consecutiveSkipped += 1;
        longestSkipStreak = Math.max(longestSkipStreak, consecutiveSkipped);
      } else {
        consecutiveSkipped = 0;
      }
    });
    const unlocksSkipResult = longestSkipStreak >= data.consecutiveSkipThreshold
      || totalSkipped >= data.totalSkipThreshold;
    const result = unlocksSkipResult
      ? data.results.find((item) => item.special === "skip")
      : closestResult(scores);
    localStorage.removeItem(storageKey);
    els.resume.classList.add("is-hidden");
    showResult(result, scores, { updateUrl: true });
  }

  function setResultFormula(latex) {
    els.resultFormula.textContent = latex;
    if (window.katex?.render) {
      try {
        window.katex.render(latex, els.resultFormula, { displayMode: true, throwOnError: false });
      } catch {
        els.resultFormula.textContent = latex;
      }
    }
  }

  function splitAxisLabel(label) {
    const [mathName, plainName] = String(label).split("｜");
    return { mathName, plainName: plainName || "" };
  }

  function closestNeighbor(result, scores) {
    let neighbor = null;
    let bestDistance = Infinity;
    for (const candidate of data.results) {
      if (candidate.id === result.id || candidate.special) continue;
      const distance = candidate.coordinates.reduce((sum, coordinate, axis) => sum + ((scores[axis] - coordinate) ** 2), 0);
      if (distance < bestDistance) {
        bestDistance = distance;
        neighbor = candidate;
      }
    }
    return neighbor;
  }

  function showResult(result, scores, { updateUrl = false } = {}) {
    currentResult = result;
    currentScores = scores.map((score) => clamp(Number(score) || 0, -1, 1));
    els.resultName.textContent = result.name;
    setResultFormula(result.definition.latex);
    els.resultDefinition.textContent = result.definition.plain;
    els.resultTagline.textContent = result.tagline;
    els.resultPortrait.textContent = result.portrait;
    els.resultNote.textContent = result.note;
    els.shareStatus.textContent = "";
    els.coordinateBars.replaceChildren();

    data.axisLabels.forEach((label, axis) => {
      const score = currentScores[axis];
      const displayScore = Math.round((score + 1) * 50);
      const markerPercent = (score + 1) * 50;
      const { mathName, plainName } = splitAxisLabel(label);
      const row = document.createElement("div");
      row.className = "coordinate-row";
      row.innerHTML = `
        <div class="coordinate-meta">
          <div class="coordinate-name"><strong>${escapeHtml(mathName)}</strong><span>${escapeHtml(plainName)}</span></div>
          <strong class="coordinate-value">${displayScore}%</strong>
        </div>
        <div class="coordinate-track">
          <span class="coordinate-marker" style="left: ${markerPercent}%"></span>
        </div>
      `;
      els.coordinateBars.append(row);
    });

    const neighbor = closestNeighbor(result, currentScores);
    els.neighborName.textContent = neighbor?.name || "";
    els.neighborTagline.textContent = neighbor?.tagline || "";

    if (updateUrl) updateShareUrl(result, currentScores);
    document.title = `${result.name}｜MathBTI`;
    showScreen("result");
  }

  function updateShareUrl(result, scores) {
    const url = new URL(window.location.href);
    url.searchParams.set("result", result.id);
    url.searchParams.set("scores", scores.map((score) => Number(score).toFixed(2)).join(","));
    history.replaceState({ result: result.id }, "", url);
  }

  function clearShareUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    history.replaceState({}, "", url);
    document.title = `${data.title}｜${data.subtitle}`;
  }

  async function shareResult() {
    if (!currentResult) return;
    updateShareUrl(currentResult, currentScores);
    const shareData = {
      title: `${currentResult.name}｜MathBTI`,
      text: `我的 MathBTI 是「${currentResult.name}」：${currentResult.tagline}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        els.shareStatus.textContent = "分享面板已打开。";
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        els.shareStatus.textContent = "结果链接已复制。";
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      els.shareStatus.textContent = "复制失败，请直接复制浏览器地址。";
    }
  }

  function renderGallery() {
    els.gallery.replaceChildren();
    data.results.forEach((result, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "gallery-card";
      card.innerHTML = `
        <span class="gallery-index">${String(index + 1).padStart(2, "0")}</span>
        <h2>${escapeHtml(result.name)}</h2>
        <p>${escapeHtml(result.tagline)}</p>
      `;
      card.addEventListener("click", () => showResult(result, result.coordinates, { updateUrl: true }));
      els.gallery.append(card);
    });
  }

  function goHome() {
    clearTimeout(advanceTimer);
    clearShareUrl();
    showScreen("home");
  }

  function openSharedResult() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("result");
    if (!id) return false;
    const result = data.results.find((item) => item.id === id);
    if (!result) return false;
    const parsedScores = (params.get("scores") || "").split(",").map(Number);
    const scores = parsedScores.length === data.axisOrder.length && parsedScores.every(Number.isFinite) ? parsedScores : result.coordinates;
    showResult(result, scores, { updateUrl: false });
    return true;
  }

  els.start.addEventListener("click", () => startQuiz());
  els.resume.addEventListener("click", () => startQuiz({ resume: true }));
  els.back.addEventListener("click", () => {
    clearTimeout(advanceTimer);
    if (state.current > 0) {
      state.current -= 1;
      renderQuestion();
    }
  });
  els.quit.addEventListener("click", goHome);
  els.skip.addEventListener("click", skipQuestion);
  els.share.addEventListener("click", shareResult);
  els.restart.addEventListener("click", () => {
    clearShareUrl();
    startQuiz();
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "home") goHome();
      if (action === "gallery") {
        clearShareUrl();
        showScreen("gallery");
      }
      if (action === "about") {
        clearShareUrl();
        showScreen("about");
      }
      if (action === "start") startQuiz();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (screens.quiz.classList.contains("is-hidden")) return;
    const optionIndex = Number(event.key) - 1;
    if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < data.questions[state.current].options.length) {
      selectOption(optionIndex);
    }
    if (event.key.toLowerCase() === "s") skipQuestion();
  });

  renderGallery();
  loadProgress();
  if (!openSharedResult()) showScreen("home", { focus: false });
})();
