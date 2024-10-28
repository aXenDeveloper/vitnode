import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  UserMembersAdmin,
  UsersMembersAdminObj,
  UsersMembersAdminQuery,
} from 'vitnode-shared/admin/members/users.dto';

import { GetUsersMembersAdminService } from './services/get.service';
import { ItemUsersMembersAdminService } from './services/item.service';

@ApiTags('Admin - Members')
@Controller('admin/members/users')
@ApiSecurity('admin')
export class UsersMembersAdminController {
  constructor(
    private readonly getUsersService: GetUsersMembersAdminService,
    private readonly itemUsersService: ItemUsersMembersAdminService,
  ) {}

  @Get()
  @ApiOkResponse({
    type: UsersMembersAdminObj,
  })
  async get(
    @Query() query: UsersMembersAdminQuery,
  ): Promise<UsersMembersAdminObj> {
    return await this.getUsersService.get(query);
  }

  @Get(':id')
  @ApiOkResponse({
    type: UserMembersAdmin,
  })
  @ApiNotFoundResponse()
  async item(@Param('id') id: string): Promise<UserMembersAdmin> {
    return await this.itemUsersService.item(+id);
  }
}
