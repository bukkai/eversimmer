import assert from "node:assert/strict";
import { test } from "node:test";
import { cpsAtCycle, cycleAt, timeAtCycle, type TempoSegment } from "../../shared/clock";

const tempo: TempoSegment[] = [
  { cycle: 0, at: 1000, cps: 0.5 },
  { cycle: 8, at: 1000 + 16_000, cps: 0.6 },
];

test("time and cycle convert back and forth, across a tempo change", () => {
  for (const cycle of [0, 3.25, 8, 11.5, 100]) assert.ok(Math.abs(cycleAt(tempo, timeAtCycle(tempo, cycle)) - cycle) < 1e-9);
});

test("a tempo change doesn't move the cycle position", () => {
  assert.equal(cycleAt(tempo, 1000 + 16_000), 8);
  assert.equal(cpsAtCycle(tempo, 7.99), 0.5);
  assert.equal(cpsAtCycle(tempo, 8), 0.6);
});
