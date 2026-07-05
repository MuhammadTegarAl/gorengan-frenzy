const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#bestScore");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const gameOverVideoFrame = document.querySelector("#gameOverVideoFrame");
const gameOverVideo = document.querySelector("#gameOverVideo");
const gameOverVideoSource = document.querySelector("#gameOverVideoSource");
const bonusToast = document.querySelector("#bonusToast");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const soundButton = document.querySelector("#soundButton");
const resetButton = document.querySelector("#resetButton");
const difficultySelect = document.querySelector("#difficultySelect");
const playerModal = document.querySelector("#playerModal");
const playerForm = document.querySelector("#playerForm");
const playerNameInput = document.querySelector("#playerNameInput");
const initialDifficultySelect = document.querySelector("#initialDifficultySelect");
const playerNameDisplay = document.querySelector("#playerNameDisplay");
const adminResetButton = document.querySelector("#adminResetButton");
const analyticsConsent = document.querySelector("#analyticsConsent");
const analyticsAccept = document.querySelector("#analyticsAccept");
const analyticsDecline = document.querySelector("#analyticsDecline");
const leaderboardLists = {
  easy: document.querySelector("#leaderboardEasy"),
  medium: document.querySelector("#leaderboardMedium"),
  hard: document.querySelector("#leaderboardHard")
};
const syncStatus = document.querySelector("#syncStatus");

const grid = 18;
const cell = canvas.width / grid;
const soundStorageKey = "hasan-frenzy-sound-v2";
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
const specialFood = {
  name: "Satu Usus Pak Hedy",
  src: "./assets/satu-usus-pak-hedy.png",
  score: 20,
  slowMs: 10000,
  lifeMs: 10000,
  spawnChance: 0.055
};
const badFood = {
  name: "Chiki Kadaluwarsa Ivan",
  src: "./assets/chiki-kadaluwarsa-ivan.png",
  score: 0,
  fastMs: 5000,
  lifeMs: 15000,
  spawnChance: 0.075
};
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
const specialFoodImage = loadImage(specialFood.src);
const badFoodImage = loadImage(badFood.src);
const heads = Object.fromEntries(Object.entries(headSources).map(([key, src]) => [key, loadImage(src)]));

let snake;
let direction;
let queuedDirection;
let activeFoods;
let score;
const savedDifficulty = localStorage.getItem("hasan-frenzy-level");
let currentDifficulty = difficultyConfig[savedDifficulty] ? savedDifficulty : "medium";
let best = getLocalBest(currentDifficulty);
let running = false;
let paused = false;
let gameOver = false;
let lastTime = 0;
let stepMs = difficultyConfig.medium.stepMs;
let touchStart = null;
let eatFlashUntil = 0;
let slowUntil = 0;
let fastUntil = 0;
let toastTimeout = null;
let toastInterval = null;
let playerName = localStorage.getItem("hasan-frenzy-player") || "";
let eatenCounts = createEmptyEatenCounts();
let audioContext = null;
let soundEnabled = localStorage.getItem(soundStorageKey) !== "off";
let musicTimer = null;
let musicStep = 0;
let runStartedAt = 0;
let totalPausedMs = 0;
let pauseStartedAt = 0;
let lastPauseDurationSeconds = 0;
let latestControlMethod = "unknown";
let gameOverEventTracked = false;
let gameOpenedTracked = false;
let bestScoreLevelBeforeRun = best;
let bestScoreOverallBeforeRun = getOverallBest();

bestEl.textContent = best;

function getLocalBest(level) {
  return Number(localStorage.getItem(`hasan-frenzy-best:${level}`) || 0);
}

function setLocalBest(level, value) {
  localStorage.setItem(`hasan-frenzy-best:${level}`, String(value));
}

function getOverallBest() {
  return Math.max(...Object.keys(difficultyConfig).map((level) => getLocalBest(level)));
}

function createEmptyEatenCounts() {
  return {
    regular: Array(foodSources.length).fill(0),
    special: 0,
    bad: 0
  };
}

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

function gameState() {
  if (gameOver) return "game_over";
  if (paused) return "paused";
  if (running) return "playing";
  return "idle";
}

