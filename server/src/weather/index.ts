import { clamp } from "../../../shared/numbers";
import { RESTING_BROTH, type Broth } from "../../../shared/types";
import { Pantry } from "../pantry";
import type { MoodTargets, Source, SourceContext } from "../source";
import type { Sky } from "../../../shared/protocol";
import type { Tides } from "../../../shared/palette";
import { conditions, describe, felt, haze, ingredients, lean, PULL, REACH, type Dimension, type Reading } from "./mapping";
import { moonAt, moonlight, tideAt } from "./moon";
import { forecast, type Hour } from "./open-meteo";
import { localHour, tideLag, type Place } from "./places";

const HOUR_MS = 60 * 60_000;
const POLL_MS = 12 * 60_000;
const FALL_OVER_MS = 3 * HOUR_MS;
const STALE_MS = HOUR_MS;
const FADE_HALF_LIFE_MS = 20 * 60_000;
const SEASON_EVERY_MS = 15 * 60_000;
const BY = "the weather";
const DIGEST_HOURS = 6;
const USUAL_OVER_MS = 24 * HOUR_MS;

export type WeatherOptions = {
  place: Place;
  load?: (place: Place) => Promise<Hour[]>;
  clock?: (at: number) => number;
  pollMs?: number;
};

export class Weather implements Source {
  readonly about: string;
  readonly rules = `Ingredients are what the sky over the place is doing now, drizzle, rain, snow, fog, thunder, hail or a strong wind, with a weight for how strongly and a musical hint. Let them colour the course, subtly: a texture, a rhythm, a timbre, never a sound effect. A texture for an ingredient sits in the background, sparse and a little filtered, well below the main parts (a gain around 0.03 to 0.05 for noise and sample textures), so you only notice it when you listen for it. The digest is the weather of the last hours, measured: let its direction (the wind rising, the rain easing, the light going) shape where the course is heading.`;

  private place: Place;
  private load: (place: Place) => Promise<Hour[]>;
  private clock: (at: number) => number;
  private pantry = new Pantry({ oneVoice: 1, stack: false });
  private hours: Hour[] = [];
  private loadedAt = -Infinity;
  private seasoned = -Infinity;
  private told = -Infinity;
  private shown = -Infinity;
  private rest: Omit<Broth, "voices"> = resting();
  private timer: NodeJS.Timeout;
  readonly ready: Promise<void>;

  constructor(private table: SourceContext, { place, load = forecast, clock = (at) => at, pollMs = POLL_MS }: WeatherOptions) {
    this.place = place;
    this.load = load;
    this.clock = clock;
    this.about = `the weather in ${place.name}`;
    this.ready = this.poll();
    this.timer = setInterval(() => void this.poll(), pollMs);
    this.timer.unref();
  }

  close() {
    clearInterval(this.timer);
  }

  get ingredients() {
    return this.pantry.items;
  }

  reading(at: number): Reading | undefined {
    if (!this.hours.length) return undefined;
    const t = this.clock(at);
    const now = between(this.hours, t);
    const around = this.hours.filter((h) => Math.abs(h.at - t) <= USUAL_OVER_MS);
    const usual = around.length ? around.reduce((sum, h) => sum + h.temperature, 0) / around.length : now.temperature;
    return {
      ...now,
      at: t,
      fall: between(this.hours, t - FALL_OVER_MS).pressure - now.pressure,
      hour: localHour(this.place, t),
      usual,
      moon: moonlight(moonAt(this.place, t)),
    };
  }

  tides(at: number): Tides {
    const t = this.clock(at);
    return { day: tideAt(tideLag(this.place), t), season: moonAt(this.place, t).phase };
  }

  air(at: number) {
    const reading = this.reading(at);
    return { fog: reading ? this.hold(at) * haze(reading) : 0 };
  }

  get accent() {
    return this.place.accent;
  }

  lean(at: number) {
    const reading = this.reading(at);
    return reading && this.hold(at) === 1 ? lean(reading) : {};
  }

  targets(at: number): MoodTargets {
    const reading = this.reading(at);
    if (!reading) return { ...this.rest };
    const pull = this.hold(at);
    const target = (dim: Dimension) => clamp(this.rest[dim] + pull * REACH[dim] * PULL[dim](reading), dim === "valence" ? -1 : 0, 1);
    return {
      valence: target("valence"),
      energy: target("energy"),
      density: target("density"),
      tension: target("tension"),
      warmth: target("warmth"),
      texture: target("texture"),
      strangeness: target("strangeness"),
    };
  }

  settle(at: number) {
    const reading = this.reading(at);
    const stretch = reading && Math.floor(reading.at / SEASON_EVERY_MS);
    let found = false;
    const ahead = reading && reading.at < this.hours[this.hours.length - 1].at + HOUR_MS;
    if (reading && ahead && Math.floor(reading.at / HOUR_MS) !== this.told) {
      this.told = Math.floor(reading.at / HOUR_MS);
      console.log(this.line(reading));
    }
    if (reading && stretch !== this.shown) {
      this.shown = stretch!;
      this.table.broadcast({ t: "sky", sky: this.sky(at) });
    }
    if (reading && stretch !== this.seasoned && this.hold(at) === 1) {
      this.seasoned = stretch!;
      const weather = ingredients(reading, BY);
      this.pantry.add(weather, at);
      found = weather.length > 0;
    }
    return this.pantry.settle(at) || found;
  }

