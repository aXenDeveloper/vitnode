import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CreateLegalSettingsAdminBody } from 'vitnode-shared/admin/settings/legal.dto';
import { Legal } from 'vitnode-shared/legal.dto';

import { CreateLegalSettingsAdminService } from './services/create.service';
import { DeleteLegalSettingsAdminService } from './services/delete.service';
import { EditLegalSettingsAdminService } from './services/edit.service';

@ApiTags('Admin')
@Controller('admin/settings/legal')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class LegalSettingsAdminController {
  constructor(
    private readonly createService: CreateLegalSettingsAdminService,
    private readonly editService: EditLegalSettingsAdminService,
    private readonly deleteService: DeleteLegalSettingsAdminService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: Legal,
    description: 'Create legal',
  })
  async create(@Body() body: CreateLegalSettingsAdminBody): Promise<Legal> {
    return await this.createService.create(body);
  }

  @Delete(':code')
  async deleteLegal(@Param('code') code: string): Promise<void> {
    await this.deleteService.delete(code);
  }

  @Put(':id')
  @ApiOkResponse({
    type: Legal,
    description: 'Edit legal',
  })
  async editLegal(
    @Param('id') id: string,
    @Body() body: CreateLegalSettingsAdminBody,
  ): Promise<Legal> {
    return await this.editService.edit({ ...body, id: +id });
  }
}
