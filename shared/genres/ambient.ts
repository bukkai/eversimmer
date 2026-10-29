import type { GenreFile } from "./index";

export const ambient: GenreFile = {
  region: {
    id: "ambient",
    name: "ambient",
    at: { energy: 0.05, texture: 0.45, colour: 0.5, strangeness: 0.35 },
    bpm: 70,
    character:
      "no pulse to speak of: long pads and drones that swell and fade, sparse bell-like notes far apart, wind and room. Drums are absent or a distant heartbeat.",
    synth:
      "held chords that swell in and fade out, one per bar or longer: triangle or supersaw, attack 2 to 4, release 5 or more, wide voicings with a ninth on top, a filter drifting on perlin. No rhythm in the harmony at all.",
    arc: 0.3,
    rush: 0,
    seams: { gap: 1, mix: 0, drop: 0 },
    minutes: [3, 5],
    breathes: true,
  },
  preset: {
    knobs: {
      keys: { epiano: 0.6, piano: 1, organ: 0.2, vibraphone: 1, square: 0.3, drift: 3 },
      role: { arpeggios: 0.3, held: 2, resting: 0.6 },
      octave: { lower: 1, middle: 1, higher: 0.4 },
      progression: 0,
      ownLoop: 2,
      drone: 0.5,
      droneShape: { root: 1, slowVIandVII: 1, slowIV: 1 },
      bells: { scattered: 1, glass: 1, musicBox: 0.4, none: 1 },
      motifSound: { bells: 1, flute: 1, pluck: 0.4 },
      pulse: { heartbeat: 1, none: 2 },
      backbeat: { none: 1 },
      perc: { silent: 1 },
      bassRoll: { none: 1 },
      chords: { play: 1, rest: 0.3 },
    },
    macros: { keys: 1, bloom: 1, homely: 1 },
    loop: {
      templates: [2, 1, 0.5, 2, 0, 1, 0, 0, 1, 0.3, 0, 0, 0, 0, 0, 0, 0, 0, 1.5, 1],
      rhythm: { 2: [0, 0, 0, 0.3, 2, 1], 3: [0, 0, 0, 1.5, 0.7], 4: [0, 0, 1, 1] },
      dominantOnV: 0,
      secondary: 0,
      borrowedIv: 0.1,
      push: 0,
    },
    psy: {
      roll: [1, 1, 1],
      shaker: [1, 1, 1],
      triplet: 0,
      sweep: [32, 64, 64],
      voice: [0, 1, 0],
      three: [1, 1, 1],
      hands: [1, 1, 1, 1],
      change: { hand: 0.1, noHands: 0.05, kick: 0.1, shaker: 0.1, bass: 0.1, twist: 0.05 },
    },
    mode: { lowest: 1 },
    mutation: 0.04,
  },
};
