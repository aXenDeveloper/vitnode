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
  "src/blocks/registry.test.ts",
  "src/blocks/validate.test.ts",
  "src/components/ui/icon-registry.test.ts",
  "src/editor/instance/defaults.test.ts",
  "src/editor/state/repair.test.ts",
  "src/tanstack/admin/content/slots.test.ts",
  "src/tanstack/admin/transport.test.ts",
  "src/tanstack/auth/transport.test.ts",
  "src/ws/crossws.server.test.ts",
  "src/ws/pubsub-lifetime.test.ts",
  "src/ws/realtime-readiness.test.ts",
];

// Real builds, watchers and child processes. `pnpm test` still runs them;
// `pnpm test:unit` skips them for a fast local loop.
const INTEGRATION = [
  "scripts/cli/builder/package-build.test.ts",
  "scripts/cli/builder/scripts-build.test.ts",
  "scripts/cli/commands/plugin.test.ts",
  "scripts/cli/commands/start.test.ts",
  "scripts/cli/dev/package-watch.test.ts",
  "scripts/watch-plugin-manifest.test.ts",
  "src/api/lib/updates/lock.postgres.test.ts",
  "src/content/approvals/server/approval-notifications.postgres.test.ts",
  "src/content/server/notifications/content-notifications.postgres.test.ts",
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
      exclude: [...EXCLUDE, "**/scripts/**"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          isolate: false,
          include: ["{src,scripts}/**/*.test.ts"],
          exclude: [...EXCLUDE, ...ISOLATED, ...INTEGRATION],
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
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: INTEGRATION,
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
