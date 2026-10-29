import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { WebSocket } from "ws";
import type { Door, ServerMessage, Sky } from "../../shared/protocol";
import { STONE } from "../../shared/stone";
import { RESTING_BROTH } from "../../shared/types";
import { POTS } from "../src/pots";
import { potServer } from "../src/server";
import type { Source } from "../src/source";
import { REPOSITORY, serveSource } from "../src/static";
import { MAX_PER_PLACE } from "../src/table";
import { Validator } from "../src/validate";

const SKY: Sky = {
  place: "Nowhere",
  timeZone: "UTC",
  at: Date.UTC(2026, 9, 29, 12),
  pace: 1,
  weather: { conditions: "light rain", code: 61, cloud: 90, precipitation: 0.4, wind: 10, day: 1 },
  credit: { name: "Open-Meteo.com", url: "https://open-meteo.com/" },
};
const quiet: Source = {
  sky: () => SKY,
  targets: () => RESTING_BROTH,
  ingredients: [],
  settle: () => false,
  reset: () => {},
  restAt: () => {},
  about: "a quiet room",
  rules: "Nothing comes in.",
  digest: () => "",
};

const QUIET_STONE = `const hum = n("[0,4]").scale(broth.scale).s("sine").lpf(broth.warmth.range(1200, 500)).gain(0.05)
hum`;

const validator = new Validator();
const server = potServer({
  pots: [POTS[0], { id: "quiet", name: "Quiet", source: () => quiet, stone: QUIET_STONE }],
  validator,
  client: undefined,
  devControls: false,
  liveCoder: false,
});
let base = "";
before(() => new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", () => {
  base = `127.0.0.1:${(server.http.address() as AddressInfo).port}`;
  resolve();
})));
after(() => {
  server.close();
  validator.close();
});

async function listen(path: string) {
  const ws = new WebSocket(`ws://${base}${path}`);
  const heard: ServerMessage[] = [];
  ws.on("message", (data) => heard.push(JSON.parse(String(data))));
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  const until = async (t: ServerMessage["t"]) => {
    for (let i = 0; i < 100 && !heard.some((m) => m.t === t); i++) await new Promise((r) => setTimeout(r, 20));
    return heard.find((m) => m.t === t);
  };
  return { ws, heard, until };
}

test("each pot is at its own address, and /ws is the first", async () => {
  for (const [path, pot] of [["/ws", "potluck"], ["/ws/potluck", "potluck"], ["/ws/quiet", "quiet"]]) {
    const { ws, until } = await listen(path);
    const state = await until("state");
    assert.ok(state?.t === "state");
    assert.equal(state.state.pot, pot);
    assert.equal(state.state.talk, pot === "potluck");
    ws.close();
  }
});

test("each pot simmers its own stone, or the stone", async () => {
  for (const [path, stone] of [["/ws/potluck", STONE], ["/ws/quiet", QUIET_STONE]]) {
    const { ws, until } = await listen(path);
    const state = await until("state");
    assert.ok(state?.t === "state");
    assert.equal(state.state.stone, stone);
    assert.equal(state.state.course.code, stone);
    assert.equal(state.state.recipe[0].code, stone);
    ws.close();
  }
});

test("an address without a pot is refused", async () => {
  await assert.rejects(listen("/ws/nowhere"));
});

test("nothing a listener sends brings the server down", async () => {
  for (const raw of ["null", "42", "[]", '"ping"', '{"t":7}', "{", "x".repeat(70 * 1024)]) {
    const { ws } = await listen("/ws/quiet");
    ws.on("error", () => {});
    const closed = new Promise((r) => ws.once("close", r));
    ws.send(raw);
    if (raw.length > 1024) await closed;
    else ws.close();
  }
  const { ws, until } = await listen("/ws/quiet");
  ws.send(JSON.stringify({ t: "ping", id: 1 }));
  assert.ok(await until("pong"));
  ws.close();
});

