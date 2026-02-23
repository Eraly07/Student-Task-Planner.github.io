/* Student Task Planner - core logic */

const TASK_STORAGE_KEY = "plannerTasks";
const LEGACY_TASK_STORAGE_KEY = "stp_tasks_v1";
const STATS_STORAGE_KEY = "plannerStats";
const THEME_KEY = "stp_theme";

const taskForm = document.getElementById("taskForm");
const taskText = document.getElementById("taskText");
const taskCategory = document.getElementById("taskCategory");
const taskPriority = document.getElementById("taskPriority");
const taskDeadline = document.getElementById("taskDeadline");
const taskPomodoroTarget = document.getElementById("taskPomodoroTarget");
const taskList = document.getElementById("taskList");
const searchInput = document.getElementById("searchInput");
const filterButtons = document.querySelectorAll(".filter-btn");
const clearCompletedButton = document.getElementById("clearCompleted");
const themeToggle = document.getElementById("themeToggle");

const quickPomodoroButton = document.getElementById("quickPomodoro");
const exportDataButton = document.getElementById("exportData");
const importDataButton = document.getElementById("importData");
const importFileInput = document.getElementById("importFile");

const statTotal = document.getElementById("statTotal");
const statActive = document.getElementById("statActive");
const statCompleted = document.getElementById("statCompleted");
const statOverdue = document.getElementById("statOverdue");
const statToday = document.getElementById("statToday");

const statCompletedTodayAdv = document.getElementById("statCompletedTodayAdv");
const statCompletedWeekAdv = document.getElementById("statCompletedWeekAdv");
const statCompletedAllAdv = document.getElementById("statCompletedAllAdv");
const statPomodoroTodayAdv = document.getElementById("statPomodoroTodayAdv");
const statPomodoroWeekAdv = document.getElementById("statPomodoroWeekAdv");
const completionProgressText = document.getElementById("completionProgressText");
const completionProgressFill = document.getElementById("completionProgressFill");
const completionProgressTrack = document.querySelector(".progress-track");

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editText = document.getElementById("editText");
const editCategory = document.getElementById("editCategory");
const editPriority = document.getElementById("editPriority");
const editDeadline = document.getElementById("editDeadline");
const editPomodoroTarget = document.getElementById("editPomodoroTarget");
const editClose = document.getElementById("editClose");
const editCancel = document.getElementById("editCancel");

const timerContext = document.getElementById("timerContext");
const timerPhase = document.getElementById("timerPhase");
const timerDisplay = document.getElementById("timerDisplay");
const timerStart = document.getElementById("timerStart");
const timerPause = document.getElementById("timerPause");
const timerReset = document.getElementById("timerReset");

const floatingTimer = document.getElementById("floatingTimer");
const floatingTimerPhase = document.getElementById("floatingTimerPhase");
const floatingTimerTask = document.getElementById("floatingTimerTask");
const floatingTimerDisplay = document.getElementById("floatingTimerDisplay");

const PRIORITY_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1,
};

const PRIORITY_LABEL = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

const POMODORO_CONFIG = {
  focusSeconds: 25 * 60,
  shortBreakSeconds: 5 * 60,
  longBreakSeconds: 15 * 60,
  longBreakEvery: 4,
};

const PHASE_LABELS = {
  focus: "Фокус",
  shortBreak: "Короткий перерыв",
  longBreak: "Длинный перерыв",
};

let tasks = [];
let plannerStats = createDefaultStats();
let currentFilter = "all";
let searchTerm = "";
let editingId = null;
let recentlyAddedTaskId = null;

