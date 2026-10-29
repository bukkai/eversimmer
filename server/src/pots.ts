import { Potluck } from "./potluck";
import type { Listing } from "../../shared/protocol";
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
  { id: "potluck", name: "Potluck", line: "Bring something to the pot.", source: (table, client) => new Potluck(table, client) },
  {
    id: "meander",
    name: "Meander",
    line: "Played by the weather, somewhere far away.",
    source: (table) =>
      new Weather(table, { place, ...(replay ? replayed(replay, speed, table.now()) : { load: (p) => forecast(p, model) }) }),
  },
];

export const SOON: Listing[] = [{ name: "Dashi", line: "Still steeping." }];
