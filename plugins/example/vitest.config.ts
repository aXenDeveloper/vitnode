import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Two suites run against the same real Postgres, and each one drops and
    // recreates the schema in its `beforeAll`. Run one file at a time so the
    // second does not wipe the first out from under it.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