let pomodoroState = createDefaultPomodoroState();
let pomodoroTickId = null;
let audioContext = null;

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getIsoWeekKey(date = new Date()) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
  return `${temp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function createDefaultStats() {
  const now = new Date();
  return {
    lastDate: getDateKey(now),
    lastWeekKey: getIsoWeekKey(now),
    daily: {
      completedTasks: 0,
      pomodoros: 0,
    },
    weekly: {
      completedTasks: 0,
      pomodoros: 0,
    },
    total: {
      completedTasks: 0,
      pomodoros: 0,
    },
  };
}

function createDefaultPomodoroState() {
  return {
    phase: "focus",
    remainingSeconds: POMODORO_CONFIG.focusSeconds,
    durationSeconds: POMODORO_CONFIG.focusSeconds,
    isRunning: false,
    endsAt: null,
    focusSessionsInCycle: 0,
    taskId: null,
    sessionTitle: "",
  };
}

function safeNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function normalizePomodoroTarget(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(20, Math.max(1, Math.floor(parsed)));
}

function normalizeTask(task) {
  const normalized = {
    id: String(task?.id || generateId()),
    text: typeof task?.text === "string" ? task.text.trim() : "",
    category: typeof task?.category === "string" ? task.category : "Другое",
    priority: PRIORITY_WEIGHT[task?.priority] ? task.priority : "medium",
    deadline: typeof task?.deadline === "string" ? task.deadline : "",
    completed: Boolean(task?.completed),
    createdAt: typeof task?.createdAt === "string" ? task.createdAt : new Date().toISOString(),
    completedAt: typeof task?.completedAt === "string" ? task.completedAt : "",
    pomodoroCount: safeNumber(task?.pomodoroCount),
    pomodoroTarget: 1,
  };

  normalized.pomodoroTarget = normalizePomodoroTarget(
    task?.pomodoroTarget,
    Math.max(1, normalized.pomodoroCount || 1),
  );

  if (!normalized.text) {
    normalized.text = "Новая задача";
  }

  return normalized;
}

function normalizeStats(rawStats) {
  const defaults = createDefaultStats();

  if (!rawStats || typeof rawStats !== "object") {
    return defaults;
  }

  return {
    lastDate: typeof rawStats.lastDate === "string" ? rawStats.lastDate : defaults.lastDate,
    lastWeekKey: typeof rawStats.lastWeekKey === "string" ? rawStats.lastWeekKey : defaults.lastWeekKey,
    daily: {
      completedTasks: safeNumber(rawStats.daily?.completedTasks),
      pomodoros: safeNumber(rawStats.daily?.pomodoros),
    },
    weekly: {
      completedTasks: safeNumber(rawStats.weekly?.completedTasks),
      pomodoros: safeNumber(rawStats.weekly?.pomodoros),
    },
    total: {
      completedTasks: safeNumber(rawStats.total?.completedTasks),
      pomodoros: safeNumber(rawStats.total?.pomodoros),
    },
  };
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function todayMidnight() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function loadTasks() {
  try {
    let raw = localStorage.getItem(TASK_STORAGE_KEY);

    if (!raw) {
      const legacyRaw = localStorage.getItem(LEGACY_TASK_STORAGE_KEY);
      if (legacyRaw) {
        raw = legacyRaw;
        localStorage.setItem(TASK_STORAGE_KEY, legacyRaw);
      }
    }

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeTask);
  } catch (error) {
    console.warn("Не удалось загрузить задачи:", error);
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) {
      return createDefaultStats();
    }
    const parsed = JSON.parse(raw);
    return normalizeStats(parsed);
  } catch (error) {
    console.warn("Не удалось загрузить статистику:", error);
    return createDefaultStats();
  }
}

function saveStats() {
  localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(plannerStats));
}

function ensureStatsCurrentDate() {
  // Daily counters roll into weekly once per calendar day.
  const now = new Date();
  const todayKey = getDateKey(now);
  const weekKey = getIsoWeekKey(now);

  if (plannerStats.lastDate === todayKey && plannerStats.lastWeekKey === weekKey) {
    return;
  }

  const sameWeek = plannerStats.lastWeekKey === weekKey;
  if (sameWeek) {
    plannerStats.weekly.completedTasks += plannerStats.daily.completedTasks;
    plannerStats.weekly.pomodoros += plannerStats.daily.pomodoros;
  } else {
    plannerStats.weekly.completedTasks = 0;
    plannerStats.weekly.pomodoros = 0;
  }

  plannerStats.daily.completedTasks = 0;
  plannerStats.daily.pomodoros = 0;
  plannerStats.lastDate = todayKey;
  plannerStats.lastWeekKey = weekKey;

  saveStats();
}

function applyStatsDelta(counter, dateIsoString, delta) {
  ensureStatsCurrentDate();

  const date = new Date(dateIsoString);
  if (Number.isNaN(date.getTime())) {
    return;
  }

  const targetDay = getDateKey(date);
  const targetWeek = getIsoWeekKey(date);
  const today = getDateKey();
  const currentWeek = getIsoWeekKey();

  if (targetDay === today) {
    plannerStats.daily[counter] = Math.max(0, plannerStats.daily[counter] + delta);
  } else if (targetWeek === currentWeek) {
    plannerStats.weekly[counter] = Math.max(0, plannerStats.weekly[counter] + delta);
  }

  plannerStats.total[counter] = Math.max(0, plannerStats.total[counter] + delta);
  saveStats();
}

function isOverdue(task) {
  if (!task.deadline || task.completed) return false;
  const deadline = parseDate(task.deadline);
  if (!deadline) return false;
  return deadline.getTime() < todayMidnight().getTime();
}

function isDueToday(task) {
  if (!task.deadline || task.completed) return false;
  const deadline = parseDate(task.deadline);
  if (!deadline) return false;
  return deadline.getTime() === todayMidnight().getTime();
}

function generateId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return String(Date.now());
}

function sortTasks(a, b) {
  const aDeadline = a.deadline ? parseDate(a.deadline).getTime() : Number.POSITIVE_INFINITY;
  const bDeadline = b.deadline ? parseDate(b.deadline).getTime() : Number.POSITIVE_INFINITY;

  if (aDeadline !== bDeadline) {
    return aDeadline - bDeadline;
  }

  const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return new Date(a.createdAt) - new Date(b.createdAt);
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "Светлая тема" : "Тёмная тема";
}

function setTheme(theme) {
  applyTheme(theme);
  localStorage.setItem(THEME_KEY, theme);
}

function updateFilterButtons() {
  filterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === currentFilter);
  });
}

function formatDuration(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getActiveSessionTitle() {
  if (pomodoroState.sessionTitle) {
    return pomodoroState.sessionTitle;
  }

  if (pomodoroState.taskId) {
    const task = tasks.find((item) => item.id === pomodoroState.taskId);
    if (task) {
      return task.text;
    }
  }

  return "Без привязки";
}

function updatePomodoroUI() {
  const phaseLabel = PHASE_LABELS[pomodoroState.phase] || "Фокус";
  const sessionTitle = getActiveSessionTitle();

  timerDisplay.textContent = formatDuration(pomodoroState.remainingSeconds);
  timerContext.textContent =
    pomodoroState.taskId || pomodoroState.sessionTitle
      ? `Сессия: ${sessionTitle}`
      : "Нет активной сессии";
  timerPhase.textContent = `Режим: ${phaseLabel}`;

  timerStart.disabled = pomodoroState.isRunning;
  timerPause.disabled = !pomodoroState.isRunning;

  const hasSession = Boolean(
    pomodoroState.isRunning ||
      pomodoroState.taskId ||
      pomodoroState.sessionTitle ||
      pomodoroState.phase !== "focus" ||
      pomodoroState.remainingSeconds !== POMODORO_CONFIG.focusSeconds,
  );
  timerReset.disabled = !hasSession;

  floatingTimer.classList.toggle("hidden", !hasSession);
  floatingTimerPhase.textContent = phaseLabel;
  floatingTimerTask.textContent = sessionTitle;
  floatingTimerDisplay.textContent = formatDuration(pomodoroState.remainingSeconds);
}

function ensurePomodoroTicker() {
  if (pomodoroTickId) {
    return;
  }

  // Date.now() keeps timer accurate even when tab is backgrounded.
  pomodoroTickId = window.setInterval(() => {
    if (!pomodoroState.isRunning || !pomodoroState.endsAt) {
      return;
    }

    const secondsLeft = Math.max(0, Math.ceil((pomodoroState.endsAt - Date.now()) / 1000));
    pomodoroState.remainingSeconds = secondsLeft;
    updatePomodoroUI();

    if (secondsLeft === 0) {
      pomodoroState.isRunning = false;
      pomodoroState.endsAt = null;
      stopPomodoroTicker();
      handlePomodoroFinished();
    }
  }, 250);
}

function stopPomodoroTicker() {
  if (!pomodoroTickId) {
    return;
  }

  window.clearInterval(pomodoroTickId);
  pomodoroTickId = null;
}

function ensureAudioReady() {
  if (audioContext) {
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
    return;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  audioContext = new AudioCtx();
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
}

function playNotificationSound() {
  try {
    ensureAudioReady();
    if (!audioContext) {
      return;
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.warn("Не удалось проиграть звук:", error);
  }
}

function startPomodoro() {
  ensureAudioReady();

  if (pomodoroState.isRunning) {
    return;
  }

  if (pomodoroState.remainingSeconds <= 0) {
    pomodoroState.remainingSeconds = pomodoroState.durationSeconds;
  }

  pomodoroState.isRunning = true;
  pomodoroState.endsAt = Date.now() + pomodoroState.remainingSeconds * 1000;

  ensurePomodoroTicker();
  updatePomodoroUI();
  renderTasks();
}

function pausePomodoro() {
  if (!pomodoroState.isRunning) {
    return;
  }

  if (pomodoroState.endsAt) {
    pomodoroState.remainingSeconds = Math.max(0, Math.ceil((pomodoroState.endsAt - Date.now()) / 1000));
  }

  pomodoroState.isRunning = false;
  pomodoroState.endsAt = null;

  stopPomodoroTicker();
  updatePomodoroUI();
}

function resetPomodoro() {
  pausePomodoro();
  pomodoroState = createDefaultPomodoroState();
  updatePomodoroUI();
  renderTasks();
}

function setPomodoroFocusSession({ taskId = null, title = "" }) {
  const shouldConfirm =
    pomodoroState.isRunning ||
    pomodoroState.taskId ||
    pomodoroState.sessionTitle ||
    pomodoroState.phase !== "focus";

  if (shouldConfirm) {
    const accepted = window.confirm("Текущая сессия будет перезапущена. Продолжить?");
    if (!accepted) {
      return;
    }
  }

  pausePomodoro();

  pomodoroState.phase = "focus";
  pomodoroState.durationSeconds = POMODORO_CONFIG.focusSeconds;
  pomodoroState.remainingSeconds = POMODORO_CONFIG.focusSeconds;
  pomodoroState.taskId = taskId;
  pomodoroState.sessionTitle = title;

  startPomodoro();
}

function startTaskPomodoro(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  setPomodoroFocusSession({
    taskId,
    title: task.text,
  });
}

function runQuickPomodoro() {
  const title = window.prompt("Название быстрой фокус-сессии:", "Быстрый Pomodoro");
  if (title === null) {
    return;
  }

  const normalizedTitle = title.trim() || "Быстрый Pomodoro";
  setPomodoroFocusSession({
    taskId: null,
    title: normalizedTitle,
  });
}

function handlePomodoroFinished() {
  const finishedAt = new Date().toISOString();
  playNotificationSound();

  if (pomodoroState.phase === "focus") {
    // Track completed focus sessions globally and per-task.
    applyStatsDelta("pomodoros", finishedAt, 1);

    if (pomodoroState.taskId) {
      const task = tasks.find((item) => item.id === pomodoroState.taskId);
      if (task) {
        task.pomodoroCount = safeNumber(task.pomodoroCount) + 1;
        saveTasks();
      }
    }

    pomodoroState.focusSessionsInCycle += 1;
    const shouldUseLongBreak = pomodoroState.focusSessionsInCycle % POMODORO_CONFIG.longBreakEvery === 0;

    pomodoroState.phase = shouldUseLongBreak ? "longBreak" : "shortBreak";
    pomodoroState.durationSeconds = shouldUseLongBreak
      ? POMODORO_CONFIG.longBreakSeconds
      : POMODORO_CONFIG.shortBreakSeconds;
    pomodoroState.remainingSeconds = pomodoroState.durationSeconds;
    pomodoroState.isRunning = true;
    pomodoroState.endsAt = Date.now() + pomodoroState.durationSeconds * 1000;

    window.alert(
      shouldUseLongBreak
        ? "Фокус завершён. Запущен длинный перерыв 15 минут."
        : "Фокус завершён. Запущен короткий перерыв 5 минут.",
    );

    ensurePomodoroTicker();
    updatePomodoroUI();
    renderTasks();
    return;
  }

  window.alert("Перерыв завершён. Можно запускать следующий фокус.");

  pomodoroState.phase = "focus";
  pomodoroState.durationSeconds = POMODORO_CONFIG.focusSeconds;
  pomodoroState.remainingSeconds = POMODORO_CONFIG.focusSeconds;
  pomodoroState.isRunning = false;
  pomodoroState.endsAt = null;

  updatePomodoroUI();
  renderTasks();
}

function createTaskCard(task) {
  const card = document.createElement("div");
  card.className = `task-card${task.completed ? " completed" : ""}`;
  card.dataset.id = task.id;

  const isFocusedTask = pomodoroState.taskId === task.id && pomodoroState.phase === "focus";
  if (isFocusedTask) {
    card.classList.add("focused");
  }

  if (recentlyAddedTaskId && recentlyAddedTaskId === task.id) {
    card.classList.add("new");
  }

  const checkWrapper = document.createElement("label");
  checkWrapper.className = "task-check";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.dataset.action = "toggle";
  checkWrapper.appendChild(checkbox);

  const main = document.createElement("div");
  main.className = "task-main";

  const top = document.createElement("div");
  top.className = "task-top";

  const titleGroup = document.createElement("div");
  titleGroup.className = "task-title-group";

  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text;

  titleGroup.appendChild(text);

  const pomodoroCounter = document.createElement("span");
  pomodoroCounter.className = "tomato-count";
  pomodoroCounter.textContent = `🍅 ${task.pomodoroCount}/${task.pomodoroTarget}`;
  if (task.pomodoroCount >= task.pomodoroTarget) {
    pomodoroCounter.classList.add("done");
  }
  titleGroup.appendChild(pomodoroCounter);

  const badges = document.createElement("div");
  badges.className = "task-badges";

  const categoryBadge = document.createElement("span");
  categoryBadge.className = "badge category";
  categoryBadge.textContent = task.category;

  const priorityBadge = document.createElement("span");
  priorityBadge.className = `badge priority-${task.priority}`;
  priorityBadge.textContent = PRIORITY_LABEL[task.priority] || task.priority;

  badges.append(categoryBadge, priorityBadge);
  top.append(titleGroup, badges);

  const meta = document.createElement("div");
  meta.className = "task-meta";

  const deadline = document.createElement("span");
  deadline.className = "deadline";
  deadline.textContent = task.deadline ? `Дедлайн: ${task.deadline}` : "Без дедлайна";

  if (task.deadline) {
    if (isOverdue(task)) {
      deadline.classList.add("overdue");
    } else if (isDueToday(task)) {
      deadline.classList.add("today");
    }
  }

  meta.appendChild(deadline);

  if (isFocusedTask) {
    const focusTag = document.createElement("span");
    focusTag.className = "focus-tag";
    focusTag.textContent = "В фокусе";
    meta.appendChild(focusTag);
  }

  main.append(top, meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const focusButton = document.createElement("button");
  focusButton.type = "button";
  focusButton.className = "icon-btn focus-btn";
  focusButton.textContent = "🍅 Фокус";
  focusButton.dataset.action = "focus";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "icon-btn";
  editButton.textContent = "Редактировать";
  editButton.dataset.action = "edit";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "icon-btn";
  deleteButton.textContent = "Удалить";
  deleteButton.dataset.action = "delete";

  actions.append(focusButton, editButton, deleteButton);

  card.append(checkWrapper, main, actions);

  return card;
}

function renderTasks() {
  taskList.innerHTML = "";

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleTasks = tasks
    .filter((task) => {
      if (currentFilter === "active") return !task.completed;
      if (currentFilter === "completed") return task.completed;
      return true;
    })
    .filter((task) => {
      if (!normalizedSearch) return true;
      return task.text.toLowerCase().includes(normalizedSearch);
    })
    .sort(sortTasks);

  if (visibleTasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = normalizedSearch
      ? "Поиск не дал результатов."
      : "Пока нет задач.";
    taskList.appendChild(empty);
  } else {
    visibleTasks.forEach((task) => {
      taskList.appendChild(createTaskCard(task));
    });
  }

  if (recentlyAddedTaskId) {
    window.setTimeout(() => {
      recentlyAddedTaskId = null;
    }, 400);
  }

  updateStats();
}

function updateStats() {
  ensureStatsCurrentDate();

  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const active = total - completed;
  const overdue = tasks.filter(isOverdue).length;
  const dueToday = tasks.filter(isDueToday).length;

  statTotal.textContent = total;
  statActive.textContent = active;
  statCompleted.textContent = completed;
  statOverdue.textContent = overdue;
  statToday.textContent = dueToday;

  const completedToday = plannerStats.daily.completedTasks;
  const completedWeek = plannerStats.weekly.completedTasks + plannerStats.daily.completedTasks;
  const completedAll = plannerStats.total.completedTasks;
  const pomodoroToday = plannerStats.daily.pomodoros;
  const pomodoroWeek = plannerStats.weekly.pomodoros + plannerStats.daily.pomodoros;

  statCompletedTodayAdv.textContent = completedToday;
  statCompletedWeekAdv.textContent = completedWeek;
  statCompletedAllAdv.textContent = completedAll;
  statPomodoroTodayAdv.textContent = pomodoroToday;
  statPomodoroWeekAdv.textContent = pomodoroWeek;

  const completionPercent = total === 0 ? 0 : Math.round((completed / total) * 100);
  completionProgressText.textContent = `${completionPercent}%`;
  completionProgressFill.style.width = `${completionPercent}%`;
  completionProgressTrack.setAttribute("aria-valuenow", String(completionPercent));
}

function addTask(event) {
  event.preventDefault();
  const textValue = taskText.value.trim();
  if (!textValue) return;

  const newTask = {
    id: generateId(),
    text: textValue,
    category: taskCategory.value,
    priority: taskPriority.value,
    deadline: taskDeadline.value || "",
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: "",
    pomodoroCount: 0,
    pomodoroTarget: normalizePomodoroTarget(taskPomodoroTarget.value, 1),
  };

  tasks.push(newTask);
  recentlyAddedTaskId = newTask.id;
  saveTasks();

  taskForm.reset();
  taskPriority.value = "medium";
  taskPomodoroTarget.value = "1";
  renderTasks();
  taskText.focus();
}

function toggleTask(taskId, isCompleted) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  if (task.completed === isCompleted) {
    return;
  }

  task.completed = isCompleted;

  if (isCompleted) {
    task.completedAt = new Date().toISOString();
    applyStatsDelta("completedTasks", task.completedAt, 1);
  } else if (task.completedAt) {
    applyStatsDelta("completedTasks", task.completedAt, -1);
    task.completedAt = "";
  }

  saveTasks();
  renderTasks();
}

function deleteTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);

  if (pomodoroState.taskId === taskId) {
    pomodoroState.taskId = null;
  }

  saveTasks();
  updatePomodoroUI();
  renderTasks();
}

function clearCompletedTasks() {
  const completedIds = new Set(tasks.filter((task) => task.completed).map((task) => task.id));
  tasks = tasks.filter((task) => !task.completed);

  if (pomodoroState.taskId && completedIds.has(pomodoroState.taskId)) {
    pomodoroState.taskId = null;
  }

  saveTasks();
  updatePomodoroUI();
  renderTasks();
}

function openEditModal(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  editingId = taskId;
  editText.value = task.text;
  editCategory.value = task.category;
  editPriority.value = task.priority;
  editDeadline.value = task.deadline;
  editPomodoroTarget.value = String(task.pomodoroTarget);
  editModal.classList.remove("hidden");
  editText.focus();
}

function closeEditModal() {
  editingId = null;
  editModal.classList.add("hidden");
}

function submitEdit(event) {
  event.preventDefault();
  const task = tasks.find((item) => item.id === editingId);
  if (!task) return;

  const updatedText = editText.value.trim();
  if (!updatedText) return;

  task.text = updatedText;
  task.category = editCategory.value;
  task.priority = editPriority.value;
  task.deadline = editDeadline.value || "";
  task.pomodoroTarget = normalizePomodoroTarget(editPomodoroTarget.value, task.pomodoroTarget || 1);

  if (pomodoroState.taskId === task.id) {
    pomodoroState.sessionTitle = updatedText;
  }

  saveTasks();
  closeEditModal();
  updatePomodoroUI();
  renderTasks();
}

function initTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY);
  applyTheme(storedTheme || "light");
}

function exportPlannerData() {
  ensureStatsCurrentDate();

  // Export both task list and aggregated stats in one file.
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    stats: plannerStats,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `student-task-planner-${getDateKey()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function importPlannerData(file) {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      // Imported file fully replaces plannerTasks and plannerStats.
      const payload = JSON.parse(String(reader.result || "{}"));

      if (!Array.isArray(payload.tasks) || !payload.stats || typeof payload.stats !== "object") {
        throw new Error("Неверный формат файла. Ожидается объект с полями tasks и stats.");
      }

      tasks = payload.tasks.map(normalizeTask);
      plannerStats = normalizeStats(payload.stats);
      ensureStatsCurrentDate();

      saveTasks();
      saveStats();

      if (pomodoroState.taskId && !tasks.some((task) => task.id === pomodoroState.taskId)) {
        pomodoroState.taskId = null;
      }

      renderTasks();
      updatePomodoroUI();
      window.alert("Импорт завершён успешно.");
    } catch (error) {
      window.alert(`Ошибка импорта: ${error.message}`);
    } finally {
      importFileInput.value = "";
    }
  };

  reader.onerror = () => {
    window.alert("Не удалось прочитать файл импорта.");
    importFileInput.value = "";
  };

  reader.readAsText(file, "UTF-8");
}

