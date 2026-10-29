import type { TempoSegment } from "./clock";
import type { Section } from "./form";
import type { MapPosition } from "./map";
import { modeKnobAt } from "./presets";

export type Broth = {
  valence: number;
  energy: number;
  density: number;
  tension: number;
  warmth: number;
  texture: number;
  strangeness: number;
  voices: number;
};

export type BrothKey = keyof Broth;

export const MAX_VOICES = 6;

export const RESTING_BROTH: Broth = {
  valence: 0,
  energy: 0.25,
  density: 0.15,
  tension: 0.15,
  warmth: 0.6,
  texture: 0.4,
  strangeness: 0.2,
  voices: 0,
};

export const BROTH_RANGES: Record<BrothKey, [min: number, max: number]> = {
  valence: [-1, 1],
  energy: [0, 1],
  density: [0, 1],
  tension: [0, 1],
  warmth: [0, 1],
  texture: [0, 1],
  strangeness: [0, 1],
  voices: [0, MAX_VOICES],
};
export const BROTH_KEYS = Object.keys(BROTH_RANGES) as BrothKey[];

export type Ingredient = {
  id: string;
  name: string;
  weight: number;
  addedBy: string[];
  addedAt: number;
  updatedAt: number;
  musicalHint?: string;
};

export const INGREDIENT_HALF_LIFE_MS = 20 * 60_000;
export const INGREDIENT_GONE_BELOW = 0.05;
export const ingredientWeightAt = (ing: Ingredient, at: number) =>
  ing.weight * 2 ** (-(at - ing.updatedAt) / INGREDIENT_HALF_LIFE_MS);

export const MODES = ["phrygian", "aeolian", "dorian", "mixolydian", "major"];
export function modeFor(valence: number, weights: Partial<Record<string, number>> = {}, parent?: string) {
  const knob = modeKnobAt(weights, parent);
  if (knob && "dark" in knob) return MODES[valence < knob.below ? knob.dark : knob.light];
  const highest = knob?.highest ?? MODES.length - 1;
  return MODES[Math.min(highest, Math.max(knob?.lowest ?? 0, Math.floor(((valence + 1) / 2) * MODES.length)))];
}
export const scaleFor = (key: string, valence: number, weights: Partial<Record<string, number>> = {}, parent?: string) =>
  `${key}:${modeFor(valence, weights, parent)}`;

export const KEYS = ["C", "D", "E", "F", "G", "A", "Bb"] as const;

export const NOTE_RANGE: [number, number] = [24, 108];
export function foldNote(midi: number) {
  if (!Number.isFinite(midi)) return midi;
  while (midi < NOTE_RANGE[0]) midi += 12;
  while (midi > NOTE_RANGE[1]) midi -= 12;
  return midi;
}
export function foldValue<V>(value: V, toMidi: (note: string) => number): V {
  const note = (value as { note?: unknown } | null)?.note;
  if (note === undefined) return value;
  const midi = typeof note === "number" ? note : toMidi(String(note));
  const folded = foldNote(midi);
  return folded === midi ? value : { ...value, note: folded };
}

export type Course = {
  id: string;
  code: string;
  startedAtCycle: number;
  note: string;
  key?: string;
};

export type PotMap = {
  position: MapPosition;
  region: string;
  towards: string;
  share: number;
};

export type RecipeEntry = {
  id: string;
  at: number;
  note: string;
  code: string;
  key: string;
  broth: Broth;
  cps: number;
};

export type PotState = {
  pot: string;
  name: string;
  talk: boolean;
  stone?: string;
  epoch: number;
  tempo: TempoSegment[];
  key: string;
  broth: Broth;
  ingredients: Ingredient[];
  course: Course;
  map: PotMap;
  form: Section[];
  timeShift: number;
  upcoming?: Course;
  recipe: RecipeEntry[];
};
