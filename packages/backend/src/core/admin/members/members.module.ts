import { Module } from '@nestjs/common';

import { UsersMembersAdminModule } from './users/users.module';

@Module({
  imports: [UsersMembersAdminModule],
})
export class MembersAdminModule {}
