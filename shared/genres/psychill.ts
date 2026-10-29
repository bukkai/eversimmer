import type { GenreFile } from "./index";

export const psychill: GenreFile = {
  region: {
    id: "psychill",
    name: "psychill",
    at: { energy: 0.45, texture: 0.55, colour: 0.5, strangeness: 0.8 },
    bpm: 96,
    character:
      "psychedelic chill: filters sweeping slowly on sine LFOs, a squelchy acid-like line, long delays and echoes, sounds panning around, a gentle rolling groove. Trippy but relaxed.",
    synth:
      "a squelchy line in sixteenths over one root: sawtooth with a short decay, lpq 6 to 14, lpenv, the cutoff sweeping on a slow sine; echoes through off() and delay, panning around. Harmony barely moves; the filter does.",
    arc: 0.8,
    rush: 0.5,
    seams: { gap: 0.2, mix: 0.5, drop: 0.3 },
    minutes: [4, 6],
  },
  preset: {
    knobs: {
      bells: { harp: 0.4, rhodes: 0.5, guitar: 0.5, none: 3 },
      drone: 0.9,
      pulse: { push: 1 },
      backbeat: { onThree: 1 },
      perc: { both: 1 },
      bassRoll: { rolling: 1 },
      lead: { psy: 1 },
      chords: { rest: 1 },
      pad: { bed: 1 },
    },
    macros: { veiled: 1, glassy: 1 },
    psy: {
      roll: [1.2, 1, 1],
      shaker: [1, 1, 0.8],
      triplet: 0.35,
      sweep: [16, 32, 32, 64],
      voice: [1, 1.2, 0.6],
      three: [1.2, 1, 0.8],
      hands: [1.2, 1, 0.8, 0.8],
      change: { hand: 0.4, noHands: 0.2, kick: 0.5, shaker: 0.3, bass: 0.35, twist: 0.28 },
    },
    mode: { dark: 0, light: 2, below: -0.3 },
  },
};
