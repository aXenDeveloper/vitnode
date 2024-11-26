import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { DeleteMethodsAuthSettingsAdminService } from './services/delete.service';
import { ShowMethodsAuthSettingsAdminService } from './services/show.service';

@ApiTags('Admin')
@Controller('admin/settings/auth/methods')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class MethodsAuthSettingsAdminController {
  constructor(
    private readonly showService: ShowMethodsAuthSettingsAdminService,
    private readonly createService: CreateMethodsAuthSettingsAdminService,
    private readonly deleteService: DeleteMethodsAuthSettingsAdminService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: ShowMethodAuthSettingsAdmin,
    description: 'Create new auth method',
  })
  async createMethod(
    @Body() body: CreateMethodAuthSettingsAdminBody,
  ): Promise<ShowMethodAuthSettingsAdmin> {
    return this.createService.create(body);
  }

  @Delete(':code')
  @ApiOkResponse({
    description: 'Delete auth method',
  })
  async deleteMethod(@Param('code') code: string): Promise<void> {
    return this.deleteService.delete(code);
  }

  @Get()
  @ApiOkResponse({
    type: ShowMethodAuthSettingsAdminObj,
    description: 'Show all auth enabled methods',
  })
  async showMethod(): Promise<ShowMethodAuthSettingsAdminObj> {
    return this.showService.show();
  }
}
