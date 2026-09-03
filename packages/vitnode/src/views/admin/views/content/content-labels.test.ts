import { createTranslator } from "use-intl";
import { describe, expect, it } from "vitest";

import type { RegisteredFrontendContentType } from "@/content/admin/registry";

import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";

import { contentLabelsFrom } from "./content-labels";

const messages: Record<string, Record<string, unknown>> = {
  en: {
    "@vitnode/example": {
      content: {
        article: {
          label: "{count, plural, one {Article} other {Articles}}",
          form: {
            general: { desc: "What readers see first", title: "Basics" },
          },
        },
      },
    },
  },
  pl: {
    "@vitnode/example": {
      content: {
        article: {
          label:
            "{count, plural, one {Artykuł} few {Artykuły} many {Artykułów} other {Artykułu}}",
          title: "Wszystkie artykuły",
        },
      },
    },
  },
};

const article = defineContentType({
  id: "example.article",
  tableName: "example_articles",
  fields: {
    title: field.text({ required: true }),
    excerpt: field.textarea({ nullable: true }),
  },
  admin: {
    form: { sections: [{ fields: ["title", "excerpt"], name: "general" }] },
  },
});

/** A content type whose id the catalogue says nothing about. */
const widget = defineContentType({
  id: "example.stock-item",
  tableName: "example_stock_items",
  fields: { title: field.text({ required: true }) },
});

const entryFor = (definition: typeof article | typeof widget) =>
  ({
    definition,
    pluginId: "@vitnode/example",
    registration: {},
  }) as unknown as RegisteredFrontendContentType;

const labelsFor = (definition: typeof article | typeof widget, locale = "en") =>
  contentLabelsFrom(
    entryFor(definition),
    // Widened at the call, exactly as `AdminNavTranslator` documents: these keys
    // are assembled at runtime from a content type id no catalogue type knows.
    createTranslator({
      locale,
      messages: messages[locale] as never,
    }) as never,
  );

describe("contentLabelsFrom", () => {
  it("reads the noun from messages, the only place it is written", () => {
    const labels = labelsFor(article);

    expect(labels.singular).toBe("Article");
    expect(labels.plural).toBe("Articles");
  });

  it("gives a three-form language the right form for each number", () => {
    // `count: 1` and `count: 2` are what the AdminCP asks for, and Polish
    // answers with two different words. A `{ singular, plural }` pair in the
    // definition could not have held both.
    const labels = labelsFor(article, "pl");

    expect(labels.singular).toBe("Artykuł");
    expect(labels.plural).toBe("Artykuły");
  });

  it("falls back to a name derived from the id, in every number", () => {
    // Untranslated, the screen reads the id back rather than a guess: there is
    // no rule that turns "stock item" into its plural in every language, and a
    // definition holds no display name to borrow one from.
    const labels = labelsFor(widget);

    expect(labels.singular).toBe("Stock item");
    expect(labels.plural).toBe("Stock item");
    expect(labels.title).toBe("Stock item");
  });

  it("prefers an explicit title over the plural noun", () => {
    expect(labelsFor(article, "pl").title).toBe("Wszystkie artykuły");
  });

  it("titles the screen with the translated plural when there is no title key", () => {
    // A screen with no `title` of its own is headed by the noun it lists, in
    // the reader's language rather than in the one the definition was typed in.
    expect(labelsFor(article).title).toBe("Articles");
  });

  it("resolves a section heading and its description", () => {
    expect(labelsFor(article).labelSection("general")).toEqual({
      desc: "What readers see first",
      title: "Basics",
    });
  });

  it("humanises an untranslated section name", () => {
    expect(labelsFor(article, "pl").labelSection("general")).toEqual({
      desc: undefined,
      title: "General",
    });
  });
});
