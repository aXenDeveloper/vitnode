import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { MainSettingsAdminBody } from 'vitnode-shared/admin/settings/main.dto';

import { EditMainSettingsAdminService } from './services/edit.main.service';

@ApiTags('Admin')
@Controller('admin/settings/main')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class MainSettingsAdminController {
  constructor(private readonly editMainService: EditMainSettingsAdminService) {}

  @Put('')
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
