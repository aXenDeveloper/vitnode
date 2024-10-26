import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { MiddlewareModule } from './middleware/middleware.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [MiddlewareModule, AuthModule, UsersModule],
})
export class CoreModule {}
