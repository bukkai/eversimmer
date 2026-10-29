import type { GenreFile } from "./index";

export const lofi: GenreFile = {
  region: {
    id: "lofi",
    name: "lo-fi",
    at: { energy: 0.3, texture: 0.3, colour: 0.5, strangeness: 0.15 },
    bpm: 76,
    character:
      "lazy, swung hip hop drums (soft kick, snare on two and four, hats with swingBy), warm jazzy seventh chords on a soft electric-piano sound, a round sine bass, a little hiss. Mellow and a bit dusty.",
    synth:
      "a soft electric piano (sine with fm 1 to 2.5 and fmh 2) comping seventh and ninth chords lazily, a little ahead of or behind the beat, with a different figure every bar over eight bars or more; one chord per bar.",
    arc: 0.7,
    rush: 0,
    seams: { gap: 0.85, mix: 0.15, drop: 0 },
    minutes: [2, 3.5],
  },
  preset: {
    knobs: {
      keys: { epiano: 1, piano: 2, organ: 0.2, vibraphone: 0.3, guitar: 0.4 },
      role: { comping: 1, arpeggios: 0.3, held: 1, resting: 1 },
      octave: { lower: 1, middle: 1, higher: 0.2 },
      progression: 0.2,
      ownLoop: 2.1,
      swing: { nearlyStraight: 0.4, light: 1, heavy: 1.2 },
      pad: { bed: 1 },
    },
    macros: { keys: 1, wear: 1, steady: 1, running: 1, focus: 1, homely: 1, dust: 0.15 },
    loop: {
      templates: [...Array<number>(18).fill(1), 0, 0],
      rhythm: { 2: [1, 1.5, 0.5, 0.3], 3: [1.5, 1, 0.6], 4: [2, 1] },
      dominantOnV: 0.6,
      secondary: 0.2,
      borrowedIv: 0.25,
      push: 0.35,
    },
    figures: {
      kicks: [
        { at: { 7: 0.5, 8: 1, 10: 2, 11: 0.5, 14: 0.4 }, extra: [1, 2] },
        { at: { 2: 0.3, 6: 0.8, 7: 1.5, 8: 0.8, 10: 2, 14: 0.5 }, extra: [2, 2] },
        { at: { 2: 0.5, 3: 1, 6: 1, 7: 0.7, 9: 1, 10: 1, 11: 1, 14: 1 }, extra: [2, 3] },
        { at: { 2: 0.6, 5: 1, 6: 0.8, 9: 1, 11: 1.2, 13: 1, 14: 0.6 }, extra: [2, 2] },
      ],
      comps: [
        { hits: [2, 3], late: 0.15 },
        { hits: [2, 4], late: 0.2 },
        { hits: [3, 5], late: 0.45 },
        { hits: [2, 4], late: 0.4 },
      ],
    },
    mode: { lowest: 1 },
  },
};
