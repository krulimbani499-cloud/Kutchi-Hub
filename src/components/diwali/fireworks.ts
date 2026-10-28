// A short, silent fireworks burst on a canvas laid over the page. Loaded on demand (dynamic import) by DiwaliHome.
// The canvas ignores taps (pointer-events: none), makes no sound, lasts about 2.8 seconds and removes itself.

type Particle = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; color: string };

const COLORS = ["#fbbf24", "#f97316", "#ef4444", "#ec4899", "#a78bfa", "#34d399", "#fde68a"];
const DURATION_MS = 2800;
const BURSTS_AT_MS = [100, 800, 1500]; // three bursts

/** Starts the show; returns a function that stops it and removes the canvas at once. */
export function launchFireworks(): () => void {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("data-diwali-fireworks", "");
  canvas.setAttribute("aria-hidden", "true");
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // sharp enough, cheap on phones
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "60" });
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  ctx.scale(dpr, dpr);
  document.body.appendChild(canvas);

  const perBurst = w < 500 ? 55 : 85;
  const particles: Particle[] = [];
  const burst = () => {
    const cx = w * (0.2 + Math.random() * 0.6);
    const cy = h * (0.15 + Math.random() * 0.3);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const second = COLORS[Math.floor(Math.random() * COLORS.length)];
    for (let i = 0; i < perBurst; i++) {
      const angle = (Math.PI * 2 * i) / perBurst + Math.random() * 0.2;
      const speed = 1.4 + Math.random() * 3.2;
      particles.push({ x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: 900 + Math.random() * 700, size: 1.4 + Math.random() * 1.6, color: i % 3 === 0 ? second : color });
    }
  };

  const started = performance.now();
  let last = started;
  let nextBurst = 0;
  let raf = 0;
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    canvas.remove();
  };

  const frame = (now: number) => {
    if (stopped) return;
    const elapsed = now - started;
    const dt = Math.min(now - last, 50);
    last = now;
    while (nextBurst < BURSTS_AT_MS.length && elapsed >= BURSTS_AT_MS[nextBurst]) {
      burst();
      nextBurst++;
    }
    ctx.clearRect(0, 0, w, h);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      const k = dt / 16;
      p.vy += 0.045 * k; // gravity
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * k;
      p.y += p.vy * k;
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (elapsed >= DURATION_MS && particles.length === 0) return stop();
    if (elapsed >= DURATION_MS + 1200) return stop(); // never lingers
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return stop;
}
