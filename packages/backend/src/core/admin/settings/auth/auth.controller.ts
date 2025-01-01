import { AdminPermission } from '@/helpers/auth/admin-permission.decorator';
import { Controllers } from '@/helpers/controller.decorator';
import { Body, Get, Post } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ShowAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { EditAuthSettingsAdminService } from './services/edit.service';
import { ShowAuthSettingsAdminService } from './services/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'settings',
  isAdmin: true,
  route: 'auth',
})
export class AuthSettingsAdminController {
  constructor(
    private readonly showService: ShowAuthSettingsAdminService,
    private readonly editService: EditAuthSettingsAdminService,
  ) {}

  @AdminPermission({
    plugin_code: 'core',
    group: 'settings',
    permission: 'can_manage_settings_authorization',
  })
  @ApiOkResponse({
    type: ShowAuthSettingsAdminObj,
    description: 'Edit auth settings',
  })
  @Post()
  async edit(
    @Body() args: ShowAuthSettingsAdminObj,
  ): Promise<ShowAuthSettingsAdminObj> {
    return this.editService.edit(args);
  }

  @AdminPermission({
    plugin_code: 'core',
    group: 'settings',
    permission: 'can_manage_settings_authorization',
  })
  @ApiOkResponse({
    type: ShowAuthSettingsAdminObj,
    description: 'Show auth settings',
  })
  @Get()
  async show(): Promise<ShowAuthSettingsAdminObj> {
    return this.showService.show();
  }
}
