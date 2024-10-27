import { Module } from '@nestjs/common';

import { AuthAdminController } from './auth.controller';
import { ShowAuthAdminService } from './services/show.service';

@Module({
  providers: [ShowAuthAdminService],
  controllers: [AuthAdminController],
})
export class AuthAdminModule {}
