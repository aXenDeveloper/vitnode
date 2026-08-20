// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import type { CacheAdapter, CacheExpiryOptions, CachePathScope } from "./types";

import {
  expireCachePath,
  expireCacheTags,
  getCacheAdapter,
  hasCacheAdapter,
  resetCacheAdapter,
  setCacheAdapter,
  setCacheEntryLife,
  setDefaultCacheAdapter,
  tagCacheEntry,
} from "./runtime";

/**
 * The framework-free half, tested with no framework at all.
 *
 * This file imports `./runtime` rather than the barrel on purpose: the barrel
 * installs the Next adapter, and what is under test here is precisely the
 * behaviour that has to hold *without* one - which defaults are resolved, which
 * calls are refused, and which slot wins.
 */
interface Recorded {
  args: unknown[];
  fn: string;
}

const recorder = (name: string) => {
  const calls: Recorded[] = [];
  const push =
    (fn: string) =>
    (...args: unknown[]) => {
      calls.push({ args, fn });
    };

  const adapter: CacheAdapter = {
    expirePath: push("expirePath"),
    expireTags: push("expireTags"),
    name,
    setEntryLife: push("setEntryLife"),
    tagEntry: push("tagEntry"),
  };

  return { adapter, calls };
};

beforeEach(() => {
  resetCacheAdapter();
});

describe("the registry", () => {
  it("has nothing installed until something installs it", () => {
    expect(hasCacheAdapter()).toBe(false);
  });

  it("throws a message naming the fix rather than doing nothing", () => {
    // The whole reason this throws: a no-op adapter leaves a withdrawn page
    // readable with no error anywhere to trace it back from.
    expect(() => getCacheAdapter()).toThrow(/@vitnode\/core\/framework\/cache/);
    expect(() => getCacheAdapter()).toThrow(/setCacheAdapter/);
  });

  it("uses the default when nothing was installed explicitly", () => {
    const { adapter } = recorder("default");
    setDefaultCacheAdapter(adapter);

    expect(hasCacheAdapter()).toBe(true);
    expect(getCacheAdapter().name).toBe("default");
  });

  it.each([
    ["default first", true],
    ["explicit first", false],
  ])("lets the explicit adapter win, %s", (_label, defaultFirst) => {
    // Order-independence is the whole reason for two slots: the barrel installs
    // its default on import, and an application cannot control whether its own
    // `setCacheAdapter` call runs before or after that import is evaluated.
    const { adapter: fallback } = recorder("default");
    const { adapter: installed } = recorder("explicit");

    if (defaultFirst) {
      setDefaultCacheAdapter(fallback);
      setCacheAdapter(installed);
    } else {
      setCacheAdapter(installed);
      setDefaultCacheAdapter(fallback);
    }

    expect(getCacheAdapter().name).toBe("explicit");
  });

  it("empties both slots on reset", () => {
    const { adapter } = recorder("a");
    setCacheAdapter(adapter);
    setDefaultCacheAdapter(adapter);
    resetCacheAdapter();

    expect(hasCacheAdapter()).toBe(false);
  });
});

describe("expireCacheTags", () => {
  const optionsOf = (calls: Recorded[]): CacheExpiryOptions =>
    calls[0].args[1] as CacheExpiryOptions;

  it("defaults to immediate, from a server action", () => {
    // Both defaults protect the mutation that *removed* something, which is the
    // one where being wrong is a correctness bug rather than a slow page.
    const { adapter, calls } = recorder("a");
    setCacheAdapter(adapter);

    expireCacheTags(["one"]);

    expect(calls).toHaveLength(1);
    expect(optionsOf(calls)).toEqual({
      context: "server-action",
      mode: "immediate",
    });
  });

  it("passes an explicit mode and context through untouched", () => {
    const { adapter, calls } = recorder("a");
    setCacheAdapter(adapter);

    expireCacheTags(["one"], {
      context: "route-handler",
      mode: "stale-while-revalidate",
    });

    expect(optionsOf(calls)).toEqual({
      context: "route-handler",
      mode: "stale-while-revalidate",
    });
  });

  it("fills in only the option that was left out", () => {
    const { adapter, calls } = recorder("a");
    setCacheAdapter(adapter);

    expireCacheTags(["one"], { context: "route-handler" });

    expect(optionsOf(calls)).toEqual({
      context: "route-handler",
      mode: "immediate",
    });
  });

  it("accepts a single tag as a bare string", () => {
    const { adapter, calls } = recorder("a");
    setCacheAdapter(adapter);

    expireCacheTags("only-one");

    expect(calls[0].args[0]).toEqual(["only-one"]);
  });

  it("hands the adapter the list as given, in order", () => {
    const { adapter, calls } = recorder("a");
    setCacheAdapter(adapter);

    expireCacheTags(["b", "a", "b"]);

    // No sorting and no de-duplication: the tag list is the caller's, and an
    // adapter that wants to collapse it can.
    expect(calls[0].args[0]).toEqual(["b", "a", "b"]);
  });

  it("does nothing at all for an empty list", () => {
    const { adapter, calls } = recorder("a");
    setCacheAdapter(adapter);

    expireCacheTags([]);

    expect(calls).toEqual([]);
  });

  it("does not even need an adapter for an empty list", () => {
    // `contentInvalidationTags` legitimately returns nothing for a mutation on a
    // record that was private before and after. That call must not be the thing
    // that discovers the wiring is missing.
    expect(() => expireCacheTags([])).not.toThrow();
  });
});

describe("expireCachePath", () => {
  it.each<CachePathScope | undefined>(["layout", "page", undefined])(
    "forwards the scope %s exactly as given",
    scope => {
      // `undefined` is a third answer rather than a synonym for `page`: Next
      // keys a scoped expiry differently from a bare one, so defaulting here
      // would retarget every unscoped caller.
      const { adapter, calls } = recorder("a");
      setCacheAdapter(adapter);

      expireCachePath("/[locale]/admin", scope);

      expect(calls[0]).toEqual({
        args: ["/[locale]/admin", scope],
        fn: "expirePath",
      });
    },
  );

  it("passes undefined when the scope is omitted entirely", () => {
    const { adapter, calls } = recorder("a");
    setCacheAdapter(adapter);

    expireCachePath("/");

    expect(calls[0].args).toEqual(["/", undefined]);
  });
});

describe("the entry-time helpers", () => {
  it("collects variadic tags into one call", () => {
    const { adapter, calls } = recorder("a");
    setCacheAdapter(adapter);

    tagCacheEntry("one", "two");

    expect(calls[0]).toEqual({ args: [["one", "two"]], fn: "tagEntry" });
  });

  it("does nothing when tagging with no tags", () => {
    const { adapter, calls } = recorder("a");
    setCacheAdapter(adapter);

    tagCacheEntry();

    expect(calls).toEqual([]);
  });

  it("forwards a lifetime profile by name", () => {
    const { adapter, calls } = recorder("a");
    setCacheAdapter(adapter);

    setCacheEntryLife("minutes");

    expect(calls[0]).toEqual({ args: ["minutes"], fn: "setEntryLife" });
  });
});
