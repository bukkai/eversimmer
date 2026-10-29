import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

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
export const REPOSITORY = "https://github.com/stephanmullerNL/eversimmer";

export function serveSource(res: ServerResponse, dir = RELEASE_DIR) {
  const archive = join(dir, "source.tar.gz");
  if (!existsSync(archive)) {
    res.writeHead(302, { location: REPOSITORY }).end();
    return;
  }
  const commit = existsSync(join(dir, "COMMIT")) ? readFileSync(join(dir, "COMMIT"), "utf8").trim().slice(0, 12) : "";
  res.writeHead(200, {
    "content-type": "application/gzip",
    "content-length": statSync(archive).size,
    "content-disposition": `attachment; filename="eversimmer${commit && `-${commit}`}.tar.gz"`,
    "cache-control": "no-cache",
  });
  createReadStream(archive)
    .on("error", () => res.destroy())
    .pipe(res);
}

export async function serveClient(url: string, res: ServerResponse, page: (path: string) => boolean = () => false) {
  try {
    const wanted = decodeURIComponent(url.split("?")[0]);
    const path = normalize(join(CLIENT_DIR, page(wanted) ? "/" : wanted));
    if (!path.startsWith(CLIENT_DIR)) throw new Error("outside the client");
    const file = path.endsWith("/") ? join(path, "index.html") : path;
    const body = await readFile(file);
    const cache = file.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": cache });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}
