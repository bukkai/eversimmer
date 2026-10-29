import type { Course } from "../../shared/types";
import { nearestRegions } from "../../shared/map";
import { $ } from "./dom";
import { currentCycle, getAir, getCps, getMapPosition, readSignal, straining, tidesNow } from "./engine";
import { serverNow } from "./net";
import { currentSky, weatherNow } from "./sky";

type Weather = NonNullable<NonNullable<ReturnType<typeof currentSky>>["weather"]>;

const READ_MS = 250;
const STRAINED_READ_MS = 500;
const VALUES_MS = 1000;
const SECONDS_PER_LINE = 1.6;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

let places: number | undefined;
let since: number | undefined;
const courses = new Map<string, Course>();
let shownCourse = "";

const round = (x: number) => Math.round(x).toString();
const signed = (x: number, digits = 1) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(digits)}`;
const percent = (x: number) => `${Math.round(x * 100)}%`;

const INPUTS: [name: string, shown: (w: Weather) => string, pulls: [group: string, name: string, low: number, high: number]][] = [
  ["wind", (w) => `${round(w.wind)} km/h ↗${round(w.gusts)}`, ["broth", "energy", 0, 1]],
  ["rain", (w) => `${w.precipitation.toFixed(1)} mm/h`, ["broth", "density", 0, 1]],
  ["barometer", (w) => `${round(w.pressure)} hPa ${w.fall > 0.5 ? "↓" : w.fall < -0.5 ? "↑" : "→"}${Math.abs(w.fall).toFixed(1)}`, ["broth", "tension", 0, 1]],
  ["air", (w) => `${w.temperature.toFixed(1)}°C ${signed(w.temperature - w.usual)}°`, ["broth", "warmth", 0, 1]],
  ["cloud", (w) => `${round(w.cloud)}%`, ["broth", "texture", 0, 1]],
  ["light", (w) => (w.day > 0.5 ? `${round(w.light)} W/m²` : `moon ${percent(w.moon)} ${w.moonUp ? "up" : "down"}`), ["broth", "valence", -1, 1]],
  ["sight", (w) => (w.visibility >= 10_000 ? `${round(w.visibility / 1000)} km` : `${(w.visibility / 1000).toFixed(1)} km`), ["air", "fog", 0, 1]],
  ["hour", () => hourThere(), ["broth", "strangeness", 0, 1]],
];

function hourThere() {
  const sky = currentSky();
  return sky ? new Intl.DateTimeFormat("en-GB", { timeZone: sky.timeZone, hour: "2-digit", minute: "2-digit" }).format(weatherNow()) : "";
}

function row(name: string, pulls?: string) {
  const el = document.createElement("div");
  el.className = "row";
  el.innerHTML = `<span class="in"></span><span class="said"></span>${pulls ? `<span class="to">→ ${pulls}</span><span class="value"></span><span class="bar"></span>` : ""}`;
  el.querySelector(".in")!.textContent = name;
  return el;
}

export function showInstruments() {
  const panel = $("listen-inputs");
  const head = document.createElement("div");
  head.className = "head";
  head.textContent = "inputs → broth";
  const rows = INPUTS.map(([name, , [, pulls]]) => row(name, pulls));
  const tide = row("tide", "palette");
  const moon = row("moon", "style");
  const map = row("map");
  const clock = row("clock");
  const source = document.createElement("div");
  source.className = "row source";
  panel.append(head, ...rows, document.createElement("hr"), tide, moon, map, clock, source);

  const set = (el: HTMLElement, said: string, value?: number, low = 0, high = 1) => {
    el.querySelector(".said")!.textContent = said;
    if (value === undefined) return;
    el.querySelector(".value")!.textContent = value.toFixed(2);
    (el.querySelector(".bar") as HTMLElement).style.setProperty("--v", String((value - low) / (high - low)));
  };

  const read = () => {
    const sky = currentSky();
    const w = sky?.weather;
    INPUTS.forEach(([, shown, [group, name, low, high]], i) => {
      const value = group === "air" ? getAir().fog : (readSignal(group, name) as number);
      set(rows[i], w ? shown(w) : "…", value, low, high);
    });
    const { day, season } = tidesNow();
    const water = day < 0.08 || day > 0.92 ? "high water" : Math.abs(day - 0.5) < 0.08 ? "low water" : day < 0.5 ? "falling" : "rising";
    set(tide, water, day);
    set(moon, season < 0.03 || season > 0.97 ? "new" : Math.abs(season - 0.5) < 0.03 ? "full" : season < 0.5 ? "waxing" : "waning", season);
    map.querySelector(".said")!.textContent = nearestRegions(getMapPosition(), 2)
      .map(({ region, share }) => `${region.id} ${share.toFixed(2)}`)
      .join(" · ");
    clock.querySelector(".said")!.textContent = `${readSignal("broth", "scale") ?? ""} · ${getCps().toFixed(3)} cps · cycle ${currentCycle().toFixed(2)}`;
    if (sky && !source.childElementCount) {
      source.innerHTML = `<span class="in">from</span><span class="said"><a target="_blank" rel="noopener"></a> <span class="where"></span></span>`;
      const link = source.querySelector("a")!;
      link.href = sky.credit.url;
      link.textContent = sky.credit.name.toLowerCase();
    }
    if (sky) {
      const lat = `${Math.abs(sky.latitude).toFixed(2)}°${sky.latitude >= 0 ? "N" : "S"}`;
      const lon = `${Math.abs(sky.longitude).toFixed(2)}°${sky.longitude >= 0 ? "E" : "W"}`;
      source.querySelector(".where")!.textContent = `· ${lat} ${lon}${w ? ` · WMO ${w.code}` : ""}`;
    }
    showStats();
    followCode();
    setTimeout(read, straining() ? STRAINED_READ_MS : READ_MS);
  };
  read();
  setInterval(() => straining() || showValues(), VALUES_MS);
}

export function setListening(n: number) {
  places = n;
  showStats();
}

export function setOnAir(epoch: number) {
  since = epoch;
}

export function addCourse(course: Course) {
  courses.set(course.id, course);
  for (const id of courses.keys()) if (courses.size > 4) courses.delete(id);
}

function showStats() {
  const parts = [];
  if (places !== undefined) parts.push(`${places} listening`);
  if (since !== undefined) {
    const s = Math.max(0, Math.floor((serverNow() - since) / 1000));
    const two = (n: number) => String(n).padStart(2, "0");
    const days = Math.floor(s / 86_400);
    parts.push(`on air ${days ? `${days}d ` : ""}${two(Math.floor(s / 3600) % 24)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`);
  }
  $("listen-stats").textContent = parts.join(" · ");
}

function followCode() {
  const cycle = currentCycle();
  let playing: Course | undefined;
  for (const c of courses.values()) if (c.startedAtCycle <= cycle && (!playing || c.startedAtCycle > playing.startedAtCycle)) playing = c;
  if (!playing || playing.id === shownCourse) return;
  shownCourse = playing.id;
  const code = $("listen-code");
  const lines = playing.code.trim().split("\n");
  const html = lines.map(lineHtml).join("\n");
  code.innerHTML = `<div class="scroll">${html}\n\n${html}\n\n</div>`;
  if (!still) (code.firstElementChild as HTMLElement).style.animationDuration = `${lines.length * SECONDS_PER_LINE}s`;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SIGNAL = /\b(broth|genre|form|palette|style|macro)\.([a-zA-Z]+)\b/g;

function lineHtml(line: string) {
  const at = line.indexOf("//");
  const [code, comment] = at >= 0 ? [line.slice(0, at), line.slice(at)] : [line, ""];
  const lit = escape(code).replace(SIGNAL, (all, group, name) => `<b>${all}</b><i data-g="${group}" data-n="${name}"></i>`);
  return lit + (comment ? `<span class="cm">${escape(comment)}</span>` : "");
}

function showValues() {
  const cycle = currentCycle();
  for (const el of $("listen-code").querySelectorAll<HTMLElement>("i[data-g]")) {
    const value = readSignal(el.dataset.g!, el.dataset.n!, cycle);
    el.textContent = value === undefined ? "" : typeof value === "number" ? `‹${value.toFixed(2)}›` : `‹${value}›`;
  }
}
