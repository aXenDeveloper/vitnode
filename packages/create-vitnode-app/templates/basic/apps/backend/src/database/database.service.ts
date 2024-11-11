import { Injectable } from '@nestjs/common';
import { InternalDatabaseService } from 'vitnode-backend/utils/database/internal_database.service';

import { schemaDatabase } from './config';

@Injectable()
export class DatabaseService extends InternalDatabaseService<
  typeof schemaDatabase
> {}
