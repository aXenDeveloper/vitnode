// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  databaseBootstrapSteps,
  generateDatabaseMigrations,
  initialDataForDatabase,
  languagesFromApiConfig,
  runMigrations,
  runWithMigrationLock,
} from "./prepare-database.js";

/**
 * The development bootstrap runs to completion **before** anything serves a
 * request, and it is the database's business alone.
 *
 * Pure and static: the step list is a pure function and is called as one, and the
 * CLI is read as the text it is. No Postgres, no Hono, no dev server - a test
 * that needed a database could not tell the difference between "migrated first"
 * and "migrated eventually", which is the only distinction here that matters.
 *
 * ## The regression this exists for
 *
 * Until Stage 17 a generated app's `dev` script was
 * `vitnode init && next dev`, and `vitnode init` did two unrelated things: it
 * copied every installed plugin's pages into the host's `src/app/[locale]/…` so
 * Next.js could see them, and it prepared the database - generate, apply, seed.
 *
 * Stage 17 deleted the route copier, correctly, and deleted `init` with it. The
 * database half went too, and nothing noticed for the same reason it is hard to
 * notice now: every machine that had already run `pnpm dev` once had a migrated
 * database, so only a fresh clone or a wiped volume showed it - as an arbitrary
 * Postgres error from a page rather than a migration log in a terminal.
 *
 * `vitnode db:prepare` is the database half under a name that describes only
 * itself. What this file pins is that it exists, that its steps are in the one
 * order that works, that it cannot be started concurrently with a runtime, and
 * that it has not quietly re-acquired the other half.
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

  /**
   * Generation is a flag because applying committed migrations without writing
   * new ones is a real request - a deployment step, a CI check - but the seed is
   * not optional in either. A fresh database with tables and no `Administrator`
   * role cannot be administered.
   */
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
    expect(cli).toContain('case "db:prepare":');
  });

  /**
   * `await`ed, and inside a `try`. Both halves matter and the second is the one
   * that regressed: the branch was `case "init": void prepareDatabase(...)`, and
   * `void` on an async call turns a failed step into an unhandled rejection
   * rather than an exit code this process chose. It happened to exit non-zero,
   * because crashing on an unhandled rejection is Node's default - which is to
   * say the fail-fast a `&&` depends on was a runtime default rather than a
   * decision anyone had made.
   */
  it("awaits the bootstrap and exits non-zero when it throws", () => {
    const branch = cli.slice(
      cli.indexOf('case "db:prepare":'),
      cli.indexOf('case "migrate":'),
    );

    expect(branch).toMatch(/await databaseBootstrap\(/);
    expect(branch).toMatch(/try\s*\{/);
    expect(branch).toMatch(/catch/);
    expect(branch).toMatch(/process\.exit\(1\)/);
    expect(branch).not.toMatch(/\bvoid\s+databaseBootstrap/);
  });

  /**
   * `migrate` is the same bootstrap under the name the documentation and every
   * deployment guide spell - `docs/dev/database`, the Content Engine guides and
   * the Vercel deployment page all say `db:migrate`, which runs it. It delegates
   * rather than reimplementing, so the two names cannot drift into two
   * behaviours.
   */
  it("shares one implementation with `migrate`", () => {
    const branch = cli.slice(cli.indexOf('case "migrate":'));

    expect(branch).toMatch(/await databaseBootstrap\(/);
    // The one thing `migrate --generate` does that the bootstrap does not.
    expect(branch).toMatch(/await generateDatabaseMigrations\(\)/);
    expect(cli.match(/await runMigrations\(\)/g)).toBeNull();
    expect(cli.match(/await initialDataForDatabase\(\)/g)).toBeNull();
  });

  /**
   * `init` is gone, and so is `--web`. A web app that talks to a separate API
   * owns no schema, and `--web` existed only to print "nothing to initialise" -
   * a flag whose meaning was to do nothing. The replacement is for such an app's
   * `dev` script not to call the bootstrap at all.
   */
  it("no longer offers `init` or a `--web` no-op", () => {
    expect(cli).not.toContain('case "init"');
    expect(cli).not.toContain("prepareDatabase");
    expect(bootstrap).not.toContain('"--web"');
    expect(bootstrap).not.toContain("prepareDatabase");
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
   * state machine anywhere, and this asserts the absence rather than the design:
   * the bootstrap is safe to run before *every* dev start because every step is
   * idempotent.
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
   * cannot point at different directories, and `out` is honoured rather than
   * `./migrations` being assumed.
   */
  it("reads the migrations folder from drizzle.config.ts", () => {
    expect(bootstrap).toContain("drizzle.config.ts");
    expect(bootstrap).toMatch(/loaded\.default\?\.out \?\? loaded\.out/);
    // The fallback stays a fallback.
    expect(bootstrap).toContain('return "./migrations"');
    expect(bootstrap).toMatch(
      /migrate\(config\.dbProvider, \{ migrationsFolder/,
    );
  });

  /**
   * Provisioned before the migrations that need them, not after: the generated
   * `search_vector` column resolves every `regconfig` branch at column-creation
   * time, so a missing text-search dictionary fails migration 0017 rather than a
   * later query. Managed Postgres cannot install the `polish` hunspell files, so
   * a `COPY = simple` fallback is registered for whatever is absent.
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
  /**
   * From the API config, and from nothing else.
   *
   * The regression: this used to be read from the *frontend* config, found by
   * walking `process.cwd()` for a `src/vitnode.config.ts`. `db:prepare` runs
   * from the app that owns the schema - `apps/api` here, and `apps/api` in every
   * generated monorepo - where the web app's config is a sibling the search
   * never reaches. The optional lookup returned `null` without a word, the
   * fallback ran, and a fresh database came up with `en` alone while the site
   * served `en` and `pl`.
   */
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
   * it: the default language is the one the AdminCP must not let anybody
   * delete.
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
   * A default has to exist. `defaultLocale` is optional on the API config and
   * falls back to `"en"` the way the API runtime's does - but an app that does
   * not serve English at all would then have no default row, and a
   * `core_languages` with no default is a state nothing downstream can read.
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
   * the rest alone - `onConflictDoNothing` on `code`, which is what makes the
   * seed safe to run before every dev start.
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
    expect(bootstrap).toMatch(
      /onConflictDoNothing\(\{ target: core_languages\.code \}\)/,
    );
  });

  /**
   * And the role labels go in under whichever language is the default.
   *
   * They stay English - four words nobody translated are better than four words
   * somebody invented, and VitNode falls back to the default language for a
   * missing translation anyway. What changed is the *code*: `languageCode`
   * references `core_languages.code`, so a hard-coded `"en"` is a foreign-key
   * violation on the first installation that does not serve English.
   */
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
  /**
   * More than one runtime legitimately gates on the bootstrap - the API, and any
   * single app that mounts the API in-process - so a monorepo `turbo dev` starts
   * two at once, and `cd apps/web && pnpm dev` starts one beside whatever else is
   * running.
   *
   * Measured, not theorised: with the lock bypassed, two concurrent
   * `vitnode db:prepare` runs against one empty database leave one exiting 1 -
   * first on `CREATE TEXT SEARCH CONFIGURATION "polish"`, and once that is
   * tolerated, on `CREATE SCHEMA IF NOT EXISTS drizzle`. Postgres'
   * `IF NOT EXISTS` is not race-safe against a concurrent creator. With the lock,
   * both exit 0 and the database has 40 migrations and 4 roles rather than
   * doubles of either.
   */
  it("takes a Postgres advisory lock around the whole bootstrap", () => {
    expect(bootstrap).toContain("withMigrationLock");
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
   * than a preference. An advisory lock belongs to a *session*, so one
   * connection has to stay open for the whole bootstrap - and taking it out of
   * the application's pool is what made a `max: 1` pool impossible to migrate.
   */
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

  /**
   * `pg_try_advisory_lock` in a bounded loop rather than the blocking
   * `pg_advisory_lock`: a blocking wait cannot say why it is waiting, and a
   * developer whose previous run was killed mid-migration would get a terminal
   * that never returns.
   */
  it("waits with a deadline and says what it is waiting for", () => {
    expect(bootstrap).not.toContain("pg_advisory_lock(");
    expect(bootstrap).toMatch(/MIGRATION_LOCK_WAIT_MS = [\d_]+;/);
    expect(bootstrap).toMatch(/Timed out after/);
    expect(bootstrap).toMatch(/waiting for it to finish/);
  });

  /**
   * A driver whose client carries no `postgres` options runs unlocked rather
   * than refusing to migrate. VitNode serves whatever `dbProvider` an app
   * configures, and the single-process case every non-monorepo app has cannot
   * race anyway.
   */
  it("degrades to unlocked rather than failing on an unknown driver", () => {
    expect(bootstrap).toMatch(/!\("shared" in options\)/);
    expect(bootstrap).toMatch(/if \(lock === null\) \{\s*await run\(\)/);
  });

  /**
   * And the tolerance that the race exposed: the loser of a concurrent
   * `CREATE TEXT SEARCH CONFIGURATION` gets `23505`, not the `42710` the original
   * code checked - and the code sits one wrapper deep, inside Drizzle's
   * `DrizzleQueryError`, so reading only the outermost `code` finds `undefined`.
   */
  it("tolerates both spellings of “already created”, down the cause chain", () => {
    expect(bootstrap).toContain("isAlreadyCreatedError");
    expect(bootstrap).toContain('"23505"');
    expect(bootstrap).toContain('"42710"');
    expect(bootstrap).toMatch(
      /current = \(current as \{ cause\?: unknown \}\)\.cause/,
    );
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
   * The regression, stated as the thing that used to hang.
   *
   * The old implementation called `dbClient.$client.reserve()` and then ran the
   * whole bootstrap through `dbClient` - the same pool. With `max: 1` the
   * reserved session *was* the pool, so `runMigrations` asked for a connection
   * that could not be returned until the migration blocking on it had finished.
   * Nothing errored and nothing timed out; the terminal simply stopped.
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
   *
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

describe("the bootstrap and the plugin runtime are separate", () => {
  /**
   * The invariant that keeps the two halves of the deleted `init` apart. A
   * database bootstrap that copied a plugin page would be the old command back
   * under a new name; the plugin half belongs to the app's Vite build, which
   * writes four `*.gen.ts` registries and no route file.
   */
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
