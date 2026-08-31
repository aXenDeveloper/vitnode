/* eslint-disable no-console */
import { count, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createJiti } from "jiti";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import postgres from "postgres";

import { core_admin_permissions } from "@/database/admins.js";
import { core_languages, core_languages_words } from "@/database/languages.js";
import { core_moderators_permissions } from "@/database/moderators.js";
import { core_roles } from "@/database/roles.js";
import { SEARCH_TEXT_CONFIGS } from "@/database/search.js";

import type { VitNodeApiI18nConfig } from "../src/lib/i18n/types.js";
import type { VitNodeApiConfig } from "../src/vitnode.config.js";

import { getConfig } from "./get-config.js";
import { runInteractiveShellCommand } from "./run-interactive-shell-command.js";

/**
 * The path to a locally installed binary, or `null`.
 *
 * Walks up from `from` looking for `node_modules/.bin/<name>`, which is where
 * pnpm (beside the app), npm and bun (hoisted to the workspace root) all put it.
 *
 * Resolved rather than shelled out to through a package manager, because the
 * package manager is not this command's to assume: `npm run drizzle-kit` needs
 * npm installed and a `drizzle-kit` script in the app's `package.json`, and a
 * bun-only machine has neither. An absolute path needs no PATH, no script alias
 * and no package manager at all.
 */
export const resolveLocalBin = (
  name: string,
  from: string,
  { exists = existsSync, win32 = process.platform === "win32" } = {},
): null | string => {
  const binary = win32 ? `${name}.cmd` : name;

  for (
    let current = resolve(from), parent = dirname(current);
    ;
    current = parent, parent = dirname(current)
  ) {
    const candidate = join(current, "node_modules", ".bin", binary);

    if (exists(candidate)) return candidate;
    if (parent === current) return null;
  }
};

/**
 * `drizzle-kit generate` - migration files for whatever the schema now says.
 *
 * `up` first, which brings older snapshots to the current format; it is a no-op
 * on a project that has only ever used this version.
 */
export const generateDatabaseMigrations = async () => {
  const drizzleKit = resolveLocalBin("drizzle-kit", process.cwd());

  if (drizzleKit === null) {
    throw new Error(
      'Could not find "drizzle-kit" in node_modules/.bin. Install it in the app that owns the schema, then run this again.',
    );
  }

  await runInteractiveShellCommand(drizzleKit, ["up"]);
  await runInteractiveShellCommand(drizzleKit, ["generate"]);
};

/**
 * The `out` directory a loaded `drizzle.config.ts` names, or the default.
 *
 * Pure, so the precedence can be stated without a config file on disk. It
 * matters because the in-process migrator below and `drizzle-kit generate` have
 * to read and write the same directory.
 */
export const migrationsFolderFrom = (loaded: unknown): string => {
  const module = loaded as { default?: { out?: unknown }; out?: unknown };
  const out = module.default?.out ?? module.out;

  return typeof out === "string" && out.length > 0 ? out : "./migrations";
};

const getMigrationsFolder = async (): Promise<string> => {
  const configPath = join(process.cwd(), "drizzle.config.ts");
  if (!existsSync(configPath)) return migrationsFolderFrom({});

  try {
    const jiti = createJiti(import.meta.url, { interopDefault: true });

    return migrationsFolderFrom(await jiti.import(configPath));
  } catch {
    return migrationsFolderFrom({});
  }
};

/**
 * Whether a failure is Postgres saying "somebody else created that already".
 *
 * Two SQLSTATEs, and the second is the one that actually happens.
 * `CREATE TEXT SEARCH CONFIGURATION` has no `IF NOT EXISTS`, so two sessions
 * racing on it do not get `42710 duplicate_object` - they get
 * `23505 unique_violation` from the unique index on `pg_ts_config.cfgname`,
 * because both passed the existence check before either inserted.
 *
 * Walks `cause`, because the code is one wrapper deep: Drizzle raises a
 * `DrizzleQueryError` carrying no `code` of its own, with the driver's
 * `PostgresError` as its `cause`.
 */