function elapsedSeconds() {
  if (!runStartedAt) return 0;
  const activePauseMs = paused && pauseStartedAt ? Date.now() - pauseStartedAt : 0;
  return Math.max(0, Math.round((Date.now() - runStartedAt - totalPausedMs - activePauseMs) / 100) / 10);
}

function totalRegularFoodsEaten() {
  return eatenCounts.regular.reduce((sum, count) => sum + count, 0);
}

function totalFoodsEaten() {
  return totalRegularFoodsEaten() + eatenCounts.special + eatenCounts.bad;
}

function enumValue(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function analyticsContext() {
  return {
    player_name: playerName || "",
    level: currentDifficulty,
    score,
    best_score_overall: getOverallBest(),
    best_score_easy: getLocalBest("easy"),
    best_score_medium: getLocalBest("medium"),
    best_score_hard: getLocalBest("hard"),
    sound_enabled: soundEnabled,
    game_state: gameState()
  };
}

function trackGameEvent(eventName, properties = {}) {
  window.HasanAnalytics?.trackEvent(eventName, properties);
}

function identifyPlayer() {
  if (!playerName) return;
  const stableId = `hasan_frenzy:${playerName.toLowerCase()}`;
  window.HasanAnalytics?.identify(stableId, {
    player_name: playerName,
    preferred_level: currentDifficulty,
    best_score_overall: getOverallBest()
  });
}

function maybeTrackGameOpened() {
  if (gameOpenedTracked) return;
  gameOpenedTracked = true;
  trackGameEvent("Game Opened", {
    has_existing_best_score: getOverallBest() > 0,
    best_score_overall: getOverallBest(),
    best_score_easy: getLocalBest("easy"),
    best_score_medium: getLocalBest("medium"),
    best_score_hard: getLocalBest("hard")
  });
}

function startAnalyticsRun() {
  runStartedAt = Date.now();
  totalPausedMs = 0;
  pauseStartedAt = 0;
  lastPauseDurationSeconds = 0;
  gameOverEventTracked = false;
  bestScoreLevelBeforeRun = getLocalBest(currentDifficulty);
  bestScoreOverallBeforeRun = getOverallBest();

  // Fires only when a new playable run begins.
  trackGameEvent("Game Started", {
    starting_score: score,
    best_score_level: bestScoreLevelBeforeRun,
    best_score_overall: bestScoreOverallBeforeRun,
    control_method: latestControlMethod,
    board_size: `${grid}x${grid}`,
    snake_initial_length: snake.length
  });
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
  slowUntil = 0;
  fastUntil = 0;
  eatenCounts = createEmptyEatenCounts();
  hideBonusToast();
  pauseButton.textContent = "Pause";
  scoreEl.textContent = score;
  bestEl.textContent = best;
  activeFoods = [];
  refillRegularFoods();
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
  overlay.classList.toggle("game-over", Boolean(options.video));
  if (options.video) {
    showGameOverVideo(Boolean(options.podium));
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
  const shouldStartNewRun = !running || gameOver;
  ensureAudio();
  if (soundEnabled) startCircusMusic();
  if (gameOver) resetGame();
  running = true;
  paused = false;
  lastTime = 0;
  pauseButton.textContent = "Pause";
  hideOverlay();
  if (shouldStartNewRun) startAnalyticsRun();
  requestAnimationFrame(loop);
}

function togglePause() {
  if (!running || gameOver) return;
  paused = !paused;
  pauseButton.textContent = paused ? "Resume" : "Pause";
  if (paused) {
    pauseStartedAt = Date.now();
    stopCircusMusic();
    // User manually paused the current run.
    trackGameEvent("Game Paused", {
      score,
      snake_length: snake.length,
      elapsed_seconds: elapsedSeconds(),
      foods_eaten_total: totalFoodsEaten(),
      special_items_eaten_total: eatenCounts.special,
      poison_eaten_total: eatenCounts.bad,
      reason: "manual"
    });
    showOverlay("Jeda dulu.", "Tekan Resume atau Space buat lanjut.", "Resume");
  } else {
    lastPauseDurationSeconds = pauseStartedAt ? Math.round((Date.now() - pauseStartedAt) / 100) / 10 : 0;
    totalPausedMs += pauseStartedAt ? Date.now() - pauseStartedAt : 0;
    pauseStartedAt = 0;
    hideOverlay();
    if (soundEnabled) startCircusMusic();
    // User resumed after a manual pause.
    trackGameEvent("Game Resumed", {
      score,
      snake_length: snake.length,
      elapsed_seconds: elapsedSeconds(),
      pause_duration_seconds: lastPauseDurationSeconds
    });
    requestAnimationFrame(loop);
  }
}

function loop(time) {
  if (!running || paused || gameOver) return;
  if (!lastTime) lastTime = time;
  if (time - lastTime >= currentStepMs()) {
    update();
    draw();
    lastTime = time;
  }
  requestAnimationFrame(loop);
}

function update() {
  direction = queuedDirection;
  pruneExpiredFoods();
  refillRegularFoods();
  maybeSpawnTimedFood();
  const head = snake[0];
  const next = wrapPosition({ x: head.x + direction.x, y: head.y + direction.y });
  const foodIndex = activeFoods.findIndex((item) => item.x === next.x && item.y === next.y);
  const willEat = foodIndex >= 0;
  const collisionBody = willEat ? snake : snake.slice(0, -1);
  const scoreBefore = score;
  const snakeLengthBefore = snake.length;

  if (collisionBody.some((part) => part.x === next.x && part.y === next.y)) {
    endGame();
    return;
  }

  snake.unshift(next);

  if (willEat) {
    const config = difficultyConfig[currentDifficulty];
    const eatenFood = activeFoods.splice(foodIndex, 1)[0];
    if (eatenFood.type === "special") {
      eatenCounts.special += 1;
      score += specialFood.score;
      slowUntil = Date.now() + specialFood.slowMs;
      showEffectToast("benefit");
      playMunchSound(true);
      // Tracks rare benefit item collection, including how long it stayed available.
      trackGameEvent("Special Item Eaten", {
        item_type: "sate_usus",
        score_before: scoreBefore,
        score_after: score,
        points_gained: specialFood.score,
        snake_length_before: snakeLengthBefore,
        snake_length_after: snake.length,
        elapsed_seconds: elapsedSeconds(),
        spawn_duration_seconds: Math.round((specialFood.lifeMs - Math.max(0, eatenFood.expiresAt - Date.now())) / 100) / 10,
        position_x: eatenFood.x,
        position_y: eatenFood.y
      });
    } else if (eatenFood.type === "bad") {
      eatenCounts.bad += 1;
      fastUntil = Date.now() + badFood.fastMs;
      showEffectToast("bad");
      playMunchSound(true);
      // Tracks poison item collection and the speed penalty trigger.
      trackGameEvent("Poison Eaten", {
        poison_type: "chiki_kadaluwarsa",
        penalty_type: "speed_up",
        score_before: scoreBefore,
        score_after: score,
        points_lost: 0,
        snake_length_before: snakeLengthBefore,
        snake_length_after: snake.length,
        elapsed_seconds: elapsedSeconds(),
        position_x: eatenFood.x,
        position_y: eatenFood.y
      });
    } else {
      eatenCounts.regular[eatenFood.kind] += 1;
      score += 10;
      playMunchSound(false);
      // Tracks regular gorengan collection without logging every movement step.
      trackGameEvent("Food Eaten", {
        food_type: enumValue(foodNames[eatenFood.kind] || `gorengan_${eatenFood.kind + 1}`),
        score_before: scoreBefore,
        score_after: score,
        points_gained: 10,
        snake_length_before: snakeLengthBefore,
        snake_length_after: snake.length,
        elapsed_seconds: elapsedSeconds(),
        position_x: eatenFood.x,
        position_y: eatenFood.y
      });
    }
    scoreEl.textContent = score;
    best = Math.max(best, score);
    bestEl.textContent = best;
    setLocalBest(currentDifficulty, best);
    stepMs = Math.max(config.minStepMs, stepMs - config.speedUp);
    eatFlashUntil = Date.now() + 520;
    refillRegularFoods();
  } else {
    snake.pop();
  }
}

function currentStepMs() {
  const now = Date.now();
  let adjusted = stepMs;
  if (now < slowUntil) adjusted *= 2;
  if (now < fastUntil) adjusted *= 0.5;
  return Math.max(34, adjusted);
}

function wrapPosition(point) {
  return {
    x: (point.x + grid) % grid,
    y: (point.y + grid) % grid
  };
}

function endGame() {
  const bestScoreLevelAfter = Math.max(getLocalBest(currentDifficulty), score);
  const bestScoreOverallAfter = Math.max(getOverallBest(), score);
  running = false;
  gameOver = true;
  stopCircusMusic();
  playGameOverSound(false);
  draw();
  if (!gameOverEventTracked) {
    gameOverEventTracked = true;
    // The value moment: one complete run ended and can be evaluated.
    trackGameEvent("Game Over", {
      final_score: score,
      best_score_level_before: bestScoreLevelBeforeRun,
      best_score_level_after: bestScoreLevelAfter,
      best_score_overall_before: bestScoreOverallBeforeRun,
      best_score_overall_after: bestScoreOverallAfter,
      is_new_best_level: score > bestScoreLevelBeforeRun,
      is_new_best_overall: score > bestScoreOverallBeforeRun,
      snake_length: snake.length,
      elapsed_seconds: elapsedSeconds(),
      foods_eaten_total: totalFoodsEaten(),
      special_items_eaten_total: eatenCounts.special,
      poison_eaten_total: eatenCounts.bad,
      death_reason: "self_collision",
      control_method: latestControlMethod,
      average_score_per_minute: elapsedSeconds() > 0 ? Math.round((score / elapsedSeconds()) * 600) / 10 : 0
    });
  }
  handleGameOver(score);
  showOverlay(
    "Yeee cumi, gitu aja kalah lu",
    buildGameOverMessage(score),
    "Main lagi",
    { video: true, podium: false }
  );
}

function buildGameOverMessage(finalScore) {
  const name = playerName || "Pemain";
  return `Skor ${name}: ${finalScore}. ${formatEatenCounts()}`;
}

function formatEatenCounts() {
  const eaten = eatenCounts.regular
    .map((count, index) => ({ count, name: foodNames[index] || `Gorengan ${index + 1}` }))
    .filter((item) => item.count > 0);
  if (eatenCounts.special > 0) {
    eaten.push({ count: eatenCounts.special, name: specialFood.name });
  }
  if (eatenCounts.bad > 0) {
    eaten.push({ count: eatenCounts.bad, name: badFood.name });
  }

  if (!eaten.length) return "Belum sempat makan gorengan.";

  return `Gorengan dimakan: ${eaten.map((item) => `${item.name} ${item.count}`).join(", ")}.`;
}

async function handleGameOver(finalScore) {
  const result = await submitScore(finalScore);
  if (result?.isFirstPlace) {
    overlayTitle.textContent = "heemm hemm, beuhh gorengan nih. selamat yee posisi 1 sementara";
    overlayText.textContent = buildGameOverMessage(finalScore);
    showGameOverVideo(true);
    playGameOverSound(true);
  }
}

function showGameOverVideo(podium = false) {
  const nextSource = podium ? "./assets/game-over-podium.mp4" : "./assets/game-over-cry.mp4";
  if (!gameOverVideoSource.src.endsWith(nextSource.replace("./", ""))) {
    gameOverVideoSource.src = nextSource;
    gameOverVideo.load();
  }
  gameOverVideoFrame.classList.remove("hidden");
  gameOverVideo.currentTime = 0;
  const playback = gameOverVideo.play();
  if (playback) playback.catch(() => {});
}

function hideGameOverVideo() {
  gameOverVideo.pause();
  gameOverVideoFrame.classList.add("hidden");
}

function showEffectToast(kind) {
  updateEffectToast(kind);
  bonusToast.classList.remove("hidden");
  if (toastTimeout) clearTimeout(toastTimeout);
  if (toastInterval) clearInterval(toastInterval);
  const duration = kind === "bad" ? badFood.fastMs : specialFood.slowMs;
  toastInterval = setInterval(() => updateEffectToast(kind), 250);
  toastTimeout = setTimeout(hideBonusToast, duration);
}

function updateEffectToast(kind) {
  const now = Date.now();
  if (kind === "bad") {
    const remaining = Math.max(0, Math.ceil((fastUntil - now) / 1000));
    bonusToast.textContent = `Chiki Kadaluwarsa Ivan kemakan. Hasan jadi ngebut 50% selama ${remaining}s. Tahan arah, jangan panik.`;
    return;
  }

  const remaining = Math.max(0, Math.ceil((slowUntil - now) / 1000));
  bonusToast.textContent = `Sate Usus Pak Hedy aman. Speed Hasan melambat 50% selama ${remaining}s, jadi lebih gampang belok.`;
}

function hideBonusToast() {
  if (toastTimeout) clearTimeout(toastTimeout);
  if (toastInterval) clearInterval(toastInterval);
  toastTimeout = null;
  toastInterval = null;
  bonusToast.classList.add("hidden");
}

function ensureAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") audioContext.resume();
}

function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  localStorage.setItem(soundStorageKey, enabled ? "on" : "off");
  soundButton.textContent = enabled ? "Sound on" : "Sound off";
  if (!enabled) stopCircusMusic();
  else if (running && !paused && !gameOver) {
    ensureAudio();
    startCircusMusic();
  }
}

