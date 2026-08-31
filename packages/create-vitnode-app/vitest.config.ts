import { defineConfig } from "vitest/config";

/**
 * The scaffold's pure half, under test.
 *
 * Only the template generators run here - functions from a plugin's name to the
 * bytes a new plugin starts with. Nothing in this suite spawns the CLI, creates
 * a project or touches a filesystem: what is worth pinning is that a scaffolded
 * plugin's manifest, route module and package exports are exactly what VitNode's
 * build reads, and that is a string comparison.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
