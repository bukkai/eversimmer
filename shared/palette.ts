import { REGIONS } from "./map";
import { borrowLate, cross, crossedKnobs, mutationFor, RULES, settingOf, sourceOf, type ChoiceKnob } from "./presets";
import { seeded, weighted } from "./numbers";
import { describeLoop, describePsy, DRONE_WORDS, DRONES, figuresAt, loopAt, psyAt } from "./song";

export const DAY_TIDE_MS = 20 * 60 * 60_000;
export const SEASON_MS = 19 * 24 * 60 * 60_000;

export type Tides = { day: number; season: number };

export type Lean = { bright?: number; tempo?: number; swing?: number };

export const tidesAt = (ms: number): Tides => ({ day: (ms / DAY_TIDE_MS) % 1, season: (ms / SEASON_MS) % 1 });

export type Palette = {
  keys: number;
  role: number;
  voicing: number;
  octave: number;
  prog: number;
  loop: number;
  bells: number;
  motif: number;
  fifths: number;
  tempo: number;
  groove: number;
  swing: number;
  kit: number;
  drums: number;
  phrase: number;
  figure: number;
  wow: number;
  bright: number;
  bassTone: number;
  motifSound: number;
  vinyl: number;
  drone: number;
  psy: number;
  pulse: number;
  backbeat: number;
  perc: number;
  bassRoll: number;
  lead: number;
  chords: number;
  pad: number;
  parent?: string;
  neighbour?: string;
  borrowed?: ChoiceKnob[];
  block?: number;
  mutated?: ChoiceKnob;
};

export const KEY_SOUNDS = [
  "electric piano", "piano", "organ", "vibraphone", "nylon guitar", "moody square in half time", "strings holding the chords with a ninth",
  "a dub chord stab drowned in delay",
];
export const MOODY = settingOf("keys", "moody");
export const DRIFT = settingOf("keys", "drift");
export const DUB = settingOf("keys", "dub");
export const KEY_ROLES = ["comping", "arpeggios", "held chords", "resting", "house stabs in 3-3-2"];
export const VOICINGS = ["close sevenths", "drop voicing", "open with a ninth", "rootless", "shell", "six-nine", "in fourths"];
export const BELLS = ["scattered harp notes", "a Rhodes motif", "a guitar motif", "no bells"];
export const GROOVES = ["laid-back", "boom-bap", "skipping", "broken"];
export const SWINGS = [0.08, 1 / 6, 0.28];
export const SWING_WORDS = ["nearly straight", "a light swing", "a heavy swing"];
export const KITS = ["dusty", "deep", "tight"];
const DUSTY = { clap: "cp:0", open: "808oh" };
const TR909 = (x: string) => `RolandTR909_${x}`;
const TR606 = (x: string) => `RolandTR606_${x}`;
export const DRUMKITS = [
  { name: "a dusty 909", kick: "bd:3", snare: "sd:1", hat: "hh:0", ...DUSTY, levels: [1, 1, 1] },
  { name: "a short 909", kick: "bd:1", snare: "sn:0", hat: "hh27:0", ...DUSTY, levels: [1, 1, 1.15] },
  { name: "brushes", kick: "gretsch:13", snare: "gretsch:2", hat: "gretsch:4", ...DUSTY, levels: [2.3, 1.85, 0.6] },
  { name: "a slack snare", kick: "gretsch:13", snare: "gretsch:23", hat: "hh:0", ...DUSTY, levels: [2.3, 1.85, 1] },
  { name: "a jazz kit", kick: "jazz:0", snare: "jazz:7", hat: "jazz:3", ...DUSTY, levels: [0.8, 1.33, 0.2] },
  { name: "a crisp kit", kick: "feel:0", snare: "feel:3", hat: "feel:1", ...DUSTY, levels: [1.17, 1.25, 0.11] },
  { name: "a Linn", kick: "kicklinn:0", snare: "sn:14", hat: "linnhats:0", ...DUSTY, levels: [1.33, 0.95, 0.22] },
  { name: "a rimshot", kick: "bd:4", snare: "rm:0", hat: "hh:0", ...DUSTY, levels: [1, 0.86, 1] },
  { name: "the 909 machine", kick: TR909("bd"), snare: TR909("sd"), hat: TR909("hh"), clap: TR909("cp"), open: TR909("oh"), levels: [1, 1, 1] },
  { name: "the 606 machine", kick: TR606("bd"), snare: TR606("sd"), hat: TR606("hh"), clap: DUSTY.clap, open: TR606("oh"), levels: [1, 1, 1] },
];
export const TR909_KIT = settingOf("drums", "tr909");
export const TR606_KIT = settingOf("drums", "tr606");
export const BASS_TONES = ["a round sine bass", "a warm triangle bass", "a plucked bass"];
export const MOTIF_SOUNDS = ["the bells' instrument", "a flute", "a muted guitar"];
const TEMPO_SPREAD = 0.06;
const TEMPO_JOINED = 0.02;

