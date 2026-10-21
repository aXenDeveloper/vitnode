import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { vitnode } from "@vitnode/core/framework/vite";
import { defineConfig } from "vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: { strictPort: true },
  plugins: [
    vitnode({
      appRoot: import.meta.dirname,
      nitro: { rollupConfig: { external: [/^@sentry\//] } },
      webSocket: true,
    }),
    devtools(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
