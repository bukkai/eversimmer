import type { GenreFile } from "./index";

export const deepHouse: GenreFile = {
  region: {
    id: "deepHouse",
    name: "deep house",
    at: { energy: 0.7, texture: 0.4, colour: 0.7, strangeness: 0.2 },
    bpm: 122,
    character:
      "minimal and deep house: four-on-the-floor kick, offbeat open hats, claps on two and four, a warm bassline, soulful chords. Groovy and light.",
    synth:
      "short warm chord stabs in a 3-3-2 rhythm (x ~ ~ x ~ ~ x ~), minor nines and major sevens, sawtooth through a filter around 2000 or an organ-like fm with fmh 1; the chord changes every bar or two.",
    arc: 0.9,
    rush: 0.7,
    seams: { gap: 0, mix: 0.6, drop: 0.4 },
    minutes: [4, 6],
  },
  preset: {
    knobs: {
      keys: { epiano: 1.5, organ: 1.5 },
      role: { comping: 0.3, held: 0.4, resting: 0.2, houseStabs: 3 },
      octave: { lower: 1, middle: 1 },
      progression: 0.2,
      ownLoop: 2.1,
      swing: { nearlyStraight: 1, light: 2 },
      bells: { none: 2 },
      drums: { dusty909: 1, tr909: 1 },
      pulse: { fourFloor: 1 },
      backbeat: { clap: 1 },
      perc: { openHats: 1 },
      bassRoll: { offbeat: 1 },
      pad: { none: 1 },
    },
    macros: { keys: 1, muted: 1, running: 1 },
    loop: {
      templates: [3, 3, 0.5, 1.5, 1, 1.5, 0.3, 0.3, 0.5, 0.5, 1, 1, 0.3, 0.3, 0.3, 1, 0.3, 0.2, 2, 2],
      rhythm: { 2: [2, 2, 0.3, 0.3, 0, 0], 3: [1, 1, 0.3, 0, 0], 4: [2, 1, 0, 0] },
      dominantOnV: 0.2,
      secondary: 0.1,
      borrowedIv: 0.15,
      push: 0.2,
    },
    mode: { lowest: 1 },
  },
};
