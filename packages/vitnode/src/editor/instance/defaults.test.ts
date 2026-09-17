import { describe, expect, it } from "vitest";

import type { AnyBlockDefinition, RegisteredBlock } from "../../blocks/types";

import { blocks as builtInBlocks } from "../../blocks/built-in";
import { defineBlock } from "../../blocks/define";
import { isBlockInstanceId } from "../../blocks/instance";
import {
  createBlockRegistry,
  setDefaultBlockRegistry,
} from "../../blocks/registry";
import { blockDataShapeIssue } from "../../blocks/shape";
import { field } from "../../content/fields";
import { blockInstanceIssue, createBlockInstanceFor } from "./defaults";

const registry = createBlockRegistry([builtInBlocks]);

const sampleBlock = defineBlock({
  component: () => null,
  fields: {
    body: field.textarea({ minLength: 12, required: true }),
    depth: field.number({ integer: true, min: 2.4 }),
    done: field.boolean(),
    note: field.text({ nullable: true }),
    publishedAt: field.dateTime({ defaultNow: true }),
    ratio: field.number({ integer: false }),
    seo: field.group({
      fields: {
        description: field.textarea({ nullable: true }),
        title: field.text({ maxLength: 4, minLength: 1, required: true }),
      },
    }),
    startsAt: field.dateTime({ required: true }),
    subtitle: field.text(),
    title: field.text({ maxLength: 200, minLength: 1, required: true }),
    tone: field.enum({ values: ["info", "warning"] }),
    weight: field.number({ defaultValue: 7, integer: true }),
  },
  id: "sample",
});

const variantBlock = defineBlock({
  component: () => null,
  defaultVariant: "grid",
  fields: { title: field.text({ required: true }) },
  id: "cards",
  variants: [{ id: "grid" }, { id: "featured" }],
});

const defaultlessBlock = defineBlock({
  component: () => null,
  fields: { title: field.text({ required: true }) },
  id: "quote",
  variants: [{ id: "plain" }, { id: "pulled" }],
});

const entryFor = (definition: AnyBlockDefinition): RegisteredBlock => ({
  definition,
  namespace: "sample",
  pluginId: "@vitnode/sample",
  type: `sample:${definition.id}`,
});

const builtIn = (type: string): RegisteredBlock => {
  const entry = registry.get(type);
  if (!entry) throw new Error(`missing ${type}`);

  return entry;
};

describe("createBlockInstanceFor", () => {
  it("builds data every built-in block accepts", () => {
    expect(registry.all()).not.toHaveLength(0);

    for (const entry of registry.all()) {
      const instance = createBlockInstanceFor(entry);

      expect(instance.type).toBe(entry.type);
      expect(isBlockInstanceId(instance.id)).toBe(true);
      expect(blockDataShapeIssue(entry.definition, instance.data)).toBeNull();
    }
  });

  it("gives every block a fresh id", () => {
    const [entry] = registry.all();

    expect(createBlockInstanceFor(entry).id).not.toBe(
      createBlockInstanceFor(entry).id,
    );
  });

  it("derives a value for every kind a block can hold", () => {
    const entry = entryFor(sampleBlock);
    const { data } = createBlockInstanceFor(entry);

    expect(blockDataShapeIssue(sampleBlock, data)).toBeNull();
    expect(data.done).toBe(false);
    expect(data.tone).toBe("info");
    expect(data.weight).toBe(7);
    expect(data.depth).toBe(3);
    expect(data.ratio).toBe(0);
    expect(data.note).toBeNull();
    expect(data.seo).toStrictEqual({ description: null, title: "Titl" });
    expect(data).not.toHaveProperty("subtitle");
  });

  it("stands a required text field up with a humanised placeholder", () => {
    const { data } = createBlockInstanceFor(entryFor(sampleBlock));

    expect(data.title).toBe("Title");
    expect(data.body).toBe("Body Body Body");
  });

  it("uses the declared default over anything it would derive", () => {
    const { data } = createBlockInstanceFor(builtIn("core:hero"));

    expect(data.align).toBe("start");
    expect(data.title).toBe("Title");
    expect(data.description).toBeNull();
  });

  it("starts a block on the layout it declares as its default", () => {
    const instance = createBlockInstanceFor(entryFor(variantBlock));

    expect(instance.variant).toBe("grid");
  });

  it("leaves the variant absent for a block that offers one layout", () => {
    const instance = createBlockInstanceFor(entryFor(sampleBlock));

    expect(instance).not.toHaveProperty("variant");
  });

  it("leaves the variant absent for variants with no declared default", () => {
    const instance = createBlockInstanceFor(entryFor(defaultlessBlock));

    expect(instance).not.toHaveProperty("variant");
  });

  it("writes an ISO instant for a date a block cannot be saved without", () => {
    const { data } = createBlockInstanceFor(entryFor(sampleBlock));

    for (const value of [data.publishedAt, data.startsAt]) {
      expect(typeof value).toBe("string");
      expect(new Date(value as string).toISOString()).toBe(value);
    }
  });
});

describe("blockInstanceIssue", () => {
  it("says nothing about a block the registry accepts", () => {
    const instance = createBlockInstanceFor(builtIn("core:cta"));

    expect(blockInstanceIssue(registry, instance)).toBeNull();
  });

  it("names a type no plugin registers", () => {
    const issue = blockInstanceIssue(registry, {
      data: {},
      id: "0000000000AAAAAAAAAAAAAAAA",
      type: "ghost:card",
    });

    expect(issue).toContain("ghost:card");
  });

  it("reports why the data cannot be saved", () => {
    const instance = createBlockInstanceFor(builtIn("core:cta"));

    expect(
      blockInstanceIssue(registry, {
        ...instance,
        data: { ...instance.data, title: 4 },
      }),
    ).toContain("title");
  });

  it("names a layout the block does not offer", () => {
    const variantRegistry = createBlockRegistry([
      {
        pluginId: "@vitnode/sample",
        namespace: "sample",
        blocks: [variantBlock],
      },
    ]);

    const instance = createBlockInstanceFor(entryFor(variantBlock));

    expect(
      blockInstanceIssue(variantRegistry, { ...instance, variant: "carousel" }),
    ).toMatch(
      /"carousel" is not a layout this block offers\. It offers "grid"/,
    );
  });

  it("says a block offers no layouts at all when it does not", () => {
    const instance = createBlockInstanceFor(builtIn("core:text"));

    expect(
      blockInstanceIssue(registry, { ...instance, variant: "grid" }),
    ).toMatch(/it has none/);
  });

  it("falls back to the process registry, and stays quiet without one", () => {
    const instance = createBlockInstanceFor(builtIn("core:text"));

    expect(
      blockInstanceIssue(undefined, { ...instance, type: "ghost:card" }),
    ).toBeNull();

    const restore = setDefaultBlockRegistry(registry);

    expect(blockInstanceIssue(undefined, instance)).toBeNull();
    expect(
      blockInstanceIssue(undefined, { ...instance, type: "ghost:card" }),
    ).toContain("ghost:card");

    restore();
  });
});