export const isAlreadyCreatedError = (error: unknown): boolean => {
  const TOLERATED = new Set([
    "23505", // unique_violation - lost the insert race
    "42710", // duplicate_object - lost the create race
  ]);

  for (let current = error, depth = 0; current != null && depth < 5; depth++) {
    const { code } = current as { code?: unknown };

    if (typeof code === "string" && TOLERATED.has(code)) return true;

    current = (current as { cause?: unknown }).cause;
  }

  return false;
};

/**
 * Registers a fallback for any text-search config the server does not have.
 *
 * Every `regconfig` literal the generated `search_vector` column references has
 * to exist before the column is created - Postgres resolves all branches of the
 * `CASE`, even ones no row will hit, at column-creation time. The Snowball
 * configs (english, german, ...) ship with every Postgres; `polish` is a
 * hunspell dictionary only VitNode's Docker image bakes in, and managed hosts
 * cannot install one. A `COPY = simple` fallback keeps search tokenizing and
 * matching, and skips stemming. Configs that already exist are left untouched.
 */
const ensureSearchTextConfigs = async (
  dbClient: VitNodeApiConfig["dbProvider"],
): Promise<void> => {
  const wanted = [...new Set(Object.values(SEARCH_TEXT_CONFIGS))];
  if (wanted.length === 0) return;

  const existing = (await dbClient.execute(
    sql`SELECT cfgname FROM pg_ts_config`,
  )) as unknown as { cfgname: string }[];
  const have = new Set(existing.map(row => row.cfgname));
  const missing = wanted.filter(name => !have.has(name));
  if (missing.length === 0) return;

  console.log(
    `\x1b[33m[VitNode]\x1b[0m No dictionary installed for text-search config(s) [${missing.join(
      ", ",
    )}] - registering a "COPY = simple" fallback (search works, stemming is skipped).`,
  );

  for (const name of missing) {
    try {
      // `name` is a hard-coded value from SEARCH_TEXT_CONFIGS, never user input,
      // and Postgres has no `CREATE ... IF NOT EXISTS` for text-search configs.
      await dbClient.execute(
        sql.raw(`CREATE TEXT SEARCH CONFIGURATION "${name}" (COPY = simple)`),
      );
    } catch (err) {
      // Another process created it first, which is fine. `withMigrationLock`
      // makes the race rare rather than impossible.
      if (!isAlreadyCreatedError(err)) {
        throw err;
      }
    }
  }
};

export const runMigrations = async () => {
  const config = await getConfig({ type: "api.config" });

  // Before the migrations that need them: a missing dictionary fails the
  // migration that creates `search_vector`, not a later query.
  await ensureSearchTextConfigs(config.dbProvider);

  const migrationsFolder = await getMigrationsFolder();

  try {
    // In-process rather than shelling out to `drizzle-kit migrate`: that CLI
    // swallows the underlying Postgres error and just exits 1, which makes
    // failures impossible to diagnose. Both use the same
    // `drizzle.__drizzle_migrations` table, so this resumes exactly where
    // `drizzle-kit` left off.
    await migrate(config.dbProvider, { migrationsFolder });
  } catch (err) {
    const e = err as {
      code?: string;
      detail?: string;
      hint?: string;
      message?: string;
      position?: string;
      query?: string;
      severity?: string;
      where?: string;
    };

    console.error("\x1b[31m[VitNode] Database migration failed.\x1b[0m");
    if (e.severity) console.error(`\x1b[31mSeverity:\x1b[0m  ${e.severity}`);
    if (e.code) console.error(`\x1b[31mSQLSTATE:\x1b[0m  ${e.code}`);
    console.error(`\x1b[31mMessage:\x1b[0m   ${e.message ?? String(err)}`);
    if (e.detail) console.error(`\x1b[31mDetail:\x1b[0m    ${e.detail}`);
    if (e.hint) console.error(`\x1b[31mHint:\x1b[0m      ${e.hint}`);
    if (e.where) console.error(`\x1b[31mWhere:\x1b[0m     ${e.where}`);
    if (e.position) console.error(`\x1b[31mPosition:\x1b[0m  ${e.position}`);
    if (e.query) console.error(`\x1b[31mFailing SQL:\x1b[0m\n${e.query}`);
    if (err instanceof Error && err.stack) {
      console.error(`\n\x1b[90m${err.stack}\x1b[0m`);
    }

    process.exit(1);
  }
};

