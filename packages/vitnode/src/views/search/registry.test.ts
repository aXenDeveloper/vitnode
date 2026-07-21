import { describe, expect, it } from "vitest";

import { getSearchTypeRenderer, searchTypeKeys } from "./registry";

describe("getSearchTypeRenderer", () => {
  it("returns a dedicated renderer for a known type", () => {
    expect(getSearchTypeRenderer("blog_post").labelKey).toBe("types.blog_post");
  });

  it("falls back to the generic renderer for an unknown type", () => {
    expect(getSearchTypeRenderer("user").labelKey).toBe("types.unknown");
    expect(getSearchTypeRenderer("forum_topic").labelKey).toBe("types.unknown");
  });

  it("exposes the known type keys for filters", () => {
    expect(searchTypeKeys).toContain("blog_post");
    expect(searchTypeKeys).not.toContain("user");
  });
});
