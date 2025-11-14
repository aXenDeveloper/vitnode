import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["scripts/scripts.ts"],
  outDir: "dist/scripts",
  clean: false,
  minify: true,
  splitting: true,
  format: "esm",
  target: "esnext",
  platform: "node",
  external: ["jiti"],
  banner: {
    js: `import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`,
  },
});
