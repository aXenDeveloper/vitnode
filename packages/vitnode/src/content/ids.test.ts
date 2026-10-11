import { describe, expect, it } from "vitest";

import { testBigintEventContentType } from "@/tests/content-fixtures";

import { ContentEngineError } from "./errors";
import {
  compareContentIds,
  CONTENT_BIGINT_MAX,
  CONTENT_SERIAL_MAX,
  contentIdSchema,
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
  it("throws rather than handing back a sentinel", () => {
    expect(() => requireContentId("uuid", 0, "test.tag")).toThrow(
      ContentEngineError,
    );
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
