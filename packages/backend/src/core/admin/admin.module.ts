import { Module } from '@nestjs/common';

import { AuthAdminModule } from './auth/auth.module';
import { SettingsAdminModule } from './settings/settings.module';
import { StaffAdminModule } from './staff/staff.module';

@Module({
  imports: [AuthAdminModule, StaffAdminModule, SettingsAdminModule],
})
export class AdminModule {}
