import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { WebSocket } from "ws";
import { POTS_PATH, type Door, type Listings, type ServerMessage, type Sky } from "../../shared/protocol";
import { STONE } from "../../shared/stone";
import { RESTING_BROTH } from "../../shared/types";
import { POTS } from "../src/pots";
import { potServer } from "../src/server";
import type { Source } from "../src/source";
import { dressPage, REPOSITORY, serveSource } from "../src/static";
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
  soon: [{ name: "Later", line: "Still steeping." }],
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

test("a pot's page is dressed for its door, so a weather pot shows its sky from the first paint", () => {
  const html = readFileSync(new URL("../../client/index.html", import.meta.url), "utf8");
  const sky = dressPage(html, { name: "Quiet <b>", talk: false, devControls: false, sky: SKY });
  assert.match(sky, /<section id="door" hidden>/);
  assert.match(sky, /<section id="listen">/);
  assert.match(sky, /<h1 id="listen-place">Nowhere</);
  assert.match(sky, /<title>Eversimmer FM · Quiet &lt;b&gt;</);
  const door = sky.match(/<script id="door-data" type="application\/json">(.*?)<\/script>/)?.[1];
  assert.equal(JSON.parse(door ?? "").name, "Quiet <b>");
  assert.doesNotMatch(door ?? "", /<b>/);
  const chat = dressPage(html, { name: "Potluck", talk: true, devControls: false });
  assert.match(chat, /<section id="door">/);
  assert.match(chat, /<section id="listen" hidden>/);
  assert.match(dressPage(html, { name: "Quiet", talk: false, devControls: true, sky: SKY }), /<section id="door">/);
});

test("the front page lists the pots that play and those still to come", async () => {
  const pots = (await (await fetch(`http://${base}${POTS_PATH}`)).json()) as Listings;
  assert.deepEqual(pots.live.map((p) => p.id), ["potluck", "quiet"]);
  assert.equal(pots.live[0].line, POTS[0].line);
  assert.deepEqual(pots.soon, [{ name: "Later", line: "Still steeping." }]);
});

test("the source is on offer: the repository, at the commit the release plays", async () => {
  const served = await fetch(`http://${base}/source`, { redirect: "manual" });
  assert.equal(served.status, 302);
  assert.ok(served.headers.get("location")?.startsWith(REPOSITORY));
  const dir = mkdtempSync(join(tmpdir(), "release-"));
  const release = createServer((_, res) => serveSource(res, dir));
  await new Promise<void>((resolve) => release.listen(0, "127.0.0.1", resolve));
  const source = () => fetch(`http://127.0.0.1:${(release.address() as AddressInfo).port}/source`, { redirect: "manual" });
  try {
    assert.equal((await source()).headers.get("location"), REPOSITORY);
    writeFileSync(join(dir, "COMMIT"), "0123456789abcdef\n");
    assert.equal((await source()).headers.get("location"), `${REPOSITORY}/tree/0123456789abcdef`);
  } finally {
    release.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
