import { AdminPermission } from '@/helpers/auth/admin-permission.decorator';
import { Controllers } from '@/helpers/controller.decorator';
import { CurrentUser } from '@/helpers/user.decorator';
import { Body, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  EditUserMembersAdminBody,
  UserMembersAdmin,
  UsersMembersAdminObj,
  UsersMembersAdminQuery,
} from 'vitnode-shared/admin/members/users.dto';
import { User } from 'vitnode-shared/user.dto';

import { ConfirmEmailUsersMembersAdminService } from './services/confirm-email.service';
import { DeleteUsersMembersAdminService } from './services/delete.service';
import { EditUsersMembersAdminService } from './services/edit.service';
import { GetUsersMembersAdminService } from './services/get.service';
import { ItemUsersMembersAdminService } from './services/item.service';

@Controllers({
  plugin_name: 'Members',
  plugin_code: 'members',
  isAdmin: true,
  route: 'users',
})
export class UsersMembersAdminController {
  constructor(
    private readonly getUsersService: GetUsersMembersAdminService,
    private readonly itemUsersService: ItemUsersMembersAdminService,
    private readonly editUsersService: EditUsersMembersAdminService,
    private readonly deleteUsersService: DeleteUsersMembersAdminService,
    private readonly confirmEmailService: ConfirmEmailUsersMembersAdminService,
  ) {}

  @AdminPermission({
    plugin_code: 'members',
    group: 'users',
    permission: 'can_manage_users',
  })
  @ApiNotFoundResponse()
  @ApiOkResponse({
    description: 'Confirm email',
  })
  @Get('/confirm-email/:id')
  async confirmEmail(@Param('id') id: string): Promise<void> {
    await this.confirmEmailService.confirmEmail(+id);
  }

  @AdminPermission({
    plugin_code: 'members',
    group: 'users',
    permission: 'can_manage_users',
  })
  @ApiNotFoundResponse()
  @ApiOkResponse({
    description: 'Delete user',
  })
  @Delete(':id')
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.deleteUsersService.delete({ id: +id, user });
  }

  @AdminPermission({
    plugin_code: 'members',
    group: 'users',
    permission: 'can_manage_users',
  })
  @ApiNotFoundResponse()
  @ApiOkResponse({
    type: UserMembersAdmin,
    description: 'Edit user',
  })
  @Put(':id')
  async editUser(
    @Param('id') id: string,
    @Body() body: EditUserMembersAdminBody,
  ): Promise<UserMembersAdmin> {
    return await this.editUsersService.edit({ id: +id, body });
  }

  @AdminPermission({
    plugin_code: 'members',
    group: 'users',
    permission: 'can_manage_users',
  })
  @ApiNotFoundResponse()
  @ApiOkResponse({
    type: UserMembersAdmin,
    description: 'Get user by id',
  })
  @Get(':id')
  async getUser(@Param('id') id: string): Promise<UserMembersAdmin> {
    return await this.itemUsersService.item(+id);
  }

  @AdminPermission({
    plugin_code: 'members',
    group: 'users',
    permission: 'can_manage_users',
  })
  @ApiOkResponse({
    type: UsersMembersAdminObj,
    description: 'List of users',
  })
  @Get()
  async getUsers(
    @Query() query: UsersMembersAdminQuery,
  ): Promise<UsersMembersAdminObj> {
    return await this.getUsersService.get(query);
  }
}
