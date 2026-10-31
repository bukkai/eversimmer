import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const GRACE_MS = 15_000;
const WRITE_MS = 5 * 60_000;
const MAX_KEYS = 100;

export const STAYS = ["under 1 min", "1–10 min", "10–60 min", "1–3 h", "over 3 h"] as const;
type Stay = (typeof STAYS)[number];

export type Day = {
  day: string;
  places: number;
  visits: number;
  hours: number;
  stays: Record<Stay, number>;
  peak: number;
  byHour: number[];
  pots: Record<string, { places: number; visits: number; peak: number }>;
  moves: Record<string, number>;
  from: Record<string, number>;
  devices: { mobile: number; desktop: number };
  languages: Record<string, number>;
};

type Arrival = { referrer?: string; userAgent?: string; language?: string };

type Here = { pots: Map<string, number>; since: number; left?: { pot: string; at: number }; timer?: NodeJS.Timeout };
type Open = { day: string; salt: string; seen: string[]; seenPots: Record<string, string[]>; counts: Day };

const today = (at: number) => new Date(at).toISOString().slice(0, 10);
const count = (record: Record<string, number>, key: string) => {
  if (!(key in record) && Object.keys(record).length >= MAX_KEYS) key = "other";
  record[key] = (record[key] ?? 0) + 1;
};

function emptyDay(day: string): Day {
  return {
    day,
    places: 0,
    visits: 0,
    hours: 0,
    stays: Object.fromEntries(STAYS.map((s) => [s, 0])) as Record<Stay, number>,
    peak: 0,
    byHour: Array(24).fill(0),
    pots: {},
    moves: {},
    from: {},
    devices: { mobile: 0, desktop: 0 },
    languages: {},
  };
}

function stayOf(ms: number): Stay {
  const min = ms / 60_000;
  return min < 1 ? STAYS[0] : min < 10 ? STAYS[1] : min < 60 ? STAYS[2] : min < 180 ? STAYS[3] : STAYS[4];
}

export function siteOf(referrer: string | undefined) {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer.includes("://") ? referrer : `https://${referrer}`).hostname.replace(/^www\./, "");
    return /^[a-z0-9.-]{1,64}$/.test(host) && host.includes(".") ? host : undefined;
  } catch {
    return undefined;
  }
}

export class Stats {
  private here = new Map<string, Here>();
  private open: Open;
  private writing: NodeJS.Timeout | undefined;

  constructor(private dir: string | undefined, private clock = Date.now) {
    const kept = dir ? readOpen(dir) : undefined;
    const day = today(clock());
    if (kept && kept.day !== day) this.close(kept);
    this.open = kept?.day === day ? kept : freshDay(day);
    if (dir) this.writing = setInterval(() => this.write(), WRITE_MS);
  }

  arrive(address: string, pot: string, arrival: Arrival = {}) {
    const at = this.turn();
    const counts = this.open.counts;
    let here = this.here.get(address);
    if (!here) {
      here = { pots: new Map(), since: at };
      this.here.set(address, here);
      this.see(address);
      count(counts.from, siteOf(arrival.referrer) ?? "direct");
      counts.devices[/Mobi|Android|iPhone|iPad/i.test(arrival.userAgent ?? "") ? "mobile" : "desktop"]++;
      const language = arrival.language?.split(",")[0].split("-")[0].trim().toLowerCase();
      if (language && /^[a-z]{2,3}$/.test(language)) count(counts.languages, language);
    }
    clearTimeout(here.timer);
    here.timer = undefined;
    const back = here.left && at - here.left.at < GRACE_MS ? here.left.pot : undefined;
    here.left = undefined;
    const n = here.pots.get(pot) ?? 0;
    here.pots.set(pot, n + 1);
    if (n === 0) {
      this.seeAt(address, pot);
      if (back !== pot) this.potOf(pot).visits++;
      if (back && back !== pot) count(counts.moves, `${back} → ${pot}`);
    }
    this.peaks(at);
  }

  leave(address: string, pot: string) {
    const at = this.turn();
    const here = this.here.get(address);
    const n = here?.pots.get(pot);
    if (!here || !n) return;
    if (n > 1) return void here.pots.set(pot, n - 1);
    here.pots.delete(pot);
    here.left = { pot, at };
    if (here.pots.size) return;
    clearTimeout(here.timer);
    here.timer = setTimeout(() => {
      this.here.delete(address);
      this.turn();
      const counts = this.open.counts;
      const ms = at - here.since;
      counts.visits++;
      counts.hours += ms / 3_600_000;
      counts.stays[stayOf(ms)]++;
    }, GRACE_MS);
    here.timer.unref?.();
  }

  days(): Day[] {
    this.turn();
    const done = this.dir ? readDays(this.dir) : [];
    return [...done.filter((d) => d.day !== this.open.day), this.snapshot()];
  }

