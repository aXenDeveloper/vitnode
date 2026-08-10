import type { SearchDocument } from "@vitnode/core/api/models/search";
import type { Context } from "hono";

import { drizzle } from "drizzle-orm/postgres-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

import { CONFIG_PLUGIN } from "@/const";

import { categoryContent } from "./categories";
import { postContent } from "./posts";

/**
 * A real Postgres fixture for the blog's migration onto the Content Engine.
 *
 * It starts from the schema an **existing install** actually has - the blog's
 * own two tables, with its text in `core_languages_words` - and then runs the
 * committed migration over it. That is the only way to test the thing that
 * matters here: not that a fresh install gets the right tables, but that an
 * install with articles in it still has them afterwards.
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

/** The migration under test, read from the app that ships it. */
export const readMigration = (file: string): string =>
  readFileSync(resolve(here, "../../../../apps/docs/migrations", file), "utf8");

export const BLOG_MIGRATION = "0035_migrate_blog_to_content_engine.sql";

/**
 * The core tables the blog and the engine touch, stubbed to the columns they
 * use.
 *
 * Core's own migration history is not replayed: one of its migrations builds a
 * full-text column from per-language text-search configurations a stock Postgres
 * image does not ship, and none of that has anything to do with the blog.
 */
const CORE_STUBS = `
  CREATE TABLE "core_users" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(255) NOT NULL
  );
  CREATE TABLE "core_languages" (
    "id" serial PRIMARY KEY NOT NULL,
    "code" varchar(32) NOT NULL,
    "name" varchar(255) NOT NULL,
    "default" boolean DEFAULT false NOT NULL,
    "protected" boolean DEFAULT false NOT NULL,
    CONSTRAINT "core_languages_code_unique" UNIQUE("code")
  );
  CREATE TABLE "core_languages_words" (
    "id" serial PRIMARY KEY NOT NULL,
    "pluginCode" varchar(255) NOT NULL,
    "tableName" varchar(255) NOT NULL,
    "variable" varchar(255) NOT NULL,
    "itemId" integer NOT NULL,
    "languageCode" varchar(32) NOT NULL,
    "value" text NOT NULL
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
  CREATE TABLE "core_content_revisions" (
    "id" serial PRIMARY KEY NOT NULL,
    "contentTypeId" varchar(255) NOT NULL,
    "itemId" integer NOT NULL,
    "languageId" integer,
    "version" integer NOT NULL,
    "operation" varchar(32) NOT NULL,
    "snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "changedFields" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "actorType" varchar(32) NOT NULL,
    "actorUserId" integer,
    "createdAt" timestamp DEFAULT now() NOT NULL
  );
  CREATE TABLE "core_content_slug_history" (
    "id" serial PRIMARY KEY NOT NULL,
    "contentTypeId" varchar(255) NOT NULL,
    "itemId" integer NOT NULL,
    "languageId" integer,
    "path" varchar(512) NOT NULL,
    "slug" varchar(255) NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "core_content_slug_history_path_key" UNIQUE("path")
  );
  CREATE TABLE "core_content_schedules" (
    "id" serial PRIMARY KEY NOT NULL,
    "contentTypeId" varchar(255) NOT NULL,
    "itemId" integer NOT NULL,
    "action" varchar(32) NOT NULL,
    "scheduledFor" timestamp NOT NULL,
    "status" varchar(32) DEFAULT 'pending' NOT NULL,
    "actorUserId" integer,
    "queueId" integer,
    "lastError" text,
    "effectsError" text,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    "completedAt" timestamp
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

/**
 * The blog exactly as it shipped before this migration.
 *
 * Copied from `plugins/blog/src/database/{categories,posts}.ts` as they were:
 * two tables with no text on them at all, because every translated value lived
 * in `core_languages_words`. This is what an install upgrading today looks like.
 */
export const LEGACY_BLOG_SCHEMA = `
  CREATE TABLE "blog_categories" (
    "id" serial PRIMARY KEY NOT NULL,
    "color" varchar(50),
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp NOT NULL
  );
  CREATE TABLE "blog_posts" (
    "id" serial PRIMARY KEY NOT NULL,
    "categoryId" integer NOT NULL,
    "authorId" integer,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp NOT NULL,
    CONSTRAINT "blog_posts_categoryId_blog_categories_id_fk"
      FOREIGN KEY ("categoryId") REFERENCES "blog_categories"("id"),
    CONSTRAINT "blog_posts_authorId_core_users_id_fk"
      FOREIGN KEY ("authorId") REFERENCES "core_users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
  );
