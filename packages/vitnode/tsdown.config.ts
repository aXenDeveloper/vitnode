import { defineConfig } from "tsdown";

/**
 * The `vitnode` CLI (`dist/scripts/scripts.js`, run by `cli.mjs`) and the watch
 * runner `vitnode dev` starts in a plugin package.
 *
 * Only `dist/scripts` is cleaned: `dist/src` next to it belongs to the package
 * build (`vitnode build`), which this build must never delete.
 */
export default defineConfig({
  clean: ["dist/scripts"],
  deps: { neverBundle: ["jiti"] },
  dts: false,
  entry: ["scripts/scripts.ts", "scripts/package-watch.ts"],
  fixedExtension: false,
  format: "esm",
  minify: true,
  outDir: "dist/scripts",
  platform: "node",
  target: "esnext",
});