  stop() {
    clearInterval(this.writing);
    for (const here of this.here.values()) clearTimeout(here.timer);
    this.write();
  }

  private snapshot(): Day {
    const { counts, seen, seenPots } = this.open;
    const pots = Object.fromEntries(Object.entries(counts.pots).map(([pot, p]) => [pot, { ...p, places: seenPots[pot]?.length ?? 0 }]));
    return { ...counts, places: seen.length, hours: Math.round(counts.hours * 100) / 100, pots };
  }

  private turn() {
    const at = this.clock();
    const day = today(at);
    if (day === this.open.day) return at;
    this.close(this.open);
    this.open = freshDay(day);
    for (const [address, here] of this.here) {
      this.see(address);
      for (const pot of here.pots.keys()) this.seeAt(address, pot);
    }
    this.peaks(at);
    return at;
  }

  private see(address: string) {
    const hash = this.hash(address);
    if (!this.open.seen.includes(hash)) this.open.seen.push(hash);
  }

  private seeAt(address: string, pot: string) {
    const hash = this.hash(address);
    const seen = (this.open.seenPots[pot] ??= []);
    if (!seen.includes(hash)) seen.push(hash);
  }

  private potOf(pot: string) {
    return (this.open.counts.pots[pot] ??= { places: 0, visits: 0, peak: 0 });
  }

  private peaks(at: number) {
    const counts = this.open.counts;
    const listening = [...this.here.values()].filter((h) => h.pots.size).length;
    const hour = new Date(at).getUTCHours();
    counts.peak = Math.max(counts.peak, listening);
    counts.byHour[hour] = Math.max(counts.byHour[hour], listening);
    const atPot = new Map<string, number>();
    for (const here of this.here.values()) for (const pot of here.pots.keys()) atPot.set(pot, (atPot.get(pot) ?? 0) + 1);
    for (const [pot, n] of atPot) this.potOf(pot).peak = Math.max(this.potOf(pot).peak, n);
  }

  private hash(address: string) {
    return createHash("sha256").update(this.open.salt).update(address).digest("hex").slice(0, 16);
  }

  private close(open: Open) {
    if (!this.dir) return;
    const prev = this.open;
    this.open = open;
    const day = this.snapshot();
    this.open = prev;
    writeAside(join(this.dir, `${open.day}.json`), day);
  }

  private write() {
    if (this.dir) writeAside(join(this.dir, "open.json"), this.open);
  }
}

function freshDay(day: string): Open {
  return { day, salt: randomBytes(16).toString("hex"), seen: [], seenPots: {}, counts: emptyDay(day) };
}

function readOpen(dir: string): Open | undefined {
  try {
    return JSON.parse(readFileSync(join(dir, "open.json"), "utf8")) as Open;
  } catch {
    return undefined;
  }
}

export function readDays(dir: string): Day[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  } catch {
    return [];
  }
  return files.flatMap((f) => {
    try {
      return [JSON.parse(readFileSync(join(dir, f), "utf8")) as Day];
    } catch {
      return [];
    }
  });
}

function writeAside(file: string, data: unknown) {
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(data));
  renameSync(`${file}.tmp`, file);
}

export function report(days: Day[], detail = 7) {
  if (!days.length) return "No days counted yet.\n";
  const lines = ["Eversimmer FM listening, by UTC day", ""];
  lines.push("day         places  visits   hours  peak  stays (<1m 1-10m 10-60m 1-3h >3h)");
  for (const d of days)
    lines.push(
      `${d.day}  ${pad(d.places, 6)}  ${pad(d.visits, 6)}  ${pad(d.hours.toFixed(1), 6)}  ${pad(d.peak, 4)}  ${STAYS.map((s) => pad(d.stays[s], 4)).join(" ")}`,
    );
  for (const d of days.slice(-detail).reverse()) {
    lines.push("", `── ${d.day} ──`);
    const pots = Object.entries(d.pots).sort((a, b) => b[1].visits - a[1].visits);
    if (pots.length) lines.push(`pots       ${pots.map(([p, v]) => `${p} ${v.places} places/${v.visits} visits/peak ${v.peak}`).join(", ")}`);
    const busy = d.byHour.map((n, h) => (n ? `${String(h).padStart(2, "0")}h ${n}` : "")).filter(Boolean);
    if (busy.length) lines.push(`by hour    ${busy.join("  ")}`);
    lines.push(`devices    ${d.devices.mobile} mobile, ${d.devices.desktop} desktop`);
    for (const [label, record] of [["from", d.from], ["languages", d.languages], ["moves", d.moves]] as const) {
      const top = Object.entries(record).sort((a, b) => b[1] - a[1]).slice(0, 12);
      if (top.length) lines.push(`${label.padEnd(10)} ${top.map(([k, n]) => `${k} ${n}`).join(", ")}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

const pad = (v: string | number, n: number) => String(v).padStart(n);