function init() {
  tasks = loadTasks();
  plannerStats = loadStats();
  ensureStatsCurrentDate();

  initTheme();
  updateFilterButtons();
  updatePomodoroUI();
  renderTasks();

  taskForm.addEventListener("submit", addTask);

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;
      updateFilterButtons();
      renderTasks();
    });
  });

  searchInput.addEventListener("input", (event) => {
    searchTerm = event.target.value;
    renderTasks();
  });

  clearCompletedButton.addEventListener("click", clearCompletedTasks);

  taskList.addEventListener("change", (event) => {
    if (event.target.matches("input[type='checkbox']")) {
      const card = event.target.closest(".task-card");
      if (card) {
        toggleTask(card.dataset.id, event.target.checked);
      }
    }
  });

  taskList.addEventListener("click", (event) => {
    const action = event.target.dataset.action;
    if (!action) return;

    const card = event.target.closest(".task-card");
    if (!card) return;

    if (action === "focus") {
      startTaskPomodoro(card.dataset.id);
      return;
    }

    if (action === "edit") {
      openEditModal(card.dataset.id);
      return;
    }

    if (action === "delete") {
      deleteTask(card.dataset.id);
    }
  });

  themeToggle.addEventListener("click", () => {
    const newTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  });

  quickPomodoroButton.addEventListener("click", runQuickPomodoro);
  exportDataButton.addEventListener("click", exportPlannerData);

  importDataButton.addEventListener("click", () => {
    importFileInput.click();
  });

  importFileInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const confirmed = window.confirm("Это заменит все текущие данные на устройстве!");
    if (!confirmed) {
      importFileInput.value = "";
      return;
    }

    importPlannerData(file);
  });

  editForm.addEventListener("submit", submitEdit);
  editClose.addEventListener("click", closeEditModal);
  editCancel.addEventListener("click", closeEditModal);
  editModal.addEventListener("click", (event) => {
    if (event.target === editModal) {
      closeEditModal();
    }
  });

  timerStart.addEventListener("click", () => {
    const hasContext = pomodoroState.taskId || pomodoroState.sessionTitle;

    if (!hasContext && pomodoroState.phase === "focus" && pomodoroState.remainingSeconds === POMODORO_CONFIG.focusSeconds) {
      runQuickPomodoro();
      return;
    }

    startPomodoro();
  });

  timerPause.addEventListener("click", pausePomodoro);
  timerReset.addEventListener("click", resetPomodoro);
}

init();
