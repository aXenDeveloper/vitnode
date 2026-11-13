import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { vitnode } from "@vitnode/core/framework/vite";
import { defineConfig } from "vite";

const config = defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  server: { strictPort: true },
  plugins: [
    vitnode({
      appRoot: import.meta.dirname,
      // `vite build` makes one Cloudflare Worker: the site, the API and the
      // realtime hub, with `wrangler.jsonc` merged into its config. `vite dev`
      // stays on Node.
      nitro: command === "build" ? { preset: "cloudflare-module" } : {},
      // `/api/ws` is served by the `VitNodeRealtimeHub` Durable Object.
      webSocket: { transport: "cloudflare" },
    }),
    devtools(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}));

export default config;
