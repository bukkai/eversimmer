import { cpsAtCycle, cycleAt, timeAtCycle, type TempoSegment } from "../../shared/clock";
import type { Hap, Pattern } from "@strudel/web";
import { isSynced, serverNow } from "./net";

const TICK_MS = 50;
const LOOKAHEAD_MS = 200;
const MAX_AHEAD_MS = 1000;
const EASE_MS = 0.5;

type Trigger = (hap: Hap, deadline: number, duration: number, cps: number, t: number) => void;
type Scheduled = { from: number; id: string; pattern: Pattern };

export class SharedScheduler {
  private courses: Scheduled[] = [];
  private lastEnd: number | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private audioMinusPerf: number | undefined;
  private ahead = LOOKAHEAD_MS;
  private lastTickAt: number | undefined;
  private late = 0;

  constructor(
    private ctx: AudioContext,
    private tempo: () => TempoSegment[],
    private trigger: Trigger,
    private onQueryError: (id: string, err: unknown) => void,
  ) {}

  cycleNow() {
    return cycleAt(this.tempo(), serverNow());
  }

  setCourse(from: number, id: string, pattern: Pattern) {
    const now = this.cycleNow();
    this.courses = this.courses.filter((c) => c.from < from);
    this.courses.push({ from, id, pattern });
    while (this.courses.length > 1 && this.courses[1].from <= now) this.courses.shift();
  }

  ids() {
    return new Set(this.courses.map((c) => c.id));
  }

  lookahead() {
    return this.ahead;
  }

  courseAt(cycle: number) {
    let current: Scheduled | undefined;
    for (const c of this.courses) if (c.from <= cycle) current = c;
    return current?.id;
  }

  start() {
    this.stop();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.lastEnd = undefined;
    this.lastTickAt = undefined;
  }

  reset() {
    this.courses = [];
    this.lastEnd = undefined;
  }

  private tick() {
    const started = performance.now();
    const gap = this.lastTickAt === undefined ? TICK_MS : started - this.lastTickAt;
    this.lastTickAt = started;
    if (this.ctx.state !== "running") {
      this.lastEnd = undefined;
      return;
    }
    if (!isSynced() || this.courses.length === 0) return;
    this.updateAudioMapping();
    const tempo = this.tempo();
    const nowMs = serverNow();
    const nowCycle = cycleAt(tempo, nowMs);
    const latencyMs = Math.max(0, (this.ctx.currentTime - this.audioTimeAt(nowMs)) * 1000);
    const end = cycleAt(tempo, nowMs + this.ahead + latencyMs);
    let begin = this.lastEnd ?? nowCycle;
    if (begin < nowCycle - 0.25 || begin > end) begin = nowCycle;
    if (end <= begin) return;

    this.late = 0;
    this.courses.forEach((course, i) => {
      const b = Math.max(begin, course.from);
      const e = Math.min(end, this.courses[i + 1]?.from ?? Infinity);
      if (e <= b) return;
      try {
        this.play(course.pattern, b, e, tempo);
      } catch (err) {
        this.onQueryError(course.id, err);
      }
    });
    this.lastEnd = end;
    this.pace(gap, performance.now() - started);
  }

  private pace(gap: number, spent: number) {
    let need = 2 * (Math.max(gap, TICK_MS) + spent);
    if (this.late > 0) need = Math.max(need, this.ahead * 1.5);
    this.ahead =
      need > this.ahead ? Math.min(MAX_AHEAD_MS, need) : Math.max(LOOKAHEAD_MS, this.ahead - EASE_MS);
  }

  private play(pattern: Pattern, begin: number, end: number, tempo: TempoSegment[]) {
    for (const hap of pattern.queryArc(begin, end, { _cps: cpsAtCycle(tempo, begin) })) {
      if (!hap.hasOnset()) continue;
      const onset = Number(hap.whole.begin);
      const onsetMs = timeAtCycle(tempo, onset);
      const t = this.audioTimeAt(onsetMs);
      if (t < this.ctx.currentTime) {
        if (onset >= begin) this.late++;
        continue;
      }
      const duration = (timeAtCycle(tempo, Number(hap.whole.end)) - onsetMs) / 1000;
      this.trigger(hap, t - this.ctx.currentTime, duration, cpsAtCycle(tempo, onset), t);
    }
  }

  private audioTimeAt(serverMs: number) {
    const perfMs = serverMs - (serverNow() - performance.now());
    return perfMs / 1000 + (this.audioMinusPerf ?? 0);
  }

  private updateAudioMapping() {
    const ts = this.ctx.getOutputTimestamp?.();
    const sample =
      ts?.contextTime && ts.performanceTime
        ? ts.contextTime - ts.performanceTime / 1000
        : this.ctx.currentTime - performance.now() / 1000;
    const prev = this.audioMinusPerf;
    this.audioMinusPerf =
      prev === undefined || Math.abs(sample - prev) > 0.05 ? sample : prev + (sample - prev) * 0.05;
  }
}
