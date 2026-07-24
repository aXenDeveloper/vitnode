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
import { preparePluginsFiles } from "./prepare-plugins-files.js";
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
      // 42710 = duplicate_object: another process created it first - ignore.
      if ((err as { code?: string }).code !== "42710") {
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

    // Insert default permissions
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

    // Insert default admin permissions
    await dbClient.insert(core_admin_permissions).values({
      roleId: roles[3].id,
      protected: true,
      unrestricted: true,
    });
  }
};

export const prepareDatabase = async ({
  initMessage,
  flag,
}: {
  flag: string;
  initMessage: string;
}) => {
  const steps: { action: () => Promise<void>; label: string }[] = [];

  if (flag === "--web") {
    steps.push({
      label: "Prepare plugins files...",
      action: async () => await preparePluginsFiles(flag),
    });
  } else if (flag === "--api") {
    steps.push(
      {
        label: "Prepare plugins files...",
        action: async () => await preparePluginsFiles(flag),
      },
      {
        label: "Generate migrations...",
        action: generateDatabaseMigrations,
      },
      {
        label: "Run migrations...",
        action: runMigrations,
      },
      {
        label: "Insert initial data...",
        action: initialDataForDatabase,
      },
    );
  } else {
    steps.push(
      {
        label: "Prepare plugins files...",
        action: async () => await preparePluginsFiles(flag),
      },
      {
        label: "Generate migrations...",
        action: generateDatabaseMigrations,
      },
      {
        label: "Run migrations...",
        action: runMigrations,
      },
      {
        label: "Insert initial data...",
        action: initialDataForDatabase,
      },
    );
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepNum = `[${i + 1}/${steps.length}]`;

    if (step.label === "Insert initial data...") {
      console.log(`\n${initMessage} ${stepNum} ${step.label}`);
    } else {
      console.log(`${initMessage} ${stepNum} ${step.label}`);
    }

    await step.action();
  }

  console.log(`${initMessage} \x1b[32mInitial setup completed.\x1b[0m`);
  process.exit(0);
};
