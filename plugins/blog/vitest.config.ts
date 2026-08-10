import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**"],
    // The migration suite drops and rebuilds the schema in its `beforeAll`, so
    // it must not share a database with another file running at the same time.
    fileParallelism: false,
    typecheck: {
      tsconfig: "./tsconfig.json",
      include: ["**/*.test-d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
