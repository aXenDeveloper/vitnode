import { Module } from '@nestjs/common';

import { GroupsMembersAdminController } from './groups.controller';
import { CreateGroupsMembersAdminService } from './services/create.service';
import { DeleteGroupsMembersAdminService } from './services/delete.service';
import { EditGroupsMembersAdminService } from './services/edit.service';
import { ShowGroupsMembersAdminService } from './services/show.service';

@Module({
  providers: [
    ShowGroupsMembersAdminService,
    CreateGroupsMembersAdminService,
    EditGroupsMembersAdminService,
    DeleteGroupsMembersAdminService,
  ],
  controllers: [GroupsMembersAdminController],
})
export class GroupsMembersAdminModule {}
