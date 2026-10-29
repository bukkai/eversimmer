import { HELPER_NAMES } from "../../shared/helpers";
import { SCORE_FUNCTIONS, SCORE_METHODS, SCORE_NAMES } from "../../shared/score";
import { INSTRUMENTS } from "../../shared/sounds";

export const SYNTHS = ["sine", "triangle", "square", "sawtooth", "supersaw", "white", "pink", "brown", "crackle"];

export const SAMPLES = [
  "bd", "sd", "sn", "hh", "hh27", "ho", "cp", "realclaps", "rm", "rs", "cr", "cb",
  "lt", "mt", "ht", "perc", "tabla", "tabla2", "hand", "click", "tink", "glasstap", "bottle",
  "pebbles", "bubble", "can", "linnhats", "gretsch", "kicklinn", "jazz", "feel", "flick",
  "808bd", "808sd", "808hc", "808oh", "808lt", "808mt", "808ht", "808cy",
  "wind", "birds", "insect", "outdoor", "space", "pad", "padlong",
  "piano", "arpy", "pluck", "jvbass", "bass", "bass1", "bass3", "casio", "gtr", "sitar", "juno", "moog", "sax", "east", "world",
];

export const SOUNDS = new Set([...SYNTHS, ...SAMPLES, ...Object.keys(INSTRUMENTS)]);

export const CALLABLE = new Set([
  "n", "s", "sound", "bank", "stack", "cat", "seq", "fastcat", "slowcat", "sequence", "polymeter", "pure",
  "run", "irand", "choose", "chooseCycles", "wchoose", "randcat", "arrange", "pick",
  "scale", "transpose", "add", "sub", "mul", "div", "range", "rangex", "fmap", "round", "segment",
  "struct", "mask", "euclid", "euclidRot", "euclidLegato", "every", "firstOf", "lastOf", "when",
  "sometimes", "sometimesBy", "often", "rarely", "almostNever", "almostAlways", "someCycles",
  "someCyclesBy", "degrade", "degradeBy", "undegradeBy", "fast", "slow", "early", "late", "rev",
  "palindrome", "iter", "iterBack", "ply", "chunk", "off", "jux", "juxBy", "superimpose", "layer",
  "echo", "stut", "swing", "swingBy", "inside", "outside", "linger", "chop", "striate",
  "clip", "legato", "attack", "decay", "sustain", "release", "adsr", "lpf", "cutoff", "lpq",
  "resonance", "hpf", "hcutoff", "hpq", "bpf", "bpq", "vowel", "room", "roomsize", "size", "delay",
  "delaytime", "delayfeedback", "pan", "gain", "velocity", "speed", "begin", "end", "cut", "crush",
  "coarse", "shape", "distort", "detune", "unison", "spread", "phaser", "phaserdepth", "vib", "vibmod",
  "fm", "fmh", "density", "lpenv", "lpattack", "lpdecay", "lpsustain", "lprelease",
  "delaysync", "penv", "pattack", "pdecay",
  "map", "floor", "ceil", "min", "max", "abs", "sin", "cos", "pow", "sqrt",
  ...HELPER_NAMES,
  ...SCORE_FUNCTIONS,
  ...SCORE_METHODS,
]);

export const GLOBALS = new Set([
  ...CALLABLE,
  ...SCORE_NAMES,
  "broth", "genre", "form", "palette", "style", "macro", "drums", "regions", "Math", "sine", "cosine", "saw", "square", "tri", "rand", "perlin", "silence",
]);

export const FORBIDDEN_WORDS = /\b(constructor|prototype|__proto__|__\w+__|globalThis|window|self|document|process|require|import|eval|Function)\b/;

export const LIMITS: Record<string, [min: number, max: number]> = {
  gain: [0, 1],
  velocity: [0, 1],
  room: [0, 1],
  roomsize: [0, 10],
  size: [0, 10],
  delay: [0, 1],
  delayfeedback: [0, 0.85],
  delaytime: [0, 2],
  delaysync: [0, 2],
  penv: [-12, 12],
  pattack: [0, 4],
  pdecay: [0, 4],
  cutoff: [20, 20000],
  hcutoff: [20, 12000],
  bandf: [20, 16000],
  resonance: [0, 20],
  hresonance: [0, 20],
  bandq: [0, 20],
  shape: [0, 0.7],
  distort: [0, 2],
  crush: [3, 16],
  coarse: [1, 32],
  speed: [-4, 4],
  unison: [1, 7],
  detune: [0, 1],
  attack: [0, 8],
  decay: [0, 8],
  sustain: [0, 1],
  release: [0, 8],
  pan: [0, 1],
  fm: [0, 8],
  density: [0, 1],
};

export const MAX_OUTPUT_TOKENS = 16000;
const ROOM_TO_THINK = 3000;
export const MAX_CODE_LENGTH = Math.floor((MAX_OUTPUT_TOKENS - ROOM_TO_THINK) * 1.5);
