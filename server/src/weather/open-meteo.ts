import type { Place } from "./places";

export type Hour = {
  at: number;
  temperature: number;
  precipitation: number;
  code: number;
  pressure: number;
  cloud: number;
  wind: number;
  gusts: number;
  day: number;
  light: number;
  visibility: number;
};

const VARIABLES = {
  temperature: "temperature_2m",
  precipitation: "precipitation",
  code: "weather_code",
  pressure: "pressure_msl",
  cloud: "cloud_cover",
  wind: "wind_speed_10m",
  gusts: "wind_gusts_10m",
  day: "is_day",
  light: "shortwave_radiation",
  visibility: "visibility",
} as const;
const FALLBACK: Omit<Hour, "at"> = { temperature: 10, precipitation: 0, code: 0, pressure: 1013, cloud: 50, wind: 0, gusts: 0, day: 0, light: 0, visibility: 20_000 };

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const HISTORY_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast";

export function query(base: string, place: Place, stretch: Record<string, string | number | undefined>) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    hourly: Object.values(VARIABLES).join(","),
    timeformat: "unixtime",
    ...Object.fromEntries(Object.entries(stretch).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]]))),
  });
  return `${base}?${params}`;
}

export function parseHours(json: unknown): Hour[] {
  const hourly = (json as { hourly?: Record<string, (number | null)[]> }).hourly;
  if (!hourly?.time?.length) throw new Error("no hourly weather in the response");
  const last = { ...FALLBACK };
  return hourly.time.map((time, i) => {
    for (const [key, name] of Object.entries(VARIABLES) as [keyof typeof VARIABLES, string][]) {
      const value = hourly[name]?.[i];
      if (typeof value === "number" && Number.isFinite(value)) last[key] = value;
    }
    return { at: (time ?? 0) * 1000, ...last };
  });
}

async function hoursFrom(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function forecast(place: Place, model?: string): Promise<Hour[]> {
  return parseHours(await hoursFrom(query(FORECAST_URL, place, { past_days: 1, forecast_days: 2, models: model })));
}

export function history(place: Place, from: string, to: string, model?: string): Promise<unknown> {
  return hoursFrom(query(HISTORY_URL, place, { start_date: from, end_date: to, timezone: place.timeZone, models: model }));
}
