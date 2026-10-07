// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CONTENT_RICH_TEXT_MAX_HTML_LENGTH } from "./const";
import { defineContentType } from "./define";
import { field } from "./fields";
import { contentRichTextSearchColumns } from "./rich-text";

const article = defineContentType({
  id: "test.richtext",
  tableName: "test_rich_articles",
  fields: {
    title: field.text({ required: true }),
    body: field.richText({ required: true, maxLength: 10, minLength: 2 }),
    note: field.richText({ nullable: true }),
  },
});

describe("rich text schemas", () => {
  const create = article.schemas.create;
  const update = article.schemas.update;

  it.each(["", "<p></p>", "<p> </p>", "<p><br></p>", "<strong></strong>"])(
    "refuses %j for a required field on create and on update",
    body => {
      expect(create.safeParse({ body, title: "x" }).success).toBe(false);
      expect(update.safeParse({ body }).success).toBe(false);
    },
  );

  it("accepts media without text for a required field, unless it asks for text", () => {
    const gallery = defineContentType({
      id: "test.gallery",
      tableName: "test_gallery",
      fields: { body: field.richText({ required: true }) },
    });
    const media = '<p><img src="/cat.png"></p>';

    expect(gallery.schemas.create.safeParse({ body: media }).success).toBe(
      true,
    );
    // `minLength` counts characters of text, and an image has none.
    expect(create.safeParse({ body: media, title: "x" }).success).toBe(false);
  });

  it("counts plain text against the bounds, not markup", () => {
    const markup = (text: string) =>
      `<p><span style="color: red"><strong>${text}</strong></span></p>`;

    expect(
      create.safeParse({ body: markup("0123456789"), title: "x" }).success,
    ).toBe(true);
    expect(
      create.safeParse({ body: markup("0123456789a"), title: "x" }).success,
    ).toBe(false);
    expect(create.safeParse({ body: markup("a"), title: "x" }).success).toBe(
      false,
    );
  });

  it("lets an optional field be empty whatever its markup", () => {
    expect(
      create.safeParse({ body: "<p>ok</p>", note: "<p></p>", title: "x" })
        .success,
    ).toBe(true);
  });

  it("refuses HTML past the size limit", () => {
    const result = create.safeParse({
      body: `<p>ok</p>${" ".repeat(CONTENT_RICH_TEXT_MAX_HTML_LENGTH)}`,
      title: "x",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map(issue => issue.path)).toEqual([["body"]]);
  });

  it("returns the stored HTML unchecked on the way out", () => {
    expect(
      article.schemas.select.safeParse({
        body: "<p>far too long for the input rule</p>",
        createdAt: new Date(),
        id: 1,
        note: null,
        title: "x",
        updatedAt: new Date(),
      }).success,
    ).toBe(true);
  });
});

describe("rich text definitions", () => {
  const define = (fields: Record<string, unknown>, rest = {}) =>
    defineContentType({
      id: "test.rich",
      tableName: "test_rich",
      fields: fields as { body: ReturnType<typeof field.richText> },
      ...rest,
    });

  it("checks a default's plain text against the bounds", () => {
    expect(() =>
      define({
        body: field.richText({
          defaultValue: "<p>far too long</p>",
          maxLength: 5,
        }),
      }),
    ).toThrow(/default whose text is 12 characters against a maxLength of 5/);
  });

  it("accepts an empty default whatever minLength says", () => {
    expect(() =>
      define({
        body: field.richText({ defaultValue: "<p></p>", minLength: 3 }),
      }),
    ).not.toThrow();
  });

  it("never picks a rich text field as the default title or search target", () => {
    const definition = define({
      body: field.richText({ required: true }),
    });

    expect(definition.admin.titleField).toBeNull();
    expect(definition.admin.list.searchableFields).toEqual([]);
  });

  it("refuses a rich text slug source", () => {
    expect(() =>
      define({
        body: field.richText({ required: true }),
        slug: field.slug({ source: "body" }),
      }),
    ).toThrow(/can only be derived from a text field/);
  });

  it("refuses a searchable field whose plain-text column name is taken", () => {
    expect(() =>
      define(
        {
          body: field.richText({ required: true }),
          bodyText: field.text({ nullable: true }),
        },
        { admin: { list: { searchableFields: ["body"] } } },
      ),
    ).toThrow(/plain-text column "bodyText"/);
  });
});

describe("contentRichTextSearchColumns", () => {
  it("gives every searched rich text field - group leaves too - a plain-text column on its own table", () => {
    const definition = defineContentType({
      id: "test.searchable",
      tableName: "test_searchable",
      localization: { enabled: true, defaultLocale: "en" },
      publication: { enabled: true },
      fields: {
        title: field.text({ required: true }),
        slug: field.slug({ source: "title" }),
        body: field.richText({ localized: true, required: true }),
        intro: field.richText({ nullable: true }),
        seo: field.group({
          fields: { summary: field.richText({ nullable: true }) },
        }),
      },
      admin: { list: { searchableFields: ["title", "intro"] } },
      publicApi: {
        enabled: true,
        path: "searchable",
        fields: ["title", "slug", "body", "seo.summary"],
        searchableFields: ["body", "seo.summary"],
      },
    });

    expect(contentRichTextSearchColumns(definition)).toEqual([
      {
        column: "intro",
        localized: false,
        path: "intro",
        searchColumn: "introText",
      },
      {
        column: "body",
        localized: true,
        path: "body",
        searchColumn: "bodyText",
      },
      {
        column: "seoSummary",
        localized: false,
        path: "seo.summary",
        searchColumn: "seoSummaryText",
      },
    ]);
  });
});
