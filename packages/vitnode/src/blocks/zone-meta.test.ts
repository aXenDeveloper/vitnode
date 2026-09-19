// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { BlockAllowedSpec } from "./types";

import { CONTENT_ZONE_ID_MAX_LENGTH } from "./const";
import { isBlockAllowed } from "./registry";
import {
  assertContentZoneId,
  contentZoneAllowed,
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

describe("the allowlist a page-backed zone is edited under", () => {
  const effective = (
    declared: BlockAllowedSpec | undefined,
    explicit: BlockAllowedSpec | undefined,
  ): BlockAllowedSpec | undefined =>
    contentZoneAllowed({ declared, explicit, id: "main" });

  it("keeps the page's list when the call site asks for everything", () => {
    expect(effective(["core:text"], "*")).toStrictEqual(["core:text"]);
  });

  it("takes the call site's list when the page allows everything", () => {
    expect(effective("*", ["core:text"])).toStrictEqual(["core:text"]);
    expect(effective("*", ["core:*"])).toStrictEqual(["core:*"]);
  });

  it("keeps only what a namespace the page opened actually covers", () => {
    expect(
      effective(["core:*"], ["core:text", "example:callout"]),
    ).toStrictEqual(["core:text"]);
  });

  it("resolves a call site's namespace wildcard down to the named blocks", () => {
    expect(effective(["core:text"], ["core:*"])).toStrictEqual(["core:text"]);
  });

  it("drops the page entries the call site did not ask for", () => {
    expect(
      effective(["core:text", "example:callout"], ["core:text"]),
    ).toStrictEqual(["core:text"]);
  });

  it("names each block once, however many page entries cover it", () => {
    expect(effective(["core:*", "core:text"], ["core:text"])).toStrictEqual([
      "core:text",
    ]);
  });

  it("refuses a call site that contradicts the page outright", () => {
    expect(() => effective(["core:text"], ["example:callout"])).toThrow(
      /no allowed blocks at all/,
    );
  });

  it("names both sides in that refusal, so the mismatch is readable", () => {
    expect(() => effective(["core:text"], ["example:callout"])).toThrow(
      /page allows core:text[\s\S]*asks for example:callout/,
    );
  });

  it("leaves a zone the page never declared with its own list", () => {
    expect(effective(undefined, "*")).toBe("*");
    expect(effective(undefined, ["example:callout"])).toStrictEqual([
      "example:callout",
    ]);
    expect(effective(undefined, undefined)).toBeUndefined();
  });

  it("falls back to the page's list when the call site passes none", () => {
    const declared: BlockAllowedSpec = ["core:text"];

    expect(effective(declared, undefined)).toBe(declared);
  });

  it("hands back the page's own list rather than a copy, so a mount is stable", () => {
    const declared: BlockAllowedSpec = ["core:text"];

    expect(effective(declared, "*")).toBe(declared);
  });
});

describe("what the editor allows against what the page allows", () => {
  const TYPES = [
    "core:text",
    "core:hero",
    "core:cta",
    "example:callout",
    "example:text",
  ];

  const PAIRS: [BlockAllowedSpec, BlockAllowedSpec][] = [
    [["core:text"], "*"],
    ["*", ["core:text"]],
    ["*", ["core:*"]],
    [["core:*"], ["core:text", "example:callout"]],
    [["core:text"], ["core:*"]],
    [["core:text", "example:callout"], ["core:text"]],
    [
      ["core:*", "example:*"],
      ["core:text", "example:*"],
    ],
    ["*", "*"],
    [["core:*"], ["core:*"]],
  ];

  it.each(PAIRS)(
    "allows exactly the blocks both %s and %s allow",
    (declared, explicit) => {
      const allowed = contentZoneAllowed({ declared, explicit, id: "main" });

      if (allowed === undefined) throw new Error("no allowlist was computed");

      for (const type of TYPES) {
        expect(isBlockAllowed(allowed, type)).toBe(
          isBlockAllowed(declared, type) && isBlockAllowed(explicit, type),
        );
      }
    },
  );

  it.each(PAIRS)(
    "never allows a block %s does not, whatever %s asks for",
    (declared, explicit) => {
      const allowed = contentZoneAllowed({ declared, explicit, id: "main" });

      if (allowed === undefined) throw new Error("no allowlist was computed");

      const widened = TYPES.filter(
        type =>
          isBlockAllowed(allowed, type) && !isBlockAllowed(declared, type),
      );

      expect(widened).toStrictEqual([]);
    },
  );
});
