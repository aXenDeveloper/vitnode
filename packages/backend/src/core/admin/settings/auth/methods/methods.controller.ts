import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateMethodAuthSettingsAdminBody,
  ShowMethodAuthSettingsAdmin,
  ShowMethodAuthSettingsAdminObj,
} from 'vitnode-shared/admin/settings/auth.dto';

import { CreateMethodsAuthSettingsAdminService } from './services/create.service';
import { ShowMethodsAuthSettingsAdminService } from './services/show.service';

@ApiTags('Admin')
@Controller('admin/settings/auth/methods')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class MethodsAuthSettingsAdminController {
  constructor(
    private readonly showService: ShowMethodsAuthSettingsAdminService,
    private readonly createService: CreateMethodsAuthSettingsAdminService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: ShowMethodAuthSettingsAdmin,
    description: 'Create new auth method',
  })
  async create(
    @Body() body: CreateMethodAuthSettingsAdminBody,
  ): Promise<ShowMethodAuthSettingsAdmin> {
    return this.createService.create(body);
  }

  @Get()
  @ApiOkResponse({
    type: ShowMethodAuthSettingsAdminObj,
    description: 'Show all auth enabled methods',
  })
  async show(): Promise<ShowMethodAuthSettingsAdminObj> {
    return this.showService.show();
  }
}
