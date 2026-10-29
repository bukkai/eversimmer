import type { GenreFile } from "./index";

export const progPsy: GenreFile = {
  region: {
    id: "progPsy",
    name: "progressive psy",
    at: { energy: 0.82, texture: 0.75, colour: 0.45, strangeness: 0.75 },
    bpm: 128,
    character:
      "progressive psytrance: a tight kick on every beat, a rolling sixteenth-note bassline between the kicks (sawtooth with short decay through a filter), hats, long builds made of filters opening and layers coming in, psychedelic leads and effects.",
    synth:
      "a rolling bass between the kicks ([~ x x x]*4, sawtooth, decay under 0.1, filter with lpenv), a sixteenth-note arpeggio lead on a resonant sawtooth whose filter opens over 16 or 32 bars as a build, one root for long stretches, phrygian or aeolian.",
    arc: 1,
    rush: 1,
    seams: { gap: 0, mix: 0.3, drop: 0.7 },
    minutes: [5, 7],
  },
  preset: {
    knobs: {
      keys: { dub: 1 },
      role: { comping: 1, held: 1 },
      progression: 0,
      ownLoop: 2,
      swing: { nearlyStraight: 1 },
      drone: 0.9,
      droneShape: { root: 3, toVII: 1, slowVIandVII: 1, slowIV: 1 },
      bells: { harp: 0.1, none: 7 },
      drums: { dusty909: 1, tr909: 2 },
      pulse: { fourFloor: 1 },
      backbeat: { none: 1, clap: 2 },
      perc: { openHats: 1 },
      bassRoll: { roller: 1 },
      lead: { none: 1, psy: 1, arpeggio: 3 },
      chords: { play: 1, rest: 3 },
      pad: { bed: 2, none: 1 },
    },
    macros: { tight: 1 },
    loop: {
      templates: [1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2],
      rhythm: { 2: [0, 0, 0, 0, 1, 1], 3: [0, 0, 0, 0, 1], 4: [0, 0, 0, 1] },
      dominantOnV: 0,
      secondary: 0,
      borrowedIv: 0,
      push: 0,
    },
    psy: {
      roll: [1, 1, 1],
      shaker: [1, 1, 1],
      triplet: 0,
      sweep: [32, 64, 64],
      voice: [1, 0, 0.6],
      three: [1, 1, 1],
      hands: [1, 1, 1, 1],
      change: { hand: 0.1, noHands: 0.05, kick: 0.1, shaker: 0.1, bass: 0.15, twist: 0.12 },
    },
    mode: { dark: 0, light: 1, below: -0.1 },
    mutation: 0.06,
  },
};
