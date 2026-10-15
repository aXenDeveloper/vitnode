import { describe, expect, it } from "vitest";

import { buildPlugin } from "./plugin";

describe("buildPlugin metadata", () => {
  it("refuses metadata generated for another package", () => {
    expect(() =>
      buildPlugin({
        metadata: {
          description: null,
          id: "@acme/blog",
          title: "Blog",
          version: "1.0.0",
        },
        pluginId: "@acme/shop",
      }),
    ).toThrow(
      /^\[VitNode plugin metadata\] buildPlugin\(\) registers the plugin "@acme\/shop" with the metadata of "@acme\/blog"/,
    );
  });
});
