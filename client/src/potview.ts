import { hash, identityFor } from "../../shared/identity";
import { ingredientWeightAt, type Broth, type Ingredient } from "../../shared/types";

type Floater = { x: number; y: number; vx: number; vy: number; phase: number };
type Bubble = { x: number; y: number; r: number; age: number; life: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = (c: RGB, alpha = 1) => `rgb(${c.map(Math.round).join(" ")} / ${alpha})`;

const SAD: RGB = [92, 110, 140];
const NEUTRAL: RGB = [176, 138, 92];
const HAPPY: RGB = [226, 172, 72];

function brothColor(b: Readonly<Broth>): RGB {
  let c = b.valence < 0 ? mix(NEUTRAL, SAD, -b.valence) : mix(NEUTRAL, HAPPY, b.valence);
  const grey = (c[0] + c[1] + c[2]) / 3;
  c = mix([grey, grey, grey], c, 0.55 + 0.45 * b.energy);
  const shade = lerp(1.15, 0.72, b.warmth);
  return [Math.min(255, c[0] * shade * lerp(0.95, 1.08, b.warmth)), Math.min(255, c[1] * shade), Math.min(255, c[2] * shade * lerp(1.08, 0.9, b.warmth))];
}

export function createPotView(
  canvas: HTMLCanvasElement,
  getBroth: () => Readonly<Broth>,
  getIngredients: () => Ingredient[],
  serverNow: () => number,
) {
  const ctx = canvas.getContext("2d")!;
  const floaters = new Map<string, Floater>();
  const bubbles: Bubble[] = [];
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  let ink = "#2b241c";
  let line = "#e2d9ca";
  let last = performance.now();
  let t = 0;

  const readTheme = () => {
    const css = getComputedStyle(document.documentElement);
    ink = css.getPropertyValue("--ink").trim() || ink;
    line = css.getPropertyValue("--line").trim() || line;
  };
  readTheme();
  setInterval(readTheme, 2000);

  function frame(nowMs: number) {
    const dt = Math.min(0.1, (nowMs - last) / 1000);
    last = nowMs;
    const motion = calm.matches ? 0.15 : 1;
    const b = getBroth();
    t += dt * motion * (0.3 + 1.5 * b.energy);

    const dpr = devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.46;

    const color = brothColor(b);
    const wobble = (2 + 10 * b.tension + 5 * b.energy) * motion;
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const d = r + Math.sin(a * 3 + t * 2) * wobble * 0.5 + Math.sin(a * 7 - t * 3) * wobble * 0.3;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    const fill = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    fill.addColorStop(0, rgb(mix(color, [255, 255, 255], 0.18)));
    fill.addColorStop(1, rgb(mix(color, [0, 0, 0], 0.12)));
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = line;
    ctx.stroke();

    if (Math.random() < dt * (0.5 + b.density * 12) * motion) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r * 0.85;
      bubbles.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: 2 + Math.random() * 4, age: 0, life: 1 + Math.random() });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const bub = bubbles[i];
      bub.age += dt;
      if (bub.age > bub.life) {
        bubbles.splice(i, 1);
        continue;
      }
      const k = bub.age / bub.life;
      ctx.beginPath();
      ctx.arc(bub.x, bub.y, bub.r * (0.5 + k), 0, Math.PI * 2);
      ctx.strokeStyle = rgb(mix(color, [255, 255, 255], 0.45), 1 - k);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const now = serverNow();
    const ingredients = getIngredients();
    const seen = new Set<string>();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "12px ui-monospace, Menlo, monospace";
    const placed = ingredients.map((ing) => {
      const weight = ingredientWeightAt(ing, now);
      seen.add(ing.id);
      let f = floaters.get(ing.id);
      if (!f) {
        const a = (hash(ing.name) % 360) * (Math.PI / 180);
        f = { x: cx + Math.cos(a) * r * 0.5, y: cy + Math.sin(a) * r * 0.5, vx: 0, vy: 0, phase: Math.random() * 10 };
        floaters.set(ing.id, f);
      }
      return { ing, f, weight, size: 14 + 28 * weight };
    });

    for (const { f, size } of placed) {
      const dx = f.x - cx;
      const dy = f.y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const stir = (6 + 30 * b.energy) * motion;
      const jitter = (4 + 30 * b.tension) * motion;
      f.vx += (-dy / dist) * stir * dt + Math.sin(t * 1.3 + f.phase) * jitter * dt;
      f.vy += (dx / dist) * stir * dt + Math.cos(t * 1.1 + f.phase) * jitter * dt;
      const room = r - size - 4;
      if (dist > room) {
        f.vx -= (dx / dist) * (dist - room) * 4 * dt;
        f.vy -= (dy / dist) * (dist - room) * 4 * dt;
      }
    }
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const c = placed[j];
        const dx = c.f.x - a.f.x;
        const dy = c.f.y - a.f.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const overlap = a.size + c.size + 6 - dist;
        if (overlap <= 0) continue;
        const push = overlap * 6 * dt;
        a.f.vx -= (dx / dist) * push;
        a.f.vy -= (dy / dist) * push;
        c.f.vx += (dx / dist) * push;
        c.f.vy += (dy / dist) * push;
      }

    for (const { ing, f, weight, size } of placed) {
      f.vx *= 0.96;
      f.vy *= 0.96;
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      const tint = ing.addedBy.length ? identityFor(ing.addedBy[0]).color : "#9c6644";
      ctx.globalAlpha = Math.max(0.25, Math.min(1, weight * 1.6));
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const d = size * (1 + 0.08 * Math.sin(a * 3 + t * 2 + f.phase));
        i ? ctx.lineTo(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d) : ctx.moveTo(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d);
      }
      ctx.fillStyle = tint;
      ctx.fill();
      ctx.globalAlpha = Math.max(0.55, Math.min(1, weight * 2));
      ctx.shadowColor = "rgb(0 0 0 / 0.55)";
      ctx.shadowBlur = 3;
      ctx.fillStyle = "#fff";
      ctx.fillText(ing.name, f.x, f.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    for (const id of floaters.keys()) if (!seen.has(id)) floaters.delete(id);

    if (!ingredients.length) {
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.45;
      ctx.fillText("just the stone, for now", cx, cy);
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
