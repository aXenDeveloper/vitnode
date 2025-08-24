import { buildApiConfig } from '@vitnode/core/vitnode.config';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';

config({
  quiet: true,
});

export const POSTGRES_URL =
  process.env.POSTGRES_URL || 'postgresql://root:root@localhost:5432/vitnode';

export const vitNodeApiConfig = buildApiConfig({
  plugins: [],
  pathToMessages: async path => await import(`./locales/${path}`),
  dbProvider: drizzle({
    connection: POSTGRES_URL,
    casing: 'camelCase',
  }),
  metadata: {
    title: 'VitNode API',
    shortTitle: 'VitNode',
  },
});
