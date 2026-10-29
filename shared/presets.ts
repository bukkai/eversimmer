import { GENRE_FILES } from "./genres/index";
import type { Macro } from "./macros";

export const GENRES = GENRE_FILES.map((g) => g.region.id);
export type Genre = string;

export const SETTINGS = {
  keys: ["epiano", "piano", "organ", "vibraphone", "square", "moody", "drift", "dub"],
  role: ["comping", "arpeggios", "held", "resting", "houseStabs"],
  octave: ["lower", "middle", "higher"],
  swing: ["nearlyStraight", "light", "heavy"],
  droneShape: ["root", "toVII", "toVIandVII", "toIVVIandVII", "slowVIandVII", "slowIV"],
  bells: ["scattered", "glass", "musicBox", "none"],
  motifSound: ["bells", "flute", "pluck"],
  drums: ["dusty909", "short909", "brushes", "slackSnare", "jazz", "crisp", "linn", "rimshot", "tr909", "tr606"],
  pulse: ["boomBap", "heavyBoomBap", "push", "heartbeat", "none", "fourFloor"],
  backbeat: ["twoAndFour", "onThree", "none", "clap"],
  perc: ["none", "shakers", "hands", "both", "silent", "openHats", "clicks"],
  bassRoll: ["figure", "rolling", "long", "none", "offbeat", "roller"],
  lead: ["none", "psy", "glass", "arpeggio"],
  chords: ["play", "rest"],
  pad: ["full", "bed", "none"],
} as const;
export type SettingKnob = keyof typeof SETTINGS;
export type Setting<K extends SettingKnob> = (typeof SETTINGS)[K][number];
export const settingOf = <K extends SettingKnob>(knob: K, name: Setting<K>) => (SETTINGS[knob] as readonly string[]).indexOf(name);

export type Knobs = { [K in SettingKnob]: Partial<Record<Setting<K>, number>> } & {
  progression: number;
  ownLoop: number;
  drone: number;
};

export type PaletteKnobs = { [K in SettingKnob]: number[] } & Pick<Knobs, "progression" | "ownLoop" | "drone">;

export type LoopKnobs = {
  templates: number[];
  rhythm: Record<number, number[]>;
  dominantOnV: number;
  secondary: number;
  borrowedIv: number;
  push: number;
};

export type FigureKnobs = {
  kicks: { at: Record<number, number>; extra: [number, number] }[];
  comps: { hits: [number, number]; late: number }[];
};

export type PsyKnobs = {
  roll: number[];
  shaker: number[];
  triplet: number;
  sweep: number[];
  voice: number[];
  three: number[];
  hands: number[];
  change: { hand: number; noHands: number; kick: number; shaker: number; bass: number; twist: number };
};

export type ModeKnob = { lowest: number; highest?: number } | { dark: number; light: number; below: number };

export type Preset = {
  knobs: Partial<Knobs>;
  loop?: LoopKnobs;
  figures?: FigureKnobs;
  psy?: PsyKnobs;
  mode?: ModeKnob;
  mutation?: number;
  macros?: Partial<Record<Macro, number>>;
};

export const REST: Knobs = {
  keys: { epiano: 1, piano: 1, organ: 1, vibraphone: 1, square: 1 },
  role: { comping: 1, arpeggios: 1, held: 1, resting: 1 },
  octave: { lower: 1, middle: 1, higher: 1 },
  progression: 1,
  ownLoop: 0.1,
  swing: { nearlyStraight: 1, light: 1, heavy: 0.4 },
  drone: 0,
  droneShape: { root: 1, toVII: 1, toVIandVII: 1, toIVVIandVII: 1 },
  bells: { scattered: 1, glass: 1, musicBox: 1, none: 1 },
  motifSound: { bells: 1, flute: 1, pluck: 1 },
  drums: { dusty909: 1, short909: 1, brushes: 1, slackSnare: 1, jazz: 1, crisp: 1, linn: 1, rimshot: 1 },
  pulse: { boomBap: 1 },
  backbeat: { twoAndFour: 1 },
  perc: { none: 1 },
  bassRoll: { figure: 1 },
  lead: { none: 1 },
  chords: { play: 1 },
  pad: { full: 1 },
};

export const PRESETS = Object.fromEntries(GENRE_FILES.map((g) => [g.region.id, g.preset])) as Record<Genre, Preset>;

