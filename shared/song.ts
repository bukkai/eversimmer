import { seeded, weighted } from "./numbers";
import { writersFor, type FigureKnobs, type LoopKnobs, type PsyKnobs } from "./presets";

export const COLOURS = ["in the key", "a dominant seventh", "a minor seventh", "a major seventh"];
const QUALITIES = [[], [0, 4, 7, 10], [0, 3, 7, 10], [0, 4, 7, 11]];
const DIATONIC = 0, DOMINANT = 1, MINOR = 2;

type Chord = { root: number; colour: number; bars: number };
type Loop = { chords: Chord[]; bars: number; push: boolean };

const LOOPS: [number, number?][][] = [
  [[0], [3]], [[0], [1]], [[0], [4]], [[3], [0]], [[1], [4]], [[5], [3]],
  [[1], [4], [0]], [[3], [2], [5]], [[0], [5], [3]], [[3], [4], [0]],
  [[0], [5], [1], [4]], [[5], [3], [0], [4]], [[2], [5], [1], [4]], [[3], [4], [2], [5]],
  [[0], [5], [2], [6]], [[3], [2], [1], [0]], [[0], [2], [3], [3, MINOR]], [[0], [1, DOMINANT], [3], [3, MINOR]],
  [[0], [5]], [[0], [6]],
];
const BARS: Record<number, number[][]> = {
  2: [[1, 1], [2, 2], [3, 1], [4, 4], [8, 8], [16, 16]],
  3: [[1, 1, 2], [2, 1, 1], [2, 2, 4], [4, 4, 8], [8, 8, 16]],
  4: [[1, 1, 1, 1], [2, 2, 2, 2], [4, 4, 4, 4], [8, 8, 8, 8]],
};

function writeLoop(seed: number, knobs: LoopKnobs): Loop {
  const random = seeded(seed);
  const template = LOOPS[weighted(knobs.templates, random)];
  const bars = BARS[template.length][weighted(knobs.rhythm[template.length], random)];
  const chords = template.map(([degree, colour], i) => {
    const next = template[(i + 1) % template.length][0];
    const fourthUp = (next - degree + 7) % 7 === 3;
    if (colour === undefined)
      colour =
        degree === 4 && fourthUp && random() < knobs.dominantOnV ? DOMINANT
        : degree !== 0 && fourthUp && random() < knobs.secondary ? DOMINANT
        : degree === 3 && next === 0 && random() < knobs.borrowedIv ? MINOR
        : DIATONIC;
    return { root: degree > 2 ? degree - 7 : degree, colour, bars: bars[i] };
  });
  return { chords, bars: bars.reduce((a, b) => a + b, 0), push: random() < knobs.push };
}

const loops = new Map<string, Loop>();
const loopFor = (seed: number, parent?: string, neighbour?: string) => {
  const key = `${seed}:${parent}:${neighbour}`;
  let loop = loops.get(key);
  if (!loop) {
    if (loops.size > 64) loops.clear();
    loops.set(key, (loop = writeLoop(seed, writersFor(parent, neighbour).loop)));
  }
  return loop;
};

export function loopAt(seed: number, t: number, parent?: string, neighbour?: string) {
  const loop = loopFor(seed, parent, neighbour);
  const at = Math.floor(t + (loop.push ? 1 / 8 : 0));
  let bar = ((at % loop.bars) + loop.bars) % loop.bars;
  for (const c of loop.chords) {
    if (bar < c.bars) return c;
    bar -= c.bars;
  }
  return loop.chords[0];
}

export function describeLoop(seed: number, parent?: string, neighbour?: string) {
  const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];
  const loop = loopFor(seed, parent, neighbour);
  const chords = loop.chords.map((c) => NUMERALS[(c.root + 7) % 7] + (c.colour === DOMINANT ? "7" : c.colour === MINOR ? "m7" : c.colour ? "maj7" : ""));
  return `${chords.join("–")} over ${loop.bars} bars${loop.push ? ", pushed" : ""}`;
}

