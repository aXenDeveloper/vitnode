import { describe, expectTypeOf, it } from "vitest";

import type { AdminNavConfig } from "@/views/admin/layouts/sidebar/nav/nav-model";

import type { AdminNavPluginSource } from "./plugin";

describe("AdminNavPluginSource", () => {
  it("is what the navigation model calls a plugin", () => {
    expectTypeOf<AdminNavPluginSource[]>().toExtend<
      AdminNavConfig["plugins"]
    >();
  });

  it("carries only what a sidebar reads", () => {
    expectTypeOf<keyof AdminNavPluginSource>().toEqualTypeOf<
      "admin" | "contentTypes" | "pluginId"
    >();
  });

  it("carries a content type without its editing screens", () => {
    type ContentType = NonNullable<
      AdminNavPluginSource["contentTypes"]
    >[number];

    expectTypeOf<keyof ContentType>().toEqualTypeOf<"definition" | "icon">();
  });
});
