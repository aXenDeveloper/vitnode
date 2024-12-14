import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { VitNodeCoreModule } from 'vitnode-backend/app.module';

import { DATABASE_ENVS, schemaDatabase } from './database/config';
import { DatabaseModule } from './database/database.module';
import { PluginsModule } from './plugins/plugins.module';

@Module({
  imports: [
    VitNodeCoreModule.register({
      database: {
        config: DATABASE_ENVS,
        schemaDatabase,
      },
    }),
    DatabaseModule,
    PluginsModule,
    CacheModule.register({
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
