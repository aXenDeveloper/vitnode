import { describe, expect, it } from "vitest";

import { isInstanceOf, nextInstanceId, widgetIdOf } from "./instance-id";

describe("widgetIdOf", () => {
  it("passes a plain widget id through", () => {
    expect(widgetIdOf("@vitnode/core:notes")).toBe("@vitnode/core:notes");
  });

  it("strips the copy suffix", () => {
    expect(widgetIdOf("@vitnode/core:notes#7")).toBe("@vitnode/core:notes");
  });
});

describe("isInstanceOf", () => {
  it("matches every copy of the same widget", () => {
    expect(isInstanceOf("@vitnode/core:notes", "@vitnode/core:notes")).toBe(
      true,
    );
    expect(isInstanceOf("@vitnode/core:notes#3", "@vitnode/core:notes")).toBe(
      true,
    );
  });

  it("does not match a different widget", () => {
    expect(isInstanceOf("@vitnode/core:notes#3", "@vitnode/core:send")).toBe(
      false,
    );
  });
});

describe("nextInstanceId", () => {
  it("uses the plain id for the first copy", () => {
    expect(nextInstanceId("w", [])).toBe("w");
    expect(nextInstanceId("w", ["other"])).toBe("w");
  });

  it("suffixes the second copy", () => {
    expect(nextInstanceId("w", ["w"])).toBe("w#2");
  });

  it("keeps counting past the copies already placed", () => {
    expect(nextInstanceId("w", ["w", "w#2", "w#3"])).toBe("w#4");
  });

  it("reuses a gap left by a removed copy", () => {
    expect(nextInstanceId("w", ["w", "w#3"])).toBe("w#2");
  });

  it("ignores copies of other widgets", () => {
    expect(nextInstanceId("w", ["v", "v#2", "w"])).toBe("w#2");
  });
});
