import { Module } from '@nestjs/common';

import { GroupsMembersAdminModule } from './groups/groups.module';
import { UsersMembersAdminModule } from './users/users.module';

@Module({
  imports: [UsersMembersAdminModule, GroupsMembersAdminModule],
})
export class MembersAdminModule {}
