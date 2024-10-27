import { Module } from '@nestjs/common';

import { AdminStaffAdminModule } from './admin/admin.module';
import { ModStaffAdminModule } from './mod/mod.module';

@Module({
  imports: [AdminStaffAdminModule, ModStaffAdminModule],
})
export class StaffAdminModule {}
