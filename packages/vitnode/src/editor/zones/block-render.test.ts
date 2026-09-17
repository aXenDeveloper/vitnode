import { describe, expect, it } from "vitest";

import type { AnyBlockInstance, RegisteredBlock } from "../../blocks/types";

import { field } from "../../content/fields";
import { editableBlockIssue } from "../block-shell/issue";
import { editableBlockRender } from "./block-render";

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

const instance = (data: Record<string, unknown>): AnyBlockInstance => ({
  data,
  id: "01JEXAMPLEBLOCKRENDER0001",
  type: "core:text",
});

const valid = instance({ heading: "Hello", width: "prose" });

describe("editableBlockRender", () => {
  it("hands back the entry so a matching block runs its own component", () => {
    expect(editableBlockRender({ entry, instance: valid })).toStrictEqual({
      entry,
      kind: "component",
      variant: undefined,
    });
  });

  it("resolves the default variant for a block that declares variants", () => {
    expect(
      editableBlockRender({ entry: variantEntry, instance: valid }),
    ).toStrictEqual({
      entry: variantEntry,
      kind: "component",
      variant: "grid",
    });
  });

  it("refuses to render a variant the block no longer declares", () => {
    expect(
      editableBlockRender({
        entry: variantEntry,
        instance: { ...valid, variant: "gone" },
      }),
    ).toStrictEqual({ kind: "unknown-variant", variant: "gone" });
  });

  it("refuses a variant on a block that declares none at all", () => {
    expect(
      editableBlockRender({ entry, instance: { ...valid, variant: "grid" } }),
    ).toStrictEqual({ kind: "unknown-variant", variant: "grid" });
  });

  it("checks the variant before the data, so both are reported once fixed", () => {
    expect(
      editableBlockRender({
        entry: variantEntry,
        instance: { data: {}, id: valid.id, type: valid.type, variant: "gone" },
      }),
    ).toStrictEqual({ kind: "unknown-variant", variant: "gone" });
  });

  it("refuses to run a component for a type nothing registers", () => {
    expect(
      editableBlockRender({ entry: undefined, instance: valid }),
    ).toStrictEqual({ kind: "unknown-type" });
  });

  it("refuses to run a component whose stored data lost its shape", () => {
    expect(
      editableBlockRender({
        entry,
        instance: instance({ heading: 12, width: "prose" }),
      }),
    ).toStrictEqual({
      detail: '"heading" holds a number where the field is a text',
      kind: "invalid-data",
    });
  });

  it("refuses a required field that the stored data dropped", () => {
    expect(
      editableBlockRender({ entry, instance: instance({ width: "prose" }) })
        .kind,
    ).toBe("invalid-data");
  });

  it("refuses data carrying a key the block never declared", () => {
    expect(
      editableBlockRender({
        entry,
        instance: instance({ heading: "Hello", stale: true, width: "prose" }),
      }).kind,
    ).toBe("invalid-data");
  });

  it("still runs the component for a block the zone allowlist refuses, because its data is sound", () => {
    expect(editableBlockRender({ entry, instance: valid }).kind).toBe(
      "component",
    );
    expect(
      editableBlockIssue({
        allowedBlocks: ["core:cta"],
        entry,
        instance: valid,
      }),
    ).toBe("not-allowed");
  });

  it("refuses a block that is both outside the allowlist and malformed, which the badge alone reports as not-allowed", () => {
    const broken = instance({ heading: 12, width: "prose" });

    expect(
      editableBlockIssue({
        allowedBlocks: ["core:cta"],
        entry,
        instance: broken,
      }),
    ).toBe("not-allowed");
    expect(editableBlockRender({ entry, instance: broken }).kind).toBe(
      "invalid-data",
    );
  });

  it("badges a variant the block no longer declares, so the canvas says so", () => {
    expect(
      editableBlockIssue({
        allowedBlocks: undefined,
        entry: variantEntry,
        instance: { ...valid, variant: "gone" },
      }),
    ).toBe("unknown-variant");
  });

  it("badges nothing once a declared variant is picked again", () => {
    expect(
      editableBlockIssue({
        allowedBlocks: undefined,
        entry: variantEntry,
        instance: { ...valid, variant: "featured" },
      }),
    ).toBeNull();
  });

  it("goes back to the component the moment the data matches again", () => {
    const broken = instance({ heading: 12, width: "prose" });
    const fixed = { ...broken, data: { heading: "Fixed", width: "prose" } };

    expect(editableBlockRender({ entry, instance: broken }).kind).toBe(
      "invalid-data",
    );
    expect(editableBlockRender({ entry, instance: fixed }).kind).toBe(
      "component",
    );
  });
});
