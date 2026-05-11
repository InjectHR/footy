const STORAGE_KEY = "murrumbeena-afl-stat-counter-v1";
const HOME_TEAM = "Beena";
const HOME_COLOR = "#751832";
const DEFAULT_AWAY_COLOR = "#0f766e";
const QUARTERS = [1, 2, 3, 4];

const DEFAULT_STATS = [
  { id: "clearances", name: "Clearances", custom: false },
  { id: "inside-50-marks", name: "Inside 50 marks", custom: false },
  { id: "tackles", name: "Tackles", custom: false },
  { id: "contested-marks", name: "Contested marks", custom: false },
];

let state = loadState();
let tapHistory = [];
let clockTimer = null;
let clockLastTick = null;

const elements = {
  awayTeamName: document.querySelector("#awayTeamName"),
  awayTeamColor: document.querySelector("#awayTeamColor"),
  clockDisplay: document.querySelector("#clockDisplay"),
  quarterLength: document.querySelector("#quarterLength"),
  clockStart: document.querySelector("#clockStart"),
  clockReset: document.querySelector("#clockReset"),
  currentQuarterLabel: document.querySelector("#currentQuarterLabel"),
  quarterPicker: document.querySelector("#quarterPicker"),
  statBoard: document.querySelector("#statBoard"),
  customStatForm: document.querySelector("#customStatForm"),
  customStatName: document.querySelector("#customStatName"),
  customStatList: document.querySelector("#customStatList"),
  endQuarter: document.querySelector("#endQuarter"),
  undoLast: document.querySelector("#undoLast"),
  newGame: document.querySelector("#newGame"),
  summaryBody: document.querySelector("#summaryBody"),
  awaySummaryHeading: document.querySelector("#awaySummaryHeading"),
  matchLabel: document.querySelector("#matchLabel"),
  emailAddress: document.querySelector("#emailAddress"),
  emailStats: document.querySelector("#emailStats"),
  copySummary: document.querySelector("#copySummary"),
  statusLine: document.querySelector("#statusLine"),
};

init();

function init() {
  ensureStateShape();
  bindEvents();
  render();
}

