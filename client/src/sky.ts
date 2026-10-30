import type { Sky } from "../../shared/protocol";
import { seeded } from "../../shared/numbers";
import { $ } from "./dom";
import { straining } from "./engine";

type Weather = NonNullable<Sky["weather"]>;
type Rgb = [number, number, number];

let sky: Sky | undefined;
let heardAt = 0;
let canvas: HTMLCanvasElement | undefined;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

const random = seeded(7);
const STARS = Array.from({ length: 140 }, () => ({ x: random(), y: random() * 0.75, r: 0.4 + random() * 1.1, twinkle: random() * 6 }));
const CLOUDS = Array.from({ length: 9 }, () => ({ x: random(), y: 0.08 + random() * 0.4, w: 0.25 + random() * 0.35, h: 0.06 + random() * 0.07, speed: 0.6 + random() * 0.8 }));
const DROPS = Array.from({ length: 400 }, () => ({ x: random(), y: random(), speed: 0.7 + random() * 0.6, sway: random() * 6 }));
let flashAt = 0;
let nextFlash = 0;
const FRAME_MS = 1000 / 30;
const STRAINED_FRAME_MS = 100;
let drawnAt = -Infinity;
const alongside: ((t: number) => void)[] = [];

export const withTheSky = (fn: (t: number) => void) => alongside.push(fn);

