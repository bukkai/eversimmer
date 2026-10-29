import assert from "node:assert/strict";
import { test } from "node:test";
import { clamp, round, seeded, weighted } from "../../shared/numbers";

test("seeded gives the same numbers for the same seed, in 0 … 1", () => {
  const a = seeded(42);
  const b = seeded(42);
  const xs = Array.from({ length: 100 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 100 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs.slice(0, 5), Array.from({ length: 5 }, seeded(43)));
});

test("weighted never draws an index without weight", () => {
  const random = seeded(7);
  for (let i = 0; i < 1000; i++) assert.notEqual(weighted([1, 0, 2], random), 1);
  assert.equal(weighted([0, 0, 5], random), 2);
});

test("clamp and round", () => {
  assert.equal(clamp(1.5), 1);
  assert.equal(clamp(-0.5), 0);
  assert.equal(clamp(-2, -1), -1);
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(round(0.12345), 0.123);
});
