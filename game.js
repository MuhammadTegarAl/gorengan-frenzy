const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#bestScore");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");
const headUpload = document.querySelector("#headUpload");
const difficultySelect = document.querySelector("#difficultySelect");

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
  "./assets/gorengan-5.png"
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
let best = Number(localStorage.getItem("hasan-frenzy-best") || 0);
let running = false;
let paused = false;
let gameOver = false;
let lastTime = 0;
let stepMs = difficultyConfig.medium.stepMs;
let currentDifficulty = "medium";
let customHeadImage = null;
let touchStart = null;
let eatFlashUntil = 0;

bestEl.textContent = best;

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

function resetGame() {
  const config = difficultyConfig[currentDifficulty];
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
  pauseButton.textContent = "Pause";
  scoreEl.textContent = score;
  food = spawnFood();
  draw();
  showOverlay(
    "Hasan lapar.",
    `Mode ${config.label}. Tembus pinggir, makan gorengan, jangan gigit badan sendiri.`,
    "Start"
  );
}

function showOverlay(title, text, buttonText) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function startGame() {
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
    score += 10;
    scoreEl.textContent = score;
    best = Math.max(best, score);
    bestEl.textContent = best;
    localStorage.setItem("hasan-frenzy-best", best);
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
  showOverlay("Pusing berat.", `Skor Hasan: ${score}. Badannya sudah segemuk ${snake.length} ruas.`, "Main lagi");
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
  const size = cell * 1.42;
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
  const size = Math.max(cell * 1.24, radius * 2.42);
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
  resetGame();
});

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