/**
 * The advisory-lock key every VitNode bootstrap serialises on.
 *
 * Arbitrary, and stable forever: it identifies "somebody is preparing this
 * database" and nothing else. Postgres advisory locks live in a single
 * cluster-wide namespace keyed by number, so the only property that matters is
 * that VitNode always picks the same one.
 */
const MIGRATION_LOCK_KEY = 4_675_309;

/** How long to wait for another bootstrap before giving up. */
const MIGRATION_LOCK_WAIT_MS = 120_000;

const MIGRATION_LOCK_POLL_MS = 250;

/**
 * A dedicated Postgres session that does nothing but hold the migration lock.
 *
 * `close` is here because the session is *not* the application's: it is opened
 * for the bootstrap and shut when the bootstrap ends.
 */
interface MigrationLock {
  close: () => Promise<void>;
  tryLock: () => Promise<boolean>;
  unlock: () => Promise<void>;
}

/**
 * `application_name` for the lock connection, so `pg_stat_activity` says what
 * the idle session holding an advisory lock is for.
 */
const MIGRATION_LOCK_APPLICATION_NAME = "vitnode-migration-lock";

/**
 * Opens the connection the migration lock is held on, or `null`.
 *
 * ## Why a connection of its own
 *
 * An advisory lock belongs to a *session*, so it has to be taken and released on
 * one connection that stays open for the whole bootstrap. Taking that connection
 * out of the application's pool deadlocks whenever the pool holds one: an app is
 * entitled to configure `max: 1` - a serverless function or a small container
 * has every reason to - and the migration then waits for a connection that
 * cannot be returned until the migration blocking on it has finished. Nothing
 * times out and nothing errors; the terminal simply stops.
 *
 * With a connection the pool does not know about, the bootstrap needs exactly
 * one application connection, which is the smallest pool anybody can configure.
 *
 * ## Why it is built from the app's own options
 *
 * `sql.options` is `postgres`' parsed connection configuration and part of its
 * public surface. Handing it back to `postgres()` is supported by construction -
 * `parseOptions` returns an already-parsed object untouched - so the lock
 * reaches the same database, as the same user, with the same TLS settings and
 * the same custom socket as the application, without this code knowing what any
 * of those are. Nothing is re-derived from an environment variable, which is
 * what would break the moment an app built its `dbProvider` from something other
 * than `POSTGRES_URL`.
 *
 * The four overrides are all about this connection being short-lived and
 * solitary: one connection, no idle recycling while the lock is held, its own
 * caches rather than the application's, and a recognisable `application_name`.
 *
 * A driver whose client carries no such options runs unlocked rather than
 * failing: VitNode supports whatever `dbProvider` an app configures, and
 * refusing to migrate on one this cannot introspect would be worse than the race
 * it avoids - which the single-process case does not have anyway.
 */
