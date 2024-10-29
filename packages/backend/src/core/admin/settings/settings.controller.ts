import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { MainSettingsAdminBody } from 'vitnode-shared/admin/settings.dto';

import { EditMainSettingsAdminService } from './services/edit.main.service';

@ApiTags('Admin')
@Controller('admin/settings')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class SettingsAdminController {
  constructor(private readonly editMainService: EditMainSettingsAdminService) {}

  @Put('/main')
  @ApiOkResponse({
    type: MainSettingsAdminBody,
    description: 'Edit main settings',
  })
  async editMainSettings(
    @Body() body: MainSettingsAdminBody,
  ): Promise<MainSettingsAdminBody> {
    return await this.editMainService.edit(body);
  }
}
