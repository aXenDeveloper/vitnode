// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { AnyBlockDefinition } from "./types";

import { field } from "../content/fields";
import { defineBlock } from "./define";
import { blockDataShapeIssue } from "./shape";

const Noop = () => null;

const block = defineBlock({
  component: Noop,
  id: "shape",
  fields: {
    align: field.enum({ defaultValue: "start", values: ["start", "center"] }),
    count: field.number({ integer: true, max: 10, min: 0 }),
    featured: field.boolean({ defaultValue: false }),
    seo: field.group({
      nullable: true,
      fields: { title: field.text({ nullable: true }) },
    }),
    subtitle: field.text({ nullable: true }),
    title: field.text({ maxLength: 10, required: true }),
  },
}) as unknown as AnyBlockDefinition;

const issue = (data: Record<string, unknown>) =>
  blockDataShapeIssue(block, data);

describe("blockDataShapeIssue", () => {
  it("accepts data the write boundary would have produced", () => {
    expect(
      issue({
        align: "start",
        count: 3,
        featured: false,
        seo: { title: "Hello" },
        subtitle: null,
        title: "Hi",
      }),
    ).toBeNull();
  });

  it("accepts an absent optional field, which is what an older record has", () => {
    expect(issue({ title: "Hi" })).toBeNull();
  });

  it("reports a required field that is gone", () => {
    expect(issue({ subtitle: "only" })).toMatch(/"title" is required/);
  });

  it("reports a field the block does not declare", () => {
    expect(issue({ headline: "renamed", title: "Hi" })).toMatch(
      /"headline" is not a field/,
    );
  });

  it("refuses a variant smuggled into the data, which is never a field", () => {
    expect(issue({ title: "Hi", variant: "featured" })).toMatch(
      /"variant" is not a field/,
    );
  });

  it("reports a value of the wrong kind", () => {
    expect(issue({ title: 7 })).toMatch(/number where the field is a text/);
    expect(issue({ count: "3", title: "Hi" })).toMatch(
      /string where the field is a number/,
    );
    expect(issue({ featured: "yes", title: "Hi" })).toMatch(
      /string where the field is a boolean/,
    );
  });

  it("reports null in a field that is not nullable", () => {
    expect(issue({ count: null, title: "Hi" })).toMatch(/not nullable/);
  });

  it("accepts null in a field that is", () => {
    expect(issue({ seo: null, subtitle: null, title: "Hi" })).toBeNull();
  });

  it("looks inside a group", () => {
    expect(issue({ seo: { title: 7 }, title: "Hi" })).toMatch(/"seo.title"/);
    expect(issue({ seo: { headline: "x" }, title: "Hi" })).toMatch(
      /not a leaf of this group/,
    );
  });

  it("reports an array where an object belongs", () => {
    expect(issue({ seo: [], title: "Hi" })).toMatch(
      /array where the field is a group/,
    );
  });

  it("does not police value constraints - that is the write boundary's job", () => {
    expect(issue({ title: "far longer than the field allows" })).toBeNull();
    expect(issue({ count: -40, title: "Hi" })).toBeNull();
    expect(issue({ count: 1.5, title: "Hi" })).toBeNull();
  });

  it("refuses an enum value the field no longer lists", () => {
    expect(issue({ align: "sideways", title: "Hi" })).toContain("align");
    expect(issue({ align: "sideways", title: "Hi" })).toContain("sideways");
  });

  it("refuses an enum value a group leaf no longer lists", () => {
    const grouped = defineBlock({
      component: Noop,
      id: "grouped",
      fields: {
        look: field.group({
          fields: { style: field.enum({ values: ["light", "dark"] }) },
        }),
      },
    }) as unknown as AnyBlockDefinition;

    expect(
      blockDataShapeIssue(grouped, { look: { style: "legacy" } }),
    ).toContain("look.style");
    expect(
      blockDataShapeIssue(grouped, { look: { style: "dark" } }),
    ).toBeNull();
  });

  it("still takes an enum value the field does list", () => {
    expect(issue({ align: "center", title: "Hi" })).toBeNull();
  });
});
