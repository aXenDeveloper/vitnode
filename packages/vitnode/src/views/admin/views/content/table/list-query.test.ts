// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  contentListApiRequest,
  contentListRequestKey,
  contentListWireQuery,
  zodContentListPage,
} from "./list-query";

/**
 * The Content Engine list's query contract.
 *
 * Two claims, and the whole suite is about them:
 *
 * - **The key is the request.** Everything that changes the rows is in it, and
 *   nothing that cannot is. Two spellings of one request are one entry; two
 *   different requests are never one.
 * - **The response is checked.** A body the content type does not describe is a
 *   rejected read, not a half-rendered row.
 */

const target = { permissionModule: "posts", pluginId: "@vitnode/blog" };

const request = (
  query: Record<string, string | undefined>,
  locale?: string,
) => ({
  contentTypeId: "blog.post",
  ...(locale === undefined ? {} : { locale }),
  query,
  target,
});

describe("the wire query", () => {
  it("is the URL contract, flattened", () => {
    expect(
      contentListWireQuery({
        query: { first: "25", orderBy: "title", status: "draft" },
      }),
    ).toEqual({ first: "25", orderBy: "title", status: "draft" });
  });

  it("drops a parameter the URL did not ask for", () => {
    // `undefined` and absent are the same request, so they must be the same
    // object - a key with an undefined value hashes differently from no key.
    expect(
      contentListWireQuery({ query: { cursor: undefined, first: "25" } }),
    ).toEqual({ first: "25" });
  });

  it("sorts its keys, so two spellings of one request are one entry", () => {
    const a = contentListWireQuery({
      query: { first: "25", orderBy: "title" },
    });
    const b = contentListWireQuery({
      query: { orderBy: "title", first: "25" },
    });

    expect(Object.keys(a)).toEqual(["first", "orderBy"]);
    expect(Object.keys(a)).toEqual(Object.keys(b));
  });

  it("carries the viewing locale, which changes every localized cell", () => {
    expect(
      contentListWireQuery({ locale: "pl", query: { first: "25" } }),
    ).toEqual({ first: "25", locale: "pl" });
  });

  it("leaves it out entirely when the caller did not name one", () => {
    // A content type without translations reads the same rows in every AdminCP
    // language, and one cache entry per language would hold identical bytes.
    expect(contentListWireQuery({ query: { first: "25" } })).toEqual({
      first: "25",
    });
  });
});

describe("the cache key", () => {
  it("is the content type's list root plus the request", () => {
    expect(contentListRequestKey(request({ first: "25" }))).toEqual([
      "vitnode",
      "admin",
      "content",
      "blog.post",
      "list",
      { first: "25" },
    ]);
  });

  it("holds nothing but strings - no target, no function, no component", () => {
    const key = contentListRequestKey(request({ first: "25" }, "pl"));
    const params = key.at(-1);

    expect(JSON.stringify(key)).not.toContain("@vitnode/blog");
    expect(
      Object.values(params as Record<string, unknown>).every(
        value => typeof value === "string",
      ),
    ).toBe(true);
  });

  it("separates two content types asking for the same page", () => {
    expect(contentListRequestKey(request({ first: "25" }))).not.toEqual(
      contentListRequestKey({
        ...request({ first: "25" }),
        contentTypeId: "blog.category",
      }),
    );
  });

  it("separates two pages of one list", () => {
    expect(contentListRequestKey(request({ first: "25" }))).not.toEqual(
      contentListRequestKey(request({ cursor: "abc", first: "25" })),
    );
  });

  it("separates a filter from no filter", () => {
    expect(contentListRequestKey(request({ first: "25" }))).not.toEqual(
      contentListRequestKey(request({ categoryId: "3", first: "25" })),
    );
  });

  it("separates two languages of one localized list", () => {
    expect(contentListRequestKey(request({ first: "25" }, "en"))).not.toEqual(
      contentListRequestKey(request({ first: "25" }, "pl")),
    );
  });

  it("is stable across two spellings of the same request", () => {
    expect(
      contentListRequestKey(request({ first: "25", orderBy: "title" }, "pl")),
    ).toEqual(
      contentListRequestKey(request({ orderBy: "title", first: "25" }, "pl")),
    );
  });
});

describe("the API request", () => {
  it("addresses the generated module with the same query the key names", () => {
    const built = contentListApiRequest(request({ first: "25" }, "pl"));

    expect(built).toEqual({
      method: "get",
      query: { first: "25", locale: "pl" },
      target,
    });
    expect(built.query).toEqual(
      contentListRequestKey(request({ first: "25" }, "pl")).at(-1),
    );
  });
});

describe("one page, as the table model", () => {
  const page = {
    edges: [
      {
        // A content type's own fields, which no generic schema can enumerate.
        id: 7,
        labels: { author: null, category: "News" },
        status: "published",
        title: "Hello",
        version: 3,
      },
    ],
    pageInfo: {
      count: 1,
      endCursor: "b",
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: "a",
      totalCount: 1,
    },
  };

  it("keeps the content type's own columns, which the cells read", () => {
    const parsed = zodContentListPage.parse(page);

    expect(parsed.edges[0]).toMatchObject({
      status: "published",
      title: "Hello",
      version: 3,
    });
  });

  it("keeps the reference labels a relation cell renders", () => {
    expect(zodContentListPage.parse(page).edges[0]?.labels).toEqual({
      author: null,
      category: "News",
    });
  });

  it("carries the pager exactly as the API sends it", () => {
    expect(zodContentListPage.parse(page).pageInfo).toEqual(page.pageInfo);
  });

  it("tells an untranslated record from a content type with no translations", () => {
    const localized = zodContentListPage.parse({
      ...page,
      edges: [{ ...page.edges[0], translation: null }],
    });

    // `null` is "nobody has translated this yet", which the cell renders as
    // Missing; `undefined` is "this content type has no translations at all".
    expect(localized.edges[0]?.translation).toBeNull();
    expect(
      zodContentListPage.parse(page).edges[0]?.translation,
    ).toBeUndefined();
  });

  it("reads a translation's localized values", () => {
    const parsed = zodContentListPage.parse({
      ...page,
      edges: [
        {
          ...page.edges[0],
          translation: {
            locale: "pl",
            title: "Witaj",
            values: { title: "Witaj" },
          },
        },
      ],
    });

    expect(parsed.edges[0]?.translation?.values).toEqual({ title: "Witaj" });
  });

  it("refuses a body this content type does not describe", () => {
    // The deployment fault worth failing loudly on: the installed plugin and the
    // running API disagree about the shape. Rendering half a row would hide it.
    expect(
      zodContentListPage.safeParse({ ...page, edges: [{ id: "seven" }] })
        .success,
    ).toBe(false);
    expect(zodContentListPage.safeParse({ edges: [] }).success).toBe(false);
  });
});
