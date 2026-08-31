/* eslint-disable no-console */
import { count, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createJiti } from "jiti";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { core_admin_permissions } from "@/database/admins.js";
import { core_languages, core_languages_words } from "@/database/languages.js";
import { core_moderators_permissions } from "@/database/moderators.js";
import { core_roles } from "@/database/roles.js";
import { SEARCH_TEXT_CONFIGS } from "@/database/search.js";

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
/**
 * Whether a failure is Postgres saying "somebody else created that already".
 *
 * Two SQLSTATEs, and the second is the one that actually happens.
 * `CREATE TEXT SEARCH CONFIGURATION` has no `IF NOT EXISTS`, so two sessions
 * racing on it do not get `42710 duplicate_object` - they get
 * `23505 unique_violation` from the unique index on `pg_ts_config.cfgname`,
 * because both passed the existence check before either inserted. The original
 * code tolerated only `42710`, which is why the race failed a whole bootstrap.
 *
 * Walks `cause`, because the code is one wrapper deep: Drizzle 1.0 raises a
 * `DrizzleQueryError` carrying no `code` of its own, with the driver's
 * `PostgresError` as its `cause`. Reading only the outermost `code` finds
 * `undefined` and rethrows.
 */
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
 * A connection pinned out of the pool, as a tagged template plus a release.
 *
 * Structural, because the shape is `postgres`' and not Drizzle's: `$client` is
 * whichever driver the app configured, and this only asks whether it can pin a
 * session. A driver that cannot is not an error - see below.
 */
interface ReservedConnection {
  (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Record<string, unknown>[]>;
  release: () => void;
}

/**
 * Runs a bootstrap with the database's migration lock held.
 *
 * ## Why a lock at all
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
 * ## Why the lock is taken on a *reserved* connection
 *
 * An advisory lock belongs to a session, and `postgres` hands out connections
 * from a pool - so `pg_advisory_lock` on the pool and `pg_advisory_unlock` on
 * the pool are not guaranteed to be the same session, which either fails to
 * release or releases somebody else's. `reserve()` pins one connection for the
 * duration, so the session that takes the lock is the session that gives it
 * back.
 *
 * `pg_try_advisory_lock` in a loop rather than the blocking `pg_advisory_lock`,
 * because a blocking wait cannot say why it is waiting. This one says so once,
 * and gives up after two minutes rather than hanging a developer's terminal
 * forever.
 *
 * ## When there is no lock
 *
 * A driver that cannot pin a session runs unlocked rather than failing. VitNode
 * supports whatever `dbProvider` an app configures, and refusing to migrate on
 * one that has no `reserve()` would be a worse outcome than the race it avoids -
 * which, for the single-process case that every non-monorepo app has, does not
 * exist anyway.
 */
const withMigrationLock = async (
  dbClient: VitNodeApiConfig["dbProvider"],
  initMessage: string,
  run: () => Promise<void>,
): Promise<void> => {
  const client = dbClient.$client as unknown as {
    reserve?: () => Promise<ReservedConnection>;
  };

  if (typeof client.reserve !== "function") {
    await run();

    return;
  }

  const session = await client.reserve();
  const deadline = Date.now() + MIGRATION_LOCK_WAIT_MS;
  let held = false;
  let announced = false;

  try {
    while (!held) {
      const [row] =
        await session`SELECT pg_try_advisory_lock(${MIGRATION_LOCK_KEY}) AS locked`;

      if (row.locked === true) {
        held = true;
        break;
      }

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

      await new Promise(resolve => setTimeout(resolve, MIGRATION_LOCK_POLL_MS));
    }

    await run();
  } finally {
    if (held) {
      try {
        await session`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
      } catch {
        // The connection is already gone, which released the lock with it.
      }
    }

    session.release();
  }
};

export const initialDataForDatabase = async () => {
  const config = await getConfig({ type: "api.config" });
  const dbClient = config.dbProvider;
  const webConfig = await getConfig({ type: "config", optional: true });

  const [roleCount] = await dbClient
    .select({
      count: count(),
    })
    .from(core_roles)
    .limit(1);

  const languages = webConfig?.i18n?.locales?.length
    ? webConfig.i18n.locales.map(locale => ({
        code: locale.code,
        name: locale.name,
        default: locale.code === webConfig.i18n.defaultLocale,
        protected: locale.code === webConfig.i18n.defaultLocale,
        timezone: webConfig.i18n.timeZone ?? "UTC",
      }))
    : [
        {
          code: "en",
          name: "English (USA)",
          default: true,
          protected: true,
          timezone: "America/New_York",
        },
      ];

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

    await dbClient.insert(core_languages_words).values([
      {
        // Guest role
        languageCode: "en",
        pluginCode: "core",
        itemId: roles[0].id,
        value: "Guest",
        tableName: "core_roles",
        variable: "name",
      },
      {
        // Member role
        languageCode: "en",
        pluginCode: "core",
        itemId: roles[1].id,
        value: "Member",
        tableName: "core_roles",
        variable: "name",
      },
      {
        // Moderator role
        languageCode: "en",
        pluginCode: "core",
        itemId: roles[2].id,
        value: "Moderator",
        tableName: "core_roles",
        variable: "name",
      },
      {
        // Administrator role
        languageCode: "en",
        pluginCode: "core",
        itemId: roles[3].id,
        value: "Administrator",
        tableName: "core_roles",
        variable: "name",
      },
    ]);

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
