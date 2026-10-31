import { clamp } from "./numbers";
import { weightsAt, type MapPosition } from "./map";
import type { Style } from "./palette";
import { macroAt } from "./presets";
import { STILL_AIR, type Air, type Broth, type BrothKey } from "./types";

type MacroSource = `broth.${BrothKey}` | `style.${Style}` | `genre.${string}` | "genres" | `air.${keyof Air}`;

export const MACROS = {
  drive: {
    about: "how hard the beat plays: the drums louder and brighter, and the busier drum parts coming in",
    from: { "broth.energy": 1 },
  },
  busy: {
    about: "how much goes on around the beat: rimshots, then hand drums",
    from: { "broth.density": 1 },
  },
  drag: {
    about: "how uneasy the groove is: the hats lag further behind the beat",
    from: { "broth.tension": 1 },
  },
  dust: {
    about: "how worn the drums sound, as saturation (0 … 0.45): on tape, and in lo-fi",
    from: { "style.tape": 0.3, genres: 1 },
  },
  keys: {
    about: "how present the stone's own keys are: at home, in downtempo, ambient, deep house and soft IDM",
    from: { genres: 1 },
  },
  wear: {
    about: "how worn the whole sound is, like an old record in a small room: duller bells, hats and keys, a wobbling bass, crackle; lo-fi's",
    from: { genres: 1 },
  },
  steady: {
    about: "how complete the beat stays in a calm room (atLeast): lo-fi's",
    from: { genres: 1 },
  },
  running: {
    about: "how steadily the hats keep running in a calm room instead of thinning out: lo-fi's and deep house's",
    from: { genres: 1 },
  },
  focus: {
    about: "how much the music carries one melody at a time: scattered harp, voices and the generative style step back, the tape lead steps aside for a motif; lo-fi's",
    from: { genres: 1 },
  },
  veiled: {
    about: "how far the stone's bells and voices step back, darker and softer: psychill's, and in fog",
    from: { genres: 1, "air.fog": 0.5 },
  },
  hushed: {
    about: "how far the generative style's metallic blips step back, sparser, softer and rounder: the quiet genres'",
    from: { genres: 1 },
  },
  muted: {
    about: "how far the tones step back for the drums: the keys softer and darker, no stabs, tension or tape lead; deep house's",
    from: { genres: 1 },
  },
  muffle: {
    about: "how muffled the kick on every beat and the open hats are, over a little hiss: dub techno's, and in fog",
    from: { genres: 1, "air.fog": 0.5 },
  },
  tight: {
    about: "how tight and bright the kick on every beat is: progressive psy's",
    from: { genres: 1 },
  },
  bloom: {
    about: "how slowly the theme's notes swell in: ambient's, and in fog",
    from: { genres: 1, "air.fog": 0.5 },
  },
  homely: {
    about: "how much the theme and the melody style's tune play on a soft piano or square: at home, in ambient and downtempo",
    from: { genres: 1 },
  },
  glassy: {
    about: "how much the theme and the tune play on glass and a glassy pluck: in psychill and soft IDM",
    from: { genres: 1 },
  },
  echoing: {
    about: "how much the tune plays as a stab in a long echo: dub techno's",
    from: { genres: 1 },
  },
  fog: {
    about: "how far the music sits in fog: the keys, pad, bells and theme in a larger, wetter room",
    from: { "air.fog": 1 },
  },
} satisfies Record<string, { about: string; from: Partial<Record<MacroSource, number>> }>;
export type Macro = keyof typeof MACROS;
export const MACRO_NAMES = Object.keys(MACROS) as Macro[];

export function macroSignals<P>(
  signal: (fn: () => number) => P,
  read: { broth: () => Readonly<Broth>; style: () => Record<Style, number>; position: () => MapPosition; air?: () => Readonly<Air> },
) {
  const value = (source: string): number => {
    const [group, key] = source.split(".");
    if (group === "broth") return read.broth()[key as BrothKey] as number;
    if (group === "style") return read.style()[key as Style];
    if (group === "air") return (read.air?.() ?? STILL_AIR)[key as keyof Air];
    return weightsAt(read.position())[key];
  };
  const fed = (name: Macro, source: string) => (source === "genres" ? macroAt(weightsAt(read.position()), name) : value(source));
  return Object.fromEntries(
    MACRO_NAMES.map((name) => {
      const from = Object.entries(MACROS[name].from) as [string, number][];
      return [name, signal(() => clamp(from.reduce((sum, [source, weight]) => sum + fed(name, source) * weight, 0)))];
    }),
  ) as Record<Macro, P>;
}