function playTone(frequency, duration, options = {}) {
  if (!soundEnabled) return;
  ensureAudio();
  const now = audioContext.currentTime + (options.delay || 0);
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = options.type || "sine";
  oscillator.frequency.setValueAtTime(frequency, now);
  if (options.to) oscillator.frequency.exponentialRampToValueAtTime(options.to, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(options.volume || 0.12, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function startCircusMusic() {
  if (musicTimer || !soundEnabled) return;
  ensureAudio();
  const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46];
  musicTimer = setInterval(() => {
    const note = melody[musicStep % melody.length];
    playTone(note, 0.16, { type: "square", volume: 0.035 });
    if (musicStep % 2 === 0) playTone(note / 2, 0.18, { type: "triangle", volume: 0.025 });
    musicStep += 1;
  }, 230);
}

function stopCircusMusic() {
  if (!musicTimer) return;
  clearInterval(musicTimer);
  musicTimer = null;
}

function playMunchSound(isSpecial) {
  playTone(isSpecial ? 220 : 180, 0.08, { type: "sawtooth", volume: isSpecial ? 0.16 : 0.1, to: isSpecial ? 440 : 90 });
  playTone(isSpecial ? 660 : 260, 0.05, { type: "square", volume: isSpecial ? 0.08 : 0.05, delay: 0.04 });
}

function playGameOverSound(isWinner) {
  if (isWinner) {
    [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => {
      playTone(note, 0.18, { type: "triangle", volume: 0.12, delay: index * 0.12 });
    });
    return;
  }

  playTone(392, 0.55, { type: "sawtooth", volume: 0.12, to: 130.81 });
  playTone(196, 0.6, { type: "triangle", volume: 0.08, delay: 0.08, to: 98 });
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

function renderLeaderboard(level, rows) {
  const list = leaderboardLists[level];
  if (!list) return;
  list.replaceChildren();

  if (!rows.length) {
    const item = document.createElement("li");
    item.textContent = "Belum ada skor.";
    list.append(item);
    return;
  }

  rows.forEach((row, index) => {
    const item = document.createElement("li");
    const rank = document.createElement("span");
    const nameWrap = document.createElement("div");
    const name = document.createElement("strong");
    const points = document.createElement("span");
    rank.className = "leaderboard-rank";
    nameWrap.className = "leaderboard-name";
    points.className = "leaderboard-score";
    if (index === 0) {
      item.className = "podium-first";
      rank.textContent = "♛";
      rank.setAttribute("aria-label", "Posisi pertama");
    } else {
      rank.textContent = `${index + 1}`;
    }
    name.textContent = row.username;
    points.textContent = row.score;
    nameWrap.append(name);
    item.append(rank, nameWrap, points);
    list.append(item);
  });
}

function leaderboardRank(rows) {
  if (!playerName) return null;
  const index = rows.findIndex((row) => row.username === playerName);
  return index >= 0 ? index + 1 : null;
}

async function fetchLeaderboard(level = currentDifficulty) {
  return supabaseRequest(
    `/rest/v1/hasan_frenzy_scores?select=username,score,updated_at&level=eq.${encodeURIComponent(level)}&order=score.desc,updated_at.asc&limit=10`
  );
}

async function loadLeaderboard() {
  if (!hasSupabaseConfig()) {
    Object.keys(leaderboardLists).forEach((level) => renderLeaderboard(level, []));
    setSyncStatus("Supabase belum dikonfigurasi.");
    return;
  }

  try {
    setSyncStatus("Sync leaderboard...");
    const levels = Object.keys(leaderboardLists);
    const results = await Promise.all(levels.map((level) => fetchLeaderboard(level)));
    levels.forEach((level, index) => renderLeaderboard(level, results[index]));
    // Leaderboard data finished loading for all three levels.
    trackGameEvent("Leaderboard Viewed", {
      selected_level: currentDifficulty,
      leaderboard_scope: "all_levels",
      entries_count: results.reduce((sum, rows) => sum + rows.length, 0),
      player_rank_easy: leaderboardRank(results[levels.indexOf("easy")]),
      player_rank_medium: leaderboardRank(results[levels.indexOf("medium")]),
      player_rank_hard: leaderboardRank(results[levels.indexOf("hard")])
    });
    setSyncStatus("Leaderboard synced.");
  } catch (error) {
    Object.keys(leaderboardLists).forEach((level) => renderLeaderboard(level, []));
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
    renderLeaderboard(currentDifficulty, rows);
    loadLeaderboard();
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
  const previousEntriesCount = Object.values(leaderboardLists).reduce((sum, list) => sum + list.querySelectorAll("li").length, 0);
  const previousBestScore = getOverallBest();

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
    // Admin reset succeeded and cleared leaderboard state.
    trackGameEvent("Leaderboard Data Reset", {
      reset_scope: "all_levels",
      previous_best_score: previousBestScore,
      previous_entries_count: previousEntriesCount
    });
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
  identifyPlayer();
  resetGame();
  loadLeaderboard();
  return true;
}

function desiredRegularFoodCount() {
  return Math.min(4, 2 + Math.floor(score / 70));
}

function refillRegularFoods() {
  while (activeFoods.filter((item) => item.type === "regular").length < desiredRegularFoodCount()) {
    activeFoods.push(spawnFood("regular"));
  }
}

function maybeSpawnTimedFood() {
  if (!activeFoods.some((item) => item.type === "special") && Math.random() < specialFood.spawnChance) {
    activeFoods.push(spawnFood("special"));
  }
  if (!activeFoods.some((item) => item.type === "bad") && Math.random() < badFood.spawnChance) {
    activeFoods.push(spawnFood("bad"));
  }
}

function pruneExpiredFoods() {
  const now = Date.now();
  activeFoods = activeFoods.filter((item) => !item.expiresAt || item.expiresAt > now);
}

function spawnFood(type = "regular") {
  let next;
  do {
    next = {
      x: Math.floor(Math.random() * grid),
      y: Math.floor(Math.random() * grid),
      type,
      kind: Math.floor(Math.random() * foods.length),
      spin: Math.random() * Math.PI * 2,
      expiresAt:
        type === "special"
          ? Date.now() + specialFood.lifeMs
          : type === "bad"
            ? Date.now() + badFood.lifeMs
            : null
    };
  } while (
    snake.some((part) => part.x === next.x && part.y === next.y) ||
    activeFoods.some((item) => item.x === next.x && item.y === next.y)
  );
  return next;
}

function setDirection(name, controlMethod = "unknown") {
  const next = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  }[name];
  if (!next) return;
  if (next.x + direction.x === 0 && next.y + direction.y === 0) return;
  latestControlMethod = controlMethod;
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
  if (!activeFoods?.length) return;
  activeFoods.forEach((item) => {
    const isSpecial = item.type === "special";
    const isBad = item.type === "bad";
    const img = isSpecial ? specialFoodImage : isBad ? badFoodImage : foods[item.kind];
    const cx = item.x * cell + cell / 2;
    const cy = item.y * cell + cell / 2;
    const size = cell * (isSpecial ? 2.42 : isBad ? 2.12 : 1.82);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(Date.now() / 260 + item.spin) * (isSpecial || isBad ? 0.16 : 0.08));
    ctx.shadowColor = isSpecial
      ? "rgba(244, 178, 59, 0.9)"
      : isBad
        ? "rgba(155, 94, 255, 0.78)"
        : "rgba(0, 0, 0, 0.38)";
    ctx.shadowBlur = isSpecial || isBad ? 24 : 12;
    ctx.shadowOffsetY = 7;
    if (img.complete) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = isBad ? "#d7c52d" : "#f4b23b";
      roundRect(-size / 2, -size / 2, size, size, 14);
      ctx.fill();
    }
    if (item.expiresAt) drawFoodTimer(item, size);
    ctx.restore();
  });
}

function drawFoodTimer(item, size) {
  const config = item.type === "bad" ? badFood : specialFood;
  const remaining = Math.max(0, item.expiresAt - Date.now());
  const progress = remaining / config.lifeMs;
  ctx.beginPath();
  ctx.strokeStyle = item.type === "bad" ? "rgba(210, 76, 238, 0.9)" : "rgba(244, 178, 59, 0.9)";
  ctx.lineWidth = 5;
  ctx.arc(0, 0, size * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.stroke();
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
  const img = heads[face];

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
  if (isTypingTarget(event.target)) return;

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
    setDirection(keys[event.key], "keyboard");
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (!running || gameOver) startGame();
    else togglePause();
  }
});

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON";
}

