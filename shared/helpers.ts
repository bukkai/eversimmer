import { SWINGS } from "./palette";
import { colourStep } from "./song";

type Sig = {
  add(x: unknown): Sig;
  mul(x: unknown): Sig;
  mask(x: unknown): Sig;
  inside(n: number, f: (p: Sig) => Sig): Sig;
  late(x: unknown): Sig;
  slow(x: number): Sig;
  fmap(f: (x: number) => unknown): Sig;
  appLeft(x: unknown): Sig;
  query(state: { span: { begin: unknown; end: unknown } }): unknown[];
  queryArc(begin: number, end: number): { value: unknown }[];
};
type Strudel = {
  Pattern: new (query: Sig["query"]) => Sig;
  s(pattern: unknown): Sig;
  stack(...patterns: unknown[]): Sig;
  seq(...steps: unknown[]): Sig;
  palette: { swing: Sig; root: Sig; colour: Sig; bells: Sig; lead: Sig };
  broth: { scale: Sig };
};

export const HELPER_DOCS: Record<string, string> = {
  swell: "swell(value, from, to, level): silent until the signal passes 'from', at full 'level' from 'to' on; for parts the room brings in, like swell(broth.energy, 0.45, 0.75, 0.3)",
  part: "part(weight, level): a region's own part, at full 'level' once its region has two thirds of the weight, like .gain(part(genre.dubTechno, 0.09))",
  chosen: "chosen(weight, level): a layer the track chose (palette.pulse, backbeat, perc, bassRoll, lead, keys), at full 'level' from two thirds of its weight and never under half of it, like .gain(chosen(share('lead', 'psy'), 0.07))",
  share: "share(knob, ...settings): how much of the pot is in genres whose tracks may play one of these settings of a palette knob (presets.ts), 0 … 1, the names in single quotes; the weight of a layer the track chose, like chosen(share('bassRoll', 'roller'), 0.12)",
  here: "here(weight): true where a weight is above 0.02; .mask(here(genre.lofi)) leaves out notes that can't be heard",
  only: "only(when, pattern): pattern.mask(when), but without any work in the bars where 'when' is false, so a layer the track didn't choose costs nothing; for a choice that holds for whole bars, like only(palette.pulse.fmap(p => p === 2), kick)",
  kit: 'kit(dusty, clean): the dusty sample kit, or a clean drum machine in the melody style, like kit("bd:3 ~ ~ ~", "808bd:3 ~ ~ ~")',
  swung: "swung(pattern): the kit's shared swing, the track's own (palette.swing: nearly straight, light or heavy); give every drum part the same",
  atLeast: "atLeast(value, least): a 0 … 1 level that macro.steady lifts to at least 'least', so lo-fi keeps its whole beat in a calm room",
  unless: "unless(weight, share): 1, falling to 1 - share as the weight (a macro, say) reaches two thirds; for parts that step back there, like .mul(unless(macro.muted, 0.8))",
  beside: "beside(weight, playing): 1, but 0 where the weight is 1 while 'playing' (a 0 … 1 signal) is 1; for a melody that steps aside for another, like beside(macro.focus, form.theme)",
  unlessLofi: "unlessLofi(share): 1, falling to 1 - share where the pot is in lo-fi; for parts lo-fi has no room for",
  unlessPsy: "unlessPsy(share): 1, falling to 1 - share where the pot is in psychill; for the beat and bass psychill plays its own way",
  unlessHouse: "unlessHouse(share): 1, falling to 1 - share where the pot is in deep house; for the tones deep house leaves out, so its beat carries it",
  melodic: "melodic(level): how far the melody style's lead plays, at full 'level' where that style leads; 0 beside a bell motif where the music carries one melody (macro.focus) and beside any lead the track chose (palette.lead)",
  besideLofi: "besideLofi(playing): 1, but 0 in lo-fi while 'playing' (a 0 … 1 signal) is 1; lo-fi carries one melody at a time",
  coloured: "coloured(steps): scale steps over the track's chords, with the sharps and flats a coloured chord asks for (a dominant on V in minor, a borrowed minor iv); last before n(...), on steps with the root already added, like n(coloured(chord.add(palette.root)))",
};
export const HELPER_NAMES = Object.keys(HELPER_DOCS);

