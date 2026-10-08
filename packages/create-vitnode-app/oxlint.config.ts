import vitnode, { ignorePatterns } from "@vitnode/config/oxlint";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [vitnode],
  rules: {
    "no-console": "off",
  },
  ignorePatterns: [
    ...ignorePatterns,
    "copy-of-vitnode-app",
    "copy-of-vitnode-plugin",
  ],
});
