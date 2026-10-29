import { createServer, type IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { DOOR_PATH, WS_PATH, type ClientMessage } from "../../shared/protocol";
import { now } from "./pot";
import { serveClient, serveSource } from "./static";
import { send, Table, type PotKind, type Shared } from "./table";

const HEARTBEAT_MS = 30_000;

export function potServer({ pots, ...shared }: Shared & { pots: PotKind[] }) {
  const tables = new Map(pots.map((kind) => [kind.id, new Table(kind, shared)]));
  const home = pots[0].id;
  const startedAt = Date.now();

  const http = createServer((req, res) => {
    if (req.url === "/health") {
      const all = [...tables.values()].map((t) => ({ pot: t.pot.state.pot, listeners: t.listeners, cycle: t.pot.cycleNow() }));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, up: Math.round((Date.now() - startedAt) / 1000), pots: all }));
      return;
    }
    const path = (req.url ?? "").split("?")[0];
    const door = path === DOOR_PATH ? tables.get(home) : path.startsWith(`${DOOR_PATH}/`) && tables.get(path.slice(DOOR_PATH.length + 1));
    if (door) {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-cache" });
      res.end(JSON.stringify(door.door()));
      return;
    }
    if (path === "/source") {
      serveSource(res);
      return;
    }
    serveClient(req.url ?? "/", res, (path) => tables.has(path.slice(1)));
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
    wss.handleUpgrade(req, socket, head, (ws) => connect(ws, table, addressOf(req)));
  });

  const alive = new Map<WebSocket, boolean>();
  function connect(ws: WebSocket, table: Table, from: string) {
    alive.set(ws, true);
    ws.on("pong", () => alive.set(ws, true));
    ws.on("close", () => alive.delete(ws));
    ws.on("error", () => ws.terminate());
    if (!table.join(ws, from)) return;
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
