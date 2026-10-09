import { describe, expect, it } from "vitest";

import {
  apiScripts,
  i18nCliCommand,
  rootScripts,
  singleAppScripts,
  webScripts,
} from "./create-package-json.js";

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

  it("lint every app with type-aware Oxlint when Oxlint is chosen", () => {
    const oxlint = {
      lint: "oxlint --type-aware",
      "lint:fix": "oxlint --type-aware --fix",
    };

    expect(apiScripts("pnpm", true, false, false, "app")).toMatchObject(oxlint);
    expect(singleAppScripts(true, false, "app")).toMatchObject(oxlint);
    expect(webScripts(true)).toMatchObject(oxlint);
  });

  it("add the Oxfmt format script to the root, the single app and a standalone API", () => {
    expect(singleAppScripts(true, false, "app")).toHaveProperty(
      "format",
      "oxfmt",
    );
    expect(apiScripts("pnpm", true, false, true, "app")).toHaveProperty(
      "format",
    );
    expect(rootScripts(true, false, "app", "pnpm", "apps/web")).toMatchObject({
      lint: "turbo lint",
      format: "oxfmt",
    });
    expect(apiScripts("pnpm", true, false, false, "app")).not.toHaveProperty(
      "format",
    );
    expect(webScripts(true)).not.toHaveProperty("format");
  });

  it("skip lint and format scripts without Oxlint", () => {
    const scripts = singleAppScripts(false, false, "app");

    expect(scripts).not.toHaveProperty("lint");
    expect(scripts).not.toHaveProperty("format");
  });
});
