import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "acorn";
import { DRUM_PARTS } from "../../shared/drums";
import { REGION_PARTS } from "../../shared/regions";
import { SCORE, SCORE_NAMES } from "../../shared/score";
import { STONE } from "../../shared/stone";

const declarations = (code: string) => {
  const { body } = parse(code, { ecmaVersion: "latest" }) as unknown as { body: any[] };
  return new Map<string, string>(
    body.filter((s) => s.type === "VariableDeclaration").map((s) => [s.declarations[0].id.name, code.slice(s.start, s.end)]),
  );
};

test("the score gives every name it says it gives", () => {
  const declared = declarations(SCORE);
  for (const name of SCORE_NAMES) assert.ok(declared.has(name), `the score does not declare ${name}`);
});

const LIBRARIES = { regions: REGION_PARTS, drums: DRUM_PARTS };

test("no part of a library declares a name the stone, the score or another part uses otherwise", () => {
  const score = declarations(SCORE);
  const seen = declarations(STONE);
  const whose = new Map([...seen.keys()].map((n) => [n, "the stone"]));
  for (const [library, parts] of Object.entries(LIBRARIES))
    for (const [part, { code }] of Object.entries(parts))
      for (const [name, source] of declarations(code)) {
        assert.ok(!score.has(name), `${library}.${part} declares ${name}, which the score gives`);
        if (seen.has(name)) assert.equal(source, seen.get(name), `${library}.${part} declares ${name} otherwise than ${whose.get(name)}`);
        seen.set(name, source);
        whose.set(name, `${library}.${part}`);
      }
});

test("the stone plays every part of every library", () => {
  for (const [library, parts] of Object.entries(LIBRARIES))
    for (const part of Object.keys(parts)) assert.ok(STONE.includes(`${library}.${part}`), `the stone doesn't play ${library}.${part}`);
});

test("the stone doesn't declare what the score gives", () => {
  const stone = declarations(STONE);
  for (const name of SCORE_NAMES) assert.ok(!stone.has(name), `the stone declares ${name}, which the score gives`);
});
