const TAU = Math.PI * 2;
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

const PALETTES = [
  { name: 'Aurora', flowHue: 160, flowRange: 140, face: ['#ecfeff', '#67e8f9', '#a78bfa'], side: [262, 70], glow: 'rgba(139, 92, 246, 0.9)' },
  { name: 'Sunset', flowHue: 320, flowRange: 90, face: ['#fff7ed', '#fdba74', '#f43f5e'], side: [345, 75], glow: 'rgba(244, 63, 94, 0.9)' },
  { name: 'Ocean', flowHue: 180, flowRange: 60, face: ['#f0f9ff', '#7dd3fc', '#2563eb'], side: [222, 80], glow: 'rgba(37, 99, 235, 0.9)' },
  { name: 'Gold', flowHue: 20, flowRange: 35, face: ['#fffbeb', '#fcd34d', '#b45309'], side: [28, 85], glow: 'rgba(245, 158, 11, 0.9)' },
];
let palette = PALETTES[0];

const flowCanvas = document.getElementById('flow');
const fctx = flowCanvas.getContext('2d');
const textCanvas = document.getElementById('text');
const tctx = textCanvas.getContext('2d');
const input = document.getElementById('text-input');

const BG = '#030308';
const mouse = { x: null, y: null, nx: 0, ny: 0 };
const tilt = { x: 0, y: 0 };
let w, h, dpr, seed, particles;

function fit(canvas, ctx) {
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ---------------- Flow field background ---------------- */
function field(x, y, t) {
  return (
    Math.sin(x * 0.004 + seed + t * 0.15) * Math.cos(y * 0.005 - seed * 0.6 + t * 0.1) +
    Math.sin((x - y) * 0.003 + seed * 1.7 - t * 0.12) * 0.8 +
    Math.cos(Math.hypot(x - w / 2, y - h / 2) * 0.006 - t * 0.3) * 0.4
  );
}

function spawn(p) {
  p.x = rand(0, w);
  p.y = rand(0, h);
  p.age = 0;
  p.life = rand(80, 260);
  return p;
}

function resetFlow() {
  seed = rand(0, 1000);
  fctx.fillStyle = BG;
  fctx.fillRect(0, 0, w, h);
  const count = Math.min(1800, Math.floor((w * h) / 600));
  particles = Array.from({ length: count }, () => spawn({}));
}

function stepFlow(t) {
  fctx.fillStyle = 'rgba(3, 3, 8, 0.06)';
  fctx.fillRect(0, 0, w, h);
  fctx.lineWidth = 1.1;
  fctx.lineCap = 'round';

  for (const p of particles) {
    const v = field(p.x, p.y, t);
    const angle = v * Math.PI;
    let vx = Math.cos(angle) * 1.6;
    let vy = Math.sin(angle) * 1.6;

    if (mouse.x !== null) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const d = Math.hypot(dx, dy);
      if (d < 200 && d > 0) {
        const f = (1 - d / 200) * 3;
        vx += (-dy / d) * f;
        vy += (dx / d) * f;
      }
    }

    const hue = palette.flowHue + ((v + 2.2) / 4.4) * palette.flowRange;
    const alpha = Math.sin((p.age / p.life) * Math.PI) * 0.85;
    fctx.strokeStyle = `hsla(${hue}, 95%, 62%, ${alpha})`;
    fctx.beginPath();
    fctx.moveTo(p.x, p.y);
    p.x += vx;
    p.y += vy;
    fctx.lineTo(p.x, p.y);
    fctx.stroke();

    if (++p.age > p.life || p.x < 0 || p.x > w || p.y < 0 || p.y > h) spawn(p);
  }
}

/* ---------------- 3D extruded text ---------------- */
const font = (size) => `900 ${size}px Poppins, "Arial Black", Impact, sans-serif`;

