// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CONTENT_ZONE_ID_MAX_LENGTH } from "./const";
import {
  assertContentZoneId,
  contentZoneAttributes,
  formatBlockAllowed,
  isContentZoneId,
  parseContentZoneId,
} from "./zone-meta";

describe("a zone id", () => {
  it.each([
    "main",
    "sidebar",
    "before-profile",
    "homepage:hero",
    "settings:before-profile",
    "admin:settings:profile:after",
    "a",
    "h2",
  ])("accepts %s", id => {
    expect(isContentZoneId(id)).toBe(true);
  });

  it.each([
    ["", "is empty"],
    ["Main", "is not lowercase"],
    ["my_zone", "uses an underscore"],
    ["my zone", "has a space"],
    ["main:", "ends in a separator"],
    [":main", "starts with one"],
    ["a::b", "has an empty segment"],
    ["-main", "starts with a hyphen"],
    ["main-", "ends with one"],
    ["a--b", "doubles a hyphen"],
    ["main/hero", "uses a slash"],
  ])("refuses %s, which %s", id => {
    expect(isContentZoneId(id)).toBe(false);
  });

  it("refuses an id longer than a block id may be", () => {
    const long = "a".repeat(CONTENT_ZONE_ID_MAX_LENGTH + 1);

    expect(isContentZoneId("a".repeat(CONTENT_ZONE_ID_MAX_LENGTH))).toBe(true);
    expect(isContentZoneId(long)).toBe(false);
  });

  it("refuses anything that is not a string", () => {
    expect(isContentZoneId(undefined)).toBe(false);
    expect(isContentZoneId(7)).toBe(false);
  });

  it("names the id and the rule when it throws", () => {
    expect(() => {
      assertContentZoneId("Before Profile");
    }).toThrow(/"Before Profile"/);
    expect(() => {
      assertContentZoneId("Before Profile");
    }).toThrow(/lowercase letters, digits and single hyphens/);
  });

  it("returns the id it accepted, so it can be used inline", () => {
    expect(assertContentZoneId("before-profile")).toBe("before-profile");
  });
});

describe("splitting a zone id", () => {
  it("has no scope when there is no separator", () => {
    expect(parseContentZoneId("main")).toStrictEqual({
      name: "main",
      scope: undefined,
    });
  });

  it("splits at the last separator", () => {
    expect(parseContentZoneId("settings:before-profile")).toStrictEqual({
      name: "before-profile",
      scope: "settings",
    });
    expect(parseContentZoneId("admin:settings:profile")).toStrictEqual({
      name: "profile",
      scope: "admin:settings",
    });
  });

  it("is null for an id it would not accept", () => {
    expect(parseContentZoneId("Main")).toBeNull();
  });
});

describe("the allowlist written into the DOM", () => {
  it("is the wildcard itself when everything is allowed", () => {
    expect(formatBlockAllowed("*")).toBe("*");
  });

  it("is a comma-separated list otherwise", () => {
    expect(formatBlockAllowed(["core:*", "blog:latest-posts"])).toBe(
      "core:*,blog:latest-posts",
    );
  });

  it("is empty when nothing is allowed", () => {
    expect(formatBlockAllowed([])).toBe("");
  });
});

describe("zone attributes", () => {
  it("carry the id", () => {
    expect(contentZoneAttributes({ id: "main" })).toStrictEqual({
      "data-vitnode-zone": "main",
    });
  });

  it("carry the allowlist only when there is one", () => {
    expect(
      contentZoneAttributes({ allowedBlocks: ["core:*"], id: "main" }),
    ).toStrictEqual({
      "data-vitnode-zone": "main",
      "data-vitnode-zone-allowed": "core:*",
    });
  });

  it("refuse an id that could never be addressed later", () => {
    expect(() => contentZoneAttributes({ id: "Main" })).toThrow(
      /Content zone id/,
    );
  });
});