document.querySelectorAll("[data-dir]").forEach((button) => {
  button.addEventListener("click", () => setDirection(button.dataset.dir, "button"));
});

canvas.addEventListener("pointerdown", (event) => {
  touchStart = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) {
    setDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up", "swipe");
  }
  touchStart = null;
});

difficultySelect.addEventListener("change", (event) => {
  const previousLevel = currentDifficulty;
  currentDifficulty = event.target.value;
  localStorage.setItem("hasan-frenzy-level", currentDifficulty);
  // User changed difficulty from the level selector.
  trackGameEvent("Level Changed", {
    from_level: previousLevel,
    to_level: currentDifficulty,
    current_score: score,
    game_state: gameState()
  });
  resetGame();
  loadLeaderboard();
});

soundButton.addEventListener("click", () => {
  const nextSoundState = !soundEnabled;
  setSoundEnabled(nextSoundState);
  // User toggled audio from the controls.
  trackGameEvent("Sound Toggled", {
    sound_enabled: nextSoundState,
    game_state: gameState(),
    level: currentDifficulty,
    score
  });
});

playerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setPlayerName(playerNameInput.value, initialDifficultySelect.value);
});

adminResetButton.addEventListener("click", resetRemoteData);

startButton.addEventListener("click", () => {
  if (paused) togglePause();
  else startGame();
});