const CIRCLE = ["Gb", "Db", "Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B"];
const SEMITONES: Record<string, number> = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
export function trackKey(key: string, fifths: number) {
  const i = CIRCLE.indexOf(key);
  if (i < 0 || fifths === 0) return key;
  const name = CIRCLE[(((i + fifths) % 12) + 12) % 12];
  const up = (SEMITONES[name] - SEMITONES[key] + 12) % 12;
  const octave = 3 + Math.floor((SEMITONES[key] + (up > 4 ? up - 12 : up)) / 12);
  return `${name}${octave}`;
}

export const PROGRESSIONS: number[][] = [
  [0, -4, -1, -5, -2, 1, -3, -3, -2, -1, 0, 0, -4, -3, -2, -1],
  [0, 0, -2, -2, -4, -4, -3, -3, 0, 0, -2, -2, -4, -4, -3, -1],
  [0, -1, -2, -3, -4, -5, -3, -3, 0, -1, -2, -3, -4, -3, -2, -1],
  [0, 0, 3, 3, 0, 0, -3, -3, -2, -2, 3, 3, -4, -4, -3, -1],
];
export const OWN_LOOP = PROGRESSIONS.length;

export const DEFAULT_PALETTE: Palette = {
  keys: 0, role: 0, voicing: 0, octave: 0, prog: 0, loop: 0, bells: 0, motif: 0, fifths: 0, tempo: 1, groove: 0, swing: 1, kit: 0,
  drums: 0, phrase: 0, figure: 0, wow: 0.5, bright: 0.5, bassTone: 0, motifSound: 0, vinyl: 0.5, drone: -1, psy: 0,
  pulse: 0, backbeat: 0, perc: 0, bassRoll: 0, lead: 0, chords: 0, pad: 0,
};

export const LINE_REST = -99;
const RHYTHMS = [
  [1, 0, 0, 1, 0, 1, 0, 0], [1, 0, 1, 1, 0, 0, 1, 0], [0, 0, 1, 0, 1, 0, 1, 1], [1, 0, 0, 0, 1, 1, 0, 0],
  [0, 1, 1, 0, 0, 1, 0, 0], [1, 1, 0, 1, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 1, 0], [0, 0, 0, 1, 1, 0, 1, 0],
];
const BREATHS = [
  [1, 0, 0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0, 0], [1, 0, 0, 1, 0, 0, 0, 0], [0, 0, 0, 0, 1, 0, 0, 0],
];
const lines = new Map<string, number[]>();

function writeLine(phrase: number) {
  const random = seeded(phrase);
  const pick = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)];
  const contour = pick(["level", "level", "arch", "fall"]);
  let at = contour === "fall" ? pick([4, 7, 7]) : pick([0, 2, 4, 4, 7]);
  let barNo = 0;
  const up = () => (contour === "arch" ? (barNo < 4 ? 0.65 : 0.35) : contour === "fall" ? 0.38 : 0.5);
  const walk = () => {
    const leap = random() < 0.2;
    at += (random() < up() ? 1 : -1) * (leap ? 2 + Math.floor(random() * 2) : 1);
    if (at > 9) at -= 2;
    if (at < -2) at += 2;
    return at;
  };
  const bar = (rhythm: number[], lands?: number[]) => {
    const notes = rhythm.map((x) => (x ? walk() : LINE_REST));
    const last = notes.reduce((l, x, i) => (x === LINE_REST ? l : i), -1);
    if (lands && last >= 0) {
      const from = notes.slice(0, last).reduce((p, x) => (x === LINE_REST ? p : x), notes[last]);
      at = notes[last] = lands.reduce((a, b) => (Math.abs(b - from) < Math.abs(a - from) ? b : a));
    }
    return notes;
  };
  const silent = Array<number>(8).fill(LINE_REST);
  barNo = 0;
  const first = bar(pick(RHYTHMS));
  const turn = at;
  barNo = 1;
  const second = bar(pick(BREATHS), [2, 4, 6]);
  const breath = at;
  at = turn;
  barNo = 3;
  const other = bar(pick(RHYTHMS), [0, 2, 4, 7]);
  at = breath;
  barNo = 5;
  const answerA = bar(pick(RHYTHMS));
  barNo = 6;
  const answerB = bar(pick(RHYTHMS), [2, 4]);
  barNo = 7;
  const home = bar(pick(BREATHS), [0, 7]);
  return pick([
    [first, second, first, other, first, second, answerA, home],
    [first, second, first, other, answerA, answerB, answerA, home],
    [first, silent, first, other, answerA, answerB, silent, home],
  ]).flat();
}

