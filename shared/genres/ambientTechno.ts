import type { GenreFile } from "./index";

export const ambientTechno: GenreFile = {
  region: {
    id: "ambientTechno",
    name: "ambient techno",
    at: { energy: 0.25, texture: 0.35, colour: 0.3, strangeness: 0.6 },
    bpm: 112,
    character:
      "a four-on-the-floor kick muffled as if heard through fog from far away, under a haze of pads and smeared chords that swell and blur, one chord for minutes, a deep sub, hiss. The beat is a pulse in the distance, never the point.",
    synth:
      "one chord held and smeared: a stab drowned in reverb and a long delay until its echoes are a cloud, or held chords swelling under a slow filter, the colour changing over 32 to 64 bars; no bright attacks.",
    arc: 0.3,
    rush: 0,
    seams: { gap: 0.2, mix: 0.8, drop: 0 },
    minutes: [5, 8],
  },
  preset: {
    knobs: {
      keys: { drift: 1.5, dub: 1 },
      role: { comping: 0.5, held: 1 },
      progression: 0,
      ownLoop: 1,
      swing: { nearlyStraight: 1 },
      drone: 0.7,
      droneShape: { root: 2, slowVIandVII: 1 },
      bells: { rhodes: 0.3, none: 4 },
      drums: { dusty909: 1, tr909: 0.5 },
      pulse: { heartbeat: 1, fourFloor: 2 },
      backbeat: { none: 1 },
      perc: { silent: 1, openHats: 0.3 },
      bassRoll: { long: 1 },
      lead: { none: 1 },
      chords: { play: 1, rest: 0.3 },
      pad: { full: 1 },
    },
    macros: { keys: 0.5, muffle: 1, echoing: 0.6, veiled: 0.6, bloom: 0.5, hushed: 1 },
    loop: {
      templates: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.5, 1.5],
      rhythm: { 2: [0, 0, 0, 0, 1, 2], 3: [0, 0, 0, 0, 1], 4: [0, 0, 0, 1] },
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
      three: [1, 1, 1],
      hands: [1, 1, 1, 1],
      change: { hand: 0.05, noHands: 0.05, kick: 0.1, shaker: 0.05, bass: 0.05, twist: 0.03 },
    },
    mode: { lowest: 1, highest: 2 },
    mutation: 0.03,
  },
};
