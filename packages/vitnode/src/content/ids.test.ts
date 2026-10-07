import { describe, expect, it } from "vitest";

import {
  testArticleContentType,
  testBigintEventContentType,
  testUuidTagContentType,
} from "@/tests/content-fixtures";

import { ContentEngineError } from "./errors";
import {
  compareContentIds,
  CONTENT_BIGINT_MAX,
  CONTENT_SERIAL_MAX,
  contentIdFromKey,
  contentIdKey,
  contentIdParamSchema,
  contentIdSchema,
  contentIdsOf,
  contentRelationStrategy,
  isContentId,
  parseContentId,
  requireContentId,
} from "./ids";

const UUID = "0198f6f7-d4a2-7ce1-a2ee-4f5f1f2f3a4b";
const BEYOND_SAFE = "9007199254740993";

describe("parseContentId", () => {
  describe("serial", () => {
    it("reads a positive integer as a number, from a number or its digits", () => {
      expect(parseContentId("serial", 42)).toBe(42);
      expect(parseContentId("serial", "42")).toBe(42);
      expect(parseContentId("serial", CONTENT_SERIAL_MAX)).toBe(
        CONTENT_SERIAL_MAX,
      );
    });

    it.each([0, -1, 1.5, CONTENT_SERIAL_MAX + 1, "007", "1e3", " 1", "", null])(
      "refuses %o",
      value => {
        expect(parseContentId("serial", value)).toBeNull();
      },
    );
  });

  describe("bigint", () => {
    it("keeps a value beyond Number.MAX_SAFE_INTEGER as its exact digits", () => {
      expect(parseContentId("bigint", BEYOND_SAFE)).toBe(BEYOND_SAFE);
      expect(parseContentId("bigint", CONTENT_BIGINT_MAX)).toBe(
        CONTENT_BIGINT_MAX,
      );
      expect(parseContentId("bigint", 9_007_199_254_740_993n)).toBe(
        BEYOND_SAFE,
      );
    });

    it("accepts a safe JavaScript number, and refuses one that was already rounded", () => {
      expect(parseContentId("bigint", 42)).toBe("42");
      expect(parseContentId("bigint", 2 ** 53)).toBeNull();
    });

    it.each(["9223372036854775808", "0", "-1", "01", "1.5", "abc", ""])(
      "refuses %o",
      value => {
        expect(parseContentId("bigint", value)).toBeNull();
      },
    );
  });

  describe("uuid", () => {
    it("accepts the canonical lowercase spelling only", () => {
      expect(parseContentId("uuid", UUID)).toBe(UUID);
      expect(parseContentId("uuid", UUID.toUpperCase())).toBeNull();
      expect(parseContentId("uuid", `{${UUID}}`)).toBeNull();
      expect(parseContentId("uuid", UUID.replaceAll("-", ""))).toBeNull();
      expect(parseContentId("uuid", 42)).toBeNull();
    });
  });
});

describe("storage keys", () => {
  it("keep a serial record's key exactly the digits it always had", () => {
    expect(contentIdKey(42)).toBe("42");
    expect(contentIdFromKey("serial", "42")).toBe(42);
  });

  it("round-trip every strategy through its key", () => {
    expect(contentIdFromKey("bigint", contentIdKey(BEYOND_SAFE))).toBe(
      BEYOND_SAFE,
    );
    expect(contentIdFromKey("uuid", contentIdKey(UUID))).toBe(UUID);
  });

  it("read nothing out of a key the strategy cannot hold", () => {
    expect(contentIdFromKey("serial", UUID)).toBeNull();
    expect(contentIdFromKey("uuid", "42")).toBeNull();
  });
});

describe("isContentId", () => {
  it("is true only for the strategy's own representation", () => {
    expect(isContentId("serial", 7)).toBe(true);
    expect(isContentId("serial", "7")).toBe(false);
    expect(isContentId("bigint", "7")).toBe(true);
    expect(isContentId("bigint", 7)).toBe(false);
    expect(isContentId("uuid", UUID)).toBe(true);
  });
});

