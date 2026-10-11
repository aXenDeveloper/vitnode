import { describe, expect, it } from "vitest";

import {
  normalizeUsersRouteSearch,
  usersRouteParams,
  usersSearchFrom,
  usersSearchParams,
} from "./route-search";

describe("the request a users URL is asking for", () => {
  it("keeps the sort and the search the shared contract allows", () => {
    expect(
      usersRouteParams({ order: "asc", orderBy: "name", search: "ann" }),
    ).toEqual({ first: "10", order: "asc", orderBy: "name", search: "ann" });
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
