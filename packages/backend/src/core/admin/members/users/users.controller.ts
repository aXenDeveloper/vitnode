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

@ApiTags('Admin - Members')
@Controller('admin/members/users')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class UsersMembersAdminController {
  constructor(
    private readonly getUsersService: GetUsersMembersAdminService,
    private readonly itemUsersService: ItemUsersMembersAdminService,
    private readonly editUsersService: EditUsersMembersAdminService,
    private readonly deleteUsersService: DeleteUsersMembersAdminService,
    private readonly confirmEmailService: ConfirmEmailUsersMembersAdminService,
  ) {}

  @Get('/confirm-email/:id')
  @ApiOkResponse({
    description: 'Confirm email',
  })
  @ApiNotFoundResponse()
  async confirmEmail(@Param('id') id: string): Promise<void> {
    await this.confirmEmailService.confirmEmail(+id);
  }

  @Delete(':id')
  @ApiOkResponse({
    description: 'Delete user',
  })
  @ApiNotFoundResponse()
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.deleteUsersService.delete({ id: +id, user });
  }

  @Put(':id')
  @ApiOkResponse({
    type: UserMembersAdmin,
    description: 'Edit user',
  })
  @ApiNotFoundResponse()
  async editUser(
    @Param('id') id: string,
    @Body() body: EditUserMembersAdminBody,
  ): Promise<UserMembersAdmin> {
    return await this.editUsersService.edit({ id: +id, body });
  }

  @Get(':id')
  @ApiOkResponse({
    type: UserMembersAdmin,
    description: 'Get user by id',
  })
  @ApiNotFoundResponse()
  async getUser(@Param('id') id: string): Promise<UserMembersAdmin> {
    return await this.itemUsersService.item(+id);
  }

  @Get()
  @ApiOkResponse({
    type: UsersMembersAdminObj,
    description: 'List of users',
  })
  async getUsers(
    @Query() query: UsersMembersAdminQuery,
  ): Promise<UsersMembersAdminObj> {
    return await this.getUsersService.get(query);
  }
}
