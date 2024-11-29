import { Controllers } from '@/helpers/controller.decorator';
import { Body, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  CreatePermissionsAdminPluginsAdminBody,
  DeletePermissionsAdminPluginsAdminBody,
} from 'vitnode-shared/admin/plugins/permissions-admin.dto';
import { PermissionsStaff } from 'vitnode-shared/admin/staff.dto';

import { CreatePermissionsAdminPluginsAdminService } from './services/create.service';
import { DeletePermissionsAdminPluginsAdminService } from './services/delete.service';
import { EditPermissionsAdminPluginsAdminService } from './services/edit.service';
import { ShowPermissionsAdminPluginsAdminService } from './services/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'plugins',
  isAdmin: true,
  route: 'permissions-admin',
})
export class PermissionsAdminPluginsAdminController {
  constructor(
    private readonly showService: ShowPermissionsAdminPluginsAdminService,
    private readonly createService: CreatePermissionsAdminPluginsAdminService,
    private readonly editService: EditPermissionsAdminPluginsAdminService,
    private readonly deleteService: DeletePermissionsAdminPluginsAdminService,
  ) {}

  @ApiCreatedResponse({
    description: 'Permission created',
    type: PermissionsStaff,
  })
  @Post(':plugin_code')
  async createPermission(
    @Param('plugin_code') plugin_code: string,
    @Body() body: CreatePermissionsAdminPluginsAdminBody,
  ): Promise<PermissionsStaff> {
    return await this.createService.create({ body, plugin_code });
  }

  @ApiOkResponse({ description: 'Permission deleted' })
  @Delete(':plugin_code/:id')
  async deletePermission(
    @Param('plugin_code') plugin_code: string,
    @Param('id') id: string,
    @Body() body: DeletePermissionsAdminPluginsAdminBody,
  ): Promise<void> {
    await this.deleteService.delete({ plugin_code, id, body });
  }

  @ApiOkResponse({
    description: 'Permission edited',
    type: PermissionsStaff,
  })
  @Put(':plugin_code/:old_id')
  async editPermission(
    @Param('plugin_code') plugin_code: string,
    @Param('old_id') old_id: string,
    @Body() body: CreatePermissionsAdminPluginsAdminBody,
  ): Promise<PermissionsStaff> {
    return await this.editService.edit({ body, plugin_code, old_id });
  }

  @ApiOkResponse({
    description: 'Permissions of plugin',
    type: [PermissionsStaff],
  })
  @Get(':plugin_code')
  async showPermissions(
    @Param('plugin_code') plugin_code: string,
  ): Promise<PermissionsStaff[]> {
    return await this.showService.show(plugin_code);
  }
}
