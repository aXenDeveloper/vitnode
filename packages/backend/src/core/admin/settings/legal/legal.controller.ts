import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CreateLegalSettingsAdminBody } from 'vitnode-shared/admin/settings/legal.dto';
import { Legal } from 'vitnode-shared/legal.dto';

import { CreateLegalSettingsAdminService } from './services/create.service';

@ApiTags('Admin')
@Controller('admin/settings/legal')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class LegalSettingsAdminController {
  constructor(
    private readonly createService: CreateLegalSettingsAdminService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: Legal,
    description: 'Create legal',
  })
  async create(@Body() body: CreateLegalSettingsAdminBody): Promise<Legal> {
    return await this.createService.create(body);
  }
}
