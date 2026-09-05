/* eslint-disable no-console */
import { count, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createJiti } from "jiti";
import { existsSync } from "node:fs";
import { join } from "node:path";
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

export const generateDatabaseMigrations = async () => {
  try {
    await runInteractiveShellCommand("npm", ["run", "drizzle-kit", "up"]);
    await runInteractiveShellCommand("npm", ["run", "drizzle-kit", "generate"]);
  } catch (err) {
    console.error("\x1b[31m%s\x1b[0m", err);
    process.exit(1);
  }
};

// Reads the migrations output folder from the app's `drizzle.config.ts` (`out`),
// falling back to `./migrations` so the in-process migrator points at the same
// files `drizzle-kit generate` writes.
const getMigrationsFolder = async (): Promise<string> => {
  const configPath = join(process.cwd(), "drizzle.config.ts");
  if (existsSync(configPath)) {
    try {
      const jiti = createJiti(import.meta.url, { interopDefault: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loaded = (await jiti.import(configPath)) as any;
      const out: unknown = loaded.default?.out ?? loaded.out;
      if (typeof out === "string" && out.length > 0) {
        return out;
      }
    } catch {
      // Fall back to the default below if the config can't be read.
    }
  }

  return "./migrations";
};

// Every `regconfig` literal referenced by the generated `search_vector` column
// (see SEARCH_TEXT_CONFIGS) has to exist on the target database before the
// column is created - Postgres resolves all branches of the `CASE`, even ones no
// row will hit, at column-creation time. The Snowball configs (english, german,
// ...) ship with every Postgres, but `polish` is a hunspell dictionary only
// VitNode's Docker image bakes in. On managed hosts (e.g. Supabase) those
// dictionary files can't be installed, so we register a `COPY = simple` fallback
// for any missing config: search still tokenizes and matches, it just skips
// stemming. Configs that already exist (including a real dictionary) are left
// untouched.

const isAlreadyCreatedError = (error: unknown): boolean => {
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
      // Another process created it first, which is fine - see
      // `isAlreadyCreatedError` for why this needs two SQLSTATEs and a walk down
      // the cause chain. `withMigrationLock` makes the race rare rather than
      // impossible, so the tolerance is worth having correct.
      if (!isAlreadyCreatedError(err)) {
        throw err;
      }
    }
  }
};

