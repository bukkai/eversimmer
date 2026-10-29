import {
  getAudioContext,
  getSuperdoughAudioController,
  getTrigger,
  initAudio,
  initStrudel,
  noteToMidi,
  samples,
  setTime,
  signal,
  webaudioOutput,
  type Pattern,
} from "@strudel/web";
import { registerSoundfonts } from "@strudel/soundfonts";
import { cpsAtCycle, timeAtCycle, type TempoSegment } from "../../shared/clock";
import { formAt, paletteAt, type Section } from "../../shared/form";
import { courseGlobals } from "../../shared/globals";
import { styleWeights, tidesAt, trackKey } from "../../shared/palette";
import { mapTarget, weightsAt, type MapPosition } from "../../shared/map";
import { loadRegions } from "../../shared/regions";
import { loadScore } from "../../shared/score";
import { loadDrums } from "../../shared/drums";
import { DRUM_MACHINES_URL, levelOf } from "../../shared/sounds";
import { STONE } from "../../shared/stone";
import { foldValue, RESTING_BROTH, scaleFor, type Broth, type Course, type PotState } from "../../shared/types";
import { labelLayers, letThrough, type Layer } from "./layers";
import { serverNow } from "./net";
import { SharedScheduler } from "./scheduler";

const live: Broth = { ...RESTING_BROTH };
let position: MapPosition = mapTarget(RESTING_BROTH);
let form: Section[] = [];
let timeShift = 0;
let keys: { from: number; key: string }[] = [{ from: -Infinity, key: "D" }];
let master = 0.8;
let tempo: TempoSegment[] = [];
let epoch: number | undefined;

const keyAt = (cycle: number) => {
  let key = keys[0].key;
  for (const k of keys) if (k.from <= cycle) key = k.key;
  return key;
};
const trackKeyAt = (cycle: number) => trackKey(keyAt(cycle), paletteAt(form, cycle).fifths);

function setKeyFrom(cycle: number, key: string) {
  keys = [...keys.filter((k) => k.from < cycle), { from: cycle, key }];
  const now = scheduler?.cycleNow() ?? -Infinity;
  while (keys.length > 1 && keys[1].from <= now) keys.shift();
}

Object.assign(
  globalThis,
  courseGlobals(signal, {
    broth: () => live,
    scale: (cycle) => scaleFor(trackKeyAt(cycle), live.valence, weightsAt(position), paletteAt(form, cycle).parent),
    position: () => position,
    moment: (cycle) => formAt(form, cycle),
    palette: (cycle) => paletteAt(form, cycle),
    tides: () => tidesAt(wallNow()),
    style: () => styleWeights(tidesAt(wallNow())),
  }),
);

const ready = initStrudel({
  prebake: () =>
    Promise.all([
      samples("github:tidalcycles/dirt-samples"),
      samples("https://raw.githubusercontent.com/felixroos/dough-samples/main/piano.json"),
      samples(DRUM_MACHINES_URL),
      registerSoundfonts(),
    ]),
});
const library = ready.then(async (repl) => {
  await loadScore((code) => repl.evaluate(code, false));
  await loadDrums((code) => repl.evaluate(code, false));
  await loadRegions((code) => repl.evaluate(code, false));
  return repl;
});

let routed: GainNode | undefined;
let volume: GainNode | undefined;
let dull: BiquadFilterNode | undefined;
let worn: GainNode | undefined;
const OPEN_HZ = 20000;
const LOFI_HZ = 5500;
const WORN = 0.35;

function saturation(ctx: AudioContext) {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(2 * ((i / (curve.length - 1)) * 2 - 1)) / Math.tanh(2);
  return new WaveShaperNode(ctx, { curve, oversample: "2x" });
}

function lofiBus() {
  if (!dull || !worn) return;
  const lofi = weightsAt(position).lofi;
  const now = dull.context.currentTime;
  dull.frequency.setTargetAtTime(OPEN_HZ * (LOFI_HZ / OPEN_HZ) ** lofi, now, 1);
  worn.gain.setTargetAtTime(WORN * lofi, now, 1);
}

