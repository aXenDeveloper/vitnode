// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { AnyBlockVariantDefinition } from "./types";

import { field } from "../content/fields";
import { defineBlock } from "./define";
import { BlockError } from "./errors";
import { parseBlockData } from "./schema";

const Noop = () => null;

describe("defineBlock", () => {
  it("keeps the id it was given, unnamespaced", () => {
    const block = defineBlock({
      component: Noop,
      fields: { title: field.text({ required: true }) },
      id: "latest-posts",
    });

    expect(block.id).toBe("latest-posts");
  });

  it("refuses an id that is already namespaced", () => {
    expect(() =>
      defineBlock({
        component: Noop,
        fields: { title: field.text({ required: true }) },
        id: "blog:latest-posts",
      }),
    ).toThrow(BlockError);
  });

  it("refuses an id that is not lowercase kebab-case", () => {
    expect(() =>
      defineBlock({
        component: Noop,
        fields: { title: field.text() },
        id: "LatestPosts",
      }),
    ).toThrow(/lowercase letters/);
  });

  it("refuses a block with no fields", () => {
    expect(() =>
      defineBlock({ component: Noop, fields: {}, id: "empty" }),
    ).toThrow(/at least one field/);
  });

  it("refuses a field kind a JSON document cannot hold", () => {
    expect(() =>
      defineBlock({
        component: Noop,
        fields: { cover: field.file({ maxBytes: 1024 }) },
        id: "cover",
      }),
    ).toThrow(/Supported kinds/);
  });

  it("refuses a localized field, and points at the zone instead", () => {
    expect(() =>
      defineBlock({
        component: Noop,
        fields: { title: field.text({ localized: true, required: true }) },
        id: "hero",
      }),
    ).toThrow(/field\.blocks\(\{ localized: true \}\)/);
  });

  it("refuses a disallowed kind nested in a group", () => {
    expect(() =>
      defineBlock({
        component: Noop,
        fields: {
          media: field.group({
            fields: { alt: field.text({ nullable: true }) },
          }),
        },
        id: "media",
      }),
    ).not.toThrow();
  });

  it("refuses a field whose own constraints no value could satisfy", () => {
    expect(() =>
      defineBlock({
        component: Noop,
        fields: { title: field.text({ maxLength: 3, minLength: 10 }) },
        id: "hero",
      }),
    ).toThrow(BlockError);
    expect(() =>
      defineBlock({
        component: Noop,
        fields: { weight: field.number({ integer: true, max: 1, min: 10 }) },
        id: "hero",
      }),
    ).toThrow(/min 10 greater than max 1/);
  });

  it("refuses a default the field's own bounds would reject", () => {
    expect(() =>
      defineBlock({
        component: Noop,
        fields: {
          weight: field.number({ defaultValue: 99, integer: true, max: 10 }),
        },
        id: "hero",
      }),
    ).toThrow(/above its own max of 10/);
  });

  describe("variants", () => {
    const cards = (declaration: {
      defaultVariant?: string;
      variants?: readonly AnyBlockVariantDefinition[];
    }) =>
      defineBlock({
        component: Noop,
        fields: { title: field.text({ required: true }) },
        id: "cards",
        ...declaration,
      });

    it("keeps the variants and the default it was given", () => {
      const block = cards({
        defaultVariant: "grid",
        variants: [{ id: "grid" }, { id: "featured" }],
      });

      expect(block.variants?.map(variant => variant.id)).toStrictEqual([
        "grid",
        "featured",
      ]);
      expect(block.defaultVariant).toBe("grid");
    });

    it("leaves both absent for a block that offers one layout", () => {
      const block = cards({});

      expect(block.variants).toBeUndefined();
      expect(block.defaultVariant).toBeUndefined();
    });

    it("refuses a variant id that is not lowercase kebab-case", () => {
      expect(() => cards({ variants: [{ id: "Grid" }] })).toThrow(
        /lowercase letters/,
      );
      expect(() => cards({ variants: [{ id: "" }] })).toThrow(
        /lowercase letters/,
      );
      expect(() => cards({ variants: [{ id: "a".repeat(33) }] })).toThrow(
        /at most 32 characters/,
      );
    });

    it("refuses two variants sharing an id", () => {
      expect(() =>
        cards({ variants: [{ id: "grid" }, { id: "grid" }] }),
      ).toThrow(/declared twice/);
    });

    it("refuses an empty list rather than shipping an empty picker", () => {
      expect(() => cards({ variants: [] })).toThrow(/list of nothing/);
    });

    it("refuses a default that names no declared variant", () => {
      expect(() =>
        cards({
          defaultVariant: "carousel",
          variants: [{ id: "grid" }, { id: "featured" }],
        }),
      ).toThrow(/does not declare/);
    });

    it("refuses a default on a block that declares no variants", () => {
      expect(() => cards({ defaultVariant: "grid" })).toThrow(
        /declares no `variants`/,
      );
    });
  });

  describe("parseBlockData", () => {
    const block = defineBlock({
      component: Noop,
      fields: {
        description: field.textarea({ nullable: true }),
        title: field.text({ maxLength: 10, required: true }),
        variant: field.enum({
          defaultValue: "default",
          values: ["default", "centered"],
        }),
      },
      id: "hero",
    });

    it("applies the defaults declared by the fields", () => {
      expect(parseBlockData(block, { title: "Build" })).toStrictEqual({
        title: "Build",
        variant: "default",
      });
    });

    it("rejects a value that breaks a field constraint", () => {
      expect(() =>
        parseBlockData(block, { title: "far too long to fit" }),
      ).toThrow(BlockError);
    });

    it("rejects a required field that is missing", () => {
      expect(() => parseBlockData(block, {})).toThrow(/title/);
    });

    it("rejects keys the block does not declare", () => {
      expect(() =>
        parseBlockData(block, { hacked: true, title: "Build" }),
      ).toThrow(BlockError);
    });
  });
});
