import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ShowAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { EditAuthSettingsAdminService } from './services/edit.service';
import { ShowAuthSettingsAdminService } from './services/show.service';

@ApiTags('Admin')
@Controller('admin/settings/auth')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class AuthSettingsAdminController {
  constructor(
    private readonly showService: ShowAuthSettingsAdminService,
    private readonly editService: EditAuthSettingsAdminService,
  ) {}

  @Post()
  @ApiOkResponse({
    type: ShowAuthSettingsAdminObj,
    description: 'Edit auth settings',
  })
  async edit(
    @Body() args: ShowAuthSettingsAdminObj,
  ): Promise<ShowAuthSettingsAdminObj> {
    return this.editService.edit(args);
  }

  @Get()
  @ApiOkResponse({
    type: ShowAuthSettingsAdminObj,
    description: 'Show auth settings',
  })
  show(): ShowAuthSettingsAdminObj {
    return this.showService.show();
  }
}
