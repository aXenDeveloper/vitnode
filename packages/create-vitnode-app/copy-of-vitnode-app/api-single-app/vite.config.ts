import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { vitnode } from "@vitnode/core/framework/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: { strictPort: true },
  plugins: [
    // `webSocket` connects the browser to this app's own `/api/ws`.
    vitnode({ appRoot: import.meta.dirname, webSocket: true }),
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      // `/api/ws` is a Nitro route, so the upgrade never reaches the TanStack
      // Start catch-all; every other `/api/*` request still does.
      features: { websocket: true },
      handlers: [
        {
          handler: `${import.meta.dirname}/src/server/websocket.ts`,
          route: "/api/ws",
        },
      ],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