const LINE_TURNS = ["as written", "thinned", "filled", "moved", "pushed", "breathing"];
function turnLine(line: number[], turn: number) {
  const played = line.map((x) => x !== LINE_REST);
  switch (LINE_TURNS[turn]) {
    case "thinned":
      return line.map((x, i) => (i % 2 === 0 || !played.slice(i + 1, i + 8 - (i % 8)).some(Boolean) ? x : LINE_REST));
    case "filled":
      return line.map((x, i) => {
        const a = line[i - 1], b = line[i + 1];
        return x === LINE_REST && a !== undefined && b !== undefined && a !== LINE_REST && b !== LINE_REST && Math.abs(a - b) === 2
          ? (a + b) / 2
          : x;
      });
    case "moved": {
      const top = Math.max(...line.slice(32));
      return line.map((x, i) => (i >= 32 && x !== LINE_REST ? x + (top > 4 ? -7 : 7) : x));
    }
    case "pushed":
      return line.map((_, i) => line[(i + 56) % 64]);
    case "breathing":
      return line.map((x, i) => (Math.floor(i / 8) % 4 < 2 ? x : LINE_REST));
    default:
      return line;
  }
}
const lineTurn = (phrase: number, block: number) => {
  if (block < 2) return 0;
  const random = seeded(phrase * 31 + block * 7919 + 3);
  return random() < 0.45 ? 0 : 1 + Math.floor(random() * (LINE_TURNS.length - 1));
};

function bellLine(line: number[]) {
  return line.map((_, i) => {
    const bar = Math.floor(i / 8), step = i % 8;
    const notes = line.slice(bar * 8, bar * 8 + 8);
    if (notes.filter((x) => x !== LINE_REST).length <= 2) {
      const before = line[((bar + 7) % 8) * 8 + step];
      return before === LINE_REST ? LINE_REST : before + 2;
    }
    const last = notes.reduce((l, x, j) => (x === LINE_REST ? l : j), -1);
    return step === last ? notes[last] : LINE_REST;
  });
}

export function lineAt(phrase: number, t: number, block = 0, bells = false) {
  const key = `${phrase}:${lineTurn(phrase, block)}:${bells}`;
  let line = lines.get(key);
  if (!line) {
    if (lines.size > 64) lines.clear();
    let written = lines.get(`${phrase}`);
    if (!written) lines.set(`${phrase}`, (written = writeLine(phrase)));
    const turned = turnLine(written, lineTurn(phrase, block));
    lines.set(key, (line = bells ? bellLine(turned) : turned));
  }
  const step = Math.floor((((t % 8) + 8) % 8) * 8);
  return line[Math.min(63, step)];
}

const cosine = (phase: number, peak: number) => (1 + Math.cos(2 * Math.PI * (phase - peak))) / 2;

const settled = (weights: number[], random: () => number) =>
  weights.filter((w) => w > 0).length === 1 ? weights.findIndex((w) => w > 0) : weighted(weights, random);

