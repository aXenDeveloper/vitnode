import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import type { DrizzleProjectConfig } from "../../prepare-database";
import type { ProcessResult } from "../project/processes";
import type { LocalMigration, QueryRows } from "./migration-state";
import type { ExplainResult } from "./statements";

import { RuntimeError } from "../errors";
import { parseDrizzleJson } from "./statements";

/** A live connection to the project's database, through its own config. */
export interface DatabaseHandle {
  /** Applies pending migrations and ensures initial data, under the lock. */
  apply: (log: (message: string) => void) => Promise<void>;
  close: () => Promise<void>;
  /** `vitnode @ localhost:5432` - never the user or the password. */
  location: null | string;
  ping: () => Promise<void>;
  query: QueryRows;
}

/** Everything the `db` commands touch outside the process - injectable. */
export interface DatabaseServices {
  drizzleConfig: () => Promise<DrizzleProjectConfig>;
  drizzleKit: (
    args: readonly string[],
    options: { capture: boolean },
  ) => Promise<ProcessResult>;
  /** Folder names under the migrations folder, sorted. */
  listMigrationFolders: (folder: string) => string[];
  open: (config: DrizzleProjectConfig) => Promise<DatabaseHandle>;
  readLocalMigrations: (folder: string) => Promise<LocalMigration[]>;
}

const PING_TIMEOUT_MS = 10_000;

export const PROVIDER_NAMES: Record<string, string> = {
  gel: "Gel",
  mssql: "SQL Server",
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  singlestore: "SingleStore",
  sqlite: "SQLite",
  turso: "Turso",
};

const locationOf = (client: unknown): null | string => {
  const options = (client as null | { options?: Record<string, unknown> })
    ?.options;
  if (options === undefined) return null;

  const first = (value: unknown) =>
    Array.isArray(value) ? (value[0] as unknown) : value;
  const host = first(options.host);
  const port = first(options.port);
  const database = options.database;

  if (typeof database !== "string" || typeof host !== "string") return null;

  const shownPort =
    typeof port === "number" || typeof port === "string"
      ? `:${String(port)}`
      : "";

  return `${database} @ ${host}${shownPort}`;
};

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `No answer from the database within ${String(ms / 1000)}s.`,
            ),
          );
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * The real implementations: the app's own `vitnode.api.config.ts` connection,
 * its own `drizzle-kit`, and drizzle-orm's migration reader. Everything heavy
 * is imported on first use.
 */
export const createDatabaseServices = (root: string): DatabaseServices => ({
  drizzleConfig: async () => {
    const { readDrizzleConfig } = await import("../../prepare-database");

    return readDrizzleConfig(root);
  },
  drizzleKit: async (args, { capture }) => {
    const { runDrizzleKit } = await import("../../prepare-database");

    return runDrizzleKit(args, { capture, root });
  },
  listMigrationFolders: folder =>
    existsSync(folder)
      ? readdirSync(folder)
          .filter(entry => statSync(join(folder, entry)).isDirectory())
          .sort()
      : [],
  open: async config => {
    const [{ getConfig }, bootstrap, { sql }] = await Promise.all([
      import("../../get-config"),
      import("../../prepare-database"),
      import("drizzle-orm"),
    ]);
    const apiConfig = await getConfig({ baseDir: root, type: "api.config" });
    const db = apiConfig.dbProvider;
    const query: QueryRows = async text => await db.execute(sql.raw(text));

    return {
      apply: async log => {
        await bootstrap.withMigrationLock(
          db,
          "[VitNode]",
          async () => {
            await bootstrap.runMigrations({
              config: apiConfig,
              migrationsFolder: config.migrationsFolder,
            });
            await bootstrap.initialDataForDatabase(apiConfig);
          },
          log,
        );
      },
      close: async () => {
        const client = db.$client as {
          end?: (options: { timeout: number }) => Promise<void>;
        };
        await client.end?.({ timeout: 5 });
      },
      location: locationOf(db.$client),
      ping: async () => {
        await withTimeout(query("SELECT 1"), PING_TIMEOUT_MS);
      },
      query,
    };
  },
  readLocalMigrations: async folder => {
    if (!existsSync(folder)) return [];
    const { readMigrationFiles } = await import("drizzle-orm/migrator");

    return readMigrationFiles({ migrationsFolder: folder }).map(migration => ({
      folderMillis: migration.folderMillis,
      hash: migration.hash,
      name: migration.name,
    }));
  },
});

/**
 * Runs drizzle-kit in JSON mode and insists on an answer it can read - its
 * structured result, never its terminal text.
 */
export const explain = async (
  services: Pick<DatabaseServices, "drizzleKit">,
  args: readonly string[],
): Promise<ExplainResult> => {
  const { code, output } = await services.drizzleKit(args, { capture: true });
  const result = parseDrizzleJson(output);
  const command = `drizzle-kit ${args[0] ?? ""}`;

  if (result === null) {
    throw new RuntimeError(`${command} failed (exit code ${String(code)}).`, {
      output,
    });
  }
  if (result.status === "error") {
    throw new RuntimeError(result.error?.message ?? `${command} failed.`, {
      output,
    });
  }

  return result;
};
