import { describe, expect, it } from "vitest";

import type { SeoSettings } from "./settings";

import { mergeSeoSettings } from "./settings";

const SAVED: SeoSettings = {
  allowIndexing: true,
  blockAiCrawlers: false,
  customRobots: "User-agent: Foo",
  sitemap: {
    disabledSources: ["static"],
    enabled: true,
    maxUrlsPerFile: 5000,
  },
};

describe("mergeSeoSettings", () => {
  it("keeps every saved value a partial update leaves out", () => {
    expect(
      mergeSeoSettings(SAVED, {
        blockAiCrawlers: true,
        sitemap: { maxUrlsPerFile: 100 },
      }),
    ).toStrictEqual({
      ...SAVED,
      blockAiCrawlers: true,
      sitemap: { ...SAVED.sitemap, maxUrlsPerFile: 100 },
    });
  });

  it("saves an empty custom block and `false` flags rather than ignoring them", () => {
    expect(
      mergeSeoSettings(SAVED, {
        allowIndexing: false,
        customRobots: "",
        sitemap: { disabledSources: [], enabled: false },
      }),
    ).toStrictEqual({
      allowIndexing: false,
      blockAiCrawlers: false,
      customRobots: "",
      sitemap: { disabledSources: [], enabled: false, maxUrlsPerFile: 5000 },
    });
  });

  it("dedupes and sorts the disabled sources", () => {
    expect(
      mergeSeoSettings(SAVED, {
        sitemap: { disabledSources: ["blog_post", "static", "blog_post"] },
      }).sitemap.disabledSources,
    ).toStrictEqual(["blog_post", "static"]);
  });
});
