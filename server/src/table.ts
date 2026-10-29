import type Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { cleanName, identityFor, type Person } from "../../shared/identity";
import type { ClientMessage, Door, Moment, ServerMessage } from "../../shared/protocol";
import { Breakage, MAX_ERROR_LENGTH } from "./breakage";
import { LiveCoder, sonnetWrite } from "./coder";
import { keepMoment, MAX_FEEDBACK_LENGTH } from "./feedback";
import { readKept, writeKept } from "./keep";
import { now, Pot, type PotMusic, type PotName } from "./pot";
import type { Source, SourceContext } from "./source";
import type { Validator } from "./validate";

export type PotKind = PotName & PotMusic & {
  line?: string;
  source: (table: SourceContext, client: Anthropic | undefined) => Source;
};

export type Shared = {
  validator: Validator;
  client: Anthropic | undefined;
  devControls: boolean;
  liveCoder: boolean;
  keep?: string;
};

const KEEP_MS = 30_000;
export const MAX_PER_PLACE = 10;

export class Table {
  readonly pot: Pot;
  readonly source: Source;
  private sockets = new Map<WebSocket, string>();
  private people = new Map<WebSocket, Person>();
  private coder: LiveCoder;
  private breakage = new Breakage();
  private keeping: NodeJS.Timeout | undefined;

  constructor(kind: PotKind, private shared: Shared) {
    this.source = kind.source(
      {
        broadcast: (msg) => this.broadcast(msg),
        tell: (name, text) => {
          for (const [ws, person] of this.people)
            if (person.name.toLowerCase() === name.toLowerCase()) send(ws, { t: "notice", text });
        },
        now,
      },
      shared.client,
    );
    const kept = shared.keep ? readKept(shared.keep, kind.id) : undefined;
    const pot = (this.pot = new Pot(kind, this.source, (msg) => this.broadcast(msg), kept));
    if (kept && pot.state.epoch === kept.state.epoch)
      console.log(`${kind.id}: carried on from ${Math.round((now() - kept.at) / 1000)} s ago, at cycle ${pot.cycleNow().toFixed(1)}`);
    if (shared.keep) this.keeping = setInterval(() => this.keep(), KEEP_MS);
    this.coder = new LiveCoder(shared.client && sonnetWrite(shared.client, this.source, pot.stone), shared.liveCoder, {
      present: () => this.present,
      tides: () => pot.tides(),
      form: () => pot.state.form,
      cycle: () => pot.cycleNow(),
      broth: () => pot.state.broth,
      map: () => pot.state.map,
      cps: () => pot.cpsNow(),
      ingredients: () => pot.state.ingredients,
      digest: () => this.source.digest(),
      current: () => {
        const course = pot.latestCourse();
        return { code: course.code, key: pot.latestKey(), note: course.note, isStone: course.code === pot.stone };
      },
      stone: pot.stone,
      recipe: () => pot.state.recipe.slice(-5).map((e) => e.note),
      validate: (code, key) => shared.validator.validate(code, key),
      serve: (code, note, key) => {
        pot.scheduleCourse(code, note, key);
        this.source.talk?.post(`a new course: ${note}`);
      },
      now,
    });
  }

  get listeners() {
    return this.sockets.size;
  }

  get present() {
    return this.source.talk ? this.people.size : this.places;
  }

  get places() {
    return new Set(this.sockets.values()).size;
  }

  join(ws: WebSocket, from = "") {
    const place = this.shared.devControls ? randomUUID() : from;
    if ([...this.sockets.values()].filter((p) => p === place).length >= MAX_PER_PLACE) {
      ws.close(1008, "too many connections from one place");
      return false;
    }
    this.sockets.set(ws, place);
    send(ws, { t: "state", state: this.pot.state });
    const sky = this.source.sky?.(now());
    if (sky) send(ws, { t: "sky", sky });
    if (!this.source.talk) this.updatePresence();
    this.broadcast({ t: "listening", places: this.places });
    ws.on("close", () => {
      this.sockets.delete(ws);
      if (this.people.delete(ws) || !this.source.talk) this.updatePresence();
      this.broadcast({ t: "listening", places: this.places });
    });
    return true;
  }

