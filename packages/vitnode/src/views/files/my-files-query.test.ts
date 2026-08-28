import { describe, expect, it } from "vitest";

import type { BulkDeleteFilesResult } from "@/lib/files/bulk-delete";

import { readFileInUse, STORAGE_FILE_IN_USE } from "@/lib/files/in-use";

import {
  deleteMyFileRequest,
  shouldRefreshAfterBulkDelete,
} from "./my-files-delete";
import {
  describeMyFilesParams,
  isMyFilesRequestError,
  MY_FILES_MAX_PAGE_SIZE,
  MY_FILES_QUERY_ROOT,
  myFilesQueryKey,
  myFilesRequest,
  MyFilesRequestError,
  normalizeMyFilesParams,
} from "./my-files-query";

/**
 * The pure half of the files contract.
 *
 * Everything below is a function over plain values: a URL becomes parameters,
 * parameters become a request and a cache key, a response status becomes an
 * error, and a bulk result becomes a yes-or-no about refreshing. Nothing here
 * opens a socket or renders a component - the API has its own suite, and how the
 * table looks is Playwright's.
 */

describe("normalizeMyFilesParams", () => {
  it("always asks for a page, so the size is never invented later", () => {
    // The old code left this to `withPagination`, which wrote `first=10` inside
    // the URL builder where the cache key could not see it.
    expect(normalizeMyFilesParams()).toEqual({ first: "10" });
    expect(normalizeMyFilesParams({})).toEqual({ first: "10" });
  });

  it("collapses the ways of spelling the same request into one", () => {
    const key = JSON.stringify(normalizeMyFilesParams({ first: "10" }));

    expect(JSON.stringify(normalizeMyFilesParams({}))).toBe(key);
    expect(JSON.stringify(normalizeMyFilesParams({ search: "" }))).toBe(key);
    expect(JSON.stringify(normalizeMyFilesParams({ search: "   " }))).toBe(key);
    expect(JSON.stringify(normalizeMyFilesParams({ cursor: "" }))).toBe(key);
  });

  it("keeps a page size the API will accept, and repairs one it will not", () => {
    expect(normalizeMyFilesParams({ first: "40" }).first).toBe("40");
    expect(normalizeMyFilesParams({ first: "abc" }).first).toBe("10");
    expect(normalizeMyFilesParams({ first: "0" }).first).toBe("10");
    expect(normalizeMyFilesParams({ first: "-5" }).first).toBe("10");
    expect(normalizeMyFilesParams({ first: "1.5" }).first).toBe("10");
    expect(normalizeMyFilesParams({ first: "9007199254740993" }).first).toBe(
      "10",
    );
  });

  it("clamps to the largest page the API serves rather than letting it 400", () => {
    expect(normalizeMyFilesParams({ first: "5000" }).first).toBe(
      String(MY_FILES_MAX_PAGE_SIZE),
    );
    expect(normalizeMyFilesParams({ last: "5000" }).last).toBe(
      String(MY_FILES_MAX_PAGE_SIZE),
    );
  });

  it("pages backwards when the URL only asks for `last`", () => {
    expect(normalizeMyFilesParams({ cursor: "abc", last: "20" })).toEqual({
      cursor: "abc",
      last: "20",
    });
  });

  it("never sends both `first` and `last`, which the API refuses", () => {
    const params = normalizeMyFilesParams({ first: "20", last: "30" });

    expect(params).toEqual({ first: "20" });
    expect(params.last).toBeUndefined();
  });

  it("falls back to a forward page when `last` is unusable", () => {
    expect(normalizeMyFilesParams({ last: "nope" })).toEqual({ first: "10" });
  });

  it("keeps a cursor that could be one and drops anything else", () => {
    expect(normalizeMyFilesParams({ cursor: "aB9_-" }).cursor).toBe("aB9_-");
    expect(
      normalizeMyFilesParams({ cursor: "not a cursor" }).cursor,
    ).toBeUndefined();
    expect(
      normalizeMyFilesParams({ cursor: "a".repeat(513) }).cursor,
    ).toBeUndefined();
  });

  it("only sorts by a column the route will sort by", () => {
    expect(normalizeMyFilesParams({ order: "asc", orderBy: "name" })).toEqual({
      first: "10",
      order: "asc",
      orderBy: "name",
    });
    expect(
      normalizeMyFilesParams({ orderBy: "folder" }).orderBy,
    ).toBeUndefined();
    expect(
      normalizeMyFilesParams({ orderBy: "id; drop table" }).orderBy,
    ).toBeUndefined();
    expect(normalizeMyFilesParams({ order: "sideways" }).order).toBeUndefined();
  });

  it("trims a search and drops it when nothing is left", () => {
    expect(normalizeMyFilesParams({ search: "  cat.png " }).search).toBe(
      "cat.png",
    );
    expect(normalizeMyFilesParams({ search: "\t\n" }).search).toBeUndefined();
  });

  it("takes the first value when a key is repeated in the query string", () => {
    // Both routers surface `?orderBy=name&orderBy=size` as an array, and only
    // one value can reach the API.
    expect(normalizeMyFilesParams({ orderBy: ["name", "size"] }).orderBy).toBe(
      "name",
    );
    expect(normalizeMyFilesParams({ first: [] }).first).toBe("10");
  });

  it("treats a `null` from URLSearchParams.get as absent", () => {
    expect(
      normalizeMyFilesParams({
        cursor: null,
        first: null,
        order: null,
        orderBy: null,
        search: null,
      }),
    ).toEqual({ first: "10" });
  });
});

