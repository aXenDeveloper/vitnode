import { createElement } from "react";
import { describe, expectTypeOf, it } from "vitest";

import type { BlockAllowedSpec } from "./types";
import type { ContentZoneProps } from "./zone";

import { ContentZone } from "./zone";

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

  it("carries no way to hand it a content type", () => {
    expectTypeOf<ContentZoneProps>().not.toHaveProperty("field");
    expectTypeOf<ContentZoneProps>().not.toHaveProperty("contentType");
  });

  it("wraps in a DOM element", () => {
    expectTypeOf<"aside">().toExtend<ContentZoneProps["as"]>();
    expectTypeOf<"section">().toExtend<ContentZoneProps["as"]>();
    expectTypeOf<undefined>().toExtend<ContentZoneProps["as"]>();

    createElement(ContentZone, { as: "header", blocks: [], id: "main" });
  });

  it("refuses a component as the wrapper, which could drop the zone marker", () => {
    expectTypeOf<() => null>().not.toExtend<ContentZoneProps["as"]>();
    expectTypeOf<"not-an-element">().not.toExtend<ContentZoneProps["as"]>();
  });
});
