// @vitest-environment node
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { runCli } from "./cli/index.js";
import { createFakeRuntime } from "./cli/testing.js";
import {
  databaseBootstrapSteps,
  generateDatabaseMigrations,
  initialDataForDatabase,
  languagesFromApiConfig,
  readDrizzleConfig,
  runMigrations,
  runWithMigrationLock,
  withConfigFlag,
} from "./prepare-database.js";

const scriptsRoot = import.meta.dirname;

/** A script's code, with comments removed - prose may name what code may not do. */
const codeOf = (file: string): string =>
  readFileSync(join(scriptsRoot, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const cli = codeOf("cli/commands/legacy.ts");
const program = codeOf("cli/program.ts");
const bootstrap = codeOf("prepare-database.ts");

describe("the steps of a database bootstrap", () => {
  it("generates, then applies, then seeds", () => {
    expect(
      databaseBootstrapSteps({ generate: true }).map(step => step.label),
    ).toEqual([
      "Generate migrations...",
      "Apply pending migrations...",
      "Ensure initial data...",
    ]);
  });

  /**
   * And they are the real functions rather than labels beside a reimplementation
   * - which is what stops a second migration path appearing next to this one.
   */
  it("runs the real migration and seed functions", () => {
    expect(
      databaseBootstrapSteps({ generate: true }).map(step => step.action),
    ).toEqual([
      generateDatabaseMigrations,
      runMigrations,
      initialDataForDatabase,
    ]);
  });

  it("can apply without generating, and still seeds", () => {
    const steps = databaseBootstrapSteps({ generate: false });

    expect(steps.map(step => step.label)).toEqual([
      "Apply pending migrations...",
      "Ensure initial data...",
    ]);
    expect(steps.map(step => step.action)).toEqual([
      runMigrations,
      initialDataForDatabase,
    ]);
  });

  it("always ends by ensuring initial data", () => {
    for (const generate of [true, false]) {
      const steps = databaseBootstrapSteps({ generate });

      expect(steps.at(-1)?.action).toBe(initialDataForDatabase);
      expect(steps.length).toBeGreaterThan(1);
    }
  });
});

describe("the `db:prepare` command", () => {
  it("exists", () => {
    expect(program).toContain('"db:prepare"');
  });

  /**
   * A `dev` script chains on this with `&&`, so a failed bootstrap has to be a
   * non-zero exit. The command awaits the bootstrap and does not catch: the
   * CLI's error boundary turns the throw into exit code 1.
   */
  it("awaits the bootstrap and lets a failure reach the error boundary", () => {
    const branch = cli.slice(
      cli.indexOf("runDbPrepareCommand"),
      cli.indexOf("runMigrateCommand"),
    );

    expect(branch).toMatch(/await databaseBootstrap\(/);
    expect(branch).not.toMatch(/catch/);
    expect(branch).not.toMatch(/\bvoid\s+databaseBootstrap/);
  });

  it("exits non-zero when the bootstrap cannot run", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "vitnode-db-prepare-"));
    const runtime = createFakeRuntime({ cwd });

    try {
      expect(await runCli(["db:prepare"], runtime)).toBe(1);
      expect(runtime.errors()).toContain(
        "Config file not found: src/vitnode.api.config.ts",
      );
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("shares one implementation with `migrate`", () => {
    const branch = cli.slice(
      cli.indexOf("runMigrateCommand"),
      cli.indexOf("runI18nCheckCommand"),
    );

    expect(branch).toMatch(/await databaseBootstrap\(/);
    // The one thing `migrate --generate` does that the bootstrap does not.
    expect(branch).toMatch(/await generateDatabaseMigrations\(\)/);
    expect(cli.match(/await runMigrations\(\)/g)).toBeNull();
    expect(cli.match(/await initialDataForDatabase\(\)/g)).toBeNull();
  });

  it("no longer offers `init` or a `--web` no-op", () => {
    expect(program).not.toContain('"init"');
    expect(cli).not.toContain("prepareDatabase");
    expect(bootstrap).not.toContain('"--web"');
    expect(bootstrap).not.toContain("prepareDatabase");
  });
});

describe("what decides whether work is pending", () => {
  it("keeps no first-run marker of its own", () => {
    for (const source of [cli, bootstrap]) {
      expect(source).not.toMatch(/\.init-created|\.migrations-done|\.migrated/);
      expect(source).not.toMatch(/VITNODE_(?:INITIALIZED|MIGRATED|DB_READY)/);
      expect(source).not.toMatch(/writeFile[^)]*(?:marker|sentinel|stamp)/i);
    }
  });

  it("reads the migrations folder - and journal table - from drizzle.config.ts", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitnode-drizzle-config-"));

    try {
      // The fallback stays a fallback: drizzle's own defaults.
      expect(await readDrizzleConfig(root)).toEqual({
        dialect: null,
        migrationsFolder: join(root, "migrations"),
        migrationsSchema: "drizzle",
        migrationsTable: "__drizzle_migrations",
      });

      writeFileSync(
        join(root, "drizzle.config.ts"),
        'export default { dialect: "postgresql", out: "./db/migrations/", migrations: { schema: "ops", table: "journal" } };\n',
      );

      expect(await readDrizzleConfig(root)).toEqual({
        dialect: "postgresql",
        migrationsFolder: join(root, "db", "migrations"),
        migrationsSchema: "ops",
        migrationsTable: "journal",
      });
    } finally {
      rmSync(root, { force: true, recursive: true });
    }

    expect(bootstrap).toMatch(
      /migrate\(config\.dbProvider, \{\s+migrationsFolder,\s+migrationsSchema,\s+migrationsTable,/,
    );
  });

  it("reads whichever drizzle.config extension the project uses, and names it to drizzle-kit", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitnode-drizzle-mts-"));

    try {
      writeFileSync(
        join(root, "drizzle.config.mts"),
        'export default { out: "./db", migrations: { table: "journal" } };\n',
      );

      expect(await readDrizzleConfig(root)).toMatchObject({
        migrationsFolder: join(root, "db"),
        migrationsTable: "journal",
      });
      expect(withConfigFlag(["generate", "--explain"], root)).toEqual([
        "generate",
        "--config",
        "drizzle.config.mts",
        "--explain",
      ]);
      expect(withConfigFlag(["push", "--config", "x.ts"], root)).toEqual([
        "push",
        "--config",
        "x.ts",
      ]);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("ensures text-search configs before applying migrations", () => {
    const applyStep = bootstrap.slice(
      bootstrap.indexOf("export const runMigrations"),
    );

    expect(applyStep.indexOf("ensureSearchTextConfigs")).toBeGreaterThan(-1);
    expect(applyStep.indexOf("ensureSearchTextConfigs")).toBeLessThan(
      applyStep.indexOf("await migrate("),
    );
    expect(bootstrap).toContain("COPY = simple");
  });

  /** A fresh database needs more than tables. */
  it.each([
    ["languages", "core_languages"],
    ["roles", "core_roles"],
    ["role names", "core_languages_words"],
    ["moderator permissions", "core_moderators_permissions"],
    ["admin permissions", "core_admin_permissions"],
  ])("seeds %s", (_label, table) => {
    const seed = bootstrap.slice(
      bootstrap.indexOf("export const initialDataForDatabase"),
      bootstrap.indexOf("export interface DatabaseBootstrapStep"),
    );

    expect(seed).toContain(table);
  });

  /** Idempotent, which is what makes running it every time safe. */
  it("seeds idempotently", () => {
    expect(bootstrap).toContain("onConflictDoNothing");
    expect(bootstrap).toMatch(/roleCount\.count === 0/);
  });
});

describe("the languages a fresh database is seeded with", () => {
  it("reads no frontend config", () => {
    const seed = bootstrap.slice(
      bootstrap.indexOf("export const initialDataForDatabase"),
      bootstrap.indexOf("export interface DatabaseBootstrapStep"),
    );

    expect(seed).not.toContain('type: "config"');
    expect(seed).not.toContain("webConfig");
    expect(seed).toContain("languagesFromApiConfig(config.i18n)");
    // And nothing anywhere reaches for a sibling application.
    expect(bootstrap).not.toMatch(/\.\.\/(?:web|api)\b/);
    expect(bootstrap).not.toContain("vitnode.config.ts");
  });

  it("falls back to English when the API declares no locales", () => {
    for (const i18n of [undefined, {}, { locales: [] }]) {
      expect(languagesFromApiConfig(i18n)).toEqual([
        {
          code: "en",
          default: true,
          name: "English (USA)",
          protected: true,
          timezone: "America/New_York",
        },
      ]);
    }
  });

  /** Every configured locale, in configuration order. */
  it("inserts every configured locale", () => {
    expect(
      languagesFromApiConfig({
        defaultLocale: "en",
        locales: [
          { code: "en", name: "English" },
          { code: "pl", name: "Polski" },
        ],
        timeZone: "UTC",
      }),
    ).toEqual([
      {
        code: "en",
        default: true,
        name: "English",
        protected: true,
        timezone: "UTC",
      },
      {
        code: "pl",
        default: false,
        name: "Polski",
        protected: false,
        timezone: "UTC",
      },
    ]);
  });

  it("marks the configured default, whichever it is", () => {
    const rows = languagesFromApiConfig({
      defaultLocale: "pl",
      locales: [
        { code: "en", name: "English" },
        { code: "pl", name: "Polski" },
      ],
    });

    expect(rows.filter(row => row.default).map(row => row.code)).toEqual([
      "pl",
    ]);
    expect(rows.filter(row => row.protected).map(row => row.code)).toEqual([
      "pl",
    ]);
  });

  it("always leaves exactly one default", () => {
    for (const i18n of [
      { locales: [{ code: "pl", name: "Polski" }] },
      { defaultLocale: "de", locales: [{ code: "pl", name: "Polski" }] },
      {
        locales: [
          { code: "en", name: "English" },
          { code: "pl", name: "Polski" },
        ],
      },
    ]) {
      expect(
        languagesFromApiConfig(i18n).filter(row => row.default),
      ).toHaveLength(1);
    }

    // With no `defaultLocale` and an `en` on the list, `en` is it.
    expect(
      languagesFromApiConfig({
        locales: [
          { code: "pl", name: "Polski" },
          { code: "en", name: "English" },
        ],
      }).find(row => row.default)?.code,
    ).toBe("en");
  });

  /** The installation's timezone, on every row. */
  it("propagates the configured timezone", () => {
    expect(
      languagesFromApiConfig({
        defaultLocale: "en",
        locales: [
          { code: "en", name: "English" },
          { code: "pl", name: "Polski" },
        ],
        timeZone: "Europe/Warsaw",
      }).map(row => row.timezone),
    ).toEqual(["Europe/Warsaw", "Europe/Warsaw"]);

    // And `UTC` when an app declares locales but no zone.
    expect(
      languagesFromApiConfig({
        locales: [{ code: "en", name: "English" }],
      })[0].timezone,
    ).toBe("UTC");
  });

  it("skips disabled locales, and never seeds nothing", () => {
    expect(
      languagesFromApiConfig({
        defaultLocale: "en",
        locales: [
          { code: "en", name: "English" },
          { code: "pl", enabled: false, name: "Polski" },
        ],
      }).map(row => row.code),
    ).toEqual(["en"]);

    // Every locale disabled is not "no languages" - it is a misconfiguration,
    // and the fallback is a database that still works.
    expect(
      languagesFromApiConfig({
        locales: [{ code: "pl", enabled: false, name: "Polski" }],
      }).map(row => row.code),
    ).toEqual(["en"]);
  });

  it("adds a locale without disturbing the ones already there", () => {
    const before = languagesFromApiConfig({
      defaultLocale: "en",
      locales: [{ code: "en", name: "English" }],
    });
    const after = languagesFromApiConfig({
      defaultLocale: "en",
      locales: [
        { code: "en", name: "English" },
        { code: "pl", name: "Polski" },
      ],
    });

    expect(after.slice(0, 1)).toEqual(before);
    expect(bootstrap).toMatch(
      /onConflictDoNothing\(\{ target: core_languages\.code \}\)/,
    );
  });

  it("seeds role names under the default language, not under `en`", () => {
    const seed = bootstrap.slice(
      bootstrap.indexOf("export const initialDataForDatabase"),
      bootstrap.indexOf("export interface DatabaseBootstrapStep"),
    );

    expect(seed).toContain("languageCode: defaultLanguageCode");
    expect(seed).not.toMatch(/languageCode: "en"/);
    for (const role of ["Guest", "Member", "Moderator", "Administrator"]) {
      expect(seed).toContain(`value: "${role}"`);
    }
  });
});

describe("concurrent bootstraps are serialised", () => {
  it("takes a Postgres advisory lock around the whole bootstrap", () => {
    expect(bootstrap).toContain("withMigrationLock");
    expect(bootstrap).toContain("pg_try_advisory_lock");
    expect(bootstrap).toContain("pg_advisory_unlock");
    expect(bootstrap).toMatch(/MIGRATION_LOCK_KEY = [\d_]+;/);
  });

  it("wraps every step, not just the apply", () => {
    const fn = bootstrap.slice(
      bootstrap.indexOf("export const databaseBootstrap"),
    );
    const lock = fn.indexOf("withMigrationLock(");
    const action = fn.indexOf("step.action()");

    // Both must be *found*. `indexOf` returns -1 for absent, and -1 is less than
    // any real offset - so a bare `toBeLessThan` passes when the lock has been
    // deleted outright, which is the mutation this test exists to catch.
    expect(
      lock,
      "databaseBootstrap does not call withMigrationLock",
    ).toBeGreaterThanOrEqual(0);
    expect(action).toBeGreaterThanOrEqual(0);
    expect(lock).toBeLessThan(action);
  });

  it("opens a dedicated connection for the lock", () => {
    const open = bootstrap.slice(
      bootstrap.indexOf("const openMigrationLock"),
      bootstrap.indexOf("export const runWithMigrationLock"),
    );

    expect(open).toContain("postgres({");
    expect(open).toContain("max: 1");
    expect(open).toContain("client.end(");
  });

  /**
   * And never out of the application's. `reserve()` pins a pooled connection,
   * which is exactly the connection the migration then needs.
   */
  it("reserves nothing from the application pool", () => {
    expect(bootstrap).not.toContain(".reserve(");
    expect(bootstrap).not.toContain("session.release()");
  });

  it("waits with a deadline and says what it is waiting for", () => {
    expect(bootstrap).not.toContain("pg_advisory_lock(");
    expect(bootstrap).toMatch(/MIGRATION_LOCK_WAIT_MS = [\d_]+;/);
    expect(bootstrap).toMatch(/Timed out after/);
    expect(bootstrap).toMatch(/waiting for it to finish/);
  });

  it("degrades to unlocked rather than failing on an unknown driver", () => {
    expect(bootstrap).toMatch(/!\("shared" in options\)/);
    expect(bootstrap).toMatch(/if \(lock === null\) \{\s*await run\(\)/);
  });

  it("tolerates both spellings of “already created”, down the cause chain", () => {
    expect(bootstrap).toContain("isAlreadyCreatedError");
    expect(bootstrap).toContain('"23505"');
    expect(bootstrap).toContain('"42710"');
    expect(bootstrap).toMatch(
      /current = \(current as \{ cause\?: unknown \}\)\.cause/,
    );
  });
});

const createPool = (max: number) => {
  let inUse = 0;

  return {
    acquire: () => {
      if (inUse >= max) {
        throw new Error("pool exhausted - no connection available");
      }

      inUse += 1;

      return () => {
        inUse -= 1;
      };
    },
  };
};

const roundTrip = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0));
};

const createFakeLock = (
  pool: null | ReturnType<typeof createPool>,
  { available = true }: { available?: boolean } = {},
) => {
  const events: string[] = [];
  let release: (() => void) | null = null;

  return {
    events,
    lock: {
      close: async () => {
        events.push("close");
        release?.();
        release = null;
        await roundTrip();
      },
      tryLock: async () => {
        release ??= pool?.acquire() ?? null;
        events.push("tryLock");
        await roundTrip();

        return available;
      },
      unlock: async () => {
        events.push("unlock");
        await roundTrip();
      },
    },
  };
};

describe("holding the lock costs the application pool nothing", () => {
  it("migrates through a pool of one while the lock is held", async () => {
    const pool = createPool(1);
    const { events, lock } = createFakeLock(null);
    const ran: string[] = [];

    await runWithMigrationLock({
      initMessage: "[test]",
      lock,
      run: async () => {
        const release = pool.acquire();

        ran.push("migrated");
        await roundTrip();
        release();
      },
    });

    expect(ran).toEqual(["migrated"]);
    expect(events).toEqual(["tryLock", "unlock", "close"]);
  });

  it("would have deadlocked had the lock come out of that pool", async () => {
    const pool = createPool(1);
    const { lock } = createFakeLock(pool);

    await expect(
      runWithMigrationLock({
        initMessage: "[test]",
        lock,
        run: async () => {
          await roundTrip();
          pool.acquire()();
        },
      }),
    ).rejects.toThrow("pool exhausted");
  });

  /** Released and closed even when the work throws. */
  it("releases and closes when the bootstrap fails", async () => {
    const { events, lock } = createFakeLock(null);

    await expect(
      runWithMigrationLock({
        initMessage: "[test]",
        lock,
        run: async () => {
          await roundTrip();

          throw new Error("migration failed");
        },
      }),
    ).rejects.toThrow("migration failed");

    expect(events).toEqual(["tryLock", "unlock", "close"]);
  });

  it("waits, says so once, and times out", async () => {
    const { events, lock } = createFakeLock(null, { available: false });
    const said: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation(message => {
      said.push(String(message));
    });
    // Each poll advances the clock past the two-minute deadline.
    let now = Date.now();
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);

    try {
      await expect(
        runWithMigrationLock({
          initMessage: "[test]",
          lock,
          run: async () => {
            await roundTrip();

            throw new Error("must not run");
          },
          sleep: async () => {
            now += 60_000;
            await roundTrip();
          },
        }),
      ).rejects.toThrow(/Timed out after 120s/);
    } finally {
      log.mockRestore();
      clock.mockRestore();
    }

    // Never acquired, so never released - but the session is closed regardless.
    expect(events.at(-1)).toBe("close");
    expect(events).not.toContain("unlock");
    expect(
      said.filter(line => line.includes("waiting for it to finish")),
    ).toHaveLength(1);
  });

  /** No lock at all still runs the bootstrap - an unknown driver, unlocked. */
  it("runs unlocked when there is no lock to take", async () => {
    const ran: string[] = [];

    await runWithMigrationLock({
      initMessage: "[test]",
      lock: null,
      run: async () => {
        ran.push("migrated");
        await roundTrip();
      },
    });

    expect(ran).toEqual(["migrated"]);
  });
});

describe("the bootstrap and the plugin runtime are separate", () => {
  it("prepares no plugin and writes no route file", () => {
    for (const source of [cli, bootstrap]) {
      expect(source).not.toContain("preparePluginsFiles");
      expect(source).not.toContain("prepare-plugins");
      expect(source).not.toContain("copyDirectoryRecursive");
      expect(source).not.toMatch(/src\/routes|src\/app|\[locale\]|@breadcrumb/);
      expect(source).not.toMatch(/\.gen\.tsx?\b/);
    }
  });

  it("has no route-copying module left beside it", () => {
    for (const deleted of [
      "prepare-plugins-files.ts",
      "plugin.ts",
      "legacy-route-overlap.ts",
    ]) {
      expect(existsSync(join(scriptsRoot, deleted))).toBe(false);
    }
  });
});
