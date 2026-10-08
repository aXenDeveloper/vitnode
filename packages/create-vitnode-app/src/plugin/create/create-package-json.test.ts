import { describe, expect, it } from "vitest";

import { pluginScripts } from "./create-package-json.js";

describe("pluginScripts", () => {
  it("lints the plugin itself with type-aware Oxlint", () => {
    expect(pluginScripts(true)).toMatchObject({
      lint: "oxlint --type-aware",
      "lint:fix": "oxlint --type-aware --fix",
    });
  });

  it("has no lint scripts without Oxlint", () => {
    expect(pluginScripts(false)).not.toHaveProperty("lint");
  });
});
