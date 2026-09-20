// @vitest-environment node
import { getTableConfig } from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it } from "vitest";

import type { AnyBlockInstance, ContentNode } from "@/blocks/types";

import {
  CONTENT_BLOCKS_ABSOLUTE_MAX,
  CONTENT_BLOCKS_DEFAULT_MAX,
} from "@/blocks/const";
import { defineBlock } from "@/blocks/define";
import { isBlockInstance } from "@/blocks/instance";
import {
  createBlockRegistry,
  setDefaultBlockRegistry,
} from "@/blocks/registry";

import { defineContentType } from "./define";
import { ContentEngineError } from "./errors";
import { field } from "./fields";
import { createContentTable } from "./server/table";
import { createContentTranslationTable } from "./server/translation-table";

const Noop = () => null;

const blocksOf = (nodes: readonly ContentNode[]): AnyBlockInstance[] =>
  nodes.filter((node): node is AnyBlockInstance => isBlockInstance(node));

const heroBlock = defineBlock({
  component: Noop,
  fields: {
    description: field.textarea({ nullable: true }),
    title: field.text({ maxLength: 20, required: true }),
    variant: field.enum({
      defaultValue: "default",
      values: ["default", "centered"],
    }),
  },
  id: "hero",
});

const latestPostsBlock = defineBlock({
  component: Noop,
  fields: { limit: field.number({ integer: true, max: 12, min: 1 }) },
  id: "latest-posts",
});

beforeAll(() => {
  setDefaultBlockRegistry(
    createBlockRegistry([
      { pluginId: "@vitnode/core", blocks: [heroBlock], namespace: "core" },
      { pluginId: "@vitnode/blog", blocks: [latestPostsBlock] },
    ]),
  );
});

const pageContentType = defineContentType({
  id: "test.page",
  tableName: "test_blocks_pages",
  fields: {
    content: field.blocks({ allowed: ["core:hero", "blog:latest-posts"] }),
    title: field.text({ required: true }),
  },
});

const openContentType = defineContentType({
  id: "test.open-page",
  tableName: "test_blocks_open_pages",
  fields: {
    content: field.blocks(),
    title: field.text({ required: true }),
  },
});

const atLeastOneContentType = defineContentType({
  id: "test.required-zone",
  tableName: "test_blocks_required",
  fields: {
    content: field.blocks({ allowed: ["core:hero"], min: 1 }),
    optional: field.blocks({ allowed: ["core:hero"], min: 0 }),
    title: field.text({ required: true }),
  },
});

const instance = (type: string, data: Record<string, unknown>, id: string) => ({
  data,
  id,
  type,
});

const defineBlocksField = (
  suffix: string,
  bounds: { max?: number; min?: number },
) =>
  defineContentType({
    id: `test.blocks-${suffix}`,
    tableName: `test_blocks_${suffix.replaceAll("-", "_")}`,
    fields: { content: field.blocks(bounds) },
  });

