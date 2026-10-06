// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseHandle, DatabaseServices } from "../db/database";
import type { LocalMigration } from "../db/migration-state";

import { RuntimeError, UserError } from "../errors";
import { createScriptedPrompter, createTestContext } from "../testing";
import {
  runDbGenerateCommand,
  runDbMigrateCommand,
  runDbPushCommand,
  runDbStatusCommand,
} from "./db";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vitnode-db-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "api" }));
  writeFileSync(join(root, "drizzle.config.ts"), "export default {};\n");
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

const migration = (name: string): LocalMigration => ({
  folderMillis: 0,
  hash: name,
  name,
});

interface FakeDatabase {
  applied: string[];
  closed: number;
  kitCalls: string[][];
  services: DatabaseServices;
}

/**
 * Everything outside the process, faked at the seam the commands use:
 * drizzle-kit's JSON answers, the migrations on disk, the journal table.
 */
const fakeDatabase = ({
  applyError,
  journal = [],
  kit = {},
  local = [],
  reachable = true,
}: {
  applyError?: Error;
  journal?: string[];
  kit?: Record<string, unknown>;
  local?: LocalMigration[];
  reachable?: boolean;
} = {}): FakeDatabase => {
  const state: FakeDatabase = {
    applied: [...journal],
    closed: 0,
    kitCalls: [],
    services: undefined as unknown as DatabaseServices,
  };
  const folders = local.map(m => m.name);

  const handle: DatabaseHandle = {
    apply: async () => {
      await Promise.resolve();
      if (applyError) throw applyError;
      state.applied = local.map(m => m.name);
    },
    close: async () => {
      await Promise.resolve();
      state.closed += 1;
    },
    location: "vitnode @ localhost:5432",
    ping: async () => {
      await Promise.resolve();
      if (!reachable) throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
    },
    query: async query =>
      await Promise.resolve(
        query.includes("information_schema")
          ? [{ column_name: "name" }]
          : state.applied.map(name => ({ created_at: 0, hash: name, name })),
      ),
  };

  state.services = {
    drizzleConfig: async () =>
      await Promise.resolve({
        dialect: "postgresql",
        migrationsFolder: join(root, "migrations"),
        migrationsSchema: "drizzle",
        migrationsTable: "__drizzle_migrations",
      }),
    drizzleKit: async args => {
      await Promise.resolve();
      state.kitCalls.push([...args]);
      const key = args[0] ?? "";
      const explainKey = args.includes("--explain") ? `${key} --explain` : key;
      if (key === "generate" && !args.includes("--explain"))
        folders.push("0003_notifications");
      const answer = kit[explainKey] ?? { status: "no_changes" };

      return { code: 0, output: `noise\n${JSON.stringify(answer)}\n` };
    },
    listMigrationFolders: () => [...folders],
    open: async () => await Promise.resolve(handle),
    readLocalMigrations: async () => await Promise.resolve(local),
  };

  return state;
};

const context = (options: Parameters<typeof createTestContext>[0] = {}) =>
  createTestContext({ cwd: root, ...options });

describe("vitnode db generate", () => {
  it("shows the schema changes, then generates the migration", async () => {
    const db = fakeDatabase({
      kit: {
        "generate --explain": {
          statements: [
            { table: { name: "notifications" }, type: "create_table" },
            {
              column: { name: "notification_count", table: "users" },
              type: "add_column",
            },
          ],
          status: "ok",
        },
        generate: {
          migration_path: "migrations/0003_notifications",
          status: "ok",
        },
        up: { status: "ok" },
      },
    });
    const { context: ctx, runtime } = context();

    const code = await runDbGenerateCommand(
      ctx,
      { name: "notifications" },
      { services: () => db.services },
    );

    expect(code).toBe(0);
    expect(runtime.output()).toContain("Schema changes detected");
    expect(runtime.output()).toContain("+ table notifications");
    expect(runtime.output()).toContain("+ column users.notification_count");
    expect(runtime.output()).toContain("✓ 0003_notifications");
    expect(db.kitCalls).toContainEqual([
      "generate",
      "--output",
      "json",
      "--name",
      "notifications",
    ]);
  });

  it("generates nothing when the schema matches the last migration", async () => {
    const db = fakeDatabase({
      kit: { "generate --explain": { status: "no_changes" } },
    });
    const { context: ctx, runtime } = context();

    await runDbGenerateCommand(ctx, {}, { services: () => db.services });

    expect(runtime.output()).toContain(
      "No schema changes - nothing to generate.",
    );
    expect(
      db.kitCalls.some(
        args => args[0] === "generate" && !args.includes("--explain"),
      ),
    ).toBe(false);
  });

  it("fails with drizzle-kit's own message when it reports an error", async () => {
    const db = fakeDatabase({
      kit: {
        "generate --explain": {
          error: { message: "Snapshot conflict" },
          status: "error",
        },
      },
    });

    await expect(
      runDbGenerateCommand(
        context().context,
        {},
        { services: () => db.services },
      ),
    ).rejects.toThrow("Snapshot conflict");
  });

  it("does not wait for a rename decision nobody can make", async () => {
    const db = fakeDatabase({
      kit: {
        "generate --explain": {
          status: "missing_hints",
          unresolved: [
            {
              entity: ["public", "users", "name"],
              kind: "column",
              type: "rename_or_create",
            },
          ],
        },
      },
    });

    await expect(
      runDbGenerateCommand(
        context().context,
        {},
        { services: () => db.services },
      ),
    ).rejects.toThrow(UserError);
  });
});

