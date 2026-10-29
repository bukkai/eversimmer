import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mock, test } from "node:test";
import type { WebSocket } from "ws";
import { RESTING_BROTH } from "../../shared/types";
import { LiveCoder, type Write } from "../src/coder";
import { POTS } from "../src/pots";
import type { Source } from "../src/source";
import { Table, type Shared } from "../src/table";
import type { Validator } from "../src/validate";

const weather: Source = {
  targets: () => RESTING_BROTH,
  ingredients: [],
  settle: () => false,
  reset: () => {},
  restAt: () => {},
  about: "the weather",
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

function cooks(table: Table, minutes: number) {
  let t = 0;
  let calls = 0;
  const write: Write = async () => {
    calls++;
    return null;
  };
  mock.timers.enable({ apis: ["setInterval"] });
  const pot = table.pot;
  const coder = new LiveCoder(write, true, {
    present: () => table.present,
    tides: () => pot.tides(),
    form: () => pot.state.form,
    cycle: () => pot.cycleNow(),
    broth: () => pot.state.broth,
    map: () => pot.state.map,
    cps: () => pot.cpsNow(),
    ingredients: () => [],
    digest: () => "",
    current: () => ({ code: pot.stone, key: pot.latestKey(), note: "", isStone: true }),
    stone: pot.stone,
    recipe: () => [],
    validate: async () => ({ ok: false, problems: [] }) as never,
    serve: () => {},
    now: () => t,
  });
  for (let s = 0; s < minutes * 60; s += 20) {
    t += 20_000;
    mock.timers.tick(20_000);
  }
  coder.close();
  mock.timers.reset();
  return calls;
}

test("in a pot without talk, the live coder cooks with a listener and not without", () => {
  const table = new Table({ id: "meander", name: "Meander", source: () => weather }, shared);
  try {
    assert.equal(table.present, 0);
    assert.equal(cooks(table, 20), 0);
    const ws = socket();
    table.join(ws);
    assert.equal(table.present, 1);
    assert.equal(table.pot.state.broth.voices, 1);
    assert.ok(cooks(table, 20) > 0);
    ws.emit("close");
    assert.equal(table.present, 0);
    assert.equal(table.pot.state.broth.voices, 0);
    assert.equal(cooks(table, 20), 0);
  } finally {
    table.close();
  }
});

test("in Potluck, a listener without a chair doesn't count, one with a chair does", () => {
  const table = new Table(POTS[0], shared);
  try {
    const ws = socket();
    table.join(ws);
    assert.equal(table.present, 0);
    assert.equal(cooks(table, 20), 0);
    table.receive(ws, { t: "hello", name: "tester" });
    assert.equal(table.present, 1);
    assert.ok(cooks(table, 20) > 0);
    assert.equal(table.pot.state.broth.voices, 1);
  } finally {
    table.close();
  }
});
