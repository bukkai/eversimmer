import assert from "node:assert/strict";
import { test } from "node:test";
import { STONE } from "../../shared/stone";
import { difference, splice } from "../src/splice";

const course = (() => {
  let code = STONE;
  for (const edit of [
    {
      parts: ['// a softer hiss, further back\nconst dust = s("pink").attack(1).release(1).hpf(5000).gain(broth.warmth.range(0.003, 0.008))'],
      remove: [],
      final: STONE.slice(STONE.lastIndexOf("\nstack(") + 1),
    },
    {
      parts: ['const shaker = s("~ hh ~ hh").mask(here(genre.lofi)).hpf(7000).gain(part(genre.lofi, 0.03))'],
      remove: ["crackle"],
      final: STONE.slice(STONE.lastIndexOf("\nstack(") + 1).replace("crackle,", "shaker,"),
    },
  ]) {
    const spliced = splice(code, edit);
    assert.ok(spliced.ok, spliced.ok ? "" : spliced.problems.join("; "));
    code = spliced.code;
  }
  return code;
})();

test("the stone differs from itself in nothing but its final pattern", () => {
  const d = difference(STONE, STONE);
  assert.deepEqual(d && { parts: d.parts, remove: d.remove }, { parts: [], remove: [] });
});

test("a course's difference from the stone lists what changed, and only that", () => {
  const d = difference(STONE, course)!;
  assert.deepEqual(
    d.parts.map((p) => p.match(/const (\w+)/)![1]),
    ["dust", "shaker"],
  );
  assert.ok(d.parts[0].startsWith("// a softer hiss"), "a reworked part keeps its new comment");
  assert.deepEqual(d.remove, ["crackle"]);
  assert.ok(d.final.includes("shaker"));
});

test("the difference laid onto the stone gives the course back", () => {
  const spliced = splice(STONE, difference(STONE, course)!);
  assert.ok(spliced.ok);
  assert.equal(spliced.code, course);
});

test("code that is not a course has no difference", () => {
  assert.equal(difference(STONE, "s(\"bd\") + 1; const x = 2"), undefined);
});