describe("field.blocks", () => {
  it("defaults to accepting every registered block", () => {
    expect(openContentType.fields.content.allowed).toBe("*");
  });

  it("is never required and never nullable", () => {
    expect(pageContentType.fields.content.required).toBe(false);
    expect(pageContentType.fields.content.nullable).toBe(false);
  });

  it("refuses an allowlist that names no blocks", () => {
    expect(() =>
      defineContentType({
        id: "test.empty-allow",
        tableName: "test_blocks_empty",
        fields: { content: field.blocks({ allowed: [] }) },
      }),
    ).toThrow(/allows no blocks/);
  });

  it("refuses an allowlist entry that is not a block id", () => {
    expect(() =>
      defineContentType({
        id: "test.bad-allow",
        tableName: "test_blocks_bad",
        fields: { content: field.blocks({ allowed: ["hero"] }) },
      }),
    ).toThrow(/not a block id/);
  });

  it("refuses a min no value could satisfy", () => {
    expect(() =>
      defineContentType({
        id: "test.min-over-max",
        tableName: "test_blocks_min_over_max",
        fields: { content: field.blocks({ max: 5, min: 10 }) },
      }),
    ).toThrow(/min 10 greater than max 5/);

    expect(() =>
      defineContentType({
        id: "test.min-over-default",
        tableName: "test_blocks_min_over_default",
        fields: {
          content: field.blocks({ min: CONTENT_BLOCKS_DEFAULT_MAX + 1 }),
        },
      }),
    ).toThrow(/stores at most 200 blocks unless it raises/);
  });

  it("accepts a min the field can actually reach", () => {
    expect(() =>
      defineContentType({
        id: "test.min-at-default",
        tableName: "test_blocks_min_at_default",
        fields: { content: field.blocks({ min: CONTENT_BLOCKS_DEFAULT_MAX }) },
      }),
    ).not.toThrow();

    expect(() =>
      defineContentType({
        id: "test.min-equals-max",
        tableName: "test_blocks_min_equals_max",
        fields: { content: field.blocks({ max: 5, min: 5 }) },
      }),
    ).not.toThrow();
  });

  it("refuses a max that is not a whole number in range", () => {
    expect(() => defineBlocksField("max-nan", { max: Number.NaN })).toThrow(
      /max of NaN; it must be a whole number between 1 and 1000/,
    );

    expect(() => defineBlocksField("max-fraction", { max: 1.5 })).toThrow(
      /max of 1.5; it must be a whole number/,
    );

    expect(() => defineBlocksField("max-zero", { max: 0 })).toThrow(
      /max of 0; it must be a whole number/,
    );

    expect(() =>
      defineBlocksField("max-over-absolute", {
        max: CONTENT_BLOCKS_ABSOLUTE_MAX + 1,
      }),
    ).toThrow(/max of 1001; it must be a whole number/);
  });

  it("refuses a min that is not a whole number at or above zero", () => {
    expect(() => defineBlocksField("min-nan", { min: Number.NaN })).toThrow(
      /min of NaN; it must be a whole number that is zero or more/,
    );

    expect(() => defineBlocksField("min-fraction", { min: 1.5 })).toThrow(
      /min of 1.5; it must be a whole number that is zero or more/,
    );

    expect(() => defineBlocksField("min-negative", { min: -1 })).toThrow(
      /min of -1; it must be a whole number that is zero or more/,
    );
  });

  it("accepts bounds at the top of the allowed range", () => {
    expect(() =>
      defineBlocksField("min-max-absolute", {
        max: CONTENT_BLOCKS_ABSOLUTE_MAX,
        min: CONTENT_BLOCKS_ABSOLUTE_MAX,
      }),
    ).not.toThrow();

    expect(() => defineBlocksField("no-bounds", {})).not.toThrow();
  });

  it("refuses to be indexed", () => {
    expect(() =>
      defineContentType({
        id: "test.indexed",
        tableName: "test_blocks_indexed",
        fields: { content: field.blocks() },
        indexes: [{ on: ["content"] }],
      }),
    ).toThrow(ContentEngineError);
  });
});

describe("storage", () => {
  const config = getTableConfig(createContentTable(pageContentType));
  const column = config.columns.find(item => item.name === "content");

  it("is one JSONB column on the row", () => {
    expect(column?.getSQLType()).toBe("jsonb");
  });

  it("is NOT NULL and defaults to an empty list", () => {
    expect(column?.notNull).toBe(true);
    expect(column?.default).toStrictEqual([]);
  });

  it("lives on the translation table when the zone is localized", () => {
    const localizedPage = defineContentType({
      id: "test.localized-page",
      tableName: "test_blocks_localized",
      localization: { defaultLocale: "en", enabled: true },
      fields: {
        content: field.blocks({ localized: true }),
        title: field.text({ required: true }),
      },
    });

    const table = createContentTable(localizedPage);
    const base = getTableConfig(table);
    const translations = getTableConfig(
      createContentTranslationTable(localizedPage, { table }),
    );

    expect(base.columns.map(item => item.name)).not.toContain("content");
    expect(
      translations.columns.find(item => item.name === "content")?.getSQLType(),
    ).toBe("jsonb");
  });

  it("refuses a localized zone with no localization block", () => {
    expect(() =>
      defineContentType({
        id: "test.stray",
        tableName: "test_blocks_stray",
        fields: { content: field.blocks({ localized: true }) },
      }),
    ).toThrow(/no .localization.*block/s);
  });
});

