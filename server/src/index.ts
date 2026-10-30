import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { WS_PATH } from "../../shared/protocol";
import { STONE } from "../../shared/stone";
import { POTS, SOON } from "./pots";
import { potServer } from "./server";
import { Validator } from "./validate";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {}

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST;
const DEV_CONTROLS =
  process.env.DEV_CONTROLS === "on" ||
  (process.env.DEV_CONTROLS !== "off" && process.env.NODE_ENV !== "production");
const LIVE_CODER =
  process.env.LIVE_CODER === "on" ||
  (process.env.LIVE_CODER !== "off" && process.env.npm_lifecycle_event !== "dev");
const KEEP_STATE = process.env.KEEP_STATE || undefined;
const STATS = process.env.STATS || undefined;
const STATS_KEY = process.env.STATS_KEY || undefined;
const wanted = process.env.POTS?.split(",").map((p) => p.trim());
const called = (id: string) => POTS.filter((p) => p.id === id || p.id.startsWith(`${id}-`));
const pots = wanted ? wanted.flatMap((id) => (called(id).length ? called(id) : fail(`there is no pot called ${id}`))) : POTS;
const left = POTS.filter((p, i) => !pots.some((q) => q.name === p.name) && POTS.findIndex((q) => q.name === p.name) === i);
const soon = [...left.map(({ name, line = "" }) => ({ name, line })), ...SOON];

const hasCredentials =
  ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE"].some((k) => process.env[k]) ||
  existsSync(join(homedir(), ".config", "anthropic"));

const validator = new Validator();
for (const stone of new Set(pots.map((p) => p.stone ?? STONE)))
  void validator.validate(stone, "D").then((v) => {
    const whose = pots.filter((p) => (p.stone ?? STONE) === stone).map((p) => p.name).join(", ");
    if (!v.ok) console.error(`the stone of ${whose} fails validation, check the rules: ${v.problems.join("; ")}`);
  });

const server = potServer({
  pots,
  soon,
  validator,
  client: hasCredentials ? new Anthropic() : undefined,
  devControls: DEV_CONTROLS,
  liveCoder: LIVE_CODER,
  keep: KEEP_STATE,
  stats: STATS,
  statsKey: STATS_KEY,
});

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.close();
    process.exit(0);
  });
process.on("uncaughtException", (err) => {
  console.error("the server broke:", err);
  try {
    server.close();
  } finally {
    process.exit(1);
  }
});

server.http.listen(PORT, HOST, () => {
  const names = pots.map((p) => `${p.id} at ${WS_PATH}/${p.id}`).join(", ");
  console.log(`pot server on :${PORT}: ${names}; dev controls ${DEV_CONTROLS ? "on" : "off"}, live coder ${LIVE_CODER ? "on its schedule" : "only when asked"}${KEEP_STATE ? `, kept in ${KEEP_STATE}` : ""}`);
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
