import { describe, expect, it } from "vitest";

import {
  injectNoIndexMeta,
  withNoIndexDocument,
  withNoIndexHeader,
} from "./html.server";

const META = '<meta name="robots" content="noindex"/>';

const page = (robots?: string): Response =>
  new Response("<html><head><title>Hi</title></head><body></body></html>", {
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...(robots === undefined ? {} : { "x-robots-tag": robots }),
    },
    status: 200,
  });

describe("withNoIndexHeader", () => {
  it.each<[string | undefined, string]>([
    [undefined, "noindex"],
    ["nofollow", "nofollow, noindex"],
    ["noindex, nofollow", "noindex, nofollow"],
    ["NoIndex", "NoIndex"],
    ["none", "none"],
  ])("%j → %j", (existing, expected) => {
    expect(withNoIndexHeader(page(existing)).headers.get("x-robots-tag")).toBe(
      expected,
    );
  });

  it("keeps the status and body", async () => {
    const response = withNoIndexHeader(
      new Response("<p>gone</p>", {
        headers: { "content-type": "text/html" },
        status: 404,
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("<p>gone</p>");
  });
});

describe("injectNoIndexMeta", () => {
  it.each<[string, string]>([
    [
      "<html><head><title>x</title></head></html>",
      `<html><head>${META}<title>x</title></head></html>`,
    ],
    [
      '<html><HEAD lang="en"><title>x</title>',
      `<html><HEAD lang="en">${META}<title>x</title>`,
    ],
    [`<html><head>${META}</head></html>`, `<html><head>${META}</head></html>`],
    [
      "<html><header>no head</header></html>",
      "<html><header>no head</header></html>",
    ],
  ])("%j", (html, expected) => {
    expect(injectNoIndexMeta(html)).toBe(expected);
  });
});

describe("withNoIndexDocument", () => {
  it("adds the meta and the header and drops a stale content-length", async () => {
    const source = page("nofollow");
    source.headers.set("content-length", "10");

    const response = await withNoIndexDocument(source);

    expect(await response.text()).toContain(`<head>${META}<title>`);
    expect(response.headers.get("x-robots-tag")).toBe("nofollow, noindex");
    expect(response.headers.get("content-length")).toBeNull();
  });
});
