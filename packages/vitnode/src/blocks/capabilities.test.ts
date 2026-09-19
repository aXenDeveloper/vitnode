// @vitest-environment node
import { describe, expect, it } from "vitest";

import { field } from "../content/fields";
import { blocks as coreBlocks } from "./built-in";
import { BLOCK_FIELD_KINDS, blockFieldKindRefusal } from "./capabilities";
import { defineBlock } from "./define";
import { BlockError } from "./errors";

const Noop = () => null;

const DEFERRED = ["blocks", "file", "relation", "repeatable", "slug", "user"];

describe("blockFieldKindRefusal", () => {
  it("accepts every supported kind", () => {
    for (const kind of BLOCK_FIELD_KINDS) {
      expect(blockFieldKindRefusal(kind)).toBeNull();
    }
  });

  it("gives every deferred kind its own reason", () => {
    const reasons = DEFERRED.map(kind => blockFieldKindRefusal(kind));

    expect(reasons.every(reason => typeof reason === "string")).toBe(true);
    expect(new Set(reasons).size).toBeGreaterThan(1);
  });

  it("names the reference lifecycle for the three reference kinds", () => {
    for (const kind of ["file", "relation", "user"]) {
      expect(blockFieldKindRefusal(kind)).toMatch(
        /pin the row against deletion/,
      );
    }
  });

  it("answers for a kind that is not a Content Engine kind at all", () => {
    expect(blockFieldKindRefusal("nonsense")).toMatch(/Supported kinds/);
  });
});

describe("what a block may hold", () => {
  const block = (name: string, descriptor: { kind: string }) =>
    defineBlock({
      component: Noop,
      fields: { [name]: descriptor },
      id: "probe",
    });

  it("accepts the JSON-native kinds and a group of them", () => {
    expect(() => block("title", field.text({ required: true }))).not.toThrow();
    expect(() =>
      block(
        "seo",
        field.group({ fields: { title: field.text({ nullable: true }) } }),
      ),
    ).not.toThrow();
  });

  it("refuses a file, and says what supporting one would take", () => {
    expect(() => block("image", field.file({ maxBytes: 1024 }))).toThrow(
      /ON DELETE RESTRICT/,
    );
  });

  it("refuses a repeatable, and says why a JSON document has no rows", () => {
    expect(() =>
      block("faq", field.repeatable({ fields: { q: field.text() } })),
    ).toThrow(/child table/);
  });

  it("refuses a nested zone", () => {
    expect(() => block("inner", field.blocks())).toThrow(/later stage/);
  });
});

describe("constraints a block's data could actually satisfy", () => {
  const holding = (fields: Record<string, { kind: string }>) =>
    defineBlock({ component: Noop, fields, id: "probe" });

  it("accepts the field maps core's own blocks ship with", () => {
    expect(coreBlocks.blocks.map(entry => entry.id)).toStrictEqual([
      "cta",
      "hero",
      "text",
    ]);

    for (const entry of coreBlocks.blocks) {
      expect(() => holding(entry.fields)).not.toThrow();
    }
  });

  it("refuses a text window no string could fit", () => {
    expect(() =>
      holding({ title: field.text({ maxLength: 3, minLength: 10 }) }),
    ).toThrow(BlockError);
    expect(() =>
      holding({ title: field.text({ maxLength: 3, minLength: 10 }) }),
    ).toThrow(/minLength 10 greater than maxLength 3/);
    expect(() =>
      holding({ body: field.textarea({ maxLength: 5, minLength: 20 }) }),
    ).toThrow(/minLength 20 greater than maxLength 5/);
  });

  it("refuses a maxLength that leaves room for nothing", () => {
    expect(() => holding({ title: field.text({ maxLength: 0 }) })).toThrow(
      /must be positive/,
    );
    expect(() => holding({ body: field.textarea({ maxLength: -1 }) })).toThrow(
      /must be positive/,
    );
  });

  it("refuses a default the field's own window would reject", () => {
    expect(() =>
      holding({ title: field.text({ defaultValue: "hi", minLength: 5 }) }),
    ).toThrow(/against a minLength of 5/);
    expect(() =>
      holding({
        title: field.text({ defaultValue: "far too long", maxLength: 3 }),
      }),
    ).toThrow(/against a maxLength of 3/);
  });

  it("refuses a number range no value falls inside", () => {
    expect(() =>
      holding({ weight: field.number({ integer: true, max: 1, min: 10 }) }),
    ).toThrow(/min 10 greater than max 1/);
  });

  it("refuses a bound nothing could be compared against", () => {
    expect(() =>
      holding({ weight: field.number({ integer: true, min: Number.NaN }) }),
    ).toThrow(/not a finite number/);
    expect(() =>
      holding({
        weight: field.number({
          integer: true,
          max: Number.POSITIVE_INFINITY,
        }),
      }),
    ).toThrow(/not a finite number/);
  });

  it("refuses a fractional default on a whole-number field", () => {
    expect(() =>
      holding({ weight: field.number({ defaultValue: 1.5, integer: true }) }),
    ).toThrow(/integer: true/);
  });

  it("refuses a default outside its own range", () => {
    expect(() =>
      holding({
        weight: field.number({ defaultValue: 0, integer: true, min: 1 }),
      }),
    ).toThrow(/below its own min of 1/);
    expect(() =>
      holding({
        weight: field.number({ defaultValue: 10, integer: true, max: 5 }),
      }),
    ).toThrow(/above its own max of 5/);
  });

  it("names the block the unsatisfiable field belongs to", () => {
    expect(() =>
      holding({ title: field.text({ maxLength: 3, minLength: 10 }) }),
    ).toThrow(/probe/);
  });

  it("refuses two enum values that could never be told apart", () => {
    expect(() =>
      holding({ tone: field.enum({ values: ["info", "info"] }) }),
    ).toThrow(/duplicate enum values/);
  });

  it("leaves a group alone when every leaf is satisfiable", () => {
    expect(() =>
      holding({
        seo: field.group({
          fields: { title: field.text({ maxLength: 60, minLength: 1 }) },
        }),
      }),
    ).not.toThrow();
  });

  it("checks a group's leaves under the same rules", () => {
    expect(() =>
      holding({
        seo: field.group({
          fields: { title: field.text({ maxLength: 4, minLength: 60 }) },
        }),
      }),
    ).toThrow(/"seo\.title"[\s\S]*minLength 60 greater than maxLength 4/);
  });

  it("still refuses a kind a JSON document cannot hold", () => {
    expect(() => holding({ cover: field.file({ maxBytes: 1024 }) })).toThrow(
      /Supported kinds/,
    );
  });

  it("still refuses a localized field with the message it always gave", () => {
    expect(() =>
      holding({ title: field.text({ localized: true, required: true }) }),
    ).toThrow(/field\.blocks\(\{ localized: true \}\)/);
  });
});