`;

export const ACTOR = { type: "staff" as const, userId: null };

export interface RecordedEvent {
  name: string;
  payload: unknown;
}

export interface BlogTestHarness {
  context: Context;
  db: ReturnType<typeof drizzle>;
  deleted: { itemId: number; itemType: string; locale?: string }[];
  emitted: RecordedEvent[];
  end: () => Promise<void>;
  indexed: SearchDocument[];
  /** Runs a script one statement per `--> statement-breakpoint`. */
  migrate: (script: string) => Promise<void>;
  reset: () => void;
  sql: ReturnType<typeof postgres>;
}

export const createBlogTestHarness = async (): Promise<BlogTestHarness> => {
  if (!DATABASE_TEST_URL) throw new Error("DATABASE_TEST_URL is not set.");
  if (!/test/i.test(databaseName)) {
    throw new Error(
      `DATABASE_TEST_URL points at "${databaseName || DATABASE_TEST_URL}". This suite wipes the database it runs against, so its name must contain "test".`,
    );
  }

  const sql = postgres(DATABASE_TEST_URL, {
    max: 1,
    onnotice: () => undefined,
  });

  await sql.unsafe(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
  `);
  await sql.unsafe(CORE_STUBS);
  await sql`
    INSERT INTO "core_languages" ("code", "name", "default") VALUES
      ('en', 'English', true),
      ('pl', 'Polski', false)
  `;

  const migrate = async (script: string): Promise<void> => {
    for (const statement of script.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await sql.unsafe(trimmed);
    }
  };

  const db = drizzle(sql, { casing: "camelCase" });
  const indexed: SearchDocument[] = [];
  const deleted: BlogTestHarness["deleted"] = [];
  const emitted: RecordedEvent[] = [];

  const context = {
    get: (key: string) => {
      if (key === "db") return db;
      if (key === "search") {
        return {
          countDocuments: async () => await Promise.resolve(0),
          isCanonicalStorage: () => true,
          name: () => "postgres",
          delete: async (itemType: string, itemId: number, locale?: string) => {
            deleted.push({ itemId, itemType, locale });

            return await Promise.resolve();
          },
          index: async (document: SearchDocument) => {
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
              delivered: 1,
              eventId: `event-${emitted.length}`,
              failures: [],
              status: "delivered" as const,
            });
          },
        };
      }
      if (key === "log") {
        return { error: async () => await Promise.resolve() };
      }
      if (key === "core") {
        return {
          contentRevalidateOrigins: [],
          cronSecret: "blog-test-secret",
          hasCronAdapter: false,
          contentModels: [
            { model: categoryContent, pluginId: CONFIG_PLUGIN.pluginId },
            { model: postContent, pluginId: CONFIG_PLUGIN.pluginId },
          ],
          i18n: {
            locales: [
              { code: "en", name: "English" },
              { code: "pl", name: "Polski" },
            ],
          },
          searchIndexers: [],
        };
      }

      return undefined;
    },
  } as unknown as Context;

  return {
    context,
    db,
    deleted,
    emitted,
    end: async () => {
      await sql.end();
    },
    indexed,
    migrate,
    reset: () => {
      indexed.length = 0;
      deleted.length = 0;
      emitted.length = 0;
    },
    sql,
  };
};
