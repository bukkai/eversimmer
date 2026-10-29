import { randomUUID } from "node:crypto";
import { cpsAtCycle, cycleAt, nudgedCps, TEMPO_GLIDE_PER_MINUTE, timeAtCycle } from "../../shared/clock";
import {
  chooseSeam,
  endingOf,
  FORM_ALIGN,
  formUntil,
  nextSectionStart,
  nextTrack,
  outroCycles,
  paletteAt,
  planTrack,
  sectionAt,
  trackEnding,
  type Seam,
} from "../../shared/form";
import { choosePalette, homeKey, tidesAt, type Palette, type Tides } from "../../shared/palette";
import { AXES, brothFor, cpsAt, mapTarget, nearestRegions, REGIONS, seasonLean, weightsAt, type MapPosition } from "../../shared/map";
import { clamp } from "../../shared/numbers";
import { RECIPE_LENGTH, type ServerMessage } from "../../shared/protocol";
import { STONE } from "../../shared/stone";
import {
  BROTH_RANGES,
  MAX_VOICES,
  RESTING_BROTH,
  STILL_AIR,
  type Broth,
  type BrothKey,
  type Course,
  type PotMap,
  type PotState,
  type RecipeEntry,
} from "../../shared/types";
import type { MoodTargets, Source } from "./source";

const BROTH_HALF_LIFE_S = 60;

export const now = () => performance.timeOrigin + performance.now();

const TEMPO_LEAD_MS = 500;
const SWAP_LEAD_CYCLES = 2;
const SWAP_ALIGN_CYCLES = 4;
const MAX_TIME_SHIFT_MS = 400 * 24 * 60 * 60_000;
const TIDES_EVERY_MS = 30_000;
const FORM_LEAD_CYCLES = 4;
const MAP_HALF_LIFE_S = 150;
const THEME_CHANCE = 0.2;
const THEME_GAP_TRACKS = 2;
const THEME_AWAY_TRACKS = 3;
const JUMP_LEAD_CYCLES = 0.5;

type Goal = { at: MapPosition; broth: Omit<Broth, "voices"> };

export const KEPT_VERSION = 1;
export type Kept = {
  version: number;
  at: number;
  state: Omit<PotState, "pot" | "name" | "talk" | "ingredients">;
  baseCps: number;
  tracksSinceTheme: number;
  tracksAway: number;
  held?: Goal;
  jump?: Goal & { cycle: number };
};

export type PotName = { id: string; name: string };
export type PotMusic = { stone?: string };

export class Pot {
  readonly state: PotState;
  readonly stone: string;
  private lastTick = now();
  private lastSent: Broth;
  private baseCps: number;
  private mapSent: PotMap;
  private tracksSinceTheme = 0;
  private tracksAway = 0;
  private held: Goal | undefined;
  private jump: (Goal & { cycle: number }) | undefined;
  private timers: NodeJS.Timeout[];
  private tidesSent = -Infinity;
  private airSent = 0;

  constructor(
    { id, name, stone = STONE }: PotName & PotMusic,
    private source: Source,
    private broadcast: (msg: ServerMessage) => void,
    kept?: Kept,
  ) {
    const epoch = Math.floor(now());
    const broth = { ...RESTING_BROTH };
    const tides = source.tides?.(now()) ?? tidesAt(Date.now());
    const map = placeOnMap(seasonalTarget(broth, tides));
    this.baseCps = cpsAt(map.position);
    const cps = nudgedCps(this.baseCps, broth.energy);
    this.stone = stone;
    const course = { id: "stone", code: stone, startedAtCycle: 0, note: "the stone" };
    this.state = {
      pot: id,
      name,
      talk: source.talk !== undefined,
      stone,
      epoch,
      tempo: [{ cycle: 0, at: epoch, cps }],
      key: homeKey(tides),
      broth,
      map,
      form: planTrack(0, liveliness(broth), cps, map.position, { palette: choosePalette(tides, undefined), theme: true }),
      timeShift: 0,
      tides: source.tides && tides,
      air: source.air && { ...STILL_AIR },
      ingredients: source.ingredients,
      course,
      recipe: [{ id: course.id, at: epoch, note: course.note, code: stone, key: homeKey(tides), broth: { ...broth }, cps }],
    };
    if (kept) {
      try {
        this.carryOn(kept);
      } catch (err) {
        console.warn(`${id}: what it kept doesn't fit, starting afresh: ${err instanceof Error ? err.message : err}`);
      }
    }
    this.lastSent = { ...this.state.broth };
    this.mapSent = this.state.map;
    this.timers = [setInterval(() => this.tick(), 250), setInterval(() => this.simmer(), 1000)];
  }