describe("vitnode db migrate", () => {
  it("says the database is up to date when nothing is pending", async () => {
    const db = fakeDatabase({
      journal: ["0001_init"],
      local: [migration("0001_init")],
    });
    const { context: ctx, runtime } = context();

    expect(
      await runDbMigrateCommand(ctx, {}, { services: () => db.services }),
    ).toBe(0);
    expect(runtime.output()).toContain("✓ Database is up to date.");
    expect(db.closed).toBe(1);
  });

  it("lists pending migrations and applies them with --yes", async () => {
    const db = fakeDatabase({
      journal: ["0001_init"],
      local: [
        migration("0001_init"),
        migration("0002_notifications"),
        migration("0003_preferences"),
      ],
    });
    const { context: ctx, runtime } = context();

    await runDbMigrateCommand(
      ctx,
      { yes: true },
      { services: () => db.services },
    );
    const output = runtime.output();

    expect(output).toContain("Pending migrations");
    expect(output).toMatch(/✓ 0002_notifications\n {2}✓ 0003_preferences/);
    expect(db.applied).toEqual([
      "0001_init",
      "0002_notifications",
      "0003_preferences",
    ]);
  });

  it("refuses to apply without --yes when nobody can confirm", async () => {
    const db = fakeDatabase({ local: [migration("0001_init")] });

    await expect(
      runDbMigrateCommand(
        context().context,
        {},
        { services: () => db.services },
      ),
    ).rejects.toMatchObject({
      hint: expect.stringContaining("Pass --yes") as unknown,
    });
    expect(db.applied).toEqual([]);
    expect(db.closed).toBe(1);
  });

  it("asks in an interactive terminal, and applies nothing on no", async () => {
    const db = fakeDatabase({ local: [migration("0001_init")] });
    const prompter = createScriptedPrompter({ confirm: [false] });
    const { context: ctx, runtime } = context({ interactive: true, prompter });

    expect(
      await runDbMigrateCommand(ctx, {}, { services: () => db.services }),
    ).toBe(0);
    expect(prompter.asked).toEqual(["Apply 1 migration?"]);
    expect(runtime.output()).toContain("Cancelled - nothing was applied.");
    expect(db.applied).toEqual([]);
  });

  it("fails - and still closes the connection - when a migration fails", async () => {
    const db = fakeDatabase({
      applyError: new RuntimeError("Database migration failed."),
      local: [migration("0001_init")],
    });

    await expect(
      runDbMigrateCommand(
        context().context,
        { yes: true },
        { services: () => db.services },
      ),
    ).rejects.toThrow("Database migration failed.");
    expect(db.closed).toBe(1);
  });
});

describe("vitnode db status", () => {
  it("reports a connected database and its migrations", async () => {
    const db = fakeDatabase({
      journal: ["0001_init"],
      local: [migration("0001_init"), migration("0002_notifications")],
    });
    const { context: ctx, runtime } = context();

    expect(
      await runDbStatusCommand(ctx, {}, { services: () => db.services }),
    ).toBe(0);
    const output = runtime.output();

    expect(output).toMatch(/Provider\s+PostgreSQL/);
    expect(output).toMatch(/Database\s+vitnode @ localhost:5432/);
    expect(output).toMatch(/Status\s+● connected/);
    expect(output).toMatch(/Applied\s+1/);
    expect(output).toMatch(/Pending\s+1/);
    expect(output).toContain("○ 0002_notifications");
  });

  it("fails when the database cannot be reached - it never assumes", async () => {
    const db = fakeDatabase({
      local: [migration("0001_init")],
      reachable: false,
    });
    const { context: ctx, runtime } = context();

    await expect(
      runDbStatusCommand(ctx, {}, { services: () => db.services }),
    ).rejects.toThrow("Could not connect to the database.");
    expect(runtime.output()).toMatch(/Status\s+○ unreachable/);
  });

  it("refuses to run in a project without a database", async () => {
    rmSync(join(root, "drizzle.config.ts"));

    await expect(runDbStatusCommand(context().context, {})).rejects.toThrow(
      "does not own a database",
    );
  });
});