describe("requireContentId", () => {
  it("returns the canonical id", () => {
    expect(requireContentId("bigint", BEYOND_SAFE)).toBe(BEYOND_SAFE);
  });

  it("throws rather than handing back a sentinel", () => {
    expect(() => requireContentId("uuid", 0, "test.tag")).toThrow(
      ContentEngineError,
    );
  });
});

describe("contentIdsOf", () => {
  it("keeps the readable ids, canonicalised, in order", () => {
    expect(contentIdsOf("serial", [3, "1", "x", 2.5])).toEqual([3, 1]);
    expect(contentIdsOf("uuid", [UUID, "nope"])).toEqual([UUID]);
  });
});

describe("compareContentIds", () => {
  it("orders bigints numerically without losing precision", () => {
    expect(compareContentIds("bigint", "10", "9")).toBeGreaterThan(0);
    expect(compareContentIds("bigint", BEYOND_SAFE, "9007199254740992")).toBe(
      1,
    );
  });

  it("orders uuids lexically and serials numerically", () => {
    expect(compareContentIds("uuid", "a", "b")).toBe(-1);
    expect(compareContentIds("serial", 10, 9)).toBeGreaterThan(0);
  });
});

describe("schemas", () => {
  it("validate a JSON id per strategy", () => {
    expect(contentIdSchema("serial").safeParse(7).success).toBe(true);
    expect(contentIdSchema("serial").safeParse("7").success).toBe(false);
    expect(contentIdSchema("bigint").safeParse(BEYOND_SAFE).success).toBe(true);
    expect(contentIdSchema("bigint").safeParse(7).success).toBe(false);
    expect(contentIdSchema("uuid").safeParse(UUID.toUpperCase()).success).toBe(
      false,
    );
  });

  it("parse a path or query value into the strategy's representation", () => {
    expect(contentIdParamSchema("serial").parse("7")).toBe(7);
    expect(contentIdParamSchema("bigint").parse(BEYOND_SAFE)).toBe(BEYOND_SAFE);
    expect(contentIdParamSchema("uuid").safeParse("7").success).toBe(false);
  });

  it("keep a serial content type's `{id}` the coerced number it always was", () => {
    expect(testArticleContentType.schemas.params.parse({ id: "7" })).toEqual({
      id: 7,
    });
  });

  it("refuse a non-canonical `{id}` on a uuid or bigint content type", () => {
    const { params: tagParams } = testUuidTagContentType.schemas;
    const { params: eventParams } = testBigintEventContentType.schemas;

    expect(tagParams.safeParse({ id: UUID }).success).toBe(true);
    expect(tagParams.safeParse({ id: UUID.toUpperCase() }).success).toBe(false);
    expect(eventParams.parse({ id: BEYOND_SAFE })).toEqual({ id: BEYOND_SAFE });
    expect(eventParams.safeParse({ id: "01" }).success).toBe(false);
  });

  it("type relation values by the target's strategy, a self-relation by the owner's", () => {
    const { create } = testBigintEventContentType.schemas;

    expect(
      create.safeParse({
        primaryTag: UUID,
        relatedEvents: [BEYOND_SAFE],
        tags: [UUID],
        title: "Valid",
      }).success,
    ).toBe(true);
    expect(create.safeParse({ primaryTag: 7, title: "x" }).success).toBe(false);
    expect(create.safeParse({ relatedEvents: [7], title: "x" }).success).toBe(
      false,
    );
    expect(create.safeParse({ category: 7, title: "x" }).success).toBe(true);
  });
});

describe("contentRelationStrategy", () => {
  it("is the target's strategy, or the owner's for a self-relation", () => {
    const { fields } = testBigintEventContentType;

    expect(
      contentRelationStrategy(testBigintEventContentType, fields.primaryTag),
    ).toBe("uuid");
    expect(
      contentRelationStrategy(testBigintEventContentType, fields.category),
    ).toBe("serial");
    expect(
      contentRelationStrategy(testBigintEventContentType, fields.relatedEvents),
    ).toBe("bigint");
  });
});
