import { Module } from '@nestjs/common';

import { AuthAdminController } from './auth.controller';
import { NavAuthAdminService } from './services/nav/nav.service';
import { SearchAuthAdminService } from './services/nav/search.service';
import { ShowAuthAdminService } from './services/show.service';

@Module({
  providers: [
    ShowAuthAdminService,
    NavAuthAdminService,
    SearchAuthAdminService,
  ],
  controllers: [AuthAdminController],
})
export class AuthAdminModule {}
