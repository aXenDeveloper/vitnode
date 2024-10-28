import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  UsersMembersAdminObj,
  UsersMembersAdminQuery,
} from 'vitnode-shared/admin/members/users.dto';

import { GetUsersMembersAdminService } from './services/get.service';

@ApiTags('Admin - Members')
@Controller('admin/members/users')
@ApiSecurity('admin')
export class UsersMembersAdminController {
  constructor(private readonly getUsersService: GetUsersMembersAdminService) {}

  @Get()
  @ApiOkResponse({
    type: UsersMembersAdminObj,
  })
  async get(
    @Query() query: UsersMembersAdminQuery,
  ): Promise<UsersMembersAdminObj> {
    return await this.getUsersService.get(query);
  }
}