const presetOf = (parent?: string) => (parent === undefined ? undefined : (PRESETS as Partial<Record<string, Preset>>)[parent]);
export const writersFor = (parent?: string, neighbour?: string) => ({
  loop: presetOf(parent)?.loop ?? presetOf(neighbour)?.loop ?? PRESETS.lofi.loop!,
  figures: presetOf(parent)?.figures ?? presetOf(neighbour)?.figures ?? PRESETS.lofi.figures!,
  psy: presetOf(parent)?.psy ?? presetOf(neighbour)?.psy ?? PRESETS.psychill.psy!,
});

export const mutationFor = (parent?: string) => presetOf(parent)?.mutation ?? MUTATION;

const listOf = <K extends SettingKnob>(k: K, weights: Knobs[K]) =>
  SETTINGS[k].map((s) => (weights as Record<string, number>)[s] ?? 0);
const REST_LISTS = Object.fromEntries(
  Object.entries(REST).map(([k, v]) => [k, typeof v === "number" ? v : listOf(k as SettingKnob, v)]),
) as PaletteKnobs;
const LEANS = Object.fromEntries(
  GENRES.map((g) => [g, Object.fromEntries(
    Object.entries(PRESETS[g].knobs).map(([k, v]) => {
      const rest = REST_LISTS[k as keyof PaletteKnobs];
      if (typeof v === "number") return [k, v - (rest as number)];
      return [k, listOf(k as SettingKnob, v).map((x, i) => x - (rest as number[])[i])];
    }),
  ) as Partial<PaletteKnobs>]),
) as Record<Genre, Partial<PaletteKnobs>>;

export function knobsAt(weights: Partial<Record<string, number>>): PaletteKnobs {
  const at = <K extends keyof PaletteKnobs>(k: K, rest: number, i?: number) =>
    GENRES.reduce((x, g) => {
      const lean = LEANS[g][k];
      if (lean === undefined) return x;
      return x + (weights[g] ?? 0) * (i === undefined ? (lean as number) : (lean as number[])[i]);
    }, rest);
  return Object.fromEntries(
    (Object.keys(REST_LISTS) as (keyof PaletteKnobs)[]).map((k) => {
      const rest = REST_LISTS[k];
      return [k, typeof rest === "number" ? at(k, rest) : rest.map((r, i) => at(k, r, i))];
    }),
  ) as PaletteKnobs;
}

export const BORROW = 0.25;
export const MUTATION = 0.12;

export const CHOICE_KNOBS = [
  "keys", "role", "octave", "prog", "drone", "motif", "drums", "pulse", "backbeat", "perc", "bassRoll", "lead", "chords", "pad",
] as const;
export type ChoiceKnob = (typeof CHOICE_KNOBS)[number];
const FIELDS: Record<ChoiceKnob, (keyof PaletteKnobs)[]> = {
  keys: ["keys"], role: ["role"], octave: ["octave"], prog: ["progression", "ownLoop"], drone: ["drone", "droneShape"],
  motif: ["bells", "motifSound"], drums: ["drums"], pulse: ["pulse"], backbeat: ["backbeat"], perc: ["perc"],
  bassRoll: ["bassRoll"], lead: ["lead"], chords: ["chords"], pad: ["pad"],
};

export type Crossing = { parent: string; neighbour: string; borrowed: ChoiceKnob[] };

export const LATE_KNOBS: ChoiceKnob[] = ["pad"];

export const knobsFor = (region: string): PaletteKnobs => knobsAt({ [region]: 1 });
const same = (a: PaletteKnobs, b: PaletteKnobs, k: ChoiceKnob) => FIELDS[k].every((f) => JSON.stringify(a[f]) === JSON.stringify(b[f]));

export function cross(weights: Partial<Record<string, number>>, random: () => number): Crossing {
  const given = Object.entries(weights).filter((e): e is [string, number] => (e[1] ?? 0) > 0);
  const rest = 1 - given.reduce((a, [, w]) => a + w, 0);
  const candidates = rest > 1e-9 ? [...given, ["rest", rest] as [string, number]] : given;
  if (!candidates.length) return { parent: "rest", neighbour: "rest", borrowed: [] };
  let parent = candidates[0][0];
  if (candidates.length > 1) {
    const total = candidates.reduce((a, [, w]) => a + w, 0);
    let r = random() * total;
    parent = candidates.find(([, w]) => (r -= w) < 0)?.[0] ?? candidates[candidates.length - 1][0];
  }
  const others = candidates.filter(([id]) => id !== parent).sort((a, b) => b[1] - a[1]);
  const [neighbour, weight] = others[0] ?? ["rest", 0];
  const mine = knobsFor(parent), theirs = knobsFor(neighbour);
  const borrowed = weight > 0
    ? CHOICE_KNOBS.filter((k) => !LATE_KNOBS.includes(k) && !same(mine, theirs, k) && random() < BORROW * weight)
    : [];
  return { parent, neighbour, borrowed };
}

