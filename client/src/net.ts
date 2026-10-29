import type { ClientMessage, ServerMessage } from "../../shared/protocol";
import { wsPath } from "./address";

const PINGS_PER_SYNC = 8;
const PING_SPACING_MS = 120;
const RESYNC_MS = 30_000;
const SILENT_MS = 10_000;
const RETRY_MS = 1000;
const RETRY_MAX_MS = 15_000;

let ws: WebSocket | undefined;
let offset: number | undefined;
let rtt = 0;
let pingId = 0;
const pending = new Map<number, number>();
let samples: { offset: number; rtt: number }[] = [];
let onSynced: (() => void) | undefined;
let heardAt = 0;

export const serverNow = () => performance.now() + (offset ?? 0);
export const isSynced = () => offset !== undefined;
export const clockStats = () => ({ offset, rtt });

export function send(msg: ClientMessage) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

export function connect(onMessage: (msg: ServerMessage) => void, onStatus: (s: string) => void) {
  return new Promise<void>((resolve) => {
    onSynced = resolve;
    let retries = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      clearTimeout(retry);
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${proto}://${location.host}${wsPath}`);
      ws = socket;
      socket.onopen = () => {
        retries = 0;
        heardAt = performance.now();
        onStatus("connected");
        sync();
      };
      socket.onmessage = (e) => {
        heardAt = performance.now();
        const msg = JSON.parse(e.data) as ServerMessage;
        if (msg.t === "pong") handlePong(msg.id, msg.server);
        else onMessage(msg);
      };
      socket.onclose = () => {
        if (socket !== ws) return;
        ws = undefined;
        onStatus("reconnecting…");
        const wait = Math.min(RETRY_MAX_MS, RETRY_MS * 2 ** retries++);
        retry = setTimeout(open, wait * (0.5 + Math.random()));
      };
    };
    const giveUp = () => {
      const socket = ws;
      if (!socket) return;
      ws = undefined;
      socket.close();
      onStatus("reconnecting…");
      open();
    };
    open();
    setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN && performance.now() - heardAt > RESYNC_MS + SILENT_MS) giveUp();
      else sync();
    }, RESYNC_MS);
    const check = () => {
      if (document.hidden) return;
      if (!ws) open();
      else if (ws.readyState === WebSocket.OPEN) {
        const asked = performance.now();
        sync();
        setTimeout(() => heardAt < asked && giveUp(), SILENT_MS);
      }
    };
    addEventListener("visibilitychange", check);
    addEventListener("online", check);
  });
}

export function startClockAt(serverMs: number) {
  offset = serverMs - performance.now();
}

function sync() {
  samples = [];
  pending.clear();
  for (let i = 0; i < PINGS_PER_SYNC; i++) {
    setTimeout(() => {
      const id = ++pingId;
      pending.set(id, performance.now());
      send({ t: "ping", id });
    }, i * PING_SPACING_MS);
  }
}

function handlePong(id: number, server: number) {
  const sent = pending.get(id);
  if (sent === undefined) return;
  pending.delete(id);
  const received = performance.now();
  samples.push({ offset: server - (sent + received) / 2, rtt: received - sent });
  if (samples.length < PINGS_PER_SYNC / 2) return;
  const best = [...samples].sort((a, b) => a.rtt - b.rtt).slice(0, 3);
  const next = best.map((s) => s.offset).sort((a, b) => a - b)[1];
  rtt = best[0].rtt;
  offset = offset === undefined || Math.abs(next - offset) > 50 ? next : offset + (next - offset) * 0.3;
  onSynced?.();
  onSynced = undefined;
}
