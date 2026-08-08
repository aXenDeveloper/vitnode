import type { SearchDocument } from "@vitnode/core/api/models/search";
import type { Context } from "hono";

import { core_queue } from "@vitnode/core/database/queue";
import { drizzle } from "drizzle-orm/postgres-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

import { CONFIG_PLUGIN, EXAMPLE_MIGRATIONS } from "@/const";

import { advancedArticleContent } from "./advanced-articles";
import { articleContent } from "./articles";
import { categoryContent } from "./categories";
import { localizedArticleContent } from "./localized-articles";

/**
 * The shared Postgres fixture for the Stage 7 hardening suites.
 *
 * Extracted rather than copied because there are now several suites that need
 * the same thing: a schema built from the committed migrations, the core tables
 * the Content Engine writes to, and a request context whose event transport,
 * search engine, queue and logger all *record* instead of doing.
 *
 * Every suite runs against the same database and every one of them drops the
 * schema in its `beforeAll`, which is why `vitest.config.ts` sets
 * `fileParallelism: false`. That is a deliberate trade: one shared, real
 * database beats several mocked ones, and a suite that cannot see the
 * constraints is not testing the thing it claims to.
 */

export const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL;

const databaseName = (() => {
  if (!DATABASE_TEST_URL) return "";
  try {
    return new URL(DATABASE_TEST_URL).pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();

const here = dirname(fileURLToPath(import.meta.url));

const migrationSql = (files: readonly string[]): string =>
  files
    .map(file =>
      readFileSync(
        resolve(here, "../../../../apps/docs/migrations", file),
        "utf8",
      ),
    )
    .join("\n--> statement-breakpoint\n");

/**
 * The core tables the engine writes to, stubbed to the columns it touches.
 *
 * Core's own migration history is not replayed: one of its migrations builds a
 * full-text column from per-language text-search configurations a stock
 * Postgres image does not ship, and none of that has anything to do with the
 * Content Engine. Pulling it in would make every unrelated core change a reason
 * for these suites to break.
 */
const CORE_STUBS = `
  CREATE TABLE "core_users" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(255) NOT NULL
  );
  CREATE TABLE "core_queue" (
    "id" serial PRIMARY KEY NOT NULL,
    "pluginId" varchar(255) NOT NULL,
    "name" varchar(100) NOT NULL,
    "queue" varchar(100) DEFAULT 'default' NOT NULL,
    "status" varchar(20) DEFAULT 'pending' NOT NULL,
    "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "maxAttempts" integer DEFAULT 3 NOT NULL,
    "availableAt" timestamp DEFAULT now() NOT NULL,
    "reservedAt" timestamp,
    "lastError" text,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    "completedAt" timestamp
  );
  CREATE TABLE "core_languages" (
    "id" serial PRIMARY KEY NOT NULL,
    "code" varchar(32) NOT NULL,
    "name" varchar(255) NOT NULL,
    "default" boolean DEFAULT false NOT NULL,
    "protected" boolean DEFAULT false NOT NULL,
    CONSTRAINT "core_languages_code_unique" UNIQUE("code")
  );
  CREATE TABLE "core_search_index" (
    "id" serial PRIMARY KEY NOT NULL,
    "pluginId" varchar(255) NOT NULL,
    "itemType" varchar(100) NOT NULL,
    "itemId" integer NOT NULL,
    "languageCode" varchar(32) DEFAULT '' NOT NULL,
    "authorId" integer,
    "title" text NOT NULL,
    "content" text NOT NULL,
    "containerType" varchar(100),
    "containerId" integer,
    "url" text,
    "isPublic" boolean DEFAULT true NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp NOT NULL,
    "updatedAt" timestamp,
    "indexedAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "core_search_index_item_key"
      UNIQUE("itemType", "itemId", "languageCode")
  );
`;

/** Who the editorial suites act as. `userId: null` - see `postgres.test.ts`. */
export const ACTOR = { type: "staff" as const, userId: null };

export interface RecordedSearchDelete {
  itemId: number;
  itemType: string;
  locale?: string;
}

export interface RecordedEvent {
  name: string;
  payload: unknown;
}

/** A listener that did not receive an event, in the shape `emit` reports. */
export interface RecordedEventFailure {
  error: string;
  listener: string;
  module: string;
  pluginId: string;
}

export interface ContentTestHarness {
  /** Injected failures, flipped per test. */
  readonly behaviour: {
    /** Listeners `emit` should report as having failed. */
    eventFailures: RecordedEventFailure[];
    /** When set, the provider's `count` throws it. */
    providerCountError: Error | null;
    /**
     * What the provider's own diagnostics answer.
     *
     * `"canonical"` is the bundled Postgres provider - its store *is*
     * `core_search_index`, so it is verified without a second query.
     * `"unsupported"` is a provider with no `count`, which has to be reported as
     * unverified rather than healthy. A `Map` is a mirroring provider that can
     * be counted, keyed by locale (`""` for language-agnostic content) - which
     * is how a provider that is missing documents the canonical table has is
     * simulated at all.
     */
    providerCounts: "canonical" | "unsupported" | Map<string, number>;
    providerName: string;
    /**
     * Web origins the revalidation bridge should post to.
     *
     * Empty by default, which is what an API with no `NEXT_PUBLIC_WEB_URL` sees
     * - and what makes `attempted: 0` mean "there was nothing to tell" rather
     * than "nobody answered".
     */
    revalidateOrigins: string[];
    /** When set, every `search.index`/`search.delete` throws it. */
    searchError: Error | null;
  };
  context: Context;
  /**
   * A third connection that records every statement it issues.
   *
   * Query *counting* is the only way to state an N+1 guard as an invariant
   * rather than as a hope: "one page costs a bounded number of round trips
   * whatever the page size" is a fact about the SQL, and the SQL is the only
   * place to observe it. Separate from the main handle so an ordinary test pays
   * nothing for the instrumentation.
   */
  counted: {
    context: Context;
    db: ReturnType<typeof drizzle>;
    /** Every statement since the last `reset`, in order. */
    queries: string[];
    reset: () => void;
  };
  db: ReturnType<typeof drizzle>;
  /** Every `search.delete` the engine asked for, in order. */
  deleted: RecordedSearchDelete[];
  /** Every event the engine emitted, in order. */
  emitted: RecordedEvent[];
  end: () => Promise<void>;
  /** Every document the engine handed the search engine, in order. */
  indexed: SearchDocument[];
  /** Every line written through `c.get("log").error`. */
  logs: string[];
  /** Clears the recorders and the injected failures. */
  reset: () => void;
  /**
   * A second connection with its own context.
   *
   * The main client is `max: 1`, which serialises everything through one
   * backend - fine for optimistic locking, useless for row locks, because a
   * statement waiting on `FOR UPDATE` would be waiting on itself.
   */
  rivalContext: Context;
  rivalDb: ReturnType<typeof drizzle>;
  /** The Postgres major, for the assertions whose SQLSTATE moved in 18. */
  serverMajor: number;
  sql: ReturnType<typeof postgres>;
}

/**
 * Builds the schema and returns everything a suite needs to drive it.
 *
 * **Wipes the database it points at**, so the URL has to name one with "test"
 * in it. That check is not politeness: the suite runs `DROP SCHEMA public
 * CASCADE`.
 */
export const createContentTestHarness =
  async (): Promise<ContentTestHarness> => {
    if (!DATABASE_TEST_URL) {
      throw new Error("DATABASE_TEST_URL is not set.");
    }
    if (!/test/i.test(databaseName)) {
      throw new Error(
        `DATABASE_TEST_URL points at "${databaseName || DATABASE_TEST_URL}". This suite wipes the database it runs against, so its name must contain "test".`,
      );
    }

    const sql = postgres(DATABASE_TEST_URL, {
      max: 1,
      onnotice: () => undefined,
    });

    const [{ version }] = await sql<{ version: number }[]>`
      SELECT current_setting('server_version_num')::int AS version
    `;
    const serverMajor = Math.floor(version / 10_000);

    await sql.unsafe(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
    `);
    await sql.unsafe(CORE_STUBS);
    await sql`
      INSERT INTO "core_languages" ("code", "name", "default") VALUES
        ('en', 'English', true),
        ('pl', 'Polski', false),
        ('de', 'Deutsch', false)
    `;

    for (const statement of migrationSql(EXAMPLE_MIGRATIONS).split(
      "--> statement-breakpoint",
    )) {
      const trimmed = statement.trim();
      if (trimmed) await sql.unsafe(trimmed);
    }

    const db = drizzle(sql, { casing: "camelCase" });
    const rival = postgres(DATABASE_TEST_URL, {
      max: 1,
      onnotice: () => undefined,
    });
    const rivalDb = drizzle(rival, { casing: "camelCase" });

    const queries: string[] = [];
    const countedSql = postgres(DATABASE_TEST_URL, {
      debug: (_connection, query) => {
        queries.push(query);
      },
      max: 1,
      onnotice: () => undefined,
    });
    const countedDb = drizzle(countedSql, { casing: "camelCase" });

    const indexed: SearchDocument[] = [];
    const deleted: RecordedSearchDelete[] = [];
    const emitted: RecordedEvent[] = [];
    const logs: string[] = [];
    const behaviour: ContentTestHarness["behaviour"] = {
      eventFailures: [],
      providerCountError: null,
      providerCounts: "canonical",
      providerName: "postgres",
      revalidateOrigins: [],
      searchError: null,
    };

    /**
     * Everything the Content Engine reads off a request context.
     *
     * The queue stands in for `QueueModel.dispatch`, writing the row it would
     * and honouring the `tx` it is handed - which is the property the schedule
     * tests are about. The search engine and the event transport record rather
     * than deliver, and both can be made to fail on demand: that is what makes
     * "a committed write survives a downstream outage" testable at all.
     */
    const buildContext = (handle: typeof db): Context =>
      ({
        get: (key: string) => {
          if (key === "db") return handle;
          if (key === "search") {
            return {
              countDocuments: async ({
                languageCode,
              }: {
                itemType: string;
                languageCode?: string;
              }) => {
                if (behaviour.providerCountError) {
                  throw behaviour.providerCountError;
                }
                if (behaviour.providerCounts === "unsupported") {
                  return await Promise.resolve(null);
                }
                if (behaviour.providerCounts === "canonical") {
                  return await Promise.resolve(0);
                }

                return await Promise.resolve(
                  behaviour.providerCounts.get(languageCode ?? "") ?? 0,
                );
              },
              isCanonicalStorage: () =>
                behaviour.providerCounts === "canonical",
              name: () => behaviour.providerName,
              delete: async (
                itemType: string,
                itemId: number,
                locale?: string,
              ) => {
                if (behaviour.searchError) throw behaviour.searchError;
                deleted.push({ itemId, itemType, locale });

                return await Promise.resolve();
              },
              index: async (document: SearchDocument) => {
                if (behaviour.searchError) throw behaviour.searchError;
                indexed.push(document);

                return await Promise.resolve();
              },
            };
          }
          if (key === "events") {
            return {
              emit: async (name: string, payload: unknown) => {
                emitted.push({ name, payload });

                return await Promise.resolve({
                  delivered: behaviour.eventFailures.length === 0 ? 1 : 0,
                  eventId: `event-${emitted.length}`,
                  failures: [...behaviour.eventFailures],
                  status: "delivered" as const,
                });
              },
            };
          }
          if (key === "log") {
            return {
              error: async (message: string) => {
                logs.push(message);

                return await Promise.resolve();
              },
            };
          }
          if (key === "core") {
            return {
              // What the revalidation bridge posts to, and the secret it signs
              // with. Both live on the context in a real install too.
              contentRevalidateOrigins: behaviour.revalidateOrigins,
              cronSecret: "content-engine-test-secret",
              hasCronAdapter: false,
              contentModels: [
                { model: articleContent, pluginId: CONFIG_PLUGIN.pluginId },
                { model: categoryContent, pluginId: CONFIG_PLUGIN.pluginId },
                {
                  model: localizedArticleContent,
                  pluginId: CONFIG_PLUGIN.pluginId,
                },
                {
                  model: advancedArticleContent,
                  pluginId: CONFIG_PLUGIN.pluginId,
                },
              ],
              // Which locales this app *serves*. `core_languages` is the
              // registry of the ones that exist; a locale listed here with
              // `enabled: false` is a deliberate switch-off.
              i18n: {
                locales: [
                  { code: "en", name: "English" },
                  { code: "pl", name: "Polski" },
                  { code: "de", enabled: false, name: "Deutsch" },
                ],
              },
              searchIndexers: [],
            };
          }
          if (key === "queue") {
            return {
              dispatch: async ({
                availableAt,
                name,
                payload,
                pluginId,
                tx,
              }: {
                availableAt?: Date;
                name: string;
                payload?: Record<string, unknown>;
                pluginId?: string;
                tx?: typeof db;
              }) => {
                const [queued] = await (tx ?? handle)
                  .insert(core_queue)
                  .values({
                    availableAt: availableAt ?? new Date(),
                    name,
                    payload: payload ?? {},
                    pluginId: pluginId ?? "@vitnode/core",
                  })
                  .returning({ id: core_queue.id });

                return queued;
              },
            };
          }

          return undefined;
        },
      }) as unknown as Context;

    return {
      behaviour,
      context: buildContext(db),
      counted: {
        context: buildContext(countedDb),
        db: countedDb,
        queries,
        reset: () => {
          queries.length = 0;
        },
      },
      db,
      deleted,
      emitted,
      end: async () => {
        await sql.end();
        await rival.end();
        await countedSql.end();
      },
      indexed,
      logs,
      reset: () => {
        indexed.length = 0;
        deleted.length = 0;
        emitted.length = 0;
        logs.length = 0;
        behaviour.eventFailures = [];
        behaviour.providerCountError = null;
        behaviour.providerCounts = "canonical";
        behaviour.providerName = "postgres";
        behaviour.revalidateOrigins = [];
        behaviour.searchError = null;
      },
      rivalContext: buildContext(rivalDb),
      rivalDb,
      serverMajor,
      sql,
    };
  };

/**
 * Empties every table the suites write to, in dependency order.
 *
 * `DELETE` rather than `TRUNCATE ... CASCADE`: the cascade would silently prove
 * nothing about the foreign keys, and several suites are specifically about what
 * the database refuses.
 */
export const clearContentTables = async (
  sql: ReturnType<typeof postgres>,
): Promise<void> => {
  await sql`DELETE FROM "core_search_index"`;
  await sql`DELETE FROM "core_content_schedules"`;
  await sql`DELETE FROM "core_content_revisions"`;
  await sql`DELETE FROM "core_queue"`;
  await sql`DELETE FROM "example_advanced_articles"`;
  await sql`DELETE FROM "example_localized_articles"`;
  await sql`DELETE FROM "example_articles"`;
  await sql`DELETE FROM "example_categories"`;
  await sql`DELETE FROM "core_users"`;
};

/** The SQLSTATE a failing call reported, or `undefined` if it succeeded. */
export const pgErrorCode = async (
  run: () => Promise<unknown>,
): Promise<string | undefined> => {
  try {
    await run();
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;

    return cause?.code ?? (error as { code?: string }).code;
  }

  return undefined;
};

/**
 * Runs two writers at once and reports what each one did.
 *
 * `Promise.allSettled` rather than `Promise.all`, because the whole point is
 * that one of them is expected to lose - and `all` would reject before the
 * winner's result could be inspected.
 */
export const race = async <A, B>(
  first: () => Promise<A>,
  second: () => Promise<B>,
): Promise<
  [PromiseSettledResult<Awaited<A>>, PromiseSettledResult<Awaited<B>>]
> => {
  const results = await Promise.allSettled([first(), second()]);

  return results;
};

/** How many of a race's two sides succeeded. */
export const fulfilledCount = (
  results: readonly PromiseSettledResult<unknown>[],
): number => results.filter(entry => entry.status === "fulfilled").length;

/** The reasons the losing sides gave. */
export const reasons = (
  results: readonly PromiseSettledResult<unknown>[],
): unknown[] =>
  results.flatMap(entry => (entry.status === "rejected" ? [entry.reason] : []));
