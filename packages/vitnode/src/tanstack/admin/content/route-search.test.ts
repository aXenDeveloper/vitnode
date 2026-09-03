// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { AnyContentTypeDefinition } from "@/content/types";

import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";
import { CONTENT_DEFAULT_PAGE_SIZE } from "@/content/const";
import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import { contentFilterableFields } from "@/content/registry";

import {
  contentListFilters,
  contentListQuery,
  contentListRouteParams,
  contentListSearchFrom,
  contentListSearchParams,
  contentTableContract,
  normalizeContentListSearch,
} from "./route-search";

const articles = defineContentType({
  id: "blog.post",
  tableName: "blog_post",
  fields: {
    title: field.text({ required: true }),
    body: field.textarea({ nullable: true }),
    views: field.number({ integer: true, nullable: true }),
    featured: field.boolean({ defaultValue: false }),
    tone: field.enum({ defaultValue: "calm", values: ["calm", "loud"] }),
  },
  admin: {
    list: { orderableFields: ["title"], searchableFields: ["title"] },
  },
  publication: { enabled: true },
}) as AnyContentTypeDefinition;

/** No searchable fields, no publication - the narrowest possible contract. */
const notes = defineContentType({
  id: "blog.note",
  tableName: "blog_note",
  fields: { title: field.text({ required: true }) },
  // Declared empty on purpose: `searchableFields` otherwise defaults to every
  // text, textarea and slug column, so a content type with any prose has a
  // search box unless it says it does not.
  admin: { list: { searchableFields: [] } },
}) as AnyContentTypeDefinition;

describe("contentTableContract", () => {
  it("takes its sortable columns from the content type", () => {
    expect(contentTableContract(articles).orderBy).toContain("title");
    // System and publication columns are always orderable.
    expect(contentTableContract(articles).orderBy).toContain("createdAt");
    expect(contentTableContract(articles).orderBy).toContain("publishedAt");
  });

  it("turns the search box on only for a type that declared searchable fields", () => {
    expect(contentTableContract(articles).search).toBe(true);
    expect(contentTableContract(notes).search).toBe(false);
  });
});

describe("contentFilterableFields", () => {
  it("names the filterable kinds and nothing else", () => {
    const names = contentFilterableFields(articles);

    expect(names).toContain("title");
    expect(names).toContain("views");
    expect(names).toContain("featured");
    expect(names).toContain("tone");
    // A textarea has no equality filter - the query builder does not branch on
    // one, so a `?body=` would be carried in the URL and ignored by the API.
    expect(names).not.toContain("body");
  });

  it("adds status for a content type with publication, and only then", () => {
    expect(contentFilterableFields(articles)).toContain("status");
    expect(contentFilterableFields(notes)).not.toContain("status");
  });

  it("is sorted, so the set is stable wherever it is compared", () => {
    const names = contentFilterableFields(articles);

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("contentListFilters", () => {
  it("keeps a filter the content type accepts", () => {
    expect(contentListFilters({ status: "draft" }, articles)).toEqual({
      status: "draft",
    });
  });

  /**
   * A key outside the contract reaches neither the URL the controls rebuild nor
   * the cache key. `?tab=2` is not a filter and must not become one.
   */
  it("drops a key the content type does not accept", () => {
    expect(contentListFilters({ nope: "1", tab: "2" }, articles)).toEqual({});
  });

  it("drops a blank filter, which the API treats as no filter", () => {
    expect(contentListFilters({ status: "", tone: "  " }, articles)).toEqual(
      {},
    );
  });

  it("normalises what the router's parser produced", () => {
    expect(contentListFilters({ views: 12 }, articles)).toEqual({
      views: "12",
    });
    expect(contentListFilters({ tone: ["calm", "loud"] }, articles)).toEqual({
      tone: "calm",
    });
    expect(contentListFilters({ views: {} }, articles)).toEqual({});
    expect(contentListFilters({ views: null }, articles)).toEqual({});
  });

  it("orders the filters, so two spellings of one request are one cache entry", () => {
    expect(
      Object.keys(
        contentListFilters({ views: "1", featured: "true" }, articles),
      ),
    ).toEqual(["featured", "views"]);
  });
});

describe("contentListRouteParams", () => {
  it("carries the shared table parameters and the filters together", () => {
    const params = contentListRouteParams(
      { first: 20, orderBy: "title", status: "draft" },
      articles,
    );

    expect(params.first).toBe("20");
    expect(params.orderBy).toBe("title");
    expect(params.filters).toEqual({ status: "draft" });
  });

  it("always names a page size, because the request must", () => {
    expect(contentListRouteParams({}, articles).first).toBeDefined();
  });

  it("drops a sort column this content type cannot sort by", () => {
    expect(contentListRouteParams({ orderBy: "body" }, articles).orderBy).toBe(
      undefined,
    );
  });

  it("drops a search term for a content type with no search box", () => {
    expect(contentListRouteParams({ search: "hi" }, notes).search).toBe(
      undefined,
    );
    expect(contentListRouteParams({ search: "hi" }, articles).search).toBe(
      "hi",
    );
  });
});

describe("normalizeContentListSearch", () => {
  it("never throws, whatever is in the query string", () => {
    expect(() =>
      normalizeContentListSearch(
        { cursor: "💥", first: "abc", orderBy: "password", status: {} },
        articles,
      ),
    ).not.toThrow();
  });

  it("is idempotent", () => {
    const once = normalizeContentListSearch(
      { first: 20, orderBy: "title", status: "draft" },
      articles,
    );

    expect(normalizeContentListSearch(once, articles)).toEqual(once);
  });

  it("omits a page size equal to the content default", () => {
    expect(normalizeContentListSearch({}, articles)).toEqual({});
    expect(
      normalizeContentListSearch({ first: CONTENT_DEFAULT_PAGE_SIZE }, articles)
        .first,
    ).toBeUndefined();
  });

  it("asks the API for the Content Engine's page size, not the table's", () => {
    expect(contentListRouteParams({}, articles).first).toBe(
      String(CONTENT_DEFAULT_PAGE_SIZE),
    );
    expect(CONTENT_DEFAULT_PAGE_SIZE).not.toBe(DEFAULT_TABLE_PAGE_SIZE);
  });

  it("keeps page sizes as numbers", () => {
    expect(normalizeContentListSearch({ first: 20 }, articles).first).toBe(20);
  });
});

describe("the round trip through the table's controls", () => {
  it("survives search params out and back", () => {
    const search = { first: 20, orderBy: "title", status: "draft" };
    const params = contentListSearchParams(search, articles);

    expect(params.get("orderBy")).toBe("title");
    expect(params.get("status")).toBe("draft");

    expect(contentListSearchFrom(params.toString(), articles)).toEqual({
      first: 20,
      orderBy: "title",
      status: "draft",
    });
  });

  it("drops a default page size on the way back", () => {
    const params = contentListSearchParams({ orderBy: "title" }, articles);

    expect(contentListSearchFrom(params.toString(), articles)).toEqual({
      orderBy: "title",
    });
  });

  it("re-validates what a control wrote", () => {
    expect(contentListSearchFrom("orderBy=body&nope=1", articles)).toEqual({});
  });
});

describe("contentListQuery", () => {
  it("flattens the filters beside the pagination parameters", () => {
    expect(
      contentListQuery(
        contentListRouteParams({ first: 20, status: "draft" }, articles),
      ),
    ).toEqual({ first: "20", status: "draft" });
  });

  it("carries no `filters` key of its own to the wire", () => {
    expect(
      contentListQuery(contentListRouteParams({}, articles)),
    ).not.toHaveProperty("filters");
  });
});