  keep(): Kept {
    const { pot: _, name: __, talk: ___, ingredients: ____, ...state } = this.state;
    return {
      version: KEPT_VERSION,
      at: now(),
      state,
      baseCps: this.baseCps,
      tracksSinceTheme: this.tracksSinceTheme,
      tracksAway: this.tracksAway,
      held: this.held,
      jump: this.jump,
    };
  }

  private carryOn(kept: Kept) {
    if (kept.version !== KEPT_VERSION) throw new Error(`kept by version ${kept.version}, this is ${KEPT_VERSION}`);
    const saved = kept.state;
    if (!saved.tempo?.length || !saved.form || !saved.course || !saved.map?.position) throw new Error("parts are missing");
    const broth = { ...RESTING_BROTH, voices: 0 };
    for (const k of Object.keys(BROTH_RANGES) as BrothKey[])
      if (k !== "voices" && typeof saved.broth?.[k] === "number" && Number.isFinite(saved.broth[k])) broth[k] = saved.broth[k];
    const position = { ...this.state.map.position };
    for (const k of AXES) if (typeof saved.map.position[k] === "number") position[k] = clamp(saved.map.position[k]);
    const sameStone = saved.stone === this.stone;
    const tempo = saved.tempo;
    const cycle = cycleAt(tempo, now());
    const state: PotState = {
      ...this.state,
      epoch: saved.epoch,
      tempo,
      key: saved.key,
      broth,
      map: placeOnMap(position),
      timeShift: saved.timeShift ?? 0,
      course: sameStone ? saved.course : { id: "stone", code: this.stone, startedAtCycle: Math.floor(cycle), note: "the stone" },
      upcoming: sameStone ? saved.upcoming : undefined,
      recipe: (saved.recipe ?? []).slice(-RECIPE_LENGTH),
      form: saved.form,
    };
    Object.assign(this.state, state);
    this.baseCps = kept.baseCps;
    this.tracksSinceTheme = kept.tracksSinceTheme;
    this.tracksAway = kept.tracksAway;
    this.held = kept.held;
    this.jump = kept.jump;
    const knobs = (p: object | undefined) => Object.keys(p ?? {}).sort().join();
    const fresh = knobs(choosePalette(this.tides(), undefined));
    const last = saved.form[saved.form.length - 1];
    const playable = saved.form.every((s) => knobs(s.palette) === fresh);
    if (!playable || !last || last.cycle + last.length < cycle + FORM_LEAD_CYCLES)
      this.state.form = this.trackFrom(Math.floor(cycle), undefined);
  }

  close() {
    this.timers.forEach(clearInterval);
  }

  cycleNow() {
    return cycleAt(this.state.tempo, now());
  }

  cpsNow() {
    return cpsAtCycle(this.state.tempo, this.cycleNow());
  }

  setBroth(patch: Partial<Broth>) {
    const broth = this.state.broth;
    for (const [k, v] of Object.entries(patch) as [BrothKey, unknown][]) {
      if (!(k in BROTH_RANGES) || k === "voices" || typeof v !== "number" || !Number.isFinite(v)) continue;
      const [min, max] = BROTH_RANGES[k];
      broth[k] = clamp(v, min, max);
    }
    this.sendBroth();
  }

  rest() {
    this.source.reset();
    this.held = this.jump = undefined;
    const { voices: _, ...rest } = RESTING_BROTH;
    this.setBroth(rest);
    this.setMap(this.mapGoal());
  }

  jumpTo(regionId: string, now = false) {
    const region = REGIONS.find((r) => r.id === regionId);
    if (!region) return;
    const goal = { at: { ...region.at }, broth: brothFor(region) };
    const cycle = now ? this.newTrackNow(goal) : this.nextTrackSoon(goal);
    if (cycle !== undefined) this.jump = { ...goal, cycle };
  }

