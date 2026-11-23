import { describe, expect, it } from "vitest";

import type { RobotsTxtInput } from "./robots";

import {
  AI_TRAINING_CRAWLERS,
  buildRobotsTxt,
  normalizeCustomRobots,
} from "./robots";

const input = (overrides: Partial<RobotsTxtInput> = {}): RobotsTxtInput => ({
  allowIndexing: true,
  blockAiCrawlers: false,
  customRobots: "",
  disallow: ["/admin", "/pl/admin"],
  sitemapUrl: "https://example.com/sitemap.xml",
  ...overrides,
});

describe("normalizeCustomRobots", () => {
  it.each([
    ["CRLF and CR line endings", "a\r\nb\rc", "a\nb\nc"],
    [
      "control characters",
      "User-agent: *\u0000\u0007\u001B\u007F",
      "User-agent: *",
    ],
    ["trailing whitespace on each line", "a  \nb\t", "a\nb"],
    [
      "trailing and leading blank lines",
      "\n\nDisallow: /x\n\n\n",
      "Disallow: /x",
    ],
    ["tabs inside a line, which are kept", "a\tb", "a\tb"],
  ])("handles %s", (_, value, expected) => {
    expect(normalizeCustomRobots(value)).toBe(expected);
  });
});

describe("buildRobotsTxt", () => {
  it("says only `Disallow: /` when indexing is off, whatever else is set", () => {
    expect(
      buildRobotsTxt(
        input({
          allowIndexing: false,
          blockAiCrawlers: true,
          customRobots: "User-agent: Foo\nAllow: /",
          offline: true,
        }),
      ),
    ).toBe(
      "# Search engine indexing is turned off for this site.\nUser-agent: *\nDisallow: /\n",
    );
  });

  it("disallows each path once, then lists the sitemap", () => {
    expect(
      buildRobotsTxt(input({ disallow: ["/admin", "/pl/admin", "/admin"] })),
    ).toBe(
      [
        "User-agent: *",
        "Disallow: /admin",
        "Disallow: /pl/admin",
        "",
        "Sitemap: https://example.com/sitemap.xml",
        "",
      ].join("\n"),
    );
  });

  it("allows everything when no path is disallowed and leaves out a missing sitemap", () => {
    expect(buildRobotsTxt(input({ disallow: [], sitemapUrl: null }))).toBe(
      "User-agent: *\nAllow: /\n",
    );
  });

  it("adds one group that blocks every AI training crawler", () => {
    const lines = buildRobotsTxt(
      input({ blockAiCrawlers: true, sitemapUrl: null }),
    ).split("\n");
    const group = lines.slice(lines.indexOf("") + 1, -1);

    expect(group).toStrictEqual([
      ...AI_TRAINING_CRAWLERS.map(agent => `User-agent: ${agent}`),
      "Disallow: /",
    ]);
  });

  it("appends normalized custom rules between the groups and the sitemap", () => {
    expect(
      buildRobotsTxt(
        input({
          customRobots: "User-agent: Foo\r\nDisallow: /bar\r\n\r\n",
          disallow: ["/admin"],
        }),
      ),
    ).toBe(
      [
        "User-agent: *",
        "Disallow: /admin",
        "",
        "User-agent: Foo",
        "Disallow: /bar",
        "",
        "Sitemap: https://example.com/sitemap.xml",
        "",
      ].join("\n"),
    );
  });

  it("leaves out custom rules that are only whitespace", () => {
    expect(buildRobotsTxt(input({ customRobots: " \n\t\n" }))).toBe(
      buildRobotsTxt(input()),
    );
  });

  it("opens with a comment while the site is offline", () => {
    expect(buildRobotsTxt(input({ offline: true }))).toBe(
      `# The site is offline for maintenance. Please come back later.\n${buildRobotsTxt(input())}`,
    );
  });
});
