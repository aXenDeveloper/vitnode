// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { testArticleContentType } from "@/tests/content-fixtures";

import { humanizeFieldName } from "./labels";
import {
  buildContentColumnSpec,
  buildContentFormSpec,
  buildFormSchemaFromSpec,
  contentFormValuesToPayload,
  contentTitleFromValues,
} from "./spec";

const labelField = (name: string) => humanizeFieldName(name);
const labelEnum = (_field: string, value: string) => value.toUpperCase();

const formSpec = buildContentFormSpec({
  definition: testArticleContentType,
  labelEnum,
  labelField,
  pluginId: "@vitnode/example",
});

const columnSpecs = buildContentColumnSpec({
  definition: testArticleContentType,
  labelEnum,
  labelField,
});

const REF = { label: "News", value: "1" };

const specFor = (name: string) => {
  const found = formSpec.fields.find(item => item.name === name);
  if (!found) throw new Error(`no spec for ${name}`);

  return found;
};

describe("contentTitleFromValues", () => {
  it("reads the content type's title field", () => {
    expect(contentTitleFromValues(formSpec, { title: "Hello" })).toBe("Hello");
  });

  it("gives up on a blank or missing title", () => {
    expect(contentTitleFromValues(formSpec, { title: "   " })).toBeUndefined();
    expect(contentTitleFromValues(formSpec, {})).toBeUndefined();
  });

  it("gives up when the content type has no title field", () => {
    expect(
      contentTitleFromValues(
        { ...formSpec, titleField: null },
        { title: "Hello" },
      ),
    ).toBeUndefined();
  });
});

describe("buildContentFormSpec", () => {
  it("is plain JSON, so it can cross the server/client boundary", () => {
    expect(JSON.parse(JSON.stringify(formSpec))).toEqual(formSpec);
  });

  it("carries the title field the toasts describe a new row by", () => {
    expect(formSpec.titleField).toBe("title");
  });

  it("covers exactly the declared form fields", () => {
    expect(formSpec.fields.map(item => item.name)).toEqual(
      testArticleContentType.admin.form.fields,
    );
  });

  it("humanises a field name when the plugin has no translation", () => {
    expect(specFor("publishedAt").label).toBe("Published at");
  });

  it("carries enum options with translated labels", () => {
    expect(specFor("status").options).toEqual([
      { label: "DRAFT", value: "draft" },
      { label: "PUBLISHED", value: "published" },
      { label: "ARCHIVED", value: "archived" },
    ]);
  });

  it("carries the validation bounds the form needs", () => {
    expect(specFor("title")).toMatchObject({
      maxLength: 200,
      minLength: 3,
      required: true,
    });
    expect(specFor("views")).toMatchObject({ integer: true, min: 0 });
  });

  it("keeps nullability", () => {
    expect(specFor("excerpt").nullable).toBe(true);
    expect(specFor("title").nullable).toBe(false);
  });
});

describe("buildContentColumnSpec", () => {
  it("marks the system columns", () => {
    expect(columnSpecs.find(item => item.name === "updatedAt")?.kind).toBe(
      "system",
    );
  });

  it("keeps the declared column order", () => {
    expect(columnSpecs.map(item => item.name)).toEqual([
      "title",
      "status",
      "author",
      "updatedAt",
    ]);
  });

  it("carries an enum lookup for badge cells", () => {
    expect(columnSpecs.find(item => item.name === "status")?.options).toEqual({
      archived: "ARCHIVED",
      draft: "DRAFT",
      published: "PUBLISHED",
    });
  });
});

