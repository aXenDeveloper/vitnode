import { Module } from '@nestjs/common';

import { AuthAdminModule } from './auth/auth.module';
import { StaffAdminModule } from './staff/staff.module';

@Module({
  imports: [AuthAdminModule, StaffAdminModule],
})
export class AdminModule {}
