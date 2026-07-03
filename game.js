const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#bestScore");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const gameOverVideoFrame = document.querySelector("#gameOverVideoFrame");
const gameOverVideo = document.querySelector("#gameOverVideo");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");
const headUpload = document.querySelector("#headUpload");
const difficultySelect = document.querySelector("#difficultySelect");
const playerModal = document.querySelector("#playerModal");
const playerForm = document.querySelector("#playerForm");
const playerNameInput = document.querySelector("#playerNameInput");
const initialDifficultySelect = document.querySelector("#initialDifficultySelect");
const playerNameDisplay = document.querySelector("#playerNameDisplay");
const changePlayerButton = document.querySelector("#changePlayerButton");
const adminResetButton = document.querySelector("#adminResetButton");
const leaderboardList = document.querySelector("#leaderboardList");
const leaderboardLevel = document.querySelector("#leaderboardLevel");
const syncStatus = document.querySelector("#syncStatus");

const grid = 18;
const cell = canvas.width / grid;
const difficultyConfig = {
  easy: { label: "Easy", stepMs: 166, minStepMs: 102, speedUp: 2 },
  medium: { label: "Medium", stepMs: 132, minStepMs: 76, speedUp: 3 },
  hard: { label: "Hard", stepMs: 96, minStepMs: 58, speedUp: 4 }
};
const foodSources = [
  "./assets/gorengan-1.png",
  "./assets/gorengan-2.png",
  "./assets/gorengan-3.png",
  "./assets/gorengan-4.png",
  "./assets/gorengan-5.png",
  "./assets/gorengan-6.png"
];
const foodNames = [
  "Tahu isi",
  "Tempe",
  "Pastel",
  "Cireng",
  "Risol",
  "Bakwan"
];
const headSources = {
  left: "./assets/head-left.png",
  up: "./assets/head-up.png",
  down: "./assets/head-down.png",
  right: "./assets/head-right.png",
  shock: "./assets/head-shock.png",
  dizzy: "./assets/head-dizzy.png"
};

const foods = foodSources.map(loadImage);
const heads = Object.fromEntries(Object.entries(headSources).map(([key, src]) => [key, loadImage(src)]));

let snake;
let direction;
let queuedDirection;
let food;
let score;
const savedDifficulty = localStorage.getItem("hasan-frenzy-level");
let currentDifficulty = difficultyConfig[savedDifficulty] ? savedDifficulty : "medium";
let best = getLocalBest(currentDifficulty);
let running = false;
let paused = false;
let gameOver = false;
let lastTime = 0;
let stepMs = difficultyConfig.medium.stepMs;
let customHeadImage = null;
let touchStart = null;
let eatFlashUntil = 0;
let playerName = localStorage.getItem("hasan-frenzy-player") || "";
let leaderboardAbort = null;
let eatenCounts = Array(foodSources.length).fill(0);

bestEl.textContent = best;

function getLocalBest(level) {
  return Number(localStorage.getItem(`hasan-frenzy-best:${level}`) || 0);
}

function setLocalBest(level, value) {
  localStorage.setItem(`hasan-frenzy-best:${level}`, String(value));
}

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

function resetGame() {
  const config = difficultyConfig[currentDifficulty];
  best = getLocalBest(currentDifficulty);
  snake = [
    { x: 8, y: 9 },
    { x: 7, y: 9 },
    { x: 6, y: 9 }
  ];
  direction = { x: 1, y: 0 };
  queuedDirection = { x: 1, y: 0 };
  score = 0;
  stepMs = config.stepMs;
  gameOver = false;
  paused = false;
  running = false;
  eatFlashUntil = 0;
  eatenCounts = Array(foodSources.length).fill(0);
  pauseButton.textContent = "Pause";
  scoreEl.textContent = score;
  bestEl.textContent = best;
  food = spawnFood();
  draw();
  hideGameOverVideo();
  showOverlay(
    "Hasan lapar.",
    `Mode ${config.label}. Tembus pinggir, makan gorengan, jangan gigit badan sendiri.`,
    "Start"
  );
}

function showOverlay(title, text, buttonText, options = {}) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonText;
  if (options.video) {
    showGameOverVideo();
  } else {
    hideGameOverVideo();
  }
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  hideGameOverVideo();
  overlay.classList.add("hidden");
}

function startGame() {
  if (!ensurePlayerName()) return;
  if (gameOver) resetGame();
  running = true;
  paused = false;
  lastTime = 0;
  pauseButton.textContent = "Pause";
  hideOverlay();
  requestAnimationFrame(loop);
}