  private mapGoal() {
    return this.held?.at ?? seasonalTarget(this.state.broth, this.tides());
  }

  private sendBroth() {
    this.lastSent = { ...this.state.broth };
    this.broadcast({ t: "broth", broth: this.state.broth });
    this.retime();
  }

  private simmer() {
    const t = now();
    const dt = (t - this.lastTick) / 1000;
    easeBroth(this.state.broth, this.source.targets(t), dt);
    this.wander(dt);
    if (this.source.settle(t)) this.broadcast({ t: "ingredients", ingredients: this.source.ingredients });
    const air = this.state.air;
    const towards = this.source.air?.(t);
    if (air && towards) {
      air.fog += (towards.fog - air.fog) * (1 - 2 ** (-dt / BROTH_HALF_LIFE_S));
      if (Math.abs(air.fog - this.airSent) > 0.005) {
        this.airSent = air.fog;
        this.broadcast({ t: "air", air });
      }
    }
    if (this.source.tides && t - this.tidesSent >= TIDES_EVERY_MS) {
      this.tidesSent = t;
      this.state.tides = this.source.tides(t);
      this.broadcast({ t: "tides", tides: this.state.tides });
    }
    this.lastTick = t;
    const broth = this.state.broth;
    const moved = (Object.keys(broth) as BrothKey[]).some((k) => Math.abs(broth[k] - this.lastSent[k]) > 0.002);
    if (moved) this.sendBroth();
  }

  private wander(dt: number) {
    const target = this.mapGoal();
    const step = 1 - 2 ** (-dt / MAP_HALF_LIFE_S);
    const position = { ...this.state.map.position };
    for (const k of AXES) position[k] += (target[k] - position[k]) * step;
    this.state.map = placeOnMap(position);

    const goal = cpsAt(position);
    const glide = 1 + (TEMPO_GLIDE_PER_MINUTE * dt) / 60;
    this.baseCps = goal > this.baseCps ? Math.min(goal, this.baseCps * glide) : Math.max(goal, this.baseCps / glide);
    this.retime();

    const sent = this.mapSent;
    const map = this.state.map;
    if (map.region !== sent.region || map.towards !== sent.towards || AXES.some((k) => Math.abs(map.position[k] - sent.position[k]) > 0.01))
      this.sendMap();
  }

  setMap(patch: Partial<MapPosition>) {
    const position = { ...this.state.map.position };
    for (const k of AXES) {
      const v = patch[k];
      if (typeof v === "number" && Number.isFinite(v)) position[k] = clamp(v);
    }
    this.state.map = placeOnMap(position);
    this.baseCps = cpsAt(position);
    this.retime();
    this.sendMap();
  }

  private sendMap() {
    this.mapSent = this.state.map;
    this.broadcast({ t: "map", map: this.state.map });
  }

  setVoices(count: number) {
    this.state.broth.voices = Math.min(MAX_VOICES, count);
    this.sendBroth();
  }

  setKey(key: string) {
    this.state.key = key;
    this.broadcast({ t: "key", key });
  }

  latestCourse() {
    return this.state.upcoming ?? this.state.course;
  }

  latestKey() {
    return this.state.upcoming?.key ?? this.state.key;
  }

  scheduleCourse(code: string, note = "", key?: string, soon = false) {
    const phrase = Math.ceil((this.cycleNow() + SWAP_LEAD_CYCLES) / SWAP_ALIGN_CYCLES) * SWAP_ALIGN_CYCLES;
    const startedAtCycle = soon ? phrase : (nextSectionStart(this.state.form, this.cycleNow() + SWAP_LEAD_CYCLES) ?? phrase);
    const course: Course = { id: randomUUID(), code, startedAtCycle, note };
    if (key && key !== this.latestKey()) course.key = key;
    const entry: RecipeEntry = {
      id: course.id,
      at: now(),
      note,
      code,
      key: key ?? this.latestKey(),
      broth: { ...this.state.broth },
      cps: cpsAtCycle(this.state.tempo, startedAtCycle),
    };
    this.state.upcoming = course;
    this.state.recipe.push(entry);
    if (this.state.recipe.length > RECIPE_LENGTH) this.state.recipe.shift();
    this.broadcast({ t: "course", course, entry });
    return course;
  }

