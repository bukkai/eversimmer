export type Place = { id: string; name: string; latitude: number; longitude: number; timeZone: string };

export const PLACES: Place[] = [
  { id: "bergen", name: "Bergen", latitude: 60.39, longitude: 5.32, timeZone: "Europe/Oslo" },
  { id: "torshavn", name: "Tórshavn", latitude: 62.01, longitude: -6.77, timeZone: "Atlantic/Faroe" },
  { id: "reykjavik", name: "Reykjavík", latitude: 64.15, longitude: -21.94, timeZone: "Atlantic/Reykjavik" },
  { id: "amsterdam", name: "Amsterdam", latitude: 52.37, longitude: 4.9, timeZone: "Europe/Amsterdam" },
];

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
