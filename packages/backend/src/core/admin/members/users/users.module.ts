import { Module } from '@nestjs/common';

import { GetUsersMembersAdminService } from './services/get.service';
import { ItemUsersMembersAdminService } from './services/item.service';
import { UsersMembersAdminController } from './users.controller';

@Module({
  providers: [GetUsersMembersAdminService, ItemUsersMembersAdminService],
  controllers: [UsersMembersAdminController],
})
export class UsersMembersAdminModule {}
