// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import { testEditorialPostContentType } from "@/tests/content-fixtures";

import {
  CONTENT_REVISIONS_MAX_PAGE_SIZE,
  createContentRevisionsModel,
} from "./revisions-model";

const PLUGIN_ID = "@vitnode/example";

/** One history row, only as detailed as the pagination needs. */
const revision = (version: number) => ({
  actorName: null,
  actorType: "staff" as const,
  actorUserId: 1,
  changedFields: [],
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  id: 1000 + version,
  operation: "update" as const,
  restoredFromRevisionId: null,
  version,
});

/**
 * A chainable Drizzle stand-in that records the requested limit and hands back
 * as many rows as the fake table has, newest first.
 */
const harness = ({ total }: { total: number }) => {
  const requested: { limit: number }[] = [];
  const conditions: unknown[] = [];

  // Versions `total` down to 1, which is the order the real index scan gives.
  const all = Array.from({ length: total }, (_, index) =>
    revision(total - index),
  );

  const db = {
    select: () => {
      let where: unknown;

      const builder = {
        from: () => builder,
        leftJoin: () => builder,
        limit: async (value: number) => {
          requested.push({ limit: value });
          conditions.push(where);

          // The cursor is exclusive, so the stub applies it that way too.
          const cursor = cursorOf(where);
          const rows =
            cursor === null ? all : all.filter(entry => entry.version < cursor);

          return await Promise.resolve(rows.slice(0, value));
        },
        orderBy: () => builder,
        where: (value: unknown) => {
          where = value;

          return builder;
        },
      };

      return builder;
    },
  };

  const c = {
    get: (key: string) => (key === "db" ? db : undefined),
  } as unknown as Context;

  return {
    model: createContentRevisionsModel({
      c,
      definition: testEditorialPostContentType,
      pluginId: PLUGIN_ID,
    }),
    requested,
  };
};

/**
 * Reads the cursor value back out of the condition the model built.
 *
 * The model passes it as a bound parameter, so it turns up in the SQL's
 * `queryChunks` as a plain number - which is enough to make the stub behave
 * like a real exclusive `WHERE version < $cursor`.
 */
const cursorOf = (condition: unknown): null | number => {
  const walk = (value: unknown): unknown[] =>
    value !== null && typeof value === "object" && "queryChunks" in value
      ? (value.queryChunks as unknown[]).flatMap(walk)
      : [value];

  const params = walk(condition)
    .map(chunk => (chunk as null | { value?: unknown })?.value)
    .filter((value): value is number => typeof value === "number");

  // The scope predicate contributes the item id; the cursor is the last one.
  return params.length > 1 ? (params.at(-1) ?? null) : null;
};

describe("revision pagination", () => {
  it("returns the newest page first", async () => {
    const { model } = harness({ total: 60 });

    const page = await model.list(7, { limit: 25 });

    expect(page.edges).toHaveLength(25);
    expect(page.edges[0].version).toBe(60);
    expect(page.edges.at(-1)?.version).toBe(36);
  });

  it("says there is more, and where it resumes", async () => {
    const { model } = harness({ total: 60 });

    const page = await model.list(7, { limit: 25 });

    expect(page.pageInfo).toEqual({ endCursor: 36, hasNextPage: true });
  });

  it("reads one row past the page to answer that", async () => {
    // Cheaper than a COUNT, and it cannot disagree with the rows just returned.
    const { model, requested } = harness({ total: 60 });

    await model.list(7, { limit: 25 });

    expect(requested[0].limit).toBe(26);
  });

  it("does not repeat the boundary revision on the next page", async () => {
    // The bug: an inclusive `<=` cursor returns version 36 again, and a UI that
    // appends shows it twice.
    const { model } = harness({ total: 60 });

    const first = await model.list(7, { limit: 25 });
    const second = await model.list(7, {
      cursor: first.pageInfo.endCursor ?? undefined,
      limit: 25,
    });

    expect(second.edges[0].version).toBe(35);
    expect(
      new Set([...first.edges, ...second.edges].map(edge => edge.id)).size,
    ).toBe(50);
  });

  it("reaches every retained revision", async () => {
    // The other half of the bug: the default retention is 50 and the default
    // page is 25, so one page left half the history unreachable.
    const { model } = harness({ total: 50 });

    const versions: number[] = [];
    let cursor: number | undefined;
    let guard = 0;

    for (;;) {
      const page = await model.list(7, { cursor, limit: 25 });
      versions.push(...page.edges.map(edge => edge.version));
      if (!page.pageInfo.hasNextPage || (guard += 1) > 10) break;
      cursor = page.pageInfo.endCursor ?? undefined;
    }

    expect(versions).toHaveLength(50);
    expect(new Set(versions).size).toBe(50);
  });

  it("ends on a partial page with no next", async () => {
    const { model } = harness({ total: 30 });

    const first = await model.list(7, { limit: 25 });
    const second = await model.list(7, {
      cursor: first.pageInfo.endCursor ?? undefined,
      limit: 25,
    });

    expect(second.edges).toHaveLength(5);
    expect(second.pageInfo.hasNextPage).toBe(false);
  });

  it("reports an empty history honestly", async () => {
    const { model } = harness({ total: 0 });

    expect(await model.list(7)).toEqual({
      edges: [],
      pageInfo: { endCursor: null, hasNextPage: false },
    });
  });

  it("caps the page size", async () => {
    const { model, requested } = harness({ total: 500 });

    const page = await model.list(7, { limit: 5000 });

    expect(requested[0].limit).toBe(CONTENT_REVISIONS_MAX_PAGE_SIZE + 1);
    expect(page.edges).toHaveLength(CONTENT_REVISIONS_MAX_PAGE_SIZE);
  });

  it("keeps a newer revision from shifting the page under a reader", async () => {
    // A cursor on `version` is stable in a way an offset is not: a revision
    // added between two requests is newer than the cursor, so page two returns
    // exactly what it would have returned before.
    const growing = harness({ total: 60 });
    const first = await growing.model.list(7, { limit: 25 });

    const afterInsert = harness({ total: 61 });
    const second = await afterInsert.model.list(7, {
      cursor: first.pageInfo.endCursor ?? undefined,
      limit: 25,
    });

    expect(second.edges[0].version).toBe(35);
  });
});
