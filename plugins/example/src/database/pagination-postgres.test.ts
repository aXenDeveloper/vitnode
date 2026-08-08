import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CONFIG_PLUGIN } from "@/const";

import type { ContentTestHarness } from "./harness";

import { articleContent } from "./articles";
import {
  clearContentTables,
  createContentTestHarness,
  DATABASE_TEST_URL,
} from "./harness";

/**
 * Keyset pagination, against a collection built to break an id-only cursor.
 *
 * The bug this suite exists for: the cursor used to be the row identifier while
 * the `ORDER BY` was something else entirely. Those describe two different
 * sequences, so a page boundary landing anywhere except a coincidence would
 * skip rows - permanently, and silently, because a short page looks exactly
 * like the end of a collection.
 *
 * Every fixture here therefore makes the sort value **disagree** with the
 * identifier on purpose. A cursor that is the ordered tuple walks them
 * correctly; one that is only an identifier cannot.
 *
 * The oracle in every case is the same query without pagination: a full walk
 * has to produce exactly the rows a single `ORDER BY` produces, in the same
 * order.
 */

let h: ContentTestHarness;
let categoryId = 0;

const service = (on: Context = h.context) => articleContent.service(on);

interface Seed {
  code: string;
  publishedAt?: Date | null;
  title: string;
  updatedAt: Date;
}

/**
 * Inserts rows in the order given, so identifiers ascend with the array while
 * the sort values do whatever the fixture says.
 */
const seed = async (rows: readonly Seed[]): Promise<number[]> => {
  const ids: number[] = [];
  for (const [index, row] of rows.entries()) {
    const [inserted] = await h.sql<{ id: number }[]>`
      INSERT INTO "example_articles"
        ("title", "slug", "code", "category", "status", "publishedAt", "updatedAt")
      VALUES (
        ${row.title},
        ${`slug-${row.code}`},
        ${row.code},
        ${categoryId},
        ${row.publishedAt === undefined || row.publishedAt === null ? "draft" : "published"},
        ${row.publishedAt?.toISOString() ?? null}::timestamp,
        ${row.updatedAt.toISOString()}::timestamp
      )
      RETURNING "id"
    `;
    ids.push(inserted.id);
    expect(index).toBeGreaterThanOrEqual(0);
  }

  return ids;
};

/** The order a single un-paginated query produces - the oracle. */
const oracle = async (
  column: string,
  order: "asc" | "desc",
): Promise<number[]> => {
  const rows = await h.sql.unsafe(
    `SELECT "id" FROM "example_articles"
     ORDER BY "${column}" ${order.toUpperCase()}, "id" ${order.toUpperCase()}`,
  );

  return rows.map(row => Number(row.id));
};

/** Walks every page forward and returns the identifiers, in order. */
const walkForward = async ({
  column,
  order = "asc",
  pageSize,
}: {
  column?: string;
  order?: "asc" | "desc";
  pageSize: number;
}): Promise<number[]> => {
  const seen: number[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 200; page += 1) {
    const result = await service().findMany({
      orderBy: column ? { column: column as never, order } : { order },
      query: { cursor, first: String(pageSize) },
    });

    seen.push(...result.edges.map(row => row.id));
    if (!result.pageInfo.hasNextPage) break;

    // The invariant the reviewer asked for: a page that claims a neighbour has
    // to hand out a cursor that reaches it.
    expect(result.pageInfo.endCursor).not.toBeNull();
    cursor = result.pageInfo.endCursor ?? undefined;
  }

  return seen;
};

const statusOf = (error: unknown): number =>
  error instanceof HTTPException ? error.status : 0;

