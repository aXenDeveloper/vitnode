import { POSTGRES_ENVS } from '@/database/client';
import { defineConfig } from 'drizzle-kit';

const { url, ...rest } = POSTGRES_ENVS;

export default defineConfig({
  out: './src/database/migrations/',
  // schema: ['./src/plugins/**/database/schema/*'],
  schema: ['./src/database/schema/*'],
  dialect: 'postgresql',
  dbCredentials: process.env.POSTGRES_URL
    ? {
        url,
      }
    : rest,
});
