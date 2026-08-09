import type { Context } from "hono";

import { withPagination } from "@vitnode/core/api/lib/with-pagination";
import { HTTPException } from "hono/http-exception";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CONFIG_PLUGIN } from "@/const";

import type { ContentTestHarness } from "./harness";

import { articleContent, example_articles } from "./articles";
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
    // The cursor is a historical position
    // -------------------------------------------------------------------------

    /**
     * A cursor names where the page ended, not which row ended it.
     *
     * The distinction only shows itself when the boundary row moves. If the next
     * page's comparison were built from that row's *current* value, one edit
     * would drag the boundary with it and silently skip every row the ordering
     * used to have in between - a page of results nobody ever sees, with no
     * error and no short page to notice.
     *
     * The fixture makes the continuation deterministic: five rows ascending by
     * `updatedAt`, identifiers ascending with them.
     */
    describe("when the boundary row changes after the cursor was issued", () => {
      const LADDER: Seed[] = [
        {
          code: "l1",
          title: "One",
          updatedAt: new Date("2026-08-09T10:00:00Z"),
        },
        {
          code: "l2",
          title: "Two",
          updatedAt: new Date("2026-08-09T10:01:00Z"),
        },
        {
          code: "l3",
          title: "Three",
          updatedAt: new Date("2026-08-09T11:00:00Z"),
        },
        {
          code: "l4",
          title: "Four",
          updatedAt: new Date("2026-08-09T12:00:00Z"),
        },
        {
          code: "l5",
          title: "Five",
          updatedAt: new Date("2026-08-09T13:00:00Z"),
        },
      ];

      /** Page 1 of one row, plus the cursor it handed back. */
      const firstPage = async (order: "asc" | "desc" = "asc") => {
        const page = await service().findMany({
          orderBy: { column: "updatedAt" as never, order },
          query: { first: "1" },
        });

        return {
          boundary: page.edges[0].id,
          cursor: page.pageInfo.endCursor ?? undefined,
        };
      };

      const walkFrom = async (
        cursor: string | undefined,
        order: "asc" | "desc" = "asc",
      ) => {
        const seen: number[] = [];
        let next = cursor;
        for (let page = 0; page < 20; page += 1) {
          const result = await service().findMany({
            orderBy: { column: "updatedAt" as never, order },
            query: { cursor: next, first: "2" },
          });
          seen.push(...result.edges.map(row => row.id));
          if (!result.pageInfo.hasNextPage) break;
          next = result.pageInfo.endCursor ?? undefined;
        }

        return seen;
      };

      const moveTo = async (id: number, when: string) => {
        await h.sql`
          UPDATE "example_articles"
          SET "updatedAt" = ${when}::timestamp
          WHERE "id" = ${id}
        `;
      };

      it("still reaches every row that was after the cursor when it was issued", async () => {
        // The regression. Moving the boundary row to the *end* of the ordering
        // would drag a re-read boundary with it, and 10:01, 11:00, 12:00 and
        // 13:00 would be skipped for good.
        const ids = await seed(LADDER);
        const { boundary, cursor } = await firstPage();
        expect(boundary).toBe(ids[0]);

        await moveTo(boundary, "2026-08-09T14:00:00");

        const seen = await walkFrom(cursor);

        for (const id of ids.slice(1)) expect(seen).toContain(id);
        expect(new Set(seen).size).toBe(seen.length);
      });

      it("shows the moved row again, because it moved into unvisited ground", async () => {
        // The honest consequence, stated rather than hidden: a keyset walk is
        // not a snapshot, so a row that moves from behind the cursor to ahead
        // of it is seen a second time. What matters is that nothing else moved.
        const ids = await seed(LADDER);
        const { boundary, cursor } = await firstPage();

        await moveTo(boundary, "2026-08-09T14:00:00");

        const seen = await walkFrom(cursor);

        expect(seen).toContain(boundary);
        expect(seen.sort((a, b) => a - b)).toEqual(
          [...ids].sort((a, b) => a - b),
        );
      });

      it("does not show it again when it moves further behind the cursor", async () => {
        const ids = await seed(LADDER);
        const { boundary, cursor } = await firstPage();

        await moveTo(boundary, "2026-08-09T09:00:00");

        const seen = await walkFrom(cursor);

        expect(seen).not.toContain(boundary);
        expect(seen.sort((a, b) => a - b)).toEqual(ids.slice(1));
      });

      it("keeps working when the boundary row is deleted outright", async () => {
        // Nothing to re-read, and nothing that needs re-reading: the position
        // is in the cursor.
        const ids = await seed(LADDER);
        const { boundary, cursor } = await firstPage();

        await h.sql`DELETE FROM "example_articles" WHERE "id" = ${boundary}`;

        const seen = await walkFrom(cursor);

        expect(seen.sort((a, b) => a - b)).toEqual(ids.slice(1));
        expect(new Set(seen).size).toBe(seen.length);
      });

      it("survives the whole first page being deleted", async () => {
        const ids = await seed(LADDER);
        const page = await service().findMany({
          orderBy: { column: "updatedAt" as never, order: "asc" },
          query: { first: "3" },
        });
        const read = page.edges.map(row => row.id);

        for (const id of read) {
          await h.sql`DELETE FROM "example_articles" WHERE "id" = ${id}`;
        }

        const seen = await walkFrom(page.pageInfo.endCursor ?? undefined);

        expect(seen.sort((a, b) => a - b)).toEqual(
          ids.filter(id => !read.includes(id)).sort((a, b) => a - b),
        );
      });

      it("holds the same way descending", async () => {
        const ids = await seed(LADDER);
        const { boundary, cursor } = await firstPage("desc");

        await moveTo(boundary, "2026-08-09T00:01:00");

        const seen = await walkFrom(cursor, "desc");

        for (const id of ids.slice(0, 4)) expect(seen).toContain(id);
        expect(new Set(seen).size).toBe(seen.length);
      });

      it("carries the database's own timestamp text, microseconds included", async () => {
        // The reason the cursor can be self-contained at all. A JavaScript
        // `Date` holds milliseconds; `now()` writes microseconds. A cursor that
        // had been through a `Date` would be strictly smaller than the stored
        // value and would exclude the whole millisecond it came from - and here
        // every row shares one `now()`, so the walk would stop after page one.
        await h.sql`
          INSERT INTO "example_articles"
            ("title", "slug", "code", "category", "status", "updatedAt")
          SELECT 'Micro ' || i, 'micro-' || i, 'micro-' || i, ${categoryId},
                 'draft', now()
          FROM generate_series(1, 6::int) AS i
        `;

        const page = await service().findMany({
          orderBy: { column: "updatedAt" as never, order: "asc" },
          query: { first: "1" },
        });
        const decoded = JSON.parse(
          Buffer.from(page.pageInfo.endCursor ?? "", "base64url").toString(
            "utf8",
          ),
        ) as { value: string };

        // Byte-identical to what the column holds, rather than "has enough
        // digits": trailing zeros are dropped by `::text`, so counting them
        // would be a coin flip, and equality is the property that matters.
        const [stored] = await h.sql<{ text: string }[]>`
          SELECT "updatedAt"::text AS text FROM "example_articles"
          WHERE "id" = ${page.edges[0].id}
        `;
        expect(decoded.value).toBe(stored.text);

        // And the walk completes, which it cannot if the boundary was
        // truncated: every row here shares one `now()`.
        const seen = await walkFrom(page.pageInfo.endCursor ?? undefined);
        expect(seen).toHaveLength(5);
      });

      /**
       * The window between choosing the rows and describing where they were.
       *
       * The cursor value used to be fetched by a *second* statement, after the
       * page rows had already come back - which is a time-of-check /
       * time-of-use gap wide enough for another writer to walk through. The row
       * was chosen at one position and handed back as a cursor pointing at
       * another, so the next page started somewhere the reader had never been
       * and everything in between was gone.
       *
       * There is no window now: the value is projected by the page query
       * itself. These tests prove that by mutating the boundary row in exactly
       * that gap - after the rows are in hand, before the cursor is minted -
       * and showing the cursor does not notice.
       */
      describe("while the page is being turned into cursors", () => {
        const decode = (cursor: null | string | undefined) =>
          JSON.parse(
            Buffer.from(cursor ?? "", "base64url").toString("utf8"),
          ) as { id: number; value: null | string };

        /**
         * One page, with a mutation spliced into the mint-time gap.
         *
         * `withPagination` is driven directly because the gap is inside it:
         * the callback is what fetched the rows, so running the mutation on the
         * way out of it lands precisely between the page query and the cursor.
         */
        const pageWithRace = async (
          mutate: (boundaryId: number) => Promise<void>,
        ) =>
          await withPagination({
            c: h.context,
            orderBy: { column: example_articles.updatedAt, order: "asc" },
            params: { query: { first: "1" } },
            primaryCursor: example_articles.id,
            query: async ({ cursorSelection, limit, orderBy, where }) => {
              const rows = await h.db
                .select({ id: example_articles.id, ...cursorSelection })
                .from(example_articles)
                .where(where)
                .orderBy(orderBy)
                .limit(typeof limit === "number" ? limit : 2);

              const boundary = rows[0];
              if (boundary) await mutate(boundary.id);

              return rows;
            },
            table: example_articles,
          });

        it("mints the position the row had, not the one it was given meanwhile", async () => {
          const ids = await seed(LADDER);

          const page = await pageWithRace(
            async id => await moveTo(id, "2026-08-09T14:00:00"),
          );

          expect(page.edges[0].id).toBe(ids[0]);
          // The row now says 14:00. The cursor still says 10:00, because 10:00
          // is where the row was when it ended this page.
          expect(decode(page.pageInfo.endCursor).value).toBe(
            "2026-08-09 10:00:00",
          );

          // And the consequence that matters: 10:01, 11:00, 12:00 and 13:00 are
          // all still reachable. A cursor carrying 14:00 would have skipped
          // every one of them, permanently and without an error.
          const seen = await walkFrom(page.pageInfo.endCursor ?? undefined);
          for (const id of ids.slice(1)) expect(seen).toContain(id);
        });

        it("mints a real position when the row is deleted meanwhile", async () => {
          // The worse half of the old race. A second lookup found nothing, and
          // "nothing" became `null` - which for a nullable ordering is not the
          // absence of a position but a real one, inside the null block. The
          // walk jumped there and abandoned the rest of the collection.
          const ids = await seed(LADDER);

          const page = await pageWithRace(async id => {
            await h.sql`DELETE FROM "example_articles" WHERE "id" = ${id}`;
          });

          expect(decode(page.pageInfo.endCursor).value).toBe(
            "2026-08-09 10:00:00",
          );

          const seen = await walkFrom(page.pageInfo.endCursor ?? undefined);
          expect(seen.sort((a, b) => a - b)).toEqual(ids.slice(1));
        });

        it("reads its cursor value out of the page query, not a second one", async () => {
          // The structural regression assertion. There is nothing to race with
          // if there is no second statement, so this is the property to guard
          // rather than the symptom.
          await seed(LADDER);

          const list = async () =>
            await service(h.counted.context).findMany({
              orderBy: { column: "updatedAt" as never, order: "asc" },
              query: { first: "2" },
            });

          // Warmed first: `postgres` prepares a statement the first time it
          // sees its shape, so a cold call issues messages a warm one does not.
          await list();
          h.counted.reset();
          await list();

          const selects = h.counted.queries.filter(query =>
            /^\s*select/i.test(query),
          );

          // Two, and only two: the total count, and the page. A third would be
          // the boundary lookup coming back.
          expect(selects).toHaveLength(2);
          // The page carries the cursor value with it, at the database's own
          // precision.
          expect(selects.some(query => query.includes("::text"))).toBe(true);
        });
      });
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

    it("keeps its own projected column out of every row it returns", async () => {
      // The page query selects the cursor value so it can be minted from the
      // same statement. That column is pagination's business: it is taken back
      // before a row reaches a handler, so it cannot reach a response, a
      // schema, a search document or a revision snapshot either.
      await seed(NON_MONOTONIC);
      const publicService = articleContent.publicService;
      if (!publicService) throw new Error("no public service");

      const admin = await service().findMany({ query: { first: "3" } });
      const anonymous = await publicService(h.context).findMany({
        query: { first: "3" },
      });

      expect(admin.edges.length).toBeGreaterThan(0);
      for (const row of [...admin.edges, ...anonymous.edges]) {
        expect(Object.keys(row)).not.toContain("__cursorValue");
      }
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

      /**
       * The cursor is opaque but not signed, so every field is hostile input.
       *
       * These go through the real service, which is where the column is known -
       * a value that looks fine in isolation is only wrong relative to the
       * column it claims to describe.
       */
      const tampered = (value: unknown, column = "updatedAt") =>
        Buffer.from(JSON.stringify({ column, id: 1, value })).toString(
          "base64url",
        );

      it.each([
        ["nonsense", "not-a-date", "updatedAt"],
        ["a number", 1_700_000_000, "updatedAt"],
        ["a boolean", true, "updatedAt"],
        [
          "an injection attempt",
          "2026-08-09'; DROP TABLE example_articles; --",
          "updatedAt",
        ],
        ["a number where a string belongs", 12, "title"],
        ["a boolean where a string belongs", false, "title"],
      ])(
        "answers 400 for a cursor holding %s, without reaching Postgres",
        async (_why, value, column) => {
          try {
            await service().findMany({
              orderBy: { column: column as never, order: "asc" },
              query: { cursor: tampered(value, column), first: "5" },
            });
          } catch (error) {
            // An `HTTPException`, never a `SyntaxError`, a `RangeError` or a
            // Postgres cast failure - each of which would surface as a 500.
            expect(error).toBeInstanceOf(HTTPException);
            expect(statusOf(error)).toBe(400);

            return;
          }

          throw new Error(`Expected ${String(value)} to be refused.`);
        },
      );

      /**
       * The values a pattern lets through and Postgres does not.
       *
       * `2026-02-30` has the shape of a timestamp and is not a day, so a shape
       * check passes it straight into `'2026-02-30'::timestamp` - and the
       * answer to that is `invalid input syntax`, arriving at a client as a 500
       * from a route whose contract says it does not do that. Each of these is
       * refused before anything is bound.
       */
      it.each([
        ["month 13", "2026-13-01"],
        ["month 0", "2026-00-01"],
        ["30 February", "2026-02-30"],
        ["29 February in a common year", "2025-02-29"],
        ["31 April", "2026-04-31"],
        ["day 32", "2026-01-32"],
        ["hour 24", "2026-08-09 24:00:00"],
        ["minute 60", "2026-08-09 23:60:00"],
        ["second 61", "2026-08-09 23:59:61"],
        ["an impossible offset", "2026-08-09 10:00:00+25:00"],
        ["an offset with 99 minutes", "2026-08-09 10:00:00+12:99"],
      ])(
        "answers 400 for a cursor holding %s, which Postgres would refuse",
        async (_why, value) => {
          await seed(NON_MONOTONIC);

          try {
            await service().findMany({
              orderBy: { column: "updatedAt" as never, order: "asc" },
              query: { cursor: tampered(value), first: "5" },
            });
          } catch (error) {
            expect(error).toBeInstanceOf(HTTPException);
            expect(statusOf(error)).toBe(400);
            // Specifically not a Postgres error wearing a different hat.
            expect((error as Error).message).not.toMatch(
              /invalid input syntax/i,
            );

            return;
          }

          throw new Error(`Expected ${value} to be refused.`);
        },
      );

      it("still answers a leap day, which is a real one", async () => {
        // The other half of the check: refusing impossible values must not
        // refuse possible ones. 2024 is a leap year and 2024-02-29 exists.
        const ids = await seed([
          {
            code: "leap",
            title: "Leap",
            updatedAt: new Date("2024-02-29T10:00:00Z"),
          },
          {
            code: "after",
            title: "After",
            updatedAt: new Date("2024-03-01T10:00:00Z"),
          },
        ]);

        const cursor = Buffer.from(
          JSON.stringify({
            column: "updatedAt",
            id: ids[0],
            value: "2024-02-29 10:00:00",
          }),
        ).toString("base64url");

        const page = await service().findMany({
          orderBy: { column: "updatedAt" as never, order: "asc" },
          query: { cursor, first: "5" },
        });

        expect(page.edges.map(row => row.id)).toEqual([ids[1]]);
      });

      it("leaves the table alone when a cursor tries to inject SQL", async () => {
        await seed(NON_MONOTONIC);

        await expect(
          service().findMany({
            orderBy: { column: "updatedAt" as never, order: "asc" },
            query: {
              cursor: tampered("2026-08-09'; DROP TABLE example_articles; --"),
              first: "5",
            },
          }),
        ).rejects.toBeInstanceOf(HTTPException);

        await expect(service().findMany()).resolves.toMatchObject({
          pageInfo: { totalCount: 3 },
        });
      });

      it("refuses a cursor whose identifier is not a positive integer", async () => {
        const zeroId = Buffer.from(
          JSON.stringify({ column: "updatedAt", id: 0, value: null }),
        ).toString("base64url");

        await expect(
          service().findMany({
            orderBy: { column: "updatedAt" as never, order: "asc" },
            query: { cursor: zeroId, first: "5" },
          }),
        ).rejects.toBeInstanceOf(HTTPException);
      });

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
