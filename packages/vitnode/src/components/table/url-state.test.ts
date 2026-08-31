import { describe, expect, it } from "vitest";

import {
  DEFAULT_TABLE_PAGE_SIZE,
  readTableFilter,
  readTableOrder,
  readTablePageSize,
  readTableSearch,
  toggleTableOrder,
  withTableFilter,
  withTableOrder,
  withTablePage,
  withTablePageSize,
  withTableSearch,
} from "./url-state";

/** What every control is handed: the sort, the page and something else's. */
const FULL = "search=foo&page=3&tab=media&orderBy=name&order=asc&first=20";

const DEFAULT_ORDER = { column: "createdAt", order: "desc" } as const;

describe("reading what the URL asks for", () => {
  it("falls back to the table's own default order", () => {
    expect(readTableOrder("", DEFAULT_ORDER)).toEqual(DEFAULT_ORDER);
    expect(readTableOrder("tab=media", DEFAULT_ORDER)).toEqual(DEFAULT_ORDER);
  });

  it("prefers what the URL says over the default", () => {
    expect(readTableOrder("orderBy=name&order=asc", DEFAULT_ORDER)).toEqual({
      column: "name",
      order: "asc",
    });
  });

  it("takes half an order from the URL and half from the default", () => {
    expect(readTableOrder("orderBy=name", DEFAULT_ORDER)).toEqual({
      column: "name",
      order: "desc",
    });
    expect(readTableOrder("order=asc", DEFAULT_ORDER)).toEqual({
      column: "createdAt",
      order: "asc",
    });
  });

  it("reads the page size from whichever direction is paging", () => {
    expect(readTablePageSize("first=20")).toBe(20);
    expect(readTablePageSize("last=30")).toBe(30);
  });

  it("falls back when there is no page size, or a nonsensical one", () => {
    expect(readTablePageSize("")).toBe(DEFAULT_TABLE_PAGE_SIZE);
    expect(readTablePageSize("first=abc")).toBe(DEFAULT_TABLE_PAGE_SIZE);
    expect(readTablePageSize("first=0")).toBe(DEFAULT_TABLE_PAGE_SIZE);
    expect(readTablePageSize("first=-5")).toBe(DEFAULT_TABLE_PAGE_SIZE);
  });

  it("reads the search box back out of the URL", () => {
    expect(readTableSearch(FULL)).toBe("foo");
    expect(readTableSearch("tab=media")).toBe("");
  });

  it("reads a filter's comma-separated values, ignoring empty ones", () => {
    expect(readTableFilter("roles=1,2,3", "roles")).toEqual(["1", "2", "3"]);
    expect(readTableFilter("roles=", "roles")).toEqual([]);
    expect(readTableFilter("roles=1,,2", "roles")).toEqual(["1", "2"]);
    expect(readTableFilter("tab=media", "roles")).toEqual([]);
  });

  it("accepts a query string with or without its leading question mark", () => {
    expect(readTableSearch("?search=foo")).toBe("foo");
    expect(readTablePageSize("?first=20")).toBe(20);
  });
});

describe("sorting", () => {
  it("adds a sort to a URL that had none, keeping the rest", () => {
    expect(withTableOrder("search=foo&page=3", DEFAULT_ORDER)).toBe(
      "search=foo&page=3&orderBy=createdAt&order=desc",
    );
  });

  it("replaces a sort in place rather than appending a second one", () => {
    expect(
      withTableOrder("orderBy=name&order=asc&tab=media", {
        column: "size",
        order: "desc",
      }),
    ).toBe("orderBy=size&order=desc&tab=media");
  });

  it("flips the column that is already sorted ascending", () => {
    expect(
      toggleTableOrder("orderBy=name&order=asc", {
        column: "name",
        defaultOrder: DEFAULT_ORDER,
      }),
    ).toBe("orderBy=name&order=desc");
  });

  it("starts a descending column again at ascending", () => {
    expect(
      toggleTableOrder("orderBy=name&order=desc", {
        column: "name",
        defaultOrder: DEFAULT_ORDER,
      }),
    ).toBe("orderBy=name&order=asc");
  });

  it("starts a different column at ascending", () => {
    expect(
      toggleTableOrder("orderBy=name&order=asc", {
        column: "size",
        defaultOrder: DEFAULT_ORDER,
      }),
    ).toBe("orderBy=size&order=asc");
  });

  it("treats the default order as the one the URL is already on", () => {
    // Nothing in the URL, so the table is sorted by `createdAt desc`; clicking
    // that same header must start over at ascending rather than re-assert desc.
    expect(
      toggleTableOrder("", {
        column: "createdAt",
        defaultOrder: DEFAULT_ORDER,
      }),
    ).toBe("orderBy=createdAt&order=asc");
  });

  it("keeps the search, the page and everything else", () => {
    expect(
      toggleTableOrder(FULL, { column: "size", defaultOrder: DEFAULT_ORDER }),
    ).toBe("search=foo&page=3&tab=media&orderBy=size&order=asc&first=20");
  });

  it("does not move the visitor back to the first page", () => {
    // Sorting has never reset the cursor, and the API answers a cursor against
    // the new order rather than the old one.
    const next = new URLSearchParams(
      toggleTableOrder("cursor=abc&first=20", {
        column: "name",
        defaultOrder: DEFAULT_ORDER,
      }),
    );

    expect(next.get("cursor")).toBe("abc");
    expect(next.get("first")).toBe("20");
  });
});

