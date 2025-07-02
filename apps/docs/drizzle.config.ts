import { defineVitNodeDrizzleConfig } from '@vitnode/core/drizzle.config';

import { POSTGRES_URL, vitNodeApiConfig } from './src/vitnode.api.config';

export default defineVitNodeDrizzleConfig({
  vitNodeApiConfig,
  out: './migrations/',
  dialect: 'postgresql',
  dbCredentials: {
    url: POSTGRES_URL,
  },
});
