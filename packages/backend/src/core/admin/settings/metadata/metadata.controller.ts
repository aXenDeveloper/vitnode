import { Controllers } from '@/helpers/controller.decorator';
import { FilesValidationPipe } from '@/helpers/files/files.pipe';
import { UploadFilesMethod } from '@/helpers/upload-files.decorator';
import { Body, Get, Put, UploadedFiles } from '@nestjs/common';
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
  @UploadFilesMethod({ fields: ['icon'] })
  async edit(
    @UploadedFiles(
      new FilesValidationPipe({
        icon: {
          maxSize: 1024 * 1024, // 1 MB
          acceptMimeType: ['image/png', 'image/jpeg', 'image/webp'],
          isOptional: true,
          maxCount: 1,
        },
      }),
    )
    files: Pick<ShowMetadataAdminBody, 'icon'>,
    @Body() body: ShowMetadataAdminBody,
  ): Promise<ShowMetadataAdminObj> {
    return this.editService.edit({ body, files });
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
