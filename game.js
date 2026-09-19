const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const overlay = document.querySelector("#overlay");
const overlayTag = document.querySelector("#overlayTag");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const scoreElement = document.querySelector("#score");
const bestElement = document.querySelector("#best");
const soundButton = document.querySelector("#soundButton");

const WORLD = { width: 960, height: 540, ground: 426 };
const player = { x: 140, y: 0, width: 42, height: 58, vy: 0, jumps: 0, squash: 0 };
let obstacles = [];
let particles = [];
let stars = [];
let state = "ready";
let distance = 0;
let speed = 7;
let spawnTimer = 80;
let lastTime = 0;
let muted = false;
let audioContext;

function loadBest() {
  try { return Number(localStorage.getItem("cloudRunnerBest")) || 0; }
  catch { return 0; }
}

let best = loadBest();
bestElement.textContent = String(best).padStart(4, "0");

function makeStars() {
  stars = Array.from({ length: 36 }, (_, index) => ({
    x: (index * 137.5) % WORLD.width,
    y: 45 + (index * 67) % 240,
    size: 1 + (index % 3) * .6,
    layer: .15 + (index % 4) * .08,
  }));
}

function reset() {
  obstacles = [];
  particles = [];
  distance = 0;
  speed = 7;
  spawnTimer = 85;
  player.y = WORLD.ground - player.height;
  player.vy = 0;
  player.jumps = 0;
  state = "running";
  scoreElement.textContent = "0000";
  overlay.classList.add("hidden");
}

function tone(frequency, duration = .06) {
  if (muted) return;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.06, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function jump() {
  if (state !== "running") return;
  if (player.jumps < 2) {
    player.vy = player.jumps === 0 ? -15.2 : -13.2;
    player.jumps += 1;
    player.squash = -.12;
    tone(player.jumps === 1 ? 430 : 610);
    for (let i = 0; i < 7; i += 1) {
      particles.push({ x: player.x + 18, y: player.y + player.height, vx: -2 - Math.random() * 3, vy: -Math.random() * 2, life: 1 });
    }
  }
}

function action(event) {
  if (event) event.preventDefault();
  if (state === "running") jump();
  else reset();
}

function spawnObstacle() {
  const tall = Math.random() > .58;
  obstacles.push({
    x: WORLD.width + 30,
    y: WORLD.ground - (tall ? 72 : 47),
    width: tall ? 41 : 54,
    height: tall ? 72 : 47,
    color: Math.random() > .5 ? "#ff5d8f" : "#ff9f1c",
  });
  spawnTimer = Math.max(48, 88 - speed * 2) + Math.random() * 45;
}

function endGame() {
  state = "over";
  const score = Math.floor(distance);
  if (score > best) {
    best = score;
    bestElement.textContent = String(best).padStart(4, "0");
    try { localStorage.setItem("cloudRunnerBest", String(best)); } catch { /* storage may be unavailable */ }
  }
  tone(145, .28);
  overlayTag.textContent = "本次得分 " + String(score).padStart(4, "0");
  overlayTitle.textContent = "差一点，再来一次！";
  overlayText.textContent = "障碍会随着距离逐渐加速。掌握二段跳的时机，刷新你的最高纪录。";
  startButton.innerHTML = "重新开始 <span>↻</span>";
  overlay.classList.remove("hidden");
}

function intersects(a, b) {
  const padX = 7;
  const padY = 5;
  return a.x + padX < b.x + b.width && a.x + a.width - padX > b.x && a.y + padY < b.y + b.height && a.y + a.height - padY > b.y;
}

function update(dt) {
  if (state !== "running") return;
  const step = Math.min(dt / 16.67, 1.8);
  distance += speed * .12 * step;
  speed = Math.min(13.2, 7 + distance / 420);
  scoreElement.textContent = String(Math.floor(distance)).padStart(4, "0");

  player.vy += .82 * step;
  player.y += player.vy * step;
  player.squash *= .78;
  if (player.y >= WORLD.ground - player.height) {
    if (player.vy > 5) player.squash = .16;
    player.y = WORLD.ground - player.height;
    player.vy = 0;
    player.jumps = 0;
  }

  spawnTimer -= step;
  if (spawnTimer <= 0) spawnObstacle();
  obstacles.forEach(obstacle => { obstacle.x -= speed * step; });
  obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.width > -30);
  if (obstacles.some(obstacle => intersects(player, obstacle))) endGame();

  particles.forEach(particle => {
    particle.x += particle.vx * step;
    particle.y += particle.vy * step;
    particle.vy += .12 * step;
    particle.life -= .035 * step;
  });
  particles = particles.filter(particle => particle.life > 0);
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawCloud(x, y, scale, alpha) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, 24 * scale, Math.PI, 0);
  ctx.arc(x + 28 * scale, y - 10 * scale, 32 * scale, Math.PI, 0);
  ctx.arc(x + 65 * scale, y, 25 * scale, Math.PI, 0);
  ctx.lineTo(x + 65 * scale, y + 18 * scale);
  ctx.lineTo(x, y + 18 * scale);
  ctx.closePath();
  ctx.fill();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  gradient.addColorStop(0, "#172c51");
  gradient.addColorStop(.62, "#245681");
  gradient.addColorStop(1, "#e89880");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = "rgba(255,225,168,.92)";
  ctx.beginPath();
  ctx.arc(785, 115, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,225,168,.12)";
  ctx.beginPath();
  ctx.arc(785, 115, 73, 0, Math.PI * 2);
  ctx.fill();

  stars.forEach(star => {
    const x = (star.x - distance * star.layer) % (WORLD.width + 20);
    ctx.fillStyle = "rgba(255,255,255,.6)";
    ctx.fillRect(x < 0 ? x + WORLD.width + 20 : x, star.y, star.size, star.size);
  });
  drawCloud(80 - (distance * .35) % 1100, 135, 1.15, .15);
  drawCloud(610 - (distance * .22) % 1200, 245, .75, .13);

  ctx.fillStyle = "rgba(17,50,76,.55)";
  ctx.beginPath();
  ctx.moveTo(0, 375);
  for (let x = 0; x <= WORLD.width; x += 100) ctx.lineTo(x, 320 + Math.sin(x * .018 + distance * .006) * 38);
  ctx.lineTo(WORLD.width, WORLD.ground);
  ctx.lineTo(0, WORLD.ground);
  ctx.fill();

  ctx.fillStyle = "#10273d";
  ctx.fillRect(0, WORLD.ground, WORLD.width, WORLD.height - WORLD.ground);
  ctx.fillStyle = "#4cc9f0";
  ctx.fillRect(0, WORLD.ground, WORLD.width, 5);
  ctx.fillStyle = "rgba(76,201,240,.08)";
  for (let x = -((distance * speed) % 80); x < WORLD.width; x += 80) ctx.fillRect(x, WORLD.ground + 28, 38, 4);
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
  ctx.scale(1 + player.squash, 1 - player.squash);
  ctx.translate(-player.width / 2, -player.height / 2);
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.beginPath();
  ctx.ellipse(20, 63, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4cc9f0";
  roundedRect(1, 5, 40, 49, 12);
  ctx.fill();
  ctx.fillStyle = "#17233d";
  roundedRect(9, 14, 25, 15, 7);
  ctx.fill();
  ctx.fillStyle = "#dff8ff";
  ctx.fillRect(15, 18, 5, 5);
  ctx.fillRect(25, 18, 5, 5);
  ctx.fillStyle = "#ffe66d";
  roundedRect(5, 46, 14, 11, 4); ctx.fill();
  roundedRect(25, 46, 14, 11, 4); ctx.fill();
  ctx.restore();
}

