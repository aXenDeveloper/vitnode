// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { ContentColumnSpec } from "@/content/admin/spec";
import type { AnyContentTypeDefinition } from "@/content/types";

import { buildContentColumnSpec } from "@/content/admin/spec";
import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";

import type { ContentRowData } from "./cells";

import {
  contentColumnEntries,
  contentRowTitle,
  contentTableColumnCount,
  contentTableOrder,
  contentTableSearchEnabled,
} from "./columns";

const articles = defineContentType({
  id: "blog.post",
  tableName: "blog_post",
  fields: {
    title: field.text({ required: true }),
    tone: field.enum({ defaultValue: "calm", values: ["calm", "loud"] }),
    color: field.text({ nullable: true }),
  },
  admin: {
    titleField: "title",
    list: {
      columns: ["title", "tone", "color"],
      orderableFields: ["title"],
      searchableFields: ["title"],
    },
  },
  publication: { enabled: true },
}) as AnyContentTypeDefinition;

const notes = defineContentType({
  id: "blog.note",
  tableName: "blog_note",
  fields: { body: field.textarea({ nullable: true }) },
  admin: {
    titleField: null,
    list: { columns: ["body"], searchableFields: [] },
  },
}) as AnyContentTypeDefinition;

const localized = defineContentType({
  id: "blog.page",
  tableName: "blog_page",
  localization: { enabled: true, defaultLocale: "en", fallback: "default" },
  fields: { heading: field.text({ localized: true, required: true }) },
  admin: { titleField: "heading", list: { columns: ["heading"] } },
}) as AnyContentTypeDefinition;

/** The specs the screen actually builds, not hand-written ones. */
const specsOf = (definition: AnyContentTypeDefinition): ContentColumnSpec[] =>
  buildContentColumnSpec({
    definition,
    labelEnum: (_field, value) => value,
    labelField: name => name,
  });

const row = (values: Partial<ContentRowData>): ContentRowData => ({
  id: 7,
  labels: {},
  ...values,
});

describe("contentColumnEntries", () => {
  it("keeps every generated column, in the order the spec declares", () => {
    const specs = specsOf(articles);

    expect(
      contentColumnEntries(specs, {}).map(entry => entry.spec.name),
    ).toEqual(specs.map(spec => spec.name));
  });

  it("leaves a column with no override to the generated cell", () => {
    expect(
      contentColumnEntries(specsOf(articles), {}).every(
        entry => entry.cell === undefined,
      ),
    ).toBe(true);
  });

  it("hands a plugin's cell the column it named", () => {
    const cell = () => null;
    const entries = contentColumnEntries(specsOf(articles), {
      columns: { color: { cell } },
    });

    expect(entries.find(entry => entry.spec.name === "color")?.cell).toBe(cell);
    expect(entries.find(entry => entry.spec.name === "title")?.cell).toBe(
      undefined,
    );
  });

  it("ignores an override for a column this content type does not have", () => {
    // A plugin that edited its definition without editing its overrides. Never
    // reached rather than an error - and never an extra column either.
    const specs = specsOf(articles);
    const entries = contentColumnEntries(specs, {
      columns: { removed: { cell: () => null } },
    });

    expect(entries).toHaveLength(specs.length);
    expect(entries.every(entry => entry.cell === undefined)).toBe(true);
  });
});

describe("contentTableColumnCount", () => {
  it("counts the actions column the skeleton has to leave room for", () => {
    expect(contentTableColumnCount(specsOf(articles))).toBe(
      specsOf(articles).length + 1,
    );
  });
});

describe("contentTableSearchEnabled", () => {
  it("is on for a content type that declared searchable fields", () => {
    expect(contentTableSearchEnabled(articles)).toBe(true);
  });

  it("is off for one that declared none", () => {
    expect(contentTableSearchEnabled(notes)).toBe(false);
  });
});

describe("contentTableOrder", () => {
  it("offers the columns the API will accept an `orderBy` for", () => {
    const order = contentTableOrder(articles);

    expect(order.columns).toContain("title");
    expect(order.columns).toContain("createdAt");
    // Publication is enabled, so `status` is orderable without being declared.
    expect(order.columns).toContain("status");
    expect(order.columns).not.toContain("color");
  });

  it("names the sort the list has before anybody asks", () => {
    expect(contentTableOrder(articles).defaultOrder).toEqual({
      column: articles.admin.list.defaultOrderBy,
      order: articles.admin.list.defaultOrder,
    });
  });
});

describe("contentRowTitle", () => {
  it("reads the content type's title field", () => {
    expect(contentRowTitle(articles, row({ title: "Hello" }))).toBe("Hello");
  });

  it("falls back to the id when there is no title field", () => {
    expect(contentRowTitle(notes, row({ body: "text" }))).toBe("#7");
  });

  it("falls back to the id when the title is blank", () => {
    expect(contentRowTitle(articles, row({ title: "" }))).toBe("#7");
  });

  it("falls back to the id when the title is not a string", () => {
    expect(contentRowTitle(articles, row({ title: 42 }))).toBe("#7");
  });

  it("reads a localized title from the row's translation", () => {
    expect(
      contentRowTitle(
        localized,
        row({ translation: { values: { heading: "Witaj" } } }),
      ),
    ).toBe("Witaj");
  });

  it("names an untranslated record by its id rather than by another language", () => {
    expect(contentRowTitle(localized, row({ heading: "Hello" }))).toBe("#7");
  });
});
