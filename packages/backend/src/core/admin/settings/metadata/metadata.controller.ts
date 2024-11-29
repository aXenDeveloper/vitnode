import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  ShowMetadataAdminBody,
  ShowMetadataAdminObj,
} from 'vitnode-shared/admin/settings/metadata.dto';

import { EditMetadataAdminService } from './services/edit.service';
import { ShowMetadataAdminService } from './services/show.service';

@ApiSecurity('admin')
@ApiTags('Admin')
@Controller('admin/settings/metadata')
@UseGuards(AdminAuthGuard)
export class MetadataAdminController {
  constructor(
    private readonly showService: ShowMetadataAdminService,
    private readonly editService: EditMetadataAdminService,
  ) {}

  @ApiOkResponse({
    description: 'Edit metadata settings',
    type: ShowMetadataAdminObj,
  })
  @Put()
  async edit(
    @Body() body: ShowMetadataAdminBody,
  ): Promise<ShowMetadataAdminObj> {
    return this.editService.edit(body);
  }

  @ApiOkResponse({
    description: 'Return metadata settings',
    type: ShowMetadataAdminObj,
  })
  @Get()
  async show(): Promise<ShowMetadataAdminObj> {
    return this.showService.show();
  }
}
