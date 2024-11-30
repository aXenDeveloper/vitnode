import { Controllers } from '@/helpers/controller.decorator';
import { Body, Put } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { MainSettingsAdminBody } from 'vitnode-shared/admin/settings/main.dto';

import { EditMainSettingsAdminService } from './services/edit.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'settings',
  isAdmin: true,
  route: 'main',
})
export class MainSettingsAdminController {
  constructor(private readonly editMainService: EditMainSettingsAdminService) {}

  @ApiOkResponse({
    type: MainSettingsAdminBody,
    description: 'Edit main settings',
  })
  @Put('')
  async editMainSettings(
    @Body() body: MainSettingsAdminBody,
  ): Promise<MainSettingsAdminBody> {
    return await this.editMainService.edit(body);
  }
}
