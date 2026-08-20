import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import type { RegisteredFrontendContentType } from "@/content/admin/config";

import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";

vi.mock("server-only", () => ({}));

/**
 * A real `next-intl` translator over a real message catalogue.
 *
 * Deliberately not a stub returning strings: the whole point of the `label` key
 * is that ICU picks the form, and a mock that hands back `"…label"` would prove
 * only that a key was read. Polish is here because it is the case a
 * `singular`/`plural` pair cannot express - three forms for one noun.
 */
const locale = { current: "en" };
const messages: Record<string, unknown> = {
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

vi.mock("next-intl/server", () => ({
  getLocale: async () => await Promise.resolve(locale.current),
  getTranslations: async () =>
    await Promise.resolve(
      createTranslator({
        locale: locale.current,
        messages: messages[locale.current] as never,
      }),
    ),
}));

// One mock covers `@/lib/navigation` too - the shim re-exports this module, so
// stubbing the framework layer stubs both import paths at once.
vi.mock("@/framework/navigation", () => ({
  Link: () => null,
  UnlocalizedLink: () => null,
  getPathname: () => "",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: () => undefined,
  unlocalizedPermanentRedirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/get-session-admin-api", () => ({
  checkAdminPermissionApi: async () => await Promise.resolve(true),
}));

vi.mock("@/content/admin/fetch.server", () => ({
  contentApiFetch: async () =>
    await Promise.resolve({ data: undefined, status: 200 }),
}));

const { getContentLabels } = await import("./content-admin-view");

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

const labelsFor = async (
  definition: typeof article | typeof widget,
  at = "en",
) => {
  locale.current = at;

  return await getContentLabels(entryFor(definition));
};

describe("getContentLabels", () => {
  it("reads the noun from messages, the only place it is written", async () => {
    const labels = await labelsFor(article);

    expect(labels.singular).toBe("Article");
    expect(labels.plural).toBe("Articles");
  });

  it("gives a three-form language the right form for each number", async () => {
    // `count: 1` and `count: 2` are what the AdminCP asks for, and Polish
    // answers with two different words. A `{ singular, plural }` pair in the
    // definition could not have held both.
    const labels = await labelsFor(article, "pl");

    expect(labels.singular).toBe("Artykuł");
    expect(labels.plural).toBe("Artykuły");
  });

  it("falls back to a name derived from the id, in every number", async () => {
    // Untranslated, the screen reads the id back rather than a guess: there is
    // no rule that turns "stock item" into its plural in every language, and a
    // definition holds no display name to borrow one from.
    const labels = await labelsFor(widget);

    expect(labels.singular).toBe("Stock item");
    expect(labels.plural).toBe("Stock item");
    expect(labels.title).toBe("Stock item");
  });

  it("prefers an explicit title over the plural noun", async () => {
    expect((await labelsFor(article, "pl")).title).toBe("Wszystkie artykuły");
  });

  it("titles the screen with the translated plural when there is no title key", async () => {
    // A screen with no `title` of its own is headed by the noun it lists, in
    // the reader's language rather than in the one the definition was typed in.
    expect((await labelsFor(article)).title).toBe("Articles");
  });

  it("resolves a section heading and its description", async () => {
    expect((await labelsFor(article)).labelSection("general")).toEqual({
      desc: "What readers see first",
      title: "Basics",
    });
  });

  it("humanises an untranslated section name", async () => {
    expect((await labelsFor(article, "pl")).labelSection("general")).toEqual({
      desc: undefined,
      title: "General",
    });
  });
});
