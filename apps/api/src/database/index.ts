import { createClientDatabase } from 'vitnode-api/utils/database/client';
import { schemaDatabase } from './config.js';

export const databaseClient = createClientDatabase({
  schemaDatabase,
});