pauseButton.addEventListener("click", togglePause);
resetButton.addEventListener("click", () => {
  // User manually reset the current board state.
  trackGameEvent("Game Reset", {
    level: currentDifficulty,
    score,
    game_state: gameState(),
    elapsed_seconds: elapsedSeconds()
  });
  resetGame();
});

analyticsAccept.addEventListener("click", () => {
  window.HasanAnalytics?.setConsent(true);
  analyticsConsent.classList.add("hidden");
  identifyPlayer();
  maybeTrackGameOpened();
});

analyticsDecline.addEventListener("click", () => {
  window.HasanAnalytics?.setConsent(false);
  analyticsConsent.classList.add("hidden");
});

[...foods, specialFoodImage, badFoodImage, ...Object.values(heads)].forEach((img) => {
  img.addEventListener("load", draw, { once: true });
});

window.HasanAnalytics?.setContextProvider(analyticsContext);
resetGame();
difficultySelect.value = currentDifficulty;
setSoundEnabled(soundEnabled);
playerNameDisplay.textContent = playerName || "-";
identifyPlayer();
if (window.HasanAnalytics?.getConsentState() === "unknown") {
  analyticsConsent.classList.remove("hidden");
} else {
  maybeTrackGameOpened();
}
loadLeaderboard();
ensurePlayerName();