const MODE_STEPS: Record<string, number[]> = {
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};
const semitones = (steps: number[], degree: number) => steps[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7);

export function colourStep(x: number, root: number, colour: number, scale: string): number | string {
  const steps = MODE_STEPS[String(scale).split(":")[1] ?? ""];
  if (!colour || !steps || !Number.isInteger(x)) return x;
  const member = (((x - root) % 7) + 7) % 7;
  if (member % 2 || member === 0) return x;
  const want = QUALITIES[colour][member / 2];
  const has = (((semitones(steps, x) - semitones(steps, root)) % 12) + 12) % 12;
  const by = want - has;
  if (!by || Math.abs(by) > 2) return x;
  return `${x}${(by > 0 ? "#" : "b").repeat(Math.abs(by))}`;
}

const FIGURE_REST = -99;
type Figures = { comp: number[]; kick: number[]; low: number[]; lowLate: number[]; arp: number[]; ring: number };

function writeFigures(seed: number, groove: number, knobs: FigureKnobs): Figures {
  const random = seeded(seed);
  const between = ([lo, hi]: [number, number]) => lo + Math.floor(random() * (hi - lo + 1));
  const { at, extra } = knobs.kicks[groove] ?? knobs.kicks[0];

  const kickBar = () => {
    const bar = Array<number>(16).fill(0);
    bar[0] = 1;
    const spots = Object.keys(at).map(Number);
    for (let n = between(extra), tries = 0; n > 0 && tries < 20; tries++) {
      const p = spots[weighted(spots.map((s) => (bar[s] || bar[s - 1] || bar[s + 1] ? 0 : at[s])), random)];
      if (bar[p] || bar[p - 1] || bar[p + 1]) continue;
      bar[p] = 1;
      n--;
    }
    return bar;
  };
  const first = kickBar();
  let second = [...first];
  if (random() < 0.3) second = kickBar();
  else if (random() < 0.7) {
    const moved = first.map((k, i) => (k && i ? i : -1)).filter((i) => i > 0);
    const from = moved[Math.floor(random() * moved.length)];
    const to = from + (random() < 0.5 ? -1 : 1) * (random() < 0.5 ? 1 : 2);
    if (from !== undefined) {
      second[from] = 0;
      second[to > 0 && to < 16 && to !== 4 && to !== 12 && !second[to - 1] && !second[to + 1] ? to : from] = 1;
    }
  }
  const kick = [...first, ...second];

  const low = Array<number>(16).fill(FIGURE_REST);
  const lowLate = Array<number>(16).fill(FIGURE_REST);
  kick.forEach((k, i) => {
    if (!k) return;
    const step = i === 0 || i === 16 ? 0 : [0, 4, 7][weighted([5, 1.2, 0.8], random)];
    (i % 2 ? lowLate : low)[i >> 1] = step;
  });
  if (random() < 0.5 && low[15] === FIGURE_REST && lowLate[14] === FIGURE_REST) low[15] = random() < 0.5 ? -1 : 1;

  const { hits, late } = knobs.comps[groove] ?? knobs.comps[0];
  const compBar = (lean: boolean) => {
    const bar = Array<number>(8).fill(0);
    const weights = [1.4, 0.8, 1, 1, 1, 0.8, 1, 0.6].map((w, i) => w + (lean && i === 7 ? 1.5 : 0));
    for (let n = between(hits), tries = 0; n > 0 && tries < 20; tries++) {
      const p = weighted(weights.map((w, i) => (bar[i] || bar[i - 1] || bar[i + 1] ? 0.02 * w : w)), random);
      if (bar[p]) continue;
      bar[p] = random() < late && p < 7 ? 2 : 1;
      n--;
    }
    return bar;
  };
  const comp1 = compBar(false);
  const comp = [...comp1, ...(random() < 0.4 ? comp1 : compBar(true))];

  const tones = [0, 2, 4, 6, 7, 9].slice(0, between([4, 6]));
  const back = [...tones].reverse();
  const order = [
    tones,
    back,
    [...tones, ...back.slice(1, -1)],
    tones.slice(0, -2).flatMap((x, i) => [x, tones[i + 2]]),
  ][Math.floor(random() * 4)];
  const arpBar = (from: number) => {
    const bar = [...Array(8)].map((_, i) => order[(from + i) % order.length]);
    for (let n = between([0, 2]); n > 0; n--) bar[1 + Math.floor(random() * 7)] = FIGURE_REST;
    return bar;
  };
  const turn = random();
  const arp = [...arpBar(0), ...(turn < 0.35 ? arpBar(0) : turn < 0.65 ? arpBar(0).reverse() : arpBar(2))];
  const ring = random();
  return { comp, kick, low, lowLate, arp, ring };
}