export function choosePalette(
  { day, season }: Tides, previous: Palette | undefined, weights: Partial<Record<string, number>> = {}, random = Math.random, joined = false,
  lean: Lean = {},
): Palette {
  const crossing = cross(weights, random);
  const knobs = crossedKnobs(crossing, weights);
  const again = (key: keyof Palette, i: number, factor: number) => (previous && previous[key] === i ? factor : 1);
  const bright = Math.min(1, Math.max(0, cosine(day, 0.25) + 0.6 * (lean.bright ?? 0)));
  const busy = cosine(day, 0.5);
  const still = cosine(day, 0);

  const keys = weighted(
    KEY_SOUNDS.map((_, i) => (0.3 + cosine(day, i / 5)) * knobs.keys[i] * again("keys", i, 0.25)),
    random,
  );
  const roles = [1, 0.3 + 0.7 * busy, 0.3 + 0.7 * still, (0.12 + 0.2 * still) * again("role", 3, 0.1), 1].map(
    (w, i) => w * knobs.role[i] * again("role", i, 0.6),
  );
  let role = weighted(roles, random);
  const voicing = weighted(VOICINGS.map((_, i) => again("voicing", i, 0.5)), random);
  const octave = weighted([0.2 + 0.5 * (1 - bright), 1, 0.2 + 0.5 * bright].map((w, i) => w * knobs.octave[i]), random) - 1;
  const prog = weighted(
    [
      ...PROGRESSIONS.map((_, i) => (0.3 + cosine(season, i / PROGRESSIONS.length)) * knobs.progression * again("prog", i, 0.5)),
      2.4 * knobs.ownLoop,
    ],
    random,
  );
  const bells = weighted(
    [1, (0.4 + 0.6 * busy) * (1 + Math.max(0, lean.bright ?? 0)), 0.4 + 0.6 * still, role === 3 ? 0 : (0.2 + 0.3 * (1 - busy)) * again("bells", 3, 0.2)].map(
      (w, i) => w * knobs.bells[i] * again("bells", i, 0.6),
    ),
    random,
  );
  const motif = Math.floor(random() * 4);
  const fifths =
    weighted(
      [1, 1.4, 1, 0.35].map((w, i) => w * again("fifths", i - 1, 0.35) * (joined && previous && Math.abs(i - 1 - previous.fifths) > 1 ? 0 : 1)),
      random,
    ) - 1;
  const spread = (x: number) => Math.min(1 + TEMPO_SPREAD, Math.max(1 - TEMPO_SPREAD, x));
  const free = spread(1 + TEMPO_SPREAD * (2 * random() - 1 + 0.6 * (lean.tempo ?? 0)));
  const tempo = joined && previous ? spread(previous.tempo + TEMPO_JOINED * (2 * random() - 1) - 0.3 * (previous.tempo - 1)) : free;
  const groove = weighted(GROOVES.map((_, i) => again("groove", i, 0.2)), random);
  const swing = weighted(knobs.swing.map((w, i) => w * Math.max(0.2, 1 + 0.6 * (i - 1) * (lean.swing ?? 0)) * again("swing", i, 0.5)), random);
  const kit = weighted(KITS.map((_, i) => again("kit", i, 0.4)), random);
  const drums = weighted(DRUMKITS.map((_, i) => knobs.drums[i] * again("drums", i, 0.15)), random);
  const wow = random();
  const brightness = random();
  const bassTone = weighted([1.2, 0.8, 0.8].map((w, i) => w * again("bassTone", i, 0.5)), random);
  const motifSound = weighted([1.6, 0.8, 0.8].map((w, i) => w * knobs.motifSound[i] * again("motifSound", i, 0.5)), random);
  const vinyl = random();
  const phrase = Math.floor(random() * 1e6);
  const loop = Math.floor(random() * 1e6);
  const figure = Math.floor(random() * 1e6);
  const drone = random() < knobs.drone ? weighted(DRONES.map((_, i) => knobs.droneShape[i] * again("drone", i, 0.4)), random) : -1;
  const psySeed = Math.floor(random() * 1e6);
  const chords = settled(knobs.chords.map((w, i) => w * RULES.chordsByDrone[drone >= 0 ? 1 : 0][i]), random);
  if (drone >= 0 && chords === 0) role = weighted(roles.map((w, i) => w * RULES.roleOverDrone[i]), random);
  const pulse = settled(knobs.pulse, random);
  const backbeat = settled(knobs.backbeat, random);
  const perc = settled(knobs.perc, random);
  const bassRoll = settled(knobs.bassRoll.map((w, i) => w * RULES.bassByPulse[pulse][i]), random);
  const lead = settled(knobs.lead, random);
  const own = seeded(figure * 11 + 7);
  const borrowed = [...crossing.borrowed, ...borrowLate(crossing, weights, own)];
  const padKnob = sourceOf({ ...crossing, borrowed }, "pad").pad;
  const pad = settled(padKnob.map((w, i) => w * RULES.padByChords[chords ? (drone >= 0 ? 2 : 1) : 0][i]), own);
  return {
    keys, role, voicing, octave, prog, loop, bells, motif, fifths, tempo, groove, swing, kit, drums, phrase, figure,
    wow, bright: brightness, bassTone, motifSound, vinyl, drone, psy: psySeed, pulse, backbeat, perc, bassRoll, lead, chords, pad,
    parent: crossing.parent, neighbour: crossing.neighbour, borrowed,
  };
}

