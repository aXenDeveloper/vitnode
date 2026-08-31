// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  databaseBootstrapSteps,
  generateDatabaseMigrations,
  initialDataForDatabase,
  runMigrations,
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
   * On a connection reserved out of the pool. An advisory lock belongs to a
   * session, and `postgres` hands out pooled connections - so locking on the
   * pool and unlocking on the pool are not guaranteed to be the same session,
   * which either fails to release or releases somebody else's.
   */
  it("pins one session for the lock's lifetime", () => {
    expect(bootstrap).toContain("client.reserve");
    expect(bootstrap).toContain("session.release()");
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
   * A driver that cannot pin a session runs unlocked rather than refusing to
   * migrate. VitNode serves whatever `dbProvider` an app configures, and the
   * single-process case every non-monorepo app has cannot race anyway.
   */
  it("degrades to unlocked rather than failing on an unknown driver", () => {
    expect(bootstrap).toMatch(/typeof client\.reserve !== "function"/);
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
