import vitnode from "@vitnode/config/oxfmt";
import { defineConfig } from "oxfmt";

export default defineConfig({
  ...vitnode,
  ignorePatterns: ["dist"],
});