describe("create schema", () => {
  const create = pageContentType.schemas.create;

  it("defaults an omitted zone to no blocks", () => {
    expect(create.parse({ title: "Home" })).toStrictEqual({
      content: [],
      title: "Home",
    });
  });

  it("keeps the order it was given and the id of every instance", () => {
    const content =
      create.parse({
        title: "Home",
        content: [
          instance("blog:latest-posts", { limit: 6 }, "02"),
          instance("core:hero", { title: "Build" }, "01"),
        ],
      }).content ?? [];

    expect(content.map(block => block.id)).toStrictEqual(["02", "01"]);
    expect(blocksOf(content).map(block => block.type)).toStrictEqual([
      "blog:latest-posts",
      "core:hero",
    ]);
  });

  it("validates data against the block's own field schema", () => {
    const content =
      create.parse({
        title: "Home",
        content: [instance("core:hero", { title: "Build" }, "01")],
      }).content ?? [];

    expect(blocksOf(content)[0]?.data).toStrictEqual({
      title: "Build",
      variant: "default",
    });
  });

  it("rejects data the block's fields refuse", () => {
    const parsed = create.safeParse({
      title: "Home",
      content: [
        instance("core:hero", { title: "a title that is far too long" }, "01"),
      ],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toStrictEqual(["content", 0]);
  });

  it("rejects a block the field does not allow", () => {
    const parsed = create.safeParse({
      title: "Home",
      content: [instance("core:cta", {}, "01")],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toMatch(/not allowed/);
  });

  it("rejects a block no plugin registers", () => {
    const parsed = openContentType.schemas.create.safeParse({
      title: "Home",
      content: [instance("shop:cart", {}, "01")],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toMatch(/not registered/);
  });

  it("rejects two instances sharing an id", () => {
    const parsed = create.safeParse({
      title: "Home",
      content: [
        instance("core:hero", { title: "One" }, "01"),
        instance("core:hero", { title: "Two" }, "01"),
      ],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toMatch(/more than once/);
  });

  it("rejects an instance with no id", () => {
    const parsed = create.safeParse({
      title: "Home",
      content: [{ data: { title: "Build" }, type: "core:hero" }],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("update schema", () => {
  it("leaves the zone alone when the patch does not mention it", () => {
    expect(
      pageContentType.schemas.update.parse({ title: "Renamed" }),
    ).toStrictEqual({ title: "Renamed" });
  });

  it("replaces the whole zone when it does", () => {
    expect(
      pageContentType.schemas.update.parse({
        content: [instance("blog:latest-posts", { limit: 3 }, "01")],
      }),
    ).toStrictEqual({
      content: [{ data: { limit: 3 }, id: "01", type: "blog:latest-posts" }],
    });
  });
});

describe("AdminCP surfaces", () => {
  it("keeps the zone out of the generated list columns", () => {
    expect(pageContentType.admin.list.columns).not.toContain("content");
  });

  it("keeps the zone out of the generated form", () => {
    expect(pageContentType.admin.form.fields).not.toContain("content");
  });
});

describe("a zone with a min", () => {
  const create = atLeastOneContentType.schemas.create;
  const update = atLeastOneContentType.schemas.update;
  const hero = instance("core:hero", { title: "Build" }, "01");

  it("rejects a create that leaves the zone out", () => {
    const parsed = create.safeParse({ title: "Home" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toStrictEqual(["content"]);
    expect(parsed.error?.issues[0].message).toMatch(/needs at least 1 block/);
  });

  it("rejects a create that sends an empty zone", () => {
    const parsed = create.safeParse({ content: [], title: "Home" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toMatch(/needs at least 1 block/);
  });

  it("accepts a create that sends a block", () => {
    expect(
      create.parse({ content: [hero], title: "Home" }).content,
    ).toStrictEqual([
      {
        data: { title: "Build", variant: "default" },
        id: "01",
        type: "core:hero",
      },
    ]);
  });

  it("still defaults a zone whose min is zero to no blocks", () => {
    expect(
      create.parse({ content: [hero], title: "Home" }).optional,
    ).toStrictEqual([]);
  });

  it("leaves the zone untouched when a patch says nothing about it", () => {
    expect(update.parse({ title: "Renamed" })).toStrictEqual({
      title: "Renamed",
    });
  });

  it("rejects a patch that explicitly empties the zone", () => {
    const parsed = update.safeParse({ content: [] });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toMatch(/needs at least 1 block/);
  });
});
