import { buildApiConfig } from '@vitnode/core/vitnode.config';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';

dotenv.config();

export const POSTGRES_URL =
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  process.env.POSTGRES_URL || 'postgresql://root:root@localhost:5432/vitnode';

export const vitNodeApiConfig = buildApiConfig({
  plugins: [],
  dbProvider: drizzle({
    connection: POSTGRES_URL,
    casing: 'camelCase',
  }),
  metadata: {
    title: 'VitNode API',
    shortTitle: 'VitNode',
  },
});
