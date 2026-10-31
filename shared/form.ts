import { clamp } from "./numbers";
import { breathingAt, REGIONS, weightsAt, type MapPosition } from "./map";
import { BELLS, DEFAULT_PALETTE, KEY_ROLES, mutate, type Palette } from "./palette";

const SEAMS: Seam[] = ["gap", "mix", "drop"];

type SectionKind = "intro" | "groove" | "breakdown" | "build" | "outro";
export type Seam = "gap" | "mix" | "drop";

export type Section = {
  kind: SectionKind;
  opens?: boolean;
  cycle: number;
  length: number;
  depth: number;
  drop?: boolean;
  palette: Palette;
  blocks?: Block[];
  seam?: Seam;
  rest?: number;
};

type Block = {
  role?: number;
  bells?: number;
  hats: number;
  pad: number;
  bass: number;
  fill: number;
  theme?: number;
};

export const FILLS = ["no fill", "a snare fill", "a kick break", "a tom fill", "a noise swell"];
const BLOCK = 16;
const THEME_BARS = 4;
const THEME_EVERY = 8;

export const FORM_ALIGN = 16;
const DROP_CYCLES = 8;
const MIX_CYCLES = 8;

export type FormValues = {
  strip: number;
  lift: number;
  drop: number;
  gap: number;
  hats: number;
  pad: number;
  bass: number;
  fill: number;
  theme: number;
  intro: number;
  outro: number;
  bare: number;
  fade: number;
};

export const FORM_REST: FormValues = {
  strip: 0, lift: 0, drop: 0, gap: 0, hats: 1, pad: 1, bass: 0, fill: 0, theme: 0, intro: 0, outro: 0, bare: 0, fade: 1,
};

type FormSignals = FormValues & {
  beat: number;
  rush: number;
};
export const FORM_NAMES: (keyof FormSignals)[] = [
  "strip", "lift", "drop", "gap", "beat", "rush", "hats", "pad", "bass", "fill", "theme", "intro", "outro",
];

export const sectionAt = (form: Section[], cycle: number) =>
  form.find((s) => s.cycle <= cycle && cycle < s.cycle + s.length);

const blockIndex = (s: Section, cycle: number) => Math.floor(cycle / BLOCK) - Math.floor(s.cycle / BLOCK);
const blockAt = (s: Section, cycle: number) => s.blocks?.[blockIndex(s, cycle)];
const blockCount = (s: Section) => Math.ceil((s.cycle + s.length) / BLOCK) - Math.floor(s.cycle / BLOCK);

const RESTING = { role: 3, bells: 3 };

export function paletteAt(form: Section[], cycle: number): Palette {
  const s = sectionAt(form, cycle);
  if (!s) return DEFAULT_PALETTE;
  if (s.seam === "mix") return { ...s.palette, ...RESTING };
  const b = blockAt(s, cycle);
  return b
    ? mutate({ ...s.palette, role: b.role ?? s.palette.role, bells: b.bells ?? s.palette.bells, block: blockIndex(s, cycle) }, blockIndex(s, cycle))
    : s.palette;
}

export function blockInfo(form: Section[], cycle: number) {
  const s = sectionAt(form, cycle);
  const b = s && blockAt(s, cycle);
  return s?.blocks && b ? { index: blockIndex(s, cycle), count: s.blocks.length, block: b } : undefined;
}

export const nextTrack = (form: Section[], cycle: number) => form.find((s) => s.opens && s.cycle > cycle);

export function endingOf(form: Section[]): Seam | undefined {
  const last = form[form.length - 1];
  return !last ? undefined : last.kind === "build" ? "drop" : last.kind === "outro" ? last.seam : undefined;
}

