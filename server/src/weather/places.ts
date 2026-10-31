import type { Accent } from "../../../shared/palette";

export type Place = { id: string; name: string; latitude: number; longitude: number; timeZone: string; tideLag?: number; accent?: Accent; tint?: string };

export const PLACES: Place[] = [
  { id: "bergen", name: "Bergen", latitude: 60.39, longitude: 5.32, timeZone: "Europe/Oslo", tideLag: 283 },
  { id: "torshavn", name: "Tórshavn", latitude: 62.01, longitude: -6.77, timeZone: "Atlantic/Faroe", tideLag: 196 },
  { id: "reykjavik", name: "Reykjavík", latitude: 64.15, longitude: -21.94, timeZone: "Atlantic/Reykjavik", tideLag: 181 },
  { id: "amsterdam", name: "Amsterdam", latitude: 52.37, longitude: 4.9, timeZone: "Europe/Amsterdam", tideLag: 66 },
  { id: "singapore", name: "Singapore", latitude: 1.29, longitude: 103.85, timeZone: "Asia/Singapore", tideLag: 95 },
  { id: "san-francisco", name: "San Francisco", latitude: 37.77, longitude: -122.42, timeZone: "America/Los_Angeles", tideLag: 216, tint: "#8f88b0",
    accent: { fifths: 2, lean: { pace: -0.03, mode: "aeolian", voice: "muted trumpet", space: 0.8, swing: 0.4, favour: { drums: ["jazz", "brushes"], keys: ["epiano", "organ"] } } } },
  { id: "wellington", name: "Wellington", latitude: -41.29, longitude: 174.78, timeZone: "Pacific/Auckland", tideLag: 147, tint: "#3f8f9e",
    accent: { fifths: 0, lean: { pace: 0.03, mode: "lydian", voice: "pan flute", space: 0.5, swing: -0.3, bright: 0.2, favour: { drums: ["crisp", "short909"], keys: ["vibraphone", "guitar"] } } } },
  { id: "sapporo", name: "Sapporo", latitude: 43.06, longitude: 141.35, timeZone: "Asia/Tokyo" },
  { id: "marrakesh", name: "Marrakesh", latitude: 31.63, longitude: -7.99, timeZone: "Africa/Casablanca", tint: "#c4714a",
    accent: { fifths: 5, lean: { pace: -0.04, mode: "phrygian", voice: "ney", space: -0.8, swing: 0.5, bright: -0.2, favour: { drums: ["rimshot", "dusty909"], keys: ["guitar", "organ"], motifSound: ["flute", "pluck"] } } } },
  { id: "dublin", name: "Dublin", latitude: 53.35, longitude: -6.26, timeZone: "Europe/Dublin", tideLag: 332, tint: "#6a9070",
    accent: { fifths: 1, lean: { mode: "dorian", voice: "harp", space: -0.2, swing: 0.2, bright: -0.2, favour: { drums: ["slackSnare", "brushes"], keys: ["piano", "guitar"], motifSound: ["flute"] } } } },
  { id: "rio-de-janeiro", name: "Rio de Janeiro", latitude: -22.91, longitude: -43.17, timeZone: "America/Sao_Paulo", tideLag: 161, tint: "#d1a542",
    accent: { fifths: 3, lean: { pace: 0.01, mode: "mixolydian", voice: "marimba", space: 0.2, swing: 0.3, bright: 0.2, favour: { drums: ["rimshot", "brushes"], keys: ["guitar", "epiano"], motifSound: ["flute"] } } } },
  { id: "seoul", name: "Seoul", latitude: 37.57, longitude: 126.98, timeZone: "Asia/Seoul", tint: "#b0607e",
    accent: { fifths: 4, lean: { pace: 0.03, mode: "major", voice: "koto", space: -0.5, swing: -0.4, bright: 0.3, favour: { drums: ["linn", "short909"], keys: ["epiano", "vibraphone"], motifSound: ["pluck"] } } } },
];

export function tideLag(place: Place) {
  return place.tideLag ?? (((-2 * place.longitude) % 360) + 360) % 360;
}

export function placeCalled(id = "bergen"): Place {
  const place = PLACES.find((p) => p.id === id.toLowerCase());
  if (!place) throw new Error(`there is no place called ${id}; there are ${PLACES.map((p) => p.id).join(", ")}`);
  return place;
}

export function localHour(place: Place, at: number) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: place.timeZone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return part("hour") + part("minute") / 60;
}
