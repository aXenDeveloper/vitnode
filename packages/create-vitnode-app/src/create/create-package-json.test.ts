import { describe, expect, it } from "vitest";

import { apiScripts, i18nCliCommand } from "./create-package-json.js";

describe("generated scripts", () => {
  it("map each i18n script to its vitnode i18n subcommand", () => {
    expect(i18nCliCommand("i18n:check")).toBe("vitnode i18n check");
    expect(i18nCliCommand("i18n:update:ai")).toBe("vitnode i18n update-ai");
  });

  it("run a Bun API through vitnode too, with nothing to build", () => {
    const scripts = apiScripts("bun", false, false, true, "app");

    expect(scripts).toMatchObject({
      dev: "vitnode dev",
      start: "vitnode start",
    });
    expect(scripts).not.toHaveProperty("build");
  });

  it("build and start a Node API through vitnode", () => {
    expect(apiScripts("pnpm", false, false, true, "app")).toMatchObject({
      build: "vitnode build",
      dev: "vitnode dev",
      start: "vitnode start",
    });
  });
});
