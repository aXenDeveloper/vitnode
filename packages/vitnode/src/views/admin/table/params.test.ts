import { describe, expect, it } from "vitest";

import type { AdminTableContract } from "./params";

import { normalizeAdminTableParams } from "./params";

/**
 * What an AdminCP list URL is allowed to mean.
 *
 * Every rule here exists because the alternative is a visible failure: a request
 * the API answers with `400`, a cache key that cannot describe the request it
 * names, or two entries holding identical rows. The four admin tables share this
 * normaliser, so a rule proved once holds for all of them.
 *
 * The contracts below stand in for the real screens' - three sortable columns,
 * optionally a search box, optionally a status filter - because what is being
 * tested is the normaliser, not the cron route's column list.
 */

const plain: AdminTableContract<"createdAt" | "lastRun" | "name"> = {
  orderBy: ["createdAt", "lastRun", "name"],
};

const searchable: AdminTableContract<"createdAt"> = {
  orderBy: ["createdAt"],
  search: true,
};

const filterable: AdminTableContract<"createdAt"> = {
  orderBy: ["createdAt"],
  status: ["pending", "failed"],
};

describe("the page size is always present", () => {
  it("defaults when the URL asks for none", () => {
    expect(normalizeAdminTableParams({}, plain)).toEqual({ first: "10" });
  });

  it("keeps a usable one", () => {
    expect(normalizeAdminTableParams({ first: "25" }, plain).first).toBe("25");
  });

  it.each(["abc", "0", "-1", "1.5", "", "1e3"])(
    "falls back rather than sending %s",
    raw => {
      // Every one of these is a `400` from the API. A hand-edited URL should
      // render the table it would have rendered anyway.
      expect(normalizeAdminTableParams({ first: raw }, plain).first).toBe("10");
    },
  );

  it("clamps past the API's maximum", () => {
    // Past 100 the API answers `400`, so a table that 400s because somebody
    // typed `?first=5000` is a broken page rather than a refused one.
    expect(normalizeAdminTableParams({ first: "5000" }, plain).first).toBe(
      "100",
    );
  });
});

describe("first and last are mutually exclusive", () => {
  it("pages backwards when only `last` is given", () => {
    expect(normalizeAdminTableParams({ last: "20" }, plain)).toEqual({
      last: "20",
    });
  });

  it("prefers forwards when a URL carries both", () => {
    // The API `400`s on both, and the table never emits both - so a URL that has
    // them was written by hand, and forward is the direction it meant.
    const params = normalizeAdminTableParams({ first: "5", last: "20" }, plain);

    expect(params).toEqual({ first: "5" });
  });

  it("does not invent a page size when `last` is unusable", () => {
    expect(normalizeAdminTableParams({ last: "abc" }, plain)).toEqual({
      first: "10",
    });
  });
});

describe("sorting is limited to the columns the screen declared", () => {
  it("keeps a declared column", () => {
    expect(
      normalizeAdminTableParams({ order: "asc", orderBy: "name" }, plain),
    ).toMatchObject({ order: "asc", orderBy: "name" });
  });

  it("drops one the table cannot sort by", () => {
    // Dropped rather than refused: the API then applies its own default
    // ordering, which is the page the administrator would have got.
    expect(
      normalizeAdminTableParams({ orderBy: "password" }, plain).orderBy,
    ).toBeUndefined();
  });

  it("drops a direction that is not a direction", () => {
    expect(
      normalizeAdminTableParams({ order: "sideways" }, plain).order,
    ).toBeUndefined();
  });
});

describe("search belongs to the screens that have a search box", () => {
  it("is kept and trimmed where declared", () => {
    expect(
      normalizeAdminTableParams({ search: "  logo  " }, searchable).search,
    ).toBe("logo");
  });

  it("is absent when blank, so `?search=` is not a second cache entry", () => {
    expect(
      normalizeAdminTableParams({ search: "   " }, searchable).search,
    ).toBeUndefined();
  });

  it("is not carried by a screen that declared none", () => {
    // Nothing an administrator puts in the query string reaches the request
    // builder unless the contract asked for it.
    expect(
      normalizeAdminTableParams({ search: "logo" }, plain).search,
    ).toBeUndefined();
  });
});

describe("the status filter is reduced to values the screen declared", () => {
  it("keeps the recognised ones", () => {
    expect(
      normalizeAdminTableParams({ status: "failed,pending" }, filterable)
        .status,
    ).toBe("failed,pending");
  });

  it("sorts and de-duplicates, so one filter is one cache entry", () => {
    expect(
      normalizeAdminTableParams(
        { status: "pending,failed,pending" },
        filterable,
      ).status,
    ).toBe("failed,pending");
  });

  it("drops the ones it does not know", () => {
    // `?status=nonsense` and no `status` are the same query, so they must be the
    // same entry - the API splits the list and ignores anything unrecognised.
    expect(
      normalizeAdminTableParams({ status: "nonsense" }, filterable).status,
    ).toBeUndefined();
  });

  it("is not carried by a screen that declared none", () => {
    expect(
      normalizeAdminTableParams({ status: "failed" }, plain).status,
    ).toBeUndefined();
  });
});

describe("a cursor is shape-checked and nothing more", () => {
  it("passes an opaque base64url value through", () => {
    expect(
      normalizeAdminTableParams({ cursor: "abcDEF-_123" }, plain).cursor,
    ).toBe("abcDEF-_123");
  });

  it.each(["💥", "a b", "", "x".repeat(513)])("drops %s", raw => {
    // Whether it decodes is the API's business; a value that cannot be one is
    // dropped rather than sent, because the honest reading of a corrupt cursor
    // is "start again".
    expect(
      normalizeAdminTableParams({ cursor: raw }, plain).cursor,
    ).toBeUndefined();
  });
});

describe("the URL as either router hands it over", () => {
  it("takes the first value of a repeated key", () => {
    // Only one value can reach the API.
    expect(
      normalizeAdminTableParams({ orderBy: ["name", "createdAt"] }, plain)
        .orderBy,
    ).toBe("name");
  });

  it("treats an absent value as absent", () => {
    expect(
      normalizeAdminTableParams({ orderBy: null }, plain).orderBy,
    ).toBeUndefined();
  });

  it("never throws on anything a query string can contain", () => {
    expect(() =>
      normalizeAdminTableParams(
        { cursor: [], first: undefined, order: null, search: [""] },
        searchable,
      ),
    ).not.toThrow();
  });
});

describe("it is idempotent", () => {
  it("normalising its own output changes nothing", () => {
    // It runs twice on every table navigation - once to turn a control's new
    // query string back into route search, once more when the router validates
    // the location that produces. A rule that moved the value on the second pass
    // would make the table drift a step per click.
    const once = normalizeAdminTableParams(
      { first: "5000", order: "asc", orderBy: "name", search: " logo " },
      searchable,
    );

    expect(normalizeAdminTableParams(once, searchable)).toEqual(once);
  });
});
