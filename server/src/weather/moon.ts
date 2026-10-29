const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const OBLIQUITY = 23.4397 * RAD;
const SUN_KM = 149_598_000;

export type Where = { latitude: number; longitude: number };

const days = (ms: number) => (ms - J2000_MS) / DAY_MS;
const turn = (x: number) => ((x % 1) + 1) % 1;
const rightAscension = (l: number, b: number) => Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l));
const declination = (l: number, b: number) => Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l));
const sidereal = (d: number) => RAD * (280.16 + 360.9856235 * d);

function sun(d: number) {
  const m = RAD * (357.5291 + 0.98560028 * d);
  const c = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  const l = m + c + RAD * 102.9372 + Math.PI;
  return { ra: rightAscension(l, 0), dec: declination(l, 0) };
}

function moonPosition(d: number) {
  const l0 = RAD * (218.316 + 13.176396 * d);
  const m = RAD * (134.963 + 13.064993 * d);
  const f = RAD * (93.272 + 13.22935 * d);
  const l = l0 + RAD * 6.289 * Math.sin(m);
  const b = RAD * 5.128 * Math.sin(f);
  return { ra: rightAscension(l, b), dec: declination(l, b), km: 385_001 - 20_905 * Math.cos(m) };
}

export type Moon = {
  phase: number;
  lit: number;
  altitude: number;
};

export function moonAt(where: Where, ms: number): Moon {
  const d = days(ms);
  const s = sun(d);
  const m = moonPosition(d);
  const elongation = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(SUN_KM * Math.sin(elongation), m.km - SUN_KM * Math.cos(elongation));
  const side = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  const hour = sidereal(d) + RAD * where.longitude - m.ra;
  const lat = RAD * where.latitude;
  const altitude = Math.asin(Math.sin(lat) * Math.sin(m.dec) + Math.cos(lat) * Math.cos(m.dec) * Math.cos(hour)) / RAD;
  return { phase: turn(0.5 + (0.5 * inc * (side < 0 ? -1 : 1)) / Math.PI), lit: (1 + Math.cos(inc)) / 2, altitude };
}

export function moonlight(moon: Moon) {
  return moon.lit * Math.min(1, Math.max(0, Math.sin(moon.altitude * RAD) * 2));
}

export function tideAt(lag: number, ms: number) {
  const d = days(ms);
  const hour = sidereal(d) - moonPosition(d).ra;
  return turn((2 * hour - lag * RAD) / (2 * Math.PI));
}