const openMigrationLock = (
  dbClient: VitNodeApiConfig["dbProvider"],
): MigrationLock | null => {
  const options = (
    dbClient.$client as unknown as {
      options?: Record<string, unknown>;
    }
  ).options;

  // `shared` is how `postgres` itself recognises an options object it has
  // already parsed, and the reason handing one back is safe. Its absence means
  // this is not a postgres.js client.
  if (
    typeof options !== "object" ||
    options === null ||
    !("shared" in options)
  ) {
    return null;
  }

  const client = postgres({
    ...options,
    connection: {
      ...(options.connection as Record<string, unknown> | undefined),
      application_name: MIGRATION_LOCK_APPLICATION_NAME,
    },
    idle_timeout: null,
    max: 1,
    parameters: {},
    shared: { retries: 0, typeArrayMap: {} },
    // The app's parsed options carry fields `postgres`' public `Options` type
    // does not name - it is the input type, and this is an output object. The
    // runtime contract is the one above: `parseOptions` short-circuits on
    // `shared` and returns it as it stands.
  } as unknown as Parameters<typeof postgres>[0]);

  return {
    close: async () => {
      await client.end({ timeout: 5 });
    },
    tryLock: async () => {
      const [row] =
        await client`SELECT pg_try_advisory_lock(${MIGRATION_LOCK_KEY}) AS locked`;

      return row.locked === true;
    },
    unlock: async () => {
      await client`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    },
  };
};

/**
 * Runs `run` with the migration lock held, given a lock to hold it on.
 *
 * The decisions, separated from the connection so they can be stated without a
 * database: acquire or wait, wait with a deadline, say so once, release in a
 * `finally`, and close the session whether or not the lock was ever taken.
 * `sleep` is injected for the same reason - a test for the deadline should not
 * spend two minutes proving it.
 *
 * `pg_try_advisory_lock` in a loop rather than the blocking `pg_advisory_lock`,
 * because a blocking wait cannot say why it is waiting. This one says so once,
 * and gives up after two minutes rather than hanging a developer's terminal
 * forever.
 *
 * A `null` lock runs `run` unlocked - see {@link openMigrationLock}.
 */
export const runWithMigrationLock = async ({
  initMessage,
  lock,
  run,
  sleep = async ms => {
    await new Promise(resolve => setTimeout(resolve, ms));
  },
}: {
  initMessage: string;
  lock: MigrationLock | null;
  run: () => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
}): Promise<void> => {
  if (lock === null) {
    await run();

    return;
  }

  const deadline = Date.now() + MIGRATION_LOCK_WAIT_MS;
  let held = false;
  let announced = false;

  try {
    while (!held) {
      held = await lock.tryLock();

      if (held) break;

      if (Date.now() > deadline) {
        throw new Error(
          `Timed out after ${String(
            MIGRATION_LOCK_WAIT_MS / 1000,
          )}s waiting for another process to finish preparing this database. If nothing else is running, a previous run was killed mid-migration - reconnect and retry, or check for a stuck session with "SELECT * FROM pg_locks WHERE locktype = 'advisory'".`,
        );
      }

      if (!announced) {
        console.log(
          `${initMessage} Another process is preparing this database - waiting for it to finish...`,
        );
        announced = true;
      }

      await sleep(MIGRATION_LOCK_POLL_MS);
    }

    await run();
  } finally {
    if (held) {
      try {
        await lock.unlock();
      } catch {
        // The connection is already gone, which released the lock with it.
      }
    }

    try {
      await lock.close();
    } catch {
      // Nothing left to close, which is the state this wanted anyway.
    }
  }
};

/**
 * Runs a bootstrap with the database's migration lock held.
 *
 * Because more than one process legitimately wants to prepare the same database
 * at the same time. Every app that *reads* the schema gates its `dev` script on
 * the bootstrap - the API, and any single app that mounts the API in-process -
 * so a monorepo `turbo dev` starts two of them at once. Without a lock they both
 * call `migrate()` on one database: at best one fails with "relation already
 * exists", at worst two `drizzle-kit generate` runs each write a migration
 * directory for the same schema change and the history forks.
 *
 * With it, the first process does the work and the second waits, then finds
 * nothing pending and starts.
 */
const withMigrationLock = async (
  dbClient: VitNodeApiConfig["dbProvider"],
  initMessage: string,
  run: () => Promise<void>,
): Promise<void> => {
  await runWithMigrationLock({
    initMessage,
    lock: openMigrationLock(dbClient),
    run,
  });
};

/**
 * One row of `core_languages`, as the seed writes it.
 *
 * Named because it is the whole output of the pure function below - the shape a
 * test can assert without a Postgres.
 */
export interface SeedLanguage {
  code: string;
  default: boolean;
  name: string;
  protected: boolean;
  timezone: string;
}

/**
 * The languages a fresh database is seeded with, when the API declares none.
 *
 * `en` alone, and the one place in VitNode where a timezone is guessed rather
 * than configured - which is why this is the *fallback* and `i18n.timeZone` wins
 * whenever an app has one.
 */
const DEFAULT_SEED_LANGUAGES: SeedLanguage[] = [
  {
    code: "en",
    default: true,
    name: "English (USA)",
    protected: true,
    timezone: "America/New_York",
  },
];

/**
 * The `core_languages` rows an API config asks for.
 *
 * Pure, and read from the **API** config rather than the frontend's: this
 * command runs from the app that owns the schema, which in a monorepo is the
 * API, and a bootstrap that went looking for a sibling frontend on the
 * filesystem found nothing and silently seeded `en` alone. An installation
 * declares its languages once and points both configs at that declaration.
 *
 * The rules:
 *
 * - No `i18n`, or no locales: {@link DEFAULT_SEED_LANGUAGES}. The API's own
 *   locale list is derived from what the installed packages ship when it has no
 *   block, which is not a statement about what the *site* offers - so seeding
 *   from it would write a language row per installed translation.
 * - `enabled: false` is dropped, matching `localeRoutingFromConfig`: a language
 *   the app has switched off should 404 rather than get a row that makes it
 *   selectable in the AdminCP. If that leaves nothing, the default list stands.
 * - `default` and `protected` mark `defaultLocale`, which falls back to `"en"`
 *   exactly as the API runtime's does, and then to the first configured locale
 *   when the app does not serve `en` at all - a database with no default
 *   language is not a state anything downstream can read.
 * - `timeZone` is the installation's, for every row.
 */
export const languagesFromApiConfig = (
  i18n: undefined | VitNodeApiI18nConfig,
): SeedLanguage[] => {
  const locales = (i18n?.locales ?? []).filter(
    locale => locale.enabled !== false,
  );

  if (locales.length === 0) return DEFAULT_SEED_LANGUAGES;

  const declared = i18n?.defaultLocale ?? "en";
  const defaultLocale = locales.some(locale => locale.code === declared)
    ? declared
    : locales[0].code;
  const timezone = i18n?.timeZone ?? "UTC";

  return locales.map(locale => ({
    code: locale.code,
    default: locale.code === defaultLocale,
    name: locale.name,
    protected: locale.code === defaultLocale,
    timezone,
  }));
};

/**
 * The rows a VitNode installation cannot answer a request without.
 *
 * Idempotent in both halves, which is what makes it safe to run before every dev
 * start: languages upsert on `code`, so a locale added to the config is picked
 * up by the next `db:prepare` without touching the rows already there, and the
 * roles are seeded only into an empty table.
 */
export const initialDataForDatabase = async () => {
  const config = await getConfig({ type: "api.config" });
  const dbClient = config.dbProvider;

  const [roleCount] = await dbClient
    .select({
      count: count(),
    })
    .from(core_roles)
    .limit(1);

  const languages = languagesFromApiConfig(config.i18n);

  await dbClient
    .insert(core_languages)
    .values(languages)
    .onConflictDoNothing({ target: core_languages.code });

  if (roleCount.count === 0) {
    const roles = await dbClient
      .insert(core_roles)
      .values([
        {
          // Guest role
          protected: true,
          guest: true,
        },
        {
          // Member role
          protected: true,
          default: true,
        },
        {
          // Moderator role
          protected: true,
          color: "hsl(122, 80%, 45%)",
          allowUploadFiles: true,
        },
        {
          // Administrator role
          protected: true,
          root: true,
          color: "hsl(0, 100%, 50%)",
          allowUploadFiles: true,
        },
      ])
      .returning({ id: core_roles.id });

    /**
     * Role names, in the installation's default language and no other.
     *
     * Deliberately not one row per configured locale: these are four English
     * words a `pl` installation would then see twice, once as a translation
     * nobody wrote. VitNode's own fallback already covers the gap - a role with
     * no row for the reader's language renders the default language's - so a
     * missing translation is a missing translation rather than a wrong one.
     *
     * The *code* has to be a language that exists, though: `languageCode`
     * references `core_languages.code`, so a hard-coded `"en"` is a foreign-key
     * violation on the first installation that does not serve English.
     */
    const { code: defaultLanguageCode } =
      languages.find(language => language.default) ?? languages[0];

    await dbClient.insert(core_languages_words).values(
      [
        { role: roles[0].id, value: "Guest" },
        { role: roles[1].id, value: "Member" },
        { role: roles[2].id, value: "Moderator" },
        { role: roles[3].id, value: "Administrator" },
      ].map(({ role, value }) => ({
        itemId: role,
        languageCode: defaultLanguageCode,
        pluginCode: "core",
        tableName: "core_roles",
        value,
        variable: "name",
      })),
    );

    await dbClient.insert(core_moderators_permissions).values([
      {
        roleId: roles[2].id,
        protected: true,
        unrestricted: true,
      },
      {
        roleId: roles[3].id,
        protected: true,
        unrestricted: true,
      },
    ]);

    await dbClient.insert(core_admin_permissions).values({
      roleId: roles[3].id,
      protected: true,
      unrestricted: true,
    });
  }
};

/**
 * One step of a database bootstrap: what it does, and what to print while it
 * does it.
 *
 * A record rather than a bare function so the *order* can be asserted without a
 * database. The regression this shape exists to prevent is not a broken
 * migration, it is a migration that runs beside the dev server instead of before
 * it, and no amount of Postgres proves the difference.
 */
export interface DatabaseBootstrapStep {
  action: () => Promise<void>;
  label: string;
}

/**
 * The steps of a database bootstrap, in the order they must run - and nothing
 * else.
 *
 * Pure, and separated from the running so it can be stated as a list. Every step
 * is idempotent, which is what makes it safe to run before *every* dev server
 * start rather than guarding it behind a marker file: `drizzle`'s own
 * `__drizzle_migrations` table decides what is pending, `initialDataForDatabase`
 * upserts the languages and only seeds roles into an empty table, and
 * `ensureSearchTextConfigs` skips configs that already exist. There is no
 * first-run state anywhere in VitNode, and there must not be - a marker file is
 * a second source of truth that a fresh clone, a wiped volume or a colleague's
 * machine immediately disagrees with. The database is the source of truth.
 *
 * Generation is a flag because the two callers want different things, but
 * development has always wanted it: the documented workflow for adding a content
 * type is `build:plugins && db:migrate`, and the migration for a plugin's new
 * tables does not exist until `drizzle-kit generate` writes it. It is a no-op
 * when the schema matches the last snapshot.
 *
 * Nothing here prepares a plugin. A plugin's routes are compiled into a literal
 * registry by the app's own Vite build on every dev start and every build, which
 * is a different lifecycle with a different trigger - see
 * `@vitnode/core/framework/vite`.
 */
export const databaseBootstrapSteps = ({
  generate,
}: {
  generate: boolean;
}): DatabaseBootstrapStep[] => [
  ...(generate
    ? [{ action: generateDatabaseMigrations, label: "Generate migrations..." }]
    : []),
  { action: runMigrations, label: "Apply pending migrations..." },
  { action: initialDataForDatabase, label: "Ensure initial data..." },
];

/**
 * Everything a database needs before anything serves a request.
 *
 * The implementation behind both `vitnode db:prepare` and `vitnode migrate`:
 * generate, apply, seed, all of it under one advisory lock. One implementation
 * on purpose, so the development name and the deployment name cannot drift into
 * two behaviours.
 *
 * Awaited to completion by whatever starts a dev server, and that sequencing is
 * the point rather than a detail. Run concurrently with `vite dev` or
 * `tsx watch`, a bootstrap turns every fresh checkout into a race: the first
 * requests hit a schema that is still being built, and what a developer sees is
 * an arbitrary Postgres error from a page rather than a migration log in their
 * terminal. So this resolves or it throws, and the caller starts nothing until
 * it has resolved.
 */
export const databaseBootstrap = async ({
  generate = true,
  initMessage,
}: {
  generate?: boolean;
  initMessage: string;
}): Promise<void> => {
  const config = await getConfig({ type: "api.config" });
  const steps = databaseBootstrapSteps({ generate });

  await withMigrationLock(config.dbProvider, initMessage, async () => {
    for (const [index, step] of steps.entries()) {
      console.log(
        `${initMessage} [${index + 1}/${steps.length}] ${step.label}`,
      );

      await step.action();
    }
  });
};
