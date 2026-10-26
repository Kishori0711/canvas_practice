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

/* ---------------- Hero: particle network ---------------- */
(function hero() {
  const canvas = document.getElementById('hero');
  const ctx = canvas.getContext('2d');
  const section = document.getElementById('hero-section');
  const mouse = { x: null, y: null };
  let w, h, pts = [];

  function init() {
    ({ w, h } = fitCanvas(canvas, ctx));
    const count = Math.min(150, Math.floor((w * h) / 9000));
    pts = Array.from({ length: count }, () => ({
      x: rand(0, w), y: rand(0, h),
      vx: rand(-0.4, 0.4), vy: rand(-0.4, 0.4),
      r: rand(0.8, 2.4),
    }));
  }
  init();
  onResize(init);

  section.addEventListener('pointermove', (e) => Object.assign(mouse, pointerPos(canvas, e)));
  section.addEventListener('pointerleave', () => (mouse.x = null));

  const LINK = 130;
  loop(canvas, (t) => {
    ctx.clearRect(0, 0, w, h);
    const hueOf = (x) => (200 + (x / w) * 120 + t * 15) % 360;

    for (const p of pts) {
      if (mouse.x !== null) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < 140 && d > 0) {
          const force = (140 - d) / 140;
          p.x += (dx / d) * force * 4;
          p.y += (dy / d) * force * 4;
        }
      }
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      p.x = Math.max(0, Math.min(w, p.x));
      p.y = Math.max(0, Math.min(h, p.y));
    }

    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK * LINK) {
          const alpha = 1 - Math.sqrt(d2) / LINK;
          ctx.strokeStyle = `hsla(${hueOf(a.x)}, 90%, 65%, ${alpha * 0.45})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const p of pts) {
      ctx.fillStyle = `hsl(${hueOf(p.x)}, 90%, 70%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
  });
})();

/* ---------------- Ocean sunset waves ---------------- */
(function waves() {
  const canvas = document.getElementById('waves');
  const ctx = canvas.getContext('2d');
  let w, h;
  const init = () => ({ w, h } = fitCanvas(canvas, ctx));
  init();
  onResize(init);

  const layers = [
    { off: 0.55, amp: 14, len: 0.010, speed: 0.6, alpha: 0.5, colors: ['#7c3aed', '#1e1b4b'] },
    { off: 0.63, amp: 18, len: 0.014, speed: 0.9, alpha: 0.6, colors: ['#db2777', '#312e81'] },
    { off: 0.72, amp: 20, len: 0.018, speed: 1.2, alpha: 0.75, colors: ['#0ea5e9', '#1e3a8a'] },
    { off: 0.82, amp: 16, len: 0.022, speed: 1.6, alpha: 0.9, colors: ['#22d3ee', '#0f172a'] },
  ];

  loop(canvas, (t) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0f172a');
    sky.addColorStop(0.5, '#4c1d95');
    sky.addColorStop(1, '#f97316');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const sx = w * 0.7, sy = h * 0.5 + Math.sin(t * 0.3) * 6, sr = Math.min(w, h) * 0.18;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.2);
    glow.addColorStop(0, 'rgba(253, 224, 71, 1)');
    glow.addColorStop(0.35, 'rgba(251, 146, 60, 0.9)');
    glow.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 2.2, 0, TAU);
    ctx.fill();

    for (const L of layers) {
      const base = h * L.off;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w + 4; x += 4) {
        const y = base
          + Math.sin(x * L.len + t * L.speed) * L.amp
          + Math.sin(x * L.len * 2.3 - t * L.speed * 0.7) * L.amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, base - L.amp, 0, h);
      g.addColorStop(0, L.colors[0]);
      g.addColorStop(1, L.colors[1]);
      ctx.globalAlpha = L.alpha;
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
})();