describe("myFilesRequest", () => {
  it("names the route the list actually lives at", () => {
    expect(myFilesRequest(normalizeMyFilesParams())).toEqual({
      args: { query: { first: "10" } },
      method: "get",
      module: "files",
      path: "/",
      prefixPath: "/users",
    });
  });

  it("sends the normalised parameters and nothing else", () => {
    const params = normalizeMyFilesParams({
      cursor: "abc",
      orderBy: "size",
      search: " report ",
      unknown: "value",
    } as Parameters<typeof normalizeMyFilesParams>[0]);

    expect(myFilesRequest(params).args.query).toEqual({
      cursor: "abc",
      first: "10",
      orderBy: "size",
      search: "report",
    });
  });
});

describe("myFilesQueryKey", () => {
  it("hangs off the root an invalidation can name", () => {
    expect(myFilesQueryKey(normalizeMyFilesParams()).slice(0, 2)).toEqual([
      ...MY_FILES_QUERY_ROOT,
    ]);
  });

  it("is the same key for two spellings of the same request", () => {
    expect(myFilesQueryKey(normalizeMyFilesParams({ search: "" }))).toEqual(
      myFilesQueryKey(normalizeMyFilesParams({ first: "10" })),
    );
  });

  it("is a different key for everything that changes the rows", () => {
    const base = myFilesQueryKey(normalizeMyFilesParams());
    const differing = [
      { first: "40" },
      { cursor: "abc" },
      { orderBy: "name" },
      { order: "asc" },
      { search: "cat" },
      { last: "20" },
    ];

    for (const raw of differing) {
      expect(myFilesQueryKey(normalizeMyFilesParams(raw))).not.toEqual(base);
    }
  });

  it("does not vary by language, because the rows do not", () => {
    // Only the column headings are translated, and the renderer resolves those.
    // A locale in the key would refetch an identical list on every switch.
    expect(
      JSON.stringify(myFilesQueryKey(normalizeMyFilesParams())),
    ).not.toContain("locale");
  });
});

