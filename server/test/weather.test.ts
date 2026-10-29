import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { RESTING_BROTH } from "../../shared/types";
import { Pantry } from "../src/pantry";
import type { SourceContext } from "../src/source";
import { between, Weather } from "../src/weather";
import { haze, ingredients, lean, PULL, type Reading } from "../src/weather/mapping";
import { moonAt, tideAt } from "../src/weather/moon";
import { parseHours, type Hour } from "../src/weather/open-meteo";
import { placeCalled } from "../src/weather/places";
import { replayed } from "../src/weather/replay";

const HOUR = 60 * 60_000;
const START = Date.UTC(2026, 9, 1, 10);
const bergen = placeCalled("bergen");

const calm: Omit<Hour, "at"> = { temperature: 12, precipitation: 0, code: 1, pressure: 1015, cloud: 20, wind: 5, gusts: 8, day: 1, light: 400, visibility: 30_000 };
const storm: Omit<Hour, "at"> = { temperature: 9, precipitation: 6, code: 65, pressure: 990, cloud: 100, wind: 60, gusts: 90, day: 1, light: 60, visibility: 3000 };

const hours = (...each: Omit<Hour, "at">[]) => each.map((h, i) => ({ at: START + i * HOUR, ...h }));
const reading = (h: Omit<Hour, "at">, more: Partial<Reading> = {}): Reading => ({ at: START, ...h, fall: 0, hour: 12, usual: h.temperature, moon: 0, ...more });

function weatherAt(given: Hour[]) {
  let now = START;
  const table: SourceContext = { broadcast: () => {}, tell: () => {}, now: () => now };
  const weather = new Weather(table, { place: bergen, load: async () => given, pollMs: 24 * HOUR });
  return { weather, at: (t: number) => (now = t) };
}

test("Open-Meteo's hours are read, and a missing value keeps the one before it", () => {
  const parsed = parseHours({
    hourly: {
      time: [START / 1000, START / 1000 + 3600],
      temperature_2m: [11.5, null],
      precipitation: [0.4, 1.2],
      weather_code: [61, 63],
      pressure_msl: [1002, 1001],
      cloud_cover: [90, 100],
      wind_speed_10m: [20, 25],
      wind_gusts_10m: [35, null],
      is_day: [1, 1],
      shortwave_radiation: [120, 80],
    },
  });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].at, START + HOUR);
  assert.equal(parsed[1].temperature, 11.5);
  assert.equal(parsed[1].gusts, 35);
  assert.equal(parsed[1].code, 63);
  assert.throws(() => parseHours({ hourly: { time: [] } }));
});

test("between the hours the weather glides, and the code is the nearer hour's", () => {
  const h = hours(calm, storm);
  const half = between(h, START + HOUR / 2);
  assert.equal(half.wind, (calm.wind + storm.wind) / 2);
  assert.equal(between(h, START + HOUR / 4).code, calm.code);
  assert.equal(between(h, START + (3 * HOUR) / 4).code, storm.code);
  assert.equal(between(h, START - HOUR).wind, calm.wind);
  assert.equal(between(h, START + 5 * HOUR).wind, storm.wind);
});

test("a storm is livelier, busier and darker than a calm day, and a falling barometer is tense", () => {
  const still = reading(calm);
  const gale = reading(storm);
  assert.ok(PULL.energy(still) < 0 && PULL.energy(gale) > 0.9);
  assert.ok(PULL.density(gale) > 0.8 && PULL.density(still) < 0);
  assert.ok(PULL.valence(gale) < PULL.valence(still));
  assert.equal(PULL.tension(reading(calm, { fall: 6 })), 1);
  assert.ok(PULL.tension(reading(calm, { fall: -3 })) < 0);
  assert.ok(PULL.strangeness(reading({ ...calm, code: 45 }, { hour: 3 })) > PULL.strangeness(still) + 0.5);
  for (const pull of Object.values(PULL)) for (const r of [still, gale]) assert.ok(Math.abs(pull(r)) <= 1);
});

test("the sky's code puts its weather in the pot, and a gale its wind", () => {
  assert.deepEqual(ingredients(reading(calm), "the weather"), []);
  const found = ingredients(reading(storm), "the weather");
  assert.deepEqual(found.map((f) => f.name), ["rain", "wind"]);
  assert.ok(found.every((f) => f.weight > 0 && f.weight <= 1 && f.musicalHint));
  assert.deepEqual(ingredients(reading({ ...calm, code: 99 }), "x").map((f) => f.name), ["thunder", "rain", "hail"]);
});

test("a measurement doesn't stack: the same rain again keeps its weight", () => {
  const pantry = new Pantry({ oneVoice: 1, stack: false });
  const rain = { name: "rain", weight: 0.55, addedBy: ["the weather"], musicalHint: "patter" };
  pantry.add([rain], START);
  pantry.add([rain], START);
  assert.equal(pantry.items[0].weight, 0.55);
  pantry.add([{ ...rain, weight: 0.8 }], START);
  assert.equal(pantry.items[0].weight, 0.8);
  const people = new Pantry();
  people.add([{ ...rain, weight: 0.2 }], START);
  people.add([{ ...rain, weight: 0.2 }], START);
  assert.ok(people.items[0].weight > 0.2 && people.items[0].weight <= 0.3);
});