function togglePause() {
  if (!running || gameOver) return;
  paused = !paused;
  pauseButton.textContent = paused ? "Resume" : "Pause";
  if (paused) {
    showOverlay("Jeda dulu.", "Tekan Resume atau Space buat lanjut.", "Resume");
  } else {
    hideOverlay();
    requestAnimationFrame(loop);
  }
}

function loop(time) {
  if (!running || paused || gameOver) return;
  if (!lastTime) lastTime = time;
  if (time - lastTime >= stepMs) {
    update();
    draw();
    lastTime = time;
  }
  requestAnimationFrame(loop);
}

function update() {
  direction = queuedDirection;
  const head = snake[0];
  const next = wrapPosition({ x: head.x + direction.x, y: head.y + direction.y });
  const willEat = next.x === food.x && next.y === food.y;
  const collisionBody = willEat ? snake : snake.slice(0, -1);

  if (collisionBody.some((part) => part.x === next.x && part.y === next.y)) {
    endGame();
    return;
  }

  snake.unshift(next);

  if (willEat) {
    const config = difficultyConfig[currentDifficulty];
    eatenCounts[food.kind] += 1;
    score += 10;
    scoreEl.textContent = score;
    best = Math.max(best, score);
    bestEl.textContent = best;
    setLocalBest(currentDifficulty, best);
    stepMs = Math.max(config.minStepMs, stepMs - config.speedUp);
    eatFlashUntil = Date.now() + 520;
    food = spawnFood();
  } else {
    snake.pop();
  }
}

function wrapPosition(point) {
  return {
    x: (point.x + grid) % grid,
    y: (point.y + grid) % grid
  };
}

function endGame() {
  running = false;
  gameOver = true;
  draw();
  handleGameOver(score);
  showOverlay(
    "Pusing berat.",
    buildGameOverMessage("Yeee cumi, gitu aja kalah lu", score),
    "Main lagi",
    { video: true }
  );
}

function buildGameOverMessage(message, finalScore) {
  return `${message}. Skor Hasan: ${finalScore}. ${formatEatenCounts()}`;
}

function formatEatenCounts() {
  const eaten = eatenCounts
    .map((count, index) => ({ count, name: foodNames[index] || `Gorengan ${index + 1}` }))
    .filter((item) => item.count > 0);

  if (!eaten.length) return "Belum sempat makan gorengan.";

  return `Gorengan dimakan: ${eaten.map((item) => `${item.name} ${item.count}`).join(", ")}.`;
}

async function handleGameOver(finalScore) {
  const result = await submitScore(finalScore);
  if (result?.isFirstPlace) {
    overlayText.textContent = buildGameOverMessage(
      "heemm hemm, beuhh gorengan nih. selamat yee posisi 1 sementara",
      finalScore
    );
  }
}

function showGameOverVideo() {
  gameOverVideoFrame.classList.remove("hidden");
  gameOverVideo.currentTime = 0;
  const playback = gameOverVideo.play();
  if (playback) playback.catch(() => {});
}

function hideGameOverVideo() {
  gameOverVideo.pause();
  gameOverVideoFrame.classList.add("hidden");
}

function getSupabaseConfig() {
  const config = window.HASAN_SUPABASE_CONFIG || {};
  return {
    url: (config.url || "").replace(/\/$/, ""),
    anonKey: config.anonKey || ""
  };
}

function hasSupabaseConfig() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

async function supabaseRequest(path, options = {}) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function setSyncStatus(message) {
  syncStatus.textContent = message;
}

function renderLeaderboard(rows) {
  leaderboardList.replaceChildren();

  if (!rows.length) {
    const item = document.createElement("li");
    item.textContent = "Belum ada skor.";
    leaderboardList.append(item);
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    const points = document.createElement("span");
    name.textContent = row.username;
    points.textContent = row.score;
    item.append(name, points);
    leaderboardList.append(item);
  });
}

async function fetchLeaderboard(level = currentDifficulty) {
  return supabaseRequest(
    `/rest/v1/hasan_frenzy_scores?select=username,score,updated_at&level=eq.${encodeURIComponent(level)}&order=score.desc,updated_at.asc&limit=10`
  );
}