/* ---------------- Generative flow field ---------------- */
(function flow() {
  const canvas = document.getElementById('flow');
  const ctx = canvas.getContext('2d');
  let w, h, seed, hueBase, frame, particles;

  const field = (x, y) =>
    Math.sin(x * 0.007 + seed) * Math.cos(y * 0.008 - seed * 0.7) +
    Math.sin((x + y) * 0.004 + seed * 1.3) * 0.7;

  function reset() {
    ({ w, h } = fitCanvas(canvas, ctx));
    seed = rand(0, 1000);
    hueBase = rand(0, 360);
    frame = 0;
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);
    particles = Array.from({ length: 1000 }, () => ({ x: rand(0, w), y: rand(0, h) }));
  }
  reset();
  onResize(reset);
  document.getElementById('flow-reset').addEventListener('click', reset);

  loop(canvas, () => {
    if (frame++ > 700) return;
    ctx.lineWidth = 0.8;
    for (const p of particles) {
      const angle = field(p.x, p.y) * TAU;
      const nx = p.x + Math.cos(angle) * 1.4;
      const ny = p.y + Math.sin(angle) * 1.4;
      ctx.strokeStyle = `hsla(${hueBase + (p.y / h) * 100 + (p.x / w) * 40}, 85%, 62%, 0.07)`;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      p.x = nx;
      p.y = ny;
      if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
        p.x = rand(0, w);
        p.y = rand(0, h);
      }
    }
  });
})();

/* ---------------- Kaleidoscope drawing pad ---------------- */
(function drawPad() {
  const canvas = document.getElementById('draw');
  const ctx = canvas.getContext('2d');
  const sizeInput = document.getElementById('draw-size');
  const symInput = document.getElementById('draw-sym');
  const BG = '#0b1120';
  let w, h, drawing = false, last = null, hue = 0;

  function paintBackground() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Yahan draw karo ✏️', w / 2, h / 2);
  }

  function resize(keep) {
    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    snapshot.getContext('2d').drawImage(canvas, 0, 0);
    ({ w, h } = fitCanvas(canvas, ctx));
    if (keep) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(snapshot, 0, 0, w, h);
    } else {
      paintBackground();
    }
  }
  resize(false);
  onResize(() => resize(true));

  let hintVisible = true;
  function segment(a, b) {
    if (hintVisible) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      hintVisible = false;
    }
    const n = +symInput.value;
    const cx = w / 2, cy = h / 2;
    const color = `hsl(${hue}, 95%, 62%)`;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = +sizeInput.value;
    ctx.lineCap = 'round';
    ctx.translate(cx, cy);
    for (let i = 0; i < n; i++) {
      ctx.rotate(TAU / n);
      const mirrors = n > 1 ? [1, -1] : [1];
      for (const m of mirrors) {
        ctx.beginPath();
        ctx.moveTo(a.x - cx, (a.y - cy) * m);
        ctx.lineTo(b.x - cx, (b.y - cy) * m);
        ctx.stroke();
      }
    }
    ctx.restore();
    hue = (hue + 1.5) % 360;
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    drawing = true;
    last = pointerPos(canvas, e);
    segment(last, { x: last.x + 0.1, y: last.y });
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = pointerPos(canvas, e);
    segment(last, p);
    last = p;
  });
  const stop = () => (drawing = false);
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  document.getElementById('draw-clear').addEventListener('click', () => {
    hintVisible = true;
    paintBackground();
  });
  document.getElementById('draw-save').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'kaleidoscope.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
})();