  receive(ws: WebSocket, msg: ClientMessage) {
    const pot = this.pot;
    if (msg.t === "hello") {
      if (!this.source.talk && !this.shared.devControls) return;
      const name = typeof msg.name === "string" ? cleanName(msg.name) : "";
      if (!name || this.people.has(ws)) return;
      const person = { id: randomUUID(), name, ...identityFor(name) };
      this.people.set(ws, person);
      send(ws, { t: "welcome", you: person, history: this.source.talk?.history() ?? [], devControls: this.shared.devControls });
      this.updatePresence();
      return;
    }

    if (msg.t === "broken") {
      if (typeof msg.course === "string" && typeof msg.error === "string") this.heardBroken(ws, msg.course, msg.error);
      return;
    }

    const person = this.people.get(ws);
    if (person && this.source.talk?.receive(person, msg, (text) => send(ws, { t: "notice", text }))) return;

    if (!this.shared.devControls) return;
    if (msg.t === "dev:broth" && msg.patch && typeof msg.patch === "object") pot.setBroth(msg.patch);
    else if (msg.t === "dev:rest") pot.rest();
    else if (msg.t === "dev:course" && typeof msg.code === "string") {
      const code = msg.code;
      const note = typeof msg.note === "string" ? msg.note.slice(0, 120) : "";
      void this.shared.validator.validate(code, pot.latestKey()).then((verdict) => {
        if (!verdict.ok) {
          send(ws, { t: "notice", text: `Refused: ${verdict.problems.join("; ")}` });
          return;
        }
        const course = pot.scheduleCourse(code, note, undefined, true);
        console.log(`${pot.state.pot}: course ${course.id} scheduled at cycle ${course.startedAtCycle}`);
      });
    } else if (msg.t === "dev:map" && msg.patch && typeof msg.patch === "object") pot.setMap(msg.patch);
    else if (msg.t === "dev:next") pot.nextTrackSoon();
    else if (msg.t === "dev:genre" && typeof msg.region === "string") pot.jumpTo(msg.region, msg.now === true);
    else if (msg.t === "dev:travel" && typeof msg.ms === "number" && Number.isFinite(msg.ms)) pot.travel(msg.ms);
    else if (msg.t === "dev:cook") void this.coder.cook("someone at the tuning desk asked for a new course");
    else if (msg.t === "dev:key" && /^[A-G][b#]?$/.test(msg.key)) pot.setKey(msg.key);
    else if (msg.t === "dev:feedback" && typeof msg.text === "string" && typeof msg.cycle === "number") {
      const text = msg.text.trim().slice(0, MAX_FEEDBACK_LENGTH);
      if (!text) return;
      const moment: Moment = {
        id: randomUUID().slice(0, 6),
        at: now(),
        cycle: Number.isFinite(msg.cycle) ? msg.cycle : pot.cycleNow(),
        name: person?.name ?? "someone",
        text,
        chat: (this.source.talk?.history() ?? []).slice(-8).map((l) => `${l.person?.name ?? "pot"}: ${l.text}`),
        state: { ...pot.state, recipe: pot.state.recipe.slice(-3) },
      };
      keepMoment(moment);
      console.log(`feedback ${moment.id} from ${moment.name} at cycle ${moment.cycle.toFixed(1)}: ${text}`);
      send(ws, { t: "notice", text: `Noted as moment ${moment.id}.` });
    }
  }

  close() {
    clearInterval(this.keeping);
    this.keep();
    this.pot.close();
    this.coder.close();
    this.source.close?.();
  }

  private keep() {
    if (!this.shared.keep) return;
    try {
      writeKept(this.shared.keep, this.pot.state.pot, this.pot.keep());
    } catch (err) {
      console.error(`${this.pot.state.pot}: couldn't keep the pot: ${err instanceof Error ? err.message : err}`);
    }
  }

  private heardBroken(ws: WebSocket, course: string, error: string) {
    const pot = this.pot;
    const listening = this.places;
    const heard = this.breakage.report(course, this.sockets.get(ws) ?? "", listening);
    if (!heard.fresh) return;
    const text = error.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, MAX_ERROR_LENGTH);
    console.warn(`${pot.state.pot}: course ${course.slice(0, 40)} broke in a browser (${heard.reporters} of ${listening} places): ${text}`);
    const latest = pot.latestCourse();
    if (!heard.fallBack || latest.id !== course || latest.code === pot.stone) return;
    const recipe = pot.state.recipe;
    const before = recipe.slice(0, Math.max(0, recipe.findIndex((e) => e.id === course))).reverse();
    const good = before.find((e) => !this.breakage.broke(e.id) && e.code !== latest.code);
    const back = good && good.code !== pot.stone
      ? pot.scheduleCourse(good.code, `back to "${good.note}", the last course broke in listeners' browsers`, good.key, true)
      : pot.scheduleCourse(pot.stone, "back to the stone, the last course broke in listeners' browsers", good?.key, true);
    console.warn(`${pot.state.pot}: fell back from course ${course} to ${back.note}, at cycle ${back.startedAtCycle}`);
  }

  private broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const ws of this.sockets.keys()) if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }

  door(): Door {
    return { name: this.pot.state.name, talk: !!this.source.talk, devControls: this.shared.devControls, sky: this.source.sky?.(now()) };
  }

  private updatePresence() {
    this.broadcast({ t: "presence", people: [...this.people.values()] });
    this.pot.setVoices(this.present);
  }
}

export function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
