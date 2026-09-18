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

const variantEntry: RegisteredBlock = {
  ...entry,
  definition: {
    ...entry.definition,
    defaultVariant: "grid",
    variants: [{ id: "grid" }, { id: "featured" }],
  },
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
    ).toStrictEqual({ kind: "unknown-type" });
  });

  it("reports a block the zone allowlist refuses", () => {
    expect(
      editableBlockIssue({
        allowedBlocks: ["core:cta"],
        entry,
        instance: instance("core:text", { heading: "Hello", width: "prose" }),
      }),
    ).toStrictEqual({ kind: "not-allowed" });
  });

  it("reports data that does not match the block fields", () => {
    expect(
      editableBlockIssue({
        allowedBlocks: "*",
        entry,
        instance: instance("core:text", { heading: 12, width: "prose" }),
      }),
    ).toStrictEqual({
      detail: '"heading" holds a number where the field is a text',
      kind: "invalid-data",
    });
  });

  it("carries the variant it refuses, so a panel can name it without asking again", () => {
    expect(
      editableBlockIssue({
        allowedBlocks: "*",
        entry: variantEntry,
        instance: {
          ...instance("core:text", { heading: "Hello", width: "prose" }),
          variant: "gone",
        },
      }),
    ).toStrictEqual({ kind: "unknown-variant", variant: "gone" });
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

describe("the save gate looks as deep as the server does", () => {
  const strict: RegisteredBlock = {
    ...entry,
    definition: {
      ...entry.definition,
      fields: {
        heading: field.text({ minLength: 3, required: true }),
        width: field.enum({ defaultValue: "prose", values: ["prose", "full"] }),
      },
    },
  };

  const gate = (data: Record<string, unknown>) =>
    editableBlockIssue({
      allowedBlocks: "*",
      dataCheck: "schema",
      entry: strict,
      instance: instance("core:text", data),
    });

  const canvas = (data: Record<string, unknown>) =>
    editableBlockIssue({
      allowedBlocks: "*",
      entry: strict,
      instance: instance("core:text", data),
    });

  it("refuses a value the block's own field constraints reject", () => {
    expect(gate({ heading: "Hi", width: "prose" })?.kind).toBe("invalid-data");
  });

  it("refuses an enum value the block no longer declares", () => {
    expect(gate({ heading: "Hello", width: "narrow" })?.kind).toBe(
      "invalid-data",
    );
  });

  it("still draws such a block on the canvas rather than hiding it", () => {
    expect(canvas({ heading: "Hi", width: "prose" })).toBeNull();
    expect(canvas({ heading: "Hello", width: "narrow" })).toBeNull();
  });

  it("carries the reason, so the panel can say what is wrong", () => {
    const issue = gate({ heading: "Hi", width: "prose" });

    expect(issue).toStrictEqual({
      detail: expect.stringContaining("heading") as string,
      kind: "invalid-data",
    });
  });

  it("lets sound data through at both depths", () => {
    const sound = { heading: "Hello", width: "full" };

    expect(gate(sound)).toBeNull();
    expect(canvas(sound)).toBeNull();
  });

  it("never lets through what the shallower check already refuses", () => {
    const broken = [
      { heading: 12, width: "prose" },
      { heading: null, width: "prose" },
      { heading: "Hello", stray: true, width: "prose" },
    ];

    for (const data of broken) {
      expect(canvas(data)).not.toBeNull();
      expect(gate(data)).not.toBeNull();
    }
  });
});