const MUTABLE: ChoiceKnob[] = ["keys", "octave", "lead", "drone"];
const mutations = new Map<string, Partial<Palette>>();

export function mutate(p: Palette, block: number): Palette {
  if (block < 2 || p.parent === undefined) return p;
  const key = `${p.figure}:${p.parent}:${p.neighbour}:${p.borrowed?.join()}:${p.drone}:${p.keys}:${p.octave}:${p.lead}:${block}`;
  let change = mutations.get(key);
  if (!change) {
    if (mutations.size > 256) mutations.clear();
    mutations.set(key, (change = mutation(p, block)));
  }
  return change.mutated ? { ...p, ...change } : p;
}

function mutation(p: Palette, block: number): Partial<Palette> {
  const random = seeded(p.figure * 7 + block * 104729 + 1);
  if (random() >= mutationFor(p.parent)) return {};
  const crossing = { parent: p.parent!, neighbour: p.neighbour ?? "rest", borrowed: p.borrowed ?? [] };
  const others = (k: ChoiceKnob, now: number, shift = 0) => {
    const factors = sourceOf(crossing, k)[k === "drone" ? "droneShape" : (k as "keys" | "octave" | "lead")];
    return factors.map((w, i) => (i - shift === now ? 0 : w));
  };
  const options: [ChoiceKnob, number[], number][] = [
    ["keys", others("keys", p.keys), 0],
    ["octave", others("octave", p.octave, 1), -1],
    ["lead", others("lead", p.lead), 0],
    ["drone", p.drone >= 0 ? others("drone", p.drone) : [], 0],
  ];
  const open = options.filter(([k, w]) => MUTABLE.includes(k) && w.some((x) => x > 0));
  if (!open.length) return {};
  const [knob, weights, shift] = open[Math.floor(random() * open.length)];
  return { [knob]: weighted(weights, random) + shift, mutated: knob };
}

const KNOB_WORDS: Record<ChoiceKnob, string> = {
  keys: "the instrument", role: "what the keys play", octave: "the register", prog: "the progression", drone: "the drone",
  motif: "the bells", drums: "the kit", pulse: "the kick", backbeat: "the backbeat", perc: "the percussion",
  bassRoll: "the bass", lead: "the lead", chords: "the keys resting",
  pad: "the pad",
};
const regionName = (id: string) => REGIONS.find((r) => r.id === id)?.name ?? "rest";

export const describeCrossing = (p: Palette) =>
  p.parent === undefined ? "" :
  `parent ${regionName(p.parent)}` +
  (p.borrowed?.length ? `, from ${regionName(p.neighbour ?? "rest")}: ${p.borrowed.map((k) => KNOB_WORDS[k]).join(", ")}` : "") +
  (p.mutated ? `; this block moves ${KNOB_WORDS[p.mutated]}` : "");

const FIFTHS = ["Bb", "F", "C", "G", "D", "A", "E"];
export const homeKey = ({ season }: Tides) => FIFTHS[Math.floor(season * FIFTHS.length)];

const FIFTHS_WORDS = ["a fifth down", "in the pot's key", "a fifth up", "two fifths up"];

