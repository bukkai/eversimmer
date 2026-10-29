import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { sectionAt } from "../../shared/form";
import { RESTING_BROTH } from "../../shared/types";
import { KEPT_VERSION, Pot, type Kept } from "../src/pot";
import type { Source } from "../src/source";
import { Table, type Shared } from "../src/table";
import type { Validator } from "../src/validate";

const quiet: Source = {
  targets: () => RESTING_BROTH,
  ingredients: [],
  settle: () => false,
  reset: () => {},
  restAt: () => {},
  about: "a quiet room",
  rules: "Nothing comes in.",
  digest: () => "",
};
const NAME = { id: "test", name: "Test" };

function kept(stone?: string) {
  const pot = new Pot({ ...NAME, stone }, quiet, () => {});
  try {
    pot.scheduleCourse(`${pot.stone}\n// a course`, "a course", "F");
    return JSON.parse(JSON.stringify(pot.keep())) as Kept;
  } finally {
    pot.close();
  }
}

function away(k: Kept, ms: number): Kept {
  const state = { ...k.state, tempo: k.state.tempo.map((s) => ({ ...s, at: s.at - ms })) };
  return { ...k, at: k.at - ms, state };
}

test("a pot carries on from what it kept: the same clock, track, course and recipe", () => {
  const k = kept();
  const pot = new Pot(NAME, quiet, () => {}, k);
  try {
    assert.equal(pot.state.epoch, k.state.epoch);
    assert.deepEqual(pot.state.tempo, k.state.tempo);
    assert.deepEqual(pot.state.form, k.state.form);
    assert.deepEqual(pot.state.upcoming, k.state.upcoming);
    assert.deepEqual(pot.state.recipe, k.state.recipe);
    assert.equal(pot.state.key, k.state.key);
    assert.equal(pot.state.broth.voices, 0);
  } finally {
    pot.close();
  }
});

test("after a long time away the clock has run on, and a new track covers now without a gap", () => {
  const k = away(kept(), 60 * 60_000);
  const pot = new Pot(NAME, quiet, () => {}, k);
  try {
    const cycle = pot.cycleNow();
    assert.equal(pot.state.epoch, k.state.epoch);
    assert.ok(cycle > 60 * 60 * 0.3);
    const playing = sectionAt(pot.state.form, cycle);
    assert.ok(playing, "a track plays now");
    assert.ok(pot.state.form[0].cycle <= Math.floor(cycle));
  } finally {
    pot.close();
  }
});

test("with another stone, the stone takes over from the cycle the pot comes back on", () => {
  const k = kept("// an older stone\nsilence");
  const pot = new Pot(NAME, quiet, () => {}, k);
  try {
    assert.equal(pot.state.epoch, k.state.epoch);
    assert.equal(pot.state.course.code, pot.stone);
    assert.equal(pot.state.course.startedAtCycle, Math.floor(pot.cycleNow()));
    assert.equal(pot.state.upcoming, undefined);
  } finally {
    pot.close();
  }
});

test("what another version kept, or what doesn't read, lights the pot afresh", () => {
  const old = kept();
  const k = { ...old, state: { ...old.state, epoch: old.state.epoch - 60_000 } };
  for (const other of [{ ...k, version: KEPT_VERSION + 1 }, { ...k, state: { ...k.state, tempo: [] } }]) {
    const pot = new Pot(NAME, quiet, () => {}, other);
    try {
      assert.notEqual(pot.state.epoch, k.state.epoch);
      assert.equal(pot.state.course.code, pot.stone);
    } finally {
      pot.close();
    }
  }
});

test("a table keeps its pot in the folder when it closes, and the next one carries on from it", () => {
  const dir = mkdtempSync(join(tmpdir(), "kept-"));
  const shared: Shared = { validator: {} as Validator, client: undefined, devControls: false, liveCoder: false, keep: dir };
  try {
    const first = new Table({ ...NAME, source: () => quiet }, shared);
    const course = first.pot.scheduleCourse(`${first.pot.stone}
// a course`, "a course");
    first.close();
    const second = new Table({ ...NAME, source: () => quiet }, shared);
    try {
      assert.equal(second.pot.state.upcoming?.id, course.id);
    } finally {
      second.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
