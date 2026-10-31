import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import type { Door } from "../../shared/protocol";

const CLIENT_DIR = fileURLToPath(new URL("../../client/dist/", import.meta.url));
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

const RELEASE_DIR = fileURLToPath(new URL("../../", import.meta.url));
export const REPOSITORY = "https://github.com/bukkai/eversimmer";

export function serveSource(res: ServerResponse, dir = RELEASE_DIR) {
  const file = join(dir, "COMMIT");
  const commit = existsSync(file) ? readFileSync(file, "utf8").trim() : "";
  const location = /^[0-9a-f]{7,40}$/.test(commit) ? `${REPOSITORY}/tree/${commit}` : REPOSITORY;
  res.writeHead(302, { location, "cache-control": "no-cache" }).end();
}

export async function serveClient(url: string, res: ServerResponse, door: (path: string) => Door | undefined = () => undefined) {
  try {
    const wanted = decodeURIComponent(url.split("?")[0]);
    const pot = door(wanted);
    const file = normalize(join(CLIENT_DIR, pot ? `${pot.page}.html` : wanted));
    if (!file.startsWith(CLIENT_DIR)) throw new Error("outside the client");
    const body = await readFile(file);
    const cache = file.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": cache });
    res.end(pot ? dressPage(String(body), pot) : body);
  } catch {
    res.writeHead(404).end();
  }
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function dressPage(html: string, door: Door) {
  const data = `<script id="door-data" type="application/json">${JSON.stringify(door).replace(/</g, "\\u003c")}</script>`;
  const name = escapeHtml(door.name);
  const page = html
    .replace("</head>", () => `${data}\n  </head>`)
    .replace(/(<title>)[^<]*/, (_, tag) => `${tag}Eversimmer FM · ${name}`)
    .replace(/(<span class="pot-name">)[^<]*/g, (_, tag) => tag + name);
  return door.sky ? page.replace(/(<h1 id="listen-place">)[^<]*/, (_, tag) => tag + escapeHtml(door.sky!.place)) : page;
}