function drawText(ctx, t) {
  const text = (input.value.trim() || 'CANVAS').toUpperCase();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let size = Math.min(w * 0.2, h * 0.32);
  ctx.font = font(size);
  const measured = ctx.measureText(text).width;
  if (measured > w * 0.82) size *= (w * 0.82) / measured;
  ctx.font = font(size);

  const cx = w / 2;
  const cy = h * 0.45 + Math.sin(t * 1.3) * size * 0.04;
  const depth = Math.max(8, Math.round(size * 0.16));
  const ox = 0.25 + tilt.x * 0.9;
  const oy = 0.45 + tilt.y * 0.9;
  const [sideHue, sideSat] = palette.side;

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = `hsl(${sideHue}, ${sideSat}%, 8%)`;
  ctx.fillText(text, cx + ox * depth, cy + oy * depth);
  ctx.restore();

  for (let i = depth; i > 0; i--) {
    const k = 1 - i / depth;
    ctx.fillStyle = `hsl(${sideHue}, ${sideSat}%, ${10 + k * 32}%)`;
    ctx.fillText(text, cx + ox * i, cy + oy * i);
  }

  const face = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
  palette.face.forEach((c, i) => face.addColorStop(i / (palette.face.length - 1), c));
  ctx.fillStyle = face;
  ctx.fillText(text, cx, cy);

  const textW = ctx.measureText(text).width;
  const left = cx - textW / 2;
  const pos = ((t * 0.35) % 1.8) - 0.4;
  const shine = ctx.createLinearGradient(left, cy - size / 2, left + textW, cy + size / 2);
  shine.addColorStop(clamp01(pos - 0.12), 'rgba(255, 255, 255, 0)');
  shine.addColorStop(clamp01(pos), 'rgba(255, 255, 255, 0.85)');
  shine.addColorStop(clamp01(pos + 0.12), 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = shine;
  ctx.fillText(text, cx, cy);

  ctx.lineWidth = Math.max(1, size * 0.012);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.strokeText(text, cx, cy);

  ctx.font = `600 ${Math.max(11, size * 0.1)}px Poppins, sans-serif`;
  ctx.letterSpacing = '0.6em';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText('GENERATIVE · FLOW · 3D', cx, cy + size * 0.72 + depth * Math.max(0, oy));
  ctx.letterSpacing = '0px';
}

/* ---------------- Setup ---------------- */
function resize() {
  w = window.innerWidth;
  h = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  fit(flowCanvas, fctx);
  fit(textCanvas, tctx);
  resetFlow();
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 150);
});

window.addEventListener('pointermove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.nx = (e.clientX / w - 0.5) * 2;
  mouse.ny = (e.clientY / h - 0.5) * 2;
});
document.addEventListener('pointerleave', () => {
  mouse.x = null;
  mouse.nx = mouse.ny = 0;
});

const paletteBox = document.getElementById('palettes');
PALETTES.forEach((p) => {
  const btn = document.createElement('button');
  btn.title = p.name;
  btn.className = 'w-8 h-8 rounded-full border-2 border-white/20 hover:scale-110 transition';
  btn.style.background = `linear-gradient(135deg, ${p.face.join(', ')})`;
  btn.addEventListener('click', () => {
    palette = p;
    [...paletteBox.children].forEach((b) => b.classList.replace('border-white', 'border-white/20'));
    btn.classList.replace('border-white/20', 'border-white');
  });
  paletteBox.appendChild(btn);
});
paletteBox.children[0].classList.replace('border-white/20', 'border-white');

document.getElementById('shuffle').addEventListener('click', resetFlow);

document.getElementById('save').addEventListener('click', () => {
  const out = document.createElement('canvas');
  out.width = flowCanvas.width;
  out.height = flowCanvas.height;
  const octx = out.getContext('2d');
  octx.drawImage(flowCanvas, 0, 0);
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawText(octx, performance.now() / 1000);
  const link = document.createElement('a');
  link.download = 'flow-3d-text.png';
  link.href = out.toDataURL('image/png');
  link.click();
});

function frame(now) {
  const t = now / 1000;
  tilt.x += (mouse.nx - tilt.x) * 0.06;
  tilt.y += (mouse.ny - tilt.y) * 0.06;
  textCanvas.style.transform = `rotateX(${tilt.y * 12}deg) rotateY(${-tilt.x * 16}deg)`;

  stepFlow(t);
  tctx.clearRect(0, 0, w, h);
  drawText(tctx, t);
  requestAnimationFrame(frame);
}

resize();
document.fonts.ready.then(() => requestAnimationFrame(frame));
