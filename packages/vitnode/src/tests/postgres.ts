import {
  generateDrizzleJson,
  generateMigration,
} from "drizzle-kit/api-postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe } from "vitest";

const TEST_POSTGRES_URL = process.env.VITNODE_TEST_POSTGRES_URL;

export const describePostgres = (name: string, body: () => void): void => {
  describe.skipIf(!TEST_POSTGRES_URL)(name, body);
};

type TestDatabase = ReturnType<typeof drizzle>;

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

type TestSnapshot = Awaited<ReturnType<typeof generateDrizzleJson>>;

export const createTestDatabase = async (
  schema: Record<string, unknown>,
  {
    onQuery,
    snapshot = current => current,
  }: {
    onQuery?: () => void;
    /**
     * Rewrites the schema snapshot before it is applied - how a test builds the
     * database an *older* schema would have left behind, to migrate it forward.
     */
    snapshot?: (current: TestSnapshot) => TestSnapshot;
  } = {},
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
    snapshot(await generateDrizzleJson(schema)),
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
      max: 10,
      onnotice: () => {},
    });
    clients.push(client);

    return drizzle({
      client,
      logger: onQuery ? { logQuery: () => onQuery() } : undefined,
    });
  };

  return {
    connect,
    db: connect(),
    drop: async () => {
      await Promise.all(clients.map(async client => await client.end()));
      const cleanup = postgres(TEST_POSTGRES_URL, {
        max: 1,
        onnotice: () => {},
      });
      await cleanup.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await cleanup.end();
    },
  };
};
