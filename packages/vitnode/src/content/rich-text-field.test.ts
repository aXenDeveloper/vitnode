// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { ContentFormSpec } from "./admin/spec";
import type { RichTextDocument } from "./rich-text/document";

import { testContentLocaleRouting } from "../tests/content-fixtures";
import {
  buildFormSchemaFromSpec,
  contentFormInitialValues,
  contentFormValuesToTranslations,
} from "./admin/spec";
import { defineContentType } from "./define";
import { contentDeliverySeo } from "./delivery";
import { field } from "./fields";
import { buildSearchCondition } from "./server/query";
import {
  contentRevisionSnapshot,
  contentTranslationRevisionSnapshot,
  projectTranslationRevisionSnapshot,
} from "./server/revision-snapshot";
import { contentSearchDocument } from "./server/search-document";
import { contentTableColumns, createContentTable } from "./server/table";

const paragraph = (text: string): RichTextDocument => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

const EMPTY: RichTextDocument = {
  content: [{ type: "paragraph" }],
  type: "doc",
};

const noteType = defineContentType({
  id: "test.richtext",
  tableName: "test_rich_text_notes",
  publication: { enabled: true },
  editorial: { enabled: true },
  localization: { enabled: true, defaultLocale: "en", fallback: "default" },
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
    body: field.richText({ localized: true, required: true }),
    summary: field.richText({ maxBytes: 300, nullable: true }),
  },
  publicApi: {
    enabled: true,
    path: "notes",
    fields: ["id", "title", "slug", "body", "summary", "publishedAt"],
    searchableFields: ["title", "body"],
    defaultOrderBy: "publishedAt",
  },
  search: {
    enabled: true,
    titleField: "title",
    contentFields: ["body"],
    pathTemplate: "/notes/{slug}",
  },
  delivery: {
    enabled: true,
    seo: {
      descriptionField: "summary",
      fallbackDescriptionField: "body",
      titleField: "title",
    },
  },
});

describe("field.richText", () => {
  it("refuses a maxBytes that is not a positive whole number", () => {
    expect(() =>
      defineContentType({
        id: "test.badrichtext",
        tableName: "test_bad_rich_text",
        fields: { body: field.richText({ maxBytes: 0, nullable: true }) },
      }),
    ).toThrow(/maxBytes of 0/);
  });

  it("refuses a field that could never be written", () => {
    expect(() =>
      defineContentType({
        id: "test.unwritable",
        tableName: "test_unwritable",
        fields: { body: field.richText() },
      }),
    ).toThrow(/neither required nor nullable/);
  });
});

describe("rich text schemas", () => {
  const translation = noteType.schemas.translation;

  it("puts a localized document in the translation, not the base row", () => {
    expect(
      translation?.create.safeParse({
        body: paragraph("Hello"),
        title: "Hello",
      }).success,
    ).toBe(true);
    expect(
      noteType.schemas.create.safeParse({ body: paragraph("Hello") }).success,
    ).toBe(false);
  });

  it("refuses HTML, and an empty document in a required field", () => {
    expect(
      translation?.create.safeParse({ body: "<p>Hello</p>", title: "Hello" })
        .success,
    ).toBe(false);
    expect(
      translation?.create.safeParse({ body: EMPTY, title: "Hello" }).success,
    ).toBe(false);
  });

  it("applies the field's own size limit", () => {
    expect(
      noteType.schemas.create.safeParse({ summary: paragraph("short") })
        .success,
    ).toBe(true);
    expect(
      noteType.schemas.create.safeParse({ summary: paragraph("a".repeat(400)) })
        .success,
    ).toBe(false);
  });

  it("describes the public projection as JSON Schema", () => {
    expect(() =>
      z.toJSONSchema(noteType.schemas.publicSelectObject, {
        unrepresentable: "any",
      }),
    ).not.toThrow();
  });
});

