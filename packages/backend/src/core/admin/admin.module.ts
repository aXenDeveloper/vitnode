import { Module } from '@nestjs/common';

import { AuthAdminModule } from './auth/auth.module';

@Module({
  imports: [AuthAdminModule],
})
export class AdminModule {}