  private plan() {
    const cycle = this.cycleNow();
    let form = this.state.form.filter((s) => s.cycle + s.length > cycle);
    const lastGroove = [...form].reverse().find((s) => s.kind === "groove");
    const end = form.length ? form[form.length - 1].cycle + form[form.length - 1].length : Math.ceil(cycle / FORM_ALIGN) * FORM_ALIGN;
    if (!lastGroove || cycle >= lastGroove.cycle + lastGroove.length) {
      const opening = endingOf(form) ?? (form.length ? "drop" : undefined);
      form = [...form, ...this.planNext(end, opening, form[form.length - 1]?.palette)];
    }
    const changed = form.length !== this.state.form.length || form.some((s, i) => s !== this.state.form[i]);
    this.state.form = form;
    if (changed) this.broadcast({ t: "form", form });
  }

  wallNow() {
    return Date.now() + this.state.timeShift;
  }

  tides() {
    return this.source.tides?.(now()) ?? tidesAt(this.wallNow());
  }

  travel(ms: number) {
    this.state.timeShift = Math.min(MAX_TIME_SHIFT_MS, Math.max(0, ms));
    this.broadcast({ t: "timeShift", ms: this.state.timeShift });
    this.setKey(homeKey(this.tides()));
    this.setMap(this.mapGoal());
    this.newTrackNow();
  }

  private planNext(cycle: number, opening: Seam | undefined, previous: Palette | undefined, goal?: Goal) {
    const at = goal?.at ?? this.state.map.position;
    const cps = goal ? nudgedCps(cpsAt(at), goal.broth.energy) : this.cpsNow();
    const palette = this.nextPalette(previous, opening !== undefined && opening !== "gap", at);
    return planTrack(cycle, liveliness(goal?.broth ?? this.state.broth), cps, at, {
      opening,
      palette,
      theme: this.nextTheme(),
    });
  }

  private nextPalette(previous: Palette | undefined, joined: boolean, at = this.state.map.position) {
    return choosePalette(this.tides(), previous, weightsAt(at), Math.random, joined, this.source.lean?.(now()));
  }

  private nextTheme() {
    const w = weightsAt(this.state.map.position);
    const home = w.ambient + w.lofi;
    const comingHome = home > 0.6 && this.tracksAway >= THEME_AWAY_TRACKS;
    if (home < 0.4) this.tracksAway++;
    else if (home > 0.6) this.tracksAway = 0;
    const theme = comingHome || (this.tracksSinceTheme >= THEME_GAP_TRACKS && Math.random() < THEME_CHANCE);
    this.tracksSinceTheme = theme ? 0 : this.tracksSinceTheme + 1;
    return theme;
  }

  private dropSoon(goal?: Goal) {
    const start = Math.ceil(this.cycleNow() + FORM_LEAD_CYCLES);
    const drop = Math.ceil((start + 8) / FORM_ALIGN) * FORM_ALIGN;
    const build = Math.min(8, Math.floor((drop - start) / 2));
    const depth = Math.max(0.85, liveliness(this.state.broth));
    const kept = formUntil(this.state.form, start);
    this.state.form = [
      ...kept,
      { kind: "breakdown", cycle: start, length: drop - build - start, depth, palette: paletteAt(this.state.form, start - 1) },
      { kind: "build", cycle: drop - build, length: build, depth, palette: paletteAt(this.state.form, start - 1) },
      ...this.planNext(drop, "drop", sectionAt(this.state.form, start - 1)?.palette, goal).map((s) => ({
        ...s,
        depth: Math.max(s.depth, depth),
      })),
    ];
    this.broadcast({ t: "form", form: this.state.form });
    return drop;
  }

