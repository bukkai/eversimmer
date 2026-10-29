import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: [{ find: /^@strudel\/(core|webaudio)$/, replacement: "@strudel/web" }],
  },
  build: { rollupOptions: { input: { main: fileURLToPath(new URL("index.html", import.meta.url)), home: fileURLToPath(new URL("home.html", import.meta.url)) } } },
  server: {
    fs: { allow: [".."] },
    proxy: {
      "/ws": { target: `ws://localhost:${process.env.POT_PORT ?? 8787}`, ws: true },
      "/door": { target: `http://localhost:${process.env.POT_PORT ?? 8787}` },
      "/pots": { target: `http://localhost:${process.env.POT_PORT ?? 8787}` },
      "/source": { target: `http://localhost:${process.env.POT_PORT ?? 8787}` },
    },
  },
});