export function borrowLate(c: Crossing, weights: Partial<Record<string, number>>, random: () => number): ChoiceKnob[] {
  const given = Object.values(weights).reduce<number>((a, w) => a + Math.max(0, w ?? 0), 0);
  const weight = c.neighbour === "rest" ? (1 - given > 1e-9 ? 1 - given : 0) : weights[c.neighbour] ?? 0;
  const mine = knobsFor(c.parent), theirs = knobsFor(c.neighbour);
  return weight > 0 ? LATE_KNOBS.filter((k) => !same(mine, theirs, k) && random() < BORROW * weight) : [];
}

export function crossedKnobs(c: Crossing, weights: Partial<Record<string, number>>): PaletteKnobs {
  const knobs = { ...knobsFor(c.parent) };
  const theirs = knobsFor(c.neighbour);
  for (const k of c.borrowed) for (const f of FIELDS[k]) (knobs as Record<string, unknown>)[f] = theirs[f];
  return { ...knobs, swing: knobsAt(weights).swing };
}

export const sourceOf = (c: Crossing, k: ChoiceKnob) => knobsFor(c.borrowed.includes(k) ? c.neighbour : c.parent);

const factors = <K extends SettingKnob>(k: K, f: Partial<Record<Setting<K>, number>> = {}) =>
  SETTINGS[k].map((s) => (f as Record<string, number>)[s] ?? 1);
const thirds = (f: Partial<Record<Setting<"bassRoll">, 3 | 1>>) => factors("bassRoll", { figure: 1 / 3, rolling: 1 / 3, long: 1 / 3, offbeat: 1 / 3, roller: 1 / 3, ...f });
const BASS_BY_PULSE: Partial<Record<Setting<"pulse">, number[]>> = {
  boomBap: thirds({ figure: 3, long: 3 }),
  heavyBoomBap: thirds({ figure: 3, long: 3 }),
  push: thirds({ rolling: 3 }),
  fourFloor: thirds({ offbeat: 3, roller: 3 }),
};

export const RULES = {
  chordsByDrone: [factors("chords", { rest: 0.2 }), factors("chords")],
  padByChords: [factors("pad"), factors("pad", { none: 0.2 }), factors("pad")],
  roleOverDrone: factors("role", { comping: 0.25, arpeggios: 0.25, held: 1.5, resting: 1.5, houseStabs: 0.25 }),
  bassByPulse: SETTINGS.pulse.map((p) => BASS_BY_PULSE[p] ?? factors("bassRoll")),
};

export function modeKnobAt(weights: Partial<Record<string, number>>, parent?: string) {
  if (parent !== undefined) return presetOf(parent)?.mode;
  const ruling = GENRES.find((g) => (weights[g] ?? 0) > 0.5);
  return ruling === undefined ? undefined : PRESETS[ruling].mode;
}

const plays = (g: Genre, knob: SettingKnob, settings: readonly string[]) => {
  const weights = (PRESETS[g].knobs[knob] ?? REST[knob]) as Record<string, number>;
  return settings.some((s) => (weights[s] ?? 0) > 0);
};

export function shareAt(weights: Partial<Record<string, number>>, knob: SettingKnob, settings: readonly string[]) {
  if (!SETTINGS[knob]) throw new Error(`there is no knob ${knob}`);
  for (const s of settings)
    if (!(SETTINGS[knob] as readonly string[]).includes(s)) throw new Error(`${knob} has no setting ${s}`);
  return GENRES.reduce((x, g) => (plays(g, knob, settings) ? x + (weights[g] ?? 0) : x), 0);
}

export const macroAt = (weights: Partial<Record<string, number>>, name: Macro) =>
  GENRES.reduce((x, g) => {
    const value = PRESETS[g].macros?.[name];
    return value === undefined ? x : x + (weights[g] ?? 0) * value;
  }, 0);
