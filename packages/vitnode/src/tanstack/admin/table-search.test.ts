import { describe, expect, it } from "vitest";

import type { AdminTableContract } from "@/views/admin/table/params";

import { cronRouteParams, normalizeCronRouteSearch } from "./cron/route-search";
import { normalizeSearchIndexRouteSearch } from "./search-index/route-search";
import {
  adminTableSearchFrom,
  adminTableSearchParams,
  normalizeAdminTableSearch,
} from "./table-search";

const contract: AdminTableContract<"createdAt" | "name"> = {
  orderBy: ["createdAt", "name"],
  search: true,
};

describe("the default page size is the URL saying nothing", () => {
  it("is dropped from the validated search", () => {
    // A schema that answered `first: 10` would write `?first=10` into every link
    // the router builds to the route - including the sidebar's.
    expect(normalizeAdminTableSearch({ first: 10 }, contract)).toEqual({});
    expect(normalizeAdminTableSearch({}, contract)).toEqual({});
  });

  it("is kept when it is not the default", () => {
    expect(normalizeAdminTableSearch({ first: 25 }, contract)).toEqual({
      first: 25,
    });
  });

  it("keeps `last` even at the default size", () => {
    // Paging *backwards* at the default size is a different request from not
    // paging at all, and the parameter is what says so.
    expect(normalizeAdminTableSearch({ last: 10 }, contract)).toEqual({
      last: 10,
    });
  });
});

describe("page sizes are numbers, because the address bar reads them", () => {
  it("produces a number rather than a numeric string", () => {
    // TanStack Router's default serializer JSON-encodes a *string* that would
    // parse as JSON, so `'20'` is written to the URL as `first=%2220%22`.
    const search = normalizeAdminTableSearch({ first: "20" }, contract);

    expect(search.first).toBe(20);
    expect(typeof search.first).toBe("number");
  });
});

describe("the router's parsed search is read as a query string would be", () => {
  it("accepts the number a JSON-parsing router hands over", () => {
    expect(cronRouteParams({ first: 20 }).first).toBe("20");
  });

  it("accepts a boolean without turning it into a value", () => {
    expect(cronRouteParams({ orderBy: true }).orderBy).toBeUndefined();
  });

  it("ignores an object rather than coercing it", () => {
    // `String({})` is `"[object Object]"` - a value no rule would recognise but
    // every rule would have to consider.
    expect(cronRouteParams({ search: {} })).toEqual({ first: "10" });
  });

  it("carries nothing the route did not declare", () => {
    expect(normalizeCronRouteSearch({ tab: "2", utm_source: "x" })).toEqual({});
  });
});

describe("a control's query string round-trips", () => {
  it("comes back as the search it was built from", () => {
    const search = {
      first: 25,
      order: "asc" as const,
      orderBy: "name" as const,
    };
    const params = adminTableSearchParams(search, contract);

    expect(adminTableSearchFrom(params.toString(), contract)).toEqual(search);
  });

  it("re-validates what a control wrote", () => {
    // The return leg is where the table's own URL arithmetic is checked: a
    // control cannot write a sort column the route does not have.
    expect(
      adminTableSearchFrom("orderBy=password&first=5000", contract),
    ).toEqual({ first: 100 });
  });
});

describe("every schema is total and idempotent", () => {
  it.each([
    "?orderBy=password",
    "?first=5000",
    "?first=abc",
    "?cursor=%F0%9F%92%A5",
    "?search=",
    "?first=10&first=20",
  ])("renders the table rather than throwing for %s", query => {
    const input = Object.fromEntries(new URLSearchParams(query));

    expect(() => normalizeAdminTableSearch(input, contract)).not.toThrow();

    const once = normalizeAdminTableSearch(input, contract);

    expect(normalizeAdminTableSearch(once, contract)).toEqual(once);
  });
});

describe("the search index screen's single parameter", () => {
  it("keeps a term", () => {
    expect(normalizeSearchIndexRouteSearch({ search: "blog" })).toEqual({
      search: "blog",
    });
  });

  it("drops a blank one", () => {
    expect(normalizeSearchIndexRouteSearch({ search: "  " })).toEqual({});
  });

  it("names no page size", () => {
    expect(normalizeSearchIndexRouteSearch({ first: 20 })).toEqual({});
  });

  it("ignores a term the router parsed into something else", () => {
    expect(normalizeSearchIndexRouteSearch({ search: 42 })).toEqual({});
  });
});
