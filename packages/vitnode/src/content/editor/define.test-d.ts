import { createElement } from "react";
import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  AnyEditablePageDefinition,
  EditablePageDefinition,
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
  it("infers the zone ids and checks a zone against them", () => {
    expectTypeOf(settings).toEqualTypeOf<
      EditablePageDefinition<"before-profile" | "sidebar">
    >();
    assertType<AnyEditablePageDefinition>(settings);

    settings.zone("sidebar");
    // @ts-expect-error - the page declares no "footer" zone
    settings.zone("footer");
  });

  it("hands ContentZone props it accepts", () => {
    createElement(ContentZone, settings.zone("sidebar"));
  });

  it("refuses a malformed zone or permission", () => {
    defineEditablePage({
      id: "example:settings",
      permission: { module: "widgets", permission: "can_edit" },
      // @ts-expect-error - a zone is `{ allowed, min, max, default }`
      zones: { main: "core:text" },
    });
    defineEditablePage({
      id: "example:settings",
      // @ts-expect-error - `module` says where the permission lives
      permission: { permission: "can_edit" },
      zones: { main: {} },
    });
    defineEditablePage({
      id: "example:settings",
      permission: { module: "widgets", permission: "can_edit" },
      // @ts-expect-error - a default holds blocks and areas
      zones: { main: { default: [{ heading: "Welcome" }] } },
    });
  });
});
