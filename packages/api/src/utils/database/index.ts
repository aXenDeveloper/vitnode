import { createClientDatabase } from 'vitnode-api/utils/database/client';
import schemaDatabase from '../../core/database/index.js';

export const databaseClient = createClientDatabase({
  schemaDatabase,
});
