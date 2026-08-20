// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

interface CacheCall {
  args: unknown[];
  fn: string;
}

const calls = vi.hoisted(() => [] as CacheCall[]);

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => {
  const record =
    (fn: string) =>
    (...args: unknown[]) => {
      calls.push({ args, fn });
    };

  return {
    cacheLife: record("cacheLife"),
    cacheTag: record("cacheTag"),
    revalidatePath: record("revalidatePath"),
    revalidateTag: record("revalidateTag"),
    updateTag: record("updateTag"),
  };
});

const { nextCacheAdapter } = await import("./next");

/**
 * The Next adapter is the only place the mapping onto `next/cache` lives, so
 * this is where the mapping is pinned - one assertion per branch, against the
 * real module rather than against a stub of it.
 */
beforeEach(() => {
  calls.length = 0;
});

describe("expireTags", () => {
  it("uses updateTag for an immediate expiry from a Server Action", () => {
    // The only primitive that gives the user who submitted the mutation
    // read-your-own-writes.
    nextCacheAdapter.expireTags(["a", "b"], {
      context: "server-action",
      mode: "immediate",
    });

    expect(calls).toEqual([
      { args: ["a"], fn: "updateTag" },
      { args: ["b"], fn: "updateTag" },
    ]);
  });

  it("uses revalidateTag with expire 0 from a Route Handler", () => {
    // `updateTag` throws outside a Server Action, so a background revalidation
    // that used it would be a 500 rather than a stale page.
    nextCacheAdapter.expireTags(["a"], {
      context: "route-handler",
      mode: "immediate",
    });

    expect(calls).toEqual([
      { args: ["a", { expire: 0 }], fn: "revalidateTag" },
    ]);
  });

  it.each(["route-handler", "server-action"] as const)(
    "uses the max profile for stale-while-revalidate, from %s",
    context => {
      // SWR works in either context, so the context changes nothing - and the
      // profile is always named, because the bare one-argument form of
      // `revalidateTag` is deprecated and means immediate.
      nextCacheAdapter.expireTags(["a"], {
        context,
        mode: "stale-while-revalidate",
      });

      expect(calls).toEqual([{ args: ["a", "max"], fn: "revalidateTag" }]);
    },
  );

  it("makes one call per tag, in order", () => {
    nextCacheAdapter.expireTags(["one", "two", "three"], {
      context: "server-action",
      mode: "immediate",
    });

    expect(calls.map(call => call.args[0])).toEqual(["one", "two", "three"]);
  });
});

describe("expirePath", () => {
  it("omits the type argument entirely when no scope was named", () => {
    // Next appends the type to the implicit tag, so `revalidatePath("/x")` and
    // `revalidatePath("/x", "page")` target different keys. Passing an explicit
    // `undefined` would be the second call, not the first.
    nextCacheAdapter.expirePath("/x", undefined);

    expect(calls).toEqual([{ args: ["/x"], fn: "revalidatePath" }]);
  });

  it.each(["layout", "page"] as const)("passes the %s scope through", scope => {
    nextCacheAdapter.expirePath("/x", scope);

    expect(calls).toEqual([{ args: ["/x", scope], fn: "revalidatePath" }]);
  });
});

describe("the entry-time verbs", () => {
  it("spreads tags into cacheTag, which is variadic", () => {
    nextCacheAdapter.tagEntry(["one", "two"]);

    expect(calls).toEqual([{ args: ["one", "two"], fn: "cacheTag" }]);
  });

  it("passes a lifetime profile straight to cacheLife", () => {
    nextCacheAdapter.setEntryLife("max");

    expect(calls).toEqual([{ args: ["max"], fn: "cacheLife" }]);
  });
});

describe("the barrel", () => {
  it("installs this adapter as the default", async () => {
    // Importing `@vitnode/core/framework/cache` has to be enough: no call site
    // should have to remember a wiring step to get a working cache.
    const { getCacheAdapter } = await import("./index");

    expect(getCacheAdapter()).toBe(nextCacheAdapter);
    expect(getCacheAdapter().name).toBe("next");
  });

  it("lets an application override it", async () => {
    const { getCacheAdapter, resetCacheAdapter, setCacheAdapter } =
      await import("./index");
    const other = { ...nextCacheAdapter, name: "other" };

    setCacheAdapter(other);
    expect(getCacheAdapter().name).toBe("other");

    // Put it back, so the default is what the rest of this file sees.
    resetCacheAdapter();
    const { setDefaultCacheAdapter } = await import("./runtime");
    setDefaultCacheAdapter(nextCacheAdapter);
    expect(getCacheAdapter().name).toBe("next");
  });
});
