import type { GenreFile } from "./index";

export const softIdm: GenreFile = {
  region: {
    id: "softIdm",
    name: "soft IDM",
    at: { energy: 0.5, texture: 0.85, colour: 0.5, strangeness: 0.6 },
    bpm: 100,
    character:
      "gentle electronica in the Boards of Canada and Aphex Twin ambient vein: intricate, slightly broken rhythms (ply, chunk, euclid), glassy synths, detuned melodies, clicks.",
    synth:
      "glassy bell tones from fm with a ratio that is not a whole number (fmh 3.5), short phrases that phase against the bar ({0 4 2 7 1}%8, polymeter, euclid), slightly detuned, the odd ply(2) stutter; melodies more than chords.",
    arc: 0.7,
    rush: 0.2,
    seams: { gap: 0.5, mix: 0.4, drop: 0.1 },
    minutes: [3, 5],
  },
  preset: {
    knobs: {
      keys: { epiano: 1, vibraphone: 1.5 },
      role: { comping: 0.2, arpeggios: 2.5, held: 1, resting: 0.7 },
      octave: { lower: 0.4, middle: 1, higher: 1.3 },
      progression: 0.2,
      ownLoop: 2.1,
      swing: { nearlyStraight: 1 },
      drone: 0.25,
      bells: { scattered: 0.4, glass: 1.3, musicBox: 0.3, none: 1.5 },
      drums: { dusty909: 0.5, short909: 1, crisp: 0.5, linn: 1, tr606: 2 },
      backbeat: { twoAndFour: 1, onThree: 0.5 },
      perc: { clicks: 1 },
      bassRoll: { figure: 1, long: 0.3 },
      lead: { none: 0.33, glass: 1 },
      chords: { play: 1, rest: 0.5 },
      pad: { bed: 1 },
    },
    macros: { keys: 1, glassy: 1 },
    loop: {
      templates: [2, 1, 1, 1.5, 0.3, 1.5, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.3, 0.5, 0.3, 0.5, 0, 0, 1, 1],
      rhythm: { 2: [0, 1.5, 0, 1, 0.3, 0], 3: [0, 0, 1.5, 0.5, 0], 4: [0, 1.5, 1, 0] },
      dominantOnV: 0.05,
      secondary: 0,
      borrowedIv: 0.05,
      push: 0,
    },
    figures: {
      kicks: [
        { at: { 3: 1, 6: 1, 7: 0.6, 9: 0.8, 10: 1, 11: 0.8, 14: 0.6 }, extra: [1, 2] },
        { at: { 2: 0.6, 5: 1, 7: 1, 9: 1, 11: 1, 14: 0.8 }, extra: [2, 3] },
        { at: { 3: 1, 5: 0.8, 6: 0.6, 9: 1, 10: 0.5, 13: 1, 15: 0.6 }, extra: [2, 3] },
        { at: { 2: 0.8, 5: 1, 7: 0.6, 8: 0.5, 11: 1, 13: 0.8, 15: 0.8 }, extra: [2, 3] },
      ],
      comps: [
        { hits: [1, 2], late: 0.2 },
        { hits: [1, 3], late: 0.3 },
        { hits: [2, 3], late: 0.4 },
        { hits: [1, 3], late: 0.35 },
      ],
    },
    psy: {
      roll: [1, 1, 1],
      shaker: [1, 1, 1],
      triplet: 0,
      sweep: [16, 32, 32],
      voice: [0, 1, 0],
      three: [0, 1, 0],
      hands: [1, 1, 1, 1],
      change: { hand: 0.2, noHands: 0.1, kick: 0.2, shaker: 0.2, bass: 0.2, twist: 0.1 },
    },
    mode: { lowest: 1 },
    mutation: 0.16,
  },
};