/* ---------------- Fireworks ---------------- */
(function fireworks() {
  const canvas = document.getElementById('fireworks');
  const ctx = canvas.getContext('2d');
  let w, h;
  const rockets = [];
  const sparks = [];

  function init() {
    ({ w, h } = fitCanvas(canvas, ctx));
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);
  }
  init();
  onResize(init);

  const launch = (tx, ty) => rockets.push({ x: tx, y: h, ty, hue: rand(0, 360) });

  function explode(r) {
    const count = Math.floor(rand(70, 120));
    for (let i = 0; i < count; i++) {
      const angle = rand(0, TAU);
      const speed = rand(1, 5);
      sparks.push({
        x: r.x, y: r.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        hue: r.hue + rand(-25, 25),
        life: 1,
        decay: rand(0.008, 0.02),
      });
    }
  }

  canvas.addEventListener('click', (e) => {
    const p = pointerPos(canvas, e);
    launch(p.x, p.y);
  });

  loop(canvas, () => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(2, 6, 23, 0.22)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    if (Math.random() < 0.025) launch(rand(w * 0.1, w * 0.9), rand(h * 0.1, h * 0.45));

    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.y -= 7;
      ctx.fillStyle = `hsl(${r.hue}, 100%, 75%)`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2, 0, TAU);
      ctx.fill();
      if (r.y <= r.ty) {
        explode(r);
        rockets.splice(i, 1);
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.vx *= 0.98;
      s.vy = s.vy * 0.98 + 0.05;
      s.x += s.vx;
      s.y += s.vy;
      s.life -= s.decay;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `hsla(${s.hue}, 100%, 65%, ${s.life})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.8, 0, TAU);
      ctx.fill();
    }
  });
})();

/* ---------------- 3D dot sphere ---------------- */
(function sphere() {
  const canvas = document.getElementById('sphere');
  const ctx = canvas.getContext('2d');
  let w, h;
  const init = () => ({ w, h } = fitCanvas(canvas, ctx));
  init();
  onResize(init);

  const N = 700;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const points = Array.from({ length: N }, (_, i) => {
    const y = 1 - (i / (N - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const phi = i * golden;
    return { x: Math.cos(phi) * radius, y, z: Math.sin(phi) * radius };
  });

  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  canvas.addEventListener('pointermove', (e) => {
    const p = pointerPos(canvas, e);
    target.x = (p.x / w - 0.5) * 2;
    target.y = (p.y / h - 0.5) * 2;
  });
  canvas.addEventListener('pointerleave', () => (target.x = target.y = 0));

  let rotY = 0;
  loop(canvas, (t) => {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    current.x += (target.x - current.x) * 0.05;
    current.y += (target.y - current.y) * 0.05;
    rotY += 0.004 + current.x * 0.03;
    const rotX = current.y * 0.9;

    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const R = Math.min(w, h) * 0.36;
    const cx = w / 2, cy = h / 2;
    const pulse = 1 + Math.sin(t * 1.5) * 0.03;

    const projected = points.map((p) => {
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;
      const persp = 2.5 / (2.5 + z2);
      return {
        x: cx + x1 * R * persp * pulse,
        y: cy + y2 * R * persp * pulse,
        z: z2,
        persp,
        hue: 150 + p.y * 60 + t * 20,
      };
    });
    projected.sort((a, b) => b.z - a.z);

    for (const p of projected) {
      const depth = (1 - p.z) / 2;
      ctx.fillStyle = `hsla(${p.hue}, 85%, ${45 + depth * 25}%, ${0.15 + depth * 0.85})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.6 + p.persp * 1.6 * depth + 0.4, 0, TAU);
      ctx.fill();
    }
  });
})();

/* ---------------- Spirograph ---------------- */
(function spiro() {
  const canvas = document.getElementById('spiro');
  const ctx = canvas.getContext('2d');
  let w, h, r, d, hue, theta, prev, scale;

  function reset() {
    ({ w, h } = fitCanvas(canvas, ctx));
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);
    r = Math.round(rand(0.15, 0.85) * 40) / 40;
    d = r * rand(0.6, 1.6);
    hue = rand(0, 360);
    theta = 0;
    prev = null;
    scale = (Math.min(w, h) * 0.46) / (1 - r + d);
  }
  reset();
  onResize(reset);
  document.getElementById('spiro-reset').addEventListener('click', reset);

  const point = (th) => {
    const k = (1 - r) / r;
    return {
      x: w / 2 + ((1 - r) * Math.cos(th) + d * Math.cos(k * th)) * scale,
      y: h / 2 + ((1 - r) * Math.sin(th) - d * Math.sin(k * th)) * scale,
    };
  };

  loop(canvas, () => {
    if (theta > TAU * 40) {
      reset();
      return;
    }
    ctx.lineWidth = 1.2;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 25; i++) {
      theta += 0.02;
      const p = point(theta);
      if (prev) {
        ctx.strokeStyle = `hsla(${hue + theta * 3}, 90%, 60%, 0.6)`;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      prev = p;
    }
    ctx.globalCompositeOperation = 'source-over';
  });
})();
