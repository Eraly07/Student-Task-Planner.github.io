/* Student Task Planner - core logic */

const STORAGE_KEY = "stp_tasks_v1";
const THEME_KEY = "stp_theme";

const taskForm = document.getElementById("taskForm");
const taskText = document.getElementById("taskText");
const taskCategory = document.getElementById("taskCategory");
const taskPriority = document.getElementById("taskPriority");
const taskDeadline = document.getElementById("taskDeadline");
const taskList = document.getElementById("taskList");
const searchInput = document.getElementById("searchInput");
const filterButtons = document.querySelectorAll(".filter-btn");
const clearCompletedButton = document.getElementById("clearCompleted");
const themeToggle = document.getElementById("themeToggle");

const statTotal = document.getElementById("statTotal");
const statActive = document.getElementById("statActive");
const statCompleted = document.getElementById("statCompleted");
const statOverdue = document.getElementById("statOverdue");
const statToday = document.getElementById("statToday");

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editText = document.getElementById("editText");
const editCategory = document.getElementById("editCategory");
const editPriority = document.getElementById("editPriority");
const editDeadline = document.getElementById("editDeadline");
const editClose = document.getElementById("editClose");
const editCancel = document.getElementById("editCancel");

const timerDisplay = document.getElementById("timerDisplay");
const timerStart = document.getElementById("timerStart");
const timerPause = document.getElementById("timerPause");
const timerReset = document.getElementById("timerReset");
const modeButtons = document.querySelectorAll(".mode-btn");

const PRIORITY_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1,
};

let tasks = [];
let currentFilter = "all";
let searchTerm = "";
let editingId = null;

let currentMode = "focus";
const MODE_DURATIONS = {
  focus: 25 * 60,
  break: 5 * 60,
};
let remainingSeconds = MODE_DURATIONS[currentMode];
let timerInterval = null;

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("Failed to load tasks:", error);
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
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
  themeToggle.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
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

function createTaskCard(task) {
  const card = document.createElement("div");
  card.className = `task-card${task.completed ? " completed" : ""}`;
  card.dataset.id = task.id;

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

  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text;

  const badges = document.createElement("div");
  badges.className = "task-badges";

  const categoryBadge = document.createElement("span");
  categoryBadge.className = "badge category";
  categoryBadge.textContent = task.category;

  const priorityBadge = document.createElement("span");
  priorityBadge.className = `badge priority-${task.priority}`;
  priorityBadge.textContent = `${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)}`;

  badges.append(categoryBadge, priorityBadge);
  top.append(text, badges);

  const meta = document.createElement("div");
  meta.className = "task-meta";

  const deadline = document.createElement("span");
  deadline.className = "deadline";
  deadline.textContent = task.deadline ? `Deadline: ${task.deadline}` : "No deadline";

  if (task.deadline) {
    if (isOverdue(task)) {
      deadline.classList.add("overdue");
    } else if (isDueToday(task)) {
      deadline.classList.add("today");
    }
  }

  meta.appendChild(deadline);
  main.append(top, meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "icon-btn";
  editButton.textContent = "Edit";
  editButton.dataset.action = "edit";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "icon-btn";
  deleteButton.textContent = "Delete";
  deleteButton.dataset.action = "delete";

  actions.append(editButton, deleteButton);

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
      ? "No tasks match your search."
      : "No tasks to show yet.";
    taskList.appendChild(empty);
  } else {
    visibleTasks.forEach((task) => {
      taskList.appendChild(createTaskCard(task));
    });
  }

  updateStats();
}

function updateStats() {
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
  };

  tasks.push(newTask);
  saveTasks();
  taskForm.reset();
  taskPriority.value = "medium";
  renderTasks();
  taskText.focus();
}

function toggleTask(taskId, isCompleted) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;
  task.completed = isCompleted;
  saveTasks();
  renderTasks();
}

function deleteTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);
  saveTasks();
  renderTasks();
}

function clearCompletedTasks() {
  tasks = tasks.filter((task) => !task.completed);
  saveTasks();
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

  saveTasks();
  closeEditModal();
  renderTasks();
}

function initTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY);
  applyTheme(storedTheme || "light");
}

function updateModeButtons() {
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === currentMode);
  });
}

function updateTimerDisplay() {
  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const seconds = String(remainingSeconds % 60).padStart(2, "0");
  timerDisplay.textContent = `${minutes}:${seconds}`;
}

function startTimer() {
  if (timerInterval) return;

  timerInterval = setInterval(() => {
    remainingSeconds = Math.max(0, remainingSeconds - 1);
    updateTimerDisplay();

    if (remainingSeconds === 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      window.alert(`${currentMode === "focus" ? "Focus" : "Break"} session complete!`);
    }
  }, 1000);
}

function pauseTimer() {
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  pauseTimer();
  remainingSeconds = MODE_DURATIONS[currentMode];
  updateTimerDisplay();
}

function setMode(mode) {
  currentMode = mode;
  updateModeButtons();
  remainingSeconds = MODE_DURATIONS[currentMode];
  updateTimerDisplay();
  pauseTimer();
}

function init() {
  tasks = loadTasks();
  initTheme();
  updateFilterButtons();
  renderTasks();
  updateTimerDisplay();

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

    if (action === "edit") {
      openEditModal(card.dataset.id);
    }

    if (action === "delete") {
      deleteTask(card.dataset.id);
    }
  });

  themeToggle.addEventListener("click", () => {
    const newTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  });

  editForm.addEventListener("submit", submitEdit);
  editClose.addEventListener("click", closeEditModal);
  editCancel.addEventListener("click", closeEditModal);
  editModal.addEventListener("click", (event) => {
    if (event.target === editModal) {
      closeEditModal();
    }
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  timerStart.addEventListener("click", startTimer);
  timerPause.addEventListener("click", pauseTimer);
  timerReset.addEventListener("click", resetTimer);
}

init();