export function courseHelpers(
  genre: Record<string, unknown>,
  style: Record<string, unknown>,
  macro: Record<string, unknown>,
  shareOf: (knob: string, settings: string[]) => unknown,
  strudel: () => unknown,
) {
  const lofi = genre.lofi as Sig;
  const steady = macro.steady as Sig;
  const focus = macro.focus as Sig;
  const psy = genre.psychill as Sig;
  const house = genre.deepHouse as Sig;
  const melody = style.melody as Sig;
  const swell = (value: Sig, from: number, to: number, level: number) =>
    value.fmap((x) => (x <= from ? 0 : Math.min(1, (x - from) / (to - from)) * level));
  return {
    swell,
    part: (weight: Sig, level: number) => weight.fmap((w) => Math.min(1, w * 1.5) * level),
    chosen: (weight: Sig, level: number) => weight.fmap((w) => Math.max(0.5, Math.min(1, w * 1.5)) * level),
    here: (weight: Sig) => weight.fmap((w) => w > 0.02),
    share: (knob: unknown, ...settings: unknown[]) => {
      if ([knob, ...settings].some((x) => typeof x !== "string")) throw new Error("share takes its knob and settings in single quotes");
      return shareOf(knob as string, settings as string[]);
    },
    only: (when: Sig, pattern: Sig) => {
      const { Pattern } = strudel() as Strudel;
      const masked = pattern.mask(when);
      return new Pattern((state) => {
        const to = Math.ceil(Number(state.span.end));
        for (let bar = Math.floor(Number(state.span.begin)) - 1; bar < to; bar++)
          if (when.queryArc(bar, bar + 1).some((hap) => hap.value)) return masked.query(state);
        return [];
      });
    },
    kit: (dusty: unknown, clean: unknown) => {
      const { s, stack } = strudel() as Strudel;
      return stack(s(dusty).mask(melody.fmap((m) => m <= 0.5)), s(clean).mask(melody.fmap((m) => m > 0.5)));
    },
    swung: (pattern: Sig) => {
      const { seq, palette } = strudel() as Strudel;
      const late = palette.swing.fmap((i) => SWINGS[i] / 2).slow(4);
      return pattern.inside(4, (p) => p.late(seq(0, late)));
    },
    atLeast: (value: Sig, least: number) => value.add(steady.mul(least).mul(value.fmap((v) => 1 - v))),
    unless: (weight: Sig, share: number) => weight.fmap((w) => 1 - share * Math.min(1, w * 1.5)),
    beside: (weight: Sig, playing: unknown) => weight.mul(playing).fmap((x) => 1 - x),
    unlessLofi: (share: number) => lofi.fmap((w) => 1 - share * Math.min(1, w * 1.5)),
    unlessPsy: (share: number) => psy.fmap((w) => 1 - share * Math.min(1, w * 1.5)),
    unlessHouse: (share: number) => house.fmap((w) => 1 - share * Math.min(1, w * 1.5)),
    besideLofi: (playing: unknown) => lofi.mul(playing).fmap((x) => 1 - x),
    melodic: (level: number) => {
      const { palette } = strudel() as Strudel;
      const motif = palette.bells.fmap((b) => (b === 1 || b === 2 ? 1 : 0));
      return melody
        .fmap((m) => Math.min(1, m * 1.5) * level)
        .mul(focus.mul(motif).fmap((x) => 1 - x))
        .mul(palette.lead.fmap((l) => (l > 0 ? 0 : 1)));
    },
    coloured: (steps: Sig) => {
      const { palette, broth } = strudel() as Strudel;
      return steps
        .fmap((x) => (root: number) => (colour: number) => (scale: string) => colourStep(x, root, colour, scale))
        .appLeft(palette.root)
        .appLeft(palette.colour)
        .appLeft(broth.scale);
    },
  };
}
