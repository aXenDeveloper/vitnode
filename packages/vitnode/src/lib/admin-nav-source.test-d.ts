import { describe, expectTypeOf, it } from "vitest";

import type { AdminNavConfig } from "@/views/admin/layouts/sidebar/nav/nav-model";

import type { AdminNavPluginSource } from "./plugin";

/**
 * The browser-safe navigation source, as a *type* relationship.
 *
 * One claim, and everything about the projection rests on it: an
 * `AdminNavPluginSource` is a configured plugin as far as the navigation model
 * is concerned. That is what lets `adminNavDeclarations` read a generated list
 * of these with the same rules it reads a real `VitNodeConfig.plugins` - one
 * navigation model, one set of rules, whichever door the data came through.
 *
 * A type test rather than a runtime one because there is nothing to run: if the
 * assignment holds, a host passing the projection compiles, and if it stops
 * holding the failure is a type error at every call site rather than a wrong
 * sidebar.
 */
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

  /**
   * And a content type on it is *narrower* than a registration, which is the
   * half that keeps a browser bundle small: a full registration carries field,
   * column and form overrides - React components that reach the Content Engine's
   * editing UI - and this carries what the sidebar reads and nothing else.
   */
  it("carries a content type without its editing screens", () => {
    type ContentType = NonNullable<
      AdminNavPluginSource["contentTypes"]
    >[number];

    expectTypeOf<keyof ContentType>().toEqualTypeOf<"definition" | "icon">();
  });
});
