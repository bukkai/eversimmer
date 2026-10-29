import assert from "node:assert/strict";
import { after, test } from "node:test";
import { STONE } from "../../shared/stone";
import { Validator } from "../src/validate";

const validator = new Validator();
after(() => validator.close());

const refused = async (code: string, because: RegExp) => {
  const verdict = await validator.validate(code, "D");
  assert.equal(verdict.ok, false, `passed: ${code}`);
  if (!verdict.ok) assert.ok(verdict.problems.some((p) => because.test(p)), `for other reasons: ${verdict.problems.join("; ")}`);
};

test("the stone passes", async () => {
  const verdict = await validator.validate(STONE, "D");
  assert.ok(verdict.ok, verdict.ok ? "" : verdict.problems.join("; "));
});

test("code that reaches out of the pattern language is refused before it runs", async () => {
  await refused(`fetch("https://example.com"); s("bd")`, /fetch/);
  await refused(`const x = s("bd"); x.constructor.constructor("return this")(); x`, /constructor/);
  await refused(`globalThis.document; s("bd")`, /globalThis/);
  await refused(`const f = s; f["constructor"]; s("bd")`, /constructor/);
  await refused(`while (true) {}; s("bd")`, /while/);
  await refused(`var x = s("bd"); x`, /var/);
});

const beat = (gain: number) =>
  `s("bd*4").lpf(broth.warmth.range(800, 4000)).pan(broth.valence.range(0.4, 0.6)).room(broth.texture.mul(0.3)).gain(${gain})`;

test("a small course of our own passes", async () => {
  const verdict = await validator.validate(beat(0.8), "D");
  assert.ok(verdict.ok, verdict.ok ? "" : verdict.problems.join("; "));
});

test("a course that makes no sound is refused", async () => {
  await refused(beat(0), /no sound|silent/);
});

test("a course that is far too loud is refused", async () => {
  await refused(beat(3).replace('"bd*4"', '"[bd,bd,bd]*4"'), /loud/);
});

test("a course may read the macros and play the score's roles", async () => {
  const verdict = await validator.validate(
    `stack(s("bd*4").lpf(macro.drive.range(900, 2400)).asLow(macro.drive.range(0.2, 0.5)), s("~ sd").asBeat(macro.busy.mul(0.3)), s("hh*8").late(macro.drag.range(0, 0.03)).asHats(0.1), n("[0,4]").scale(broth.scale).s("sine").gain(0.05))`,
    "D",
  );
  assert.ok(verdict.ok, verdict.ok ? "" : verdict.problems.join("; "));
});

test("a macro that doesn't exist is refused", async () => {
  await refused(`s("bd*4").gain(macro.loudness.range(0.2, 0.5))`, /macro\.loudness/);
});
