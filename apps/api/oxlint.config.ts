import vitnode, { ignorePatterns } from "@vitnode/config/oxlint";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [vitnode],
  ignorePatterns: [...ignorePatterns, "drizzle.config.ts"],
});