export function showSky(page: Sky | undefined) {
  canvas = $<HTMLCanvasElement>("sky");
  if (page) setSky(page);
  const frame = (t: number) => {
    if (t - drawnAt >= (straining() ? STRAINED_FRAME_MS : FRAME_MS) - 2) {
      drawnAt = t;
      draw(t);
      for (const fn of alongside) fn(t);
    }
    if (!still) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  addEventListener("resize", () => draw(performance.now()));
  setInterval(showTime, 1000);
}

export function setSky(next: Sky) {
  sky = next;
  heardAt = Date.now();
  $("listen-place").textContent = next.place;
  const said = next.weather ? capitalise(next.weather.conditions) : "Listening for the weather…";
  $("listen-conditions").textContent = said;
  $("credit").hidden = false;
  $<HTMLAnchorElement>("credit-link").href = next.credit.url;
  $("credit-link").textContent = next.credit.name;
  const line = $("sky-line");
  line.hidden = false;
  line.textContent = `${next.place}, ${localTime(next.at)} · ${next.weather?.conditions ?? "no weather yet"}${next.pace > 1 ? ` · replay at ${Math.round(next.pace)}×` : ""}`;
  showTime();
  if (still) draw(performance.now());
}

export const currentSky = () => sky;

export const weatherNow = () => (sky ? sky.at + (Date.now() - heardAt) * sky.pace : Date.now());

function localTime(at: number) {
  return new Intl.DateTimeFormat(undefined, { timeZone: sky?.timeZone, hour: "2-digit", minute: "2-digit" }).format(at);
}

function showTime() {
  if (!sky) return;
  const day = new Intl.DateTimeFormat(undefined, { timeZone: sky.timeZone, weekday: "long" }).format(weatherNow());
  $("listen-time").textContent = `${localTime(weatherNow())} · ${day}`;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const mix = (a: Rgb, b: Rgb, f: number): Rgb => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * f) as Rgb;
const css = ([r, g, b]: Rgb, alpha = 1) => `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;

const DAY_TOP: Rgb = [92, 148, 204];
const DAY_LOW: Rgb = [196, 222, 238];
const NIGHT_TOP: Rgb = [8, 13, 28];
const NIGHT_LOW: Rgb = [28, 40, 64];
const DUSK_LOW: Rgb = [232, 150, 102];
const GREY_DAY: Rgb = [150, 158, 166];
const GREY_NIGHT: Rgb = [36, 40, 47];

const isSnow = (code: number) => (code >= 71 && code <= 77) || code === 85 || code === 86;
const isFog = (code: number) => code === 45 || code === 48;
const isThunder = (code: number) => code >= 95;
const isDrizzle = (code: number) => code >= 51 && code <= 57;

function draw(t: number) {
  if (!canvas) return;
  const dpr = Math.min(1, devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const weather: Pick<Weather, "code" | "cloud" | "precipitation" | "wind" | "day"> = sky?.weather ?? { code: 2, cloud: 30, precipitation: 0, wind: 8, day: 0.5 };
  const day = weather.day;
  const cloud = weather.cloud / 100;
  const dusk = Math.max(0, 1 - Math.abs(day - 0.5) * 2.4) * (1 - cloud * 0.8);
  const grey = mix(GREY_NIGHT, GREY_DAY, day);
  const top = mix(mix(NIGHT_TOP, DAY_TOP, day), grey, cloud * 0.85);
  const low = mix(mix(mix(NIGHT_LOW, DAY_LOW, day), DUSK_LOW, dusk), grey, cloud * 0.75);
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, css(top));
  gradient.addColorStop(1, css(low));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  const light = (0.3 * low[0] + 0.59 * low[1] + 0.11 * low[2]) / 255 > 0.62;
  document.getElementById("listen")?.classList.toggle("light-sky", light);

  const starry = (1 - day) * Math.max(0, 1 - cloud * 1.4);
  if (starry > 0.02)
    for (const s of STARS) {
      ctx.fillStyle = css([255, 250, 235], starry * (0.55 + 0.45 * Math.sin(t / 900 + s.twinkle)));
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

  const glow = Math.max(0, 1 - cloud * 1.3);
  if (glow > 0.02) {
    const x = w * 0.78;
    const y = h * (0.62 - 0.4 * day);
    const r = Math.min(w, h) * (day > 0.5 ? 0.06 : 0.035);
    const halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 5);
    const tint: Rgb = day > 0.5 ? [255, 240, 200] : [225, 230, 245];
    halo.addColorStop(0, css(tint, 0.9 * glow));
    halo.addColorStop(0.2, css(tint, 0.25 * glow));
    halo.addColorStop(1, css(tint, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
  }

  const drift = (t / 1000) * (0.004 + weather.wind / 4000);
  const many = Math.round(cloud * CLOUDS.length);
  const shade = mix(mix([60, 66, 78], [250, 250, 252], day), grey, cloud * 0.6);
  for (const c of CLOUDS.slice(0, many)) {
    const x = (((c.x + drift * c.speed) % 1.4) + 1.4) % 1.4 - 0.2;
    for (let i = 0; i < 4; i++) {
      const cx = (x + (i - 1.5) * c.w * 0.22) * w;
      const cy = (c.y + Math.sin(i * 1.7) * c.h * 0.25) * h;
      const r = c.w * w * (0.2 + 0.06 * Math.cos(i * 2.3));
      const puff = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      puff.addColorStop(0, css(shade, 0.35 + 0.3 * cloud));
      puff.addColorStop(1, css(shade, 0));
      ctx.fillStyle = puff;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }

  if (isThunder(weather.code)) {
    if (t > nextFlash) {
      flashAt = t;
      nextFlash = t + 5000 + Math.random() * 9000;
    }
    const flash = Math.max(0, 1 - (t - flashAt) / 260) * (t - flashAt < 90 || t - flashAt > 160 ? 1 : 0.3);
    if (flash > 0) {
      ctx.fillStyle = css([235, 238, 255], 0.5 * flash);
      ctx.fillRect(0, 0, w, h);
    }
  }

  const precipitation = weather.precipitation;
  const falling = isSnow(weather.code) || precipitation > 0.05 || isDrizzle(weather.code) || weather.code >= 61;
  if (falling) {
    const count = Math.round(DROPS.length * Math.min(1, 0.15 + precipitation / 5));
    const slant = Math.min(0.6, weather.wind / 80);
    const snow = isSnow(weather.code);
    const drizzle = isDrizzle(weather.code);
    const fall = t / (snow ? 9000 : 900);
    ctx.strokeStyle = css(day > 0.4 ? [70, 84, 100] : [175, 190, 210], drizzle ? 0.35 : 0.5);
    ctx.fillStyle = css([250, 252, 255], 0.85);
    ctx.lineWidth = drizzle ? 0.8 : 1.1;
    ctx.beginPath();
    for (const d of DROPS.slice(0, count)) {
      const y = (d.y + fall * d.speed) % 1;
      const x = (d.x + y * slant * (snow ? 0.3 : 1) + (snow ? Math.sin(t / 1400 + d.sway) * 0.01 : 0)) % 1;
      if (snow) {
        ctx.moveTo(x * w + 1.6, y * h);
        ctx.arc(x * w, y * h, 1.6, 0, Math.PI * 2);
      } else {
        const len = (drizzle ? 7 : 16) * d.speed;
        ctx.moveTo(x * w, y * h);
        ctx.lineTo(x * w - slant * len, y * h + len);
      }
    }
    if (snow) ctx.fill();
    else ctx.stroke();
  }

  if (isFog(weather.code)) {
    const veil = ctx.createLinearGradient(0, 0, 0, h);
    const fog = mix([70, 76, 86], [228, 230, 232], day);
    veil.addColorStop(0, css(fog, 0.35));
    veil.addColorStop(1, css(fog, 0.8));
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);
  }
}