export const describePalette = (p: Palette) =>
  (p.parent === undefined ? "" : `${describeCrossing(p)}; `) +
  `${p.chords ? "the keys rest" : p.keys >= MOODY ? KEY_SOUNDS[p.keys] : `${KEY_SOUNDS[p.keys]} ${KEY_ROLES[p.role]}`}` +
  (p.role === 3 || p.chords || p.keys >= MOODY ? "" : `, ${VOICINGS[p.voicing]}${p.octave ? `, ${p.octave > 0 ? "an octave up" : "lower"}` : ""}`) +
  `, ${(p.drone ?? -1) >= 0 ? `a drone (${DRONE_WORDS[p.drone]})` : p.prog >= OWN_LOOP ? `its own loop (${describeLoop(p.loop ?? 0, p.parent, p.neighbour)})` : `progression ${p.prog + 1}`}, ${BELLS[p.bells]}` +
  `; ${FIFTHS_WORDS[p.fifths + 1]}, ${p.tempo >= 1 ? "+" : "-"}${Math.abs(Math.round((p.tempo - 1) * 100))}% tempo, ` +
  `a ${GROOVES[p.groove]} groove with ${SWING_WORDS[p.swing]} on ${DRUMKITS[p.drums ?? 0].name}, tuned ${KITS[p.kit]}` +
  `; ${BASS_TONES[p.bassTone ?? 0]}, a motif on ${MOTIF_SOUNDS[p.motifSound ?? 0]}` +
  `, wow ${Math.round((p.wow ?? 0.5) * 100)}%, bright ${Math.round((p.bright ?? 0.5) * 100)}%, vinyl ${Math.round((p.vinyl ?? 0.5) * 100)}%` +
  `; ${PULSE_WORDS[p.pulse ?? 0]}, ${BACKBEAT_WORDS[p.backbeat ?? 0]}${p.perc ? `, ${PERC_WORDS[p.perc]}` : ""}` +
  `, ${BASS_ROLL_WORDS[p.bassRoll ?? 0]}${LEAD_WORDS[p.lead ?? 0]}, ${PAD_WORDS[p.pad ?? 0]}` +
  `; psychill figures: ${describePsy(p.psy ?? 0, p.block, p.parent, p.neighbour)}`;
const PULSE_WORDS = ["a boom-bap kick", "a heavy boom-bap kick", "a sparse push kick", "a distant heartbeat", "no kick", "four on the floor"];
const BACKBEAT_WORDS = ["the snare on two and four", "the backbeat on three", "no backbeat", "a clap on two and four"];
const PERC_WORDS = ["", "shakers", "hand drums", "shakers and hand drums", "no percussion at all", "open hats on the offbeat", "clicks"];
const LEAD_WORDS = ["", ", a psychill lead", ", a glass phrase", ", an arpeggio whose filter opens over 32 bars"];
const BASS_ROLL_WORDS = ["the bass figure", "a rolling bass", "the bass figure in long, deep notes", "no bass", "a bass on the offbeats", "a bass rolling between the kicks"];
const PAD_WORDS = ["the pad", "the pad as a quiet bed", "no pad"];

export const PALETTE_NAMES = [
  ...Object.keys(DEFAULT_PALETTE), "root", "colour", "chordBars", "line", "bellLine", "comp", "arp", "ring", "kick", "low", "lowLate",
  "kickSound", "snareSound", "hatSound", "clapSound", "openSound", "kickLevel", "snareLevel", "hatLevel", "day", "season",
  "psyBass", "psyKick", "psyShaker", "psyHand", "psyTriplet", "psyLead", "psyGlide", "psyOpen", "psyVoice", "psyBeat",
  "psyKickSound", "psyKickLevel", "psyThreeSound", "psyThreeLevel", "psyHandSound",
];

