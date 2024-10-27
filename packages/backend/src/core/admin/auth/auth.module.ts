import { Module } from '@nestjs/common';

import { AuthAdminController } from './auth.controller';
import { NavAuthAdminService } from './services/nav/nav.service';
import { ShowAuthAdminService } from './services/show.service';

@Module({
  providers: [ShowAuthAdminService, NavAuthAdminService],
  controllers: [AuthAdminController],
})
export class AuthAdminModule {}
