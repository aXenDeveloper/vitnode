import { Controllers } from '@/helpers/controller.decorator';
import { Body, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  CreateMethodAuthSettingsAdminBody,
  EditMethodAuthSettingsAdminBody,
  ShowMethodAuthSettingsAdmin,
  ShowMethodAuthSettingsAdminObj,
} from 'vitnode-shared/admin/settings/auth.dto';

import { CreateMethodsAuthSettingsAdminService } from './services/create.service';
import { DeleteMethodsAuthSettingsAdminService } from './services/delete.service';
import { EditMethodsAuthSettingsAdminService } from './services/edit.service';
import { ShowMethodsAuthSettingsAdminService } from './services/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'settings',
  isAdmin: true,
  route: 'auth/methods',
})
export class MethodsAuthSettingsAdminController {
  constructor(
    private readonly showService: ShowMethodsAuthSettingsAdminService,
    private readonly createService: CreateMethodsAuthSettingsAdminService,
    private readonly deleteService: DeleteMethodsAuthSettingsAdminService,
    private readonly editService: EditMethodsAuthSettingsAdminService,
  ) {}

  @ApiCreatedResponse({
    type: ShowMethodAuthSettingsAdmin,
    description: 'Create new auth method',
  })
  @Post()
  async createMethod(
    @Body() body: CreateMethodAuthSettingsAdminBody,
  ): Promise<ShowMethodAuthSettingsAdmin> {
    return this.createService.create(body);
  }

  @ApiOkResponse({
    description: 'Delete auth method',
  })
  @Delete(':code')
  async deleteMethod(@Param('code') code: string): Promise<void> {
    return this.deleteService.delete(code);
  }

  @ApiOkResponse({
    description: 'Edit auth method',
    type: ShowMethodAuthSettingsAdmin,
  })
  @Put(':code')
  async editMethod(
    @Param('code') code: string,
    @Body() body: EditMethodAuthSettingsAdminBody,
  ): Promise<ShowMethodAuthSettingsAdmin> {
    return this.editService.edit({ code, body });
  }

  @ApiOkResponse({
    type: ShowMethodAuthSettingsAdminObj,
    description: 'Show all auth enabled methods',
  })
  @Get()
  async showMethod(): Promise<ShowMethodAuthSettingsAdminObj> {
    return this.showService.show();
  }
}
