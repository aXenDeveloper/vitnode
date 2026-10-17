import { describe, expect, it } from "vitest";

import {
  componentUpdate,
  installedPlugin,
  pluginUpdates,
  securityFinding,
} from "@/tests/plugin-updates";

import { updateGroupsOf } from "./update-entries";

describe("updateGroupsOf", () => {
  it("splits core and plugins into security and other updates", () => {
    const groups = updateGroupsOf({
      coreTitle: "VitNode",
      plugins: [installedPlugin("@acme/blog", "Blog")],
      updates: pluginUpdates(componentUpdate("core"), [
        componentUpdate("@acme/blog", {
          securityUpdates: [securityFinding(null), securityFinding("1.0.1")],
        }),
        componentUpdate("@acme/shop", {
          latest: null,
          securityUpdates: [securityFinding(null)],
          status: "up_to_date",
        }),
        componentUpdate("@acme/up-to-date", { status: "up_to_date" }),
        componentUpdate("@acme/unchecked", null),
      ]),
    });

    expect(groups).toEqual({
      other: [
        { id: "core", security: false, title: "VitNode", version: "1.1.0" },
      ],
      security: [
        { id: "@acme/blog", security: true, title: "Blog", version: "1.1.0" },
        {
          id: "@acme/shop",
          security: true,
          title: "@acme/shop",
          version: null,
        },
      ],
    });
  });

  it("falls back to the first fixed version when no newer release is available", () => {
    const groups = updateGroupsOf({
      coreTitle: "VitNode",
      plugins: undefined,
      updates: pluginUpdates(
        componentUpdate("core", {
          securityUpdates: [securityFinding(null), securityFinding("2.0.1")],
          status: "up_to_date",
        }),
      ),
    });

    expect(groups.security[0]?.version).toBe("2.0.1");
  });
});
