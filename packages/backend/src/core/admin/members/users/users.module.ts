import { Module } from '@nestjs/common';

import { ConfirmEmailUsersMembersAdminService } from './services/confirm-email.service';
import { DeleteUsersMembersAdminService } from './services/delete.service';
import { EditUsersMembersAdminService } from './services/edit.service';
import { GetUsersMembersAdminService } from './services/get.service';
import { ItemUsersMembersAdminService } from './services/item.service';
import { UsersMembersAdminController } from './users.controller';

@Module({
  providers: [
    GetUsersMembersAdminService,
    ItemUsersMembersAdminService,
    EditUsersMembersAdminService,

    DeleteUsersMembersAdminService,
    ConfirmEmailUsersMembersAdminService,
  ],
  controllers: [UsersMembersAdminController],
})
export class UsersMembersAdminModule {}
