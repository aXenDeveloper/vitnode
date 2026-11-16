import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

const EXCLUDE = [
  ...configDefaults.exclude,
  "**/build/**",
  "**/.turbo/**",
  "**/coverage/**",
  "**/src/tests/**",
  "**/src/emails/**",
  "**/config/**",
  "**/*.config.*",
  "**/*.d.ts",
];

// Node tests share one module graph per worker (`isolate: false`), which skips
// re-evaluating the same server modules for every file. These files assert on
// process-wide state ("nothing registered yet"), so they keep a fresh graph.
const ISOLATED = [
  "src/components/ui/icon-registry.test.ts",
  "src/editor/instance/defaults.test.ts",
  "src/editor/state/repair.test.ts",
  "src/tanstack/admin/content/slots.test.ts",
  "src/tanstack/admin/transport.test.ts",
  "src/tanstack/auth/transport.test.ts",
];

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    pool: "threads",
    setupFiles: ["./src/tests/setup.ts"],
    exclude: EXCLUDE,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: EXCLUDE,
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          isolate: false,
          include: ["src/**/*.test.ts"],
          exclude: [...EXCLUDE, ...ISOLATED],
        },
      },
      {
        extends: true,
        test: {
          name: "isolated",
          environment: "node",
          include: ISOLATED,
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/tests/setup-dom.ts"],
        },
      },
      // `*.test-d.ts` files assert types only. `pnpm test:types` runs this
      // project alone; `pnpm test` leaves it out.
      {
        extends: true,
        test: {
          name: "types",
          include: [],
          typecheck: {
            enabled: true,
            only: true,
            tsconfig: "./tsconfig.json",
            include: ["**/*.test-d.ts"],
          },
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
});
