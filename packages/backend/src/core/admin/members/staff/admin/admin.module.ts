import { Module } from '@nestjs/common';

import { AdminStaffMembersAdminController } from './admin.controller';
import { CreateAdminStaffMembersAdminService } from './services/create.service';
import { DeleteAdminStaffMembersAdminService } from './services/delete.service';
import { EditAdminStaffMembersAdminService } from './services/edit.service';
import { ShowAdminStaffMembersAdminService } from './services/show.service';

@Module({
  providers: [
    ShowAdminStaffMembersAdminService,
    CreateAdminStaffMembersAdminService,
    DeleteAdminStaffMembersAdminService,
    EditAdminStaffMembersAdminService,
  ],
  controllers: [AdminStaffMembersAdminController],
})
export class AdminStaffMembersAdminModule {}