function masterBus(ctx: AudioContext) {
  const out = getSuperdoughAudioController().output.destinationGain;
  if (!out || out === routed) return;
  const glue = new DynamicsCompressorNode(ctx, { threshold: -22, knee: 12, ratio: 3, attack: 0.02, release: 0.3 });
  const makeup = new GainNode(ctx, { gain: 2 });
  const limiter = new DynamicsCompressorNode(ctx, { threshold: -3, knee: 0, ratio: 20, attack: 0.002, release: 0.1 });
  volume = new GainNode(ctx, { gain: master });
  dull = new BiquadFilterNode(ctx, { type: "lowpass", frequency: OPEN_HZ, Q: 0.5 });
  worn = new GainNode(ctx, { gain: 0 });
  out.disconnect();
  out.connect(dull).connect(glue);
  dull.connect(saturation(ctx)).connect(worn).connect(glue);
  glue.connect(makeup).connect(limiter).connect(volume).connect(ctx.destination);
  routed = out;
  lofiBus();
}

let scheduler: SharedScheduler | undefined;
const notes = new Map<string, string>();
const layers = new Map<string, Layer[]>();
let stoneCode = STONE;
let stonePattern: Pattern | undefined;
let evaluating = Promise.resolve();
const PATTERNS_KEPT = 6;
const patterns = new Map<string, Pattern>();

async function evaluate(repl: Awaited<typeof library>, code: string) {
  const kept = patterns.get(code);
  if (kept) {
    patterns.delete(code);
    patterns.set(code, kept);
    return kept;
  }
  const pattern: Pattern | undefined = await repl.evaluate(code, false);
  if (!pattern) return undefined;
  patterns.set(code, pattern);
  for (const old of patterns.keys()) if (patterns.size > PATTERNS_KEPT) patterns.delete(old);
  return pattern;
}

function forget() {
  const playing = scheduler?.ids();
  if (!playing) return;
  for (const id of notes.keys()) if (id !== "stone" && !playing.has(id)) notes.delete(id);
  for (const id of layers.keys()) if (id !== "stone" && !playing.has(id)) layers.delete(id);
}

export type EngineEvents = {
  onError?: (msg: string) => void;
  onBroken?: (course: string, error: string) => void;
  onAudio?: (running: boolean) => void;
};
let events: EngineEvents = {};