describe("MyFilesRequestError", () => {
  it("carries the status a caller has to tell apart", () => {
    const error = new MyFilesRequestError(401, { first: "10" });

    expect(error.status).toBe(401);
    expect(error.params).toEqual({ first: "10" });
  });

  it("says which page was being asked for", () => {
    expect(
      new MyFilesRequestError(429, { first: "10", search: "cat" }).message,
    ).toContain("first=10, search=cat");
    expect(new MyFilesRequestError(500, {}).message).toContain("no filters");
  });

  it("is recognised across two copies of the module", () => {
    // `@vitnode/core` is imported from `dist` by the apps and from `src` by its
    // own tests, so `instanceof` can answer `false` for a genuine one.
    const fromAnotherCopy = Object.assign(new Error("..."), {
      name: "MyFilesRequestError",
      status: 403,
    });

    expect(isMyFilesRequestError(new MyFilesRequestError(403, {}))).toBe(true);
    expect(isMyFilesRequestError(fromAnotherCopy)).toBe(true);
  });

  it("is not confused with an ordinary failure", () => {
    expect(isMyFilesRequestError(new Error("network"))).toBe(false);
    expect(isMyFilesRequestError({ status: 401 })).toBe(false);
    expect(isMyFilesRequestError(null)).toBe(false);
  });
});

describe("describeMyFilesParams", () => {
  it("says so when there is nothing to say", () => {
    expect(describeMyFilesParams({})).toBe("no filters");
  });
});

describe("deleteMyFileRequest", () => {
  it("addresses one file by id", () => {
    expect(deleteMyFileRequest({ id: 7 })).toEqual({
      args: { params: { id: "7" }, query: {} },
      method: "delete",
      module: "files",
      path: "/{id}",
      prefixPath: "/users",
    });
  });

  it("mentions forcing only when it is forcing", () => {
    expect(deleteMyFileRequest({ force: true, id: 7 }).args.query).toEqual({
      force: "true",
    });
    expect(deleteMyFileRequest({ force: false, id: 7 }).args.query).toEqual({});
  });
});

describe("readFileInUse", () => {
  const body = (value: unknown, status = 409): Response =>
    new Response(JSON.stringify(value), { status });

  it("reads the two things a refusal is made of", async () => {
    await expect(
      readFileInUse(
        body({
          code: STORAGE_FILE_IN_USE,
          content: false,
          id: 1,
          revisions: 3,
        }),
      ),
    ).resolves.toEqual({ content: false, revisions: 3 });
  });

  it("is not a reason unless the API said it was", async () => {
    await expect(readFileInUse(body({}, 404))).resolves.toBeUndefined();
    await expect(
      readFileInUse(body({ code: "SOMETHING_ELSE" })),
    ).resolves.toBeUndefined();
    await expect(readFileInUse(body(null))).resolves.toBeUndefined();
  });

  it("survives a proxy that answered with something else entirely", async () => {
    const html = new Response("<html>gateway timeout</html>", { status: 409 });

    await expect(readFileInUse(html)).resolves.toBeUndefined();
  });

  it("defaults the fields a malformed body left out", async () => {
    await expect(
      readFileInUse(body({ code: STORAGE_FILE_IN_USE })),
    ).resolves.toEqual({ content: false, revisions: 0 });
  });
});

describe("shouldRefreshAfterBulkDelete", () => {
  const result = (
    partial: Partial<BulkDeleteFilesResult>,
  ): BulkDeleteFilesResult => ({
    blockedByContent: 0,
    deleted: 0,
    failed: 0,
    heldByRevisions: [],
    ...partial,
  });

  it("refreshes when rows actually went", () => {
    expect(shouldRefreshAfterBulkDelete(result({ deleted: 1 }))).toBe(true);
  });

  it("leaves a refused run exactly as it was", () => {
    // Refetching here would drop the selection that is showing which rows were
    // kept, which is the only thing telling the person what to do next.
    expect(shouldRefreshAfterBulkDelete(result({ blockedByContent: 3 }))).toBe(
      false,
    );
    expect(
      shouldRefreshAfterBulkDelete(result({ heldByRevisions: [1, 2] })),
    ).toBe(false);
    expect(shouldRefreshAfterBulkDelete(result({ failed: 2 }))).toBe(false);
    expect(shouldRefreshAfterBulkDelete(result({}))).toBe(false);
  });

  it("refreshes a partial run, because something did change", () => {
    expect(
      shouldRefreshAfterBulkDelete(
        result({ blockedByContent: 1, deleted: 2, heldByRevisions: [9] }),
      ),
    ).toBe(true);
  });
});