test("one place is one voice, and takes only so many connections", async () => {
  const quiet = server.tables.get("quiet")!;
  for (let i = 0; i < 100 && quiet.listeners > 0; i++) await new Promise((r) => setTimeout(r, 20));
  const tabs = [];
  for (let i = 0; i < MAX_PER_PLACE; i++) tabs.push(await listen("/ws/quiet"));
  assert.equal(quiet.listeners, MAX_PER_PLACE);
  assert.equal(quiet.pot.state.broth.voices, 1);
  const one = new WebSocket(`ws://${base}/ws/quiet`);
  const code = await new Promise((r) => one.once("close", r));
  assert.equal(code, 1008);
  assert.equal(quiet.listeners, MAX_PER_PLACE);
  for (const tab of tabs) tab.ws.close();
});

test("talk stays in its pot, and a pot without talk ignores it and its names", async () => {
  const potluck = await listen("/ws/potluck");
  const quietRoom = await listen("/ws/quiet");
  for (const room of [potluck, quietRoom]) room.ws.send(JSON.stringify({ t: "hello", name: "tester" }));
  await potluck.until("welcome");
  potluck.ws.send(JSON.stringify({ t: "say", text: "hello pot" }));
  quietRoom.ws.send(JSON.stringify({ t: "say", text: "hello quiet" }));
  const line = await potluck.until("chat");
  assert.ok(line?.t === "chat" && line.line.text === "hello pot");
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(quietRoom.heard.some((m) => m.t === "chat"), false);
  assert.equal(quietRoom.heard.some((m) => m.t === "welcome"), false);
  assert.ok(quietRoom.heard.every((m) => m.t !== "presence" || m.people.length === 0));
  const presence = potluck.heard.filter((m) => m.t === "presence").at(-1);
  assert.ok(presence?.t === "presence" && presence.people.length === 1);
  potluck.ws.close();
  quietRoom.ws.close();
});

test("a pot under a sky shows it at its door and on connect, and a chat pot has none", async () => {
  const door = (await (await fetch(`http://${base}/door/quiet`)).json()) as Door;
  assert.deepEqual(door, { name: "Quiet", talk: false, devControls: false, sky: SKY });
  const home = (await (await fetch(`http://${base}/door`)).json()) as Door;
  assert.equal(home.name, "Potluck");
  assert.equal(home.talk, true);
  assert.equal(home.sky, undefined);
  assert.notEqual((await fetch(`http://${base}/door/nowhere`)).status, 200);
  const { ws, until } = await listen("/ws/quiet");
  const sky = await until("sky");
  assert.ok(sky?.t === "sky");
  assert.deepEqual(sky.sky, SKY);
  ws.close();
});

test("the page is served at a pot's address, and health lists every pot", async () => {
  const health = (await (await fetch(`http://${base}/health`)).json()) as { pots: { pot: string }[] };
  assert.deepEqual(health.pots.map((p) => p.pot), ["potluck", "quiet"]);
  assert.notEqual((await fetch(`http://${base}/nowhere`)).status, 200);
});

test("the source is on offer: the release's own archive, or the repository", async () => {
  const served = await fetch(`http://${base}/source`, { redirect: "manual" });
  assert.ok([200, 302].includes(served.status));
  await served.body?.cancel();
  const dir = mkdtempSync(join(tmpdir(), "release-"));
  const release = createServer((_, res) => serveSource(res, dir));
  await new Promise<void>((resolve) => release.listen(0, "127.0.0.1", resolve));
  const source = () => fetch(`http://127.0.0.1:${(release.address() as AddressInfo).port}/source`, { redirect: "manual" });
  try {
    const away = await source();
    assert.equal(away.status, 302);
    assert.equal(away.headers.get("location"), REPOSITORY);
    writeFileSync(join(dir, "source.tar.gz"), "archive");
    writeFileSync(join(dir, "COMMIT"), "0123456789abcdef\n");
    const res = await source();
    assert.equal(await res.text(), "archive");
    assert.equal(res.headers.get("content-length"), "7");
    assert.match(res.headers.get("content-disposition") ?? "", /eversimmer-0123456789ab\.tar\.gz/);
  } finally {
    release.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