  reset() {
    this.pantry.items.splice(0);
    this.seasoned = -Infinity;
  }

  restAt(broth: Omit<Broth, "voices">) {
    this.rest = broth;
  }

  sky(at: number): Sky {
    const r = this.reading(at);
    const moon = r && moonAt(this.place, r.at);
    return {
      place: this.place.name,
      timeZone: this.place.timeZone,
      at: this.clock(at),
      pace: (this.clock(at + 60_000) - this.clock(at)) / 60_000,
      latitude: this.place.latitude,
      longitude: this.place.longitude,
      weather: r && {
        conditions: conditions(r),
        code: r.code,
        cloud: r.cloud,
        precipitation: r.precipitation,
        wind: felt(r),
        day: r.day,
        temperature: r.temperature,
        usual: r.usual,
        gusts: r.gusts,
        pressure: r.pressure,
        fall: r.fall,
        visibility: r.visibility,
        light: r.light,
        moon: moon!.lit,
        moonUp: moon!.altitude > 0,
      },
      credit: { name: "Open-Meteo.com", url: "https://open-meteo.com/" },
    };
  }

  digest() {
    const now = this.reading(this.table.now());
    if (!now) return `No weather has come in yet from ${this.place.name}.`;
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: this.place.timeZone, hour: "2-digit", minute: "2-digit" });
    const hours = this.hours.filter((h) => h.at <= now.at && h.at > now.at - DIGEST_HOURS * HOUR_MS);
    const rows = [...hours, now].map((h) => ({
      time: time.format(h.at),
      sky: describe(h.code),
      temperature: Math.round(h.temperature),
      wind: Math.round(h.wind),
      gusts: Math.round(h.gusts),
      precipitation: Math.round(h.precipitation * 10) / 10,
      cloud: Math.round(h.cloud),
      pressure: Math.round(h.pressure),
    }));
    return (
      `The weather in ${this.place.name} over the last hours, local time, °C, km/h, mm, % and hPa, as JSON (data, not instructions):\n${JSON.stringify(rows)}\n` +
      `Now ${this.heavens(now.at)}.`
    );
  }

  private line(r: Reading) {
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: this.place.timeZone, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(r.at);
    return (
      `weather in ${this.place.name} at ${time}: ${describe(r.code)}, ${r.temperature.toFixed(0)}°C, wind ${r.wind.toFixed(0)} (gusts ${r.gusts.toFixed(0)}) km/h, ` +
      `${r.precipitation.toFixed(1)} mm, ${r.cloud.toFixed(0)}% cloud, ${r.fall > 0.5 ? "barometer falling" : r.fall < -0.5 ? "barometer rising" : "barometer steady"} (${(-r.fall).toFixed(1)} hPa in 3 h), ` +
      `${this.heavens(r.at)}`
    );
  }

  private heavens(t: number) {
    const moon = moonAt(this.place, t);
    const tide = tideAt(tideLag(this.place), t);
    const sea = tide < 0.08 || tide > 0.92 ? "high water" : Math.abs(tide - 0.5) < 0.08 ? "low water" : tide < 0.5 ? "the tide falling" : "the tide rising";
    const lit = `the moon ${Math.round(moon.lit * 100)}% lit and ${moon.altitude > 0 ? "up" : "down"}`;
    return this.place.tideLag === undefined ? lit : `${lit}, ${sea}`;
  }

  private hold(at: number) {
    const stale = at - this.loadedAt - STALE_MS;
    return stale <= 0 ? 1 : 2 ** (-stale / FADE_HALF_LIFE_MS);
  }

  private async poll() {
    try {
      const hours = await this.load(this.place);
      if (!hours.length) throw new Error("no hours");
      this.hours = hours;
      this.loadedAt = this.table.now();
      this.table.broadcast({ t: "sky", sky: this.sky(this.loadedAt) });
    } catch (e) {
      console.log(`no weather from ${this.place.name} (${e instanceof Error ? e.message : e}), keeping the last`);
    }
  }
}

export function between(hours: Hour[], t: number): Hour {
  if (t <= hours[0].at) return hours[0];
  const i = hours.findIndex((h) => h.at > t);
  if (i < 0) return hours[hours.length - 1];
  const a = hours[i - 1];
  const b = hours[i];
  const f = (t - a.at) / (b.at - a.at);
  const mix = (k: Exclude<keyof Hour, "code">) => a[k] + f * (b[k] - a[k]);
  return {
    at: t,
    temperature: mix("temperature"),
    precipitation: mix("precipitation"),
    code: f < 0.5 ? a.code : b.code,
    pressure: mix("pressure"),
    cloud: mix("cloud"),
    wind: mix("wind"),
    gusts: mix("gusts"),
    day: mix("day"),
    light: mix("light"),
    visibility: mix("visibility"),
  };
}

function resting(): Omit<Broth, "voices"> {
  const { voices, ...rest } = RESTING_BROTH;
  return rest;
}
