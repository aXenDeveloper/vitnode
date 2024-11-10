import { Module } from '@nestjs/common';

import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { LegalModule } from './legal/legal.module';
import { MiddlewareModule } from './middleware/middleware.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    MiddlewareModule,
    AuthModule,
    UsersModule,
    AdminModule,
    LegalModule,
    FilesModule,
  ],
})
export class CoreModule {}
