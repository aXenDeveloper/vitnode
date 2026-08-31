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

/**
 * The Content Engine list's URL contract.
 *
 * Three shapes, and the whole of this suite is about keeping them apart:
 *
 *     the URL       ?orderBy=title&categoryId=3     what an admin sees and shares
 *     the search    { orderBy: 'title', … }         the route's validated state
 *     the request   { first: '25', categoryId: '3' } what the API is asked for
 *
 * The shared admin-table half is tested in `../table-search.test.ts`; what is
 * here is the half a content type contributes - its sortable columns, whether it
 * has a search box, and its filters.
 */

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

  /**
   * The router's default parser JSON-parses every value, so a number arrives as
   * a number and a repeated key as an array. Only the first entry can reach the
   * API, and a non-scalar is absent rather than coerced - `String({})` is
   * `"[object Object]"`, which no rule would recognise.
   */
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
  /**
   * Total and idempotent, both of which are requirements of where it runs:
   * `contentListSearchFrom` is this function, so it runs on every table
   * navigation and the router then validates the location it produced. One that
   * threw would turn a hand-edited query string into an error screen.
   */
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

  /**
   * The default page size is the URL saying nothing. Answering `first: 25` would
   * write `?first=25` into every link the router builds to this route -
   * including the sidebar's.
   */
  it("omits a page size equal to the content default", () => {
    expect(normalizeContentListSearch({}, articles)).toEqual({});
    expect(
      normalizeContentListSearch({ first: CONTENT_DEFAULT_PAGE_SIZE }, articles)
        .first,
    ).toBeUndefined();
  });

  /**
   * The generated list route answers 25 when asked for no size, and the Next.js
   * list asks for none - so the request this contract sends has to be 25 too.
   * The data table's own default is 10, and taking that would quietly shrink
   * every content list.
   */
  it("asks the API for the Content Engine's page size, not the table's", () => {
    expect(contentListRouteParams({}, articles).first).toBe(
      String(CONTENT_DEFAULT_PAGE_SIZE),
    );
    expect(CONTENT_DEFAULT_PAGE_SIZE).not.toBe(DEFAULT_TABLE_PAGE_SIZE);
  });

  /**
   * Page sizes are numbers, not numeric strings. The router's default serializer
   * JSON-encodes a string that would parse as JSON, so `'20'` is written to the
   * address bar as `first=%2220%22`.
   */
  it("keeps page sizes as numbers", () => {
    expect(normalizeContentListSearch({ first: 20 }, articles).first).toBe(20);
  });
});

describe("the round trip through the table's controls", () => {
  /**
   * A control is handed a `URLSearchParams` and produces a new query string from
   * it; this is both ends of that. The return leg re-validates, so a control
   * cannot write a sort column the content type does not have.
   *
   * Asserted against the literal shape rather than against
   * `normalizeContentListSearch`: the return leg *is* that function now, so
   * comparing the two would be an identity that holds however wrong both are.
   * What has to be pinned is that a page size survives as a number, that a
   * filter survives at all, and that neither picks up a stray key on the way.
   */
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

  /**
   * And the default page size is still the URL saying nothing after the trip -
   * the property the whole contract rests on, checked at the far end rather
   * than only on the way in.
   */
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