function drawObstacle(obstacle) {
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.beginPath(); ctx.ellipse(obstacle.x + obstacle.width / 2, WORLD.ground + 3, obstacle.width * .62, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = obstacle.color;
  roundedRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 8); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.25)";
  roundedRect(obstacle.x + 7, obstacle.y + 7, 7, obstacle.height - 14, 4); ctx.fill();
  ctx.fillStyle = "#15263e";
  for (let y = obstacle.y + 15; y < obstacle.y + obstacle.height - 5; y += 19) {
    ctx.save(); ctx.translate(obstacle.x + obstacle.width - 7, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore();
  }
}

function draw() {
  drawBackground();
  particles.forEach(particle => {
    ctx.fillStyle = `rgba(255,230,109,${particle.life})`;
    ctx.beginPath(); ctx.arc(particle.x, particle.y, 3 * particle.life, 0, Math.PI * 2); ctx.fill();
  });
  obstacles.forEach(drawObstacle);
  drawPlayer();
}

function loop(time) {
  const dt = time - lastTime || 16.67;
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

startButton.addEventListener("click", action);
canvas.addEventListener("pointerdown", action);
window.addEventListener("keydown", event => {
  if (["Space", "ArrowUp", "KeyW"].includes(event.code)) action(event);
});
soundButton.addEventListener("click", event => {
  event.stopPropagation();
  muted = !muted;
  soundButton.classList.toggle("muted", muted);
  soundButton.textContent = muted ? "×" : "♪";
  soundButton.setAttribute("aria-label", muted ? "开启音效" : "关闭音效");
});

makeStars();
player.y = WORLD.ground - player.height;
draw();
requestAnimationFrame(loop);
