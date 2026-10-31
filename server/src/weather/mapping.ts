import type { Lean } from "../../../shared/palette";
import type { FoundIngredient } from "../pantry";
import type { MoodTargets } from "../source";
import type { Hour } from "./open-meteo";

export type Reading = Hour & {
  fall: number;
  hour: number;
  usual: number;
  moon: number;
};

export type Dimension = keyof MoodTargets;

function ramp(x: number, ...points: [number, number][]) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

const isFog = (r: Reading) => (r.code === 45 || r.code === 48 ? 1 : 0);
export const haze = (r: Reading) => Math.max(ramp(r.visibility, [300, 1], [1000, 0.7], [4000, 0.25], [10_000, 0]), 0.7 * isFog(r));
const smallHours = (r: Reading) => Math.max(ramp(r.hour, [0, 0.6], [3, 1], [6, 0]), ramp(r.hour, [22, 0], [24, 0.6]));
export const felt = (r: Reading) => Math.max(r.wind, r.gusts * 0.7);
const clearNight = (r: Reading) => (1 - r.day) * (1 - r.cloud / 100);
const moonlit = (r: Reading) => r.moon * clearNight(r);

export const PULL: Record<Dimension, (r: Reading) => number> = {
  energy: (r) => ramp(felt(r), [0, -0.4], [15, 0], [40, 0.6], [70, 1]),
  density: (r) => ramp(r.precipitation, [0, -0.2], [0.5, 0.1], [2, 0.6], [8, 1]),
  tension: (r) => ramp(r.fall, [-2, -0.3], [0, 0], [3, 0.5], [6, 1]),
  warmth: (r) =>
    0.6 * ramp(r.temperature, [-5, -1], [3, -0.4], [10, 0], [18, 0.5], [25, 1]) + 0.4 * ramp(r.temperature - r.usual, [-6, -1], [0, 0], [6, 1]),
  texture: (r) => ramp(r.cloud, [0, 0.3], [60, 0], [100, -0.4]) + 0.4 * clearNight(r) * (1 - 0.7 * r.moon),
  valence: (r) => ramp(r.light, [0, -0.2], [150, 0], [600, 0.5]) + 0.5 * moonlit(r),
  strangeness: (r) => Math.min(1, 0.7 * isFog(r) + 0.3 * smallHours(r)),
};

export const REACH: Record<Dimension, number> = {
  energy: 0.65,
  density: 0.7,
  tension: 0.5,
  warmth: 0.45,
  texture: 0.5,
  valence: 0.4,
  strangeness: 0.6,
};

export function lean(r: Reading): Lean {
  return {
    bright: moonlit(r),
    tempo: ramp(felt(r), [0, -0.6], [15, 0], [50, 1]),
    swing: ramp(r.temperature, [0, -0.5], [12, 0], [24, 0.8]),
  };
}

const DRIZZLE = "a faint, soft crackle up high, like drizzle on a window";
const RAIN = "a filtered patter of rain far in the background";
const SNOW = "hushed, muffled tops and a soft high shimmer";
const FOG = "a washed-out haze over the chords, the edges blurred";
const THUNDER = "a distant low rumble now and then, far below the parts";
const HAIL = "a sparse, brittle tick here and there";
const WIND = "a slow airy whoosh, filtered, rising and falling";

type Sky = [name: string, weight: number, hint: string][];
export const SKY: Record<number, Sky> = {
  45: [["fog", 0.5, FOG]],
  48: [["fog", 0.6, FOG]],
  51: [["drizzle", 0.3, DRIZZLE]],
  53: [["drizzle", 0.45, DRIZZLE]],
  55: [["drizzle", 0.6, DRIZZLE]],
  56: [["drizzle", 0.45, DRIZZLE]],
  57: [["drizzle", 0.6, DRIZZLE]],
  61: [["rain", 0.35, RAIN]],
  63: [["rain", 0.55, RAIN]],
  65: [["rain", 0.8, RAIN]],
  66: [["rain", 0.5, RAIN]],
  67: [["rain", 0.7, RAIN]],
  71: [["snow", 0.35, SNOW]],
  73: [["snow", 0.55, SNOW]],
  75: [["snow", 0.8, SNOW]],
  77: [["snow", 0.3, SNOW]],
  80: [["rain", 0.4, RAIN]],
  81: [["rain", 0.6, RAIN]],
  82: [["rain", 0.85, RAIN]],
  85: [["snow", 0.5, SNOW]],
  86: [["snow", 0.75, SNOW]],
  95: [["thunder", 0.7, THUNDER], ["rain", 0.55, RAIN]],
  96: [["thunder", 0.8, THUNDER], ["rain", 0.6, RAIN], ["hail", 0.4, HAIL]],
  99: [["thunder", 0.8, THUNDER], ["rain", 0.6, RAIN], ["hail", 0.6, HAIL]],
};

export function ingredients(r: Reading, by: string): FoundIngredient[] {
  const found = (SKY[r.code] ?? []).map(([name, weight, musicalHint]) => ({ name, weight, addedBy: [by], musicalHint }));
  const wind = ramp(felt(r), [40, 0], [45, 0.3], [80, 0.8]);
  if (wind > 0) found.push({ name: "wind", weight: wind, addedBy: [by], musicalHint: WIND });
  return found;
}

export function describe(code: number) {
  if (code === 0) return "clear";
  if (code <= 2) return "partly cloudy";
  if (code === 3) return "overcast";
  return SKY[code]?.map(([name]) => name).filter((name) => code < 95 || name !== "rain").join(" and ") ?? `code ${code}`;
}

const SAID: Record<number, string> = {
  0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 48: "freezing fog",
  51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 56: "freezing drizzle", 57: "freezing drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
  80: "light showers", 81: "showers", 82: "heavy showers", 85: "snow showers", 86: "heavy snow showers",
  95: "a thunderstorm", 96: "a thunderstorm with hail", 99: "a thunderstorm with hail",
};

export function conditions(r: Reading) {
  const wind = ramp(felt(r), [0, 0], [12, 1], [30, 2], [50, 3], [75, 4]);
  const said = [SAID[r.code] ?? describe(r.code), ["", "a breeze", "windy", "a gale", "a storm"][Math.floor(wind)]];
  return said.filter(Boolean).join(", ");
}
