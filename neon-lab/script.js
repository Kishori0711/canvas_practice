const TAU = Math.PI * 2;
const rand = (min, max) => Math.random() * (max - min) + min;

function fitCanvas(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: rect.width, h: rect.height };
}

function onResize(fn) {
  let id;
  window.addEventListener('resize', () => {
    clearTimeout(id);
    id = setTimeout(fn, 150);
  });
}

// Runs draw() every frame, but only while the canvas is on screen.
function loop(canvas, draw) {
  let visible = true;
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(canvas);
  function frame(now) {
    if (visible) draw(now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function pointerPos(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

/* ---------------- Hero: particle text ---------------- */
(function particleText() {
  const canvas = document.getElementById('hero');
  const ctx = canvas.getContext('2d');
  const section = document.getElementById('hero-section');
  const input = document.getElementById('hero-text');
  const mouse = { x: null, y: null };
  let w, h, particles = [];

  function sample(text) {
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const o = off.getContext('2d');
    let size = Math.min(w * 0.24, h * 0.42);
    const font = (s) => `900 ${s}px Poppins, "Arial Black", Impact, sans-serif`;
    o.font = font(size);
    const measured = o.measureText(text).width;
    if (measured > w * 0.9) size *= (w * 0.9) / measured;
    o.font = font(size);
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    o.fillStyle = '#fff';
    o.fillText(text, w / 2, h * 0.45);
    const data = o.getImageData(0, 0, w, h).data;
    const step = w < 640 ? 5 : 4;
    const pts = [];
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] > 128) pts.push({ x, y });
      }
    }
    return pts;
  }

  function setText(text) {
    const targets = sample(text.trim().toUpperCase() || 'NEON');
    for (let i = targets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [targets[i], targets[j]] = [targets[j], targets[i]];
    }
    particles.length = Math.min(particles.length, targets.length);
    targets.forEach((tg, i) => {
      if (particles[i]) {
        particles[i].hx = tg.x;
        particles[i].hy = tg.y;
      } else {
        particles.push({ x: rand(0, w), y: rand(0, h), vx: 0, vy: 0, hx: tg.x, hy: tg.y, s: rand(1.5, 3) });
      }
    });
  }

  function init() {
    ({ w, h } = fitCanvas(canvas, ctx));
    setText(input.value);
  }
  document.fonts.ready.then(init);
  init();
  onResize(init);

  let typeTimer;
  input.addEventListener('input', () => {
    clearTimeout(typeTimer);
    typeTimer = setTimeout(() => setText(input.value), 200);
  });

  function blast() {
    for (const p of particles) {
      const a = rand(0, TAU), s = rand(6, 26);
      p.vx += Math.cos(a) * s;
      p.vy += Math.sin(a) * s;
    }
  }
  document.getElementById('hero-blast').addEventListener('click', blast);
  canvas.addEventListener('click', blast);

  section.addEventListener('pointermove', (e) => Object.assign(mouse, pointerPos(canvas, e)));
  section.addEventListener('pointerleave', () => (mouse.x = null));

  loop(canvas, (t) => {
    ctx.fillStyle = 'rgba(5, 3, 15, 0.35)';
    ctx.fillRect(0, 0, w, h);
    for (const p of particles) {
      p.vx += (p.hx - p.x) * 0.03;
      p.vy += (p.hy - p.y) * 0.03;
      if (mouse.x !== null) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 110 * 110) {
          const d = Math.sqrt(d2) || 1;
          const f = (110 - d) / 110 * 3.5;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }
      }
      p.vx *= 0.86;
      p.vy *= 0.86;
      p.x += p.vx;
      p.y += p.vy;
      const speed = Math.abs(p.vx) + Math.abs(p.vy);
      const hue = (p.hx / w) * 160 + 170 + t * 25;
      ctx.fillStyle = `hsl(${hue}, 100%, ${Math.min(90, 60 + speed * 6)}%)`;
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
  });
})();

