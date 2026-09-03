// @vitest-environment node
import { HTTPException } from "hono/http-exception";
import { describe, expect, it, vi } from "vitest";

import type { SearchIndexerConfig } from "@/api/models/search";

import { clearSearchDebugAdminRoute } from "./clear-search.route";
import { rebuildSearchDebugAdminRoute } from "./rebuild-search.route";

const indexer = (itemType: string): SearchIndexerConfig => ({
  itemType,
  load: async () => await Promise.resolve({ documents: [], itemsRead: 0 }),
  pluginId: "@vitnode/example",
});

interface Dispatched {
  name: string;
  payload?: Record<string, unknown>;
}

const harness = ({
  body,
  clearFails = false,
  indexers = [],
  logFails = false,
}: {
  body?: Record<string, unknown>;
  clearFails?: boolean;
  indexers?: SearchIndexerConfig[];
  logFails?: boolean;
} = {}) => {
  const dispatched: Dispatched[] = [];
  const cleared: (string | undefined)[] = [];
  const warnings: string[] = [];

  const clear = vi.fn(async (itemType?: string) => {
    if (clearFails) throw new Error("engine unavailable");
    cleared.push(itemType);
    await Promise.resolve();
  });

  const c = {
    get: (key: string) => {
      if (key === "core") return { searchIndexers: indexers };
      if (key === "queue") {
        return {
          dispatch: async (task: Dispatched) => {
            dispatched.push(task);
            await Promise.resolve();
          },
        };
      }
      if (key === "search") {
        return {
          clear: clear as unknown,
        };
      }
      if (key === "log") {
        return {
          warn: async (content: string) => {
            warnings.push(content);
            await Promise.resolve();
            if (logFails) throw new Error("core_logs unavailable");
          },
        };
      }

      return undefined;
    },
    json: (value: unknown) => new Response(JSON.stringify(value)),
    req: { valid: () => body },
  };

  return { c, clear, cleared, dispatched, warnings };
};

const statusOf = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    if (error instanceof HTTPException) return error.status;
    throw error;
  }

  return 200;
};

describe("POST /search/rebuild", () => {
  it("queues a scoped rebuild for a registered collection", async () => {
    const { c, dispatched } = harness({
      body: { itemType: "example.article" },
      indexers: [indexer("example.article")],
    });

    await rebuildSearchDebugAdminRoute.handler(c);

    expect(dispatched).toEqual([
      {
        name: "rebuild-search-index",
        payload: { itemType: "example.article" },
      },
    ]);
  });

  it("rejects a scoped rebuild for a collection with no indexer", async () => {
    // Queuing this would clear the collection and refill nothing, so the button
    // that offers it must fail before anything is dispatched.
    const { c, dispatched } = harness({
      body: { itemType: "removed.collection" },
      indexers: [indexer("example.article")],
    });

    await expect(
      statusOf(async () => await rebuildSearchDebugAdminRoute.handler(c)),
    ).resolves.toBe(404);
    expect(dispatched).toEqual([]);
  });

  it("queues a full rebuild with no item type", async () => {
    const { c, dispatched } = harness({
      indexers: [indexer("example.article")],
    });

    await rebuildSearchDebugAdminRoute.handler(c);

    expect(dispatched).toEqual([{ name: "rebuild-search-index", payload: {} }]);
  });

  it("queues a full rebuild even with no indexers at all", async () => {
    // The guard is about *scoped* rebuilds; a full one is allowed to clear an
    // index it cannot fully refill, which is how documents with no indexer get
    // removed.
    const { c, dispatched } = harness({ body: {} });

    await rebuildSearchDebugAdminRoute.handler(c);

    expect(dispatched).toHaveLength(1);
  });
});

describe("POST /search/clear", () => {
  it("clears only the requested collection", async () => {
    const { c, cleared, warnings } = harness({
      body: { itemType: "removed.collection" },
      indexers: [indexer("example.article")],
    });

    await clearSearchDebugAdminRoute.handler(c);

    expect(cleared).toEqual(["removed.collection"]);
    expect(warnings[0]).toContain("removed.collection");
  });

  it("refuses a collection that still has an indexer", async () => {
    // That one has a rebuild, which gets the same freshness without deleting.
    const { c, cleared } = harness({
      body: { itemType: "example.article" },
      indexers: [indexer("example.article")],
    });

    await expect(
      statusOf(async () => await clearSearchDebugAdminRoute.handler(c)),
    ).resolves.toBe(409);
    expect(cleared).toEqual([]);
  });

  it("never clears the whole index", async () => {
    // `itemType` is required and non-empty in the schema, so there is no payload
    // that reaches `clear(undefined)` through this route.
    const { c, cleared } = harness({
      body: { itemType: "removed.collection" },
    });

    await clearSearchDebugAdminRoute.handler(c);

    expect(cleared).not.toContain(undefined);
  });

  it("writes a neutral audit warning", async () => {
    const { c, warnings } = harness({
      body: { itemType: "live.only" },
    });

    await clearSearchDebugAdminRoute.handler(c);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("unmanaged collection");
    expect(warnings[0]).toContain("live.only");
    // Nothing claims the plugin is gone: registering an indexer is optional.
    expect(warnings[0]).not.toContain("orphan");
  });

  it("stays successful when the audit log fails", async () => {
    // The documents are already gone. Reporting a failure would send an
    // administrator looking for documents that are not there.
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    try {
      const { c, clear, cleared, warnings } = harness({
        body: { itemType: "live.only" },
        logFails: true,
      });

      const res = await clearSearchDebugAdminRoute.handler(c);

      await expect(new Response(res.body).json()).resolves.toEqual({
        cleared: true,
      });
      expect(cleared).toEqual(["live.only"]);
      // Attempted once, and not retried because the log failed.
      expect(clear).toHaveBeenCalledTimes(1);
      expect(warnings).toHaveLength(1);
      expect(consoleWarn).toHaveBeenCalledTimes(1);
      expect(String(consoleWarn.mock.calls[0][0])).toContain(
        "Failed to persist search cleanup audit",
      );
    } finally {
      consoleWarn.mockRestore();
    }
  });

  it("does not reach the console when the audit log succeeds", async () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    try {
      const { c } = harness({ body: { itemType: "live.only" } });

      await clearSearchDebugAdminRoute.handler(c);

      expect(consoleWarn).not.toHaveBeenCalled();
    } finally {
      consoleWarn.mockRestore();
    }
  });

  it("propagates a failed clear and writes no success audit", async () => {
    const { c, warnings } = harness({
      body: { itemType: "live.only" },
      clearFails: true,
    });

    await expect(clearSearchDebugAdminRoute.handler(c)).rejects.toThrow(
      "engine unavailable",
    );
    expect(warnings).toEqual([]);
  });

  it("rejects an empty item type at the schema", () => {
    expect(
      zodBody(clearSearchDebugAdminRoute).safeParse({ itemType: "" }).success,
    ).toBe(false);
    expect(zodBody(clearSearchDebugAdminRoute).safeParse({}).success).toBe(
      false,
    );
    expect(
      zodBody(clearSearchDebugAdminRoute).safeParse({ itemType: "a.b" })
        .success,
    ).toBe(true);
  });
});

/** Reaches the body schema the route declared, so the test asserts on the real one. */
function zodBody(route: typeof clearSearchDebugAdminRoute) {
  const body = route.route.request?.body;
  if (!body || !("content" in body)) throw new Error("No body schema.");

  return body.content["application/json"].schema as {
    safeParse: (value: unknown) => { success: boolean };
  };
}
