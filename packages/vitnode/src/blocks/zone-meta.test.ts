// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { BlockAllowedSpec } from "./types";
import type { ContentZoneBounds, ResolvedContentZoneBounds } from "./zone-meta";

import {
  CONTENT_BLOCKS_ABSOLUTE_MAX,
  CONTENT_BLOCKS_DEFAULT_MAX,
  CONTENT_ZONE_ID_MAX_LENGTH,
} from "./const";
import { BlockError } from "./errors";
import { isBlockAllowed } from "./registry";
import {
  assertContentZoneBounds,
  assertContentZoneId,
  contentZoneAllowed,
  contentZoneAttributes,
  contentZoneBounds,
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

describe("the bounds a zone is edited under", () => {
  const NONE: ContentZoneBounds = { max: undefined, min: undefined };

  const resolved = (
    declared: ContentZoneBounds | undefined,
    explicit: ContentZoneBounds = NONE,
  ): ResolvedContentZoneBounds =>
    contentZoneBounds({ declared, explicit, id: "main" });

  it("gives a zone outside a page the number a stored zone already holds", () => {
    expect(resolved(undefined).max).toBe(CONTENT_BLOCKS_DEFAULT_MAX);
  });

  it("keeps a tighter max such a zone asks for itself", () => {
    expect(resolved(undefined, { max: 50, min: undefined }).max).toBe(50);
  });

  it("holds a page that declares no max to the same number", () => {
    expect(resolved(NONE).max).toBe(CONTENT_BLOCKS_DEFAULT_MAX);
  });

  it("narrows a call site that asks for more than the page can store", () => {
    expect(resolved(NONE, { max: 500, min: undefined }).max).toBe(
      CONTENT_BLOCKS_DEFAULT_MAX,
    );
  });

  it("takes the call site's max when it is under that ceiling", () => {
    expect(resolved(NONE, { max: 50, min: undefined }).max).toBe(50);
  });

  it("leaves a page that raised its own max alone", () => {
    expect(resolved({ max: 300, min: undefined }).max).toBe(300);
    expect(
      resolved({ max: 300, min: undefined }, { max: 500, min: undefined }).max,
    ).toBe(300);
  });

  it("leaves min unset when neither side names one", () => {
    expect(resolved(undefined).min).toBeUndefined();
    expect(resolved(NONE).min).toBeUndefined();
  });

  it("keeps the looser of the two mins, because a call site may only tighten", () => {
    expect(
      resolved({ max: undefined, min: 2 }, { max: undefined, min: 0 }).min,
    ).toBe(2);
    expect(
      resolved({ max: undefined, min: 2 }, { max: undefined, min: 5 }).min,
    ).toBe(5);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    1.5,
    -5,
    0,
    CONTENT_BLOCKS_ABSOLUTE_MAX + 1,
  ])("refuses a max of %s before any editor state exists", max => {
    expect(() => resolved(undefined, { max, min: undefined })).toThrow(
      BlockError,
    );
    expect(() => resolved(undefined, { max, min: undefined })).toThrow(
      /"main" is mounted with a max of/,
    );
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    1.5,
    -1,
  ])("refuses a min of %s before any editor state exists", min => {
    expect(() => resolved(undefined, { max: undefined, min })).toThrow(
      BlockError,
    );
    expect(() => resolved(undefined, { max: undefined, min })).toThrow(
      /"main" is mounted with a min of/,
    );
  });

  it("accepts the two ends a zone may legitimately name", () => {
    const edges = resolved(undefined, {
      max: CONTENT_BLOCKS_ABSOLUTE_MAX,
      min: 0,
    });

    expect(edges.max).toBe(CONTENT_BLOCKS_ABSOLUTE_MAX);
    expect(edges.min).toBe(0);
  });

  it("refuses a min above the max the zone actually gets", () => {
    expect(() =>
      resolved(undefined, {
        max: undefined,
        min: CONTENT_BLOCKS_DEFAULT_MAX + 1,
      }),
    ).toThrow(
      new RegExp(
        `min ${CONTENT_BLOCKS_DEFAULT_MAX + 1} and max ${CONTENT_BLOCKS_DEFAULT_MAX}`,
      ),
    );
  });

  it("names both sides and the ceiling in that refusal", () => {
    expect(() => resolved(NONE, { max: undefined, min: 250 })).toThrow(
      /page declares no bounds[\s\S]*asks for min 250[\s\S]*field\.blocks\(\)/,
    );
  });

  it("still refuses a min above a max the page itself declared", () => {
    expect(() =>
      resolved({ max: 3, min: 1 }, { max: undefined, min: 5 }),
    ).toThrow(/min 5 and max 3/);
  });
});

describe("assertContentZoneBounds", () => {
  it("passes bounds a zone could actually be edited under", () => {
    expect(() =>
      assertContentZoneBounds("main", { max: 12, min: 2 }),
    ).not.toThrow();
    expect(() =>
      assertContentZoneBounds("main", { max: undefined, min: undefined }),
    ).not.toThrow();
  });

  it("names the zone, the value and the rule it broke", () => {
    expect(() =>
      assertContentZoneBounds("before-profile", {
        max: CONTENT_BLOCKS_ABSOLUTE_MAX + 1,
        min: undefined,
      }),
    ).toThrow(
      new RegExp(
        `"before-profile"[\\s\\S]*whole number between 1 and ${CONTENT_BLOCKS_ABSOLUTE_MAX}`,
      ),
    );
  });
});
