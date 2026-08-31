// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { cliCommandNames, isCliCommandName } from "./cli-arguments.js";
import { CLI_COMMANDS, helpCommandNames, renderHelp } from "./cli-commands.js";
import {
  databaseBootstrapSteps,
  generateDatabaseMigrations,
  initialDataForDatabase,
  isAlreadyCreatedError,
  languagesFromApiConfig,
  migrationsFolderFrom,
  resolveLocalBin,
  runMigrations,
  runWithMigrationLock,
} from "./prepare-database.js";

/**
 * The development bootstrap runs to completion **before** anything serves a
 * request, and it is the database's business alone.
 *
 * Pure and static: the step list, the seed's language rules, the lock's
 * decisions and the CLI's command table are all called as the functions and read
 * as the data they are. No Postgres, no Hono, no dev server - a test that needed
 * a database could not tell the difference between "migrated first" and
 * "migrated eventually", which is the only distinction here that matters.
 */

const scriptsRoot = import.meta.dirname;

/** A script's code, with comments removed - prose may name what code may not do. */
const codeOf = (file: string): string =>
  readFileSync(join(scriptsRoot, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const cli = codeOf("scripts.ts");
const bootstrap = codeOf("prepare-database.ts");

describe("the steps of a database bootstrap", () => {
  /**
   * The order *is* the contract, and each step depends on the one before it: a
   * migration cannot be applied before it is generated, and the seed inserts
   * into `core_roles` and `core_languages`, which do not exist until the
   * migrations have run. A reordering here is a fresh-database crash.
   */
  it("generates, then applies, then seeds", () => {
    expect(databaseBootstrapSteps({ generate: true })).toEqual([
      { action: generateDatabaseMigrations, label: "Generate migrations..." },
      { action: runMigrations, label: "Apply pending migrations..." },
      { action: initialDataForDatabase, label: "Ensure initial data..." },
    ]);
  });

  /**
   * Generation is a flag because applying committed migrations without writing
   * new ones is a real request - a deployment step, a CI check - but the seed is
   * not optional in either. A fresh database with tables and no `Administrator`
   * role cannot be administered.
   */
  it("can apply without generating, and still seeds", () => {
    expect(databaseBootstrapSteps({ generate: false })).toEqual([
      { action: runMigrations, label: "Apply pending migrations..." },
      { action: initialDataForDatabase, label: "Ensure initial data..." },
    ]);
  });
});

describe("the two database commands are one implementation", () => {
  /**
   * `db:prepare` is the development bootstrap a `dev` script waits for;
   * `migrate` is the same work under the name the documentation and every
   * deployment guide spell. Neither reimplements a step, which is what stops the
   * two names drifting into two behaviours.
   */
  it("both delegate to `databaseBootstrap`", () => {
    for (const command of ["db:prepare", "migrate"]) {
      expect(cli).toContain(`case "${command}":`);
    }

    expect(cli.match(/databaseBootstrap\(\{ initMessage \}\)/g)).toHaveLength(
      2,
    );
    expect(cli).not.toMatch(/\brunMigrations\(/);
    expect(cli).not.toMatch(/\binitialDataForDatabase\(/);
  });

  /** The one thing only `migrate` does. */
  it("gives migration generation to `migrate --generate` alone", () => {
    expect(cli).toMatch(/args\.includes\("--generate"\)/);
    expect(cli).toContain("generateDatabaseMigrations");

    const prepare = cli.slice(
      cli.indexOf('case "db:prepare":'),
      cli.indexOf('case "dev":'),
    );

    expect(prepare).not.toContain("--generate");
  });

  /**
   * `await`ed, and inside a `try`: a `dev` script chains on `&&`, so a failed
   * step has to be an exit code this process chose rather than an unhandled
   * rejection Node happens to crash on.
   */
  it("awaits the bootstrap and exits non-zero when it throws", () => {
    const runner = cli.slice(
      cli.indexOf("const runDatabaseCommand"),
      cli.indexOf("switch (command)"),
    );

    expect(runner).toMatch(/await run\(\)/);
    expect(runner).toMatch(/try\s*\{/);
    expect(runner).toMatch(/catch/);
    expect(runner).toMatch(/process\.exit\(1\)/);
    expect(cli).toMatch(/await runDatabaseCommand\(/);
    expect(cli).not.toMatch(
      /\bvoid\s+(?:databaseBootstrap|runDatabaseCommand)/,
    );
  });
});

describe("the CLI's command surface", () => {
  /**
   * The permanent commands, and no more than those.
   *
   * Read off `--help`'s table rather than the parser's, because the parser's
   * list is asserted in `cli-arguments.test.ts` and the failure worth catching
   * here is the other one: a command that validates and dispatches but that
   * `vitnode --help` never mentions, so nobody finds it.
   */
  it("offers exactly the commands VitNode supports", () => {
    expect(helpCommandNames().sort()).toEqual([
      "build",
      "db:prepare",
      "dev",
      "i18n:check",
      "i18n:create",
      "i18n:delete",
      "i18n:update",
      "i18n:update:ai",
      "migrate",
    ]);
  });

  /**
   * `init`, `prepare-plugins` and `plugin --w` were the route copier's entry
   * points and the pre-TanStack project setup. All three are gone, and a
   * generated project that still called one would fail on its first `dev`.
   */
  it.each(["init", "prepare-plugins", "plugin", "migrate:web"])(
    "does not answer to `%s`",
    removed => {
      expect(isCliCommandName(removed)).toBe(false);
      expect(cli).not.toContain(`case "${removed}"`);
    },
  );

  /** Every command in the table is dispatched, and every branch is in the table. */
  it("dispatches every command it lists, and lists every one it dispatches", () => {
    const dispatched = [...cli.matchAll(/case "([^"]+)":/g)].map(
      match => match[1],
    );

    expect(dispatched.sort()).toEqual(cliCommandNames().sort());
  });

  /**
   * The help text is generated from the same table, so it cannot describe a CLI
   * that does not exist - and it is where the difference between the two
   * database commands is spelled out for somebody who is not reading this file.
   */
  it("renders help from the table", () => {
    const help = renderHelp();

    for (const command of CLI_COMMANDS) {
      expect(help).toContain(command.name);
      expect(help).toContain(command.summary);
    }
    expect(help).toContain("migrate --generate");
  });

  /**
   * Somebody who does not know the commands asks in one of three ways, and all
   * three end at the list. `--help` and a bare `vitnode` are questions rather
   * than commands, so they print it and exit 0 - above `parseCliArguments`,
   * which refuses both as the non-commands they are. A name that is not a
   * command is the parser's refusal, and the list follows it.
   */
  it("answers `--help`, a bare invocation and a bad one with the list", () => {
    expect(cli).toMatch(/name === undefined \|\| HELP_FLAGS\.includes\(name\)/);
    expect(cli.indexOf("HELP_FLAGS.includes")).toBeLessThan(
      cli.indexOf("parseCliArguments("),
    );

    const refusal = cli.slice(
      cli.indexOf("if (!parsed.ok)"),
      cli.indexOf("const { args, command }"),
    );

    expect(refusal).toContain("parsed.message");
    expect(refusal).toContain("renderHelp()");
    expect(refusal).toMatch(/process\.exit\(1\)/);
  });
});

describe("what decides whether work is pending", () => {
  /**
   * Drizzle's own `__drizzle_migrations` table, and nothing else.
   *
   * A marker file, a `.init-created` sentinel or an env flag would be a second
   * source of truth that a fresh clone, a wiped Docker volume or a colleague's
   * machine disagrees with immediately - and the disagreement is silent, because
   * the marker says "done" while the database is empty. So there is no first-run
   * state machine anywhere: the bootstrap is safe to run before *every* dev
   * start because every step is idempotent.
   */
  it("keeps no first-run marker of its own", () => {
    for (const source of [cli, bootstrap]) {
      expect(source).not.toMatch(/\.init-created|\.migrations-done|\.migrated/);
      expect(source).not.toMatch(/VITNODE_(?:INITIALIZED|MIGRATED|DB_READY)/);
      expect(source).not.toMatch(/writeFile[^)]*(?:marker|sentinel|stamp)/i);
    }
  });

  /**
   * The migrator is Drizzle's, in-process, against the folder the app's own
   * `drizzle.config.ts` names - so the bootstrap and `drizzle-kit generate`
   * cannot point at different directories.
   */
  it.each([
    ["a default export", { default: { out: "./db/out" } }, "./db/out"],
    ["a bare export", { out: "./db/out" }, "./db/out"],
    [
      "the default export first",
      { default: { out: "./a" }, out: "./b" },
      "./a",
    ],
    ["no config at all", {}, "./migrations"],
    ["an empty `out`", { out: "" }, "./migrations"],
    ["a non-string `out`", { out: 7 }, "./migrations"],
  ])("reads the migrations folder from %s", (_label, loaded, expected) => {
    expect(migrationsFolderFrom(loaded)).toBe(expected);
  });

  it("hands that folder to the in-process migrator", () => {
    expect(bootstrap).toContain("drizzle.config.ts");
    expect(bootstrap).toMatch(
      /migrate\(config\.dbProvider, \{ migrationsFolder/,
    );
  });

  /**
   * Provisioned before the migrations that need them, not after: the generated
   * `search_vector` column resolves every `regconfig` branch at column-creation
   * time, so a missing text-search dictionary fails the migration that creates
   * the column rather than a later query.
   */
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

  /**
   * And the tolerance the concurrent case exposed: the loser of a race on
   * `CREATE TEXT SEARCH CONFIGURATION` gets `23505`, not the `42710` a reader
   * would expect, and the code sits one wrapper deep inside Drizzle's
   * `DrizzleQueryError`.
   */
  it.each([
    ["a bare unique violation", { code: "23505" }],
    ["a bare duplicate object", { code: "42710" }],
    ["one wrapper deep", { cause: { code: "23505" } }],
    ["two wrappers deep", { cause: { cause: { code: "42710" } } }],
  ])("tolerates %s", (_label, error) => {
    expect(isAlreadyCreatedError(error)).toBe(true);
  });

  it.each([
    ["a syntax error", { code: "42601" }],
    ["no code at all", new Error("boom")],
    ["a numeric code", { code: 23505 }],
    ["nothing", undefined],
    [
      "a cycle",
      (() => {
        const error: { cause?: unknown } = {};
        error.cause = error;

        return error;
      })(),
    ],
  ])("rethrows %s", (_label, error) => {
    expect(isAlreadyCreatedError(error)).toBe(false);
  });
});

describe("migration generation runs the local drizzle-kit", () => {
  /**
   * Resolved out of `node_modules/.bin` rather than run through a package
   * manager. `npm run drizzle-kit` needs npm installed *and* a `drizzle-kit`
   * script in the app's `package.json`; a bun-only machine has neither, and a
   * generated project that dropped the alias would fail on its first `dev`.
   */
  it("finds the binary beside the app", () => {
    const found = "/repo/apps/api/node_modules/.bin/drizzle-kit";

    expect(
      resolveLocalBin("drizzle-kit", "/repo/apps/api", {
        exists: candidate => candidate === found,
        win32: false,
      }),
    ).toBe(found);
  });

  /** And hoisted at the workspace root, which is where npm and bun put it. */
  it("walks up to the workspace root", () => {
    const found = "/repo/node_modules/.bin/drizzle-kit";

    expect(
      resolveLocalBin("drizzle-kit", "/repo/apps/api", {
        exists: candidate => candidate === found,
        win32: false,
      }),
    ).toBe(found);
  });

  it("stops at the filesystem root rather than looping", () => {
    expect(
      resolveLocalBin("drizzle-kit", "/repo/apps/api", {
        exists: () => false,
        win32: false,
      }),
    ).toBeNull();
  });

  it("looks for the batch file on Windows", () => {
    const found = "/repo/node_modules/.bin/drizzle-kit.cmd";

    expect(
      resolveLocalBin("drizzle-kit", "/repo/apps", {
        exists: candidate => candidate === found,
        win32: true,
      }),
    ).toBe(found);
  });

  it("asks no package manager to run it", () => {
    const generate = bootstrap.slice(
      bootstrap.indexOf("export const generateDatabaseMigrations"),
      bootstrap.indexOf("export const migrationsFolderFrom"),
    );

    expect(generate).not.toMatch(/"(?:npm|pnpm|bun|yarn)"/);
    expect(generate).toContain('resolveLocalBin("drizzle-kit"');
    expect(generate).toMatch(/\["up"\]/);
    expect(generate).toMatch(/\["generate"\]/);
  });
});

describe("the seed", () => {
  /** A fresh database needs more than tables. */
  const seed = bootstrap.slice(
    bootstrap.indexOf("export const initialDataForDatabase"),
    bootstrap.indexOf("export interface DatabaseBootstrapStep"),
  );

  it.each([
    ["languages", "core_languages"],
    ["roles", "core_roles"],
    ["role names", "core_languages_words"],
    ["moderator permissions", "core_moderators_permissions"],
    ["admin permissions", "core_admin_permissions"],
  ])("seeds %s", (_label, table) => {
    expect(seed).toContain(table);
  });

  /** Idempotent, which is what makes running it every time safe. */
  it("seeds idempotently", () => {
    expect(seed).toMatch(
      /onConflictDoNothing\(\{ target: core_languages\.code \}\)/,
    );
    expect(seed).toMatch(/roleCount\.count === 0/);
  });

  /**
   * From the API config, and from nothing else. `db:prepare` runs from the app
   * that owns the schema, where a frontend config is a sibling a filesystem walk
   * would never reach - so a lookup for one returned `null` without a word and a
   * fresh database came up with `en` alone while the site served `en` and `pl`.
   */
  it("reads no frontend config", () => {
    expect(seed).not.toContain('type: "config"');
    expect(seed).toContain("languagesFromApiConfig(config.i18n)");
    expect(bootstrap).not.toMatch(/\.\.\/(?:web|api)\b/);
    expect(bootstrap).not.toContain("vitnode.config.ts");
  });

  /**
   * And the role labels go in under whichever language is the default:
   * `languageCode` references `core_languages.code`, so a hard-coded `"en"` is a
   * foreign-key violation on the first installation that does not serve English.
   */
  it("seeds role names under the default language, not under `en`", () => {
    expect(seed).toContain("languageCode: defaultLanguageCode");
    expect(seed).not.toMatch(/languageCode: "en"/);
    for (const role of ["Guest", "Member", "Moderator", "Administrator"]) {
      expect(seed).toContain(`value: "${role}"`);
    }
  });
});

describe("the languages a fresh database is seeded with", () => {
  /**
   * With no `i18n` block, `en` - and not the API's own derived locale list,
   * which is "whatever the installed packages ship a translation for" and would
   * write a language row per installed language pack.
   */
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

  /**
   * `defaultLocale` decides which row is the default, and `protected` follows
   * it: the default language is the one the AdminCP must not let anybody delete.
   */
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

  /**
   * A default has to exist. `defaultLocale` is optional and falls back to `"en"`
   * the way the API runtime's does - but an app that does not serve English at
   * all would then have no default row, and a `core_languages` with no default
   * is a state nothing downstream can read.
   */
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

  /** The installation's timezone, on every row, and `UTC` when it declares none. */
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

    expect(
      languagesFromApiConfig({
        locales: [{ code: "en", name: "English" }],
      })[0].timezone,
    ).toBe("UTC");
  });

  /**
   * `enabled: false` is dropped, the same way `localeRoutingFromConfig` drops
   * it: a language the app has switched off should 404 rather than get a row
   * that makes it selectable in the AdminCP.
   */
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

  /**
   * Adding a locale and re-running `db:prepare` inserts the new one and leaves
   * the rest alone.
   */
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
  });
});

describe("concurrent bootstraps are serialised", () => {
  /**
   * More than one runtime legitimately gates on the bootstrap - the API, and any
   * single app that mounts the API in-process - so a monorepo `turbo dev` starts
   * two at once.
   *
   * Measured, not theorised: with the lock bypassed, two concurrent
   * `vitnode db:prepare` runs against one empty database leave one exiting 1 -
   * first on `CREATE TEXT SEARCH CONFIGURATION "polish"`, and once that is
   * tolerated, on `CREATE SCHEMA IF NOT EXISTS drizzle`. Postgres'
   * `IF NOT EXISTS` is not race-safe against a concurrent creator.
   */
  it("takes a Postgres advisory lock around the whole bootstrap", () => {
    expect(bootstrap).toContain("pg_try_advisory_lock");
    expect(bootstrap).toContain("pg_advisory_unlock");
    expect(bootstrap).toMatch(/MIGRATION_LOCK_KEY = [\d_]+;/);
  });

  /**
   * Around the *whole* bootstrap, generation included. Two concurrent
   * `drizzle-kit generate` runs on one changed schema would each write a
   * migration directory and fork the history, so the lock cannot start at the
   * apply step.
   */
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

  /**
   * On a connection of its own, which is the fix for the deadlock below rather
   * than a preference - and never out of the application's pool, where
   * `reserve()` would pin the very connection the migration then needs.
   */
  it("opens a dedicated connection for the lock", () => {
    const open = bootstrap.slice(
      bootstrap.indexOf("const openMigrationLock"),
      bootstrap.indexOf("export const runWithMigrationLock"),
    );

    expect(open).toContain("postgres({");
    expect(open).toContain("max: 1");
    expect(open).toContain("client.end(");
    expect(bootstrap).not.toContain(".reserve(");
  });

  /**
   * A driver whose client carries no `postgres` options runs unlocked rather
   * than refusing to migrate. VitNode serves whatever `dbProvider` an app
   * configures, and the single-process case every non-monorepo app has cannot
   * race anyway.
   */
  it("degrades to unlocked rather than failing on an unknown driver", () => {
    expect(bootstrap).toMatch(/!\("shared" in options\)/);
  });
});

/**
 * A pool of a fixed size, as the smallest thing that can tell the two lock
 * designs apart.
 *
 * `drizzle({ connection })` hands an app's options to `postgres`, so `max` is
 * the app's to choose and `max: 1` is a choice a serverless function or a small
 * container has every reason to make. Nothing else about a pool matters here:
 * the question is only whether a connection is available when the migration
 * asks for one.
 */
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

/**
 * One round trip to the database, as the fakes below spend it.
 *
 * Every call the real lock makes is a query, so none of them resolves
 * synchronously - and a fake that did would let a missing `await` in
 * `runWithMigrationLock` pass unnoticed.
 */
const roundTrip = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0));
};

/**
 * A lock whose session comes from `pool`, or from nowhere.
 *
 * `pool` is `null` for the design that ships - the lock has a connection of its
 * own - and the application's pool for the design that deadlocked.
 */
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
  /**
   * The regression, stated as the thing that used to hang: a lock taken out of
   * the application's own pool with `max: 1` *was* the pool, so `runMigrations`
   * asked for a connection that could not be returned until the migration
   * blocking on it had finished. Nothing errored and nothing timed out; the
   * terminal simply stopped.
   *
   * A pool of one is the fake, so "waits forever" becomes "cannot acquire" -
   * which is the same fact where a test can see it.
   */
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

  /**
   * And the fake is not vacuous: the design this replaced fails against it.
   * Without this, the test above would pass just as well for a lock that never
   * touched a connection at all, which is not what is being claimed.
   */
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

  /**
   * A lock somebody else holds is waited for, announced once, and given up on -
   * `sleep` is injected so the deadline can be reached without spending the two
   * minutes it describes.
   */
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
