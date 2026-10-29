import { formSignals, type FormValues } from "./form";
import { courseHelpers } from "./helpers";
import { macroSignals } from "./macros";
import { genreSignals, weightsAt, type MapPosition } from "./map";
import { paletteSignals, styleSignals, type Palette, type Style, type Tides } from "./palette";
import { shareAt, type SettingKnob } from "./presets";
import { BROTH_KEYS, type Broth, type BrothKey } from "./types";

export type CourseSources = {
  broth: () => Readonly<Broth>;
  scale: (cycle: number) => string;
  position: () => MapPosition;
  moment: (cycle: number) => FormValues;
  palette: (cycle: number) => Palette;
  tides: () => Tides;
  style: () => Record<Style, number>;
};

export function courseGlobals<P>(signal: (fn: (t: number) => number) => P, from: CourseSources) {
  const genre = genreSignals(signal, from.position);
  const style = styleSignals(signal, from.style);
  const macro = macroSignals(signal, { broth: from.broth, style: from.style, position: from.position });
  const shares = new Map<string, P>();
  const shareOf = (knob: string, settings: string[]) => {
    const key = `${knob}:${settings.join(",")}`;
    if (!shares.has(key)) {
      shareAt({}, knob as SettingKnob, settings);
      shares.set(key, signal(() => shareAt(weightsAt(from.position()), knob as SettingKnob, settings)));
    }
    return shares.get(key)!;
  };
  return {
    broth: {
      ...(Object.fromEntries(BROTH_KEYS.map((k) => [k, signal(() => from.broth()[k])])) as Record<BrothKey, P>),
      scale: signal((t) => from.scale(Number(t)) as unknown as number),
    },
    genre,
    form: formSignals(signal, from.moment, from.position),
    palette: paletteSignals(signal, from.palette, from.tides),
    style,
    macro,
    ...courseHelpers(genre, style, macro, shareOf, () => globalThis),
  };
}