export function formAt(form: Section[], cycle: number): FormValues {
  const s = sectionAt(form, cycle);
  if (!s) return FORM_REST;
  const p = cycle - s.cycle;
  switch (s.kind) {
    case "groove": {
      const b = blockAt(s, cycle);
      const bar = cycle % BLOCK;
      const fill = b && bar >= BLOCK - 1 && (b.fill !== 2 || bar % 1 >= 0.5) ? b.fill : 0;
      return {
        ...FORM_REST,
        drop: s.drop ? s.depth * Math.max(0, 1 - p / DROP_CYCLES) ** 2 : 0,
        ...(b && { hats: b.hats, pad: b.pad, bass: b.bass }),
        fill,
        theme: b?.theme && bar % THEME_EVERY < THEME_BARS ? 1 : 0,
      };
    }
    case "breakdown":
      return { ...FORM_REST, strip: s.depth * Math.min(1, p) };
    case "build":
      return {
        ...FORM_REST,
        strip: s.depth,
        lift: s.depth * (p / s.length) ** 1.5,
        gap: s.depth > 0.6 && p >= s.length - 0.25 ? 1 : 0,
      };
    case "intro":
      return s.seam === "gap" ? { ...FORM_REST, intro: 1, strip: 1, bare: 1 } : { ...FORM_REST, intro: 1 };
    case "outro": {
      const outro = p / s.length;
      const pad = outro < 0.5 ? 1 : 0;
      if (s.seam !== "gap") return { ...FORM_REST, outro, pad };
      const half = s.length / 2;
      const rest = s.rest ?? 0.5;
      const fade = clamp((s.length - rest - p) / (half - rest));
      return { ...FORM_REST, outro, hats: 0, pad, strip: p < half ? 0 : 1, bare: p < half ? 0 : 1, fade: fade * fade };
    }
  }
}

type TrackPlan = {
  opening?: Seam;
  palette: Palette;
  theme?: boolean;
};

export function chooseSeam(at: MapPosition, liveliness: number, random = Math.random): Seam {
  const w = weightsAt(at);
  const seams = { gap: 0, mix: 0, drop: 0 };
  for (const r of REGIONS) for (const k of SEAMS) seams[k] += w[r.id] * r.seams[k];
  seams.drop *= 0.5 + liveliness;
  let pick = random() * (seams.gap + seams.mix + seams.drop);
  return SEAMS.find((k) => (pick -= seams[k]) < 0) ?? "gap";
}

export const outroCycles = (ending: "gap" | "mix", at: MapPosition) =>
  ending === "mix" ? MIX_CYCLES : breathingAt(at) > 0.5 ? 8 : 4;

export function trackEnding(
  end: number,
  ending: Seam,
  tail: number,
  depth: number,
  palette: Palette,
  at: MapPosition,
  liveliness: number,
  random = Math.random,
): Section[] {
  if (ending === "drop") {
    const build = liveliness > 0.5 ? tail / 2 : 4;
    return [
      { kind: "breakdown", cycle: end - tail, length: tail - build, depth, palette },
      { kind: "build", cycle: end - build, length: build, depth, palette },
    ];
  }
  const rest = ending === "gap" ? { rest: (1 + Math.round(random()) + 2 * Math.round(breathingAt(at))) / 4 } : {};
  return [{ kind: "outro", cycle: end - tail, length: tail, depth, palette, seam: ending, ...rest }];
}

