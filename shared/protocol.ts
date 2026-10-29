import type { TempoSegment } from "./clock";
import type { Section } from "./form";
import type { Person } from "./identity";
import type { MapPosition } from "./map";
import type { Tides } from "./palette";
import type { Air, Broth, Course, Ingredient, PotMap, PotState, RecipeEntry } from "./types";

export type ChatLine = {
  id: string;
  at: number;
  person?: Person;
  text: string;
};

export const MAX_MESSAGE_LENGTH = 500;
export const RECIPE_LENGTH = 50;

export type Moment = {
  id: string;
  at: number;
  cycle: number;
  name: string;
  text: string;
  chat: string[];
  state: PotState;
};

export type Sky = {
  place: string;
  timeZone: string;
  at: number;
  pace: number;
  latitude: number;
  longitude: number;
  weather?: {
    conditions: string;
    code: number;
    cloud: number;
    precipitation: number;
    wind: number;
    day: number;
    temperature: number;
    usual: number;
    gusts: number;
    pressure: number;
    fall: number;
    visibility: number;
    light: number;
    moon: number;
    moonUp: boolean;
  };
  credit: { name: string; url: string };
};

export type Door = { name: string; talk: boolean; devControls: boolean; sky?: Sky };
export const DOOR_PATH = "/door";
export type Listing = { id?: string; name: string; line: string; listening?: number; since?: number };
export type Listings = { live: Listing[]; soon: Listing[] };
export const POTS_PATH = "/pots";

export type ServerMessage =
  | { t: "pong"; id: number; server: number }
  | { t: "state"; state: PotState }
  | { t: "welcome"; you: Person; history: ChatLine[]; devControls: boolean }
  | { t: "presence"; people: Person[] }
  | { t: "chat"; line: ChatLine }
  | { t: "hide"; ids: string[] }
  | { t: "ingredients"; ingredients: Ingredient[] }
  | { t: "notice"; text: string }
  | { t: "broth"; broth: Broth }
  | { t: "tempo"; tempo: TempoSegment[] }
  | { t: "map"; map: PotMap }
  | { t: "form"; form: Section[] }
  | { t: "timeShift"; ms: number }
  | { t: "tides"; tides: Tides }
  | { t: "air"; air: Air }
  | { t: "course"; course: Course; entry: RecipeEntry }
  | { t: "key"; key: string }
  | { t: "sky"; sky: Sky }
  | { t: "listening"; places: number };

export type ClientMessage =
  | { t: "ping"; id: number }
  | { t: "hello"; name: string }
  | { t: "say"; text: string }
  | { t: "broken"; course: string; error: string }
  | { t: "dev:broth"; patch: Partial<Broth> }
  | { t: "dev:rest" }
  | { t: "dev:course"; code: string; note?: string }
  | { t: "dev:cook" }
  | { t: "dev:genre"; region: string; now?: boolean }
  | { t: "dev:next" }
  | { t: "dev:travel"; ms: number }
  | { t: "dev:map"; patch: Partial<MapPosition> }
  | { t: "dev:key"; key: string }
  | { t: "dev:feedback"; text: string; cycle: number };

export const WS_PATH = "/ws";
