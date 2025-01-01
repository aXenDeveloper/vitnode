import { AdminPermission } from '@/helpers/auth/admin-permission.decorator';
import { Controllers } from '@/helpers/controller.decorator';
import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import {
  CreateGroupsMembersAdminBody,
  GroupMembersAdmin,
  GroupsMembersAdminObj,
  GroupsMembersAdminQuery,
} from 'vitnode-shared/admin/members/groups.dto';

import { CreateGroupsMembersAdminService } from './services/create.service';
import { DeleteGroupsMembersAdminService } from './services/delete.service';
import { EditGroupsMembersAdminService } from './services/edit.service';
import { ShowGroupsMembersAdminService } from './services/show.service';

@Controllers({
  plugin_name: 'Members',
  plugin_code: 'members',
  isAdmin: true,
  route: 'groups',
})
export class GroupsMembersAdminController {
  constructor(
    private readonly showService: ShowGroupsMembersAdminService,
    private readonly createService: CreateGroupsMembersAdminService,
    private readonly editService: EditGroupsMembersAdminService,
    private readonly deleteService: DeleteGroupsMembersAdminService,
  ) {}

  @AdminPermission({
    plugin_code: 'members',
    group: 'can_manage_groups',
  })
  @ApiCreatedResponse({
    description: 'Create group',
    type: GroupMembersAdmin,
  })
  @Post()
  async createGroup(
    @Body() body: CreateGroupsMembersAdminBody,
  ): Promise<GroupMembersAdmin> {
    return await this.createService.create(body);
  }

  @AdminPermission({
    plugin_code: 'members',
    group: 'can_manage_groups',
  })
  @ApiOkResponse({
    description: 'Delete group',
  })
  @Delete(':id')
  async deleteGroup(@Param('id') id: string): Promise<void> {
    await this.deleteService.delete(+id);
  }

  @AdminPermission({
    plugin_code: 'members',
    group: 'can_manage_groups',
  })
  @ApiNotFoundResponse()
  @ApiOkResponse({
    description: 'Edit group',
    type: GroupMembersAdmin,
  })
  @Put(':id')
  async editGroup(
    @Param('id') id: string,
    @Body() body: CreateGroupsMembersAdminBody,
  ): Promise<GroupMembersAdmin> {
    return await this.editService.edit({ id: +id, body });
  }

  @AdminPermission({
    plugin_code: 'members',
    group: 'can_manage_groups',
  })
  @ApiOkResponse({
    type: GroupsMembersAdminObj,
    description: 'Show groups',
  })
  @Get()
  async showGroups(
    @Query() query: GroupsMembersAdminQuery,
  ): Promise<GroupsMembersAdminObj> {
    return await this.showService.show(query);
  }
}
