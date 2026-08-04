// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { SearchIndexerConfig } from "@/api/models/search";

import { searchStatusDebugAdminRoute } from "./search-status.route";

interface IndexedRow {
  indexed: number;
  itemType: string;
  lastIndexedAt: Date | null;
  pluginId: null | string;
}

interface Collection {
  indexed: number;
  itemType: string;
  pluginId: string;
  total: number;
}

const indexer = (
  itemType: string,
  pluginId: string,
  total?: number,
): SearchIndexerConfig => ({
  itemType,
  ...(total === undefined
    ? {}
    : { count: async () => await Promise.resolve(total) }),
  load: async () => await Promise.resolve({ documents: [], itemsRead: 0 }),
  pluginId,
});

/**
 * The handler is called directly, the way the queue-task tests call theirs: it
 * takes no request input, so routing it through Hono would only add a cast -
 * `Route.handler` is deliberately erased to `(...args: unknown[])`.
 *
 * The stub answers the coverage query with the given rows and every later query
 * (the sync-error panel) with nothing.
 */
const harness = ({
  indexers = [],
  rows = [],
}: {
  indexers?: SearchIndexerConfig[];
  rows?: IndexedRow[];
} = {}) => {
  const results: unknown[][] = [rows, []];
  let call = 0;

  const chain = (value: unknown[]) => {
    const builder: Record<string, unknown> = {};
    for (const op of ["from", "groupBy", "where", "orderBy", "limit"]) {
      builder[op] = () => builder;
    }
    builder.then = async <TResult>(resolve: (rows: unknown[]) => TResult) =>
      await Promise.resolve(value).then(resolve);

    return builder;
  };

  const db = {
    select: () => {
      const value = results[call] ?? [];
      call++;

      return chain(value);
    },
  };

  let body: undefined | { collections: Collection[] };

  const c = {
    get: (key: string) => {
      if (key === "db") return db;
      if (key === "search") {
        return {
          name: () => "postgres",
          ping: async () => await Promise.resolve(true),
        };
      }
      if (key === "core") {
        return { hasCronAdapter: true, searchIndexers: indexers };
      }

      return undefined;
    },
    json: (value: { collections: Collection[] }) => {
      body = value;

      return new Response();
    },
  };

  return {
    collections: async (): Promise<Collection[]> => {
      await searchStatusDebugAdminRoute.handler(c);

      if (!body) throw new Error("The handler returned no body.");

      return body.collections;
    },
  };
};

const indexedRow = (
  itemType: string,
  pluginId: null | string,
  indexed: number,
): IndexedRow => ({ indexed, itemType, lastIndexedAt: null, pluginId });

describe("search status collection ownership", () => {
  it("uses the registered indexer's plugin", async () => {
    const { collections } = harness({
      indexers: [indexer("example.article", "@vitnode/example", 3)],
      rows: [indexedRow("example.article", "@vitnode/example", 3)],
    });

    await expect(collections()).resolves.toEqual([
      expect.objectContaining({
        indexed: 3,
        itemType: "example.article",
        pluginId: "@vitnode/example",
        total: 3,
      }),
    ]);
  });

  it("falls back to the stored owner for an orphaned collection", async () => {
    // The indexer is gone - uninstalled, renamed, not yet loaded - but the rows
    // still say who wrote them. Reassigning them to core would be a lie.
    const { collections } = harness({
      rows: [indexedRow("example.article", "@vitnode/example", 3)],
    });

    const [collection] = await collections();

    expect(collection.pluginId).toBe("@vitnode/example");
  });

  it("reports `unknown` when neither source names an owner", async () => {
    const { collections } = harness({
      rows: [indexedRow("mystery.item", null, 2)],
    });

    const [collection] = await collections();

    expect(collection.pluginId).toBe("unknown");
  });

  it("treats a blank stored owner as unknown", async () => {
    const { collections } = harness({
      rows: [indexedRow("mystery.item", "   ", 2)],
    });

    const [collection] = await collections();

    expect(collection.pluginId).toBe("unknown");
  });

  it("keeps the registered owner when the stored one disagrees", async () => {
    // The next rebuild rewrites the rows, so the live indexer is canonical.
    const { collections } = harness({
      indexers: [indexer("example.article", "@vitnode/example", 3)],
      rows: [indexedRow("example.article", "@vitnode/old-example", 3)],
    });

    const [collection] = await collections();

    expect(collection.pluginId).toBe("@vitnode/example");
  });

  it("keeps an orphaned over-indexed collection truthful", async () => {
    // No indexer, so no source count: `total` falls back to the indexed count
    // and the collection reads as covered - but it must still not be called core.
    const { collections } = harness({
      rows: [indexedRow("example.article", "@vitnode/example", 11)],
    });

    await expect(collections()).resolves.toEqual([
      expect.objectContaining({
        indexed: 11,
        pluginId: "@vitnode/example",
        total: 11,
      }),
    ]);
  });

  it("reports the real counts of an over-indexed registered collection", async () => {
    const { collections } = harness({
      indexers: [indexer("example.article", "@vitnode/example", 9)],
      rows: [indexedRow("example.article", "@vitnode/example", 11)],
    });

    const [collection] = await collections();

    // Neither number is rewritten to hide the extra documents, so the AdminCP
    // still reads this as stale.
    expect(collection).toMatchObject({
      indexed: 11,
      pluginId: "@vitnode/example",
      total: 9,
    });
  });

  it("lists a registered collection with nothing indexed yet", async () => {
    const { collections } = harness({
      indexers: [indexer("example.article", "@vitnode/example", 5)],
    });

    await expect(collections()).resolves.toEqual([
      expect.objectContaining({
        indexed: 0,
        pluginId: "@vitnode/example",
        total: 5,
      }),
    ]);
  });
});
