import {
  generateDrizzleJson,
  generateMigration,
} from "drizzle-kit/api-postgres";
// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  core_content_file_refs,
  core_content_revisions,
  core_content_schedules,
  core_content_slug_history,
} from "@/database/content";
import { core_files } from "@/database/files";
import { core_languages } from "@/database/languages";
import { core_roles } from "@/database/roles";
import { core_search_index } from "@/database/search";
import { core_users } from "@/database/users";
import {
  createTestDatabase,
  describePostgres,
  type TestDatabaseHandle,
} from "@/tests/postgres";

/** The four tables every content type shares, keyed by `contentIdKey` since id strategies. */
const SHARED_TABLES = [
  "core_content_revisions",
  "core_content_schedules",
  "core_content_slug_history",
  "core_search_index",
];

/**
 * What the migration runs against here. `core_search_index` is left out of the
 * database only: its generated `tsvector` names text search configurations a
 * stock Postgres test image does not ship. Its statement is checked below, and
 * it is the same `ALTER ... USING` the other three run.
 */
const schema = {
  core_content_file_refs,
  core_content_revisions,
  core_content_schedules,
  core_content_slug_history,
  core_files,
  core_languages,
  core_roles,
  core_users,
};

const withSearch = { ...schema, core_search_index };

type Snapshot = Awaited<ReturnType<typeof generateDrizzleJson>>;

/**
 * The snapshot the previous schema produced: every shared `itemId` an `integer`,
 * as it was before content types could be keyed by `uuid` or `bigint`.
 */
const legacy = (current: Snapshot): Snapshot => ({
  ...current,
  ddl: current.ddl.map(entry =>
    entry.entityType === "columns" &&
    entry.name === "itemId" &&
    SHARED_TABLES.includes(entry.table)
      ? { ...entry, type: "integer" }
      : entry,
  ),
});

const rows = async (
  database: TestDatabaseHandle,
  query: string,
): Promise<Record<string, unknown>[]> =>
  [...(await database.db.execute(sql.raw(query)))] as Record<string, unknown>[];

describePostgres("the shared item id migration", () => {
  let database: TestDatabaseHandle;
  let statements: string[];

  beforeAll(async () => {
    database = await createTestDatabase(schema, { snapshot: legacy });

    // Data written by the integer schema, including one id at the integer limit.
    await database.db.execute(
      sql.raw(`
        insert into core_content_revisions
          ("pluginId", "contentTypeId", "itemId", "version", "operation", "actorType", "changedFields", "snapshot")
        values
          ('@vitnode/blog', 'blog.post', 1, 1, 'create', 'system', '{}', '{}'),
          ('@vitnode/blog', 'blog.post', 2147483647, 1, 'create', 'system', '{}', '{}');
        insert into core_content_schedules
          ("pluginId", "contentTypeId", "itemId", "action", "scheduledFor")
        values ('@vitnode/blog', 'blog.post', 1, 'publish', now());
        insert into core_content_slug_history
          ("pluginId", "contentTypeId", "itemId", "slug", "path")
        values ('@vitnode/blog', 'blog.post', 1, 'hello', '/hello');
      `),
    );

    statements = await generateMigration(
      legacy(await generateDrizzleJson(schema)),
      await generateDrizzleJson(schema),
    );
    for (const statement of statements) {
      await database.db.execute(sql.raw(statement));
    }
  }, 60_000);

  afterAll(async () => {
    await database?.drop();
  });

  it("changes exactly the itemId columns, each with a USING cast", async () => {
    const all = await generateMigration(
      legacy(await generateDrizzleJson(withSearch)),
      await generateDrizzleJson(withSearch),
    );

    expect(statements).toHaveLength(3);
    expect(all).toHaveLength(4);
    for (const table of SHARED_TABLES) {
      expect(all).toContainEqual(
        expect.stringMatching(
          new RegExp(
            `ALTER TABLE "${table}" ALTER COLUMN "itemId" SET DATA TYPE varchar\\(64\\) USING "itemId"::varchar\\(64\\)`,
          ),
        ),
      );
    }
  });

  it("keeps every existing row, its id now the same digits as text", async () => {
    expect(
      await rows(
        database,
        `select "itemId" from core_content_revisions order by id`,
      ),
    ).toEqual([{ itemId: "1" }, { itemId: "2147483647" }]);
    for (const table of SHARED_TABLES.slice(1, 3)) {
      expect(await rows(database, `select "itemId" from ${table}`)).toEqual([
        { itemId: "1" },
      ]);
    }
  });

  it("still enforces the uniques that include the item", async () => {
    await expect(
      database.db.execute(
        sql.raw(`
          insert into core_content_revisions
            ("pluginId", "contentTypeId", "itemId", "version", "operation", "actorType", "changedFields", "snapshot")
          values ('@vitnode/blog', 'blog.post', '1', 1, 'create', 'system', '{}', '{}')
        `),
      ),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
    await expect(
      database.db.execute(
        sql.raw(`
          insert into core_content_schedules ("pluginId", "contentTypeId", "itemId", "action", "scheduledFor")
          values ('@vitnode/blog', 'blog.post', '1', 'publish', now())
        `),
      ),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });

  it("accepts a uuid and a bigint key beside them", async () => {
    await database.db.execute(
      sql.raw(`
        insert into core_content_slug_history ("pluginId", "contentTypeId", "itemId", "slug", "path")
        values
          ('@vitnode/example', 'example.tag', '0198f6f7-d4a2-7ce1-a2ee-4f5f1f2f3a4b', 'tag', '/tags/tag'),
          ('@vitnode/example', 'example.event', '9223372036854775807', 'event', '/events/event')
      `),
    );

    expect(
      await rows(
        database,
        `select "itemId" from core_content_slug_history where "contentTypeId" like 'example.%' order by "contentTypeId"`,
      ),
    ).toEqual([
      { itemId: "9223372036854775807" },
      { itemId: "0198f6f7-d4a2-7ce1-a2ee-4f5f1f2f3a4b" },
    ]);
  });
});

describe("the legacy snapshot", () => {
  it("differs from the current one only in the shared itemId columns", async () => {
    const current = await generateDrizzleJson(withSearch);
    const changed = current.ddl.filter(
      (entry, index) =>
        JSON.stringify(entry) !== JSON.stringify(legacy(current).ddl[index]),
    );

    expect(
      changed.map(entry =>
        entry.entityType === "columns" ? `${entry.table}.${entry.name}` : "",
      ),
    ).toEqual(SHARED_TABLES.map(table => `${table}.itemId`));
  });
});
