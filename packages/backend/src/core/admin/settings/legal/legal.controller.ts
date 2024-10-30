import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CreateLegalBody, Legal } from 'vitnode-shared/legal.dto';

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
  @ApiOkResponse({
    type: Legal,
    description: 'Create legal',
  })
  async create(@Body() body: CreateLegalBody): Promise<Legal> {
    return await this.createService.create(body);
  }
}
