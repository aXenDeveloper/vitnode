import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**"],
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