async function loadLeaderboard() {
  leaderboardLevel.textContent = difficultyConfig[currentDifficulty].label;

  if (!hasSupabaseConfig()) {
    renderLeaderboard([]);
    setSyncStatus("Supabase belum dikonfigurasi.");
    return;
  }

  if (leaderboardAbort) leaderboardAbort.abort();
  leaderboardAbort = new AbortController();

  try {
    setSyncStatus("Sync leaderboard...");
    const rows = await fetchLeaderboard(currentDifficulty);
    renderLeaderboard(rows);
    setSyncStatus("Leaderboard synced.");
  } catch (error) {
    if (error.name === "AbortError") return;
    renderLeaderboard([]);
    setSyncStatus("Leaderboard gagal sync.");
  }
}

async function submitScore(finalScore) {
  if (!hasSupabaseConfig() || !playerName || finalScore <= 0) return null;

  try {
    setSyncStatus("Nyimpen skor...");
    await supabaseRequest("/rest/v1/rpc/submit_hasan_frenzy_score", {
      method: "POST",
      body: JSON.stringify({
        p_username: playerName,
        p_level: currentDifficulty,
        p_score: finalScore
      })
    });
    const rows = await fetchLeaderboard(currentDifficulty);
    const isFirstPlace = rows[0]?.username === playerName;
    renderLeaderboard(rows);
    setSyncStatus("Skor tersimpan.");
    return { rows, isFirstPlace };
  } catch (error) {
    setSyncStatus("Skor gagal tersimpan.");
    return null;
  }
}

async function resetRemoteData() {
  if (!hasSupabaseConfig()) {
    alert("Supabase belum dikonfigurasi.");
    return;
  }

  const password = prompt("Password admin");
  if (password === null) return;

  try {
    setSyncStatus("Reset data...");
    await supabaseRequest("/rest/v1/rpc/reset_hasan_frenzy_scores", {
      method: "POST",
      body: JSON.stringify({ p_password: password })
    });
    ["easy", "medium", "hard"].forEach((level) => setLocalBest(level, 0));
    best = 0;
    bestEl.textContent = best;
    setSyncStatus("Data leaderboard direset.");
    loadLeaderboard();
  } catch (error) {
    setSyncStatus("Password salah atau reset gagal.");
  }
}

function sanitizeUsername(value) {
  return value.trim().replace(/\s+/g, " ").slice(0, 24);
}

function ensurePlayerName() {
  if (playerName) return true;
  showPlayerModal();
  return false;
}

function showPlayerModal() {
  playerNameInput.value = playerName;
  initialDifficultySelect.value = currentDifficulty;
  playerModal.classList.remove("hidden");
  playerNameInput.focus();
}

function hidePlayerModal() {
  playerModal.classList.add("hidden");
}

function setPlayerName(value, level = currentDifficulty) {
  playerName = sanitizeUsername(value);
  if (!playerName) return false;
  if (difficultyConfig[level]) {
    currentDifficulty = level;
    difficultySelect.value = level;
  }
  localStorage.setItem("hasan-frenzy-player", playerName);
  localStorage.setItem("hasan-frenzy-level", currentDifficulty);
  playerNameDisplay.textContent = playerName;
  hidePlayerModal();
  resetGame();
  loadLeaderboard();
  return true;
}

function spawnFood() {
  let next;
  do {
    next = {
      x: Math.floor(Math.random() * grid),
      y: Math.floor(Math.random() * grid),
      kind: Math.floor(Math.random() * foods.length),
      spin: Math.random() * Math.PI * 2
    };
  } while (snake.some((part) => part.x === next.x && part.y === next.y));
  return next;
}

function setDirection(name) {
  const next = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  }[name];
  if (!next) return;
  if (next.x + direction.x === 0 && next.y + direction.y === 0) return;
  queuedDirection = next;
}

function directionName(vector = direction) {
  if (vector.x < 0) return "left";
  if (vector.x > 0) return "right";
  if (vector.y < 0) return "up";
  return "down";
}

function draw() {
  drawBackground();
  drawFood();
  drawSnake();
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#211d19";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#27231d" : "#201c18";
      roundRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6, 8);
      ctx.fill();
    }
  }

  ctx.strokeStyle = "rgba(244, 178, 59, 0.38)";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 14]);
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.setLineDash([]);
}

function drawFood() {
  if (!food) return;
  const img = foods[food.kind];
  const cx = food.x * cell + cell / 2;
  const cy = food.y * cell + cell / 2;
  const size = cell * 1.58;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(Date.now() / 260 + food.spin) * 0.08);
  ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 7;
  if (img.complete) {
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = "#f4b23b";
    roundRect(-size / 2, -size / 2, size, size, 14);
    ctx.fill();
  }
  ctx.restore();
}

