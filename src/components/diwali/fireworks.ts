// Rocket fireworks on a canvas laid over the page. Loaded on demand (dynamic import) by DiwaliHome.
// Three rockets, about 0.3 s apart, rise from the bottom leaving a glowing spark trail, slow down in the top third of the screen
// and burst into coloured sparks that fall with gravity and fade out. Silent, ignores taps (pointer-events: none), lasts about
// 3.5 seconds and removes itself. Cheap on purpose: one canvas, one requestAnimationFrame loop, a hard cap on live particles.

type Spark = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; color: string };
type Rocket = { x0: number; y0: number; x1: number; y1: number; launchAt: number; flightMs: number; colors: [string, string]; state: "waiting" | "flying" | "done"; x: number; y: number; trailDebt: number };

const PALETTE = ["#fbbf24", "#fb923c", "#ef4444", "#22c55e", "#a855f7"]; // gold, orange, red, green, purple
const MAX_DPR = 2;
const MAX_PARTICLES = 380; // trail + burst sparks alive at once: keeps old phones smooth
const LAUNCH_AT_MS = [100, 400, 700]; // staggered by about 0.3 s
const END_BY_MS = 4200; // never lingers, whatever happens

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Starts the show; returns a function that stops it and removes the canvas at once. */
export function launchFireworks(): () => void {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("data-diwali-fireworks", "");
  canvas.setAttribute("aria-hidden", "true");
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "60" });
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  ctx.scale(dpr, dpr);
  document.body.appendChild(canvas);

  const burstSize = w < 500 ? 46 : 70;
  const px = w < 500 ? 1 : 1.6; // sparks, rocket head and flash are drawn bigger on a wide screen, where 1-2 px would be a thin thread
  const colors = [...PALETTE].sort(() => Math.random() - 0.5); // a different colour for each rocket
  const rockets: Rocket[] = LAUNCH_AT_MS.map((launchAt, i) => {
    const x0 = w * (0.22 + i * 0.28) + rand(-0.04, 0.04) * w; // slightly different x positions
    const lean = rand(-0.1, 0.1) * w; // and angles: each leans a little to one side
    return {
      x0,
      y0: h + 8,
      x1: Math.min(w * 0.92, Math.max(w * 0.08, x0 + lean)),
      y1: h * rand(0.16, 0.32), // explodes in the top third
      launchAt,
      flightMs: rand(1050, 1300),
      colors: [colors[i], colors[(i + 3) % colors.length]],
      state: "waiting",
      x: x0,
      y: h + 8,
      trailDebt: 0,
    };
  });

  const sparks: Spark[] = [];
  const flashes: { x: number; y: number; age: number; color: string }[] = [];

  const explode = (r: Rocket) => {
    flashes.push({ x: r.x, y: r.y, age: 0, color: r.colors[0] });
    for (let i = 0; i < burstSize && sparks.length < MAX_PARTICLES; i++) {
      const angle = (Math.PI * 2 * i) / burstSize + rand(0, 0.25);
      const speed = i % 2 === 0 ? rand(2.6, 4.2) : rand(1.1, 2.4); // an outer and an inner ring: a fuller burst
      sparks.push({ x: r.x, y: r.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: rand(900, 1500), size: rand(1.3, 2.3) * px, color: i % 3 === 0 ? r.colors[1] : r.colors[0] });
    }
  };

  const started = performance.now();
  let last = started;
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
    const k = dt / 16.67; // 1 at 60 frames per second: movement does not depend on the frame rate

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter"; // overlapping sparks add up to a glow

    // rockets: fast at first, slowing down as they near the top (ease-out), each leaving a short glowing trail
    for (const r of rockets) {
      if (r.state === "waiting" && elapsed >= r.launchAt) r.state = "flying";
      if (r.state !== "flying") continue;
      const t = Math.min((elapsed - r.launchAt) / r.flightMs, 1);
      const e = 1 - Math.pow(1 - t, 2.4);
      r.x = r.x0 + (r.x1 - r.x0) * e;
      r.y = r.y0 + (r.y1 - r.y0) * e;
      r.trailDebt += 2.2 * k; // about 2 trail sparks per frame
      while (r.trailDebt >= 1 && sparks.length < MAX_PARTICLES) {
        r.trailDebt -= 1;
        sparks.push({ x: r.x + rand(-1, 1), y: r.y + rand(0, 3), vx: rand(-0.25, 0.25), vy: rand(0.2, 0.8), age: 0, life: rand(280, 520), size: rand(1, 1.9) * px, color: Math.random() < 0.7 ? "#fbbf24" : "#fff3c4" });
      }
      r.trailDebt = Math.min(r.trailDebt, 3);
      // the rocket itself: a bright head with a soft halo
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(r.x, r.y, 5 * px, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fffbe6";
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2.2 * px, 0, Math.PI * 2);
      ctx.fill();
      if (t >= 1) {
        r.state = "done";
        explode(r);
      }
    }

    // the flash at the moment of an explosion
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.age += dt;
      if (f.age > 260) {
        flashes.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 0.5 * (1 - f.age / 260);
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, (6 + f.age * 0.12) * px, 0, Math.PI * 2);
      ctx.fill();
    }

    // sparks (trail and burst): gravity, a little drag, fade out
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      if (s.age >= s.life) {
        sparks.splice(i, 1);
        continue;
      }
      s.vy += 0.05 * k;
      s.vx *= 0.986;
      s.vy *= 0.986;
      s.x += s.vx * k;
      s.y += s.vy * k;
      ctx.globalAlpha = (1 - s.age / s.life) * 0.95;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    const allDone = rockets.every((r) => r.state === "done") && sparks.length === 0 && flashes.length === 0;
    if (allDone || elapsed >= END_BY_MS) return stop();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return stop;
}
