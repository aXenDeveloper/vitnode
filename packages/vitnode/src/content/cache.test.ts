// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  contentInvalidationTags,
  contentPublicItemTag,
  contentPublicListTag,
  contentPublicSlugTag,
  isContentPubliclyVisible,
} from "./cache";
import { CONTENT_CACHE_TAG_MAX_LENGTH } from "./const";

const ID = "example.article";

describe("cache tags", () => {
  it("are deterministic and readable", () => {
    expect(contentPublicListTag(ID)).toBe("content:example.article:list");
    expect(contentPublicItemTag(ID, 12)).toBe(
      "content:example.article:item:12",
    );
    expect(contentPublicSlugTag(ID, "hello-world")).toBe(
      "content:example.article:slug:hello-world",
    );
  });

  it("gives the same answer every time", () => {
    expect(contentPublicSlugTag(ID, "hello")).toBe(
      contentPublicSlugTag(ID, "hello"),
    );
  });

  it("isolates one content type from another", () => {
    // The content type id is globally unique and already namespaced, so no
    // plugin id is needed - but two of them must never collide.
    expect(contentPublicListTag("example.article")).not.toBe(
      contentPublicListTag("blog.article"),
    );
    expect(contentPublicItemTag("example.article", 1)).not.toBe(
      contentPublicItemTag("example.category", 1),
    );
  });

  it("keeps the scopes apart", () => {
    expect(contentPublicItemTag(ID, 12)).not.toBe(
      contentPublicSlugTag(ID, "12"),
    );
  });

  describe("length", () => {
    // A slug can be 160 characters and a content type id is unbounded, so the
    // 256-character cap Next imposes is reachable.
    const long = "a".repeat(400);

    it("stays inside the limit", () => {
      expect(contentPublicSlugTag(ID, long).length).toBeLessThanOrEqual(
        CONTENT_CACHE_TAG_MAX_LENGTH,
      );
      expect(contentPublicListTag("plugin." + long).length).toBeLessThanOrEqual(
        CONTENT_CACHE_TAG_MAX_LENGTH,
      );
    });

    it("keeps two long values distinct", () => {
      // Plain truncation would collapse these onto one tag, and publishing one
      // article would expire another.
      expect(contentPublicSlugTag(ID, `${long}-one`)).not.toBe(
        contentPublicSlugTag(ID, `${long}-two`),
      );
    });

    it("is still deterministic once clamped", () => {
      expect(contentPublicSlugTag(ID, long)).toBe(
        contentPublicSlugTag(ID, long),
      );
    });
  });
});

describe("isContentPubliclyVisible", () => {
  const past = new Date(Date.now() - 60_000);
  const future = new Date(Date.now() + 60_000);

  it.each([
    ["a published row with a past date", "published", past, true],
    ["a draft", "draft", past, false],
    ["a published row with no date", "published", null, false],
    ["a published row dated in the future", "published", future, false],
    ["a row with no publication at all", undefined, undefined, false],
  ])("%s", (_name, status, publishedAt, expected) => {
    expect(isContentPubliclyVisible({ publishedAt, status })).toBe(expected);
  });

  it("accepts the ISO string a JSON response carries", () => {
    expect(
      isContentPubliclyVisible({
        publishedAt: past.toISOString(),
        status: "published",
      }),
    ).toBe(true);
  });

  it("refuses an unparseable date rather than assuming", () => {
    expect(
      isContentPubliclyVisible({
        publishedAt: "not a date",
        status: "published",
      }),
    ).toBe(false);
  });
});

describe("the invalidation matrix", () => {
  const tags = (input: {
    isPublic: boolean;
    slugs?: string[];
    wasPublic: boolean;
  }) =>
    contentInvalidationTags({
      contentTypeId: ID,
      id: 12,
      slugs: ["hello"],
      ...input,
    });

  const LIST = "content:example.article:list";
  const ITEM = "content:example.article:item:12";
  const SLUG = "content:example.article:slug:hello";

  it("creates a draft without touching anything", () => {
    expect(tags({ isPublic: false, wasPublic: false })).toEqual([]);
  });

  it("edits a draft without touching anything", () => {
    // Nothing public changed, so throwing away a warm cache would be free harm.
    expect(
      tags({
        isPublic: false,
        slugs: ["hello", "hello-again"],
        wasPublic: false,
      }),
    ).toEqual([]);
  });

  it("publishes: list, item and slug", () => {
    expect(tags({ isPublic: true, wasPublic: false })).toEqual([
      LIST,
      ITEM,
      SLUG,
    ]);
  });

  it("updates published content: list, item and slug", () => {
    expect(tags({ isPublic: true, wasPublic: true })).toEqual([
      LIST,
      ITEM,
      SLUG,
    ]);
  });

  it("updates a changed slug: both the old URL and the new one", () => {
    // The old one has to stop resolving and the new one has to start, so both
    // are expired in the same pass.
    expect(
      tags({ isPublic: true, slugs: ["old", "new"], wasPublic: true }),
    ).toEqual([
      LIST,
      ITEM,
      "content:example.article:slug:old",
      "content:example.article:slug:new",
    ]);
  });

  it("unpublishes: list, item and slug", () => {
    expect(tags({ isPublic: false, wasPublic: true })).toEqual([
      LIST,
      ITEM,
      SLUG,
    ]);
  });

  it("deletes something that was public: list, item and slug", () => {
    expect(tags({ isPublic: false, wasPublic: true })).toEqual([
      LIST,
      ITEM,
      SLUG,
    ]);
  });

  it("deletes a draft without touching anything", () => {
    expect(tags({ isPublic: false, wasPublic: false })).toEqual([]);
  });

  it("never invalidates globally, or across content types", () => {
    for (const tag of tags({ isPublic: true, wasPublic: true })) {
      expect(tag.startsWith(`content:${ID}:`)).toBe(true);
    }
  });

  it("does not repeat a slug that did not change", () => {
    expect(
      tags({ isPublic: true, slugs: ["hello", "hello"], wasPublic: true }),
    ).toEqual([LIST, ITEM, SLUG]);
  });

  it("skips a slug it does not know", () => {
    // A content type with no public API has no slug field, so the empty string
    // must not become `content:...:slug:`.
    expect(
      tags({ isPublic: true, slugs: ["", "hello"], wasPublic: true }),
    ).toEqual([LIST, ITEM, SLUG]);
  });
});
