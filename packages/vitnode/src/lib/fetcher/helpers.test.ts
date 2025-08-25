import { describe, expect, it } from "vitest";

import { buildSearchParams } from "./helpers";

describe("buildSearchParams", () => {
  it("should handle empty query object", () => {
    const params = buildSearchParams({});
    expect(params.toString()).toBe("");
  });

  it("should handle single string values", () => {
    const params = buildSearchParams({ key: "value" });
    expect(params.toString()).toBe("key=value");
  });

  it("should handle multiple string values", () => {
    const params = buildSearchParams({
      key1: "value1",
      key2: "value2",
    });
    expect(params.toString()).toBe("key1=value1&key2=value2");
  });

  it("should handle array values", () => {
    const params = buildSearchParams({
      key: ["value1", "value2"],
    });
    expect(params.toString()).toBe("key=value1&key=value2");
  });

  it("should skip undefined values", () => {
    const params = buildSearchParams({
      key1: "value1",
      key2: undefined as unknown as string,
    });
    expect(params.toString()).toBe("key1=value1");
  });
});
