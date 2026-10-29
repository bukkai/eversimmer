import { GENRE_FILES } from "./genres/index";
import { clamp } from "./numbers";
import type { Broth } from "./types";

export type MapPosition = {
  energy: number;
  texture: number;
  colour: number;
  strangeness: number;
};

export type MapAxis = keyof MapPosition;
export const AXES: MapAxis[] = ["energy", "texture", "colour", "strangeness"];

export type Region = {
  id: string;
  name: string;
  at: MapPosition;
  bpm: number;
  character: string;
  synth: string;
  arc: number;
  rush: number;
  seams: { gap: number; mix: number; drop: number };
  minutes: [min: number, max: number];
  breathes?: true;
};

export const REGIONS: Region[] = GENRE_FILES.map((g) => g.region);

export function mapTarget(b: Broth): MapPosition {
  return {
    energy: clamp(0.6 * b.energy + 0.4 * b.density),
    texture: clamp(0.8 * b.texture + 0.2 * (1 - b.warmth)),
    colour: clamp((b.valence + 1) / 2 - 0.3 * b.tension),
    strangeness: clamp(b.strangeness),
  };
}

export function brothFor(region: Region): Omit<Broth, "voices"> {
  const { energy, texture, colour, strangeness } = region.at;
  const warmth = 0.6;
  const tension = 0.15;
  return {
    energy,
    density: energy,
    texture: clamp((texture - 0.2 * (1 - warmth)) / 0.8),
    warmth,
    tension,
    valence: clamp(2 * (colour + 0.3 * tension) - 1, -1),
    strangeness,
  };
}

export function seasonLean(season: number): MapPosition {
  const wave = (shift: number, size: number) => size * Math.sin(2 * Math.PI * (season + shift));
  return { energy: wave(0, 0.05), texture: wave(0.25, 0.1), colour: wave(0.5, 0.1), strangeness: wave(0.75, 0.08) };
}

const distance = (a: MapPosition, b: MapPosition) => Math.hypot(...AXES.map((k) => a[k] - b[k]));

const REACH = 0.15;

let weighed: { at: MapPosition; weights: Record<string, number> } | undefined;
export function weightsAt(at: MapPosition) {
  if (weighed?.at !== at) weighed = { at, weights: regionWeights(at) };
  return weighed.weights;
}

export function regionWeights(at: MapPosition): Record<string, number> {
  const d2 = REGIONS.map((r) => distance(at, r.at) ** 2);
  const nearest = Math.min(...d2);
  const k = d2.map((d) => Math.exp(-(d - nearest) / REACH ** 2));
  const total = k.reduce((a, b) => a + b, 0);
  return Object.fromEntries(REGIONS.map((r, i) => [r.id, k[i] / total]));
}

export const breathingAt = (at: MapPosition) => REGIONS.reduce((x, r) => (r.breathes ? x + weightsAt(at)[r.id] : x), 0);

export function nearestRegions(at: MapPosition, count = 2) {
  const near = REGIONS.map((region) => ({ region, distance: distance(at, region.at) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
  const weights = near.map((n) => 1 / Math.max(n.distance, 0.01));
  const total = weights.reduce((a, b) => a + b, 0);
  return near.map((n, i) => ({ region: n.region, share: weights[i] / total }));
}

export const BEATS_PER_CYCLE = 4;
export const cpsFor = (region: Region) => region.bpm / 60 / BEATS_PER_CYCLE;
export const cpsAt = (at: MapPosition) => cpsFor(nearestRegions(at, 1)[0].region);

export const GENRE_NAMES = [...AXES, ...REGIONS.map((r) => r.id)];

export function genreSignals<P>(signal: (fn: () => number) => P, position: () => MapPosition) {
  return Object.fromEntries([
    ...AXES.map((k) => [k, signal(() => position()[k])]),
    ...REGIONS.map((r) => [r.id, signal(() => weightsAt(position())[r.id])]),
  ]) as Record<string, P>;
}
