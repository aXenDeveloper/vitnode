import { defineConfig } from 'drizzle-kit';

import { POSTGRES_URL } from './src/vitnode.api.config';

export default defineConfig({
  out: './src/database/migrations/',
  // schema: ['./src/plugins/**/database/schema/*'],
  schema: ['./src/database/schema/*'],
  dialect: 'postgresql',
  dbCredentials: {
    url: POSTGRES_URL,
  },
});
