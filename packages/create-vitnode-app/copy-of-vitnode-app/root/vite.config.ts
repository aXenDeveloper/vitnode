import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { vitnode } from "@vitnode/core/framework/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  /**
   * A second dev server has to fail rather than quietly move.
   *
   * `tanstackStart()` runs the route generator and *writes*
   * `src/routeTree.gen.ts`. Two servers means two generators owning one file: if
   * their route lists ever differ - which is precisely what happens when one was
   * started before a route file existed - they overwrite each other forever, and
   * every write is a full page reload. Without `strictPort` the second `pnpm dev`
   * says "Port 3000 is in use, trying another one" and succeeds, so the fight
   * starts silently and looks like an inexplicable refresh loop on the first
   * server.
   */
  server: { strictPort: true },
  ssr: {
    /**
     * The VitNode API packages mounted at `/api/*`, kept out of the SSR pass.
     *
     * They are Node libraries rather than app source: `@vitnode/core` loads its
     * locale files with a runtime `import("./en.json", { with: { type: "json" } })`
     * relative to its own `dist`. Bundling them in this pass moves that chunk
     * and the JSON stops resolving, which fails the build outright. Left
     * external here, Nitro resolves them from the package itself.
     *
     * Every VitNode package the app installs belongs on this list - add a
     * plugin's package name here when you install one.
     *
     * This is also what decides the shape of `@vitnode/core/tanstack/*`, so it is
     * worth naming the consequence rather than leaving it to be rediscovered.
     * Externalised here, the package skips this pass entirely and Nitro's own
     * Rollup run inlines its `dist` afterwards - and nothing in that path runs
     * the TanStack Start compiler. The *client* build has no such gap: it inlines
     * the package, so the compiler transforms it there. So package code reaches
     * the browser compiled and the server un-compiled, which is exactly why the
     * package may declare `createIsomorphicFn` (its stub falls back to the
     * `.server()` branch, which is what a server wants) and may never declare
     * `createServerFn` (un-compiled, its handler resolves to `undefined` with no
     * error at all). `packages/vitnode/src/tanstack/boundary.test.ts` holds the
     * package to that.
     *
     * Removing `@vitnode/core` from this list to close the gap was measured and
     * does not work: the SSR pass then reaches the locale barrel above and the
     * build fails on `Could not resolve './en.json'`.
     *
     * ## `tslib` is here for an entirely different reason
     *
     * It is not a VitNode package and it is not a Node library. It is here
     * because bundling it is broken, in a way that only appears in a production
     * build and only once a page renders.
     *
     * The Radix scroll-lock stack that every modal in a VitNode page pulls in -
     * `react-remove-scroll`, `use-sidecar`, `aria-hidden` - does
     * `import { __extends } from "tslib"`. Under the `node` condition that
     * resolves to `tslib/modules/index.js`, a two-line ESM shim around the
     * **CommonJS** `tslib.js`:
     *
     *     import tslib from "../tslib.js";
     *     const { __extends, … } = tslib;
     *
     * `tslib.js` defines `__esModule` on its exports, so Rolldown's CJS interop
     * helper does not synthesise a `default` - while the call site it generated
     * still reads `.default`. Every page that renders a dialog then throws
     * `Cannot destructure property '__extends' of undefined`.
     *
     * Externalised, the file is never bundled: Nitro traces the package into the
     * output and Node loads it with Node's own interop, which is correct. An
     * alias to `tslib/tslib.es6.mjs` was tried first and is worse - it fixes
     * Vite's copy and not Nitro's, because Nitro re-resolves externals itself,
     * and the tracer then copies only the file the alias named.
     */
    external: ["@vitnode/core", "tslib"],
  },
  plugins: [
    /**
     * Environment handling, the dev server's dependency pre-bundling and the
     * plugin route registry, in the order they have to run.
     *
     * `appRoot` is `import.meta.dirname` because a Vite config is loaded with
     * the working directory set to wherever the command ran, which in a
     * monorepo is regularly the repository root.
     *
     * `clientEnv` is not passed: this app publishes nothing to the browser
     * beyond the two keys VitNode inlines for every install
     * (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WEB_URL`). Anything named there is
     * compiled into JavaScript anyone can read, so a key is added only when
     * something in the browser genuinely reads it.
     */
    vitnode({ appRoot: import.meta.dirname }),
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
