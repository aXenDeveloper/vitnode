import { Module } from '@nestjs/common';

import { GroupsMembersAdminModule } from './groups/groups.module';
import { StaffMembersAdminModule } from './staff/staff.module';
import { UsersMembersAdminModule } from './users/users.module';

@Module({
  imports: [
    UsersMembersAdminModule,
    GroupsMembersAdminModule,
    StaffMembersAdminModule,
  ],
})
export class MembersAdminModule {}