describe("buildFormSchemaFromSpec", () => {
  const schema = buildFormSchemaFromSpec(formSpec);

  it("survives z.toJSONSchema, which AutoForm runs on every schema", () => {
    expect(() => z.toJSONSchema(schema)).not.toThrow();
  });

  it("prefills AutoForm from the declared defaults", () => {
    const json = z.toJSONSchema(schema);

    expect(json.properties?.status).toMatchObject({ default: "draft" });
    expect(json.properties?.featured).toMatchObject({ default: false });
    expect(json.properties?.views).toMatchObject({ default: 0 });
  });

  it("prefills from an existing row when editing", () => {
    const json = z.toJSONSchema(
      buildFormSchemaFromSpec(formSpec, {
        status: "published",
        title: "Existing",
      }),
    );

    expect(json.properties?.title).toMatchObject({ default: "Existing" });
    expect(json.properties?.status).toMatchObject({ default: "published" });
  });

  it("enforces the same bounds as the API", () => {
    expect(schema.safeParse({ category: REF, title: "ab" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ category: REF, title: "Hello" }).success).toBe(
      true,
    );
  });

  it("rejects a value outside the enum", () => {
    expect(
      schema.safeParse({ category: REF, status: "nope", title: "Hello" })
        .success,
    ).toBe(false);
  });

  it("takes dateTime as an ISO string, never a Date", () => {
    expect(
      schema.safeParse({
        category: REF,
        publishedAt: "2026-08-02T10:00:00.000Z",
        title: "Hello",
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        category: REF,
        publishedAt: new Date(),
        title: "Hello",
      }).success,
    ).toBe(false);
  });

  it("models a relation as the option object AutoFormCombobox stores", () => {
    const option = { label: "News", value: "3" };

    expect(schema.safeParse({ category: option, title: "Hello" }).success).toBe(
      true,
    );
    // A bare identifier is what the API takes, not what the form holds.
    expect(schema.safeParse({ category: 3, title: "Hello" }).success).toBe(
      false,
    );
  });

  it("rejects a required relation left unselected", () => {
    expect(
      schema.safeParse({ category: { label: "", value: "" }, title: "Hello" })
        .success,
    ).toBe(false);
  });

  it("prefills a relation with the label the list already resolved", () => {
    const json = z.toJSONSchema(
      buildFormSchemaFromSpec(formSpec, {
        category: 3,
        labels: { category: "News" },
        title: "Existing",
      }),
      { io: "input" },
    );

    expect(json.properties?.category).toMatchObject({
      default: { label: "News", value: "3" },
    });
  });

  it("accepts what a number input actually produces - a string", () => {
    expect(
      schema.parse({ category: REF, title: "Hello", views: "7" }).views,
    ).toBe(7);
  });

  it("treats an empty date input as no value rather than an invalid date", () => {
    const parsed = schema.parse({
      category: REF,
      publishedAt: "",
      title: "Hello",
    });

    expect(parsed.publishedAt).toBeNull();
  });

  it("converts form values into the API payload", () => {
    expect(
      contentFormValuesToPayload(formSpec, {
        author: null,
        category: { label: "News", value: "3" },
        title: "Hello",
      }),
    ).toEqual({ author: null, category: 3, title: "Hello" });
  });

  it("stays valid with every value exactly as the DOM reports it", () => {
    // This is the combination that previously left the submit button disabled
    // forever with no visible error.
    const result = schema.safeParse({
      author: null,
      category: { label: "News", value: "1" },
      excerpt: "",
      featured: false,
      publishedAt: "",
      status: "draft",
      title: "QA Article",
      views: "0",
    });

    expect(result.success).toBe(true);
  });

  it("accepts null only for nullable fields", () => {
    expect(
      schema.safeParse({ category: REF, excerpt: null, title: "Hello" })
        .success,
    ).toBe(true);
    expect(schema.safeParse({ category: REF, title: null }).success).toBe(
      false,
    );
  });
});

describe("humanizeFieldName", () => {
  it.each([
    ["publishedAt", "Published at"],
    ["title", "Title"],
    ["author_id", "Author id"],
    ["viewsCount", "Views count"],
  ])("turns %s into %s", (input, expected) => {
    expect(humanizeFieldName(input)).toBe(expected);
  });
});
