import vitnode, { ignorePatterns } from "@vitnode/config/oxlint";
import vitnodeReact from "@vitnode/config/oxlint.react";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [vitnode, vitnodeReact],
  ignorePatterns: [
    ...ignorePatterns,
    ".nitro/**",
    ".output/**",
    ".tanstack/**",
    "src/*.gen.ts",
  ],
});
