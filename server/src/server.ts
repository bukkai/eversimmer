import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { DOOR_PATH, POTS_PATH, WS_PATH, type ClientMessage, type Listing, type Listings } from "../../shared/protocol";
import { now } from "./pot";
import { serveClient, serveSource } from "./static";
import { report, Stats } from "./stats";
import { send, Table, type PotKind, type Shared } from "./table";

const HEARTBEAT_MS = 30_000;

type Options = Shared & {
  pots: PotKind[];
  soon?: Listing[];
  stats?: string;
  statsKey?: string;
};

export function potServer({ pots, soon = [], stats: statsDir, statsKey, ...shared }: Options) {
  const tables = new Map(pots.map((kind) => [kind.id, new Table(kind, shared)]));
  const stats = new Stats(statsDir);
  const home = pots[0].id;
  const named = (name: string) => pots.filter((p) => p.name === name);
  const doorOf = (table: Table | undefined) => {
    if (!table) return undefined;
    const door = table.door();
    const kin = named(door.name);
    return kin.length > 1 ? { ...door, places: kin.map(({ id, place = id }) => ({ id, place })) } : door;
  };
  const startedAt = Date.now();

  const http = createServer((req, res) => {
    if (req.url === "/health") {
      const all = [...tables.values()].map((t) => ({ pot: t.pot.state.pot, listeners: t.listeners, cycle: t.pot.cycleNow() }));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, up: Math.round((Date.now() - startedAt) / 1000), pots: all }));
      return;
    }
    const path = (req.url ?? "").split("?")[0];
    const door = doorOf(path === DOOR_PATH ? tables.get(home) : path.startsWith(`${DOOR_PATH}/`) ? tables.get(path.slice(DOOR_PATH.length + 1)) : undefined);
    if (door) {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-cache" });
      res.end(JSON.stringify(door));
      return;
    }
    if (path === POTS_PATH) {
      const live = pots
        .filter((p) => named(p.name)[0] === p)
        .map(({ id, name, line = "" }) => {
          const kin = named(name).map((p) => tables.get(p.id)!);
          return { id, name, line, listening: kin.reduce((n, t) => n + t.places, 0), since: Math.min(...kin.map((t) => t.pot.state.epoch)) };
        });
      const listings: Listings = { live, soon };
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-cache" });
      res.end(JSON.stringify(listings));
      return;
    }
    if (path === "/" && !shared.devControls) {
      void serveClient("/home.html", res);
      return;
    }
    if (path === "/stats") {
      const query = new URL(req.url ?? "", "http://x").searchParams;
      const key = query.get("key") ?? "";
      if (!shared.devControls && !(statsKey && same(key, statsKey))) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("Not found\n");
        return;
      }
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      res.end(report(stats.days(), Math.min(Number(query.get("days")) || 7, 366)));
      return;
    }
    if (path === "/source") {
      serveSource(res);
      return;
    }
    serveClient(req.url ?? "/", res, (path) => doorOf(tables.get(path === "/" ? home : path.slice(1))));
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  http.on("upgrade", (req, socket, head) => {
    const path = (req.url ?? "").split("?")[0];
    const id = path === WS_PATH ? home : path.startsWith(`${WS_PATH}/`) ? path.slice(WS_PATH.length + 1) : undefined;
    const table = id === undefined ? undefined : tables.get(id);
    if (!table) {
      socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => connect(ws, id!, table, req));
  });

  const alive = new Map<WebSocket, boolean>();
  function connect(ws: WebSocket, id: string, table: Table, req: IncomingMessage) {
    const from = addressOf(req);
    alive.set(ws, true);
    ws.on("pong", () => alive.set(ws, true));
    ws.on("close", () => alive.delete(ws));
    ws.on("error", () => ws.terminate());
    if (!table.join(ws, from)) return;
    stats.arrive(from, id, {
      referrer: new URL(req.url ?? "", "http://x").searchParams.get("from") ?? undefined,
      userAgent: req.headers["user-agent"],
      language: req.headers["accept-language"],
    });
    ws.on("close", () => stats.leave(from, id));
    ws.on("message", (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object" || typeof msg.t !== "string") return;
      if (msg.t === "ping") send(ws, { t: "pong", id: msg.id, server: now() });
      else table.receive(ws, msg);
    });
  }
  const heartbeat = setInterval(() => {
    for (const [ws, answered] of alive) {
      if (!answered) ws.terminate();
      else {
        alive.set(ws, false);
        ws.ping();
      }
    }
  }, HEARTBEAT_MS);

  return {
    http,
    tables,
    close() {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      for (const table of tables.values()) table.close();
      stats.stop();
      http.close();
    },
  };
}

function addressOf(req: IncomingMessage) {
  const direct = req.socket.remoteAddress ?? "";
  const forwarded = req.headers["cf-connecting-ip"];
  const local = direct === "127.0.0.1" || direct === "::1" || direct === "::ffff:127.0.0.1";
  return local && typeof forwarded === "string" ? forwarded : direct;
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
