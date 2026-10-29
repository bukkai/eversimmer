import { readFileSync } from "node:fs";
import type { WeatherOptions } from ".";
import { parseHours } from "./open-meteo";

export function replayed(file: string, speed: number, start: number): Pick<WeatherOptions, "load" | "clock"> {
  const hours = parseHours(JSON.parse(readFileSync(file, "utf8")));
  return { load: async () => hours, clock: (at) => hours[0].at + (at - start) * speed };
}