describe("vitnode db push", () => {
  const changes = {
    statements: [
      { table: { name: "notifications" }, type: "create_table" },
      {
        index: { name: "notifications_user_id_idx", table: "notifications" },
        type: "create_index",
      },
    ],
    status: "ok",
  };

  it("shows the changes and pushes them in development", async () => {
    const db = fakeDatabase({
      kit: { push: { status: "ok" }, "push --explain": changes },
    });
    const { context: ctx, runtime } = context();

    expect(
      await runDbPushCommand(
        ctx,
        { yes: true },
        { services: () => db.services },
      ),
    ).toBe(0);
    const output = runtime.output();

    expect(output).toContain(
      "! Direct schema synchronization is intended for development.",
    );
    expect(output).toContain("+ table notifications");
    expect(output).toContain("+ index notifications.notifications_user_id_idx");
    expect(output).toContain("✓ Schema pushed.");
    expect(db.kitCalls).toContainEqual(["push", "--output", "json"]);
  });

  it("refuses to push when NODE_ENV is production, before touching the database", async () => {
    const db = fakeDatabase();
    const { context: ctx } = context({ env: { NODE_ENV: "production" } });

    await expect(
      runDbPushCommand(ctx, { yes: true }, { services: () => db.services }),
    ).rejects.toThrow("NODE_ENV is production");
    expect(db.kitCalls).toEqual([]);
  });

  it("pushes in production only with --force", async () => {
    const db = fakeDatabase({
      kit: { push: { status: "ok" }, "push --explain": changes },
    });
    const { context: ctx } = context({ env: { NODE_ENV: "production" } });

    expect(
      await runDbPushCommand(
        ctx,
        { force: true, yes: true },
        { services: () => db.services },
      ),
    ).toBe(0);
  });

  it("names data loss and refuses it from a script without --accept-data-loss", async () => {
    const db = fakeDatabase({
      kit: {
        "push --explain": {
          status: "missing_hints",
          unresolved: [
            {
              entity: ["public", "zz"],
              kind: "table",
              reason: "non_empty",
              type: "confirm_data_loss",
            },
          ],
        },
      },
    });
    const original = db.services.drizzleKit;
    db.services.drizzleKit = async (args, options) =>
      args.includes("--hints")
        ? {
            code: 0,
            output: JSON.stringify({
              statements: [{ table: { name: "zz" }, type: "drop_table" }],
              status: "ok",
            }),
          }
        : original(args, options);
    const { context: ctx, runtime } = context();

    await expect(
      runDbPushCommand(ctx, { yes: true }, { services: () => db.services }),
    ).rejects.toThrow("These changes delete data.");
    expect(
      db.kitCalls.some(
        args => args[0] === "push" && !args.includes("--explain"),
      ),
    ).toBe(false);
    expect(runtime.output()).toContain("Data loss");
    expect(runtime.output()).toContain("table zz (non empty)");
  });

  it("confirms data loss explicitly, by name, instead of with a blanket --force", async () => {
    const hint = {
      entity: ["public", "zz"],
      kind: "table",
      reason: "non_empty",
      type: "confirm_data_loss",
    };
    const db = fakeDatabase({
      kit: {
        push: { status: "ok" },
        "push --explain": { status: "missing_hints", unresolved: [hint] },
      },
    });
    // The second explain - with the hint - returns the statements.
    const original = db.services.drizzleKit;
    db.services.drizzleKit = async (args, options) =>
      args.includes("--hints") && args.includes("--explain")
        ? {
            code: 0,
            output: JSON.stringify({
              statements: [{ table: { name: "zz" }, type: "drop_table" }],
              status: "ok",
            }),
          }
        : original(args, options);

    const { context: ctx, runtime } = context();
    await runDbPushCommand(
      ctx,
      { acceptDataLoss: true, yes: true },
      { services: () => db.services },
    );

    const pushed = db.kitCalls.find(
      args => args[0] === "push" && !args.includes("--explain"),
    );
    expect(pushed).toContain("--hints");
    expect(pushed).not.toContain("--force");
    expect(JSON.parse(pushed?.[pushed.indexOf("--hints") + 1] ?? "[]")).toEqual(
      [{ entity: ["public", "zz"], kind: "table", type: "confirm_data_loss" }],
    );
    expect(runtime.output()).toContain("- table zz");
  });

  it("does nothing when the schema is already in sync", async () => {
    const db = fakeDatabase({
      kit: { "push --explain": { statements: [], status: "ok" } },
    });
    const { context: ctx, runtime } = context();

    await runDbPushCommand(ctx, {}, { services: () => db.services });

    expect(runtime.output()).toContain("✓ Schema is already in sync.");
  });
});
