import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import type { WebSocket } from "ws";
import { RESTING_BROTH } from "../../shared/types";
import { Breakage } from "../src/breakage";
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
const shared: Shared = { validator: {} as Validator, client: undefined, devControls: false, liveCoder: false };

function socket() {
  const ws = new EventEmitter() as EventEmitter & { readyState: number; send: () => void };
  ws.readyState = 1;
  ws.send = () => {};
  return ws as unknown as WebSocket;
}

function room(addresses: string[]) {
  const table = new Table({ id: "quiet", name: "Quiet", source: () => quiet }, shared);
  const sockets = addresses.map((from) => {
    const ws = socket();
    table.join(ws, from);
    return ws;
  });
  const a = table.pot.scheduleCourse(`s("bd*4")`, "course A");
  const b = table.pot.scheduleCourse(`s("hh*8")`, "course B");
  const broke = (i: number, course = b.id) => table.receive(sockets[i], { t: "broken", course, error: "boom" });
  const last = () => table.pot.state.recipe.at(-1)!;
  return { table, a, b, broke, last };
}

test("one person can't make the pot fall back, however many tabs or reports", () => {
  const { table, b, broke, last } = room(["1.1.1.1", "1.1.1.1", "1.1.1.1", "2.2.2.2"]);
  try {
    for (let i = 0; i < 5; i++) broke(0);
    broke(1);
    broke(2);
    assert.equal(last().id, b.id);
  } finally {
    table.close();
  }
});

test("listeners from two places make the pot fall back to the course before", () => {
  const { table, a, broke, last } = room(["1.1.1.1", "2.2.2.2"]);
  try {
    broke(0);
    broke(1);
    assert.equal(last().code, a.code);
    assert.match(last().note, /broke/);
    const length = table.pot.state.recipe.length;
    broke(1);
    assert.equal(table.pot.state.recipe.length, length);
  } finally {
    table.close();
  }
});

test("a course that broke is passed over, and with nothing good before it the pot goes to the stone", () => {
  const { table, broke, last } = room(["1.1.1.1", "2.2.2.2"]);
  try {
    broke(0);
    broke(1);
    const back = last();
    broke(0, back.id);
    broke(1, back.id);
    assert.equal(last().code, table.pot.stone);
  } finally {
    table.close();
  }
});

test("a report about a course the pot has already left changes nothing", () => {
  const { table, a, b, broke, last } = room(["1.1.1.1", "2.2.2.2"]);
  try {
    broke(0, a.id);
    broke(1, a.id);
    assert.equal(last().id, b.id);
  } finally {
    table.close();
  }
});

test("in a bigger room it takes a quarter of the places listening", () => {
  const breakage = new Breakage();
  assert.equal(breakage.report("x", "1", 12).fallBack, false);
  assert.equal(breakage.report("x", "2", 12).fallBack, false);
  assert.equal(breakage.report("x", "2", 12).fresh, false);
  assert.equal(breakage.report("x", "3", 12).fallBack, true);
  assert.equal(breakage.report("x", "4", 12).fallBack, false);
  assert.equal(breakage.broke("x"), true);
});
