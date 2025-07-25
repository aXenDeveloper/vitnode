import { NodemailerEmailAdapter } from '@vitnode/core/api/adapters/email/nodemailer';
import { buildApiConfig } from '@vitnode/core/vitnode.config';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';

dotenv.config({
  quiet: true,
});

export const POSTGRES_URL =
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  process.env.POSTGRES_URL || 'postgresql://root:root@localhost:5432/vitnode';

export const vitNodeApiConfig = buildApiConfig({
  plugins: [],
  pathToMessages: async path => await import(`./locales/${path}`),
  dbProvider: drizzle({
    connection: POSTGRES_URL,
    casing: 'camelCase',
  }),
  email: {
    adapter: NodemailerEmailAdapter({
      from: process.env.NODE_MAILER_FROM,
      host: process.env.NODE_MAILER_HOST,
      password: process.env.NODE_MAILER_PASSWORD,
      user: process.env.NOD_EMAILER_USER,
    }),
  },
  metadata: {
    title: 'VitNode API',
    shortTitle: 'VitNode',
  },
});