  nextTrackSoon(goal?: Goal): number | undefined {
    const at = this.state.map.position;
    const ending = chooseSeam(at, liveliness(this.state.broth));
    if (ending === "drop") return this.dropSoon(goal);
    const tail = outroCycles(ending, at);
    const next = Math.ceil((this.cycleNow() + FORM_LEAD_CYCLES + tail) / FORM_ALIGN) * FORM_ALIGN;
    const form = this.state.form;
    const last = form[form.length - 1];
    const coming = nextTrack(form, this.cycleNow())?.cycle ?? (last && last.cycle + last.length);
    const playing = sectionAt(form, next - tail - 1);
    if (coming !== undefined && coming <= next) {
      if (goal) {
        const kept = formUntil(form, coming);
        this.state.form = [...kept, ...this.planNext(coming, endingOf(kept), kept[kept.length - 1]?.palette, goal)];
        this.broadcast({ t: "form", form: this.state.form });
      }
      return coming;
    }
    if (!playing) return;
    const kept = formUntil(form, next - tail);
    this.state.form = [
      ...kept,
      ...trackEnding(next, ending, tail, playing.depth, playing.palette, at, liveliness(this.state.broth)),
      ...this.planNext(next, ending, playing.palette, goal),
    ];
    this.broadcast({ t: "form", form: this.state.form });
    this.retime();
    return next;
  }

  newTrackNow(goal?: Goal) {
    const start = Math.ceil((this.cycleNow() + SWAP_LEAD_CYCLES) / SWAP_ALIGN_CYCLES) * SWAP_ALIGN_CYCLES;
    const track = this.trackFrom(start, sectionAt(this.state.form, start - 1)?.palette, goal);
    this.state.form = [...formUntil(this.state.form, start), ...track];
    this.broadcast({ t: "form", form: this.state.form });
    this.retime();
    return start;
  }

  private trackFrom(start: number, previous: Palette | undefined, goal?: Goal) {
    const from = Math.floor(start / FORM_ALIGN) * FORM_ALIGN;
    return this.planNext(from, undefined, previous, goal)
      .filter((s) => s.cycle + s.length > start)
      .map((s) => (s.cycle < start ? { ...s, cycle: start, length: s.cycle + s.length - start } : s));
  }

  private retime() {
    const tempo = this.state.tempo;
    const at = Math.ceil(cycleAt(tempo, now() + TEMPO_LEAD_MS));
    const base = nudgedCps(this.baseCps, this.state.broth.energy);
    let next = tempo.filter((s) => s.cycle < at);
    const change = (cycle: number) => {
      const current = next[next.length - 1];
      const target = base * paletteAt(this.state.form, cycle).tempo;
      if (Math.abs(current.cps - target) / current.cps >= 0.003) next = [...next, { cycle, at: timeAtCycle(next, cycle), cps: target }];
    };
    change(at);
    const track = nextTrack(this.state.form, at);
    if (track) change(track.cycle);
    if (next.length === tempo.length && next.every((s, i) => s.cycle === tempo[i].cycle && s.cps === tempo[i].cps)) return;
    this.state.tempo = next;
    this.broadcast({ t: "tempo", tempo: next });
  }

  private tick() {
    const t = now();
    const jump = this.jump;
    if (jump && cycleAt(this.state.tempo, t) >= jump.cycle - JUMP_LEAD_CYCLES) {
      this.jump = undefined;
      this.held = jump;
      this.source.restAt(jump.broth);
      this.setBroth(jump.broth);
      this.setMap(jump.at);
    }
    const upcoming = this.state.upcoming;
    if (upcoming && cycleAt(this.state.tempo, t) >= upcoming.startedAtCycle) {
      this.state.course = upcoming;
      this.state.upcoming = undefined;
      if (upcoming.key) this.state.key = upcoming.key;
    }
    const tempo = this.state.tempo;
    let first = 0;
    while (first + 1 < tempo.length && tempo[first + 1].at <= t) first++;
    if (first > 0) this.state.tempo = tempo.slice(first);
    this.plan();
  }
}

function easeBroth(broth: Broth, targets: MoodTargets, dt: number) {
  const step = 1 - 2 ** (-dt / BROTH_HALF_LIFE_S);
  for (const [k, target] of Object.entries(targets) as [keyof MoodTargets, number][])
    broth[k] += (target - broth[k]) * step;
}

function seasonalTarget(b: Broth, tides: Tides): MapPosition {
  const target = mapTarget(b);
  const lean = seasonLean(tides.season);
  for (const k of AXES) target[k] = clamp(target[k] + lean[k]);
  return target;
}

const liveliness = (b: Pick<Broth, "energy" | "density">) => clamp(0.6 * b.energy + 0.4 * b.density);

function placeOnMap(position: MapPosition): PotMap {
  const [near, next] = nearestRegions(position);
  return { position, region: near.region.name, towards: next.region.name, share: near.share };
}
