import { describe, expect, it } from "vitest";
import z from "zod";

import type { RegisteredBlock } from "../../blocks/types";

import { blocks as builtInBlocks } from "../../blocks/built-in";
import { defineBlock } from "../../blocks/define";
import { createBlockRegistry } from "../../blocks/registry";
import { buildFormSchemaFromSpec } from "../../content/admin/spec";
import { field } from "../../content/fields";
import { getDefaults } from "../../lib/helpers/auto-form";
import { createBlockInstanceFor } from "../instance/defaults";
import {
  blockDataFromFormValues,
  blockDisplayName,
  blockFieldSpecs,
  blockFormSpec,
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