function drawSnake() {
  drawSnakeTube();

  for (let i = snake.length - 1; i >= 1; i -= 1) {
    drawBodyPart(snake[i], i);
  }

  drawHead(snake[0]);
}

function drawSnakeTube() {
  const radius = bodyRadius();
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = radius * 1.72;
  ctx.strokeStyle = "#2f8a51";
  ctx.shadowColor = "rgba(0, 0, 0, 0.24)";
  ctx.shadowBlur = 10;

  for (let i = snake.length - 1; i > 1; i -= 1) {
    const a = snake[i];
    const b = snake[i - 1];
    if (isWrappedSegment(a, b)) continue;
    ctx.beginPath();
    ctx.moveTo(a.x * cell + cell / 2, a.y * cell + cell / 2);
    ctx.lineTo(b.x * cell + cell / 2, b.y * cell + cell / 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBodyPart(part, index) {
  const radius = bodyRadius() * (index === snake.length - 1 ? 0.86 : 1);
  const cx = part.x * cell + cell / 2;
  const cy = part.y * cell + cell / 2;
  const shine = Math.sin(index * 1.7) * 0.12;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = index % 2 === 0 ? "#42ad62" : "#2f8a51";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * (1.02 + shine), radius * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(169, 231, 118, 0.42)";
  ctx.beginPath();
  ctx.ellipse(-radius * 0.2, -radius * 0.22, radius * 0.24, radius * 0.16, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(18, 69, 38, 0.48)";
  ctx.beginPath();
  ctx.ellipse(radius * 0.28, radius * 0.18, radius * 0.18, radius * 0.12, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function bodyRadius() {
  return Math.min(cell * 0.56, cell * (0.34 + Math.min(score, 180) / 720));
}

function isWrappedSegment(a, b) {
  return Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1;
}

function drawHead(part) {
  const cx = part.x * cell + cell / 2;
  const cy = part.y * cell + cell / 2;
  const radius = bodyRadius();
  const size = Math.max(cell * 2.23, radius * 4.36);
  const face = selectedFace();
  const img = customHeadImage || heads[face];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;

  ctx.fillStyle = "#2f8a51";
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.08, 0, Math.PI * 2);
  ctx.fill();

  if (img?.complete || img instanceof HTMLCanvasElement) {
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  } else {
    drawDefaultHead(size);
  }

  ctx.restore();
}

function selectedFace() {
  if (gameOver) return "dizzy";
  if (Date.now() < eatFlashUntil) return "shock";
  return directionName(direction);
}

function drawDefaultHead(size) {
  ctx.fillStyle = "#d99662";
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.38, size * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1b1512";
  ctx.beginPath();
  ctx.arc(-size * 0.1, -size * 0.04, size * 0.04, 0, Math.PI * 2);
  ctx.arc(size * 0.1, -size * 0.04, size * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

document.addEventListener("keydown", (event) => {
  const keys = {
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right"
  };

  if (keys[event.key]) {
    event.preventDefault();
    setDirection(keys[event.key]);
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (!running || gameOver) startGame();
    else togglePause();
  }
});

document.querySelectorAll("[data-dir]").forEach((button) => {
  button.addEventListener("click", () => setDirection(button.dataset.dir));
});

canvas.addEventListener("pointerdown", (event) => {
  touchStart = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) {
    setDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  }
  touchStart = null;
});

difficultySelect.addEventListener("change", (event) => {
  currentDifficulty = event.target.value;
  localStorage.setItem("hasan-frenzy-level", currentDifficulty);
  resetGame();
  loadLeaderboard();
});

playerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setPlayerName(playerNameInput.value, initialDifficultySelect.value);
});

changePlayerButton.addEventListener("click", showPlayerModal);
adminResetButton.addEventListener("click", resetRemoteData);

headUpload.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    customHeadImage = img;
    draw();
  };
  img.src = URL.createObjectURL(file);
});

startButton.addEventListener("click", () => {
  if (paused) togglePause();
  else startGame();
});

pauseButton.addEventListener("click", togglePause);
resetButton.addEventListener("click", resetGame);

[...foods, ...Object.values(heads)].forEach((img) => {
  img.addEventListener("load", draw, { once: true });
});

resetGame();
difficultySelect.value = currentDifficulty;
playerNameDisplay.textContent = playerName || "-";
loadLeaderboard();
ensurePlayerName();