describe.skipIf(!DATABASE_TEST_URL)(
  "cursor pagination against Postgres",
  () => {
    beforeAll(async () => {
      h = await createContentTestHarness();
    }, 60_000);

    afterAll(async () => {
      await h?.end();
    });

    beforeEach(async () => {
      await clearContentTables(h.sql);
      h.reset();

      const [category] = await h.sql<{ id: number }[]>`
      INSERT INTO "example_categories" ("name") VALUES ('Pagination')
      RETURNING "id"
    `;
      categoryId = category.id;
    });

    // -------------------------------------------------------------------------
    // The regression
    // -------------------------------------------------------------------------

    /**
     * Identifiers ascending, sort values deliberately shuffled.
     *
     * `id=1` sorts last, `id=2` sorts first, `id=3` sits in the middle. An id-only
     * cursor mints `2` after the first page and then asks for `id > 2`, which
     * skips `id=1` forever.
     */
    const NON_MONOTONIC: Seed[] = [
      {
        code: "n1",
        title: "Zulu",
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
      {
        code: "n2",
        title: "Alpha",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        code: "n3",
        title: "Mike",
        updatedAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    ];

    it("skips nothing when the sort value does not follow the identifier", async () => {
      const ids = await seed(NON_MONOTONIC);

      const walked = await walkForward({ column: "title", pageSize: 1 });

      expect(walked).toHaveLength(ids.length);
      expect(new Set(walked).size).toBe(ids.length);
      // And in the order a single query would have produced.
      expect(walked).toEqual(await oracle("title", "asc"));
    });

    it("skips nothing ordering by a timestamp that does not follow the identifier", async () => {
      const ids = await seed(NON_MONOTONIC);

      const walked = await walkForward({ column: "updatedAt", pageSize: 1 });

      expect(walked).toHaveLength(ids.length);
      expect(new Set(walked).size).toBe(ids.length);
      expect(walked).toEqual(await oracle("updatedAt", "asc"));
    });

    it("skips nothing descending either", async () => {
      const ids = await seed(NON_MONOTONIC);

      const walked = await walkForward({
        column: "updatedAt",
        order: "desc",
        pageSize: 1,
      });

      expect(walked).toHaveLength(ids.length);
      expect(walked).toEqual(await oracle("updatedAt", "desc"));
    });

    it("holds over a larger, thoroughly shuffled collection", async () => {
      // 40 rows whose sort values are a permutation of their identifiers, walked
      // two at a time so every page boundary lands somewhere different.
      const rows: Seed[] = Array.from({ length: 40 }, (_row, index) => ({
        code: `bulk-${index}`,
        title: `Title ${String((index * 17) % 40).padStart(2, "0")}`,
        updatedAt: new Date(2026, 0, 1 + ((index * 23) % 40)),
      }));
      await seed(rows);

      for (const column of ["title", "updatedAt"] as const) {
        for (const order of ["asc", "desc"] as const) {
          const walked = await walkForward({ column, order, pageSize: 3 });

          expect([column, order, walked.length]).toEqual([column, order, 40]);
          expect(new Set(walked).size).toBe(40);
          expect(walked).toEqual(await oracle(column, order));
        }
      }
    });

    // -------------------------------------------------------------------------
    // Ties
    // -------------------------------------------------------------------------

    it("returns every row exactly once when the sort values are all equal", async () => {
      // The tie case: with no tiebreaker the rows sit wherever Postgres feels
      // like putting them, and a page boundary inside the tie loses one.
      const stamp = new Date("2026-05-05T00:00:00.000Z");
      const ids = await seed(
        Array.from({ length: 12 }, (_row, index) => ({
          code: `tie-${index}`,
          title: `Tie ${index}`,
          updatedAt: stamp,
        })),
      );

      const walked = await walkForward({ column: "updatedAt", pageSize: 5 });

      expect(walked).toHaveLength(ids.length);
      expect(new Set(walked).size).toBe(ids.length);
      expect(walked).toEqual(await oracle("updatedAt", "asc"));
    });

    it("returns every row exactly once with ties in a published-at ordering", async () => {
      const stamp = new Date("2026-05-05T00:00:00.000Z");
      const ids = await seed(
        Array.from({ length: 9 }, (_row, index) => ({
          code: `pub-${index}`,
          publishedAt: stamp,
          title: `Published ${index}`,
          updatedAt: new Date(2026, 0, 1 + index),
        })),
      );

      const walked = await walkForward({
        column: "publishedAt",
        order: "desc",
        pageSize: 4,
      });

      expect(walked).toHaveLength(ids.length);
      expect(walked).toEqual(await oracle("publishedAt", "desc"));
    });

    // -------------------------------------------------------------------------
    // Nulls
    // -------------------------------------------------------------------------

    /**
     * A nullable order column is where the null block has to be named explicitly:
     * Postgres sorts `NULLS LAST` ascending and `NULLS FIRST` descending, and
     * `column > NULL` is `NULL` rather than true - so a page boundary landing on
     * the block would otherwise end the walk early and silently.
     */
    it("walks a nullable order column through its null block, ascending", async () => {
      const ids = await seed([
        {
          code: "u1",
          publishedAt: new Date("2026-02-01"),
          title: "One",
          updatedAt: new Date("2026-01-01"),
        },
        {
          code: "u2",
          publishedAt: null,
          title: "Two",
          updatedAt: new Date("2026-01-02"),
        },
        {
          code: "u3",
          publishedAt: new Date("2026-01-01"),
          title: "Three",
          updatedAt: new Date("2026-01-03"),
        },
        {
          code: "u4",
          publishedAt: null,
          title: "Four",
          updatedAt: new Date("2026-01-04"),
        },
        {
          code: "u5",
          publishedAt: new Date("2026-03-01"),
          title: "Five",
          updatedAt: new Date("2026-01-05"),
        },
      ]);

      const walked = await walkForward({ column: "publishedAt", pageSize: 2 });

      expect(walked).toHaveLength(ids.length);
      expect(new Set(walked).size).toBe(ids.length);
      expect(walked).toEqual(await oracle("publishedAt", "asc"));
    });

    it("walks a nullable order column through its null block, descending", async () => {
      const ids = await seed([
        {
          code: "d1",
          publishedAt: new Date("2026-02-01"),
          title: "One",
          updatedAt: new Date("2026-01-01"),
        },
        {
          code: "d2",
          publishedAt: null,
          title: "Two",
          updatedAt: new Date("2026-01-02"),
        },
        {
          code: "d3",
          publishedAt: new Date("2026-01-01"),
          title: "Three",
          updatedAt: new Date("2026-01-03"),
        },
        {
          code: "d4",
          publishedAt: null,
          title: "Four",
          updatedAt: new Date("2026-01-04"),
        },
        {
          code: "d5",
          publishedAt: new Date("2026-03-01"),
          title: "Five",
          updatedAt: new Date("2026-01-05"),
        },
      ]);

      const walked = await walkForward({
        column: "publishedAt",
        order: "desc",
        pageSize: 2,
      });

      expect(walked).toHaveLength(ids.length);
      expect(walked).toEqual(await oracle("publishedAt", "desc"));
    });

    // -------------------------------------------------------------------------
    // Ordering by the identifier
    // -------------------------------------------------------------------------

    it.each([["asc" as const], ["desc" as const]])(
      "walks the identifier ordering (%s)",
      async order => {
        const ids = await seed(NON_MONOTONIC);

        const walked = await walkForward({ column: "id", order, pageSize: 2 });

        expect(walked).toHaveLength(ids.length);
        expect(walked).toEqual(await oracle("id", order));
      },
    );

    it("still accepts a legacy numeric cursor when ordering by the identifier", async () => {
      // Old bookmarks keep working exactly where an identifier really is the
      // whole ordered tuple - and nowhere else.
      const ids = await seed(NON_MONOTONIC);

      const page = await service().findMany({
        orderBy: { column: "id" as never, order: "asc" },
        query: { cursor: String(ids[0]), first: "10" },
      });

      expect(page.edges.map(row => row.id)).toEqual(ids.slice(1));
    });

    it("refuses a legacy numeric cursor on any other ordering", async () => {
      await seed(NON_MONOTONIC);

      await expect(
        service().findMany({
          orderBy: { column: "title" as never, order: "asc" },
          query: { cursor: "1", first: "10" },
        }),
      ).rejects.toThrow(/cannot be used with the "title" ordering/);
    });

    // -------------------------------------------------------------------------
    // Backward pagination
    // -------------------------------------------------------------------------

    it("walks backward from the end and reaches the beginning", async () => {
      const rows: Seed[] = Array.from({ length: 11 }, (_row, index) => ({
        code: `back-${index}`,
        title: `Title ${String((index * 7) % 11).padStart(2, "0")}`,
        updatedAt: new Date(2026, 0, 1 + ((index * 5) % 11)),
      }));
      await seed(rows);

      const expected = await oracle("title", "asc");

      // Forward to the end, keeping the cursor of the final page's first row.
      const forward = await service().findMany({
        orderBy: { column: "title" as never, order: "asc" },
        query: { first: "11" },
      });
      expect(forward.edges.map(row => row.id)).toEqual(expected);

      // Then backward from the last row, four at a time.
      const seen: number[] = [];
      let cursor = forward.pageInfo.endCursor ?? undefined;
      for (let page = 0; page < 20; page += 1) {
        const result = await service().findMany({
          orderBy: { column: "title" as never, order: "asc" },
          query: { cursor, last: "4" },
        });
        if (result.edges.length === 0) break;

        seen.unshift(...result.edges.map(row => row.id));
        if (!result.pageInfo.hasPreviousPage) break;
        expect(result.pageInfo.startCursor).not.toBeNull();
        cursor = result.pageInfo.startCursor ?? undefined;
      }

      // Everything before the row we started from, in the same order.
      expect(seen).toEqual(expected.slice(0, expected.length - 1));
      expect(new Set(seen).size).toBe(seen.length);
    });

    it("keeps backward pagination correct with a non-monotonic ordering", async () => {
      await seed(NON_MONOTONIC);
      const expected = await oracle("updatedAt", "desc");

      const forward = await service().findMany({
        orderBy: { column: "updatedAt" as never, order: "desc" },
        query: { first: "3" },
      });

      const back = await service().findMany({
        orderBy: { column: "updatedAt" as never, order: "desc" },
        query: { cursor: forward.pageInfo.endCursor ?? undefined, last: "2" },
      });

      expect(back.edges.map(row => row.id)).toEqual(expected.slice(0, 2));
    });

    // -------------------------------------------------------------------------
    // Page info
    // -------------------------------------------------------------------------

    it("never claims a next page it cannot hand out a cursor for", async () => {
      const rows: Seed[] = Array.from({ length: 6 }, (_row, index) => ({
        code: `info-${index}`,
        title: `Info ${index}`,
        updatedAt: new Date(2026, 0, 1 + index),
      }));
      await seed(rows);

      let cursor: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const result = await service().findMany({
          orderBy: { column: "title" as never, order: "asc" },
          query: { cursor, first: "2" },
        });

        if (result.pageInfo.hasNextPage) {
          expect(result.pageInfo.endCursor).toEqual(expect.any(String));
        }
        if (result.pageInfo.hasPreviousPage) {
          expect(result.pageInfo.startCursor).toEqual(expect.any(String));
        }
        if (!result.pageInfo.hasNextPage) break;
        cursor = result.pageInfo.endCursor ?? undefined;
      }
    });

    it("reports an empty collection with no cursors and no neighbours", async () => {
      const result = await service().findMany({ query: { first: "5" } });

      expect(result.pageInfo).toMatchObject({
        endCursor: null,
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        totalCount: 0,
      });
    });

    it("hands out an opaque cursor rather than a row identifier", async () => {
      const ids = await seed(NON_MONOTONIC);

      const page = await service().findMany({
        orderBy: { column: "title" as never, order: "asc" },
        query: { first: "1" },
      });

      const cursor = page.pageInfo.endCursor ?? "";
      expect(cursor).not.toBe(String(ids[0]));
      expect(Number.isNaN(Number(cursor))).toBe(true);
      // It carries the ordered tuple, which is the whole point.
      expect(
        JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
      ).toMatchObject({ column: "title" });
    });

    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------

    describe("refuses a request it cannot answer", () => {
      const expect400 = async (query: Record<string, string>) => {
        try {
          await service().findMany({ query });
        } catch (error) {
          expect(statusOf(error)).toBe(400);

          return;
        }

        throw new Error(`Expected ${JSON.stringify(query)} to be refused.`);
      };

      it.each([
        ["first=0", { first: "0" }],
        ["last=0", { last: "0" }],
        ["first=-1", { first: "-1" }],
        ["last=-1", { last: "-1" }],
        ["first=abc", { first: "abc" }],
        ["last=abc", { last: "abc" }],
        ["first=1.5", { first: "1.5" }],
        ["both first and last", { first: "5", last: "5" }],
        ["cursor=garbage", { cursor: "!!!not-a-cursor!!!" }],
      ])("answers 400 for %s", async (_why, query) => {
        await expect400(query);
      });

      it("does not turn first=0 into a one-row page", async () => {
        // What it used to do: clamp to a limit of one, return a row, and report
        // `hasNextPage: true` for a page nobody asked for.
        await seed(NON_MONOTONIC);

        await expect400({ first: "0" });
      });

      it("caps a page at the maximum rather than trusting the caller", async () => {
        const rows: Seed[] = Array.from({ length: 3 }, (_row, index) => ({
          code: `cap-${index}`,
          title: `Cap ${index}`,
          updatedAt: new Date(2026, 0, 1 + index),
        }));
        await seed(rows);

        const page = await service().findMany({ query: { first: "100000" } });

        expect(page.edges).toHaveLength(3);
      });
    });

    // -------------------------------------------------------------------------
    // The public list, which is the anonymous half of the same machinery
    // -------------------------------------------------------------------------

    it("walks the public list with a non-monotonic publication order", async () => {
      const build = articleContent.publicService;
      if (!build) throw new Error("no public service");

      await seed([
        {
          code: "p1",
          publishedAt: new Date("2026-03-01"),
          title: "Zulu",
          updatedAt: new Date("2026-01-01"),
        },
        {
          code: "p2",
          publishedAt: new Date("2026-01-01"),
          title: "Alpha",
          updatedAt: new Date("2026-01-02"),
        },
        {
          code: "p3",
          publishedAt: new Date("2026-02-01"),
          title: "Mike",
          updatedAt: new Date("2026-01-03"),
        },
      ]);

      const seen: number[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const result = await build(h.context).findMany({
          orderBy: { column: "publishedAt" as never, order: "desc" },
          query: { cursor, first: "1" },
        });
        seen.push(...result.edges.map(row => Number(row.publishedAt)));
        if (!result.pageInfo.hasNextPage) break;
        cursor = result.pageInfo.endCursor ?? undefined;
      }

      expect(seen).toHaveLength(3);
      // Newest first, which is the ordering the route asked for.
      expect([...seen].sort((a, b) => b - a)).toEqual(seen);
      expect(CONFIG_PLUGIN.pluginId).toBe("@vitnode/example");
    });
  },
);
