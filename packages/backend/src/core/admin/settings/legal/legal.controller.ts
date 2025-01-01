import { AdminPermission } from '@/helpers/auth/admin-permission.decorator';
import { Controllers } from '@/helpers/controller.decorator';
import { Body, Delete, Param, Post, Put } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { CreateLegalSettingsAdminBody } from 'vitnode-shared/admin/settings/legal.dto';
import { Legal } from 'vitnode-shared/legal.dto';

import { CreateLegalSettingsAdminService } from './services/create.service';
import { DeleteLegalSettingsAdminService } from './services/delete.service';
import { EditLegalSettingsAdminService } from './services/edit.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'settings',
  isAdmin: true,
  route: 'legal',
})
export class LegalSettingsAdminController {
  constructor(
    private readonly createService: CreateLegalSettingsAdminService,
    private readonly editService: EditLegalSettingsAdminService,
    private readonly deleteService: DeleteLegalSettingsAdminService,
  ) {}

  @AdminPermission({
    plugin_code: 'core',
    group: 'settings',
    permission: 'can_manage_settings_legal',
  })
  @ApiCreatedResponse({
    type: Legal,
    description: 'Create legal',
  })
  @Post()
  async create(@Body() body: CreateLegalSettingsAdminBody): Promise<Legal> {
    return await this.createService.create(body);
  }

  @AdminPermission({
    plugin_code: 'core',
    group: 'settings',
    permission: 'can_manage_settings_legal',
  })
  @Delete(':code')
  async deleteLegal(@Param('code') code: string): Promise<void> {
    await this.deleteService.delete(code);
  }

  @AdminPermission({
    plugin_code: 'core',
    group: 'settings',
    permission: 'can_manage_settings_legal',
  })
  @ApiOkResponse({
    type: Legal,
    description: 'Edit legal',
  })
  @Put(':id')
  async editLegal(
    @Param('id') id: string,
    @Body() body: CreateLegalSettingsAdminBody,
  ): Promise<Legal> {
    return await this.editService.edit({ ...body, id: +id });
  }
}
