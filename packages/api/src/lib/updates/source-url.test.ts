import { describe, expect, it } from "vitest";

import { updateSourceUrlProblem } from "./source-url";

describe("updateSourceUrlProblem", () => {
  it.each([
    "https://raw.githubusercontent.com/acme/plugins/main/updates.json",
    "https://example.com:8443/updates.json",
  ])("accepts %s", url => {
    expect(updateSourceUrlProblem(url)).toBeNull();
  });

  it.each([
    ["http", "http://example.com/updates.json", /https:\/\//],
    ["a relative path", "/updates.json", /https:\/\//],
    ["a user name", "https://acme@example.com/updates.json", /user name/],
    ["a password", "https://acme:secret@example.com/u.json", /password/],
    ["a query string", "https://example.com/u.json?token=1", /query string/],
    ["a fragment", "https://example.com/u.json#main", /fragment/],
    [
      "a URL over 2048 characters",
      `https://example.com/${"a".repeat(2048)}`,
      /https:\/\//,
    ],
  ])("rejects %s", (_, url, problem) => {
    expect(updateSourceUrlProblem(url)).toMatch(problem);
  });
});
