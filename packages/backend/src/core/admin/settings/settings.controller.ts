import { Body, Controller, Put } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { MainSettingsAdminBody } from 'vitnode-shared/admin/settings.dto';

import { EditMainSettingsAdminService } from './services/edit.main.service';

@ApiTags('Admin')
@Controller('admin/settings')
@ApiSecurity('admin')
export class SettingsAdminController {
  constructor(private readonly editMainService: EditMainSettingsAdminService) {}

  @Put('/main')
  @ApiOkResponse({
    type: MainSettingsAdminBody,
  })
  async editMainSettings(
    @Body() body: MainSettingsAdminBody,
  ): Promise<MainSettingsAdminBody> {
    return await this.editMainService.edit(body);
  }
}