describe("changing the page size", () => {
  it("asks for that many rows from the start", () => {
    expect(withTablePageSize("cursor=abc&last=10&tab=media", 40)).toBe(
      "tab=media&first=40",
    );
  });

  it("takes the raw value a select hands it", () => {
    expect(withTablePageSize("", "20")).toBe("first=20");
  });

  it("keeps the sort and the search", () => {
    expect(withTablePageSize(FULL, 40)).toBe(
      "search=foo&page=3&tab=media&orderBy=name&order=asc&first=40",
    );
  });
});

describe("paging", () => {
  it("steps forwards from the end cursor", () => {
    expect(
      withTablePage("tab=media", {
        cursor: "end-1",
        direction: "next",
        pageSize: 20,
      }),
    ).toBe("tab=media&first=20&cursor=end-1");
  });

  it("steps backwards from the start cursor", () => {
    expect(
      withTablePage("tab=media", {
        cursor: "start-1",
        direction: "previous",
        pageSize: 20,
      }),
    ).toBe("tab=media&last=20&cursor=start-1");
  });

  it("drops the direction it is no longer going", () => {
    const forwards = new URLSearchParams(
      withTablePage("last=20&cursor=start-1", {
        cursor: "end-1",
        direction: "next",
        pageSize: 20,
      }),
    );

    expect(forwards.get("first")).toBe("20");
    expect(forwards.has("last")).toBe(false);

    const backwards = new URLSearchParams(
      withTablePage("first=20&cursor=end-1", {
        cursor: "start-1",
        direction: "previous",
        pageSize: 20,
      }),
    );

    expect(backwards.get("last")).toBe("20");
    expect(backwards.has("first")).toBe(false);
  });

  it("removes the cursor rather than writing an empty one", () => {
    expect(
      withTablePage("cursor=abc&first=20", {
        cursor: null,
        direction: "next",
        pageSize: 20,
      }),
    ).toBe("first=20");
  });

  it("keeps the sort, the search and unrelated parameters", () => {
    expect(
      withTablePage(FULL, {
        cursor: "end-1",
        direction: "next",
        pageSize: 20,
      }),
    ).toBe(
      "search=foo&page=3&tab=media&orderBy=name&order=asc&first=20&cursor=end-1",
    );
  });
});

describe("searching", () => {
  it("writes a long enough term", () => {
    expect(withTableSearch("tab=media", "foo")).toBe("tab=media&search=foo");
  });

  it("removes the term rather than emptying it", () => {
    expect(withTableSearch("search=foo&tab=media", "")).toBe("tab=media");
    expect(withTableSearch("search=foo&tab=media", "fo")).toBe("tab=media");
  });

  it("replaces the term in place", () => {
    expect(withTableSearch("search=foo&tab=media", "barbar")).toBe(
      "search=barbar&tab=media",
    );
  });

  it("keeps the sort", () => {
    const next = new URLSearchParams(
      withTableSearch("orderBy=name&order=asc", "foo"),
    );

    expect(next.get("orderBy")).toBe("name");
    expect(next.get("order")).toBe("asc");
  });

  it("encodes the way the URL always has", () => {
    expect(withTableSearch("", "hello world")).toBe("search=hello+world");
    expect(withTableSearch("", "a&b=c")).toBe("search=a%26b%3Dc");
  });
});

describe("filtering", () => {
  it("joins the selected values into one parameter", () => {
    expect(
      withTableFilter("tab=media", { id: "roles", values: ["1", "2"] }),
    ).toBe("tab=media&roles=1%2C2");
  });

  it("removes the parameter when nothing is selected", () => {
    expect(
      withTableFilter("roles=1,2&tab=media", { id: "roles", values: [] }),
    ).toBe("tab=media");
  });

  it("returns to the first page, because the rows changed", () => {
    expect(
      withTableFilter("cursor=abc&first=20&last=10&tab=media", {
        id: "roles",
        values: ["1"],
      }),
    ).toBe("tab=media&roles=1");
  });

  it("keeps the sort and the search", () => {
    expect(withTableFilter(FULL, { id: "roles", values: ["1"] })).toBe(
      "search=foo&page=3&tab=media&orderBy=name&order=asc&roles=1",
    );
  });

  it("survives a round trip through the reader", () => {
    const values = ["1", "2", "3"];

    expect(
      readTableFilter(withTableFilter("", { id: "roles", values }), "roles"),
    ).toEqual(values);
  });
});

describe("the helpers are pure", () => {
  it("never mutates the params it was handed", () => {
    const params = new URLSearchParams(FULL);

    withTableOrder(params, { column: "size", order: "desc" });
    withTablePageSize(params, 40);
    withTablePage(params, { cursor: "x", direction: "next", pageSize: 40 });
    withTableSearch(params, "bar");
    withTableFilter(params, { id: "roles", values: ["1"] });

    expect(params.toString()).toBe(FULL);
  });

  it("gives the same answer every time", () => {
    const once = toggleTableOrder(FULL, {
      column: "size",
      defaultOrder: DEFAULT_ORDER,
    });

    expect(
      toggleTableOrder(FULL, { column: "size", defaultOrder: DEFAULT_ORDER }),
    ).toBe(once);
  });

  it("settles rather than drifting when applied to its own output", () => {
    const once = withTableFilter(FULL, { id: "roles", values: ["1"] });

    expect(withTableFilter(once, { id: "roles", values: ["1"] })).toBe(once);
  });
});
