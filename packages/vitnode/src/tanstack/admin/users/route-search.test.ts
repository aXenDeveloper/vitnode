import { describe, expect, it } from "vitest";

import {
  normalizeUsersRouteSearch,
  usersRouteParams,
  usersSearchFrom,
  usersSearchParams,
} from "./route-search";

describe("the request a users URL is asking for", () => {
  it("always names a page size, so the key describes the request", () => {
    expect(usersRouteParams({})).toEqual({ first: "10" });
  });

  it("keeps the sort and the search the shared contract allows", () => {
    expect(
      usersRouteParams({ order: "asc", orderBy: "name", search: "ann" }),
    ).toEqual({ first: "10", order: "asc", orderBy: "name", search: "ann" });
  });

  it("drops a sort column the API would refuse", () => {
    expect(usersRouteParams({ orderBy: "email" })).not.toHaveProperty(
      "orderBy",
    );
  });

  it("carries the role filter through", () => {
    expect(usersRouteParams({ roleId: "2,5" })).toMatchObject({
      roleId: "2,5",
    });
  });

  it("reads a repeated parameter as one selection", () => {
    // `?roleId=2&roleId=5` is what a hand-written link produces; the dropdown
    // writes `?roleId=2,5`. They are the same filter.
    expect(usersRouteParams({ roleId: ["2", "5"] })).toMatchObject({
      roleId: "2,5",
    });
  });

  it("reads a single numeric value the router parsed for it", () => {
    // TanStack's default search parser JSON-parses every value, so `?roleId=2`
    // arrives as the number 2 rather than the string.
    expect(usersRouteParams({ roleId: 2 })).toMatchObject({ roleId: "2" });
  });

  it.each(["abc", "", "0", "-1", ",,", "1.5"])(
    "drops %o rather than filtering by NaN",
    roleId => {
      expect(usersRouteParams({ roleId })).not.toHaveProperty("roleId");
    },
  );

  it("ignores a parameter the contract does not name", () => {
    expect(usersRouteParams({ tab: "2", utm_source: "x" })).toEqual({
      first: "10",
    });
  });
});

describe("the route's validateSearch", () => {
  it("normalises rather than rejects", () => {
    expect(() =>
      normalizeUsersRouteSearch({
        cursor: "💥",
        first: "abc",
        orderBy: "password",
        roleId: "nonsense",
      }),
    ).not.toThrow();
  });

  it("keeps the default page size out of the URL", () => {
    // `/admin/core/users` and `/admin/core/users?first=10` are the same page,
    // and the shorter spelling is the one every link the router builds gets.
    expect(normalizeUsersRouteSearch({ first: 10 })).toEqual({});
  });

  it("is idempotent, because the router re-validates every location", () => {
    const once = normalizeUsersRouteSearch({
      first: 20,
      roleId: "5,2",
      search: "ann",
    });

    expect(normalizeUsersRouteSearch(once)).toEqual(once);
  });

  it("writes a page size as a number, so the URL is not JSON-quoted", () => {
    // TanStack's default serializer JSON-encodes a *string* that would parse as
    // JSON, so `'20'` becomes `first=%2220%22` and the API answers 400.
    expect(normalizeUsersRouteSearch({ first: 20 }).first).toBe(20);
  });
});

describe("the round trip through the table's own controls", () => {
  it("hands the controls a query string built from the validated search", () => {
    expect(
      usersSearchParams({ orderBy: "name", roleId: "2,5" }).toString(),
    ).toBe("orderBy=name&roleId=2%2C5");
  });

  it("takes a control's query string back as route search", () => {
    expect(usersSearchFrom("orderBy=name&order=desc&roleId=5,2")).toEqual({
      order: "desc",
      orderBy: "name",
      roleId: "2,5",
    });
  });

  it("re-validates what a control wrote", () => {
    // A control cannot write a sort column the route does not have, because
    // what it wrote goes through the same schema the address bar does.
    expect(usersSearchFrom("orderBy=password&roleId=abc")).toEqual({});
  });

  it("survives a full round trip unchanged", () => {
    const search = normalizeUsersRouteSearch({
      first: 20,
      orderBy: "name",
      roleId: "2,5",
      search: "ann",
    });

    expect(usersSearchFrom(usersSearchParams(search).toString())).toEqual(
      search,
    );
  });
});