export function planTrack(
  cycle: number,
  liveliness: number,
  cps: number,
  at: MapPosition,
  { opening, palette, theme = false }: TrackPlan,
  random = Math.random,
): Section[] {
  const round = (x: number) => Math.max(FORM_ALIGN, Math.round(x / FORM_ALIGN) * FORM_ALIGN);
  const w = weightsAt(at);
  let [shortest, longest] = [0, 0];
  for (const r of REGIONS) {
    shortest += w[r.id] * r.minutes[0];
    longest += w[r.id] * r.minutes[1];
  }
  const ending = chooseSeam(at, liveliness, random);
  const minutes = shortest + (longest - shortest) * random();
  let total = round(minutes * 60 * cps);
  const intro = opening === "mix" ? MIX_CYCLES : opening === "gap" ? [0, 4, 4, 8][Math.floor(random() * 4)] : 0;
  const tail = ending === "drop" ? (liveliness > 0.5 && total >= 96 ? 32 : 16) : outroCycles(ending, at);
  total = Math.max(total, round(intro + tail + FORM_ALIGN));
  const groove = total - intro - tail;
  const depth = Math.min(1, Math.max(0.3, 0.3 + 0.7 * liveliness + 0.2 * (random() - 0.5)));
  const g: Section = { kind: "groove", cycle: cycle + intro, length: groove, depth, drop: opening === "drop", palette };
  g.blocks = arrange(blockCount(g), palette, liveliness, random);
  if (theme) g.blocks[0].theme = 1;
  const sections: Section[] = [
    ...(intro ? [{ kind: "intro" as const, cycle, length: intro, depth, palette, seam: opening }] : []),
    g,
    ...trackEnding(cycle + total, ending, tail, depth, palette, at, liveliness, random),
  ];
  sections[0].opens = true;
  return sections;
}

function arrange(count: number, palette: Palette, liveliness: number, random: () => number): Block[] {
  const pick = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)];
  const other = (n: number, of: number) => pick([...Array(of).keys()].filter((i) => i !== n));
  const fillWeights = [0.15, 0.2 + 0.5 * liveliness, 0.35, 0.15 + 0.3 * liveliness, 0.25];
  const fill = () => {
    let r = random() * fillWeights.reduce((a, b) => a + b, 0);
    return Math.max(0, fillWeights.findIndex((w) => (r -= w) < 0));
  };
  const moves: ((b: Block) => void)[] = [
    (b) => (b.role = palette.role === 3 ? 0 : 3),
    (b) => (b.role = other(palette.role === 3 ? 0 : palette.role, KEY_ROLES.length - 1)),
    (b) => (b.bells = palette.bells === 3 ? pick([0, 1, 2]) : other(palette.bells, BELLS.length)),
    (b) => (b.hats = 0),
    (b) => (b.pad = 0),
    (b) => (b.bass = 1),
  ];
  return [...Array(count).keys()].map((i) => {
    const b: Block = { hats: 1, pad: 1, bass: 0, fill: fill() };
    if (i > 0) for (let m = random() < 0.4 ? 2 : 1; m > 0; m--) pick(moves)(b);
    if (i === count - 1 && count > 2) random() < 0.5 ? (b.hats = 0) : (b.pad = 0);
    if ((b.role ?? palette.role) === 3 && (b.bells ?? palette.bells) === 3) b.bells = 0;
    return b;
  });
}

export function formUntil(form: Section[], cycle: number): Section[] {
  return form.filter((s) => s.cycle < cycle).map((s) => (s.cycle + s.length > cycle ? { ...s, length: cycle - s.cycle } : s));
}

export function nextSectionStart(form: Section[], cycle: number) {
  return form.map((s) => s.cycle).find((c) => c >= cycle);
}

function formHere(v: FormValues, at: MapPosition): FormSignals {
  const w = weightsAt(at);
  let arc = 0;
  let rush = 0;
  for (const r of REGIONS) {
    arc += w[r.id] * r.arc;
    rush += w[r.id] * r.rush;
  }
  const strip = v.bare ? v.strip : v.strip * arc;
  const lift = v.lift * arc;
  return {
    ...v,
    strip,
    lift,
    drop: v.drop * arc,
    gap: arc > 0.6 ? v.gap : 0,
    beat: 1 - strip + strip * lift,
    rush: lift * rush,
  };
}

export function formSignals<P>(
  signal: (fn: (t: number) => number) => P,
  moment: (cycle: number) => FormValues,
  position: () => MapPosition,
) {
  return Object.fromEntries(
    FORM_NAMES.map((k) => [k, signal((t) => formHere(moment(Number(t)), position())[k])]),
  ) as Record<keyof FormSignals, P>;
}
