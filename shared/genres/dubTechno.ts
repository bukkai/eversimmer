import type { GenreFile } from "./index";

export const dubTechno: GenreFile = {
  region: {
    id: "dubTechno",
    name: "dub techno",
    at: { energy: 0.6, texture: 0.6, colour: 0.3, strangeness: 0.4 },
    bpm: 118,
    character:
      "a muffled four-on-the-floor kick, one chord stab drowned in delay and reverb that keeps changing colour through its filter, deep sub bass, hiss. Hypnotic, changes very slowly.",
    synth:
      "one minor-seventh chord stab on an offbeat, sawtooth with a short decay, high-passed, drowned in a dotted delay with high feedback and reverb, its filter opening and closing over 32 bars. The chord itself changes rarely; its colour changes all the time.",
    arc: 0.6,
    rush: 0.3,
    seams: { gap: 0, mix: 0.9, drop: 0.1 },
    minutes: [5, 7],
  },
  preset: {
    knobs: {
      keys: { dub: 1 },
      role: { comping: 1, held: 1 },
      progression: 0,
      ownLoop: 2,
      swing: { nearlyStraight: 1 },
      drone: 0.5,
      droneShape: { root: 1, slowVIandVII: 0.5, slowIV: 0.5 },
      bells: { scattered: 0.03, glass: 0.03, musicBox: 0.03, none: 7 },
      drums: { dusty909: 1, tr909: 1 },
      pulse: { fourFloor: 1 },
      backbeat: { onThree: 0.25, none: 1 },
      perc: { openHats: 1 },
      bassRoll: { long: 1 },
      chords: { play: 1, rest: 0.15 },
      pad: { none: 1 },
    },
    macros: { muffle: 1, echoing: 1 },
    loop: {
      templates: [2, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.5, 2],
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
      voice: [0, 1, 0],
      three: [0, 1, 0],
      hands: [1, 1, 1, 1],
      change: { hand: 0.1, noHands: 0.05, kick: 0.1, shaker: 0.1, bass: 0.1, twist: 0.05 },
    },
    mode: { lowest: 1, highest: 2 },
    mutation: 0.04,
  },
};
