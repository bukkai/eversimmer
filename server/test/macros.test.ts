import assert from "node:assert/strict";
import { test } from "node:test";
import { mapTarget, weightsAt } from "../../shared/map";
import { clamp } from "../../shared/numbers";
import { MACRO_NAMES, MACROS, macroSignals } from "../../shared/macros";
import { RESTING_BROTH, type Broth } from "../../shared/types";

const read = (broth: Broth, style = { tape: 1, melody: 0, gen: 0 }) =>
  macroSignals((fn) => fn, { broth: () => broth, style: () => style, position: () => mapTarget(broth) });

test("every macro says what it does and has a source", () => {
  for (const name of MACRO_NAMES) {
    assert.ok(MACROS[name].about.length > 10, name);
    assert.ok(Object.keys(MACROS[name].from).length > 0, name);
  }
});

test("a macro fed by one broth value with weight 1 is that value, exactly", () => {
  const broth = { ...RESTING_BROTH, energy: 0.37, density: 0.81, tension: 0.123456789 };
  const m = read(broth);
  assert.equal(m.drive(), 0.37);
  assert.equal(m.busy(), 0.81);
  assert.equal(m.drag(), 0.123456789);
});

test("a macro sums its weighted sources, the way the stone used to", () => {
  const m = read(RESTING_BROTH, { tape: 0.6, melody: 0.4, gen: 0 });
  const weights = (macroSignals((fn) => fn, { broth: () => RESTING_BROTH, style: () => ({ tape: 0, melody: 1, gen: 0 }), position: () => mapTarget(RESTING_BROTH) }).dust)();
  assert.ok(weights >= 0 && weights <= 0.15);
  assert.equal(m.dust(), 0.6 * 0.3 + weights);
});

test("a macro stays within 0 … 1", () => {
  const m = macroSignals((fn) => fn, {
    broth: () => ({ ...RESTING_BROTH, energy: 1.7, density: -0.4 }),
    style: () => ({ tape: 1, melody: 0, gen: 0 }),
    position: () => mapTarget(RESTING_BROTH),
  });
  assert.equal(m.drive(), 1);
  assert.equal(m.busy(), 0);
});

test("a macro fed by the genres is each preset's value by its genre's weight", () => {
  const broth = { ...RESTING_BROTH, energy: 0.6, texture: 0.4 };
  const weights = weightsAt(mapTarget(broth));
  const m = read(broth);
  assert.equal(m.wear(), clamp(weights.lofi));
  assert.ok(Math.abs(m.running() - (weights.lofi + weights.deepHouse)) < 1e-12);
  assert.ok(Math.abs(m.keys() - (weights.lofi + weights.downtempo + weights.ambient + weights.deepHouse + weights.softIdm)) < 1e-12);
});
