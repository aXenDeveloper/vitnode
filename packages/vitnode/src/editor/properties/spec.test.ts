import { describe, expect, it } from "vitest";
import z from "zod";

import type { RegisteredBlock } from "../../blocks/types";

import { blocks as builtInBlocks } from "../../blocks/built-in";
import { defineBlock } from "../../blocks/define";
import { createBlockRegistry } from "../../blocks/registry";
import { safeParseBlockData } from "../../blocks/schema";
import { buildFormSchemaFromSpec } from "../../content/admin/spec";
import { field } from "../../content/fields";
import { getDefaults } from "../../lib/helpers/auto-form";
import { createBlockInstanceFor } from "../instance/defaults";
import {
  blockDataFromFormValues,
  blockDisplayName,
  blockFieldPatchEntries,
  blockFieldSpecs,
  blockFormSpec,
  normalizeBlockFieldValue,
} from "./spec";

const sampleBlock = defineBlock({
  component: () => null,
  fields: {
    body: field.textarea({ maxLength: 600, minLength: 1, required: true }),
    publishedAt: field.dateTime(),
    seo: field.group({
      fields: {
        metaTitle: field.text({ maxLength: 60, nullable: true }),
      },
      nullable: true,
    }),
    tone: field.enum({
      defaultValue: "info",
      display: "radio",
      values: ["info", "call_to_action"],
    }),
    weight: field.number({ integer: true, max: 10, min: 1 }),
  },
  id: "sample",
  name: "Sample",
});

const unnamedBlock = defineBlock({
  component: () => null,
  fields: { title: field.text({ required: true }) },
  id: "pull-quote",
});

const registry = createBlockRegistry([
  {
    blocks: [sampleBlock, unnamedBlock],
    namespace: "sample",
    pluginId: "@vitnode/sample",
  },
]);

const entry = (type: string): RegisteredBlock => {
  const found = registry.get(type);
  if (!found) throw new Error(`missing ${type}`);

  return found;
};

describe("blockFieldSpecs", () => {
  it("keeps the fields in declaration order", () => {
    expect(blockFieldSpecs(sampleBlock).map(spec => spec.name)).toStrictEqual([
      "body",
      "publishedAt",
      "seo",
      "tone",
      "weight",
    ]);
  });

  it("humanises a label the block never translated", () => {
    const [, publishedAt] = blockFieldSpecs(sampleBlock);

    expect(publishedAt.label).toBe("Published at");
  });

  it("carries the rules a field is validated by", () => {
    const [body, , , tone, weight] = blockFieldSpecs(sampleBlock);

    expect(body).toMatchObject({
      kind: "textarea",
      maxLength: 600,
      minLength: 1,
      nullable: false,
      required: true,
    });
    expect(tone).toMatchObject({
      defaultValue: "info",
      display: "radio",
      kind: "enum",
    });
    expect(tone.options).toStrictEqual([
      { label: "Info", value: "info" },
      { label: "Call to action", value: "call_to_action" },
    ]);
    expect(weight).toMatchObject({
      integer: true,
      kind: "number",
      max: 10,
      min: 1,
    });
  });

  it("projects a group's leaves under their own labels", () => {
    const [, , seo] = blockFieldSpecs(sampleBlock);

    expect(seo.kind).toBe("group");
    expect(seo.nullable).toBe(true);
    expect(seo.fields).toStrictEqual([
      {
        defaultValue: undefined,
        kind: "text",
        label: "Meta title",
        maxLength: 60,
        minLength: undefined,
        name: "metaTitle",
        nullable: true,
        required: false,
      },
    ]);
  });
});

describe("blockFormSpec", () => {
  it("describes the block as a form the shared builders understand", () => {
    const spec = blockFormSpec(entry("sample:sample"));

    expect(spec).toMatchObject({
      contentTypeId: "sample:sample",
      defaultLocale: null,
      pluginId: "@vitnode/sample",
      sections: [],
      titleField: null,
    });
    expect(spec.fields).toHaveLength(5);
  });
});

describe("blockDisplayName", () => {
  it("prefers the declared name and humanises the id without one", () => {
    expect(blockDisplayName(entry("sample:sample"))).toBe("Sample");
    expect(blockDisplayName(entry("sample:pull-quote"))).toBe("Pull quote");
  });
});

const openedInEditor = (
  entry: RegisteredBlock,
  data: Record<string, unknown>,
) => {
  const schema = buildFormSchemaFromSpec(blockFormSpec(entry), data);
  const parsed = schema.safeParse(getDefaults(z.toJSONSchema(schema)));
  if (!parsed.success) throw parsed.error;

  return blockDataFromFormValues(data, parsed.data);
};

describe("blockDataFromFormValues", () => {
  it("keeps what the form cannot express and takes everything it can", () => {
    expect(
      blockDataFromFormValues(
        { body: "a", seo: { title: "t" }, tone: "info" },
        { body: "b", seo: undefined },
      ),
    ).toStrictEqual({ body: "b", seo: { title: "t" }, tone: "info" });
  });

  it("opens every built-in block on exactly the data it was given", () => {
    const registry = createBlockRegistry([builtInBlocks]);

    for (const entry of registry.all()) {
      const { data } = createBlockInstanceFor(entry);

      expect(openedInEditor(entry, data)).toStrictEqual(data);
    }
  });

  it("opens a block with a nullable group without dropping it", () => {
    const grouped = defineBlock({
      component: () => null,
      fields: {
        seo: field.group({
          fields: { title: field.text({ nullable: true }) },
          nullable: true,
        }),
        title: field.text({ minLength: 1, required: true }),
      },
      id: "grouped",
    });
    const entry: RegisteredBlock = {
      definition: grouped,
      namespace: "sample",
      pluginId: "@vitnode/sample",
      type: "sample:grouped",
    };
    const { data } = createBlockInstanceFor(entry);

    expect(data.seo).toStrictEqual({ title: null });
    expect(openedInEditor(entry, data)).toStrictEqual(data);
  });
});