const figures = new Map<string, Figures>();
const figuresFor = (seed: number, groove: number, parent?: string, neighbour?: string) => {
  const key = `${seed}:${groove}:${parent}:${neighbour}`;
  let f = figures.get(key);
  if (!f) {
    if (figures.size > 64) figures.clear();
    figures.set(key, (f = writeFigures(seed, groove, writersFor(parent, neighbour).figures)));
  }
  return f;
};

export function figuresAt(seed: number, groove: number, t: number, parent?: string, neighbour?: string) {
  const f = figuresFor(seed, groove, parent, neighbour);
  const two = (((t % 2) + 2) % 2);
  const eighth = Math.min(15, Math.floor(two * 8));
  return { comp: f.comp[eighth], kick: f.kick[Math.min(31, Math.floor(two * 16))], low: f.low[eighth], lowLate: f.lowLate[eighth], arp: f.arp[eighth], ring: f.ring };
}

export const DRONES: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, -2, -2, 0, 0, 0, 0, 0, 0, -1, -1],
  [0, 0, 0, 0, -4, -4, -4, -4, 0, 0, 0, 0, -2, -2, -1, -1],
  [...Array<number>(16).fill(0), ...Array<number>(8).fill(-2), ...Array<number>(8).fill(-1)],
  [...Array<number>(16).fill(0), ...Array<number>(16).fill(-4)],
];
export const DRONE_WORDS = [
  "one root throughout", "a step down to VII and back", "dipping to VI and VII", "moving to IV, VI and VII",
  "sixteen bars on the root, eight on VI, eight on VII", "sixteen bars on the root, sixteen on IV",
];
const ROLLS = ["a galloping bass", "a bass on the offbeats", "a syncopated bass"];
const VOICES = ["an acid line", "a gliding lead", "an acid line and a gliding lead"];
const PSY_KICKS = [{ s: "bd:3", level: 0.56 }, { s: "kicklinn:0", level: 0.745 }, { s: "gretsch:13", level: 1.288 }, { s: "jazz:0", level: 0.448 }];
const PSY_THREES = [{ s: "cp:0", level: 0.2, word: "a clap" }, { s: "rm:0", level: 0.172, word: "a rim" }, { s: "sd:1", level: 0.2, word: "a snare" }];
const PSY_HANDS = ["tabla", "tabla2", "perc", "east"];
export const TWISTS = ["no turn", "the root a step up", "the root down to VI", "the beat drops out", "the bass drops out", "the bass rolls another way", "the lead an octave up"];

type Psy = {
  bass: number[]; kick: number[]; shaker: number[]; hand: number[]; triplet: boolean;
  lead: number[]; glide: number[]; sweep: number; roll: number; voice: number;
  kickSound: number; three: number; hands: number; twist: number;
  lift: number;
};

const REST = FIGURE_REST;
const pickWith = (random: () => number) => <T>(xs: T[]) => xs[Math.floor(random() * xs.length)];