function createDefaultState() {
  return {
    currentQuarter: 1,
    quarterLengthMinutes: 20,
    clockRemainingSeconds: 20 * 60,
    awayTeam: {
      name: "Away Team",
      color: DEFAULT_AWAY_COLOR,
    },
    stats: DEFAULT_STATS.map((stat) => ({ ...stat })),
    counts: {
      home: {},
      away: {},
    },
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return createDefaultState();
    }

    return {
      ...createDefaultState(),
      ...JSON.parse(saved),
    };
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureStateShape() {
  state.currentQuarter = clampNumber(state.currentQuarter, 1, 4, 1);
  state.quarterLengthMinutes = clampNumber(state.quarterLengthMinutes, 1, 40, 20);
  state.clockRemainingSeconds = clampNumber(
    state.clockRemainingSeconds,
    0,
    state.quarterLengthMinutes * 60,
    state.quarterLengthMinutes * 60
  );

  state.awayTeam = {
    name: state.awayTeam?.name || "Away Team",
    color: isHexColor(state.awayTeam?.color) ? state.awayTeam.color : DEFAULT_AWAY_COLOR,
  };

  const existingStats = Array.isArray(state.stats) ? state.stats : [];
  const customStats = existingStats.filter((stat) => stat.custom && stat.name);
  state.stats = [...DEFAULT_STATS.map((stat) => ({ ...stat })), ...customStats];

  state.counts = state.counts || { home: {}, away: {} };
  state.counts.home = state.counts.home || {};
  state.counts.away = state.counts.away || {};

  for (const team of ["home", "away"]) {
    for (const stat of state.stats) {
      if (!Array.isArray(state.counts[team][stat.id])) {
        state.counts[team][stat.id] = [0, 0, 0, 0];
      }

      state.counts[team][stat.id] = QUARTERS.map((quarter) =>
        clampNumber(state.counts[team][stat.id][quarter - 1], 0, 9999, 0)
      );
    }
  }

  saveState();
}

function bindEvents() {
  elements.awayTeamName.addEventListener("input", () => {
    state.awayTeam.name = elements.awayTeamName.value.trim() || "Away Team";
    saveState();
    renderLabels();
    renderStatBoard();
    renderSummary();
  });

  elements.awayTeamColor.addEventListener("input", () => {
    state.awayTeam.color = elements.awayTeamColor.value;
    saveState();
    renderColors();
  });

  elements.quarterLength.addEventListener("change", () => {
    const minutes = clampNumber(elements.quarterLength.value, 1, 40, 20);
    state.quarterLengthMinutes = minutes;
    state.clockRemainingSeconds = minutes * 60;
    pauseClock();
    saveState();
    renderClock();
  });

  elements.clockStart.addEventListener("click", () => {
    if (clockTimer) {
      pauseClock();
    } else {
      startClock();
    }
  });

  elements.clockReset.addEventListener("click", () => {
    resetClock();
  });

  elements.quarterPicker.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-quarter]");
    if (!button) {
      return;
    }

    setQuarter(Number(button.dataset.quarter));
  });

  elements.statBoard.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-team][data-stat]");
    if (!button) {
      return;
    }

    addStatTap(button.dataset.team, button.dataset.stat);
  });

  elements.customStatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addCustomStat(elements.customStatName.value);
  });

  elements.customStatList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove-stat]");
    if (!button) {
      return;
    }

    removeCustomStat(button.dataset.removeStat);
  });

  elements.endQuarter.addEventListener("click", () => {
    if (state.currentQuarter < 4) {
      setQuarter(state.currentQuarter + 1);
      setStatus(`Moved to Q${state.currentQuarter}.`);
    } else {
      pauseClock();
      setStatus("Game is at Q4. The summary is ready to email.");
    }
  });

  elements.undoLast.addEventListener("click", undoLastTap);
  elements.newGame.addEventListener("click", startNewGame);
  elements.emailStats.addEventListener("click", emailStats);
  elements.copySummary.addEventListener("click", copySummary);
}

function render() {
  renderColors();
  renderInputs();
  renderLabels();
  renderQuarterPicker();
  renderClock();
  renderStatBoard();
  renderCustomStats();
  renderSummary();
}

function renderColors() {
  document.documentElement.style.setProperty("--home-color", HOME_COLOR);
  document.documentElement.style.setProperty("--away-color", state.awayTeam.color);
  elements.awayTeamColor.value = state.awayTeam.color;
}

function renderInputs() {
  elements.awayTeamName.value = state.awayTeam.name;
  elements.quarterLength.value = state.quarterLengthMinutes;
}

function renderLabels() {
  elements.currentQuarterLabel.textContent = `Q${state.currentQuarter}`;
  elements.matchLabel.textContent = `${HOME_TEAM} v ${state.awayTeam.name}`;
  elements.awaySummaryHeading.textContent = state.awayTeam.name;
}

function renderQuarterPicker() {
  elements.quarterPicker.innerHTML = QUARTERS.map((quarter) => {
    const pressed = quarter === state.currentQuarter ? "true" : "false";
    return `<button type="button" data-quarter="${quarter}" aria-pressed="${pressed}">Q${quarter}</button>`;
  }).join("");
}

function renderClock() {
  elements.clockDisplay.textContent = formatTime(state.clockRemainingSeconds);
  elements.clockStart.textContent = clockTimer ? "Pause" : "Start";
}

function renderStatBoard() {
  elements.statBoard.innerHTML = state.stats
    .map((stat) => {
      const homeQuarter = getQuarterCount("home", stat.id, state.currentQuarter);
      const awayQuarter = getQuarterCount("away", stat.id, state.currentQuarter);
      const homeTotal = getTotal("home", stat.id);
      const awayTotal = getTotal("away", stat.id);

      return `
        <article class="stat-row">
          ${renderTapButton("home", stat, HOME_TEAM, homeQuarter, homeTotal)}
          <div class="stat-title">
            <div>
              <span>Q${state.currentQuarter}</span>
              <strong>${escapeHtml(stat.name)}</strong>
            </div>
          </div>
          ${renderTapButton("away", stat, state.awayTeam.name, awayQuarter, awayTotal)}
        </article>
      `;
    })
    .join("");
}