describe("rich text in search, SEO and history", () => {
  const routing = testContentLocaleRouting();

  it("indexes the words of a document, never its JSON", () => {
    const indexed = contentSearchDocument(
      noteType,
      {
        body: {
          content: [
            {
              attrs: { level: 2 },
              content: [{ text: "Why", type: "text" }],
              type: "heading",
            },
            {
              content: [{ text: "We  rebuilt it.", type: "text" }],
              type: "paragraph",
            },
          ],
          type: "doc",
        },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        id: 3,
        publishedAt: new Date("2026-01-02T00:00:00.000Z"),
        slug: "why",
        status: "published",
        title: "Why",
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      },
      { locale: "en", routing },
    );

    expect(indexed?.content).toBe("Why We rebuilt it.");
  });

  it("reads an SEO description as plain text, falling back past an empty document", () => {
    expect(
      contentDeliverySeo(noteType, {
        body: paragraph("1 < 2, and that is fine."),
        summary: EMPTY,
        title: "Maths",
      }),
    ).toStrictEqual({
      description: "1 < 2, and that is fine.",
      title: "Maths",
    });
  });

  it("keeps the whole document in a revision, so a restore puts it back", () => {
    const body = paragraph("Version one");
    const snapshot = contentTranslationRevisionSnapshot(
      noteType,
      {
        body,
        createdAt: new Date(0),
        itemId: 1,
        slug: "one",
        title: "One",
        updatedAt: new Date(0),
        version: 2,
      },
      { languageId: 1, locale: "en" },
    );

    expect(snapshot.fields.body).toStrictEqual(body);
    expect(projectTranslationRevisionSnapshot(noteType, snapshot).body).toEqual(
      body,
    );
    expect(
      contentRevisionSnapshot(noteType, {
        createdAt: new Date(0),
        id: 1,
        summary: "not a document",
        updatedAt: new Date(0),
      }).fields.summary,
    ).toBeNull();
  });

  it("searches only the text nodes of a rich text column", () => {
    const table = createContentTable(noteType);
    const columns = contentTableColumns(noteType, table);
    const condition = buildSearchCondition([columns.summary], "rebuilt");
    if (!condition) throw new Error("Expected a condition.");

    expect(new PgDialect().sqlToQuery(condition).sql).toContain(
      "jsonb_path_query_array",
    );
  });
});

describe("rich text in the AdminCP form", () => {
  const spec: ContentFormSpec = {
    contentTypeId: noteType.id,
    defaultLocale: "en",
    fields: [
      {
        kind: "richText",
        label: "Body",
        localized: true,
        name: "body",
        nullable: false,
        required: true,
      },
    ],
    permissionModule: "notes",
    pluginId: "test",
    sections: [],
    titleField: null,
  };

  it("opens every language on its stored document", () => {
    const body = paragraph("Cześć");

    expect(
      contentFormInitialValues(spec, {}, [
        { locale: "pl", values: { body } },
        { locale: "de", values: { body: null } },
      ]),
    ).toStrictEqual({
      body: [
        { languageCode: "pl", value: body },
        { languageCode: "de", value: null },
      ],
    });
  });

  it("sends a filled document and leaves an empty editor out", () => {
    const body = paragraph("Hello");

    expect(
      contentFormValuesToTranslations(spec, {
        body: [
          { languageCode: "en", value: body },
          { languageCode: "pl", value: EMPTY },
        ],
      }),
    ).toStrictEqual({ en: { body } });
  });

  it("requires a document in the default language only", () => {
    const schema = buildFormSchemaFromSpec(spec);

    expect(
      schema.safeParse({
        body: [
          { languageCode: "en", value: paragraph("Hello") },
          { languageCode: "pl", value: null },
        ],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        body: [
          { languageCode: "en", value: EMPTY },
          { languageCode: "pl", value: paragraph("Cześć") },
        ],
      }).success,
    ).toBe(false);
  });

  it("can be described as JSON Schema, which AutoForm runs", () => {
    expect(() => z.toJSONSchema(buildFormSchemaFromSpec(spec))).not.toThrow();
  });
});
