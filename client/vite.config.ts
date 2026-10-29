import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: [{ find: /^@strudel\/(core|webaudio)$/, replacement: "@strudel/web" }],
  },
  server: {
    fs: { allow: [".."] },
    proxy: {
      "/ws": { target: `ws://localhost:${process.env.POT_PORT ?? 8787}`, ws: true },
      "/door": { target: `http://localhost:${process.env.POT_PORT ?? 8787}` },
      "/source": { target: `http://localhost:${process.env.POT_PORT ?? 8787}` },
    },
  },
});
