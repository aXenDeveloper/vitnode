import { Controllers } from '@/helpers/controller.decorator';
import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  AdminStaffMembersAdmin,
  AdminStaffMembersAdminObj,
  AdminStaffMembersAdminQuery,
  CreateAdminStaffMembersAdminBody,
} from 'vitnode-shared/admin/members/staff/admin.dto';

import { CreateAdminStaffMembersAdminService } from './services/create.service';
import { DeleteAdminStaffMembersAdminService } from './services/delete.service';
import { EditAdminStaffMembersAdminService } from './services/edit.service';
import { ShowAdminStaffMembersAdminService } from './services/show.service';

@Controllers({
  plugin_name: 'Members',
  plugin_code: 'members',
  isAdmin: true,
  route: 'staff/admin',
})
export class AdminStaffMembersAdminController {
  constructor(
    private readonly showService: ShowAdminStaffMembersAdminService,
    private readonly createService: CreateAdminStaffMembersAdminService,
    private readonly deleteService: DeleteAdminStaffMembersAdminService,
    private readonly editService: EditAdminStaffMembersAdminService,
  ) {}

  @ApiCreatedResponse({
    description: 'Create a new staff member',
    type: AdminStaffMembersAdmin,
  })
  @Post()
  async createAdmin(
    @Body() body: CreateAdminStaffMembersAdminBody,
  ): Promise<AdminStaffMembersAdmin> {
    return this.createService.create(body);
  }

  @ApiOkResponse({
    description: 'Delete a staff member',
  })
  @Delete(':id')
  async deleteAdmin(@Param('id') id: string): Promise<void> {
    await this.deleteService.delete(+id);
  }

  @ApiOkResponse({
    description: 'Edit a staff member',
    type: AdminStaffMembersAdmin,
  })
  @Put(':id')
  async editAdmin(
    @Body() body: CreateAdminStaffMembersAdminBody,
    @Param('id') id: string,
  ): Promise<AdminStaffMembersAdmin> {
    return this.editService.edit({ body, id: +id });
  }

  @ApiOkResponse({
    description: 'List of staff members',
    type: AdminStaffMembersAdminObj,
  })
  @Get()
  async showAdmins(
    @Query() query: AdminStaffMembersAdminQuery,
  ): Promise<AdminStaffMembersAdminObj> {
    return this.showService.show(query);
  }
}
