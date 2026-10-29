import type { GenreFile } from "./index";

export const downtempo: GenreFile = {
  region: {
    id: "downtempo",
    name: "downtempo",
    at: { energy: 0.45, texture: 0.35, colour: 0.4, strangeness: 0.3 },
    bpm: 90,
    character:
      "trip-hop and downtempo: a heavier, slower groove, deep bass, moody minor chords, percussion like tabla or hand drums, space and delay.",
    synth:
      "half-time comping on dark minor chords: a chord on the one and a push on the and of two, then space. square or sawtooth through a low filter (lpf 600 to 1400), a slow phaser, a dotted delay.",
    arc: 0.8,
    rush: 0.1,
    seams: { gap: 0.5, mix: 0.3, drop: 0.2 },
    minutes: [3, 5],
  },
  preset: {
    knobs: {
      keys: { epiano: 1.5, piano: 0.1, organ: 1, moody: 1.2 },
      role: { comping: 0.5, arpeggios: 0.1, held: 1.5, resting: 0.3 },
      octave: { lower: 1, middle: 1, higher: 0.4 },
      progression: 0.2,
      ownLoop: 2.1,
      swing: { nearlyStraight: 0.5, light: 1.5, heavy: 0.1 },
      drone: 0.33,
      bells: { harp: 0.2, rhodes: 1, guitar: 1, none: 0.3 },
      motifSound: { bells: 0.2, flute: 1, pluck: 1.2 },
      drums: { dusty909: 1, short909: 0.1, brushes: 0.1, slackSnare: 1, jazz: 0.1, crisp: 1, linn: 1, rimshot: 0.1 },
      pulse: { heavyBoomBap: 2, push: 1 },
      backbeat: { twoAndFour: 1, onThree: 1.3 },
      perc: { shakers: 0.3, hands: 1, both: 0.5 },
      bassRoll: { figure: 0.3, rolling: 0.25, long: 1 },
      lead: { none: 1, psy: 0.5 },
      chords: { play: 1, rest: 0.3 },
      pad: { bed: 1 },
    },
    macros: { keys: 1, homely: 1 },
    loop: {
      templates: [3, 0.2, 1, 0.3, 0.2, 0.5, 0.2, 0.2, 1.5, 0.3, 0.5, 0.5, 0.2, 0.2, 3, 0.2, 0.3, 0.2, 3, 3],
      rhythm: { 2: [0.2, 1.5, 0.2, 1.2], 3: [0.3, 0.3, 1.5], 4: [0.3, 2] },
      dominantOnV: 0.15,
      secondary: 0.05,
      borrowedIv: 0.1,
      push: 0.15,
    },
    figures: {
      kicks: [
        { at: { 6: 0.6, 7: 0.5, 10: 2, 11: 0.6, 14: 0.4 }, extra: [1, 2] },
        { at: { 3: 0.4, 6: 1, 7: 1.2, 10: 1.5, 14: 0.5 }, extra: [1, 2] },
        { at: { 2: 0.5, 3: 1, 6: 1, 7: 0.7, 10: 1, 11: 1, 14: 0.8 }, extra: [2, 2] },
        { at: { 2: 0.6, 5: 1, 6: 0.8, 10: 1, 11: 1.2, 14: 0.6 }, extra: [1, 2] },
      ],
      comps: [
        { hits: [1, 2], late: 0.15 },
        { hits: [1, 3], late: 0.2 },
        { hits: [2, 3], late: 0.35 },
        { hits: [1, 3], late: 0.3 },
      ],
    },
    psy: {
      roll: [1.2, 1, 1],
      shaker: [1, 0.6, 1],
      triplet: 0.1,
      sweep: [32, 64, 64],
      voice: [0, 1, 0],
      three: [1, 1.3, 1],
      hands: [1.2, 1, 0.8, 0.8],
      change: { hand: 0.3, noHands: 0.15, kick: 0.3, shaker: 0.3, bass: 0.3, twist: 0.17 },
    },
    mode: { lowest: 0, highest: 2 },
  },
};