export const runMigrations = async () => {
  const config = await getConfig({ type: "api.config" });

  // Provision any missing text-search configs before applying migrations, so the
  // generated `search_vector` column (0017/0018) can resolve every `regconfig`.
  await ensureSearchTextConfigs(config.dbProvider);

  const migrationsFolder = await getMigrationsFolder();

  try {
    // Run migrations in-process instead of shelling out to `drizzle-kit migrate`:
    // that CLI swallows the underlying Postgres error and just exits 1, which
    // makes failures impossible to diagnose. The in-process migrator throws the
    // real error, which we log in full below. Both use the same
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
 * Three calls, and the third is the one that makes the shape worth naming:
 * `close` exists because this session is *not* the application's. It is opened
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
 * ## Why this is a connection of its own
 *
 * An advisory lock belongs to a *session*, so the lock has to be taken and
 * released on one connection that stays open for the whole bootstrap. The
 * obvious way to get one is `postgres`' own `reserve()`, which pins a connection
 * out of the application's pool - and that is exactly what this used to do, and
 * it deadlocks.
 *
 * The pool has a size. `drizzle({ connection })` passes an app's options through
 * to `postgres`, so `max: 1` is a configuration a VitNode app is entitled to
 * have - a serverless function or a small container has every reason to. With
 * `max: 1`, `reserve()` takes the only connection there is; `runMigrations` then
 * asks the same pool for one to migrate on, and waits for a connection that
 * cannot be returned until the migration it is blocking has finished. Nothing
 * times out and nothing errors: the terminal simply stops.
 *
 * So the lock gets a connection the pool does not know about, and every pooled
 * connection stays available for the work being serialised. The bootstrap then
 * needs exactly one application connection, which is the smallest pool anybody
 * can configure.
 *
 * ## Why it is built from the app's own options
 *
 * `sql.options` is `postgres`' parsed connection configuration and part of its
 * public surface (`Sql.options: ParsedOptions`). Handing it back to `postgres()`
 * is supported by construction - `parseOptions` returns an already-parsed object
 * untouched - so the lock connects to the same database, as the same user, with
 * the same TLS settings and the same custom socket as the application, without
 * this code knowing what any of those are. Nothing is re-derived from an
 * environment variable, which is what would break the moment an app built its
 * `dbProvider` from something other than `POSTGRES_URL`.
 *
 * Four fields are overridden, and each is about this connection being
 * short-lived and solitary: one connection, no idle recycling while the lock is
 * held, its own server-parameter and type caches rather than the application's,
 * and a recognisable `application_name`.
 *
 * ## When there is no lock
 *
 * A driver whose client carries no such options runs unlocked rather than
 * failing. VitNode supports whatever `dbProvider` an app configures, and
 * refusing to migrate on one this cannot introspect would be a worse outcome
 * than the race it avoids - which, for the single-process case that every
 * non-monorepo app has, does not exist anyway.
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
 *
 * Exported for `./database-bootstrap.test.ts`, which drives it with a fake lock
 * and a fake single-connection pool. That is the only way to state the property
 * this layer exists for - that holding the lock costs the application pool
 * nothing - without a Postgres.
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
 * so a monorepo `turbo dev` starts two of them at once. Without a lock they
 * both call `migrate()` on one database: at best one fails with "relation
 * already exists", at worst two `drizzle-kit generate` runs each write a
 * migration directory for the same schema change and the history forks.
 *
 * With it, the first process does the work and the second waits, then finds
 * nothing pending and starts. That is what makes "gate every runtime" safe
 * rather than merely well intentioned, and it is the same reason a horizontally
 * scaled deployment could run this without its replicas racing.
 *
 * The lock is held on a connection of its own, so the application pool is left
 * entirely to the work being serialised - see {@link openMigrationLock}.
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
 * Pure, and the answer to a question the bootstrap used to get wrong.
 *
 * ## What it replaced
 *
 * The seed read the *frontend* config - `getConfig({ type: "config" })`, which
 * walks the working directory looking for a `src/vitnode.config.ts`. Run from
 * the app that owns the schema, which in this repository and in every generated
 * monorepo is the API, there is no such file to find: the web app's config is a
 * sibling the search never reaches. So the lookup returned `null`, the fallback
 * ran, and a fresh database came up with `en` and nothing else - however many
 * languages the installation actually serves. `pl` was missing from
 * `core_languages`, and everything keyed on a language row - translations,
 * localized content, the AdminCP's language switcher - had nowhere to put it.
 *
 * A database bootstrap discovering a *frontend* by walking the filesystem was
 * the mistake underneath the symptom. The API config is the one this command
 * already loads, an installation declares its languages once and points both
 * configs at that declaration, and nothing here looks for a sibling app.
 *
 * ## The rules
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

  // Idempotent by `code`, which is what lets a locale be added to the config and
  // picked up by the next `db:prepare` without touching the rows already there.
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
     * Renaming a role in the AdminCP is how a real name gets there.
     *
     * The *code* has to be a language that exists, though. `languageCode`
     * references `core_languages.code`, so the `"en"` this was hard-coded to
     * was a foreign-key violation waiting for the first installation that does
     * not serve English - which is reachable now that these rows come from the
     * app's own configuration rather than from a fallback that always said `en`.
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
 * One step of a database bootstrap: what it does, and what to print while it does
 * it.
 *
 * A record rather than a bare function so the *order* can be asserted without a
 * database. That is the whole reason this type is exported: the regression this
 * layer exists to prevent is not a broken migration, it is a migration that runs
 * beside the dev server instead of before it, and no amount of Postgres proves
 * the difference. `database-bootstrap.test.ts` reads this list.
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
 * is idempotent, which is what makes it safe to run this before *every* dev
 * server start rather than guarding it behind a marker file: `drizzle`'s own
 * `__drizzle_migrations` table decides what is pending, `initialDataForDatabase`
 * upserts the languages and only seeds roles into an empty table, and
 * `ensureSearchTextConfigs` skips configs that already exist. There is no
 * first-run state anywhere in VitNode, and there must not be - a marker file is
 * a second source of truth that a fresh clone, a wiped volume or a colleague's
 * machine immediately disagrees with.
 *
 * ## Why generation is one of the steps
 *
 * `generate` is a flag rather than an assumption because the two callers want
 * different things, but development has always wanted generation: VitNode's
 * documented workflow for adding a content type is
 * `build:plugins && db:migrate`, and the migration for a plugin's new tables
 * does not exist until `drizzle-kit generate` writes it. Dropping generation
 * from the dev bootstrap would leave that documented flow needing a command the
 * docs do not mention. It is a no-op when the schema matches the last snapshot,
 * so it costs a `drizzle-kit` round trip and nothing else.
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
 * `vitnode db:prepare` - everything a database needs before anything serves a
 * request.
 *
 * Awaited to completion by whatever starts a dev server, and that sequencing is
 * the point rather than a detail. Serialised by
 * {@link withMigrationLock}, because more than one runtime legitimately gates on
 * it: the API and any single app that mounts the API both need the schema before
 * they start, and a monorepo `turbo dev` launches them at once. Run concurrently with `vite dev` or
 * `tsx watch`, a bootstrap turns every fresh checkout into a race: the first
 * requests hit a schema that is still being built, and what a developer sees is
 * an arbitrary Postgres error from a page rather than a migration log from their
 * terminal. So this resolves or it throws, and the caller starts nothing until it
 * has resolved.
 *
 * ## What it is not
 *
 * It was `vitnode init` until Stage 17, and the rename is not cosmetic. That
 * command had two responsibilities bolted together: it prepared the database,
 * and - through `preparePluginsFiles` - it copied every installed plugin's pages
 * into the host app's `src/app/[locale]/…` so Next.js could see them. Removing
 * the copier removed the reason `init` was called `init`, and left a command
 * whose name promised a project-wide setup while doing one thing.
 *
 * A plugin's routes are compiled into a literal registry by the app's own Vite
 * plugin now, on every dev start and every build. Nothing here prepares a
 * plugin, nothing here writes a route file, and nothing here knows what a plugin
 * is. See `@vitnode/core/framework/vite`.
 *
 * `--web` is gone with it. A web app that talks to a separate API owns no
 * schema, so the honest answer is for its `dev` script not to call this at all
 * rather than for this to accept a flag meaning "do nothing".
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
