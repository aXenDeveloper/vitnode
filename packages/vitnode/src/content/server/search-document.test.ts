// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  testPostContentType,
  testSearchablePostContentType,
} from "@/tests/content-fixtures";

import { contentSearchDocument } from "./search-document";

const PUBLISHED_AT = new Date("2026-02-01T10:00:00.000Z");
const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");
const UPDATED_AT = new Date("2026-03-01T00:00:00.000Z");

const row = {
  author: 3,
  body: "The body of the post.",
  code: "SECRET-CODE",
  createdAt: CREATED_AT,
  excerpt: "A short excerpt.",
  id: 7,
  publishedAt: PUBLISHED_AT,
  slug: "hello-world",
  status: "published",
  title: "Hello world",
  updatedAt: UPDATED_AT,
  views: 42,
};

const document = (overrides: Record<string, unknown> = {}) =>
  contentSearchDocument(testSearchablePostContentType, {
    ...row,
    ...overrides,
  });

const withAuthorField = {
  ...testSearchablePostContentType,
  search: { ...testSearchablePostContentType.search, authorField: "author" },
};

describe("content search document", () => {
  it("maps a published row", () => {
    expect(document()).toEqual({
      authorIds: [],
      content: "A short excerpt.\n\nThe body of the post.",
      createdAt: PUBLISHED_AT,
      isPublic: true,
      itemId: 7,
      itemType: "test.searchable",
      title: "Hello world",
      updatedAt: UPDATED_AT,
      url: "/searchable/hello-world",
    });
  });

  it("uses the content type id as the item type", () => {
    expect(document()?.itemType).toBe(testSearchablePostContentType.id);
  });

  it("leaves the language code unset so every locale matches", () => {
    expect(document()).not.toHaveProperty("languageCode");
  });

  it("omits the owner unless one was given", () => {
    expect(document()).not.toHaveProperty("pluginId");
  });

  it("carries the owning plugin when one is given", () => {
    expect(
      contentSearchDocument(testSearchablePostContentType, row, {
        pluginId: "@vitnode/example",
      })?.pluginId,
    ).toBe("@vitnode/example");
  });

  it("credits nobody unless search names an author field", () => {
    expect(document()?.authorIds).toEqual([]);
  });

  it("credits the author field's user when search names one", () => {
    expect(contentSearchDocument(withAuthorField, row)?.authorIds).toEqual([3]);
  });

  it("credits every author in order, once each", () => {
    expect(
      contentSearchDocument(withAuthorField, { ...row, author: [5, 3, 5] })
        ?.authorIds,
    ).toEqual([5, 3]);
  });

  it("credits nobody when the author field is empty", () => {
    expect(
      contentSearchDocument(withAuthorField, { ...row, author: null })
        ?.authorIds,
    ).toEqual([]);
  });

  it("never carries a container or metadata", () => {
    const result = document();

    expect(result?.containerId).toBeUndefined();
    expect(result?.containerType).toBeUndefined();
    expect(result?.metadata).toBeUndefined();
  });

  it("prefers publishedAt over createdAt", () => {
    expect(document()?.createdAt).toEqual(PUBLISHED_AT);
    expect(
      contentSearchDocument(testSearchablePostContentType, {
        ...row,
        publishedAt: "2026-02-01T10:00:00.000Z",
      })?.createdAt,
    ).toEqual(PUBLISHED_AT);
  });

  describe("security", () => {
    it("excludes every private field value", () => {
      const serialized = JSON.stringify(document());

      expect(serialized).not.toContain("SECRET-CODE");
      expect(serialized).not.toContain("42");
      expect(serialized).not.toContain('"author"');
    });

    it("indexes a draft as a private document without a url", () => {
      const result = document({ publishedAt: null, status: "draft" });

      expect(result).toMatchObject({
        createdAt: CREATED_AT,
        isPublic: false,
        title: "Hello world",
      });
      expect(result).not.toHaveProperty("url");
    });

    it("keeps the document private when publishedAt is missing", () => {
      expect(document({ publishedAt: null })?.isPublic).toBe(false);
    });

    it("keeps the document private when publishedAt is in the future", () => {
      expect(
        document({ publishedAt: new Date(Date.now() + 60_000) })?.isPublic,
      ).toBe(false);
    });

    it("keeps a private document even when it has no slug", () => {
      expect(
        document({ publishedAt: null, slug: "", status: "draft" })?.isPublic,
      ).toBe(false);
    });

    it("returns null when search is disabled", () => {
      expect(contentSearchDocument(testPostContentType, row)).toBeNull();
    });
  });

  describe("degenerate values", () => {
    it("returns null for a blank title", () => {
      expect(document({ title: "   " })).toBeNull();
      expect(document({ title: null })).toBeNull();
    });

    it("returns null for a blank slug", () => {
      expect(document({ slug: "" })).toBeNull();
    });

    it("returns null for a non-numeric id", () => {
      expect(document({ id: "7" })).toBeNull();
    });

    it("keeps a document with no body at all", () => {
      const result = document({ body: null, excerpt: null });

      expect(result?.content).toBe("");
      expect(result?.title).toBe("Hello world");
    });
  });

  describe("text handling", () => {
    it("collapses whitespace in the title", () => {
      expect(document({ title: "  Hello \n\t world  " })?.title).toBe(
        "Hello world",
      );
    });

    it("concatenates content fields in order and skips the empty ones", () => {
      expect(document({ excerpt: null })?.content).toBe(
        "The body of the post.",
      );
      expect(document({ body: null })?.content).toBe("A short excerpt.");
    });

    it("does not index the description twice", () => {
      // `excerpt` is both the description and the first content field.
      expect(document()?.content.split("A short excerpt.")).toHaveLength(2);
    });

    it("percent-encodes an unusual slug", () => {
      expect(document({ slug: "a b" })?.url).toBe("/searchable/a%20b");
    });
  });
});
