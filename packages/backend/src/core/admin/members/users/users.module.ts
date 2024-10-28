import { Module } from '@nestjs/common';

import { GetUsersMembersAdminService } from './services/get.service';
import { UsersMembersAdminController } from './users.controller';

@Module({
  providers: [GetUsersMembersAdminService],
  controllers: [UsersMembersAdminController],
})
export class UsersMembersAdminModule {}
