import { describe, expect, it } from "vitest";

import type { AnyBlockInstance, RegisteredBlock } from "../../blocks/types";

import { field } from "../../content/fields";
import { editableBlockIssue } from "./issue";

const entry: RegisteredBlock = {
  definition: {
    component: () => null,
    fields: {
      heading: field.text({ maxLength: 200, required: true }),
      width: field.enum({ defaultValue: "prose", values: ["prose", "full"] }),
    },
    id: "text",
    name: "Text",
  },
  namespace: "core",
  pluginId: "@vitnode/core",
  type: "core:text",
};

const instance = (
  type: string,
  data: Record<string, unknown>,
): AnyBlockInstance => ({
  data,
  id: "01JEXAMPLEBLOCKSHELL00001",
  type,
});

describe("editableBlockIssue", () => {
  it("reports an unknown type when no entry is registered", () => {
    expect(
      editableBlockIssue({
        allowedBlocks: "*",
        entry: undefined,
        instance: instance("core:ghost", {}),
      }),
    ).toBe("unknown-type");
  });

  it("reports a block the zone allowlist refuses", () => {
    expect(
      editableBlockIssue({
        allowedBlocks: ["core:cta"],
        entry,
        instance: instance("core:text", { heading: "Hello", width: "prose" }),
      }),
    ).toBe("not-allowed");
  });

  it("reports data that does not match the block fields", () => {
    expect(
      editableBlockIssue({
        allowedBlocks: "*",
        entry,
        instance: instance("core:text", { heading: 12, width: "prose" }),
      }),
    ).toBe("invalid-data");
  });

  it("reports nothing for an allowed block with matching data", () => {
    expect(
      editableBlockIssue({
        allowedBlocks: ["core:*"],
        entry,
        instance: instance("core:text", { heading: "Hello", width: "prose" }),
      }),
    ).toBeNull();
  });

  it("skips the allowlist check when the zone declares none", () => {
    expect(
      editableBlockIssue({
        allowedBlocks: undefined,
        entry,
        instance: instance("core:text", { heading: "Hello", width: "prose" }),
      }),
    ).toBeNull();
  });
});
