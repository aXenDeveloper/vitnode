import { createElement } from "react";
import { describe, expectTypeOf, it } from "vitest";

import type { BlockAllowedSpec, ContentZoneField } from "./types";
import type { ContentZoneProps } from "./zone";

import { field } from "../content/fields";
import { ContentZone } from "./zone";

const contentField = field.blocks({ allowed: ["core:*", "example:callout"] });

describe("ContentZone props", () => {
  it("needs an id and a block list", () => {
    expectTypeOf<ContentZoneProps>().toHaveProperty("id");
    expectTypeOf<ContentZoneProps["id"]>().toEqualTypeOf<string>();
    expectTypeOf<ContentZoneProps["blocks"]>().toEqualTypeOf<
      null | readonly unknown[] | undefined
    >();
  });

  it("takes the same allowlist shape a blocks() field does", () => {
    expectTypeOf<ContentZoneProps["allowedBlocks"]>().toEqualTypeOf<
      BlockAllowedSpec | undefined
    >();
  });

  it("accepts a blocks() descriptor as the source of that allowlist", () => {
    expectTypeOf(contentField).toExtend<ContentZoneField>();

    createElement(ContentZone, {
      blocks: [],
      field: contentField,
      id: "main",
    });
  });

  it("refuses a field descriptor that carries no allowlist", () => {
    expectTypeOf(field.text({ required: true })).not.toExtend<ContentZoneField>();
  });
});
