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
  ApiCreatedResponse,
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

@ApiSecurity('admin')
@ApiTags('Admin - Members')
@Controller('admin/members/groups')
@UseGuards(AdminAuthGuard)
export class GroupsMembersAdminController {
  constructor(
    private readonly showService: ShowGroupsMembersAdminService,
    private readonly createService: CreateGroupsMembersAdminService,
    private readonly editService: EditGroupsMembersAdminService,
    private readonly deleteService: DeleteGroupsMembersAdminService,
  ) {}

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

  @ApiOkResponse({
    description: 'Delete group',
  })
  @Delete(':id')
  async deleteGroup(@Param('id') id: string): Promise<void> {
    await this.deleteService.delete(+id);
  }

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