function renderTapButton(team, stat, teamName, quarterCount, total) {
  return `
    <button class="stat-tap ${team}" type="button" data-team="${team}" data-stat="${escapeAttribute(stat.id)}" aria-label="Add ${escapeAttribute(stat.name)} for ${escapeAttribute(teamName)}">
      <span class="tap-team">${escapeHtml(teamName)}</span>
      <span class="tap-count">${quarterCount}</span>
      <span class="tap-total">Total ${total}</span>
    </button>
  `;
}

function renderCustomStats() {
  const customStats = state.stats.filter((stat) => stat.custom);

  if (!customStats.length) {
    elements.customStatList.innerHTML = "";
    return;
  }

  elements.customStatList.innerHTML = customStats
    .map(
      (stat) => `
        <span class="custom-chip">
          ${escapeHtml(stat.name)}
          <button type="button" data-remove-stat="${escapeAttribute(stat.id)}" aria-label="Remove ${escapeAttribute(stat.name)}">x</button>
        </span>
      `
    )
    .join("");
}

function renderSummary() {
  elements.summaryBody.innerHTML = QUARTERS.map((quarter) =>
    state.stats.map((stat) => renderSummaryRow(stat, quarter)).join("")
  )
    .join("");
}

function renderSummaryRow(stat, quarter) {
  const homeCount = getQuarterCount("home", stat.id, quarter);
  const awayCount = getQuarterCount("away", stat.id, quarter);

  return `
    <tr>
      <td><strong>Q${quarter}</strong></td>
      <td>${escapeHtml(stat.name)}</td>
      <td>
        <span class="summary-count">
          <span class="team-dot" style="--team-color: ${HOME_COLOR}"></span>
          ${homeCount}
        </span>
      </td>
      <td>
        <span class="summary-count">
          <span class="team-dot" style="--team-color: ${escapeAttribute(state.awayTeam.color)}"></span>
          ${awayCount}
        </span>
      </td>
    </tr>
  `;
}

function addStatTap(team, statId) {
  const quarterIndex = state.currentQuarter - 1;
  state.counts[team][statId][quarterIndex] += 1;
  tapHistory.push({ team, statId, quarterIndex });
  if (tapHistory.length > 100) {
    tapHistory.shift();
  }

  saveState();
  renderStatBoard();
  renderSummary();
  setStatus("");
}

function undoLastTap() {
  const lastTap = tapHistory.pop();
  if (!lastTap) {
    setStatus("No taps to undo.");
    return;
  }

  if (!state.counts[lastTap.team]?.[lastTap.statId]) {
    setStatus("That stat has already been removed.");
    return;
  }

  const count = state.counts[lastTap.team][lastTap.statId][lastTap.quarterIndex];
  state.counts[lastTap.team][lastTap.statId][lastTap.quarterIndex] = Math.max(0, count - 1);
  saveState();
  renderStatBoard();
  renderSummary();
  setStatus("Last tap undone.");
}

function addCustomStat(rawName) {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) {
    setStatus("Enter a stat name first.");
    return;
  }

  const duplicate = state.stats.some((stat) => stat.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    setStatus("That stat is already on the page.");
    return;
  }

  const id = createUniqueStatId(name);
  state.stats.push({ id, name, custom: true });
  state.counts.home[id] = [0, 0, 0, 0];
  state.counts.away[id] = [0, 0, 0, 0];
  elements.customStatName.value = "";
  saveState();
  renderStatBoard();
  renderCustomStats();
  renderSummary();
  setStatus(`${name} added.`);
}

