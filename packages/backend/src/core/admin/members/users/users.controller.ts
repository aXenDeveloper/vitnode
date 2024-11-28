import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { CurrentUser } from '@/helpers/user.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiSecurity('admin')
@ApiTags('Admin - Members')
@Controller('admin/members/users')
@UseGuards(AdminAuthGuard)
export class UsersMembersAdminController {
  constructor(
    private readonly getUsersService: GetUsersMembersAdminService,
    private readonly itemUsersService: ItemUsersMembersAdminService,
    private readonly editUsersService: EditUsersMembersAdminService,
    private readonly deleteUsersService: DeleteUsersMembersAdminService,
    private readonly confirmEmailService: ConfirmEmailUsersMembersAdminService,
  ) {}

  @ApiNotFoundResponse()
  @ApiOkResponse({
    description: 'Confirm email',
  })
  @Get('/confirm-email/:id')
  async confirmEmail(@Param('id') id: string): Promise<void> {
    await this.confirmEmailService.confirmEmail(+id);
  }

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

  @ApiNotFoundResponse()
  @ApiOkResponse({
    type: UserMembersAdmin,
    description: 'Get user by id',
  })
  @Get(':id')
  async getUser(@Param('id') id: string): Promise<UserMembersAdmin> {
    return await this.itemUsersService.item(+id);
  }

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