/* ---------------- Neon Breaker game ---------------- */
(function game() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('game-score');
  const livesEl = document.getElementById('game-lives');
  const bestEl = document.getElementById('game-best');
  let w, h, bricks, paddle, ball, state, score, lives, best = 0, shake = 0;
  const sparks = [];
  const COLS = 10, ROWS = 5;

  function buildBricks() {
    bricks = [];
    const gap = 6, top = 50;
    const bw = (w - gap * (COLS + 1)) / COLS, bh = 20;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        bricks.push({ x: gap + c * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh, hue: 300 - r * 40, alive: true });
      }
    }
  }

  function resetBall() {
    ball = { x: paddle.x, y: h - 40, vx: 0, vy: 0, r: 6 };
    state = 'idle';
  }

  function newGame() {
    score = 0;
    lives = 3;
    paddle = { x: w / 2, w: 100, h: 10 };
    buildBricks();
    resetBall();
    update();
  }

  function update() {
    scoreEl.textContent = score;
    livesEl.textContent = lives;
    bestEl.textContent = best;
  }

  function init() {
    ({ w, h } = fitCanvas(canvas, ctx));
    newGame();
  }
  init();
  onResize(init);

  function burst(x, y, hue) {
    for (let i = 0; i < 18; i++) {
      const a = rand(0, TAU), s = rand(1, 5);
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, hue });
    }
  }

  canvas.addEventListener('pointermove', (e) => {
    const p = pointerPos(canvas, e);
    paddle.x = Math.max(paddle.w / 2, Math.min(w - paddle.w / 2, p.x));
    if (state === 'idle') ball.x = paddle.x;
  });
  canvas.addEventListener('click', () => {
    if (state === 'idle') {
      const a = rand(-0.6, 0.6) - Math.PI / 2;
      ball.vx = Math.cos(a) * 5.5;
      ball.vy = Math.sin(a) * 5.5;
      state = 'play';
    } else if (state === 'over' || state === 'win') {
      newGame();
    }
  });

  function neonText(text, size, y, color) {
    ctx.font = `900 ${size}px Poppins, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, y);
    ctx.shadowBlur = 0;
  }

  loop(canvas, () => {
    if (state === 'play') {
      ball.x += ball.vx;
      ball.y += ball.vy;
      if (ball.x < ball.r || ball.x > w - ball.r) { ball.vx *= -1; ball.x = Math.max(ball.r, Math.min(w - ball.r, ball.x)); }
      if (ball.y < ball.r) { ball.vy *= -1; ball.y = ball.r; }

      const py = h - 24;
      if (ball.vy > 0 && ball.y + ball.r >= py && ball.y - ball.r <= py + paddle.h &&
          ball.x >= paddle.x - paddle.w / 2 - ball.r && ball.x <= paddle.x + paddle.w / 2 + ball.r) {
        const hit = (ball.x - paddle.x) / (paddle.w / 2);
        const speed = Math.min(9, Math.hypot(ball.vx, ball.vy) + 0.15);
        const a = hit * 1.1 - Math.PI / 2;
        ball.vx = Math.cos(a) * speed;
        ball.vy = Math.sin(a) * speed;
        ball.y = py - ball.r;
        burst(ball.x, py, 190);
      }

      for (const b of bricks) {
        if (!b.alive) continue;
        if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
          b.alive = false;
          score += 10;
          shake = 4;
          burst(ball.x, ball.y, b.hue);
          const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
          const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
          if (overlapX < overlapY) ball.vx *= -1; else ball.vy *= -1;
          break;
        }
      }

      if (ball.y > h + 20) {
        lives--;
        shake = 10;
        if (lives <= 0) { state = 'over'; best = Math.max(best, score); } else resetBall();
      }
      if (bricks.every((b) => !b.alive)) { state = 'win'; best = Math.max(best, score); }
      update();
    }

    ctx.save();
    if (shake > 0) { ctx.translate(rand(-shake, shake), rand(-shake, shake)); shake *= 0.8; if (shake < 0.3) shake = 0; }
    ctx.fillStyle = 'rgba(5, 3, 15, 0.55)';
    ctx.fillRect(-20, -20, w + 40, h + 40);

    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = `hsla(${b.hue}, 90%, 60%, 0.25)`;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = `hsl(${b.hue}, 100%, 65%)`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    }

    const py = h - 24;
    const pg = ctx.createLinearGradient(paddle.x - paddle.w / 2, 0, paddle.x + paddle.w / 2, 0);
    pg.addColorStop(0, '#22d3ee');
    pg.addColorStop(1, '#d946ef');
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 18;
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.roundRect(paddle.x - paddle.w / 2, py, paddle.w, paddle.h, 5);
    ctx.fill();

    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx; s.y += s.vy; s.vy += 0.1; s.life -= 0.03;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = `hsla(${s.hue}, 100%, 70%, ${s.life})`;
      ctx.fillRect(s.x, s.y, 3, 3);
    }

    if (state === 'idle') neonText('CLICK TO LAUNCH', 18, h / 2 + 30, '#67e8f9');
    if (state === 'over') { neonText('GAME OVER', 44, h / 2 - 10, '#f472b6'); neonText('Click karke phir se khelo', 16, h / 2 + 34, '#e2e8f0'); }
    if (state === 'win') { neonText('YOU WIN!', 44, h / 2 - 10, '#4ade80'); neonText('Click karke phir se khelo', 16, h / 2 + 34, '#e2e8f0'); }
    ctx.restore();
  });
})();

/* ---------------- Gravity playground ---------------- */
(function gravity() {
  const canvas = document.getElementById('balls');
  const ctx = canvas.getContext('2d');
  let w, h, balls = [], grabbed = null, last = null;
  const G = 0.35, BOUNCE = 0.82;

  function init() {
    ({ w, h } = fitCanvas(canvas, ctx));
    if (!balls.length) {
      for (let i = 0; i < 6; i++) balls.push(makeBall(rand(40, w - 40), rand(40, h / 2)));
    }
  }
  const makeBall = (x, y) => ({ x, y, vx: rand(-3, 3), vy: 0, r: rand(14, 30), hue: rand(0, 360) });
  init();
  onResize(init);

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = pointerPos(canvas, e);
    grabbed = balls.find((b) => Math.hypot(b.x - p.x, b.y - p.y) < b.r + 6);
    if (!grabbed) {
      if (balls.length >= 40) balls.shift();
      grabbed = makeBall(p.x, p.y);
      balls.push(grabbed);
    }
    grabbed.vx = grabbed.vy = 0;
    last = { ...p, t: performance.now() };
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!grabbed) return;
    const p = pointerPos(canvas, e);
    const now = performance.now();
    const dt = Math.max(1, now - last.t) / 16.7;
    grabbed.vx = (p.x - last.x) / dt;
    grabbed.vy = (p.y - last.y) / dt;
    grabbed.x = p.x;
    grabbed.y = p.y;
    last = { ...p, t: now };
  });
  const release = () => { grabbed = null; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  document.getElementById('balls-clear').addEventListener('click', () => (balls = []));

  loop(canvas, () => {
    ctx.fillStyle = 'rgba(5, 3, 15, 0.4)';
    ctx.fillRect(0, 0, w, h);

    for (const b of balls) {
      if (b === grabbed) continue;
      b.vy += G;
      b.x += b.vx;
      b.y += b.vy;
      if (b.y + b.r > h) { b.y = h - b.r; b.vy *= -BOUNCE; b.vx *= 0.99; }
      if (b.x - b.r < 0) { b.x = b.r; b.vx *= -BOUNCE; }
      if (b.x + b.r > w) { b.x = w - b.r; b.vx *= -BOUNCE; }
      if (b.y - b.r < 0) { b.y = b.r; b.vy *= -BOUNCE; }
    }

    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.r + b.r;
        if (d < min) {
          const nx = dx / d, ny = dy / d;
          const overlap = (min - d) / 2;
          if (a !== grabbed) { a.x -= nx * overlap; a.y -= ny * overlap; }
          if (b !== grabbed) { b.x += nx * overlap; b.y += ny * overlap; }
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel > 0) {
            const ma = a.r * a.r, mb = b.r * b.r;
            const imp = (2 * rel) / (ma + mb) * 0.9;
            if (a !== grabbed) { a.vx -= imp * mb * nx; a.vy -= imp * mb * ny; }
            if (b !== grabbed) { b.vx += imp * ma * nx; b.vy += imp * ma * ny; }
          }
        }
      }
    }

    for (const b of balls) {
      const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r);
      g.addColorStop(0, `hsl(${b.hue}, 100%, 85%)`);
      g.addColorStop(1, `hsl(${b.hue}, 90%, 50%)`);
      ctx.shadowColor = `hsl(${b.hue}, 100%, 60%)`;
      ctx.shadowBlur = 20;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  });
})();

/* ---------------- Matrix rain ---------------- */
(function matrix() {
  const canvas = document.getElementById('matrix');
  const ctx = canvas.getContext('2d');
  const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEFXYZ<>/{}=+*#@';
  const FS = 16;
  let w, h, drops, hue = 130, tick = 0;

  function init() {
    ({ w, h } = fitCanvas(canvas, ctx));
    drops = Array.from({ length: Math.ceil(w / FS) }, () => rand(-h / FS, 0));
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
  }
  init();
  onResize(init);
  canvas.addEventListener('pointermove', (e) => (hue = (pointerPos(canvas, e).x / w) * 360));

  loop(canvas, () => {
    if (tick++ % 2) return;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = `${FS}px monospace`;
    for (let i = 0; i < drops.length; i++) {
      const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
      const x = i * FS, y = drops[i] * FS;
      ctx.fillStyle = `hsl(${hue}, 100%, 85%)`;
      ctx.fillText(ch, x, y);
      ctx.fillStyle = `hsl(${hue}, 100%, 45%)`;
      ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], x, y - FS);
      if (y > h && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  });
})();

/* ---------------- Lava lamp (metaballs) ---------------- */
(function lava() {
  const canvas = document.getElementById('lava');
  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas');
  const octx = off.getContext('2d');
  const S = 4;
  let w, h, lw, lh, img, blobs, mouseBlob = null;

  function init() {
    ({ w, h } = fitCanvas(canvas, ctx));
    lw = Math.ceil(w / S);
    lh = Math.ceil(h / S);
    off.width = lw;
    off.height = lh;
    img = octx.createImageData(lw, lh);
    blobs = Array.from({ length: 7 }, () => ({
      x: rand(0, lw), y: rand(0, lh), vx: rand(-0.4, 0.4), vy: rand(-0.4, 0.4), r: rand(lh * 0.07, lh * 0.15),
    }));
  }
  init();
  onResize(init);
  canvas.addEventListener('pointermove', (e) => {
    const p = pointerPos(canvas, e);
    mouseBlob = { x: p.x / S, y: p.y / S, r: lh * 0.11 };
  });
  canvas.addEventListener('pointerleave', () => (mouseBlob = null));

  loop(canvas, (t) => {
    for (const b of blobs) {
      b.vy += Math.sin(t * 0.5 + b.x) * 0.01;
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < 0 || b.x > lw) b.vx *= -1;
      if (b.y < 0 || b.y > lh) b.vy *= -1;
    }
    const all = mouseBlob ? [...blobs, mouseBlob] : blobs;
    const d = img.data;
    let i = 0;
    for (let y = 0; y < lh; y++) {
      for (let x = 0; x < lw; x++, i += 4) {
        let sum = 0;
        for (const b of all) {
          const dx = x - b.x, dy = y - b.y;
          sum += (b.r * b.r) / (dx * dx + dy * dy + 1);
        }
        if (sum > 1) {
          const k = Math.min(1, (sum - 1) / 2);
          d[i] = 255;
          d[i + 1] = 60 + k * 190;
          d[i + 2] = 20 + k * 60;
          d[i + 3] = 255;
        } else {
          const glow = Math.min(1, sum) * 60;
          d[i] = 40 + glow;
          d[i + 1] = 5;
          d[i + 2] = 25 + glow * 0.5;
          d[i + 3] = 255;
        }
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.filter = 'blur(2px)';
    ctx.drawImage(off, 0, 0, w, h);
    ctx.filter = 'none';
  });
})();

/* ---------------- Hyperspace warp ---------------- */
(function warp() {
  const canvas = document.getElementById('warp');
  const ctx = canvas.getContext('2d');
  let w, h, stars, speed = 0.012, target = 0.012;

  function init() {
    ({ w, h } = fitCanvas(canvas, ctx));
    stars = Array.from({ length: 500 }, () => ({ x: rand(-1, 1), y: rand(-1, 1), z: rand(0.05, 1) }));
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
  }
  init();
  onResize(init);
  canvas.addEventListener('pointerdown', () => (target = 0.18));
  const slow = () => (target = 0.012);
  canvas.addEventListener('pointerup', slow);
  canvas.addEventListener('pointerleave', slow);

  loop(canvas, () => {
    speed += (target - speed) * 0.04;
    const k = (speed - 0.012) / (0.18 - 0.012);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.5 - k * 0.3})`;
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, scale = w / 2;
    ctx.lineCap = 'round';
    for (const s of stars) {
      const pz = s.z;
      s.z -= speed;
      if (s.z <= 0.02) { s.x = rand(-1, 1); s.y = rand(-1, 1); s.z = 1; continue; }
      const x1 = cx + (s.x / pz) * scale, y1 = cy + (s.y / pz) * scale;
      const x2 = cx + (s.x / s.z) * scale, y2 = cy + (s.y / s.z) * scale;
      if (x2 < 0 || x2 > w || y2 < 0 || y2 > h) { s.x = rand(-1, 1); s.y = rand(-1, 1); s.z = 1; continue; }
      const depth = 1 - s.z;
      ctx.strokeStyle = `hsla(${220 + k * 80 - depth * 40}, 100%, ${70 + depth * 25}%, ${0.4 + depth * 0.6})`;
      ctx.lineWidth = depth * 2.5 + 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  });
})();