export function paletteSignals<P>(
  signal: (fn: (t: number) => number) => P,
  at: (cycle: number) => Palette,
  tides: () => Tides,
) {
  const choice = (k: keyof Palette) => signal((t) => (at(Number(t))[k] as number) ?? 0);
  const chordAt = (t: number) => {
    const p = at(t);
    if ((p.drone ?? -1) >= 0)
      return { root: DRONES[p.drone][((Math.floor(t) % DRONES[p.drone].length) + DRONES[p.drone].length) % DRONES[p.drone].length] + psyAt(p.psy ?? 0, p.block ?? 0, t, p.parent, p.neighbour).shift, colour: 0 };
    if (p.prog >= OWN_LOOP) return loopAt(p.loop ?? 0, t, p.parent, p.neighbour);
    const bar = Math.floor(t);
    return { root: PROGRESSIONS[p.prog][((bar % 16) + 16) % 16], colour: 0 };
  };
  const chordBars = (bar: number) => {
    const mark = (b: number) => ((b % 2) + 2) % 2 === 0;
    const root = chordAt(bar).root;
    if (!mark(bar) && chordAt(bar - 1).root === root) return 0;
    let n = 1;
    while (!mark(bar + n) && chordAt(bar + n).root === root) n++;
    return n;
  };
  const figure = (k: "comp" | "arp" | "ring" | "kick" | "low" | "lowLate") =>
    signal((t) => {
      const p = at(Number(t));
      return figuresAt(p.figure ?? 0, p.groove, Number(t), p.parent, p.neighbour)[k];
    });
  return {
    ...Object.fromEntries((Object.keys(DEFAULT_PALETTE) as (keyof Palette)[]).map((k) => [k, choice(k)])),
    root: signal((t) => chordAt(Number(t)).root),
    colour: signal((t) => chordAt(Number(t)).colour),
    chordBars: signal((t) => chordBars(Math.floor(Number(t)))),
    comp: figure("comp"),
    kick: figure("kick"),
    low: figure("low"),
    lowLate: figure("lowLate"),
    arp: figure("arp"),
    ring: figure("ring"),
    ...Object.fromEntries(
      (["kick", "snare", "hat"] as const).flatMap((part, i) => [
        [`${part}Sound`, signal((t) => DRUMKITS[at(Number(t)).drums ?? 0][part] as unknown as number)],
        [`${part}Level`, signal((t) => DRUMKITS[at(Number(t)).drums ?? 0].levels[i])],
      ]),
    ),
    clapSound: signal((t) => DRUMKITS[at(Number(t)).drums ?? 0].clap as unknown as number),
    openSound: signal((t) => DRUMKITS[at(Number(t)).drums ?? 0].open as unknown as number),
    line: signal((t) => {
      const p = at(Number(t));
      return lineAt(p.phrase ?? 0, Number(t), p.block ?? 0);
    }),
    bellLine: signal((t) => {
      const p = at(Number(t));
      return lineAt(p.phrase ?? 0, Number(t), p.block ?? 0, true);
    }),
    ...Object.fromEntries(
      ([
        "bass", "kick", "shaker", "hand", "triplet", "lead", "glide", "open", "voice", "beat",
        "kickSound", "kickLevel", "threeSound", "threeLevel", "handSound",
      ] as const).map((k) => [
        `psy${k[0].toUpperCase()}${k.slice(1)}`,
        signal((t) => {
          const p = at(Number(t));
          return psyAt(p.psy ?? 0, p.block ?? 0, Number(t), p.parent, p.neighbour)[k];
        }),
      ]),
    ),
    day: signal(() => tides().day),
    season: signal(() => tides().season),
  } as Record<string, P>;
}

export const STYLES = ["tape", "melody", "gen"] as const;
export type Style = (typeof STYLES)[number];
export const STYLE_WORDS: Record<Style, string> = { tape: "tape", melody: "melody", gen: "generative" };

export function styleWeights({ day, season }: Tides): Record<Style, number> {
  const at = season + 0.08 * Math.sin(2 * Math.PI * day);
  const k = STYLES.map((_, i) => Math.exp(3 * Math.cos(2 * Math.PI * (at - i / STYLES.length))));
  const total = k.reduce((a, b) => a + b, 0);
  return Object.fromEntries(STYLES.map((s, i) => [s, k[i] / total])) as Record<Style, number>;
}

export function describeStyle(w: Record<Style, number>) {
  const [first, second] = [...STYLES].sort((a, b) => w[b] - w[a]);
  return w[second] > 0.2
    ? `${STYLE_WORDS[first]} ${Math.round(w[first] * 100)}%, ${STYLE_WORDS[second]} ${Math.round(w[second] * 100)}%`
    : `${STYLE_WORDS[first]}`;
}

export function styleSignals<P>(signal: (fn: () => number) => P, weights: () => Record<Style, number>) {
  return Object.fromEntries(STYLES.map((s) => [s, signal(() => weights()[s])])) as Record<Style, P>;
}