test("the source rests until the weather comes in, then leans with it", async () => {
  const { weather, at } = weatherAt(hours(storm, storm));
  try {
    const { voices, ...rest } = RESTING_BROTH;
    assert.deepEqual(weather.targets(START), rest);
    await weather.ready;
    at(START);
    const t = weather.targets(START);
    assert.ok(t.energy > rest.energy + 0.4 && t.density > rest.density + 0.4);
    assert.ok(weather.digest().includes("Bergen"));
    weather.restAt({ ...rest, energy: 0.1 });
    assert.ok(Math.abs(weather.targets(START).energy - (t.energy - 0.15)) < 1e-9);
  } finally {
    weather.close();
  }
});

test("the targets never jump between readings", async () => {
  const { weather, at } = weatherAt(hours(calm, storm, calm));
  try {
    await weather.ready;
    let before = weather.targets(START);
    for (let t = START; t <= START + 2 * HOUR; t += 60_000) {
      at(t);
      const now = weather.targets(t);
      for (const k of Object.keys(now) as (keyof typeof now)[]) assert.ok(Math.abs(now[k] - before[k]) < 0.05, `${k} jumped at ${(t - START) / 60_000} min`);
      before = now;
    }
  } finally {
    weather.close();
  }
});

test("the rain goes in the pot while it falls, and stays at its weight", async () => {
  const { weather, at } = weatherAt(hours(storm, storm, storm));
  try {
    await weather.ready;
    for (let t = START; t <= START + 45 * 60_000; t += 60_000) {
      at(t);
      weather.settle(t);
    }
    const rain = weather.ingredients.find((i) => i.name === "rain");
    assert.ok(rain && rain.weight > 0.6 && rain.weight <= 0.8);
    assert.deepEqual(rain.addedBy, ["the weather"]);
  } finally {
    weather.close();
  }
});

test("when the weather stops coming in, the pot drifts back to rest after an hour", async () => {
  const day = Array.from({ length: 12 }, () => storm);
  const { weather, at } = weatherAt(hours(...day));
  try {
    await weather.ready;
    const fresh = weather.targets(START + 30 * 60_000);
    const held = weather.targets(START + 55 * 60_000);
    assert.ok(Math.abs(held.energy - fresh.energy) < 1e-9);
    at(START + 4 * HOUR);
    const later = weather.targets(START + 4 * HOUR);
    assert.ok(Math.abs(later.energy - RESTING_BROTH.energy) < 0.01);
    assert.equal(weather.settle(START + 4 * HOUR), false);
  } finally {
    weather.close();
  }
});

test("a failed reading keeps the rest, and a replay's clock runs the weather faster", async () => {
  let now = START;
  const table: SourceContext = { broadcast: () => {}, tell: () => {}, now: () => now };
  const failing = new Weather(table, { place: bergen, load: async () => Promise.reject(new Error("down")), pollMs: 24 * HOUR });
  const fast = new Weather(table, { place: bergen, load: async () => hours(calm, storm), clock: (at) => START + (at - START) * 60, pollMs: 24 * HOUR });
  try {
    await failing.ready;
    await fast.ready;
    assert.equal(failing.targets(START).energy, RESTING_BROTH.energy);
    now = START + 60_000;
    assert.equal(fast.reading(now)!.wind, storm.wind);
  } finally {
    failing.close();
    fast.close();
  }
});

test("a replay plays the hours it keeps on disk from the first, as fast as asked", async () => {
  const dir = mkdtempSync(join(tmpdir(), "weather-"));
  const file = join(dir, "stretch.json");
  const at = [0, 1, 2].map((i) => (START + i * HOUR) / 1000);
  writeFileSync(file, JSON.stringify({ hourly: { time: at, wind_speed_10m: [5, 50, 20], weather_code: [0, 63, 3] } }));
  const { load, clock } = replayed(file, 120, 1000);
  assert.equal(clock!(1000), START);
  assert.equal(clock!(1000 + 30_000), START + HOUR);
  const hours = await load!(bergen);
  assert.deepEqual(hours.map((h) => h.wind), [5, 50, 20]);
  rmSync(dir, { recursive: true });
});

test("the sky says the place, the weather in words and how fast its time runs", async () => {
  const { weather } = weatherAt(hours(storm, storm));
  try {
    assert.equal(weather.sky(START).weather, undefined);
    await weather.ready;
    const sky = weather.sky(START);
    assert.equal(sky.place, "Bergen");
    assert.equal(sky.timeZone, "Europe/Oslo");
    assert.equal(sky.pace, 1);
    assert.equal(sky.weather?.conditions, "heavy rain, a gale");
    assert.equal(sky.credit.name, "Open-Meteo.com");
  } finally {
    weather.close();
  }
});