function writeBass(roll: number, random: () => number) {
  const pick = pickWith(random);
  const bass = Array.from({ length: 16 }, (_, i): number =>
    (roll === 0 ? i % 4 !== 0 : roll === 1 ? i % 4 === 2 || (i % 2 === 1 && random() < 0.25) : i % 4 !== 0 && random() < 0.55)
      ? 0 : REST);
  const ends = [13, 14, 15].filter((i) => bass[i] !== REST);
  if (ends.length && random() < 0.6) bass[pick(ends)] = pick([7, 4, 6]);
  return bass;
}

function writeKick(random: () => number) {
  const kick = Array<number>(32).fill(0);
  kick[0] = kick[16] = 1;
  for (let n = random() < 0.5 ? 2 : 1; n > 0; n--) kick[pickWith(random)([3, 6, 7, 10, 11, 14, 19, 22, 23, 26, 27, 30])] = 1;
  return kick;
}

const writeShaker = (knobs: PsyKnobs, random: () => number) => {
  const shake = weighted(knobs.shaker, random);
  return Array.from({ length: 16 }, (_, i) =>
    i % 4 === 2 ? 2 : shake === 0 ? (i % 2 === 0 ? 1 : 0) : shake === 1 ? 1 : [1, 0, 1, 1][i % 4]);
};

function writeHand(triplet: boolean, random: () => number) {
  const steps = triplet ? 12 : 16;
  const hand = Array<number>(steps).fill(0);
  for (let n = 3 + Math.floor(random() * 3), tries = 0; n > 0 && tries < 40; tries++) {
    const at = Math.floor(random() * steps);
    if (hand[at] || hand[(at + 1) % steps] || hand[(at + steps - 1) % steps] || at % (steps / 2) === 0) continue;
    hand[at] = 1 + Math.floor(random() * 16);
    n--;
  }
  return hand;
}

function writeLead(random: () => number) {
  const lead = Array<number>(16).fill(REST);
  const glide = Array<number>(16).fill(0);
  const quiet = Math.floor(random() * 4);
  for (let phrase = 0; phrase < 4; phrase++) {
    if (phrase === quiet) continue;
    const notes = random() < 0.4 ? 2 : 1;
    for (let k = 0; k < notes; k++) {
      const at = phrase * 4 + (k ? 2 + Math.floor(random() * 2) : Math.floor(random() * 2));
      lead[at] = [0, 2, 4, 4, 6, 7, 7, 8][Math.floor(random() * 8)];
      glide[at] = random() < 0.35 ? pickWith(random)([2, -2, 3]) : 0;
    }
  }
  return { lead, glide };
}

function writePsy(seed: number, knobs: PsyKnobs): Psy {
  const random = seeded(seed);
  const roll = weighted(knobs.roll, random);
  const bass = writeBass(roll, random);
  const kick = writeKick(random);
  const shaker = writeShaker(knobs, random);
  const triplet = random() < knobs.triplet;
  const hand = writeHand(triplet, random);
  const { lead, glide } = writeLead(random);
  const sweep = pickWith(random)(knobs.sweep);
  const voice = weighted(knobs.voice, random);
  const kickSound = Math.floor(random() * PSY_KICKS.length);
  const three = weighted(knobs.three, random);
  const hands = weighted(knobs.hands, random);
  return { bass, kick, shaker, hand, triplet, lead, glide, sweep, roll, voice, kickSound, three, hands, twist: 0, lift: knobs.voice[0] > 0 ? 2 : 1 };
}

