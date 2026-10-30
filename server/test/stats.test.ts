import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, mock, test } from "node:test";
import { report, siteOf, Stats } from "../src/stats";

let clock = Date.UTC(2026, 9, 30, 21, 0);
let dir = "";
beforeEach(() => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  clock = Date.UTC(2026, 9, 30, 21, 0);
  dir = mkdtempSync(join(tmpdir(), "stats-"));
});
afterEach(() => {
  mock.timers.reset();
  rmSync(dir, { recursive: true, force: true });
});
const wait = (ms: number) => {
  clock += ms;
  mock.timers.tick(ms);
};
const today = (stats: Stats) => stats.days().at(-1)!;

test("a place with several tabs is one place, and its visit ends when the last one goes", () => {
  const stats = new Stats(dir, () => clock);
  stats.arrive("10.0.0.1", "quiet", { userAgent: "Mozilla/5.0 (iPhone)", language: "nl-NL,nl;q=0.9,en;q=0.8", referrer: "www.example.org" });
  stats.arrive("10.0.0.1", "quiet");
  stats.arrive("10.0.0.2", "quiet", { language: "en-GB" });
  assert.equal(today(stats).places, 2);
  assert.equal(today(stats).peak, 2);
  assert.deepEqual(today(stats).devices, { mobile: 1, desktop: 1 });
  assert.deepEqual(today(stats).from, { "example.org": 1, direct: 1 });
  assert.deepEqual(today(stats).languages, { nl: 1, en: 1 });
  wait(20 * 60_000);
  stats.leave("10.0.0.1", "quiet");
  wait(20_000);
  assert.equal(today(stats).visits, 0, "one tab is still open");
  stats.leave("10.0.0.1", "quiet");
  stats.leave("10.0.0.2", "quiet");
  wait(20_000);
  assert.equal(today(stats).visits, 2);
  assert.equal(today(stats).stays["10–60 min"], 2);
  stats.stop();
});

test("a reload or a move between places carries the visit on", () => {
  const stats = new Stats(dir, () => clock);
  stats.arrive("10.0.0.1", "meander-seoul");
  wait(60_000);
  stats.leave("10.0.0.1", "meander-seoul");
  wait(1000);
  stats.arrive("10.0.0.1", "meander-seoul");
  stats.leave("10.0.0.1", "meander-seoul");
  wait(1000);
  stats.arrive("10.0.0.1", "meander-dublin");
  wait(5 * 60_000);
  stats.leave("10.0.0.1", "meander-dublin");
  wait(20_000);
  const day = today(stats);
  assert.equal(day.visits, 1);
  assert.equal(day.stays["1–10 min"], 1);
  assert.deepEqual(day.moves, { "meander-seoul → meander-dublin": 1 });
  assert.equal(day.pots["meander-seoul"].visits, 1);
  assert.equal(day.pots["meander-dublin"].visits, 1);
  stats.stop();
});

test("a finished day keeps its totals and nothing that leads back to anyone", () => {
  const stats = new Stats(dir, () => clock);
  stats.arrive("10.0.0.1", "quiet");
  stats.arrive("10.0.0.2", "quiet");
  stats.leave("10.0.0.2", "quiet");
  wait(4 * 3_600_000);
  const days = stats.days();
  assert.deepEqual(days.map((d) => d.day), ["2026-10-30", "2026-10-31"]);
  assert.equal(days[0].places, 2);
  assert.equal(days[1].places, 1, "listening across midnight is a place today too");
  const written = readFileSync(join(dir, "2026-10-30.json"), "utf8");
  assert.doesNotMatch(written, /10\.0\.0|salt|seen/);
  assert.ok(report(days).includes("2026-10-30"));
  stats.stop();
});

test("a restart carries the open day on without counting anyone twice", () => {
  const before = new Stats(dir, () => clock);
  before.arrive("10.0.0.1", "quiet");
  before.stop();
  const after = new Stats(dir, () => clock);
  after.arrive("10.0.0.1", "quiet");
  assert.equal(today(after).places, 1);
  assert.deepEqual(readdirSync(dir), ["open.json"]);
  after.stop();
});

test("a referrer is only ever a site's name", () => {
  assert.equal(siteOf("news.ycombinator.com"), "news.ycombinator.com");
  assert.equal(siteOf("https://www.example.org/some/path?who=me"), "example.org");
  assert.equal(siteOf("<script>"), undefined);
  assert.equal(siteOf("localhost"), undefined);
});
