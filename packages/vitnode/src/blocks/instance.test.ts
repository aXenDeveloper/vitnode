// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createBlockInstance,
  createBlockInstanceId,
  isBlockInstance,
  isBlockInstanceId,
} from "./instance";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createBlockInstanceId", () => {
  it("is 26 characters of Crockford base32", () => {
    expect(createBlockInstanceId()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("never repeats across a run", () => {
    const ids = new Set(
      Array.from({ length: 2000 }, () => createBlockInstanceId()),
    );

    expect(ids.size).toBe(2000);
  });

  it("sorts by creation time", () => {
    const earlier = createBlockInstanceId(1_700_000_000_000);
    const later = createBlockInstanceId(1_700_000_001_000);

    expect([later, earlier].sort()).toStrictEqual([earlier, later]);
  });

  it("orders by millisecond, and says nothing about ids made in the same one", () => {
    const at = 1_700_000_000_000;
    const same = Array.from({ length: 50 }, () => createBlockInstanceId(at));

    expect(new Set(same.map(id => id.slice(0, 10))).size).toBe(1);
    expect(new Set(same).size).toBe(50);
  });

  it("draws its randomness from the runtime's CSPRNG", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(0);

      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(createBlockInstanceId()).toMatch(/0{16}$/);
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("refuses to invent an identity when the runtime has no CSPRNG", () => {
    vi.stubGlobal("crypto", undefined);

    expect(() => createBlockInstanceId()).toThrow(/getRandomValues/);
  });

  it("spreads over the whole alphabet rather than a corner of it", () => {
    const seen = new Set(
      Array.from({ length: 500 }, () => createBlockInstanceId()).flatMap(id => [
        ...id.slice(10),
      ]),
    );

    expect(seen.size).toBe(32);
  });
});

describe("createBlockInstance", () => {
  it("gives every instance its own id", () => {
    const one = createBlockInstance("core:hero", { title: "A" });
    const two = createBlockInstance("core:hero", { title: "A" });

    expect(one.id).not.toBe(two.id);
    expect(one.type).toBe("core:hero");
    expect(one.data).toStrictEqual({ title: "A" });
  });
});

describe("isBlockInstanceId", () => {
  it("accepts an identity a reusable block or an import brought with it", () => {
    expect(isBlockInstanceId("legacy_hero-1")).toBe(true);
  });

  it("refuses an id that could not survive a URL", () => {
    expect(isBlockInstanceId("hero/1")).toBe(false);
    expect(isBlockInstanceId("")).toBe(false);
    expect(isBlockInstanceId(7)).toBe(false);
  });
});

describe("isBlockInstance", () => {
  it("accepts a stored instance", () => {
    expect(isBlockInstance({ data: {}, id: "abc", type: "core:hero" })).toBe(
      true,
    );
  });

  it("refuses anything without a stable id", () => {
    expect(isBlockInstance({ data: {}, type: "core:hero" })).toBe(false);
    expect(isBlockInstance([{ type: "core:hero" }])).toBe(false);
    expect(isBlockInstance(null)).toBe(false);
  });
});
