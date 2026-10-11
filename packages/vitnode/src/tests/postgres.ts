import {
  generateDrizzleJson,
  generateMigration,
} from "drizzle-kit/api-postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe } from "vitest";

import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";

import { coreRelations, coreSchema } from "@/database/relations";

const TEST_POSTGRES_URL = process.env.VITNODE_TEST_POSTGRES_URL;

export const describePostgres = (name: string, body: () => void): void => {
  describe.skipIf(!TEST_POSTGRES_URL)(name, body);
};

type TestDatabase = EnvVariablesVitNode["db"];

export interface TestDatabaseHandle {
  connect: () => TestDatabase;
  db: TestDatabase;
  drop: () => Promise<void>;
}

const withDatabase = (url: string, database: string): string => {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;

  return parsed.toString();
};

export const createTestDatabase = async (
  schema: Record<string, unknown> = coreSchema,
  { onQuery }: { onQuery?: () => void } = {},
): Promise<TestDatabaseHandle> => {
  if (!TEST_POSTGRES_URL) {
    throw new Error("VITNODE_TEST_POSTGRES_URL is not set.");
  }

  const name = `vitnode_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = postgres(TEST_POSTGRES_URL, { max: 1, onnotice: () => {} });
  await admin.unsafe(`CREATE DATABASE "${name}"`);
  await admin.end();

  const url = withDatabase(TEST_POSTGRES_URL, name);
  const statements = await generateMigration(
    await generateDrizzleJson({}),
    await generateDrizzleJson(schema),
  );

  const setup = postgres(url, { max: 1, onnotice: () => {} });
  await setup.unsafe("SET TIME ZONE 'UTC'");
  for (const statement of statements) {
    await setup.unsafe(statement);
  }
  await setup.end();

  const clients: ReturnType<typeof postgres>[] = [];
  const connect = (): TestDatabase => {
    const client = postgres(url, {
      connection: { TimeZone: "UTC" },
      max: 20,
      onnotice: () => {},
    });
    clients.push(client);

    return drizzle({
      client,
      logger: onQuery ? { logQuery: () => onQuery() } : undefined,
      relations: coreRelations,
    });
  };

  return {
    connect,
    db: connect(),
    drop: async () => {
      await Promise.all(
        clients.map(async client => await client.end({ timeout: 5 })),
      );
      const cleanup = postgres(TEST_POSTGRES_URL, {
        max: 1,
        onnotice: () => {},
      });
      await cleanup.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await cleanup.end({ timeout: 5 });
    },
  };
};
