// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { AppliedMigration, LocalMigration } from "./migration-state";

import { computeMigrationState, readJournal } from "./migration-state";
import {
  formatHintEntity,
  parseDrizzleJson,
  summarizeStatement,
} from "./statements";

const local = (name: string, hash = `hash-${name}`): LocalMigration => ({
  folderMillis: Number(name.slice(0, 4)),
  hash,
  name,
});

describe("computeMigrationState", () => {
  it("is pending exactly when the journal has no row with the folder's name", () => {
    const state = computeMigrationState(
      [local("0001_init"), local("0002_users"), local("0003_posts")],
      [{ createdAt: 1, hash: "hash-0001_init", name: "0001_init" }],
    );

    expect(state.applied.map(m => m.name)).toEqual(["0001_init"]);
    expect(state.pending.map(m => m.name)).toEqual([
      "0002_users",
      "0003_posts",
    ]);
  });

  it("reports an applied migration whose file changed afterwards", () => {
    const state = computeMigrationState(
      [local("0001_init", "new-hash")],
      [{ createdAt: 1, hash: "old-hash", name: "0001_init" }],
    );

    expect(state.modified).toEqual(["0001_init"]);
    expect(state.pending).toEqual([]);
  });

  it("reports a journal row without a migration on disk", () => {
    expect(
      computeMigrationState(
        [],
        [{ createdAt: 9, hash: "h", name: "0009_gone" }],
      ).missingLocally,
    ).toEqual(["0009_gone"]);
  });

  it("matches an old journal without names by timestamp or hash", () => {
    const journal: AppliedMigration[] = [
      { createdAt: 1, hash: "unrelated", name: null },
      { createdAt: null, hash: "hash-0002_users", name: null },
    ];

    expect(
      computeMigrationState([local("0001_init"), local("0002_users")], journal)
        .pending,
    ).toEqual([]);
  });
});

describe("readJournal", () => {
  it("reads nothing - and creates nothing - when the journal table does not exist", async () => {
    const queries: string[] = [];
    const journal = await readJournal(
      async query => {
        await Promise.resolve();
        queries.push(query);

        return [];
      },
      { schema: "drizzle", table: "__drizzle_migrations" },
    );

    expect(journal).toEqual([]);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(
      /^SELECT column_name FROM information_schema\.columns/,
    );
  });

  it("reads names when the table has them, and copes when it does not", async () => {
    const run = async (columns: string[]) =>
      readJournal(
        async query =>
          await Promise.resolve(
            query.includes("information_schema")
              ? columns.map(column_name => ({ column_name }))
              : [{ created_at: "1700000000000", hash: "h", name: "0001_init" }],
          ),
        { schema: "drizzle", table: "__drizzle_migrations" },
      );

    expect(await run(["id", "hash", "created_at", "name"])).toEqual([
      { createdAt: 1_700_000_000_000, hash: "h", name: "0001_init" },
    ]);
    expect((await run(["id", "hash", "created_at"]))[0].name).toBeNull();
  });

  it("refuses a table name it would have to quote", async () => {
    await expect(
      readJournal(async () => await Promise.resolve([]), {
        schema: "drizzle",
        table: 'x"; DROP TABLE users; --',
      }),
    ).rejects.toThrow("Invalid migrations table");
  });
});

describe("drizzle-kit JSON output", () => {
  it("reads the result line among its other output", () => {
    expect(
      parseDrizzleJson(
        'Reading config file\n[✓] Pulling schema\n{"status":"no_changes","dialect":"postgresql"}\n',
      ),
    ).toEqual({ dialect: "postgresql", status: "no_changes" });
  });

  it("returns null when there is no result to read", () => {
    expect(parseDrizzleJson("Error: something broke\n")).toBeNull();
  });

  it.each([
    [
      {
        table: { name: "notifications", schema: "public" },
        type: "create_table",
      },
      "+",
      "table",
      "notifications",
    ],
    [
      { table: { name: "zz", schema: "public" }, type: "drop_table" },
      "-",
      "table",
      "zz",
    ],
    [
      {
        column: {
          name: "notification_count",
          schema: "public",
          table: "users",
        },
        type: "add_column",
      },
      "+",
      "column",
      "users.notification_count",
    ],
    [
      {
        index: { name: "notifications_user_id_idx", table: "notifications" },
        type: "create_index",
      },
      "+",
      "index",
      "notifications.notifications_user_id_idx",
    ],
    [
      { fk: { name: "posts_user_fk", table: "posts" }, type: "create_fk" },
      "+",
      "foreign key",
      "posts.posts_user_fk",
    ],
    [
      { table: { name: "audit", schema: "logs" }, type: "alter_table" },
      "~",
      "table",
      "logs.audit",
    ],
    [
      { from: { name: "a" }, to: { name: "b" }, type: "rename_table" },
      "~",
      "table",
      "a → b",
    ],
  ])("summarizes %j", (statement, sign, kind, name) => {
    expect(summarizeStatement(statement)).toEqual({ kind, name, sign });
  });

  it("formats a hint entity without the default schema", () => {
    expect(formatHintEntity(["public", "core_roles", "zz_tmp"])).toBe(
      "core_roles.zz_tmp",
    );
    expect(formatHintEntity(["auth", "users"])).toBe("auth.users");
  });
});