test("the cold is bright and the warmth muffled, and a mild spell is heard as one", () => {
  const at = (temperature: number, usual = temperature) => PULL.warmth(reading({ ...calm, temperature }, { usual }));
  assert.ok(at(-5) < at(5) && at(5) < at(15) && at(15) < at(25));
  assert.ok(at(-5) < -0.5 && at(25) > 0.5);
  assert.ok(at(8, 2) > at(8) + 0.2);
});

test("a bright moon in a clear night lifts it and pulls it back from the cosmic, behind cloud it does nothing", () => {
  const night = { ...calm, day: 0, light: 0, cloud: 0 };
  const dark = reading(night, { moon: 0 });
  const full = reading(night, { moon: 1 });
  assert.ok(PULL.valence(full) > PULL.valence(dark) + 0.4);
  assert.ok(PULL.texture(full) < PULL.texture(dark));
  assert.ok(lean(full).bright! > 0.9 && lean(dark).bright === 0);
  const clouded = { ...night, cloud: 100 };
  assert.equal(PULL.valence(reading(clouded, { moon: 1 })), PULL.valence(reading(clouded, { moon: 0 })));
  assert.equal(lean(reading(clouded, { moon: 1 })).bright, 0);
  assert.equal(lean(reading(calm, { moon: 1 })).bright, 0);
});

test("a gale quickens the tempo a little and a still day slows it, warmth makes the swing lazier", () => {
  assert.ok(lean(reading(storm)).tempo! > 0.9 && lean(reading({ ...calm, wind: 0, gusts: 0 })).tempo! < -0.5);
  assert.ok(lean(reading({ ...calm, temperature: 24 })).swing! > 0.5 && lean(reading({ ...calm, temperature: 0 })).swing! < 0);
});

test("the moon goes through its phases as the almanac has them", () => {
  const full = moonAt(bergen, Date.UTC(2026, 9, 26, 4, 12));
  const fresh = moonAt(bergen, Date.UTC(2026, 10, 9, 7, 2));
  assert.ok(full.lit > 0.98 && Math.abs(full.phase - 0.5) < 0.03);
  assert.ok(fresh.lit < 0.02 && Math.min(fresh.phase, 1 - fresh.phase) < 0.03);
  const quarter = moonAt(bergen, Date.UTC(2026, 10, 1, 20));
  assert.ok(quarter.lit > 0.3 && quarter.lit < 0.7 && quarter.phase > 0.6 && quarter.phase < 0.9);
});

test("the tide comes round in 12 hours and 25 minutes, with high water in Bergen when the tables have it", () => {
  const off = (t: number, phase: number) => {
    const d = Math.abs(tideAt(bergen.tideLag, t) - phase);
    return Math.min(d, 1 - d) * 745;
  };
  assert.ok(off(Date.UTC(2026, 9, 29, 11, 46), 0) < 45);
  assert.ok(off(Date.UTC(2026, 9, 30, 0, 12), 0) < 45);
  assert.ok(off(Date.UTC(2026, 9, 29, 17, 43), 0.5) < 60);
  const t = Date.UTC(2026, 9, 29, 3);
  const turned = tideAt(0, t + (12 * 60 + 25) * 60_000) - tideAt(0, t);
  assert.ok(Math.abs(turned) < 0.01 || Math.abs(Math.abs(turned) - 1) < 0.01);
});

test("the weather pot's tides are the sea's and the moon's, following the weather's clock", async () => {
  const { weather, at } = weatherAt(hours(calm, calm));
  await weather.ready;
  const tides = weather.tides(at(START));
  assert.equal(tides.day, tideAt(bergen.tideLag, START));
  assert.equal(tides.season, moonAt(bergen, START).phase);
  weather.close();
});

test("the fog is as thick as the view is short, and the sky's code counts where there is no view", () => {
  assert.equal(haze(reading(calm)), 0);
  assert.ok(haze(reading({ ...calm, visibility: 200 })) === 1);
  assert.ok(haze(reading({ ...calm, visibility: 2000 })) > 0.3 && haze(reading({ ...calm, visibility: 2000 })) < 0.7);
  assert.ok(haze(reading(storm)) > 0.1 && haze(reading(storm)) <= 0.4);
  assert.equal(haze(reading({ ...calm, code: 45, visibility: 20_000 })), 0.7);
});

test("the weather pot's air carries the fog, and lets go of it with the weather", async () => {
  const { weather, at } = weatherAt(hours({ ...calm, visibility: 300, code: 45 }, { ...calm, visibility: 300, code: 45 }));
  await weather.ready;
  assert.equal(weather.air(at(START)).fog, 1);
  assert.ok(weather.air(at(START + 10 * HOUR)).fog < 0.01);
  weather.close();
});