function writeBlock(seed: number, block: number, knobs: PsyKnobs, parent?: string, neighbour?: string): Psy {
  const { change } = knobs;
  const base = baseFor(seed, parent, neighbour);
  if (block <= 0) return { ...base, hand: base.hand.map(() => 0) };
  const before = psyFor(seed, block - 1, parent, neighbour);
  const random = seeded(seed * 31 + block * 7919);
  const p: Psy = { ...before, twist: 0 };
  if (block === 1) p.hand = base.hand;
  else if (random() < change.hand) {
    p.triplet = random() < knobs.triplet;
    p.hand = random() < change.noHands ? Array<number>(16).fill(0) : writeHand(p.triplet, random);
  }
  if (random() < change.kick) p.kick = writeKick(random);
  if (random() < change.shaker) p.shaker = writeShaker(knobs, random);
  if (random() < change.bass) p.bass = writeBass(base.roll, random);
  if (block % 2 === 0) Object.assign(p, writeLead(random));
  if (block >= 2 && random() < change.twist) p.twist = 1 + Math.floor(random() * (TWISTS.length - 1));
  if (p.twist === 5) p.bass = writeBass((base.roll + 1 + Math.floor(random() * 2)) % 3, random);
  return p;
}

const bases = new Map<string, Psy>();
function baseFor(seed: number, parent?: string, neighbour?: string) {
  const key = `${seed}:${parent}:${neighbour}`;
  let p = bases.get(key);
  if (!p) {
    if (bases.size > 64) bases.clear();
    bases.set(key, (p = writePsy(seed, writersFor(parent, neighbour).psy)));
  }
  return p;
}
const psys = new Map<string, Psy>();
function psyFor(seed: number, block: number, parent?: string, neighbour?: string): Psy {
  const key = `${seed}:${block}:${parent}:${neighbour}`;
  let p = psys.get(key);
  if (!p) {
    if (psys.size > 512) psys.clear();
    psys.set(key, (p = writeBlock(seed, block, writersFor(parent, neighbour).psy, parent, neighbour)));
  }
  return p;
}

const slot = (t: number, bars: number, steps: number) => Math.min(steps - 1, Math.floor((((t % bars) + bars) % bars) / bars * steps + 1e-6));

export function psyAt(seed: number, block: number, t: number, parent?: string, neighbour?: string) {
  const p = psyFor(seed, Math.max(0, Math.min(64, block)), parent, neighbour);
  const half = slot(t, 8, 16);
  const hand = p.hand[slot(t, 1, p.hand.length)];
  const early = slot(t, 16, 2) === 0;
  const beat = p.twist === 3 && early ? 0 : 1;
  const lead = p.lead[half];
  return {
    bass: p.twist === 4 && early ? REST : p.bass[slot(t, 1, 16)],
    kick: beat * p.kick[slot(t, 2, 32)],
    shaker: beat * p.shaker[slot(t, 1, 16)],
    hand: p.triplet ? 0 : beat * hand,
    triplet: p.triplet ? beat * hand : 0,
    lead: p.twist === 6 && lead !== REST ? lead + 7 : lead,
    glide: p.glide[half],
    open: 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / p.sweep),
    voice: p.twist === 6 ? p.lift : p.voice,
    beat,
    shift: p.twist === 1 ? 1 : p.twist === 2 ? -2 : 0,
    kickSound: PSY_KICKS[p.kickSound].s as unknown as number,
    kickLevel: PSY_KICKS[p.kickSound].level,
    threeSound: PSY_THREES[p.three].s as unknown as number,
    threeLevel: PSY_THREES[p.three].level,
    handSound: PSY_HANDS[p.hands] as unknown as number,
  };
}

export function describePsy(seed: number, block?: number, parent?: string, neighbour?: string) {
  const p = baseFor(seed, parent, neighbour);
  const twist = block === undefined ? 0 : psyFor(seed, Math.max(0, Math.min(64, block)), parent, neighbour).twist;
  return `${ROLLS[p.roll]}, ${VOICES[p.voice]}, ${PSY_KICKS[p.kickSound].s.split(":")[0]} kick, ${PSY_THREES[p.three].word} on three, ` +
    `${PSY_HANDS[p.hands]}${p.triplet ? " in triplets" : ""}, a filter over ${p.sweep} bars${twist ? `; this block: ${TWISTS[twist]}` : ""}`;
}
