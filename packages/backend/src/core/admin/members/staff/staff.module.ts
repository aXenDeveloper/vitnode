import { Module } from '@nestjs/common';

import { AdminStaffMembersAdminModule } from './admin/admin.module';

@Module({
  imports: [AdminStaffMembersAdminModule],
})
export class StaffMembersAdminModule {}
