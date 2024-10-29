import { Module } from '@nestjs/common';

import { AuthAdminModule } from './auth/auth.module';
import { MembersAdminModule } from './members/members.module';
import { SettingsAdminModule } from './settings/settings.module';

@Module({
  imports: [AuthAdminModule, SettingsAdminModule, MembersAdminModule],
})
export class AdminModule {}
