import { Potluck } from "./potluck";
import type { PotKind } from "./table";
import { Weather } from "./weather";
import { forecast } from "./weather/open-meteo";
import { placeCalled } from "./weather/places";
import { replayed } from "./weather/replay";

const place = placeCalled(process.env.WEATHER_PLACE);
const model = process.env.WEATHER_MODEL;
const replay = process.env.WEATHER_REPLAY;
const speed = Number(process.env.WEATHER_SPEED ?? 60);

export const POTS: PotKind[] = [
  { id: "potluck", name: "Potluck", source: (table, client) => new Potluck(table, client) },
  {
    id: "weather",
    name: `The weather in ${place.name}`,
    source: (table) =>
      new Weather(table, { place, ...(replay ? replayed(replay, speed, table.now()) : { load: (p) => forecast(p, model) }) }),
  },
];
