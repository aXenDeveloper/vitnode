import vitnode from "@vitnode/config/oxfmt";
import { defineConfig } from "oxfmt";

export default defineConfig({
  ...vitnode,
  ignorePatterns: [
    "**/node_modules",
    "**/dist",
    "**/.output",
    "**/.nitro",
    "**/.tanstack",
    "**/.vercel",
    "**/.turbo",
    "**/.next",
    "**/*.gen.ts",
    "**/*.gen.d.ts",
    "pnpm-lock.yaml",
    "packages/create-vitnode-app/copy-of-vitnode-app",
    "packages/vitnode/test-fixtures",
  ],
});