export async function startEngine(e: EngineEvents = {}) {
  events = e;
  const session = (navigator as { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";
  await initAudio();
  const repl = await library;
  const ctx = getAudioContext();
  masterBus(ctx);
  setInterval(() => {
    masterBus(ctx);
    lofiBus();
    forget();
  }, 2000);
  ctx.addEventListener("statechange", () => events.onAudio?.(ctx.state === "running"));
  addEventListener("visibilitychange", () => {
    if (!document.hidden && wanted && ctx.state !== "running") void ctx.resume().catch(() => {});
  });
  const trigger = getTrigger({ getTime: () => ctx.currentTime, defaultOutput: webaudioOutput });
  scheduler = new SharedScheduler(
    ctx,
    () => tempo,
    (hap, ...rest) => {
      if (!letThrough(hap.value)) return;
      const fade = formAt(form, Number(hap.whole.begin)).fade;
      if (fade <= 0.001) return;
      const value = foldValue(hap.value as { velocity?: number; s?: unknown; bank?: unknown }, noteToMidi);
      const scale = fade * levelOf(String(value.s ?? "").split(":")[0], value.bank === undefined ? undefined : String(value.bank));
      if (scale === 1 && value === hap.value) return trigger(hap, ...rest);
      trigger(hap.withValue(() => ({ ...value, velocity: (value.velocity ?? 1) * scale })), ...rest);
    },
    (id, err) => {
      console.error(err);
      events.onError?.(`course "${notes.get(id) ?? id}" broke while playing, back to the stone`);
      if (id !== "stone") events.onBroken?.(id, err instanceof Error ? err.message : String(err));
      if (stonePattern) scheduler!.setCourse(scheduler!.cycleNow(), "stone", stonePattern);
    },
  );
  setTime(() => scheduler!.cycleNow());
  await evaluateStone(repl);
  scheduler.start();
}

async function evaluateStone(repl: Awaited<typeof library>) {
  const stone = labelLayers(stoneCode);
  stonePattern = await evaluate(repl, stone.code);
  notes.set("stone", "the stone");
  layers.set("stone", stone.layers);
}

export const currentStone = () => stoneCode;

function useStone(code: string) {
  if (code === stoneCode) return;
  stoneCode = code;
  evaluating = evaluating.then(async () => {
    if (scheduler) await evaluateStone(await library);
  });
}

export function loadCourse(course: Course) {
  evaluating = evaluating.then(async () => {
    const repl = await library;
    const labelled = labelLayers(course.code);
    const pattern = course.code === stoneCode && stonePattern ? stonePattern : await evaluate(repl, labelled.code);
    if (pattern) {
      notes.set(course.id, course.note || "a new course");
      layers.set(course.id, labelled.layers);
      scheduler?.setCourse(course.startedAtCycle, course.id, pattern);
      if (course.key) setKeyFrom(course.startedAtCycle, course.key);
    } else {
      events.onError?.("the new course failed to evaluate, kept the current one");
      events.onBroken?.(course.id, "failed to evaluate");
      if (!scheduler?.courseAt(scheduler.cycleNow()) && stonePattern)
        scheduler?.setCourse(course.startedAtCycle, "stone", stonePattern);
    }
  });
  return evaluating;
}

export function applyState(state: PotState) {
  if (state.epoch !== epoch) scheduler?.reset();
  epoch = state.epoch;
  tempo = state.tempo;
  keys = [{ from: -Infinity, key: state.key }];
  Object.assign(live, state.broth);
  position = { ...state.map.position };
  form = state.form;
  timeShift = state.timeShift;
  useStone(state.stone ?? STONE);
  loadCourse({ ...state.course, key: undefined });
  if (state.upcoming) loadCourse(state.upcoming);
}

export const setTempo = (t: TempoSegment[]) => (tempo = t);
export const setBroth = (b: Broth) => Object.assign(live, b);
export const setTimeShift = (ms: number) => (timeShift = ms);
export const getTimeShift = () => timeShift;
export const wallNow = () => serverNow() + timeShift;
export const setForm = (f: Section[]) => (form = f);
export const getForm = (): readonly Section[] => form;
export const setMapPosition = (p: MapPosition) => (position = { ...p });
export const setKey = (k: string) => setKeyFrom(currentCycle(), k);
export function setVolume(v: number) {
  master = v;
  volume?.gain.setTargetAtTime(v, volume.context.currentTime, 0.02);
}

let wanted = true;
const FADE_S = 0.08;

export async function pauseEngine() {
  wanted = false;
  if (!volume) return;
  const ctx = volume.context as AudioContext;
  volume.gain.setTargetAtTime(0, ctx.currentTime, FADE_S / 3);
  await new Promise((r) => setTimeout(r, FADE_S * 1000 * 2));
  if (!wanted) await ctx.suspend();
}

export async function resumeEngine() {
  wanted = true;
  if (!volume) return false;
  const ctx = volume.context as AudioContext;
  try {
    await ctx.resume();
  } catch {}
  volume.gain.setValueAtTime(0, ctx.currentTime);
  volume.gain.setTargetAtTime(master, ctx.currentTime, FADE_S / 3);
  return ctx.state === "running";
}

export const straining = () => (scheduler?.lookahead() ?? 0) > 400;
export const lookahead = () => scheduler?.lookahead() ?? 0;

export const getBroth = (): Readonly<Broth> => live;
export const getKey = () => keyAt(currentCycle());
export const getTrackKey = () => trackKeyAt(currentCycle());
export const getScale = () =>
  scaleFor(getTrackKey(), live.valence, weightsAt(position), paletteAt(form, currentCycle()).parent);
export const currentCycle = () => scheduler?.cycleNow() ?? 0;
export const getCps = () => (tempo.length ? cpsAtCycle(tempo, currentCycle()) : 0);
export const currentCourse = () => scheduler?.courseAt(currentCycle());
export const currentLayers = (): readonly Layer[] => layers.get(scheduler?.courseAt(currentCycle()) ?? "") ?? [];
export const currentNote = () => notes.get(scheduler?.courseAt(currentCycle()) ?? "") ?? "";
export const secondsUntil = (cycle: number) => (timeAtCycle(tempo, cycle) - serverNow()) / 1000;