function removeCustomStat(statId) {
  const stat = state.stats.find((item) => item.id === statId);
  if (!stat || !stat.custom) {
    return;
  }

  state.stats = state.stats.filter((item) => item.id !== statId);
  delete state.counts.home[statId];
  delete state.counts.away[statId];
  saveState();
  renderStatBoard();
  renderCustomStats();
  renderSummary();
  setStatus(`${stat.name} removed.`);
}

function setQuarter(quarter) {
  state.currentQuarter = clampNumber(quarter, 1, 4, 1);
  resetClock();
  saveState();
  renderLabels();
  renderQuarterPicker();
  renderStatBoard();
}

function startClock() {
  if (state.clockRemainingSeconds <= 0) {
    state.clockRemainingSeconds = state.quarterLengthMinutes * 60;
  }

  clockLastTick = Date.now();
  clockTimer = window.setInterval(tickClock, 250);
  renderClock();
}

function pauseClock() {
  if (!clockTimer) {
    return;
  }

  window.clearInterval(clockTimer);
  clockTimer = null;
  clockLastTick = null;
  saveState();
  renderClock();
}

function resetClock() {
  pauseClock();
  state.clockRemainingSeconds = state.quarterLengthMinutes * 60;
  saveState();
  renderClock();
}

function tickClock() {
  const now = Date.now();
  const elapsedSeconds = Math.floor((now - clockLastTick) / 1000);
  if (elapsedSeconds < 1) {
    return;
  }

  clockLastTick += elapsedSeconds * 1000;
  state.clockRemainingSeconds = Math.max(0, state.clockRemainingSeconds - elapsedSeconds);
  renderClock();

  if (state.clockRemainingSeconds === 0) {
    pauseClock();
    setStatus(`Q${state.currentQuarter} time is up.`);
  }
}

function startNewGame() {
  const confirmed = window.confirm("Start a new game and clear all counts?");
  if (!confirmed) {
    return;
  }

  const awayTeam = { ...state.awayTeam };
  const stats = state.stats.map((stat) => ({ ...stat }));
  state = createDefaultState();
  state.awayTeam = awayTeam;
  state.stats = stats;
  ensureStateShape();
  tapHistory = [];
  pauseClock();
  render();
  setStatus("New game ready.");
}

function emailStats() {
  const to = elements.emailAddress.value.trim();
  const subject = encodeURIComponent(`${HOME_TEAM} v ${state.awayTeam.name} AFL stats`);
  const body = encodeURIComponent(buildSummaryText());
  const recipient = to ? to : "";
  window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  setStatus("Opening your email app with the stats filled in.");
}

async function copySummary() {
  const text = buildSummaryText();

  try {
    await navigator.clipboard.writeText(text);
    setStatus("Summary copied.");
  } catch {
    setStatus("Copy was blocked by the browser. Use Email stats instead.");
  }
}

function buildSummaryText() {
  const lines = [
    "Team Stat Counter",
    `${HOME_TEAM} v ${state.awayTeam.name}`,
    `Quarter length: ${state.quarterLengthMinutes} minutes`,
    "",
    `Quarter | Stat | ${HOME_TEAM} | ${state.awayTeam.name}`,
  ];

  for (const quarter of QUARTERS) {
    for (const stat of state.stats) {
      const homeCount = getQuarterCount("home", stat.id, quarter);
      const awayCount = getQuarterCount("away", stat.id, quarter);
      lines.push(`Q${quarter} | ${stat.name} | ${homeCount} | ${awayCount}`);
    }
  }

  return lines.join("\n");
}

function getCounts(team, statId) {
  return state.counts[team][statId] || [0, 0, 0, 0];
}

function getQuarterCount(team, statId, quarter) {
  return getCounts(team, statId)[quarter - 1] || 0;
}

function getTotal(team, statId) {
  return getCounts(team, statId).reduce((sum, count) => sum + count, 0);
}

function createUniqueStatId(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "custom-stat";

  let candidate = base;
  let suffix = 2;
  while (state.stats.some((stat) => stat.id === candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value || "");
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function setStatus(message) {
  elements.statusLine.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
