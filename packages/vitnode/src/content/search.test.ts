import { describe, expect, it } from "vitest";

import {
  testPostContentType,
  testSearchablePostContentType,
} from "@/tests/content-fixtures";

import { defineContentType } from "./define";
import { field } from "./fields";
import {
  contentSearchDocumentId,
  contentSearchIndexedFieldNames,
  contentSearchUrl,
} from "./search";

const fields = {
  author: field.user(),
  body: field.textarea({ nullable: true }),
  code: field.text({ required: true }),
  excerpt: field.textarea({ nullable: true }),
  featured: field.boolean({ defaultValue: false }),
  slug: field.slug({ source: "title" }),
  title: field.text({ required: true }),
  views: field.number({ integer: true, defaultValue: 0 }),
};

const admin = {
  titleField: "title",
} as const;

const publicApi = {
  enabled: true,
  fields: ["title", "slug", "excerpt", "body", "featured", "publishedAt"],
  path: "articles",
} as const;

const validSearch = {
  contentFields: ["excerpt", "body"],
  descriptionField: "excerpt",
  enabled: true,
  pathTemplate: "/articles/{slug}",
  titleField: "title",
} as const;

/**
 * Runtime validation has to hold for a JavaScript caller and for a widened
 * TypeScript value, so every case goes in as an untyped `search` object - the
 * types are asserted separately in `search.test-d.ts`.
 */
const define = ({
  publication = true,
  search,
  withPublicApi = true,
}: {
  publication?: boolean;
  search?: unknown;
  withPublicApi?: boolean;
} = {}) =>
  defineContentType({
    admin,
    fields,
    id: "test.article",
    ...(withPublicApi ? { publicApi } : {}),
    ...(publication ? { publication: { enabled: true as const } } : {}),
    // `never` because the point of every case below is a value the types reject:
    // a widened TypeScript value or a plain-JavaScript caller. The compile-time
    // rules are asserted in `search.test-d.ts`.
    search: search as never,
    tableName: "test_articles_search",
  });

