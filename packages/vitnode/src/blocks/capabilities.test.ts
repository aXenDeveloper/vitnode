// @vitest-environment node
import { describe, expect, it } from "vitest";

import { field } from "../content/fields";
import { BLOCK_FIELD_KINDS, blockFieldKindRefusal } from "./capabilities";
import { defineBlock } from "./define";

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
