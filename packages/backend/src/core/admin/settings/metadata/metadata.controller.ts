import { Controllers } from '@/helpers/controller.decorator';
import { Body, Get, Put } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import {
  ShowMetadataAdminBody,
  ShowMetadataAdminObj,
} from 'vitnode-shared/admin/settings/metadata.dto';

import { EditMetadataAdminService } from './services/edit.service';
import { ShowMetadataAdminService } from './services/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'settings',
  isAdmin: true,
  route: 'metadata',
})
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