describe("search configuration", () => {
  it("resolves a valid configuration", () => {
    const definition = define({ search: validSearch });

    expect(definition.search).toEqual({
      contentFields: ["excerpt", "body"],
      descriptionField: "excerpt",
      enabled: true,
      pathTemplate: "/articles/{slug}",
      titleField: "title",
    });
  });

  it("defaults to disabled when `search` is omitted", () => {
    expect(define().search).toEqual({
      contentFields: [],
      descriptionField: null,
      enabled: false,
      pathTemplate: "",
      titleField: "",
    });
  });

  it("stays disabled for an explicit `enabled: false`", () => {
    expect(define({ search: { enabled: false } }).search.enabled).toBe(false);
  });

  it("leaves every Stage 2 content type untouched", () => {
    expect(testPostContentType.search.enabled).toBe(false);
    expect(testPostContentType.search.contentFields).toEqual([]);
  });

  describe("required companions", () => {
    it("rejects search without publication", () => {
      expect(() =>
        define({
          publication: false,
          search: validSearch,
          withPublicApi: false,
        }),
      ).toThrow(/search needs `publication/);
    });

    it("rejects search without a public API", () => {
      expect(() =>
        define({ search: validSearch, withPublicApi: false }),
      ).toThrow(/search needs `publicApi/);
    });
  });

  describe("field names", () => {
    it("rejects an unknown titleField", () => {
      expect(() =>
        define({ search: { ...validSearch, titleField: "nope" } }),
      ).toThrow(/search.titleField references unknown field "nope"/);
    });

    it("rejects a titleField of the wrong kind", () => {
      expect(() =>
        define({ search: { ...validSearch, titleField: "views" } }),
      ).toThrow(
        /search.titleField names "views" of kind "number"\. Expected one of: text\./,
      );
    });

    it("rejects a private titleField", () => {
      expect(() =>
        define({ search: { ...validSearch, titleField: "code" } }),
      ).toThrow(/names "code", which is not in publicApi.fields/);
    });

    it("rejects a descriptionField of the wrong kind", () => {
      expect(() =>
        define({ search: { ...validSearch, descriptionField: "featured" } }),
      ).toThrow(/search.descriptionField names "featured" of kind "boolean"/);
    });

    it("accepts an omitted descriptionField", () => {
      const { descriptionField } = define({
        search: { ...validSearch, descriptionField: undefined },
      }).search;

      expect(descriptionField).toBeNull();
    });

    it("rejects a private field in contentFields", () => {
      expect(() =>
        define({
          search: { ...validSearch, contentFields: ["title", "code"] },
        }),
      ).toThrow(
        /search.contentFields names "code", which is not in publicApi.fields/,
      );
    });

    it("rejects a user field", () => {
      expect(() =>
        define({ search: { ...validSearch, contentFields: ["author"] } }),
      ).toThrow(/search.contentFields names "author" of kind "user"/);
    });

    it("rejects a non-textual field in contentFields", () => {
      expect(() =>
        define({ search: { ...validSearch, contentFields: ["featured"] } }),
      ).toThrow(
        /search.contentFields names "featured" of kind "boolean"\. Expected one of: slug, text, textarea\./,
      );
    });

    it("rejects empty contentFields", () => {
      expect(() =>
        define({ search: { ...validSearch, contentFields: [] } }),
      ).toThrow(/search.contentFields is empty/);
    });

    it("rejects duplicate contentFields", () => {
      expect(() =>
        define({
          search: { ...validSearch, contentFields: ["body", "body"] },
        }),
      ).toThrow(/search.contentFields lists "body" twice/);
    });

    it("accepts a slug in contentFields", () => {
      expect(
        define({ search: { ...validSearch, contentFields: ["slug"] } }).search
          .contentFields,
      ).toEqual(["slug"]);
    });
  });

  describe("pathTemplate", () => {
    const withTemplate = (pathTemplate: string) =>
      define({ search: { ...validSearch, pathTemplate } });

    it("rejects a template that does not start with a slash", () => {
      expect(() => withTemplate("articles/{slug}")).toThrow(
        /must start with "\/"/,
      );
    });

    it("rejects a missing placeholder", () => {
      expect(() => withTemplate("/articles")).toThrow(
        /must contain exactly one "\{slug\}" placeholder, not 0/,
      );
    });

    it("rejects a repeated placeholder", () => {
      expect(() => withTemplate("/articles/{slug}/{slug}")).toThrow(
        /placeholder, not 2/,
      );
    });

    it("rejects an unknown placeholder", () => {
      expect(() => withTemplate("/articles/{id}/{slug}")).toThrow(
        /uses a placeholder other than "\{slug\}"/,
      );
    });

    it("rejects traversal, empty segments and whitespace", () => {
      expect(() => withTemplate("/articles/../{slug}")).toThrow(
        /must not contain an empty segment/,
      );
      expect(() => withTemplate("//articles/{slug}")).toThrow(
        /must not contain an empty segment/,
      );
      expect(() => withTemplate("/articles /{slug}")).toThrow(
        /must not contain an empty segment/,
      );
    });

    it("rejects a template longer than the limit", () => {
      expect(() => withTemplate(`/${"a".repeat(512)}/{slug}`)).toThrow(
        /is longer than 512 characters/,
      );
    });
  });

  it("rejects a content type id wider than the search index column", () => {
    expect(() =>
      defineContentType({
        admin,
        fields,
        id: `test.${"a".repeat(100)}`,
        publicApi,
        publication: { enabled: true },
        search: validSearch,
        tableName: "test_long_id",
      }),
    ).toThrow(/is longer than 100 characters/);
  });
});

describe("search helpers", () => {
  it("builds a relative URL from the template", () => {
    expect(contentSearchUrl(testSearchablePostContentType, "hello-world")).toBe(
      "/searchable/hello-world",
    );
  });

  it("percent-encodes the slug", () => {
    expect(contentSearchUrl(testSearchablePostContentType, "a b/c")).toBe(
      "/searchable/a%20b%2Fc",
    );
  });

  it("returns null for an empty slug", () => {
    expect(contentSearchUrl(testSearchablePostContentType, "   ")).toBeNull();
  });

  it("returns null when search is off", () => {
    expect(contentSearchUrl(testPostContentType, "hello")).toBeNull();
  });

  it("namespaces the document id by content type", () => {
    expect(contentSearchDocumentId(testSearchablePostContentType, 7)).toBe(
      "test.searchable:7",
    );
  });

  it("lists every field the document is built from, including the slug", () => {
    expect(
      contentSearchIndexedFieldNames(testSearchablePostContentType).sort(),
    ).toEqual(["body", "excerpt", "slug", "title"]);
  });

  it("lists nothing when search is off", () => {
    expect(contentSearchIndexedFieldNames(testPostContentType)).toEqual([]);
  });
});
