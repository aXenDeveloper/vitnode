import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    // `*.test-d.ts` files assert types only. They run under `pnpm test:types`
    // (`vitest --typecheck`) and are skipped by the normal runtime suite.
    typecheck: {
      tsconfig: "./tsconfig.json",
      include: ["**/*.test-d.ts"],
    },
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/src/tests/**", // Assuming setup files aren't tests
      "**/src/emails/**",
      "**/config/**",
      "**/*.config.*",
      "**/*.d.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/.next/**",
        "**/.turbo/**",
        "**/coverage/**",
        "**/src/tests/**",
        "**/src/emails/**",
        "**/config/**",
        "**/scripts/**",
        "**/*.config.*",
        "**/*.d.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
