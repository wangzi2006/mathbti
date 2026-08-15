(() => {
  "use strict";

  const data = window.MATHBTI_DATA;
  if (!data) {
    document.body.innerHTML = '<main class="fatal-error"><h1>MathBTI 暂时没有收敛</h1><p>题库载入失败，请刷新页面重试。</p></main>';
    return;
  }

  const storageKey = "mathbti-progress-v1";
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
    resultName: document.querySelector("#result-name"),
    resultFormula: document.querySelector("#result-formula"),
    resultDefinition: document.querySelector("#result-definition"),
    resultTagline: document.querySelector("#result-tagline"),
    resultPortrait: document.querySelector("#result-portrait"),
    resultNote: document.querySelector("#result-note"),
    coordinateBars: document.querySelector("#coordinate-bars"),
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
        const valid = Number.isInteger(answer) && answer >= 0 && answer < data.questions[index].options.length;
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
    renderMath(els.questionStem);
  }

  function selectOption(optionIndex) {
    clearTimeout(advanceTimer);
    state.answers[state.current] = optionIndex;
    saveProgress();
    [...els.options.children].forEach((button, index) => button.classList.toggle("is-selected", index === optionIndex));

    advanceTimer = window.setTimeout(() => {
      if (state.current < data.questions.length - 1) {
        state.current += 1;
        renderQuestion();
      } else {
        finishQuiz();
      }
    }, 230);
  }

  function calculateScores() {
    const raw = Array(7).fill(0);
    state.answers.forEach((optionIndex, questionIndex) => {
      const answer = data.questions[questionIndex].options[optionIndex];
      answer.delta.forEach((value, axis) => { raw[axis] += value; });
    });
    return raw.map((value, axis) => {
      const span = data.bounds.max[axis] - data.bounds.min[axis];
      return span === 0 ? 50 : clamp(((value - data.bounds.min[axis]) / span) * 100, 0, 100);
    });
  }

  function closestResult(scores) {
    let bestDistance = Infinity;
    let candidates = [];
    for (const result of data.results) {
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
    const result = closestResult(scores);
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

  function showResult(result, scores, { updateUrl = false } = {}) {
    currentResult = result;
    currentScores = scores.map((score) => clamp(Number(score) || 0, 0, 100));
    els.resultName.textContent = result.name;
    setResultFormula(result.definition.latex);
    els.resultDefinition.textContent = result.definition.plain;
    els.resultTagline.textContent = result.tagline;
    els.resultPortrait.textContent = result.portrait;
    els.resultNote.textContent = result.note;
    els.shareStatus.textContent = "";
    els.coordinateBars.replaceChildren();

    data.axisLabels.forEach((label, axis) => {
      const score = Math.round(currentScores[axis]);
      const { mathName, plainName } = splitAxisLabel(label);
      const row = document.createElement("div");
      row.className = "coordinate-row";
      row.innerHTML = `
        <div class="coordinate-meta">
          <div class="coordinate-name"><strong>${escapeHtml(mathName)}</strong><span>${escapeHtml(plainName)}</span></div>
          <strong class="coordinate-value">${score}</strong>
        </div>
        <div class="coordinate-track"><div class="coordinate-fill" style="width: ${score}%"></div></div>
      `;
      els.coordinateBars.append(row);
    });

    if (updateUrl) updateShareUrl(result, currentScores);
    document.title = `${result.name}｜MathBTI`;
    showScreen("result");
  }

  function updateShareUrl(result, scores) {
    const url = new URL(window.location.href);
    url.searchParams.set("result", result.id);
    url.searchParams.set("scores", scores.map((score) => Math.round(score)).join(","));
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
    const scores = parsedScores.length === 7 && parsedScores.every(Number.isFinite) ? parsedScores : result.coordinates;
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
  });

  renderGallery();
  loadProgress();
  if (!openSharedResult()) showScreen("home", { focus: false });
})();
