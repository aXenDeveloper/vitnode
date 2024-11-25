import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { ShowMethodsAuthSettingsAdminService } from './services/show.service';

@ApiTags('Admin')
@Controller('admin/settings/auth/methods')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class MethodsAuthSettingsAdminController {
  constructor(
    private readonly showService: ShowMethodsAuthSettingsAdminService,
  ) {}

  @Get()
  @ApiOkResponse({
    type: ShowMethodAuthSettingsAdminObj,
    description: 'Show all auth enabled methods',
  })
  async show(): Promise<ShowMethodAuthSettingsAdminObj> {
    return this.showService.show();
  }
}
