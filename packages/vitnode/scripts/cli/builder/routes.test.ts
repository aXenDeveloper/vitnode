import { describe, expect, it } from "vitest";

import { routeReportApiOf, urlPathOfHtmlFile } from "./routes";

describe("urlPathOfHtmlFile", () => {
  it("serves an index file at its directory", () => {
    expect(urlPathOfHtmlFile("index.html")).toBe("/");
    expect(urlPathOfHtmlFile("pl/solutions/index.html")).toBe("/pl/solutions");
  });

  it("serves any other file at its name", () => {
    expect(urlPathOfHtmlFile("404.html")).toBe("/404");
  });
});

describe("routeReportApiOf", () => {
  it("finds the report on VitNode's routes plugin", () => {
    const routeReport = () => [];

    expect(
      routeReportApiOf([
        { name: "nitro:main" },
        { api: { routeReport }, name: "vitnode:plugin-routes" },
      ])?.routeReport,
    ).toBe(routeReport);
  });

  it("answers null for a plugin without the report", () => {
    expect(routeReportApiOf([{ name: "vitnode:plugin-routes" }])).toBeNull();
  });
});
