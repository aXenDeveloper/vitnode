// @vitest-environment node
import { describe, expect, it } from "vitest";

import { saveRefusalOf } from "./refusal";

describe("what the editor may put in front of a person", () => {
  it("is the refusal an adapter rejected with", () => {
    const cause = Object.assign(new Error("refused"), {
      refusal: "This zone does not allow that block.",
    });

    expect(saveRefusalOf(cause)).toBe("This zone does not allow that block.");
  });

  it("is nothing for a transport that simply failed", () => {
    expect(saveRefusalOf(new Error("fetch failed"))).toBeUndefined();
    expect(saveRefusalOf("fetch failed")).toBeUndefined();
    expect(saveRefusalOf(null)).toBeUndefined();
    expect(saveRefusalOf(undefined)).toBeUndefined();
  });

  it("is nothing for a refusal with nothing to say, so the generic copy stands", () => {
    expect(saveRefusalOf({ refusal: "   " })).toBeUndefined();
    expect(saveRefusalOf({ refusal: 7 })).toBeUndefined();
  });
});