const ISO = "2026-09-19T10:00:00.000Z";

const seoGroup = field.group({
  fields: {
    caption: field.text({ required: true }),
    note: field.text({ minLength: 0 }),
    publishedAt: field.dateTime(),
    retiredAt: field.dateTime({ nullable: true }),
    subtitle: field.text({ minLength: 3 }),
    weight: field.number({ integer: true, min: 1 }),
  },
});

const detailBlock = defineBlock({
  component: () => null,
  fields: { headline: field.text({ required: true }), seo: seoGroup },
  id: "detail",
});

const detailEntry: RegisteredBlock = {
  definition: detailBlock,
  namespace: "sample",
  pluginId: "@vitnode/sample",
  type: "sample:detail",
};

describe("normalizeBlockFieldValue", () => {
  it("drops an optional leaf the group's own schema cannot store", () => {
    expect(
      normalizeBlockFieldValue(seoGroup, {
        publishedAt: null,
        subtitle: "Hi there",
      }),
    ).toStrictEqual({ subtitle: "Hi there" });
  });

  it("drops an optional text leaf that refuses the empty string", () => {
    expect(normalizeBlockFieldValue(seoGroup, { subtitle: "" })).toStrictEqual(
      {},
    );
  });

  it("keeps the empty string a leaf declares as valid", () => {
    expect(normalizeBlockFieldValue(seoGroup, { note: "" })).toStrictEqual({
      note: "",
    });
  });

  it("keeps null where the leaf is nullable", () => {
    expect(
      normalizeBlockFieldValue(seoGroup, { retiredAt: null }),
    ).toStrictEqual({ retiredAt: null });
  });

  it("never deletes a required leaf", () => {
    expect(normalizeBlockFieldValue(seoGroup, { caption: "" })).toStrictEqual({
      caption: "",
    });
  });

  it("leaves a scalar field and a key the group never declared alone", () => {
    expect(normalizeBlockFieldValue(field.text({ minLength: 3 }), "")).toBe("");
    expect(normalizeBlockFieldValue(seoGroup, { stray: null })).toStrictEqual({
      stray: null,
    });
  });

  it("leaves a group that holds nothing exactly as it is", () => {
    expect(normalizeBlockFieldValue(seoGroup, null)).toBeNull();
    expect(normalizeBlockFieldValue(undefined, "")).toBe("");
  });

  it("does not touch the object it was handed", () => {
    const value = { publishedAt: null, subtitle: "Hi there" };

    normalizeBlockFieldValue(seoGroup, value);

    expect(value).toStrictEqual({ publishedAt: null, subtitle: "Hi there" });
  });

  it("descends into every row of a repeatable", () => {
    const rows = field.repeatable({
      fields: {
        publishedAt: field.dateTime(),
        subtitle: field.text({ minLength: 3 }),
      },
    });

    expect(
      normalizeBlockFieldValue(rows, [
        { publishedAt: null, subtitle: "Hi there" },
        { publishedAt: ISO, subtitle: "" },
      ]),
    ).toStrictEqual([{ subtitle: "Hi there" }, { publishedAt: ISO }]);
  });
});

describe("blockFieldPatchEntries", () => {
  const stored = {
    headline: "Headline",
    seo: { caption: "Caption", publishedAt: ISO, subtitle: "Hi there" },
  };
  const formSchema = buildFormSchemaFromSpec(
    blockFormSpec(detailEntry),
    stored,
  );
  const cleared = {
    caption: "Caption",
    publishedAt: null,
    subtitle: "Hi there",
  };

  it("lets a group through once its cleared leaf is gone", () => {
    expect(
      blockFieldPatchEntries(detailBlock, formSchema, "seo", cleared),
    ).toStrictEqual([["seo", { caption: "Caption", subtitle: "Hi there" }]]);
  });

  it("does not let the value the form opened on back in as a default", () => {
    const [entry] = blockFieldPatchEntries(
      detailBlock,
      formSchema,
      "seo",
      cleared,
    );

    expect(Object.hasOwn(entry[1] as object, "publishedAt")).toBe(false);
  });

  it("produces a group the block's own schema accepts", () => {
    const [entry] = blockFieldPatchEntries(
      detailBlock,
      formSchema,
      "seo",
      cleared,
    );

    expect(
      safeParseBlockData(detailBlock, { headline: "Headline", seo: entry[1] })
        .success,
    ).toBe(true);
  });

  it("holds a group back while one of its leaves is genuinely invalid", () => {
    expect(
      blockFieldPatchEntries(detailBlock, formSchema, "seo", {
        ...cleared,
        subtitle: "no",
      }),
    ).toStrictEqual([]);
  });

  it("keeps the coercion the form schema does on what the DOM produced", () => {
    expect(
      blockFieldPatchEntries(detailBlock, formSchema, "seo", {
        caption: "Caption",
        subtitle: "Hi there",
        weight: "5",
      }),
    ).toStrictEqual([
      ["seo", { caption: "Caption", subtitle: "Hi there", weight: 5 }],
    ]);
  });
});
