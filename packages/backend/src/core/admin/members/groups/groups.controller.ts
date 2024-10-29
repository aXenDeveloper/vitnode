import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
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
  CreateGroupsMembersAdminBody,
  GroupMembersAdmin,
  GroupsMembersAdminObj,
  GroupsMembersAdminQuery,
} from 'vitnode-shared/admin/members/groups.dto';

import { CreateGroupsMembersAdminService } from './services/create.service';
import { DeleteGroupsMembersAdminService } from './services/delete.service';
import { EditGroupsMembersAdminService } from './services/edit.service';
import { ShowGroupsMembersAdminService } from './services/show.service';

@ApiTags('Admin - Members')
@Controller('admin/members/groups')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class GroupsMembersAdminController {
  constructor(
    private readonly showService: ShowGroupsMembersAdminService,
    private readonly createService: CreateGroupsMembersAdminService,
    private readonly editService: EditGroupsMembersAdminService,
    private readonly deleteService: DeleteGroupsMembersAdminService,
  ) {}

  @Post()
  @ApiOkResponse({
    description: 'Create group',
    type: GroupMembersAdmin,
  })
  async createGroup(
    @Body() body: CreateGroupsMembersAdminBody,
  ): Promise<GroupMembersAdmin> {
    return await this.createService.create(body);
  }

  @Delete(':id')
  @ApiOkResponse({
    description: 'Delete group',
  })
  async deleteGroup(@Param('id') id: string): Promise<void> {
    await this.deleteService.delete(+id);
  }

  @Put(':id')
  @ApiOkResponse({
    description: 'Edit group',
    type: GroupMembersAdmin,
  })
  @ApiNotFoundResponse()
  async editGroup(
    @Param('id') id: string,
    @Body() body: CreateGroupsMembersAdminBody,
  ): Promise<GroupMembersAdmin> {
    return await this.editService.edit({ id: +id, body });
  }

  @Get()
  @ApiOkResponse({
    type: GroupsMembersAdminObj,
    description: 'Show groups',
  })
  async showGroups(
    @Query() query: GroupsMembersAdminQuery,
  ): Promise<GroupsMembersAdminObj> {
    return await this.showService.show(query);
  }
}
