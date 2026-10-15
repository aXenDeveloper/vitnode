import { describe, expect, it } from "vitest";

import { matchesPluginSearch } from "./plugin-search";

const blog = {
  description: "Posts and Categories",
  id: "@acme/blog",
  title: "Journal",
};

describe("matchesPluginSearch", () => {
  it.each([
    ["an empty search", "", true],
    ["a blank search", "   ", true],
    ["the title, in any case", "JOUR", true],
    ["the id", "acme/bl", true],
    ["the description", "categories", true],
    ["a padded needle", "  journal  ", true],
    ["nothing", "forum", false],
  ])("matches %s", (_, search, expected) => {
    expect(matchesPluginSearch(blog, search)).toBe(expected);
  });

  it("searches a plugin without a description by its title and id", () => {
    const plugin = { ...blog, description: null };

    expect(matchesPluginSearch(plugin, "acme")).toBe(true);
    expect(matchesPluginSearch(plugin, "posts")).toBe(false);
  });
});
