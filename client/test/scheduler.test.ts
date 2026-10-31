import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import type { Hap, Pattern } from "@strudel/web";
import type { TempoSegment } from "../../shared/clock";
import type { SharedScheduler as Scheduler } from "../src/scheduler";

let now = 0;
Object.defineProperty(performance, "now", { value: () => now, configurable: true });
Object.assign(globalThis, { location: { pathname: "/", hostname: "localhost" }, document: { referrer: "" } });

let SharedScheduler: typeof Scheduler;
before(async () => {
  ({ SharedScheduler } = await import("../src/scheduler"));
  (await import("../src/net")).startClockAt(0);
});

const TICK_MS = 50;
const tempo: TempoSegment[] = [{ cycle: 0, at: 0, cps: 0.5 }];

function quarters(name: string) {
  const asked: [number, number][] = [];
  const pattern = {
    queryArc(begin: number, end: number) {
      asked.push([begin, end]);
      const haps = [];
      for (let q = Math.ceil(begin * 4); q < end * 4; q++)
        haps.push({ value: name, hasOnset: () => true, whole: { begin: q / 4, end: (q + 1) / 4 } });
      return haps;
    },
  };
  return { pattern: pattern as unknown as Pattern, asked };
}

let ctx: { state: AudioContextState; currentTime: number };
let played: { name: string; onset: number; at: number }[];

function scheduler() {
  const s = new SharedScheduler(
    ctx as unknown as AudioContext,
    () => tempo,
    (hap: Hap, _deadline, _duration, _cps, t) => played.push({ name: hap.value as string, onset: Number(hap.whole!.begin), at: t }),
    (_id, err) => assert.fail(String(err)),
  );
  const tick = () => (s as unknown as { tick(): void }).tick();
  const run = (ms: number) => {
    for (const end = now + ms; now < end; ) {
      now += TICK_MS;
      if (ctx.state === "running") ctx.currentTime += TICK_MS / 1000;
      tick();
    }
  };
  return { s, run };
}

beforeEach(() => {
  now = 0;
  ctx = { state: "running", currentTime: 0 };
  played = [];
});

test("every note plays once, in order, at the moment its cycle comes", () => {
  const { s, run } = scheduler();
  s.setCourse(0, "a", quarters("a").pattern);
  run(20_000);
  const onsets = played.map((p) => p.onset);
  assert.deepEqual(onsets, [...onsets].sort((x, y) => x - y));
  assert.equal(new Set(onsets).size, onsets.length, "no note twice");
  for (let q = 1; q < 36; q++) assert.ok(onsets.includes(q / 4), `the note at cycle ${q / 4}`);
  for (const p of played) assert.ok(Math.abs(p.at - p.onset * 2) < 1e-9, `${p.onset} at ${p.at}`);
});

test("a tick asks for half a cycle at a time, and only once what is scheduled runs out", () => {
  const { s, run } = scheduler();
  const { pattern, asked } = quarters("a");
  s.setCourse(0, "a", pattern);
  run(20_000);
  assert.ok(asked.length >= 18 && asked.length <= 24, `${asked.length} queries`);
  for (const [begin, end] of asked.slice(1)) assert.ok(end - begin >= 0.5 - 1e-9, `${begin} … ${end}`);
  for (let i = 1; i < asked.length; i++) assert.equal(asked[i][0], asked[i - 1][1], "each query starts where the last ended");
});

test("a new course takes over on its cycle, and the old one plays up to it", () => {
  const { s, run } = scheduler();
  s.setCourse(0, "a", quarters("a").pattern);
  run(2000);
  s.setCourse(3, "b", quarters("b").pattern);
  run(10_000);
  assert.ok(played.filter((p) => p.name === "a").every((p) => p.onset < 3));
  assert.ok(played.filter((p) => p.name === "b").every((p) => p.onset >= 3));
  assert.ok(played.some((p) => p.name === "b" && p.onset === 3));
  assert.equal(s.courseAt(2.9), "a");
  assert.equal(s.courseAt(3), "b");
});

test("after a pause, it picks up from now instead of playing what it missed", () => {
  const { s, run } = scheduler();
  s.setCourse(0, "a", quarters("a").pattern);
  run(4000);
  ctx.state = "suspended";
  const before = played.length;
  run(6000);
  assert.equal(played.length, before, "nothing while suspended");
  ctx.state = "running";
  run(4000);
  const after = played.slice(before);
  assert.ok(after.length > 0);
  assert.ok(after.every((p) => p.at >= ctx.currentTime - 4), "no notes from the pause");
  assert.ok(after.every((p) => p.onset >= 5), "nothing from the cycles that went by");
});

test("a tab that slept doesn't catch up, and the scheduler looks further ahead for a while", () => {
  const { s, run } = scheduler();
  s.setCourse(0, "a", quarters("a").pattern);
  run(2000);
  const before = played.length;
  now += 10_000;
  ctx.currentTime += 10;
  run(TICK_MS);
  const woke = played.slice(before);
  assert.ok(woke.every((p) => p.at >= ctx.currentTime), "nothing scheduled in the past");
  assert.ok(woke.every((p) => p.onset >= 6), "nothing from the ten seconds it slept");
  assert.ok(s.lookahead() > 200);
  run(120_000);
  assert.equal(s.lookahead(), 200, "and it eases back once things are calm");
});
