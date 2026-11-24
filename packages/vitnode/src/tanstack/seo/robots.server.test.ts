import { createLocaleRouting } from "@vitnode/api/lib/i18n/locale-routing";
import { describe, expect, it } from "vitest";

import { resolveSeoPolicy } from "./policy.server";
import { seoRobotsTxt } from "./robots.server";

const ORIGIN = "https://example.com";

const routing = createLocaleRouting({
  defaultLocale: "en",
  locales: ["en", "pl"],
});

const robots = (
  seo: unknown,
  { origin = ORIGIN, locales = routing } = {},
): string => {
  const policy = resolveSeoPolicy(seo);
  if (policy === null) throw new Error("seo must be set");

  return seoRobotsTxt({
    origin,
    policy,
    routing: locales,
    webOrigin: ORIGIN,
  });
};

/** The `User-agent` group for one token, as its lines. */
const groupOf = (txt: string, token: string): string[] | undefined =>
  txt
    .trimEnd()
    .split("\n\n")
    .map(block => block.split("\n"))
    .find(lines => lines[0] === `User-agent: ${token}`);

const BASELINE = [
  "Allow: /",
  "Disallow: /admin",
  "Disallow: /settings",
  "Disallow: /pl/settings",
];

describe("seoRobotsTxt", () => {
  it("allows the site and excludes the AdminCP and every locale's settings", () => {
    expect(robots({ indexing: true, sitemap: { enabled: false } })).toBe(
      `${["User-agent: *", ...BASELINE].join("\n")}\n`,
    );
  });

  it("is deterministic", () => {
    const seo = {
      crawlers: { anthropic: { training: false }, googleExtended: true },
      indexing: true,
    };

    expect(robots(seo)).toBe(robots(seo));
  });

  it.each<[boolean, boolean | undefined, boolean]>([
    [true, undefined, true],
    [true, true, true],
    [true, false, false],
    [false, undefined, false],
    [false, true, false],
    [false, false, false],
  ])(
    "indexing %s, sitemap.enabled %s → Sitemap line %s",
    (indexing, enabled, listed) => {
      const txt = robots({
        indexing,
        ...(enabled === undefined ? {} : { sitemap: { enabled } }),
      });

      expect(txt.match(/^Sitemap: .*$/gm)).toEqual(
        listed ? [`Sitemap: ${ORIGIN}/sitemap.xml`] : null,
      );
      // Indexing off never blocks crawling: the noindex header must be readable.
      expect(groupOf(txt, "*")).toEqual(["User-agent: *", ...BASELINE]);
    },
  );

  it("adds no bot group for a crawler left out", () => {
    const txt = robots({ indexing: true });

    expect(txt.match(/^User-agent: /gm)).toEqual(["User-agent: "]);
  });

  it.each<[string, (allow: boolean) => Record<string, unknown>]>([
    ["OAI-SearchBot", allow => ({ openai: { search: allow } })],
    ["GPTBot", allow => ({ openai: { training: allow } })],
    ["Claude-SearchBot", allow => ({ anthropic: { search: allow } })],
    ["ClaudeBot", allow => ({ anthropic: { training: allow } })],
    ["Google-Extended", allow => ({ googleExtended: allow })],
  ])("toggles %s on its own", (token, crawlers) => {
    const blocked = robots({ crawlers: crawlers(false), indexing: true });
    const allowed = robots({ crawlers: crawlers(true), indexing: true });

    expect(groupOf(blocked, token)).toEqual([
      `User-agent: ${token}`,
      "Disallow: /",
    ]);
    // A bot obeys only its own group, so an allow group repeats the exclusions.
    expect(groupOf(allowed, token)).toEqual([
      `User-agent: ${token}`,
      ...BASELINE,
    ]);
    for (const txt of [blocked, allowed]) {
      expect(txt.match(/^User-agent: /gm)).toHaveLength(2);
    }
  });

  it("excludes translated settings paths", () => {
    const txt = robots(
      { indexing: true },
      {
        locales: createLocaleRouting({
          defaultLocale: "en",
          locales: ["en", "pl"],
          routePaths: { pl: { "/settings": "/ustawienia" } },
        }),
      },
    );

    expect(groupOf(txt, "*")).toEqual([
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /settings",
      "Disallow: /pl/ustawienia",
    ]);
  });
});
