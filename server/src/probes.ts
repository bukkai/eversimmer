import { FORM_REST, type FormValues } from "../../shared/form";
import { mapTarget, REGIONS, weightsAt, type MapPosition } from "../../shared/map";
import { DRIFT, DRUMKITS, DUB, TR606_KIT, TR909_KIT, GROOVES, KITS, MOODY, OWN_LOOP, SWINGS, type Palette, type Style } from "../../shared/palette";
import { DRONES } from "../../shared/song";
import { RESTING_BROTH, type Broth } from "../../shared/types";

const MOMENTS: FormValues[] = [
  FORM_REST,
  { ...FORM_REST, strip: 1 },
  { ...FORM_REST, drop: 1, bass: 1, fill: 1 },
  { ...FORM_REST, strip: 1, lift: 1, gap: 1 },
  { ...FORM_REST, hats: 0, pad: 0, bass: 1, fill: 2 },
  { ...FORM_REST, fill: 3, theme: 1 },
  { ...FORM_REST, hats: 0, fill: 4 },
  { ...FORM_REST, intro: 1, strip: 1, bare: 1 },
  { ...FORM_REST, outro: 0.8, hats: 0, strip: 1, bare: 1 },
];
const BROTHS: Broth[] = [
  { ...RESTING_BROTH, voices: 2 },
  { valence: -1, energy: 0, density: 0, tension: 0, warmth: 0, texture: 0, strangeness: 0, voices: 0 },
  { valence: 1, energy: 1, density: 1, tension: 1, warmth: 1, texture: 1, strangeness: 1, voices: 6 },
  { valence: -0.4, energy: 0.7, density: 0.5, tension: 0.8, warmth: 0.2, texture: 0.8, strangeness: 0.6, voices: 3 },
];
const paletteFor = (i: number): Palette => ({
  keys: i % 5,
  role: i % 4,
  voicing: (i + 1) % 4,
  octave: (i % 3) - 1,
  prog: (i + 2) % (OWN_LOOP + 1),
  loop: i * 104729,
  bells: (i + 3) % 4,
  motif: i % 4,
  fifths: (i % 4) - 1,
  tempo: 1,
  groove: (i + 1) % GROOVES.length,
  swing: i % SWINGS.length,
  kit: (i + 2) % KITS.length,
  drums: i % TR606_KIT,
  phrase: i * 7919,
  figure: i * 15485863,
  wow: (i % 3) / 2,
  bright: ((i + 1) % 3) / 2,
  bassTone: i % 3,
  motifSound: (i + 1) % 3,
  vinyl: ((i + 2) % 3) / 2,
  drone: (i % (DRONES.length + 1)) - 1,
  psy: i * 7727,
  pulse: 0,
  backbeat: 0,
  perc: 0,
  bassRoll: 0,
  lead: 0,
  chords: 0,
  pad: 0,
  block: i % 6,
});
const layersAt = (at: MapPosition, i: number) => {
  const psy = weightsAt(at).psychill > 0.5;
  if (weightsAt(at).downtempo > 0.5)
    return { pulse: 1 + (i % 2), backbeat: 1, perc: 2 + (i % 2), bassRoll: 2, lead: i % 2, chords: 0, pad: 1, keys: MOODY };
  if (weightsAt(at).ambient > 0.5)
    return { pulse: 3 + (i % 2), backbeat: 2, perc: 4, bassRoll: 3, lead: 0, chords: 0, pad: 0, keys: DRIFT };
  if (weightsAt(at).deepHouse > 0.5)
    return { pulse: 5, backbeat: 3, perc: 5, bassRoll: 4, lead: 0, chords: 0, pad: 2, keys: 2 * (i % 2), role: 4, drums: i % 2 ? TR909_KIT : 0 };
  if (weightsAt(at).dubTechno > 0.5)
    return { pulse: 5, backbeat: 2 - (i % 2), perc: 5, bassRoll: 2, lead: 0, chords: 0, pad: 2, keys: DUB, drums: i % 2 ? TR909_KIT : 0 };
  if (weightsAt(at).softIdm > 0.5) {
    const j = Math.floor(i / 12) % 3;
    return { pulse: 0, backbeat: +(j === 1), perc: 6, bassRoll: 2 * +(j === 2), lead: 2 * +(j !== 1), chords: +(j === 1), pad: 1, keys: j === 2 ? 0 : 3, role: 1, drums: j === 1 ? 1 : TR606_KIT };
  }
  if (weightsAt(at).progPsy > 0.5) {
    const j = Math.floor(i / 12) % 3;
    return { pulse: 5, backbeat: j === 1 ? 2 : 3, perc: 5, bassRoll: 5, lead: j === 2 ? 1 : 3, chords: +(j !== 1), pad: 1 + +(j === 2), keys: DUB, drums: j === 2 ? 0 : TR909_KIT };
  }
  return { pulse: 2 * +psy, backbeat: +psy, perc: 3 * +psy, bassRoll: +psy, lead: +(psy || i % 5 === 3), chords: +(psy && i % 2 === 0), pad: i % 3 ? 1 : 0 };
};
export const STYLE_MIXES: Record<Style, number>[] = [
  { tape: 1, melody: 0, gen: 0 },
  { tape: 0, melody: 1, gen: 0 },
  { tape: 0, melody: 0, gen: 1 },
  { tape: 0.5, melody: 0.5, gen: 0 },
  { tape: 0, melody: 0.5, gen: 0.5 },
];
export type Probe = { broth: Broth; at: MapPosition; moment: FormValues; palette: Palette; style: Record<Style, number> };
export const probesWith = (shift: number): Probe[] =>
  [
    ...BROTHS.map((broth, i) => ({ broth, at: mapTarget(broth), moment: MOMENTS[i] })),
    ...REGIONS.map((r, i) => ({ broth: { ...RESTING_BROTH, voices: 2 }, at: r.at, moment: MOMENTS[i % MOMENTS.length] })),
  ].map((probe, i) => ({
    ...probe,
    palette: { ...paletteFor(i + shift), ...layersAt(probe.at, i + shift) },
    style: STYLE_MIXES[i % STYLE_MIXES.length],
  }));
export const PROBES = probesWith(0);
export const WINDOWS: [number, number][] = [[0, 8], [4096, 4104]];
