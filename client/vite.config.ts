import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import type { Door } from "../shared/protocol";

const POT = `localhost:${process.env.POT_PORT ?? 8787}`;
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const PARTIALS = here("partials/");

function partials(): Plugin {
  return {
    name: "partials",
    transformIndexHtml: (html) =>
      html.replace(/^([ \t]*)<!-- include (\w+) -->$/gm, (_, indent: string, name: string) =>
        readFileSync(`${PARTIALS}${name}.html`, "utf8").trimEnd().replace(/^(?=.)/gm, indent),
      ),
    configureServer(server) {
      server.watcher.add(PARTIALS);
      server.watcher.on("change", (file) => file.startsWith(PARTIALS) && server.ws.send({ type: "full-reload" }));
    },
  };
}

function potPages(): Plugin {
  const pageOf = async (pot: string) => {
    if (process.env.VITE_MOMENT) return "potluck";
    if (!pot) return "home";
    try {
      const res = await fetch(`http://${POT}/door/${pot}`, { signal: AbortSignal.timeout(2000) });
      return res.ok ? ((await res.json()) as Door).page : undefined;
    } catch {
      return "potluck";
    }
  };
  return {
    name: "pot-pages",
    configureServer(server) {
      server.middlewares.use(async (req, _res, next) => {
        const pot = /^\/([\w-]*)(\?.*)?$/.exec(req.url ?? "")?.[1];
        const page = pot === undefined || !req.headers.accept?.includes("text/html") ? undefined : await pageOf(pot);
        if (page) req.url = `/${page}.html`;
        next();
      });
    },
  };
}

export default defineConfig({
  resolve: {
    alias: [{ find: /^@strudel\/(core|webaudio)$/, replacement: "@strudel/web" }],
  },
  plugins: [partials(), potPages()],
  build: {
    rollupOptions: { input: { potluck: here("potluck.html"), meander: here("meander.html"), home: here("home.html") } },
  },
  server: {
    fs: { allow: [".."] },
    proxy: {
      "/ws": { target: `ws://${POT}`, ws: true },
      "/door": { target: `http://${POT}` },
      "/pots": { target: `http://${POT}` },
      "/source": { target: `http://${POT}` },
    },
  },
});
