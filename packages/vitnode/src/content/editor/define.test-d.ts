import { createElement } from "react";
import { assertType, describe, expectTypeOf, it } from "vitest";

import type { ContentZoneProps } from "../../blocks/zone";
import type {
  AnyEditablePageDefinition,
  EditablePageDefinition,
  EditablePageZoneProps,
} from "./types";

import { ContentZone } from "../../blocks/zone";
import { defineEditablePage } from "./define";

const settings = defineEditablePage({
  id: "example:settings",
  permission: { module: "widgets", permission: "can_edit" },
  zones: {
    "before-profile": { allowed: ["core:text"], max: 20 },
    sidebar: { allowed: ["core:text"] },
  },
});

describe("defineEditablePage", () => {
  it("infers the zone ids the page declares", () => {
    expectTypeOf(settings).toEqualTypeOf<
      EditablePageDefinition<"before-profile" | "sidebar">
    >();
  });

  it("checks a zone id against them", () => {
    expectTypeOf(settings.zone)
      .parameter(0)
      .toEqualTypeOf<"before-profile" | "sidebar">();

    settings.zone("sidebar");
    settings.zone("before-profile");

    // @ts-expect-error - the page declares no "footer" zone
    settings.zone("footer");
  });

  it("is still an editable page whatever it declares, so a registry can hold it", () => {
    assertType<AnyEditablePageDefinition>(settings);

    expectTypeOf(settings.zoneIds).toEqualTypeOf<readonly string[]>();
    expectTypeOf(settings.id).toEqualTypeOf<string>();
  });

  it("refuses a zone declared as something other than an object", () => {
    defineEditablePage({
      id: "example:settings",
      permission: { module: "widgets", permission: "can_edit" },
      // @ts-expect-error - a zone is `{ allowed, min, max, default }`
      zones: { main: "core:text" },
    });
  });

  it("refuses a permission that is not one", () => {
    defineEditablePage({
      id: "example:settings",
      // @ts-expect-error - a permission is an object, never a bare string
      permission: "can_edit",
      zones: { main: {} },
    });
  });

  it("refuses a permission that names no module", () => {
    defineEditablePage({
      id: "example:settings",
      // @ts-expect-error - `module` says where the permission lives
      permission: { permission: "can_edit" },
      zones: { main: {} },
    });
  });

  it("still takes a page that names another plugin's module", () => {
    defineEditablePage({
      id: "example:settings",
      permission: {
        module: "widgets",
        permission: "can_edit",
        plugin: "@vitnode/core",
      },
      zones: { main: {} },
    });
  });

  it("refuses an allowlist that is not one", () => {
    defineEditablePage({
      id: "example:settings",
      permission: { module: "widgets", permission: "can_edit" },
      // @ts-expect-error - an allowlist is `"*"` or a list of block ids
      zones: { main: { allowed: 3 } },
    });
  });

  it("refuses a default that is not a list of nodes", () => {
    defineEditablePage({
      id: "example:settings",
      permission: { module: "widgets", permission: "can_edit" },
      // @ts-expect-error - a default holds blocks and areas
      zones: { main: { default: [{ heading: "Welcome" }] } },
    });
  });
});

describe("zone props", () => {
  it("hands `ContentZone` its allowlist and its id", () => {
    const props: EditablePageZoneProps = settings.zone("sidebar");

    expectTypeOf(props.id).toExtend<ContentZoneProps["id"]>();
    expectTypeOf(props.allowedBlocks).toExtend<
      ContentZoneProps["allowedBlocks"]
    >();

    assertType<ContentZoneProps>(props);
    createElement(ContentZone, settings.zone("sidebar"));
  });

  it("lets a zone inside an editable page name nothing but its id", () => {
    assertType<ContentZoneProps>({ id: "sidebar" });
    createElement(ContentZone, { id: "sidebar" });
  });
});
